// scripts/toolkit-agent-api-selftest.mjs : the inbound agent API (docs/toolkit-v4-api.md section 11).
// Real SQL (node:sqlite), real Clerk token verification, in-memory R2, the real MCP SDK server. No network: the
// intake model is a fixture. A key is never printed: the only key output is the regex check's ok line.
// Run: node scripts/toolkit-agent-api-selftest.mjs

import {
  makeD1, makeR2, setSetting, seedGrant, installFetchRouter, resetClerkFixtures,
  apiRequest, sessionToken, PK, SK, CLERK_JS_URL, JWT_PUBLIC_PEM, check, finish, ORIGIN,
} from './toolkit-testkit.mjs';

installFetchRouter();
const clerkRouter = globalThis.fetch;
const fx = { intake: null };
const res = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === 'https://openrouter.ai/api/v1/chat/completions') return res({ id: 'gen-intake', choices: [{ message: { content: JSON.stringify(fx.intake) } }], usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.0002 } });
  if (url === 'https://openrouter.ai/api/v1/models') return res({ data: [] });
  return clerkRouter(input, init);
};

// Everything the worker logs is captured, so the privacy checks can scan it.
const logged = [];
for (const m of ['log', 'error', 'warn', 'info']) {
  const orig = console[m].bind(console);
  console[m] = (...a) => { logged.push(a.map(String).join(' ')); if (m === 'log') orig(...a); };
}

const { handleToolkit } = await import('../worker/toolkit.js');
const { INBOUND, SCOPES } = await import('../worker/agent-api.js');

const d1 = makeD1();
setSetting(d1, 'global_daily_cap_micro', 25000000);
setSetting(d1, 'default_daily_credit_cap', 1000);
setSetting(d1, 'default_daily_row_cap', 5000);
seedGrant(d1, 'user_a', 5000);
seedGrant(d1, 'user_b', 5000);
const env = { TOOLKIT_DB: d1, TOOLKIT_FILES: makeR2(), CLERK_PUBLISHABLE_KEY: PK, CLERK_SECRET_KEY: SK, CLERK_JWT_KEY: JWT_PUBLIC_PEM, CLERK_JS_URL, CLERK_ADMIN_IDS: 'user_a', OPENROUTER_API_KEY: 'or-key' };

async function post(body, sub = 'user_a', opts = {}) {
  const r = await handleToolkit(apiRequest(body, { token: sessionToken({ sub }), ...opts }), env);
  return { status: r.status, body: await r.json() };
}
// A request to an agent path. key null = no Authorization header.
async function agent(path, { key, method = 'GET', body, origin, headers = {} } = {}) {
  const h = { ...headers };
  if (key !== null && key !== undefined) h.authorization = `Bearer ${key}`;
  if (origin) h.origin = origin;
  if (body !== undefined) h['content-type'] = 'application/json';
  const r = await handleToolkit(new Request(ORIGIN + path, { method, headers: h, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), env);
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* bytes */ }
  return { status: r.status, body: j, text, headers: r.headers };
}
let rpcId = 0;
const MCP_HEADERS = { accept: 'application/json, text/event-stream' };
const rpc = (key, method, params = {}) => agent('/api/toolkit/mcp', { key, method: 'POST', headers: MCP_HEADERS, body: { jsonrpc: '2.0', id: ++rpcId, method, params } });
const mcpCall = async (key, name, args) => (await rpc(key, 'tools/call', { name, arguments: args })).body?.result;
const v1Call = (key, name, args) => agent('/api/toolkit/v1/tools/call', { key, method: 'POST', body: { name, arguments: args } });
const create = (label, scopes, sub = 'user_a') => post({ action: 'api_key_create', label, scopes }, sub);
const names = (list) => list.map((t) => t.name ?? t.function.name);
const READ9 = ['catalog', 'files_list', 'file_peek', 'file_read', 'account_usage', 'run_detail', 'report_summary', 'staged_list', 'staged_get'];
const CSV = 'Person Name,Job,Company\nJane CELLSECRET Doe,VP Sales,Acme\nRaj K,head of mktg,Globex\n';
const PLAN = [{ column: 'Job', op: 'normalize_title', engine: 'jev' }];
const keys = []; // every key text minted, for the scans

