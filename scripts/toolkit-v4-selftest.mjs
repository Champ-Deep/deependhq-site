// scripts/toolkit-v4-selftest.mjs : Toolkit V4 backend (docs/toolkit-v4-api.md sections 1 to 6).
// Real SQL (node:sqlite), real token verification, in-memory R2/KV, providers answered by a
// fetch router. No network. Run: node scripts/toolkit-v4-selftest.mjs

import {
  makeD1, makeR2, makeKV, setSetting, seedGrant, installFetchRouter, resetClerkFixtures, clerkFixtures,
  apiRequest, sessionToken, PK, SK, CLERK_JS_URL, JWT_PUBLIC_PEM, check, finish, ORIGIN,
} from './toolkit-testkit.mjs';

installFetchRouter();
const clerkRouter = globalThis.fetch;

// --- provider fixtures ---------------------------------------------------------
const fx = {};
const reset = () => Object.assign(fx, {
  calls: [], intake: null, intakeRaw: null, modelsFail: false, spotify: null, psnFail: true,
  models: [
    { id: 'deepseek/deepseek-v4.1-flash', pricing: { prompt: '0.00000014', completion: '0.00000042' }, supported_parameters: ['response_format', 'structured_outputs'] },
    { id: 'acme/pricey', pricing: { prompt: '0.000002', completion: '0.000008', overrides: [{ prompt: '0.000004', completion: '0.000008' }] }, supported_parameters: ['response_format', 'structured_outputs'] },
    { id: 'acme/plain', pricing: { prompt: '0.000001', completion: '0.000001' }, supported_parameters: ['temperature'] },
  ],
});
reset();
const jsonRes = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const SEN = ['VP', 'Director', 'Manager'];
const FUN = ['Sales', 'Marketing', 'Engineering'];

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === 'https://openrouter.ai/api/v1/models') {
    fx.calls.push({ provider: 'models' });
    return fx.modelsFail ? jsonRes({ error: 'down' }, 503) : jsonRes({ data: fx.models });
  }
  if (url === 'https://openrouter.ai/api/alpha/decisions') {
    const body = JSON.parse(init.body);
    fx.calls.push({ provider: 'jev', body });
    const answers = {};
    for (const [qid, q] of Object.entries(body.questions)) {
      const value = body.state[`item_${qid.replace(/^\D+/, '')}`];
      const names = Object.keys(q.criteria || {});
      const hit = names.find((n) => n !== '__none__' && value.toLowerCase().includes(n.toLowerCase()));
      answers[qid] = q.type === 'choice' ? { type: 'choice', choice: hit || '__none__', confidence: 0.95 } : { type: 'noul', noul: 0.9 };
    }
    return jsonRes({ answers, usage: { cost: 0.002 } });
  }
  if (url === 'https://openrouter.ai/api/v1/chat/completions') {
    const body = JSON.parse(init.body);
    fx.calls.push({ provider: 'chat', body });
    if (body.response_format.type === 'json_object') {
      const content = fx.intakeRaw ?? JSON.stringify(fx.intake);
      return jsonRes({ id: 'gen-intake', choices: [{ message: { content } }], usage: { prompt_tokens: 900, completion_tokens: 200, cost: 0.00021 } });
    }
    const name = body.response_format.json_schema.name;
    const user = JSON.parse(body.messages[1].content);
    let results;
    if (name === 'title_results') results = user.items.map((it) => ({ i: it.i, title_normalized: it.value.toUpperCase(), seniority: SEN.find((s) => it.value.includes(s)) || '__none__', function: FUN.find((f) => it.value.includes(f)) || '__none__', confidence: 0.9 }));
    else if (name === 'research_results') results = user.items.map((it) => ({ i: it.i, o0: `about ${it.value}`, o1: '51-200', confidence: 0.85 }));
    else results = user.items.map((it) => ({ i: it.i, label: user.categories ? user.categories[0].name : undefined, p_true: 0.9, confidence: 0.9 }));
    return jsonRes({ id: 'gen-col', choices: [{ message: { content: JSON.stringify({ results }) } }], usage: { prompt_tokens: 100, completion_tokens: 40, cost: 0.00005 } });
  }
  if (url.startsWith('https://treg.to/call/')) {
    fx.calls.push({ provider: 'treg' });
    return jsonRes({ output: { status: 'valid', valid: true } }, 200, { 'X-Treg-Cost-Micro': '9000' });
  }
  if (url === 'https://accounts.spotify.com/api/token') {
    const p = new URLSearchParams(init.body);
    fx.calls.push({ provider: 'spotify-token', grant: p.get('grant_type'), auth: init.headers.authorization || init.headers.Authorization });
    if (p.get('grant_type') === 'authorization_code') return jsonRes({ access_token: 'acc', refresh_token: 'refresh-from-callback' });
    return jsonRes({ access_token: 'acc2' });
  }
  if (url.startsWith('https://api.spotify.com/v1/me/player/currently-playing')) {
    fx.calls.push({ provider: 'spotify-now' });
    if (!fx.spotify) return new Response(null, { status: 204 });
    return jsonRes({ is_playing: true, item: { name: 'Teardrop', artists: [{ name: 'Massive Attack' }], external_urls: { spotify: 'https://open.spotify.com/track/abc' }, album: { images: [{ url: 'https://i.scdn.co/image/big', width: 640 }, { url: 'https://i.scdn.co/image/mid', width: 300 }] } } });
  }
  if (url.startsWith('https://api.spotify.com/v1/me/player/recently-played')) {
    fx.calls.push({ provider: 'spotify-recent' });
    return jsonRes({ items: [{ played_at: '2026-10-27T20:00:00.000Z', track: { name: 'Angel', artists: [{ name: 'Massive Attack' }], external_urls: { spotify: 'https://open.spotify.com/track/def' }, album: { images: [{ url: 'https://evil.example/x.png' }] } } }] });
  }
  if (url.startsWith('https://ca.account.sony.com/')) {
    fx.calls.push({ provider: 'psn' });
    if (fx.psnFail) return jsonRes({ error: 'nope' }, 401);
  }
  return clerkRouter(input, init);
};

