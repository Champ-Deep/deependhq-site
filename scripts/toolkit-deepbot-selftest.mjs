// scripts/toolkit-deepbot-selftest.mjs : DeepBot (docs/toolkit-v4-api.md section 8).
// Real SQL (node:sqlite), real token verification, in-memory R2. The model is a scripted fixture: no network.
// Run: node scripts/toolkit-deepbot-selftest.mjs

import {
  makeD1, makeR2, setSetting, seedGrant, installFetchRouter, resetClerkFixtures,
  apiRequest, sessionToken, PK, SK, CLERK_JS_URL, JWT_PUBLIC_PEM, check, finish, ORIGIN,
} from './toolkit-testkit.mjs';

installFetchRouter();
const clerkRouter = globalThis.fetch;

// --- fixture model -------------------------------------------------------------------
const fx = { chat: [], spend: [], script: [], model: null, intake: null };
const usage = (cost) => ({ prompt_tokens: 100, completion_tokens: 20, cost });
const say = (content, cost = 0.0005) => ({ choices: [{ message: { content } }], usage: usage(cost) });
const tool = (name, args = {}, cost = 0.0005, id = 'call_1') => ({ choices: [{ message: { content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }], usage: usage(cost) });
const res = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === 'https://openrouter.ai/api/v1/chat/completions') {
    const body = JSON.parse(init.body);
    if (body.response_format) return res({ id: 'gen-intake', choices: [{ message: { content: JSON.stringify(fx.intake) } }], usage: usage(0.0002) });
    fx.chat.push(body);
    const next = fx.model ? fx.model(body) : fx.script.shift();
    return next === 'fail' ? res({ error: 'down' }, 503) : res({ id: 'gen-x', ...(next ?? say('(script ended)')) });
  }
  if (url.startsWith('https://treg.to/') || url === 'https://openrouter.ai/api/alpha/decisions') { fx.spend.push(url); return res({}); }
  return clerkRouter(input, init);
};
const reset = () => { fx.chat = []; fx.spend = []; fx.script = []; fx.model = null; fx.intake = null; };

const { handleToolkit } = await import('../worker/toolkit.js');
const fresh = (credits = 5000) => {
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 25000000);
  setSetting(d1, 'default_daily_credit_cap', 1000);
  setSetting(d1, 'default_daily_row_cap', 5000);
  seedGrant(d1, 'user_a', credits);
  seedGrant(d1, 'user_b', credits);
  return { d1, env: { TOOLKIT_DB: d1, TOOLKIT_FILES: makeR2(), CLERK_PUBLISHABLE_KEY: PK, CLERK_SECRET_KEY: SK, CLERK_JWT_KEY: JWT_PUBLIC_PEM, CLERK_JS_URL, OPENROUTER_API_KEY: 'or-key' } };
};
async function post(env, body, sub = 'user_a') {
  const r = await handleToolkit(apiRequest(body, { token: sessionToken({ sub }) }), env);
  return { status: r.status, body: await r.json() };
}
const put = async (env, name, csv) => (await post(env, { action: 'files_put', folder: '/', name, mime: 'text/csv', content_base64: Buffer.from(csv).toString('base64') })).body.entry.id;
const toolMsgs = (body) => body.messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
const CSV = 'Person Name,Job,Company\nJane SAMPLESECRET Doe,VP Sales,Acme\nRaj K,head of mktg,Globex\n';
const EXPECTED_TOOLS = ['files_list', 'file_peek', 'intake_plan', 'quote', 'report_summary', 'page_steps', 'catalog', 'connector_pull', 'connector_act'];