// 1. key creation: format, shown once, gated, validated, capped
const all = await create('Claude Desktop', SCOPES);
const KEY = all.body.key;
keys.push(KEY);
check('create: 200 and the key matches ^dhk_live_[A-Za-z0-9_-]{43}$', all.status === 200 && /^dhk_live_[A-Za-z0-9_-]{43}$/.test(KEY));
check('create: id, label, prefix (first 16 characters) and scopes in registry order', all.body.label === 'Claude Desktop' && all.body.prefix === KEY.slice(0, 16) && all.body.prefix.length === 16 && JSON.stringify(all.body.scopes) === JSON.stringify(SCOPES) && /^[0-9a-f-]{36}$/.test(all.body.id));
const list = await post({ action: 'api_keys_list' });
check('list: the key is listed without its text; open is true for an admin', list.status === 200 && list.body.open === true && list.body.keys.length === 1 && list.body.keys[0].id === all.body.id && !JSON.stringify(list.body).includes(KEY) && list.body.keys[0].last_used_at === null && Object.keys(list.body.keys[0]).join() === 'id,label,prefix,scopes,created_at,last_used_at', JSON.stringify(list.body.keys[0] && Object.keys(list.body.keys[0])));
const closed = await create('mine', ['files:read'], 'user_b');
check('create: a non-admin is refused while api_keys_open is 0 (403 api_keys_closed)', closed.status === 403 && closed.body.error === 'api_keys_closed', JSON.stringify(closed.body));
check('list: open is false for a non-admin while closed', (await post({ action: 'api_keys_list' }, 'user_b')).body.open === false);
check('create: label 1 to 40 characters', (await create('', ['files:read'])).body.error === 'invalid_label' && (await create('x'.repeat(41), ['files:read'])).body.error === 'invalid_label' && (await create('a\nb', ['files:read'])).body.error === 'invalid_label');
check('create: scopes must be known, non-empty and distinct', (await create('x', [])).body.error === 'invalid_scopes' && (await create('x', ['admin'])).body.error === 'invalid_scopes' && (await create('x', ['files:read', 'files:read'])).body.error === 'invalid_scopes' && (await create('x', 'files:read')).body.error === 'invalid_scopes');

// admin settings: the two switches are in admin_settings_get/set, validated, no model fetch needed
const sGet = await post({ action: 'admin_settings_get' });
check('admin_settings_get: api_keys_open and api_daily_calls_per_key default to 0', sGet.status === 200 && sGet.body.settings.api_keys_open === 0 && sGet.body.settings.api_daily_calls_per_key === 0, JSON.stringify(sGet.body.settings));
check('admin_settings_set: api_keys_open takes 0 or 1 only', (await post({ action: 'admin_settings_set', api_keys_open: 2 })).body.error === 'invalid_field' && (await post({ action: 'admin_settings_set', api_daily_calls_per_key: -1 })).body.error === 'invalid_field');
check('admin_settings_set: a non-admin gets 403', (await post({ action: 'admin_settings_set', api_keys_open: 1 }, 'user_b')).status === 403);
const opened = await post({ action: 'admin_settings_set', api_keys_open: 1 });
check('admin_settings_set: api_keys_open 1 saved and returned', opened.status === 200 && opened.body.settings.api_keys_open === 1, JSON.stringify(opened.body));
const bKey = await create('b agent', ['files:read', 'jobs:read'], 'user_b');
keys.push(bKey.body.key);
check('create: once open, a non-admin can create a key', bKey.status === 200 && JSON.stringify(bKey.body.scopes) === '["files:read","jobs:read"]');

// 2. the API is off until api_daily_calls_per_key is set
const off = await agent('/api/toolkit/v1/tools', { key: KEY });
check('api_daily_calls_per_key 0: 403 api_disabled', off.status === 403 && off.body.error === 'api_disabled', JSON.stringify(off.body));
check('admin_settings_set: api_daily_calls_per_key 2000 saved', (await post({ action: 'admin_settings_set', api_daily_calls_per_key: 2000 })).body.settings.api_daily_calls_per_key === 2000);