const { handleToolkit } = await import('../worker/toolkit.js');
const worker = (await import('../worker/index.js')).default;

const baseEnv = (d1, over = {}) => ({
  TOOLKIT_DB: d1, TOOLKIT_FILES: makeR2(), CLERK_PUBLISHABLE_KEY: PK, CLERK_SECRET_KEY: SK, CLERK_JWT_KEY: JWT_PUBLIC_PEM, CLERK_JS_URL,
  CLERK_ADMIN_IDS: 'user_admin', TREG_API_KEY: 'treg-key', JEV_API_KEY: 'jev-key', ...over,
});
async function post(env, body, sub = 'user_a') {
  const res = await handleToolkit(apiRequest(body, { token: sessionToken({ sub }) }), env);
  const text = await res.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* jsonl or empty */ }
  return { status: res.status, body: j, text, headers: res.headers };
}
const get = (env, path, sub = 'user_a') => handleToolkit(new Request(ORIGIN + path, { headers: { authorization: `Bearer ${sessionToken({ sub })}`, origin: ORIGIN } }), env);
const fresh = (over = {}, credits = 5000) => {
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 25000000);  // $25 per day
  setSetting(d1, 'default_daily_credit_cap', 1000);     // $1 per user per day
  setSetting(d1, 'default_daily_row_cap', 5000);
  seedGrant(d1, 'user_a', credits);
  seedGrant(d1, 'user_b', credits);
  return { d1, env: baseEnv(d1, over) };
};
const uuid = () => crypto.randomUUID();
const b64 = (s) => Buffer.from(s).toString('base64');
const runBody = (columns, rows, over = {}) => ({ action: 'run', tool_id: 'data-workbench', request_id: uuid(), list_name: 'wb', rows, columns, max_credits: 250, ...over });

// --- 1000-row quote vs 100-row run ----------------------------------------------
{
  reset(); resetClerkFixtures();
  const { env } = fresh();
  const spec = { column: 'Job', op: 'classify', engine: 'jev', instruction: 'Which team?', categories: ['Sales', 'Marketing'] };
  const rows1000 = Array.from({ length: 1000 }, (_, i) => ({ Job: `title ${i % 50}` }));
  const q = await post(env, { action: 'quote', rows: rows1000, columns: [spec] });
  check('quote: 1000 rows accepted, priced per 100-row chunk (10 chunks x 3 Jev calls)', q.status === 200 && q.body.row_count === 1000 && q.body.chunks === 10 && q.body.max_cost_micro === 300000 && q.body.columns[0].calls === 30, JSON.stringify(q.body).slice(0, 300));
  check('quote: whole job fits the caps, can_run true, no reason', q.body.can_run === true && !q.body.reason, JSON.stringify(q.body.allowance));
  check('quote: makes no provider call', fx.calls.length === 0);
  const q1001 = await post(env, { action: 'quote', rows: Array.from({ length: 1001 }, () => ({ Job: 'x' })), columns: [spec] });
  check('quote: 1001 rows -> 400', q1001.status === 400 && q1001.body.error === 'invalid_columns');
  const r1000 = await post(env, runBody([spec], rows1000, { max_credits: 300 }));
  check('run: 1000 rows in one request -> 400 (run stays at 100)', r1000.status === 400 && r1000.body.error === 'invalid_columns');
  const r100 = await post(env, runBody([spec], rows1000.slice(0, 100), { max_credits: 30 }));
  check('run: a 100-row chunk completes', r100.status === 200 && r100.body.status === 'completed', JSON.stringify(r100.body).slice(0, 200));
}

// --- caps explain themselves on the job quote ---------------------------------------
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh({}, 2000);
  // 40 distinct identities per chunk: each chunk is 240000 micro (under the 250000 chunk ceiling), the job is $2.40.
  const rows = Array.from({ length: 1000 }, (_, i) => ({ Email: `p${Math.floor(i / 100) * 40 + (i % 40)}@y.com` }));
  const q = await post(env, { action: 'quote', rows, columns: [{ column: 'Email', op: 'enrich' }] });
  check('cap: $2.40 job against the $1/day user cap -> can_run false, reason daily_credit_cap', q.status === 200 && q.body.max_cost_micro === 2400000 && q.body.can_run === false && q.body.reason === 'daily_credit_cap' && q.body.fits_batch_ceiling === true, JSON.stringify({ m: q.body.max_cost_micro, r: q.body.reason, f: q.body.fits_batch_ceiling }));
  check('cap: message names the limit in dollars', /\$1\.00/.test(q.body.message || '') && /\$2\.40/.test(q.body.message || ''), q.body.message);
  setSetting(d1, 'default_daily_credit_cap', 100000);
  const g = await post(env, { action: 'quote', rows, columns: [{ column: 'Email', op: 'enrich' }] });
  check('cap: with the user cap raised, the 5000-credit balance is the limit -> insufficient_credits', g.body.can_run === false && g.body.reason === 'insufficient_credits', JSON.stringify(g.body.reason));
  seedGrant(d1, 'user_a', 100000);
  setSetting(d1, 'global_daily_cap_micro', 2000000);
  const gl = await post(env, { action: 'quote', rows, columns: [{ column: 'Email', op: 'enrich' }] });
  check('cap: global $ per day is the limit -> global_cap', gl.body.can_run === false && gl.body.reason === 'global_cap', JSON.stringify(gl.body.reason));
  const ceil = await post(env, { action: 'quote', rows: Array.from({ length: 100 }, (_, i) => ({ Email: `z${i}@y.com` })), columns: [{ column: 'Email', op: 'enrich' }] });
  check('cap: a chunk over the per-chunk ceiling -> batch_ceiling', ceil.body.can_run === false && ceil.body.reason === 'batch_ceiling');
  const d2 = makeD1();
  setSetting(d2, 'global_daily_cap_micro', 25000000); setSetting(d2, 'default_daily_credit_cap', 1000); setSetting(d2, 'default_daily_row_cap', 500);
  setSetting(d2, 'welcome_credits', 500); setSetting(d2, 'trial_pool_credits', 400);
  const pool = await post(baseEnv(d2), { action: 'quote', rows: [{ Job: 'vp sales' }], columns: [{ column: 'Job', op: 'normalize_title' }] }, 'user_new');
  check('cap: new user with an exhausted trial pool -> trial_pool_empty', pool.body.can_run === false && pool.body.reason === 'trial_pool_empty', JSON.stringify(pool.body.reason));
}