// 1. files_list, then an answer; the tool list is closed; the turn is stored
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  await put(env, 'leads.csv', CSV);
  fx.script = [tool('files_list', { folder: '/' }), say('You have one file, leads.csv \u2014 want me to look?')];
  const r = await post(env, { action: 'deepbot', message: 'what files do I have?', context: { stage: 'file', window: 'workbench', targets: [] } });
  check('turn: 200 with thread, reply, steps, cards, asks, cost, model', r.status === 200 && r.body.thread_id && /leads\.csv/.test(r.body.reply) && Array.isArray(r.body.steps) && Array.isArray(r.body.cards) && Array.isArray(r.body.asks) && r.body.cost_micro === 1000 && r.body.model === 'deepseek/deepseek-v4.1-flash', JSON.stringify(r.body));
  check('turn: em dash never reaches the user', !/[\u2014\u2013]/.test(r.body.reply), r.body.reply);
  check('turn: two model calls, the second one saw the files_list result', fx.chat.length === 2 && toolMsgs(fx.chat[1])[0].entries[0].name === 'leads.csv', JSON.stringify(fx.chat[1]?.messages.at(-1)));
  check('turn: the closed tool list is exactly the registry', JSON.stringify(fx.chat[0].tools.map((t) => t.function.name)) === JSON.stringify(EXPECTED_TOOLS) && fx.chat[1].tools.length === 9);
  check('turn: routing capped at the admin model price', fx.chat[0].provider.max_price.prompt === 0.14 && fx.chat[0].model === 'deepseek/deepseek-v4.1-flash');
  const turns = d1.query(`SELECT seq, role FROM deepbot_turns WHERE thread_id=?`, r.body.thread_id).results;
  check('thread: one thread row, user then assistant turn stored', turns.length === 2 && turns[0].role === 'user' && turns[1].seq === 2 && d1.query(`SELECT * FROM deepbot_threads WHERE user_id='user_a'`).results.length === 1);
  const two = await post(env, { action: 'deepbot', thread_id: r.body.thread_id, message: 'thanks' });
  check('thread: a second turn continues it; the model got the first exchange as context', two.status === 200 && two.body.thread_id === r.body.thread_id && fx.chat.at(-1).messages.length === 4 && fx.chat.at(-1).messages[1].content.includes('what files'), JSON.stringify(fx.chat.at(-1).messages.map((m) => m.role)));
  const other = await post(env, { action: 'deepbot', thread_id: r.body.thread_id, message: 'hi' }, 'user_b');
  check('thread: another user gets 404, existence not leaked', other.status === 404 && other.body.error === 'thread_not_found');
}

// 2. page_steps validated against the page's registered targets
{
  reset(); resetClerkFixtures();
  const { env } = fresh();
  const ctx = { stage: 'file', targets: ['workbench.file.drop', 'workbench.run'] };
  fx.script = [tool('page_steps', { steps: [{ op: 'point', target: 'workbench.nope', say: 'Here' }] }), say('I could not find that.')];
  const bad = await post(env, { action: 'deepbot', message: 'show me', context: ctx });
  const t = toolMsgs(fx.chat[1])[0];
  check('page_steps: an unregistered target is refused and no steps reach the page', t.error === 'step_refused' && t.index === 0 && bad.body.steps.length === 0, JSON.stringify(t));
  fx.script = [tool('page_steps', { steps: [{ op: 'click', target: 'workbench.run' }] }), say('ok')];
  const run = await post(env, { action: 'deepbot', message: 'run it', context: ctx });
  check('page_steps: click on a registered Run button is still refused (spend is a human click)', toolMsgs(fx.chat.at(-1))[0].error === 'step_refused' && run.body.steps.length === 0);
  fx.script = [tool('page_steps', { steps: [{ op: 'open', target: 'files' }, { op: 'go', target: 'quote' }, { op: 'point', target: 'workbench.file.drop', say: 'Drop a file here \u2014 CSV or Excel.' }, { op: 'say', say: 'Then pick columns.' }] }), say('Follow along.')];
  const ok = await post(env, { action: 'deepbot', message: 'show me', context: ctx });
  check('page_steps: open, go, point, say all validate; steps returned in order with dashes cleaned', JSON.stringify(ok.body.steps.map((s) => s.op)) === '["open","go","point","say"]' && !/[\u2014\u2013]/.test(ok.body.steps[2].say), JSON.stringify(ok.body.steps));
  fx.script = [tool('page_steps', { steps: [{ op: 'hover', target: 'workbench.file.drop' }] }), say('x')];
  await post(env, { action: 'deepbot', message: 'x', context: ctx });
  check('page_steps: an op outside the grammar is refused', toolMsgs(fx.chat.at(-1))[0].error === 'step_refused');
  fx.script = [tool('page_steps', { steps: [{ op: 'go', target: 'admin' }] }), say('x')];
  await post(env, { action: 'deepbot', message: 'x', context: ctx });
  check('page_steps: go to an unknown stage is refused', toolMsgs(fx.chat.at(-1))[0].error === 'step_refused');
}

