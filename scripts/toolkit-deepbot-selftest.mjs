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
const EXPECTED_TOOLS = ['catalog', 'files_list', 'file_peek', 'file_read', 'account_usage', 'run_detail', 'report_summary', 'staged_list', 'staged_get', 'intake_plan', 'quote', 'files_mkdir', 'files_save', 'stage_run', 'stage_files_move', 'connector_pull', 'connector_act', 'page_steps'];

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
  check('turn: the closed tool list is exactly the registry', JSON.stringify(fx.chat[0].tools.map((t) => t.function.name)) === JSON.stringify(EXPECTED_TOOLS) && fx.chat[1].tools.length === 18);
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
  // Priced so one call fits the 20,000 reservation and a second cannot (18 tool schemas ride on every call).
  setSetting(d1, 'intake_model', JSON.stringify({ id: 'acme/pricey', prompt_micro_per_mtok: 2000000, completion_micro_per_mtok: 8000000 }));
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

// 8. the registry (docs section 10): one list, 18 tools, 17 inbound, no human-only action
const core = await import('../worker/deepbot-core.js');
const { makeToolHandlers } = await import('../worker/deepbot-tools.js');
{
  const names = core.REGISTRY.map((t) => t.name);
  check('registry: 18 entries in the fixed order', names.length === 18 && JSON.stringify(names) === JSON.stringify(EXPECTED_TOOLS), names.join());
  check('registry: DEEPBOT_TOOLS names equal REGISTRY names', JSON.stringify(core.DEEPBOT_TOOLS.map((t) => t.function.name)) === JSON.stringify(names));
  check('registry: no run, files_delete, staged_decide or admin_* tool', !names.some((n) => ['run', 'files_delete', 'staged_decide'].includes(n) || n.startsWith('admin_')));
  check('registry: 17 inbound, page_steps is DeepBot only', core.REGISTRY.filter((t) => t.inbound).length === 17 && core.REGISTRY.find((t) => t.name === 'page_steps').inbound === false);
  const SCOPES = { catalog: null, files_list: 'files:read', file_peek: 'files:read', file_read: 'files:read', account_usage: 'jobs:read', run_detail: 'jobs:read', report_summary: 'jobs:read', staged_list: 'jobs:read', staged_get: 'jobs:read', intake_plan: 'jobs:plan', quote: 'jobs:plan', files_mkdir: 'files:write', files_save: 'files:write', stage_run: 'jobs:stage', stage_files_move: 'jobs:stage', connector_pull: 'connections:read', connector_act: 'connections:stage', page_steps: null };
  check('registry: scopes and classes as specified', core.REGISTRY.every((t) => t.scope === SCOPES[t.name] && ['read', 'write', 'stage'].includes(t.cls)) && core.REGISTRY.filter((t) => t.cls === 'stage').map((t) => t.name).join() === 'stage_run,stage_files_move,connector_act');
  check('registry: CATALOG.deepbot is derived from it', JSON.stringify(core.CATALOG.deepbot.map((x) => x.id)) === JSON.stringify(names));
  const h = makeToolHandlers({ db: makeD1(), env: {}, uid: 'u', source: 'deepbot' });
  check('registry: exactly one handler per name, nothing else', JSON.stringify(Object.keys(h).sort()) === JSON.stringify([...names].sort()));
  check('desktop: approvals is an app page_steps can open', core.DESKTOP_APPS.includes('approvals') && core.validateSteps([{ op: 'open', target: 'approvals' }], { targets: [], stages: [] }).steps);
  check('system prompt: names Approvals and staged_get, no dashes', /Approvals/.test(core.DEEPBOT_SYSTEM) && /staged_get/.test(core.DEEPBOT_SYSTEM) && !/[\u2014\u2013]/.test(core.DEEPBOT_SYSTEM + JSON.stringify(core.REGISTRY) + JSON.stringify(core.CATALOG)));
  const { readFileSync } = await import('node:fs');
  const src = ['deepbot-tools.js', 'staged.js'].map((f) => readFileSync(new URL(`../worker/${f}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')).join('\n');
  check('registry: no code path from the tool handlers reaches actionRun or files_delete', !/actionRun|files_delete|handleAction|action: *'run'/.test(src));
}

// 9. stage_run: one pending row, zero runs; the cap; owner-only reads
const sid = (r) => r.staged_id;
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const id = await put(env, 'leads.csv', CSV);
  const PLAN = [{ column: 'Job', op: 'normalize_title', engine: 'jev' }];
  fx.script = [tool('stage_run', { file_id: id, plan: PLAN, note: 'Titles look messy.' }), say('Staged. Approve it in Approvals and press Run.')];
  const r = await post(env, { action: 'deepbot', message: 'clean the titles and run it' });
  const t = toolMsgs(fx.chat[1])[0];
  const rows = d1.query(`SELECT * FROM toolkit_staged`).results;
  check('stage_run: exactly one toolkit_staged row, pending, kind run, source deepbot', rows.length === 1 && rows[0].status === 'pending' && rows[0].kind === 'run' && rows[0].source === 'deepbot' && rows[0].note === 'Titles look messy.', JSON.stringify(rows));
  check('stage_run: zero data-workbench runs, no provider spend', d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='data-workbench'`).results.length === 0 && fx.spend.length === 0);
  check('stage_run: returns pending_approval and an approve_url ending #approvals/<id>', t.status === 'pending_approval' && t.staged_id === rows[0].id && t.approve_url.endsWith(`#approvals/${rows[0].id}`) && t.approve_url.startsWith('https://toolkit.deependhq.com/'), JSON.stringify(t));
  const pl = JSON.parse(rows[0].payload_json);
  check('stage_run: server-written title and payload {file_id, plan, quote}', rows[0].title === `Run 1 operation on leads.csv, up to ${pl.quote.max_credits} credits` && pl.file_id === id && pl.plan[0].op === 'normalize_title' && pl.quote.row_count === 2 && pl.quote.can_run === true, rows[0].title + rows[0].payload_json);
  check('stage_run: a staged card for the page', r.body.cards.some((c) => c.kind === 'staged' && c.data.staged_id === rows[0].id));
  fx.script = [tool('stage_run', { file_id: id, plan: [{ column: 'Ghost', op: 'verify', instruction: 'y?' }] }), say('x')];
  await post(env, { action: 'deepbot', message: 'x' });
  check('stage_run: a plan the quote refuses stages nothing', toolMsgs(fx.chat.at(-1))[0].error === 'invalid_columns' && d1.query(`SELECT * FROM toolkit_staged`).results.length === 1);
  fx.script = [tool('staged_decide', { id: rows[0].id, decision: 'approve' }), say('x')];
  await post(env, { action: 'deepbot', message: 'approve it' });
  check('agent: staged_decide is not a tool', toolMsgs(fx.chat.at(-1))[0].error === 'unknown_tool' && d1.query(`SELECT status FROM toolkit_staged`).results[0].status === 'pending');

  const h = makeToolHandlers({ db: d1, env, uid: 'user_a', source: 'deepbot' });
  check('stage_run: note over 280 characters is refused', (await h.stage_run({ file_id: id, plan: PLAN, note: 'x'.repeat(281) })).error === 'invalid_note');
  for (let i = 2; i <= 50; i++) await h.stage_run({ file_id: id, plan: PLAN });
  const n50 = d1.query(`SELECT COUNT(*) n FROM toolkit_staged WHERE user_id='user_a' AND status='pending'`).results[0].n;
  const over = await h.stage_run({ file_id: id, plan: PLAN });
  check('cap: the 51st pending stage is 429 too_many_staged and adds no row', n50 === 50 && over.error === 'too_many_staged' && over.http_status === 429 && d1.query(`SELECT COUNT(*) n FROM toolkit_staged`).results[0].n === 50, JSON.stringify(over));
  d1.raw.prepare(`UPDATE toolkit_staged SET expires_at='2020-01-01T00:00:00.000Z' WHERE id=?`).run(rows[0].id);
  const again = await h.stage_run({ file_id: id, plan: PLAN });
  check('cap: an expired item does not count, so the next stage goes through', again.status === 'pending_approval');
  const exp = await h.staged_get({ id: rows[0].id });
  check('staged_get: expired is computed (pending and past expires_at)', exp.item.status === 'pending' && exp.item.expired === true && exp.item.payload.file_id === id);
  check('staged_list: pending excludes the expired one; expired lists it', (await h.staged_list({})).items.length === 50 && (await h.staged_list({ status: 'expired' })).items[0].id === rows[0].id && (await h.staged_list({ status: 'nope' })).error === 'invalid_status');
  const hb = makeToolHandlers({ db: d1, env, uid: 'user_b', source: 'deepbot' });
  check('staged_get: another user\'s id is not_found; their list is empty', (await hb.staged_get({ id: sid(again) })).error === 'not_found' && (await hb.staged_list({ status: 'all' })).items.length === 0);
  const http = await post(env, { action: 'staged_get', id: sid(again) }, 'user_b');
  check('staged_get action: another user gets 404 not_found', http.status === 404 && http.body.error === 'not_found' && !('http_status' in http.body));
  const mine = await post(env, { action: 'staged_list' });
  check('staged_list action: the owner sees pending items with approve_url', mine.status === 200 && mine.body.items.length === 50 && mine.body.items.every((x) => x.approve_url.endsWith(`#approvals/${x.id}`)));
}

// 10. staged_decide: run approval needs the user's job_id; reject; moves execute on approve under the session
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const id = await put(env, 'leads.csv', CSV);
  const h = makeToolHandlers({ db: d1, env, uid: 'user_a', source: 'deepbot' });
  const s = await h.stage_run({ file_id: id, plan: [{ column: 'Job', op: 'normalize_title', engine: 'jev' }] });
  const seed = (uid, job) => d1.raw.prepare(`INSERT INTO toolkit_runs (id, user_id, request_id, tool_id, payload_hash, status, row_count, max_credits, reserve_micro, credits_held, created_at, job_id) VALUES (?, ?, ?, 'data-workbench', 'h', 'completed', 2, 1, 0, 0, ?, ?)`).run(crypto.randomUUID(), uid, crypto.randomUUID(), new Date().toISOString(), job);
  const JOB_A = crypto.randomUUID(), JOB_B = crypto.randomUUID();
  seed('user_a', JOB_A); seed('user_b', JOB_B);
  const none = await post(env, { action: 'staged_decide', id: sid(s), decision: 'approve' });
  const bogus = await post(env, { action: 'staged_decide', id: sid(s), decision: 'approve', job_id: crypto.randomUUID() });
  const theirs = await post(env, { action: 'staged_decide', id: sid(s), decision: 'approve', job_id: JOB_B });
  check('decide run: no job_id, an unknown one, or another user\'s -> 400 invalid_job_id, still pending', [none, bogus, theirs].every((x) => x.status === 400 && x.body.error === 'invalid_job_id') && d1.query(`SELECT status FROM toolkit_staged`).results[0].status === 'pending', JSON.stringify([none.body, theirs.body]));
  check('decide: another user cannot decide it (404)', (await post(env, { action: 'staged_decide', id: sid(s), decision: 'approve', job_id: JOB_B }, 'user_b')).status === 404);
  check('decide: a bad decision -> 400', (await post(env, { action: 'staged_decide', id: sid(s), decision: 'maybe' })).status === 400);
  const ok = await post(env, { action: 'staged_decide', id: sid(s), decision: 'approve', job_id: JOB_A });
  const row = d1.query(`SELECT * FROM toolkit_staged WHERE id=?`, sid(s)).results[0];
  check('decide run: with the user\'s job_id -> approved, result_json.job_id, decided_at; the server ran nothing', ok.status === 200 && ok.body.item.status === 'approved' && JSON.parse(row.result_json).job_id === JOB_A && row.decided_at && d1.query(`SELECT COUNT(*) n FROM toolkit_runs WHERE tool_id='data-workbench'`).results[0].n === 2, JSON.stringify(ok.body));
  check('decide: deciding twice -> 409 not_pending', (await post(env, { action: 'staged_decide', id: sid(s), decision: 'reject' })).status === 409);
  check('agent: staged_get shows it approved', (await h.staged_get({ id: sid(s) })).item.status === 'approved');
  const s2 = await h.stage_run({ file_id: id, plan: [{ column: 'Job', op: 'normalize_title', engine: 'jev' }] });
  const rej = await post(env, { action: 'staged_decide', id: sid(s2), decision: 'reject' });
  check('decide: reject -> rejected', rej.status === 200 && rej.body.item.status === 'rejected');
  check('decide: needs a session', (await handleToolkit(apiRequest({ action: 'staged_decide', id: sid(s2), decision: 'reject' }, { token: null }), env)).status === 401);

  const mv = await h.stage_files_move({ id, folder: '/Done', name: 'leads-clean.csv', note: 'Tidy up.' });
  const before = d1.query(`SELECT path FROM files WHERE id=?`, id).results[0].path;
  check('stage_files_move: staged, nothing moved yet, server-written title', mv.status === 'pending_approval' && before === '/leads.csv' && mv.title === 'Move /leads.csv to /Done/leads-clean.csv', JSON.stringify(mv));
  const hb = makeToolHandlers({ db: d1, env, uid: 'user_b', source: 'deepbot' });
  check('stage_files_move: another user\'s file is not_found', (await hb.stage_files_move({ id, name: 'x.csv' })).error === 'not_found');
  check('stage_files_move: no folder and no name is refused', (await h.stage_files_move({ id })).error === 'invalid_move');
  const go = await post(env, { action: 'staged_decide', id: sid(mv), decision: 'approve' });
  check('decide files_move: approve moves it under the session and records the entry', go.status === 200 && go.body.item.status === 'approved' && d1.query(`SELECT path FROM files WHERE id=?`, id).results[0].path === '/Done/leads-clean.csv' && go.body.item.result.entry.path === '/Done/leads-clean.csv', JSON.stringify(go.body));
  const other = await put(env, 'b.csv', CSV);
  const clash = await h.stage_files_move({ id: other, folder: '/Done', name: 'leads-clean.csv' });
  const failed = await post(env, { action: 'staged_decide', id: sid(clash), decision: 'approve' });
  check('decide files_move: a move that cannot happen is marked failed, nothing overwritten', failed.status === 409 && failed.body.error === 'name_taken' && failed.body.item.status === 'failed' && d1.query(`SELECT path FROM files WHERE id=?`, other).results[0].path === '/b.csv');
}