// --- normalize_title and research ---------------------------------------------------
{
  reset(); resetClerkFixtures();
  const { env } = fresh();
  const rows = [{ Job: 'VP Sales', Co: 'Acme' }, { Job: 'head of mktg', Co: 'Globex' }, { Job: 'VP Sales', Co: 'Acme' }];
  const jev = await post(env, runBody([{ column: 'Job', op: 'normalize_title' }], rows, { max_credits: 20 }));
  const it = jev.body.results && jev.body.results[0];
  check('normalize_title (jev default): one Jev call for 2 distinct titles, completed', jev.status === 200 && jev.body.status === 'completed' && fx.calls.filter((c) => c.provider === 'jev').length === 1 && it.distinct_count === 2, JSON.stringify(jev.body).slice(0, 300));
  const vp = it.items[it.row_map[0]];
  check('normalize_title (jev): seniority and function from offered vocabularies, title tidied in code', vp.seniority === 'VP' && vp.function === 'Sales' && vp.title_normalized === 'VP Sales' && it.items[it.row_map[1]].title_normalized === 'Head of Marketing', JSON.stringify(it.items));
  check('normalize_title (jev): an unmatched vocabulary answer is flagged for review', it.items[it.row_map[1]].review === true && it.items[it.row_map[1]].seniority === 'Unclassified', JSON.stringify(it.items[it.row_map[1]]));
  const ds = await post(env, runBody([{ column: 'Job', op: 'normalize_title', engine: 'deepseek' }], rows, { max_credits: 20 }));
  const dsIt = ds.body.results[0].items;
  check('normalize_title (deepseek): three outputs per value', ds.body.status === 'completed' && dsIt.every((x) => 'title_normalized' in x && 'seniority' in x && 'function' in x) && dsIt[0].seniority === 'VP', JSON.stringify(dsIt));

  fx.calls = [];
  const research = { column: 'Co', op: 'research', engine: 'deepseek', instruction: 'Describe the company and its headcount band.', output_columns: ['Summary', 'Headcount'] };
  const qr = await post(env, { action: 'quote', rows, columns: [research] });
  const qw = await post(env, { action: 'quote', rows, columns: [{ ...research, web: true }] });
  check('research quote: web adds the Exa request price per distinct value (2 calls, +7000 each at least)', qr.status === 200 && qw.status === 200 && qw.body.columns[0].calls === 2 && qw.body.max_cost_micro - qr.body.max_cost_micro >= 14000, `${qr.body.max_cost_micro} vs ${qw.body.max_cost_micro}`);
  const rr = await post(env, runBody([{ ...research, web: true }], rows, { max_credits: qw.body.max_credits }));
  const chat = fx.calls.filter((c) => c.provider === 'chat');
  check('research run: web plugin on, exa engine, max 3 results, one value per call', rr.body.status === 'completed' && chat.length === 2 && chat.every((c) => c.body.plugins?.[0]?.id === 'web' && c.body.plugins[0].engine === 'exa' && c.body.plugins[0].max_results === 3), JSON.stringify(chat.map((c) => c.body.plugins)));
  const rIt = rr.body.results[0].items[0];
  check('research run: outputs keyed by the requested column names', rIt.outputs && rIt.outputs.Summary === 'about Acme' && rIt.outputs.Headcount === '51-200', JSON.stringify(rIt));
  const bad = async (label, patch) => {
    const r = await post(env, { action: 'quote', rows, columns: [{ ...research, ...patch }] });
    check(`research validation: ${label} -> 400`, r.status === 400 && r.body.error === 'invalid_columns', JSON.stringify(r.body));
  };
  await bad('jev engine', { engine: 'jev' });
  await bad('no instruction', { instruction: '' });
  await bad('no output columns', { output_columns: [] });
  await bad('4 output columns', { output_columns: ['a', 'b', 'c', 'd'] });
  await bad('duplicate output columns', { output_columns: ['a', 'A'] });
  await bad('web not boolean', { web: 'yes' });
  const ntBad = await post(env, { action: 'quote', rows, columns: [{ column: 'Job', op: 'normalize_title', engine: 'treg' }] });
  check('normalize_title validation: treg engine -> 400', ntBad.status === 400);
}