// 3. quote returns a card and never runs
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const id = await put(env, 'leads.csv', CSV);
  fx.script = [tool('quote', { file_id: id, plan: [{ column: 'Job', op: 'normalize_title', engine: 'jev' }] }), say('That would cost about 2 cents. Press Run when ready.')];
  const r = await post(env, { action: 'deepbot', message: 'normalize titles and run it' });
  const card = r.body.cards.find((c) => c.kind === 'quote');
  check('quote: a quote card with the maximum cost and can_run', r.status === 200 && card && card.data.file_id === id && card.data.max_cost_micro > 0 && card.data.can_run === true, JSON.stringify(r.body.cards).slice(0, 300));
  check('quote: nothing ran (no data-workbench run, no provider spend)', d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='data-workbench'`).results.length === 0 && fx.spend.length === 0);
  fx.script = [tool('quote', { file_id: id, plan: [{ column: 'Ghost', op: 'verify', instruction: 'y?' }] }), say('That plan has a bad column.')];
  const bad = await post(env, { action: 'deepbot', message: 'x' });
  check('quote: an invalid plan comes back to the model as an error, no card', toolMsgs(fx.chat.at(-1))[0].error === 'invalid_columns' && bad.body.cards.length === 0);
  fx.script = [tool('run', { file_id: id }), say('x')];
  await post(env, { action: 'deepbot', message: 'run it' });
  check('registry: a run tool does not exist', toolMsgs(fx.chat.at(-1))[0].error === 'unknown_tool');
}

// 4. more than 6 rounds
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  fx.model = (body) => (body.tools ? tool('files_list') : say('Here is what I found so far.'));
  const r = await post(env, { action: 'deepbot', message: 'loop forever' });
  check('rounds: 6 tool rounds then one tool-less call; the turn still replies', r.status === 200 && r.body.reply === 'Here is what I found so far.' && fx.chat.length === 7 && fx.chat[6].tools === undefined && toolMsgs(fx.chat[6]).length === 6, `${r.status} calls=${fx.chat.length}`);
  check('rounds: the whole turn is one reservation', d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='deepbot'`).results.length === 1 && d1.query(`SELECT * FROM toolkit_ops`).results.length === 7);
  reset();
  setSetting(d1, 'intake_model', JSON.stringify({ id: 'acme/pricey', prompt_micro_per_mtok: 4000000, completion_micro_per_mtok: 8000000 }));
  fx.model = (body) => (body.tools ? tool('files_list', {}, 0.006) : say('late'));
  const pricey = await post(env, { action: 'deepbot', message: 'costly loop' });
  const run = d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='deepbot' ORDER BY created_at DESC, rowid DESC`).results[0];
  check('budget: a pricey admin model stops the loop before another call could pass the 20,000 reservation; the turn still replies', pricey.status === 200 && pricey.body.reply.length > 0 && fx.chat.length === 1 && run.spent_micro === 6000 && run.spent_micro <= 20000, `calls=${fx.chat.length} spent=${run.spent_micro} reply=${pricey.body.reply}`);
}

// 5. metering, log, privacy
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const id = await put(env, 'leads.csv', CSV);
  fx.script = [tool('file_peek', { id }, 0.0004), say('The first person is Jane SAMPLESECRET Doe.', 0.0003)];
  const r = await post(env, { action: 'deepbot', message: 'look at leads.csv' });
  const run = d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='deepbot'`).results[0];
  check('metering: reserved 20,000 micro, settled at the actual 700, rest released', run && run.reserve_micro === 20000 && run.spent_micro === 700 && run.held_micro === 0 && run.credits_used === 1 && run.status === 'completed', JSON.stringify(run));
  const ops = d1.query(`SELECT cost_micro, status FROM toolkit_ops WHERE run_id=? ORDER BY seq`, run.id).results;
  check('metering: one op per model call with its own cost', ops.length === 2 && ops[0].cost_micro === 400 && ops[1].cost_micro === 300 && r.body.cost_micro === 700, JSON.stringify(ops));
  const peek = toolMsgs(fx.chat[1])[0];
  check('privacy: the model did see headers, five sample rows at most, and counts', peek.rows === 2 && peek.columns === 3 && peek.headers.length === 3 && peek.sample_rows.length === 2 && /SAMPLESECRET/.test(r.body.reply));
  const log = d1.query(`SELECT * FROM ai_log WHERE action='deepbot'`).results;
  check('ai_log: one record, action deepbot, cost and tokens, no cell values anywhere', log.length === 1 && log[0].cost_micro === 700 && log[0].tokens_in === 200 && log[0].outcome === 'ok' && !/SAMPLESECRET|Globex|head of mktg/.test(JSON.stringify(log[0])) && /\[value\]/.test(log[0].response), JSON.stringify(log[0]).slice(0, 400));
  const stored = JSON.stringify(d1.query(`SELECT * FROM deepbot_turns`).results) + JSON.stringify(d1.query(`SELECT * FROM deepbot_threads`).results);
  check('turns: no cell values stored in deepbot_turns', !/SAMPLESECRET/.test(stored) && /\[value\]/.test(stored), stored.slice(0, 300));
  const usageRes = await post(env, { action: 'usage' });
  check('metering: counts in the same daily usage as every other action', usageRes.body.usage.spent_micro === 700);
}