// 11. read and write tools
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const h = makeToolHandlers({ db: d1, env, uid: 'user_a', source: 'deepbot' });
  const key = makeToolHandlers({ db: d1, env, uid: 'user_a', source: 'key:k1' });
  const big = 'é'.repeat(3000) + '\n' + 'line two\n'; // 6,009 bytes, multibyte
  const txt = (await post(env, { action: 'files_put', folder: '/', name: 'notes.txt', mime: 'text/plain', content_base64: Buffer.from(big).toString('base64') })).body.entry.id;
  const p1 = (await h.file_read({ id: txt })).result;
  const p2 = (await h.file_read({ id: txt, offset: p1.next_offset })).result;
  check('file_read: DeepBot pages fit its 8,000 character tool result, on character boundaries, and join back', p1.offset === 0 && p1.next_offset > 0 && p1.next_offset <= 4096 && p2.next_offset === null && p1.untrusted_file_text + p2.untrusted_file_text === big && p1.size === Buffer.byteLength(big), JSON.stringify([p1.next_offset, p2.offset, p2.next_offset]));
  const whole = (await key.file_read({ id: txt })).result;
  check('file_read: an API caller gets 64 KB pages', whole.untrusted_file_text === big && whole.next_offset === null);
  const pdf = (await post(env, { action: 'files_put', folder: '/', name: 'a.pdf', mime: 'application/pdf', content_base64: Buffer.from('%PDF-1.4 x').toString('base64') })).body.entry.id;
  check('file_read: a pdf is unsupported_type; a bad offset is refused; another user\'s file is not_found', (await h.file_read({ id: pdf })).error === 'unsupported_type' && (await h.file_read({ id: txt, offset: -1 })).error === 'invalid_offset' && (await makeToolHandlers({ db: d1, env, uid: 'user_b', source: 'deepbot' }).file_read({ id: txt })).error === 'not_found');

  const csvId = await put(env, 'leads.csv', CSV);
  fx.script = [tool('file_read', { id: csvId }), say('Row one is Jane SAMPLESECRET Doe, VP Sales.')];
  const r = await post(env, { action: 'deepbot', message: 'read leads.csv' });
  check('file_read: the model saw the text as untrusted_file_text', /SAMPLESECRET/.test(toolMsgs(fx.chat[1])[0].untrusted_file_text) && /SAMPLESECRET/.test(r.body.reply));
  const stored = JSON.stringify(d1.query(`SELECT * FROM deepbot_turns`).results) + JSON.stringify(d1.query(`SELECT * FROM ai_log WHERE action='deepbot'`).results);
  check('file_read: cell text is redacted from turns and ai_log', !/SAMPLESECRET|VP Sales|Globex/.test(stored) && /\[file text\]/.test(stored) && /\[value\]/.test(stored), stored.slice(0, 300));

  const s1 = await h.files_save({ folder: '/Out', name: 'summary.md', content: '# Hi' });
  const s2 = await h.files_save({ folder: '/Out', name: 'summary.md', content: '# Again' });
  check('files_save: creates the folder, never overwrites (a taken name gets a number)', s1.entry.path === '/Out/summary.md' && s2.entry.name === 'summary (2).md' && /was taken/.test(s2.note) && d1.query(`SELECT COUNT(*) n FROM files WHERE parent='/Out'`).results[0].n === 2);
  check('files_save: over 64 KB, a non-text type, or a bad name is refused', (await h.files_save({ name: 'x.txt', content: 'x'.repeat(65537) })).error === 'file_too_large' && (await h.files_save({ name: 'x.xlsx', content: 'x' }).catch((e) => e)).error === 'bad_type' && (await h.files_save({ name: 'a/b.txt', content: 'x' }).catch((e) => e)).error === 'invalid_path');
  const mk = await h.files_mkdir({ path: '/Leads/Q4' });
  check('files_mkdir: makes the folder and its parent; again returns the same entry', mk.entry.path === '/Leads/Q4' && (await h.files_mkdir({ path: '/Leads/Q4' })).entry.id === mk.entry.id);

  const before = JSON.stringify(['toolkit_accounts', 'toolkit_events', 'toolkit_runs'].map((t) => d1.query(`SELECT * FROM ${t}`).results));
  const u = await h.account_usage({});
  const fresher = await makeToolHandlers({ db: d1, env, uid: 'user_nobody', source: 'deepbot' }).account_usage({});
  check('account_usage: balance, caps and runs, and it writes nothing (not even for a user with no account)', u.usage.credits_available === 5000 - 1 && u.usage.daily_credit_cap === 1000 && Array.isArray(u.runs) && u.runs.length >= 1 && fresher.usage.credits_available === 0 && JSON.stringify(['toolkit_accounts', 'toolkit_events', 'toolkit_runs'].map((t) => d1.query(`SELECT * FROM ${t}`).results)) === before, JSON.stringify(u.usage));
  const runId = u.runs[0].id;
  const rd = await h.run_detail({ id: runId });
  check('run_detail: the owner gets the run and its ledger; ai_log gets [results]', rd.result.id === runId && Array.isArray(rd.result.ledger) && rd.log.results === '[results]');
  check('run_detail: another user\'s run is not_found; a bad id is bad_run_id', (await makeToolHandlers({ db: d1, env, uid: 'user_b', source: 'deepbot' }).run_detail({ id: runId })).error === 'not_found' && (await h.run_detail({ id: 'x' })).error === 'bad_run_id');
}
finish('toolkit-deepbot-selftest');