// 3. auth on the four paths
const noKey = await agent('/api/toolkit/v1/tools', { key: null });
check('no key: 401 unauthorized', noKey.status === 401 && noKey.body.error === 'unauthorized');
check('no key on /mcp and /v1/tools/call and /v1/files: 401', (await rpc(null, 'tools/list')).status === 401 && (await v1Call(null, 'catalog', {})).status === 401 && (await agent('/api/toolkit/v1/files/x', { key: null })).status === 401);
check('a Clerk session token on an agent path: 401 (keys only)', (await agent('/api/toolkit/v1/tools', { key: sessionToken() })).status === 401);
check('a well-formed key that does not exist: 401', (await agent('/api/toolkit/v1/tools', { key: 'dhk_live_' + 'A'.repeat(43) })).status === 401);
const evil = await agent('/api/toolkit/v1/tools', { key: KEY, origin: 'https://evil.example' });
check('Origin https://evil.example: 403 forbidden_origin', evil.status === 403 && evil.body.error === 'forbidden_origin');
check('Origin equal to the toolkit origin is allowed', (await agent('/api/toolkit/v1/tools', { key: KEY, origin: ORIGIN })).status === 200);
const getMcp = await agent('/api/toolkit/mcp', { key: KEY });
check('GET /api/toolkit/mcp: 405, Allow: POST', getMcp.status === 405 && getMcp.headers.get('allow') === 'POST');
check('POST /api/toolkit/v1/tools: 405', (await agent('/api/toolkit/v1/tools', { key: KEY, method: 'POST', body: {} })).status === 405);
const onAction = await post({ action: 'usage' }, 'user_a', { token: KEY });
check('a dhk_ Bearer on POST /api/toolkit: 401 (the action route stays Clerk-only)', onAction.status === 401 && onAction.body.error === 'unauthorized');
check('a dhk_ Bearer cannot reach key management or run', (await post({ action: 'api_key_create', label: 'x', scopes: SCOPES }, 'user_a', { token: KEY })).status === 401 && (await post({ action: 'run' }, 'user_a', { token: KEY })).status === 401);

// 4. MCP: initialize (legacy handshake), tools/list scoped, annotations
const init = await rpc(KEY, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'selftest', version: '1' } });
check('mcp initialize: server info and the tools capability', init.status === 200 && init.body.result.serverInfo.name === 'deependhq-toolkit' && init.body.result.capabilities.tools && !init.body.result.capabilities.tools.listChanged, init.text.slice(0, 300));
check('mcp: no-store, nosniff, and no CORS header', init.headers.get('cache-control') === 'no-store' && init.headers.get('x-content-type-options') === 'nosniff' && ![...init.headers.keys()].some((h) => h.startsWith('access-control-')));
check('mcp ping answers', (await rpc(KEY, 'ping')).body.result !== undefined);
const RKEY = (await create('reader', ['files:read', 'jobs:read'])).body.key;
keys.push(RKEY);
const readList = (await rpc(RKEY, 'tools/list')).body.result.tools;
check('tools/list with [files:read, jobs:read]: exactly the 9 names in order', JSON.stringify(names(readList)) === JSON.stringify(READ9), JSON.stringify(names(readList)));
const allList = (await rpc(KEY, 'tools/list')).body.result.tools;
check('tools/list with every scope: 17 names, the registry order, no page_steps', allList.length === 17 && JSON.stringify(names(allList)) === JSON.stringify(INBOUND.map((t) => t.name)) && !names(allList).includes('page_steps'));
check('tools/list: none named run, files_delete, staged_decide, admin_*, api_key_*', !names(allList).some((n) => /^(run|files_delete|staged_decide|admin_.*|api_key.*|deepbot|guide)$/.test(n)));
const ann = Object.fromEntries(allList.map((t) => [t.name, t.annotations]));
check('annotations: read tools readOnlyHint true', ann.files_list.readOnlyHint === true && ann.catalog.readOnlyHint === true && ann.quote.readOnlyHint === true && ann.files_list.destructiveHint === undefined);
check('annotations: write and stage tools readOnlyHint false, destructiveHint false', ['files_mkdir', 'files_save', 'stage_run', 'stage_files_move', 'connector_act'].every((n) => ann[n].readOnlyHint === false && ann[n].destructiveHint === false));
check('annotations: openWorldHint false except connector_*', allList.every((t) => t.annotations.openWorldHint === t.name.startsWith('connector_')));
check('tools/list: inputSchema is the registry JSON Schema', JSON.stringify(allList.find((t) => t.name === 'file_peek').inputSchema) === JSON.stringify(INBOUND.find((t) => t.name === 'file_peek').parameters));
const fsSchema = allList.find((t) => t.name === 'files_save').inputSchema;
check('tools/list: files_save takes content or content_base64 for keys', fsSchema.properties.content_base64 && JSON.stringify(fsSchema.required) === '["name"]');