// 6. failures and refusals
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  fx.script = ['fail'];
  const f = await post(env, { action: 'deepbot', message: 'hi' });
  const run = d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='deepbot'`).results[0];
  check('failure: provider down -> 502, run settled (nothing left held), no thread stored', f.status === 502 && f.body.error === 'deepbot_failed' && run.status !== 'new' && d1.query(`SELECT * FROM deepbot_threads`).results.length === 0, JSON.stringify(f.body));
  const n = fx.chat.length;
  for (const [label, patch] of [['empty message', { message: '  ' }], ['message over 2000', { message: 'x'.repeat(2001) }], ['bad thread id', { message: 'x', thread_id: 'nope' }], ['unknown stage', { message: 'x', context: { stage: 'admin' } }], ['bad target id', { message: 'x', context: { targets: ['a b'] } }], ['201 targets', { message: 'x', context: { targets: Array(201).fill('a') } }]]) {
    const r = await post(env, { action: 'deepbot', ...patch });
    check(`validation: ${label} -> 400`, r.status === 400 && r.body.error === 'invalid_deepbot', JSON.stringify(r.body));
  }
  check('validation: no model call on any bad input', fx.chat.length === n);
  const broke = fresh(0);
  const c = await post(broke.env, { action: 'deepbot', message: 'hi' });
  check('credits: no balance -> refused before any model call', c.status >= 400 && c.status < 500 && fx.chat.length === n, JSON.stringify(c.body));
  const cat = await post(broke.env, { action: 'deepbot', message: 'What can you do?' });
  check('catalog: "what can you do" is answered with no model call, no charge, even with no credits', cat.status === 200 && cat.body.cards[0].kind === 'catalog' && cat.body.cost_micro === 0 && fx.chat.length === n && d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='deepbot' AND user_id='user_a'`).results.length === 1);
}

// 7. context window, connector stubs, intake_plan
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  d1.raw.prepare(`INSERT INTO deepbot_threads (id, user_id, title, created_at) VALUES ('11111111-1111-4111-8111-111111111111', 'user_a', 't', 'x')`).run();
  for (let i = 1; i <= 30; i++) d1.raw.prepare(`INSERT INTO deepbot_turns (thread_id, seq, role, content_json, cost_micro, ts) VALUES ('11111111-1111-4111-8111-111111111111', ?, ?, ?, 0, 'x')`).run(i, i % 2 ? 'user' : 'assistant', JSON.stringify(i % 2 ? { text: `u${i}` } : { reply: `a${i}` }));
  fx.script = [tool('connector_pull', { provider: 'harbinger', op: 'campaigns' }), say('Not connected yet.')];
  const r = await post(env, { action: 'deepbot', thread_id: '11111111-1111-4111-8111-111111111111', message: 'pull my campaigns' });
  const sent = fx.chat[0].messages;
  check('context: the last 20 stored turns (seq 11 to 30) plus system and the new message', sent.length === 22 && sent[1].content === 'u11' && sent[20].content === 'a30', JSON.stringify(sent.map((m) => m.content.slice?.(0, 4))));
  check('connectors: without a saved key the pull says not_connected (no Worker secret here: connections_not_configured)', ['not_connected', 'connections_not_configured'].includes(toolMsgs(fx.chat[1])[0].error) && r.status === 200);
  check('thread: new turns continue the sequence at 31 and 32', d1.query(`SELECT MAX(seq) m FROM deepbot_turns`).results[0].m === 32);

  reset();
  const id = await put(env, 'leads.csv', CSV);
  fx.intake = { reply: 'I will normalize Job.', question: 'Keep Person Name?', mapping: [{ source: 'Job', field: 'title' }], plan: [{ column: 'Job', op: 'normalize_title', engine: 'jev' }], chips: ['Yes', 'No'] };
  fx.script = [tool('intake_plan', { file_id: id, goal: 'clean titles' }), say('Here is a plan.')];
  const p = await post(env, { action: 'deepbot', message: 'plan it' });
  check('intake_plan: plan card and an ask come from the existing intake action', p.body.cards[0].kind === 'plan' && p.body.cards[0].data.plan.length === 1 && p.body.asks[0].question === 'Keep Person Name?' && p.body.asks[0].options.length === 2, JSON.stringify(p.body));
  check('intake_plan: intake settles its own small charge next to the turn', d1.query(`SELECT tool_id, spent_micro FROM toolkit_runs WHERE tool_id IN ('intake','deepbot') AND created_at > ''`).results.some((x) => x.tool_id === 'intake' && x.spent_micro === 200));
}
finish('toolkit-deepbot-selftest');