// --- settings: model switcher ---------------------------------------------------------
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const g = await post(env, { action: 'admin_settings_get' }, 'user_admin');
  const ds = g.body.models && g.body.models.find((m) => m.id === 'deepseek/deepseek-v4.1-flash');
  check('settings get: defaults are deepseek v4.1 flash, caps included, model prices in micro per Mtok', g.status === 200 && g.body.settings.intake_model === 'deepseek/deepseek-v4.1-flash' && g.body.settings.research_model === 'deepseek/deepseek-v4.1-flash' && g.body.settings.default_daily_credit_cap === 1000 && ds.prompt_micro_per_mtok === 140000 && ds.completion_micro_per_mtok === 420000, JSON.stringify(g.body).slice(0, 400));
  check('settings get: non-admin -> 403', (await post(env, { action: 'admin_settings_get' })).status === 403);
  const unknown = await post(env, { action: 'admin_settings_set', intake_model: 'nope/unknown' }, 'user_admin');
  check('settings set: unknown model id -> 400 unknown_model', unknown.status === 400 && unknown.body.error === 'unknown_model', JSON.stringify(unknown.body));
  const plain = await post(env, { action: 'admin_settings_set', research_model: 'acme/plain' }, 'user_admin');
  check('settings set: research model without structured outputs -> 400', plain.status === 400 && plain.body.error === 'model_unsupported', JSON.stringify(plain.body));
  const extra = await post(env, { action: 'admin_settings_set', welcome_credits: 999999 }, 'user_admin');
  check('settings set: other fields refused (caps are not set here)', extra.status === 400 && d1.query(`SELECT * FROM toolkit_settings WHERE key='welcome_credits'`).results.length === 0, JSON.stringify(extra.body));
  check('settings set: non-admin -> 403', (await post(env, { action: 'admin_settings_set', research_model: 'acme/pricey' })).status === 403);
  fx.modelsFail = true;
  const down = await post(env, { action: 'admin_settings_set', research_model: 'acme/pricey' }, 'user_admin');
  fx.modelsFail = false;
  check('settings set: models list unreachable -> 503, nothing stored', down.status === 503 && d1.query(`SELECT * FROM toolkit_settings WHERE key='research_model'`).results.length === 0, JSON.stringify(down.body));
  const spec = { column: 'Q', op: 'verify', engine: 'deepseek', instruction: 'Is it yes?' };
  const before = await post(env, { action: 'quote', rows: [{ Q: 'yes' }], columns: [spec] });
  const ok = await post(env, { action: 'admin_settings_set', research_model: 'acme/pricey' }, 'user_admin');
  check('settings set: valid id stored with its pricing (overrides take the higher price)', ok.status === 200 && ok.body.settings.research_model === 'acme/pricey' && JSON.parse(d1.query(`SELECT value FROM toolkit_settings WHERE key='research_model'`).results[0].value).prompt_micro_per_mtok === 4000000, JSON.stringify(ok.body));
  const after = await post(env, { action: 'quote', rows: [{ Q: 'yes' }], columns: [spec] });
  check('settings: the deepseek engine quote now uses the stored price', after.body.max_cost_micro > before.body.max_cost_micro * 10, `${before.body.max_cost_micro} -> ${after.body.max_cost_micro}`);
  fx.calls = [];
  await post(env, runBody([spec], [{ Q: 'yes' }], { max_credits: after.body.max_credits }));
  check('settings: the run sends the stored model id', fx.calls.find((c) => c.provider === 'chat')?.body.model === 'acme/pricey');
}