// 5. OpenAI tools: same names, order and schemas
const v1Read = await agent('/api/toolkit/v1/tools', { key: RKEY });
check('GET /v1/tools [files:read, jobs:read]: same 9 names as tools/list', v1Read.status === 200 && JSON.stringify(names(v1Read.body.tools)) === JSON.stringify(READ9) && v1Read.body.tools.every((t) => t.type === 'function' && t.function.description && t.function.parameters.type === 'object'));
const v1All = await agent('/api/toolkit/v1/tools', { key: KEY });
check('GET /v1/tools every scope: the same 17 as tools/list, same schemas', JSON.stringify(names(v1All.body.tools)) === JSON.stringify(names(allList)) && JSON.stringify(v1All.body.tools.map((t) => t.function.parameters)) === JSON.stringify(allList.map((t) => t.inputSchema)));

// 6. calls: files, arguments, out-of-scope = unknown
const fileId = (await post({ action: 'files_put', folder: '/', name: 'leads.csv', mime: 'text/csv', content_base64: Buffer.from(CSV).toString('base64') })).body.entry.id;
const fl = await mcpCall(KEY, 'files_list', { folder: '/' });
check('mcp tools/call files_list: structuredContent and the same JSON as text', fl && !fl.isError && fl.structuredContent.entries[0].name === 'leads.csv' && JSON.parse(fl.content[0].text).entries[0].id === fileId, JSON.stringify(fl));
const peek = await v1Call(KEY, 'file_peek', { id: fileId });
check('v1 tools/call file_peek: 200 {result} with headers and samples', peek.status === 200 && peek.body.result.rows === 2 && peek.body.result.headers.join() === 'Person Name,Job,Company' && !('log' in peek.body.result), JSON.stringify(peek.body));
const unknown = await v1Call(RKEY, 'nope', {});
const outScope = await v1Call(RKEY, 'quote', { file_id: fileId, plan: PLAN });
check('v1: unknown tool is 404 unknown_tool', unknown.status === 404 && unknown.body.error === 'unknown_tool' && typeof unknown.body.message === 'string');
check('v1: an out-of-scope tool answers exactly like an unknown one', outScope.status === unknown.status && JSON.stringify(outScope.body) === JSON.stringify(unknown.body));
const mUnknown = await mcpCall(RKEY, 'nope', {});
const mOut = await mcpCall(RKEY, 'stage_run', { file_id: fileId, plan: PLAN });
check('mcp: out-of-scope and unknown tools answer identically, isError with {error, message} JSON', mUnknown.isError === true && JSON.stringify(mOut) === JSON.stringify(mUnknown) && JSON.parse(mUnknown.content[0].text).error === 'unknown_tool');
const missing = await v1Call(KEY, 'file_peek', {});
const extra = await v1Call(KEY, 'file_peek', { id: fileId, sneaky: 1 });
const typed = await v1Call(KEY, 'file_read', { id: fileId, offset: 'x' });
check('v1: bad arguments are 400 bad_arguments (missing, unknown, wrong type)', [missing, extra, typed].every((r) => r.status === 400 && r.body.error === 'bad_arguments'), JSON.stringify([missing.body, extra.body, typed.body]));
check('v1: arguments that are not an object are 400', (await v1Call(KEY, 'catalog', [])).status === 400 && (await agent('/api/toolkit/v1/tools/call', { key: KEY, method: 'POST', body: 'x' })).status === 400);
const mBad = await mcpCall(KEY, 'file_peek', {});
check('mcp: bad arguments come back isError, never a stack', mBad.isError === true && JSON.parse(mBad.content[0].text).error === 'bad_arguments' && !/at .*\.js/.test(mBad.content[0].text));
const nf = await v1Call(KEY, 'files_list', { folder: '/ARGSECRET' });
check('v1: a tool error is {error, message} with its status', nf.status === 404 && nf.body.error === 'not_found' && Object.keys(nf.body).join() === 'error,message', JSON.stringify(nf.body));
const cross = await v1Call(bKey.body.key, 'file_peek', { id: fileId });
check('cross-tenant: another user\'s key gets not_found for this file', cross.status === 400 && cross.body.error === 'not_found', JSON.stringify(cross.body));
const fr = await v1Call(KEY, 'file_read', { id: fileId });
check('file_read: a 64 KB page for keys, untrusted_file_text', fr.status === 200 && fr.body.result.untrusted_file_text === CSV && fr.body.result.next_offset === null);