// --- intake ---------------------------------------------------------------------------
const intakeFile = { name: 'leads.csv', rows_total: 50, headers: ['Person Name', 'Company', 'Job'], samples: { 'Person Name': ['Jane SAMPLESECRET Doe', 'Raj K'], Job: ['VP Sales', 'head of mktg'] } };
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  fx.intake = {
    reply: 'I will normalize Job and classify Company.',
    question: 'Should I keep Person Name?',
    mapping: [
      { source: 'Person Name', field: 'person_name', keep: true },
      { source: 'Company', field: 'company' },
      { source: 'Nope', field: 'company', keep: true },
      { source: 'Job', field: 'salary', keep: true },
    ],
    plan: [
      { column: 'Job', op: 'normalize_title', engine: 'jev' },
      { column: 'Company', op: 'classify', engine: 'jev', instruction: 'Is this a SaaS company?', categories: ['SaaS', 'Not SaaS'] },
      { column: 'Job', op: 'summon' },
      { column: 'Company', op: 'classify', instruction: 'x?' },
      { column: 'Ghost', op: 'verify', instruction: 'y?' },
      { column: 'Company', op: 'research', instruction: 'size?', output_columns: ['a', 'b', 'c', 'd', 'e'] },
    ],
    chips: ['Also verify emails', 'Research company size'],
  };
  const r = await post(env, { action: 'intake', file: intakeFile, goal: 'normalize titles and tell me which companies are SaaS', history: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }] });
  check('intake: 200 with reply, question, chips, model and the real cost', r.status === 200 && r.body.question === 'Should I keep Person Name?' && r.body.chips.length === 2 && r.body.model === 'deepseek/deepseek-v4.1-flash' && r.body.cost_micro === 210, JSON.stringify(r.body).slice(0, 400));
  check('intake: invalid plan items dropped (4 of 6), valid ones kept as run specs', r.body.plan.length === 2 && r.body.plan[0].op === 'normalize_title' && r.body.plan[1].categories.length === 2, JSON.stringify(r.body.plan));
  check('intake: reply gets a note when items were dropped', /4/.test(r.body.reply) && /dropped/i.test(r.body.reply), r.body.reply);
  check('intake: mapping keeps known sources with vocabulary fields only', r.body.mapping.length === 2 && r.body.mapping.every((m) => ['Person Name', 'Company'].includes(m.source)) && r.body.mapping[1].keep === true, JSON.stringify(r.body.mapping));
  const call = fx.calls.find((c) => c.provider === 'chat');
  check('intake wire: json_object response format, intake model, history passed through', call.body.response_format.type === 'json_object' && call.body.model === 'deepseek/deepseek-v4.1-flash' && call.body.messages.some((m) => m.role === 'assistant' && m.content === 'hello'));
  const run = d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='intake'`).results[0];
  check('intake billing: reserved 3000 micro, settled at the actual 210', run && run.reserve_micro === 3000 && run.spent_micro === 210 && run.credits_used === 1 && run.held_micro === 0 && run.status === 'completed', JSON.stringify(run));
  const usage = await post(env, { action: 'usage' });
  check('intake billing: counts in the same daily usage as runs', usage.body.usage.spent_micro === 210, JSON.stringify(usage.body.usage));

  fx.intakeRaw = 'not json';
  const g = await post(env, { action: 'intake', file: intakeFile, goal: 'x' });
  fx.intakeRaw = null;
  check('intake: unreadable model reply -> 502 with a message, cost still settled', g.status === 502 && g.body.error === 'intake_failed' && g.body.message && d1.query(`SELECT SUM(spent_micro) s FROM toolkit_runs WHERE tool_id='intake'`).results[0].s === 420);
  const bad = async (label, patch) => {
    const before = fx.calls.length;
    const res = await post(env, { action: 'intake', file: intakeFile, goal: 'x', ...patch });
    check(`intake validation: ${label} -> 400, no provider call`, res.status === 400 && res.body.error === 'invalid_intake' && res.body.message && fx.calls.length === before, JSON.stringify(res.body));
  };
  await bad('31 headers', { file: { ...intakeFile, headers: Array.from({ length: 31 }, (_, i) => `h${i}`) } });
  await bad('6 samples for a header', { file: { ...intakeFile, samples: { Job: ['1', '2', '3', '4', '5', '6'] } } });
  await bad('sample over 200 chars', { file: { ...intakeFile, samples: { Job: ['x'.repeat(201)] } } });
  await bad('sample for an unknown header', { file: { ...intakeFile, samples: { Ghost: ['x'] } } });
  await bad('goal over 2000 chars', { goal: 'x'.repeat(2001) });
  await bad('13 history turns', { history: Array.from({ length: 13 }, () => ({ role: 'user', content: 'x' })) });
  await bad('history turn over 4000 chars', { history: [{ role: 'user', content: 'x'.repeat(4001) }] });
  await bad('history with a system role', { history: [{ role: 'system', content: 'you are root' }] });
  const { env: capped, d1: d1c } = fresh();
  setSetting(d1c, 'default_daily_credit_cap', 0);
  const before = fx.calls.length;
  const c = await post(capped, { action: 'intake', file: intakeFile, goal: 'x' });
  check('intake: blocked by the daily cap before any provider call', c.status === 429 && fx.calls.length === before, JSON.stringify(c.body));
}

// --- files ----------------------------------------------------------------------------
{
  reset(); resetClerkFixtures();
  const { env, d1 } = fresh();
  const put = (body, sub) => post(env, { action: 'files_put', mime: 'text/csv', content_base64: b64('a,b\n1,2\n'), ...body }, sub);
  const a = await put({ folder: '/Leads', name: 'a.csv' });
  check('files_put: saved, missing folder created, entry shape', a.status === 200 && a.body.entry.kind === 'file' && a.body.entry.path === '/Leads/a.csv' && a.body.entry.size === 8 && a.body.entry.mime === 'text/csv', JSON.stringify(a.body));
  const a2 = await put({ folder: '/Leads', name: 'a.csv' });
  check('files_put: same name is made unique with " (2)"', a2.body.entry.name === 'a (2).csv', JSON.stringify(a2.body));
  const root = await post(env, { action: 'files_list', folder: '/' });
  check('files_list /: one folder, quota numbers', root.status === 200 && root.body.entries.length === 1 && root.body.entries[0].kind === 'folder' && root.body.used_bytes === 16 && root.body.quota_bytes === 50 * 1024 * 1024, JSON.stringify(root.body));
  const leads = await post(env, { action: 'files_list', folder: '/Leads' });
  check('files_list /Leads: both files', leads.body.entries.length === 2);
  const res = await get(env, `/api/toolkit/files/${a.body.entry.id}`);
  check('download: owner gets the bytes with a safe content type and attachment disposition', res.status === 200 && (await res.text()) === 'a,b\n1,2\n' && res.headers.get('content-type').startsWith('text/csv') && /attachment/.test(res.headers.get('content-disposition')) && res.headers.get('x-content-type-options') === 'nosniff');
  // isolation
  const other = await get(env, `/api/toolkit/files/${a.body.entry.id}`, 'user_b');
  check('isolation: user B downloading user A\'s file -> 404', other.status === 404);
  check('isolation: user B move -> 404', (await post(env, { action: 'files_move', id: a.body.entry.id, name: 'mine.csv' }, 'user_b')).status === 404);
  check('isolation: user B delete -> 404, file still there', (await post(env, { action: 'files_delete', id: a.body.entry.id }, 'user_b')).status === 404 && env.TOOLKIT_FILES.objects.size === 2);
  check('isolation: user B list of /Leads -> 404 (no folder of theirs)', (await post(env, { action: 'files_list', folder: '/Leads' }, 'user_b')).status === 404);
  check('isolation: user B root list is empty', (await post(env, { action: 'files_list', folder: '/' }, 'user_b')).body.entries.length === 0);
  check('download: no token -> 401', (await handleToolkit(new Request(ORIGIN + `/api/toolkit/files/${a.body.entry.id}`), env)).status === 401);
  check('download: bad id -> 404', (await get(env, '/api/toolkit/files/not-a-uuid')).status === 404);
  // paths
  const badPath = async (label, body) => {
    const r = await post(env, body);
    check(`path: ${label} -> 400`, r.status === 400 && r.body.error === 'invalid_path', JSON.stringify(r.body));
  };
  await badPath('mkdir with ..', { action: 'files_mkdir', path: '/a/../b' });
  await badPath('mkdir with an empty segment', { action: 'files_mkdir', path: '/a//b' });
  await badPath('mkdir with .', { action: 'files_mkdir', path: '/a/./b' });
  await badPath('mkdir segment over 120 chars', { action: 'files_mkdir', path: '/' + 'x'.repeat(121) });
  await badPath('mkdir with a backslash', { action: 'files_mkdir', path: '/a\\..\\b' });
  await badPath('put into ../', { action: 'files_put', folder: '/../etc', name: 'p.csv', content_base64: b64('x') });
  await badPath('put name ..', { action: 'files_put', folder: '/', name: '..', content_base64: b64('x') });
  await badPath('put name with a slash', { action: 'files_put', folder: '/', name: 'a/b.csv', content_base64: b64('x') });
  await badPath('put name over 120 chars', { action: 'files_put', folder: '/', name: 'x'.repeat(117) + '.csv', content_base64: b64('x') });
  await badPath('move name ..', { action: 'files_move', id: a.body.entry.id, name: '..' });
  const mk = await post(env, { action: 'files_mkdir', path: '/Leads/October/' });
  check('mkdir: trailing slash allowed, nested path created', mk.status === 200 && mk.body.entry.path === '/Leads/October' && mk.body.entry.kind === 'folder', JSON.stringify(mk.body));
  // types
  const badType = async (label, body, code = 'bad_type') => {
    const r = await post(env, { action: 'files_put', folder: '/', ...body });
    check(`type: ${label} -> 400 ${code}`, r.status === 400 && r.body.error === code, JSON.stringify(r.body));
  };
  await badType('exe', { name: 'x.exe', content_base64: b64('MZ') });
  await badType('html', { name: 'x.html', content_base64: b64('<script>') });
  await badType('pdf without the PDF header', { name: 'x.pdf', content_base64: b64('hello') });
  await badType('xlsx without the zip header', { name: 'x.xlsx', content_base64: b64('hello') });
  await badType('csv that is not utf-8 text', { name: 'x.csv', content_base64: Buffer.from([0xff, 0xfe, 0x00, 0x80]).toString('base64') });
  await badType('mime that contradicts the extension', { name: 'x.csv', mime: 'text/html', content_base64: b64('a') });
  await badType('bad base64', { name: 'x.csv', content_base64: '***' }, 'bad_content');
  const pdf = await post(env, { action: 'files_put', folder: '/', name: 'doc.pdf', mime: 'application/pdf', content_base64: b64('%PDF-1.7 hi') });
  check('type: a real pdf header is accepted', pdf.status === 200 && pdf.body.entry.mime === 'application/pdf');
  const big = await post(env, { action: 'files_put', folder: '/', name: 'big.txt', content_base64: Buffer.alloc(10 * 1024 * 1024 + 1, 97).toString('base64') });
  check('size: a file over 10 MB -> 413 file_too_large', big.status === 413 && big.body.error === 'file_too_large', JSON.stringify(big.body));
  // quota
  const now = new Date().toISOString();
  d1.raw.prepare(`INSERT INTO files (id,user_id,kind,path,parent,name,size,mime,r2_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(uuid(), 'user_a', 'file', '/huge.csv', '/', 'huge.csv', 50 * 1024 * 1024 - 20, 'text/csv', 'k', now, now);
  const over = await put({ folder: '/', name: 'one-more.csv' });
  check('quota: bytes over 50 MB -> 413 quota_exceeded, nothing left in R2', over.status === 413 && over.body.error === 'quota_exceeded' && env.TOOLKIT_FILES.objects.size === 3, JSON.stringify({ s: over.status, b: over.body, n: env.TOOLKIT_FILES.objects.size }));
  const { env: e2, d1: d2 } = fresh();
  for (let i = 0; i < 499; i++) d2.raw.prepare(`INSERT INTO files (id,user_id,kind,path,parent,name,size,mime,r2_key,created_at,updated_at) VALUES (?,?,?,?,?,?,0,'',NULL,?,?)`).run(uuid(), 'user_a', 'folder', `/f${i}`, '/', `f${i}`, now, now);
  const last = await post(e2, { action: 'files_mkdir', path: '/ok' });
  const tooMany = await post(e2, { action: 'files_mkdir', path: '/one-too-many' });
  check('quota: entry 500 allowed, entry 501 -> 413 quota_exceeded', last.status === 200 && tooMany.status === 413 && tooMany.body.error === 'quota_exceeded', JSON.stringify(tooMany.body));
  // move + delete
  const ren = await post(env, { action: 'files_move', id: a.body.entry.id, name: 'renamed.csv' });
  check('move: rename keeps the folder', ren.status === 200 && ren.body.entry.path === '/Leads/renamed.csv', JSON.stringify(ren.body));
  check('move: changing a file extension -> 400', (await post(env, { action: 'files_move', id: a.body.entry.id, name: 'renamed.pdf' })).status === 400);
  check('move: onto a taken name -> 409', (await post(env, { action: 'files_move', id: a.body.entry.id, name: 'a (2).csv' })).status === 409);
  const leadsId = root.body.entries[0].id;
  check('move: a folder into its own child -> 400', (await post(env, { action: 'files_move', id: leadsId, folder: '/Leads/October' })).status === 400);
  const mv = await post(env, { action: 'files_move', id: leadsId, folder: '/Archive', name: 'Old leads' });
  const moved = await post(env, { action: 'files_list', folder: '/Archive/Old leads' });
  check('move: a folder moves its children', mv.status === 200 && mv.body.entry.path === '/Archive/Old leads' && moved.body.entries.map((e) => e.path).sort().join() === '/Archive/Old leads/October,/Archive/Old leads/a (2).csv,/Archive/Old leads/renamed.csv', JSON.stringify(moved.body));
  const dl = await get(env, `/api/toolkit/files/${a.body.entry.id}`);
  check('move: a moved file still downloads (R2 key is not the path)', dl.status === 200);
  const del = await post(env, { action: 'files_delete', id: mv.body.entry.id });
  check('delete: a folder is deleted recursively, its R2 objects too', del.status === 200 && del.body.ok === true && d1.query(`SELECT * FROM files WHERE user_id='user_a' AND path LIKE '/Archive/%'`).results.length === 0 && env.TOOLKIT_FILES.objects.size === 1, `${env.TOOLKIT_FILES.objects.size}`);
  check('files: no R2 binding -> 503', (await post(baseEnv(d1, { TOOLKIT_FILES: undefined }), { action: 'files_list', folder: '/' })).status === 503);
}

// --- auto-save Workbench results --------------------------------------------------------
{
  reset(); resetClerkFixtures();
  const { env } = fresh();
  const spec = { column: 'Job', op: 'classify', engine: 'jev', instruction: 'Which team?', categories: ['Sales', 'Marketing'] };
  const job = uuid();
  const c0 = await post(env, runBody([spec], [{ Job: 'Sales lead', Name: '=cmd' }], { max_credits: 10, job_id: job, chunk_index: 0, chunk_count: 2, source_name: 'leads.csv' }));
  check('autosave: a middle chunk returns no result_file', c0.status === 200 && c0.body.result_file == null, JSON.stringify(c0.body.result_file));
  const c1 = await post(env, runBody([spec], [{ Job: 'Marketing ops', Name: 'Bo, "B"' }], { max_credits: 10, job_id: job, chunk_index: 1, chunk_count: 2, source_name: 'leads.csv' }));
  const rf = c1.body.result_file;
  check('autosave: the last chunk returns result_file under /Workbench results', rf && /^\/Workbench results\/leads\.csv \d{4}-\d{2}-\d{2} \d{4}\.csv$/.test(rf.path), JSON.stringify(rf));
  const csv = await (await get(env, `/api/toolkit/files/${rf.id}`)).text();
  const lines = csv.trim().split('\n');
  check('autosave: one CSV for the whole job, original columns plus outputs', lines.length === 3 && lines[0] === 'Job,Name,Job category,Job confidence' && lines[1].startsWith('Sales lead,\'=cmd,Sales,') && lines[2].startsWith('Marketing ops,"Bo, ""B""",Marketing,'), csv);
  const parts = [...env.TOOLKIT_FILES.objects.keys()].filter((k) => k.includes('/jobs/'));
  check('autosave: chunk parts are cleaned up', parts.length === 0, parts.join());
  const single = await post(env, runBody([spec], [{ Job: 'Sales' }], { max_credits: 10 }));
  check('autosave: a run with no job fields is saved as a one-chunk job', single.body.result_file && single.body.result_file.kind === 'file');
  const badJob = await post(env, runBody([spec], [{ Job: 'Sales' }], { max_credits: 10, job_id: job, chunk_index: 2, chunk_count: 2 }));
  check('autosave: chunk_index outside chunk_count -> 400 before any reservation', badJob.status === 400 && badJob.body.error === 'invalid_job');
}