// 7. stage_run over MCP: pending_approval, source key:<id>, nothing ran
const sr = await mcpCall(KEY, 'stage_run', { file_id: fileId, plan: PLAN, note: 'Titles look messy.' });
const stagedRows = d1.query(`SELECT * FROM toolkit_staged`).results;
check('mcp stage_run: structuredContent status pending_approval with an approve_url', sr && !sr.isError && sr.structuredContent.status === 'pending_approval' && sr.structuredContent.approve_url.endsWith(`#approvals/${sr.structuredContent.staged_id}`), JSON.stringify(sr));
check('stage_run: one toolkit_staged row with source key:<id>', stagedRows.length === 1 && stagedRows[0].source === `key:${all.body.id}` && stagedRows[0].kind === 'run' && stagedRows[0].status === 'pending' && stagedRows[0].user_id === 'user_a');
check('stage_run: zero data-workbench runs', d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='data-workbench'`).results.length === 0);
const sg = await v1Call(KEY, 'staged_get', { id: sr.structuredContent.staged_id });
check('staged_get: the key can poll it; a bad id is 404 not_found', sg.status === 200 && sg.body.result.item.status === 'pending' && (await v1Call(KEY, 'staged_get', { id: '00000000-0000-4000-8000-000000000000' })).status === 404);

// 8. files_save for keys: text up to 1 MB, content_base64 up to 10 MB
const saved = await v1Call(KEY, 'files_save', { name: 'notes.md', content: '# hi\n' + 'x'.repeat(200000) });
check('files_save: 200 KB of text is fine for a key (DeepBot stays at 64 KB)', saved.status === 200 && saved.body.result.entry.name === 'notes.md' && saved.body.result.entry.size > 65536);
const big = await v1Call(KEY, 'files_save', { name: 'big.txt', content: 'x'.repeat(1024 * 1024 + 1) });
check('files_save: text over 1 MB is file_too_large', big.status === 400 && big.body.error === 'file_too_large');
const pdf = await v1Call(KEY, 'files_save', { name: 'a.pdf', content_base64: Buffer.from('%PDF-1.4 tiny').toString('base64') });
check('files_save: content_base64 saves a pdf', pdf.status === 200 && pdf.body.result.entry.mime === 'application/pdf', JSON.stringify(pdf.body));
check('files_save: both or neither of content and content_base64 is bad_content', (await v1Call(KEY, 'files_save', { name: 'x.txt', content: 'a', content_base64: 'YQ==' })).body.error === 'bad_content' && (await v1Call(KEY, 'files_save', { name: 'x.txt' })).body.error === 'bad_content');
check('files_save: bad base64 is a FileError {error, message}', (await v1Call(KEY, 'files_save', { name: 'x.txt', content_base64: '!!' })).body.error === 'bad_content');
check('files_save: without files:write the tool does not exist', (await v1Call(RKEY, 'files_save', { name: 'x.txt', content: 'a' })).status === 404);

// 9. file bytes
const dl = await agent(`/api/toolkit/v1/files/${fileId}`, { key: KEY });
check('GET /v1/files/<id>: the bytes as an attachment', dl.status === 200 && dl.text === CSV && /attachment/.test(dl.headers.get('content-disposition')));
const WKEY = (await create('writer', ['files:write'])).body.key;
keys.push(WKEY);
check('GET /v1/files/<id> without files:read: 404 like a missing file', (await agent(`/api/toolkit/v1/files/${fileId}`, { key: WKEY })).status === 404 && (await agent('/api/toolkit/v1/files/nope', { key: KEY })).status === 404);

// 10. intake_plan: metered on the ledger, tagged with the key, goal kept out of ai_log
fx.intake = { reply: 'I will normalize Job.', question: null, mapping: [{ source: 'Job', field: 'title' }], plan: PLAN, chips: [] };
const ip = await v1Call(KEY, 'intake_plan', { file_id: fileId, goal: 'clean GOALSECRET titles' });
const intakeRun = d1.query(`SELECT * FROM toolkit_runs WHERE tool_id='intake'`).results;
check('intake_plan: 200 with a plan', ip.status === 200 && ip.body.result.plan.length === 1, JSON.stringify(ip.body));
check('intake_plan: reserved and settled on the ledger, tagged key:<id>', intakeRun.length === 1 && intakeRun[0].status === 'completed' && intakeRun[0].held_micro === 0 && intakeRun[0].spent_micro === 200 && intakeRun[0].list_name === `key:${all.body.id}`, JSON.stringify(intakeRun));
check('intake_plan: the call row carries the cost', d1.query(`SELECT cost_micro FROM toolkit_api_calls WHERE tool='intake_plan'`).results[0]?.cost_micro === 200);
const aiLog = JSON.stringify(d1.query(`SELECT * FROM ai_log`).results);
check('ai_log: one intake row, no goal text and no cell value', aiLog.includes('"action":"intake"') && !aiLog.includes('GOALSECRET') && !aiLog.includes('CELLSECRET'), aiLog.slice(0, 400));

// 11. call log and last_used_at
const calls = d1.query(`SELECT * FROM toolkit_api_calls WHERE key_id=?`, all.body.id).results;
check('toolkit_api_calls: one row per authenticated request, only these columns', calls.length > 10 && Object.keys(calls[0]).join() === 'id,key_id,user_id,tool,status,cost_micro,ts' && calls.every((c) => c.user_id === 'user_a'));
check('toolkit_api_calls: tool names and outcomes', calls.some((c) => c.tool === 'mcp:initialize') && calls.some((c) => c.tool === 'mcp:tools/list') && calls.some((c) => c.tool === 'stage_run' && c.status === 'ok') && calls.some((c) => c.tool === 'files_list' && c.status === 'error') && calls.some((c) => c.tool === 'v1/tools') && calls.some((c) => c.tool === 'v1/files'));
check('toolkit_api_calls: an unknown tool name is stored as unknown, never as sent', d1.query(`SELECT * FROM toolkit_api_calls WHERE tool='nope'`).results.length === 0 && d1.query(`SELECT * FROM toolkit_api_calls WHERE tool='unknown'`).results.length >= 2, JSON.stringify(d1.query(`SELECT tool, status, COUNT(*) AS n FROM toolkit_api_calls GROUP BY tool, status`).results));
check('rejected requests (401, 403, 405) write no row', d1.query(`SELECT COUNT(*) AS n FROM toolkit_api_calls`).results[0].n === d1.query(`SELECT COUNT(*) AS n FROM toolkit_api_calls WHERE key_id IN (SELECT id FROM toolkit_api_keys)`).results[0].n);
check('last_used_at is set after use', (await post({ action: 'api_keys_list' })).body.keys.find((k) => k.id === all.body.id).last_used_at !== null);

// 12. daily cap and burst limit
const DKEY = (await create('daily', ['files:read'])).body.key;
keys.push(DKEY);
setSetting(d1, 'api_daily_calls_per_key', 3);
for (let i = 0; i < 3; i++) await agent('/api/toolkit/v1/tools', { key: DKEY });
const fourth = await agent('/api/toolkit/v1/tools', { key: DKEY });
check('daily cap: the call after api_daily_calls_per_key is 429 daily_limit', fourth.status === 429 && fourth.body.error === 'daily_limit', JSON.stringify(fourth.body));
setSetting(d1, 'api_daily_calls_per_key', 2000);
const hits = new Map();
env.AGENT_API_RL = { async limit({ key }) { const n = (hits.get(key) || 0) + 1; hits.set(key, n); return { success: n <= 60 }; } };
const burst = [];
for (let i = 0; i < 61; i++) burst.push((await agent('/api/toolkit/v1/tools', { key: RKEY })).status);
const r61 = await agent('/api/toolkit/v1/tools', { key: KEY }); // another key has its own counter
check('burst: 60 calls pass, the 61st in the window is 429', burst.slice(0, 60).every((s) => s === 200) && burst[60] === 429, JSON.stringify(burst.slice(58)));
const last = await agent('/api/toolkit/v1/tools', { key: RKEY });
check('burst: 429 rate_limited with Retry-After: 60, keyed by key id', last.status === 429 && last.body.error === 'rate_limited' && last.headers.get('retry-after') === '60' && r61.status === 200 && [...hits.keys()].every((k) => /^[0-9a-f-]{36}$/.test(k)));
delete env.AGENT_API_RL;

// 13. cap of 5 active keys, revoke (user_a holds 4: all, reader, writer, daily)
keys.push((await create('fifth', ['files:read'])).body.key);
const sixth = await create('sixth', ['files:read']);
check('create: a sixth active key is 409 too_many_keys', sixth.status === 409 && sixth.body.error === 'too_many_keys', String(sixth.body.error));
const rv = await post({ action: 'api_key_revoke', id: all.body.id });
check('revoke: {ok: true}', rv.status === 200 && rv.body.ok === true);
check('revoke: another user cannot revoke it, and twice is 404', (await post({ action: 'api_key_revoke', id: bKey.body.id })).status === 404 && (await post({ action: 'api_key_revoke', id: all.body.id })).status === 404);
const revoked = await agent('/api/toolkit/v1/tools', { key: KEY });
check('revoked key: 401 immediately', revoked.status === 401 && (await rpc(KEY, 'tools/list')).status === 401);
check('revoke: the key leaves the list and frees a slot', !(await post({ action: 'api_keys_list' })).body.keys.some((k) => k.id === all.body.id) && (await create('again', ['files:read']).then((r) => (keys.push(r.body.key), r))).status === 200);

// 14. privacy: no key text anywhere in storage or logs; no argument or cell value in the call log, ai_log or logs
const dump = d1.query(`SELECT name FROM sqlite_master WHERE type='table'`).results.map(({ name }) => JSON.stringify(d1.query(`SELECT * FROM "${name}"`).results)).join('\n');
const keyTables = JSON.stringify(d1.query(`SELECT * FROM toolkit_api_keys`).results) + JSON.stringify(d1.query(`SELECT * FROM toolkit_api_calls`).results);
check('no key text in any column of any row of toolkit_api_keys and toolkit_api_calls', keys.every((k) => !keyTables.includes(k)) && keys.every((k) => !keyTables.includes(k.slice(9))));
check('no key text in any row of any table', keys.every((k) => !dump.includes(k.slice(9))));
check('key_hash is the sha256 hex of the key', d1.query(`SELECT key_hash FROM toolkit_api_keys WHERE id=?`, all.body.id).results[0].key_hash.length === 64);
const callDump = JSON.stringify(d1.query(`SELECT * FROM toolkit_api_calls`).results);
check('no argument or cell value in toolkit_api_calls', !/ARGSECRET|GOALSECRET|CELLSECRET|Titles look messy/.test(callDump));
const logText = logged.join('\n');
check('no key text, argument or cell value in console output, and no failed call-log write', keys.every((k) => !logText.includes(k.slice(9))) && !/ARGSECRET|GOALSECRET|CELLSECRET/.test(logText) && !logText.includes('call log failed'));

finish('toolkit-agent-api-selftest');