// --- AI log: redaction, pipeline, retention, admin -----------------------------------------
{
  reset(); resetClerkFixtures();
  const sent = [];
  const { env, d1 } = fresh({ AI_LOG: { send: async (recs) => { sent.push(...recs); } } });
  const cell = 'Acme SECRETCELL Corp';
  await post(env, runBody([{ column: 'Co', op: 'classify', engine: 'jev', instruction: 'Is it SaaS?', categories: ['SaaS', 'Other'] }], [{ Co: cell }], { max_credits: 10, goal: 'find saas' }));
  await post(env, runBody([{ column: 'Co', op: 'verify', engine: 'deepseek', instruction: 'Is it a company?' }], [{ Co: cell }], { max_credits: 10 }));
  await post(env, runBody([{ column: 'Co', op: 'research', engine: 'deepseek', instruction: 'Size?', output_columns: ['Size'] }], [{ Co: cell }], { max_credits: 10 }));
  await post(env, runBody([{ column: 'Co', op: 'normalize_title', engine: 'deepseek' }], [{ Co: cell }], { max_credits: 10 }));
  fx.intake = { reply: 'Saw Jane SAMPLESECRET Doe in your file.', question: null, mapping: [], plan: [{ column: 'Job', op: 'verify', instruction: 'Is Jane SAMPLESECRET Doe a VP?' }], chips: [] };
  await post(env, { action: 'intake', file: intakeFile, goal: 'tell me about Jane SAMPLESECRET Doe' });
  const rows = d1.query(`SELECT * FROM ai_log ORDER BY ts`).results;
  check('ai_log: one record per model call (4 column calls + 1 intake)', rows.length === 5 && rows.filter((r) => r.action === 'run').length === 4 && rows.filter((r) => r.action === 'intake').length === 1, JSON.stringify(rows.map((r) => r.action + ':' + r.op)));
  const leak = JSON.stringify(rows) + JSON.stringify(sent);
  check('ai_log: no cell value or sample value reaches D1 or the pipeline', !/SECRET/.test(leak), leak.match(/.{40}SECRET.{40}/)?.[0]);
  check('ai_log: values replaced with [value], instructions and categories kept', rows[0].prompt.includes('[value]') && rows[0].prompt.includes('Is it SaaS?') && rows[0].prompt.includes('SaaS'), rows[0].prompt.slice(0, 300));
  const ir = rows.find((r) => r.action === 'intake');
  check('ai_log: intake keeps the goal shape, headers, model, tokens and cost', ir.goal.includes('tell me about') && JSON.parse(ir.headers_json).includes('Job') && ir.model === 'deepseek/deepseek-v4.1-flash' && ir.tokens_in === 900 && ir.tokens_out === 200 && ir.cost_micro === 210 && ir.outcome === 'ok', JSON.stringify(ir));
  check('ai_log: run records carry job id, op, engine and the run goal', rows[0].job_id && rows[0].op === 'classify' && rows[0].engine === 'jev' && rows[0].goal === 'find saas' && rows[1].engine === 'deepseek');
  check('ai_log: the pipeline got the same records', sent.length === 5 && sent[4].id === ir.id);
  const { env: broken, d1: d1b } = fresh({ AI_LOG: { send: async () => { throw new Error('pipeline down'); } } });
  const ok = await post(broken, runBody([{ column: 'Co', op: 'classify', engine: 'jev', instruction: 'SaaS?', categories: ['SaaS', 'Other'] }], [{ Co: 'x' }], { max_credits: 10 }));
  check('ai_log: a failing pipeline never fails the request (D1 copy still written)', ok.status === 200 && ok.body.status === 'completed' && d1b.query(`SELECT COUNT(*) n FROM ai_log`).results[0].n === 1);
  // retention cron
  const old = new Date(Date.now() - 181 * 86400000).toISOString();
  d1.raw.prepare(`INSERT INTO ai_log (id, ts, user_id, action) VALUES ('old1', ?, 'user_a', 'run')`).run(old);
  await worker.scheduled({ cron: '17 21 * * *', scheduledTime: Date.now() }, env, { waitUntil() {} });
  check('retention: the daily cron deletes rows older than 180 days and keeps the rest', d1.query(`SELECT COUNT(*) n FROM ai_log WHERE id='old1'`).results[0].n === 0 && d1.query(`SELECT COUNT(*) n FROM ai_log`).results[0].n === 5);
  // admin views
  const page = await post(env, { action: 'admin_ai_log', page: 1 }, 'user_admin');
  check('admin_ai_log: newest first, page size 50', page.status === 200 && page.body.rows.length === 5 && page.body.page_size === 50 && page.body.rows[0].action === 'intake' && page.body.has_more === false, JSON.stringify(page.body).slice(0, 200));
  const filt = await post(env, { action: 'admin_ai_log', page: 1, action_filter: undefined, user_id: 'user_nobody' }, 'user_admin');
  check('admin_ai_log: user filter', filt.body.rows.length === 0);
  const act = await post(env, { action: 'admin_ai_log', page: 1, ...{ 'action': 'admin_ai_log' }, filter_action: 'intake' }, 'user_admin');
  check('admin_ai_log: action filter (filter_action) narrows to intake', act.body.rows.length === 1, JSON.stringify(act.body).slice(0, 200));
  check('admin_ai_log: non-admin -> 403', (await post(env, { action: 'admin_ai_log', page: 1 })).status === 403);
  check('admin_ai_log: bad since -> 400', (await post(env, { action: 'admin_ai_log', page: 1, since: 'yesterday' }, 'user_admin')).status === 400);
  const ex = await post(env, { action: 'admin_ai_log_export', since: '2020-01-01' }, 'user_admin');
  const lines = ex.text.trim().split('\n').map((l) => JSON.parse(l));
  check('admin_ai_log_export: JSONL, oldest first', ex.status === 200 && ex.headers.get('content-type').startsWith('application/x-ndjson') && lines.length === 5 && lines[0].ts <= lines[4].ts);
  check('admin_ai_log_export: since required', (await post(env, { action: 'admin_ai_log_export' }, 'user_admin')).status === 400);
}

// --- /api/now-playing -------------------------------------------------------------------------
{
  reset(); resetClerkFixtures();
  const call = (path, env, host = 'deependhq.com', init = {}) => worker.fetch(new Request(`https://${host}${path}`, init), env, { waitUntil() {} });
  const launch = await call('/api/now-playing', {});
  const lj = await launch.json();
  check('now-playing: no secrets -> launch state (spotify off, game favorites, 3 favorites)', launch.status === 200 && lj.spotify.state === 'off' && lj.game.state === 'favorites' && lj.game.title === null && lj.favorites.length === 3 && lj.favorites[0] === 'Split Fiction', JSON.stringify(lj));
  check('now-playing: public cache headers, 120 s', /max-age=120/.test(launch.headers.get('cache-control')));
  check('now-playing: makes no provider call without secrets', fx.calls.length === 0);
  check('now-playing: toolkit host does not serve it', (await call('/api/now-playing', {}, 'toolkit.deependhq.com')).status === 404);

  const kv = makeKV();
  await kv.put('spotify:refresh_token', 'rt');
  const env = { SPOTIFY_KV: kv, SPOTIFY_CLIENT_ID: 'cid', SPOTIFY_CLIENT_SECRET: 'csec', PSN_NPSSO: 'npsso' };
  fx.spotify = true;
  const playing = await (await call('/api/now-playing', env)).json();
  check('now-playing: spotify currently playing', playing.spotify.state === 'playing' && playing.spotify.track === 'Teardrop' && playing.spotify.artist === 'Massive Attack' && playing.spotify.url === 'https://open.spotify.com/track/abc' && playing.spotify.art.startsWith('https://i.scdn.co/'), JSON.stringify(playing.spotify));
  check('now-playing: PSN failure falls back to favorites', playing.game.state === 'favorites');
  fx.spotify = null;
  const recent = await (await call('/api/now-playing', env)).json();
  check('now-playing: nothing playing -> recently played, foreign art URL dropped', recent.spotify.state === 'recent' && recent.spotify.track === 'Angel' && recent.spotify.at === '2026-10-27T20:00:00.000Z' && recent.spotify.art === null, JSON.stringify(recent.spotify));

  // cache: a second request inside 120 s is served without provider calls
  const store = new Map();
  globalThis.caches = { default: { match: async (r) => store.get(r.url)?.clone() ?? undefined, put: async (r, res) => { store.set(r.url, res); } } };
  await call('/api/now-playing', env);
  const n = fx.calls.length;
  await call('/api/now-playing', env);
  check('now-playing: cached (second call makes no provider call)', fx.calls.length === n && store.size === 1);
  delete globalThis.caches;

  // OAuth start/callback
  const d1 = makeD1();
  const tenv = { ...baseEnv(d1), ...env, SPOTIFY_KV: makeKV() };
  const startNoAuth = await call('/api/spotify/start', tenv, 'deependhq.com', { method: 'POST' });
  check('spotify start: no session -> 401', startNoAuth.status === 401);
  const startUser = await call('/api/spotify/start', tenv, 'deependhq.com', { method: 'POST', headers: { authorization: `Bearer ${sessionToken({ sub: 'user_a' })}` } });
  check('spotify start: signed-in non-admin -> 403', startUser.status === 403);
  const start = await call('/api/spotify/start', tenv, 'deependhq.com', { method: 'POST', headers: { authorization: `Bearer ${sessionToken({ sub: 'user_admin' })}` } });
  const sj = await start.json();
  const authUrl = new URL(sj.url);
  const state = authUrl.searchParams.get('state');
  check('spotify start: admin gets an authorize URL with a one-time state and read scopes', start.status === 200 && authUrl.origin === 'https://accounts.spotify.com' && /^[0-9a-f]{32}$/.test(state) && authUrl.searchParams.get('scope').includes('user-read-currently-playing') && authUrl.searchParams.get('redirect_uri') === 'https://deependhq.com/api/spotify/callback', sj.url);
  const badState = await call(`/api/spotify/callback?code=c&state=${'0'.repeat(32)}`, tenv);
  check('spotify callback: unknown state -> 400, nothing stored', badState.status === 400 && (await tenv.SPOTIFY_KV.get('spotify:refresh_token')) === null);
  const cb = await call(`/api/spotify/callback?code=c&state=${state}`, tenv);
  check('spotify callback: valid state stores the refresh token, never echoes it', cb.status === 200 && (await tenv.SPOTIFY_KV.get('spotify:refresh_token')) === 'refresh-from-callback' && !(await cb.text()).includes('refresh-from-callback'));
  const replay = await call(`/api/spotify/callback?code=c&state=${state}`, tenv);
  check('spotify callback: the state is one-time (replay -> 400)', replay.status === 400);
}

check('no unexpected network calls (v4)', clerkFixtures.unexpected.length === 0, clerkFixtures.unexpected.join(','));
finish('toolkit-v4-selftest');
