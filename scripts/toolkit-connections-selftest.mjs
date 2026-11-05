// scripts/toolkit-connections-selftest.mjs : connections, connectors, invite requests (docs/toolkit-v4-api.md section 9).
// Real SQL (node:sqlite), real token verification, in-memory R2. Harbinger, ChampBeam and the model are in-process
// fixtures: no network. Run: node scripts/toolkit-connections-selftest.mjs

import {
  makeD1, makeR2, setSetting, seedGrant, installFetchRouter, resetClerkFixtures, clerkFixtures, userJson,
  apiRequest, sessionToken, PK, SK, CLERK_JS_URL, JWT_PUBLIC_PEM, check, finish,
} from './toolkit-testkit.mjs';

installFetchRouter();
const clerkRouter = globalThis.fetch;

const HB = 'https://champ-harbinger.deep-ae0.workers.dev';
const BEAM = 'https://champbeam.com';
const HB_KEY = 'hb_live_SECRETKEYSECRET1234';
const HB_KEY_B = 'hb_live_OTHERUSERKEY99887766';
const CB_KEY = 'cb_live_BEAMKEYBEAMKEY5555';
const CHAT = 'https://openrouter.ai/api/v1/chat/completions';

const fx = { calls: [], script: [], chat: [], deny: new Set(), down: new Set(), forbid: new Set(), errors: [] };
const res = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const usage = { prompt_tokens: 100, completion_tokens: 20, cost: 0.0005 };
const say = (content) => ({ choices: [{ message: { content } }], usage });
const tool = (name, args = {}, id = 'call_1') => ({ choices: [{ message: { content: null, tool_calls: [{ id, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }], usage });
const realError = console.error;
console.error = (...a) => { fx.errors.push(a.join(' ')); };

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (url === CHAT) { fx.chat.push(JSON.parse(init.body)); return res({ id: 'gen-x', ...(fx.script.shift() ?? say('(script ended)')) }); }
  const isHb = url.startsWith(HB), isBeam = url.startsWith(BEAM), isUp = url.startsWith('https://s3.fixture/');
  if (!isHb && !isBeam && !isUp) return clerkRouter(input, init);
  const method = init.method || 'GET';
  const h = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const path = url.replace(isHb ? HB : isBeam ? BEAM : 'https://s3.fixture', '');
  fx.calls.push({ method, url, path, key: h['x-api-key'] ?? null, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body ?? null });
  const host = isHb ? 'harbinger' : 'beam';
  if (fx.down.has(host)) return res({ error: 'down' }, 503);
  if (!isUp && fx.forbid.has(host)) return res({ detail: 'forbidden' }, 403);
  if (!isUp && fx.deny.has(h['x-api-key'])) return res({ error: 'bad key' }, 401);
  if (isHb) {
    if (path === '/api/integrations/status') return res({ account: { email: 'maya@acme.test' } });
    if (path === '/api/overview/today') return res({ mailboxes: [{ email: 'a@acme.test', sends_left: 40 }] });
    if (path === '/api/campaigns' && method === 'GET') return res([{ id: 'c1', name: 'SECRETCAMPAIGN Q4', status: 'active', extra: 'x' }]);
    if (path === '/api/outreach') return res({ sequences: [{ id: 's1', name: 'Seq 1' }, { id: 's2', name: 'Seq 2' }] });
    if (path.startsWith('/api/outreach/drafts')) { const q = new URL(url).searchParams.get('sequence'); return q ? res({ drafts: [{ id: 'd-' + q, subject: 'Hi Jane' }] }) : res({ error: 'sequence param is required' }, 400); }
    if (path === '/api/goal/plan') return res({ id: 'plan1', capacity: 40 }, 201);
    if (path === '/api/campaigns' && method === 'POST') return res({ id: 'camp-9' }, 201);
    if (path === '/api/import-csv') return res({ imported: 2 });
  }
  if (isBeam) {
    if (path === '/api/v1/auth/me') return res({ user_id: 'u1', email: 'raj@beam.test' });
    if (path === '/api/v1/content/mine/shares') return res({ detail: 'Select an organization' }, 403);
    if (path === '/api/v1/files/f-1/summary') return res({ view_count: 7 });
    if (path === '/api/v1/files' && method === 'POST') return res({ file_id: 'f-1', short_code: 'ab', presigned_put_url: 'https://s3.fixture/put?sig=1', headers: { 'x-amz-meta': 'a' }, serve_mode: 'x' }, 201);
    if (path === '/api/v1/files/f-1/finalize') return res({ serve_url: 'https://champbeam.com/s/ab' });
  }
  if (isUp) return new Response('', { status: 200 });
  return res({ error: 'not found' }, 404);
};
const reset = () => { fx.calls = []; fx.script = []; fx.chat = []; fx.deny = new Set(); fx.down = new Set(); fx.forbid = new Set(); fx.errors = []; resetClerkFixtures(); };

const { handleToolkit } = await import('../worker/toolkit.js');
const baseEnv = (d1, over = {}) => ({ TOOLKIT_DB: d1, TOOLKIT_FILES: makeR2(), CLERK_PUBLISHABLE_KEY: PK, CLERK_SECRET_KEY: SK, CLERK_JWT_KEY: JWT_PUBLIC_PEM, CLERK_JS_URL, OPENROUTER_API_KEY: 'or-key', CLERK_ADMIN_IDS: 'user_admin', CLERK_ADMIN_EMAILS: 'deep1499@gmail.com', CONNECTIONS_SECRET: 'test-connections-secret-0123456789', ...over });
const fresh = (over) => {
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 25000000);
  setSetting(d1, 'default_daily_credit_cap', 1000);
  setSetting(d1, 'default_daily_row_cap', 5000);
  for (const u of ['user_a', 'user_b', 'user_admin']) seedGrant(d1, u, 5000);
  clerkFixtures.users.user_a = userJson('user_a', 'maya@acme.test');
  return { d1, env: baseEnv(d1, over) };
};
async function post(env, body, sub = 'user_a', token) {
  const r = await handleToolkit(apiRequest(body, { token: token === undefined ? sessionToken({ sub }) : token }), env);
  return { status: r.status, body: await r.json() };
}
const put = async (env, name, csv, mime = 'text/csv') => (await post(env, { action: 'files_put', folder: '/', name, mime, content_base64: Buffer.from(csv).toString('base64') })).body.entry.id;
const connect = async (env, provider, api_key, sub = 'user_a') => post(env, { action: 'connection_save', provider, api_key }, sub);
const toolMsgs = (b) => b.messages.filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
const post_calls = () => fx.calls.filter((c) => c.method !== 'GET' && !c.url.startsWith('https://s3.fixture/'));
const CSV = 'Name,Email,Company\nJane Doe,jane@acme.test,Acme\nRaj K,raj@globex.test,Globex\n';
const MAPPING = [{ source: 'Name', field: 'person_name' }, { source: 'Email', field: 'email' }, { source: 'Company', field: 'company' }];

// 1. save: tested on save, encrypted, masked on read
{
  reset();
  const { env, d1 } = fresh({ CONNECTIONS_SECRET: undefined });
  check('save: no Worker secret -> 503 connections_not_configured, no outbound call', (await connect(env, 'harbinger', HB_KEY)).status === 503 && fx.calls.length === 0);
}
{
  reset();
  const { env, d1 } = fresh();
  const wrong = await connect(env, 'harbinger', 'sk-not-a-harbinger-key-1234');
  check('save: wrong key prefix -> 400 invalid_key_format, no outbound call', wrong.status === 400 && wrong.body.error === 'invalid_key_format' && fx.calls.length === 0, JSON.stringify(wrong.body));
  check('save: unknown provider -> 400', (await connect(env, 'hubspot', HB_KEY)).status === 400);
  fx.deny.add(HB_KEY);
  const rejected = await connect(env, 'harbinger', HB_KEY);
  check('save: a key the provider refuses -> 400 key_rejected and nothing is stored', rejected.status === 400 && rejected.body.error === 'key_rejected' && d1.query('SELECT * FROM toolkit_connections').results.length === 0, JSON.stringify(rejected.body));
  fx.deny.clear(); fx.down.add('harbinger');
  const down = await connect(env, 'harbinger', HB_KEY);
  check('save: provider down -> 502 provider_down, nothing stored', down.status === 502 && down.body.error === 'provider_down' && d1.query('SELECT * FROM toolkit_connections').results.length === 0);
  fx.down.clear(); fx.calls = [];
  const ok = await connect(env, 'harbinger', HB_KEY);
  check('save: tested with one GET integrations/status carrying X-API-Key; answer is masked with the account label', ok.status === 200 && ok.body.state === 'connected' && ok.body.key_hint === 'hb_live_****1234' && ok.body.account === 'maya@acme.test' && fx.calls.length === 1 && fx.calls[0].path === '/api/integrations/status' && fx.calls[0].key === HB_KEY, JSON.stringify(ok.body));
  const row = d1.query('SELECT * FROM toolkit_connections').results[0];
  check('save: stored ciphertext does not contain the key, hint is masked', row.key_ciphertext && !JSON.stringify(row).includes('SECRETKEYSECRET') && row.key_hint === 'hb_live_****1234', JSON.stringify(row));
  const list = await post(env, { action: 'connection_list' });
  const hb = list.body.connections.find((c) => c.provider === 'harbinger');
  check('list: masked on read, never the key; both providers shown with their pulls and acts', list.status === 200 && list.body.configured === true && hb.state === 'connected' && hb.key_hint === 'hb_live_****1234' && !JSON.stringify(list.body).includes('SECRETKEY') && list.body.connections.find((c) => c.provider === 'beam').state === 'not_connected' && hb.acts.join() === 'plan_campaign,push_campaign', JSON.stringify(list.body));
  const resave = await connect(env, 'harbinger', HB_KEY_B);
  check('save: saving again replaces the key (one row)', resave.status === 200 && d1.query('SELECT * FROM toolkit_connections').results.length === 1 && resave.body.key_hint.endsWith('7766'));
  // ciphertext is bound to its row: copied to another user it does not open
  d1.raw.prepare(`INSERT INTO toolkit_connections SELECT 'user_b', provider, key_ciphertext, key_hint, label, created_at FROM toolkit_connections WHERE user_id='user_a'`).run();
  const stolen = await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' }, 'user_b');
  check('crypto: a ciphertext copied to another user does not decrypt', stolen.body.error === 'key_unreadable', JSON.stringify(stolen.body));
  check('delete: removes only the caller\'s row', (await post(env, { action: 'connection_delete', provider: 'harbinger' })).body.state === 'not_connected' && d1.query('SELECT user_id FROM toolkit_connections').results.length === 1);
  check('auth: connection actions need a session', (await post(env, { action: 'connection_list' }, 'user_a', null)).status === 401);
}

// 2. pulls
{
  reset();
  const { env } = fresh();
  check('pull: not connected -> not_connected', (await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' })).body.error === 'not_connected');
  await connect(env, 'harbinger', HB_KEY);
  fx.calls = [];
  const cap = await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'capacity_today' });
  const camps = await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' });
  const drafts = await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'drafts_pending' });
  check('pull: capacity_today, campaigns (id, name, status only), drafts_pending', cap.body.data.mailboxes[0].sends_left === 40 && camps.body.data.length === 1 && !('extra' in camps.body.data[0]) && drafts.body.data.map((d) => d.id).join() === 'd-s1,d-s2', JSON.stringify([cap.body, camps.body, drafts.body]).slice(0, 400));
  check('pull: every call used the user\'s key on the allowlisted GET routes', fx.calls.length === 5 && fx.calls.every((c) => c.method === 'GET' && c.key === HB_KEY) && fx.calls.map((c) => c.path).join() === '/api/overview/today,/api/campaigns,/api/outreach,/api/outreach/drafts?sequence=s1,/api/outreach/drafts?sequence=s2');
  const bad = await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'delete_everything' });
  check('pull: an op outside the adapter is refused before any call', bad.body.error === 'unknown_op' && fx.calls.length === 5);
  fx.deny.add(HB_KEY);
  check('pull: the provider revoked the key -> invalid_key', (await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' })).body.error === 'invalid_key');
  fx.deny.clear(); fx.down.add('harbinger');
  check('pull: provider down -> provider_down (400 from us is the user\'s, state is in the body)', (await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' })).body.error === 'provider_down');
  fx.down.clear();
  fx.calls = [];
  const bs = await connect(env, 'beam', CB_KEY);
  check('save: ChampBeam is tested on GET auth/me (no organization needed) and labeled with the account', bs.status === 200 && bs.body.account === 'raj@beam.test' && fx.calls.length === 1 && fx.calls[0].path === '/api/v1/auth/me', JSON.stringify([bs.body, fx.calls.map((c) => c.path)]));
  const st = await post(env, { action: 'connector_pull', provider: 'beam', op: 'stats', args: { id: 'f-1' } });
  check('pull: ChampBeam stats', st.body.data.view_count === 7);
  fx.forbid.add('harbinger'); fx.forbid.add('beam');
  const f1 = await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' }), f2 = await post(env, { action: 'connector_pull', provider: 'beam', op: 'stats', args: { id: 'f-1' } });
  check('403 copy is per provider', f1.body.error === 'not_allowed' && /ChampHarbinger is invite-only/.test(f1.body.message) && f2.body.error === 'not_allowed' && !/invite-only|Harbinger/.test(f2.body.message), JSON.stringify([f1.body, f2.body]));
  fx.forbid.clear();
  check('pull: ChampBeam stats refuses a path-shaped id', (await post(env, { action: 'connector_pull', provider: 'beam', op: 'stats', args: { id: '../keys' } })).body.error === 'invalid_args');
}

// 3. acts stage only; approval is a separate, human action
{
  reset();
  const { env, d1 } = fresh();
  await connect(env, 'harbinger', HB_KEY);
  const fid = await put(env, 'leads.csv', CSV);
  fx.calls = [];
  const plan = await post(env, { action: 'connector_act', provider: 'harbinger', op: 'plan_campaign', args: { goal: 'Book 10 demos in Q4' } });
  check('plan_campaign: staged with a preview and an approve action; nothing posted', plan.status === 200 && plan.body.status === 'staged' && !('file' in plan.body.preview) && plan.body.preview.goal === 'Book 10 demos in Q4' && plan.body.approve.action === 'connector_approve' && plan.body.approve.staged_id === plan.body.staged_id && post_calls().length === 0, JSON.stringify(plan.body));
  const push = await post(env, { action: 'connector_act', provider: 'harbinger', op: 'push_campaign', args: { file_id: fid, mapping: MAPPING, name: 'Q4 push' } });
  check('push_campaign: staged, preview counts rows and fields and names the enrichment cost; still nothing posted', push.body.status === 'staged' && /enriches the imported companies against your enrichment budget/.test(push.body.preview.note) && push.body.preview.will_import === 2 && push.body.preview.fields.join() === 'person_name,email,company' && post_calls().length === 0, JSON.stringify(push.body));
  check('push_campaign: a mapping with an unknown header is refused at stage time', (await post(env, { action: 'connector_act', provider: 'harbinger', op: 'push_campaign', args: { file_id: fid, mapping: [{ source: 'Ghost', field: 'email' }], name: 'x' } })).body.error === 'invalid_args');
  check('push_campaign: a mapping with no name, email or LinkedIn column is refused', (await post(env, { action: 'connector_act', provider: 'harbinger', op: 'push_campaign', args: { file_id: fid, mapping: [{ source: 'Company', field: 'company' }], name: 'x' } })).body.error === 'invalid_args');
  check('plan_campaign: a short goal is refused', (await post(env, { action: 'connector_act', provider: 'harbinger', op: 'plan_campaign', args: { goal: 'x' } })).body.error === 'invalid_args');
  check('staging wrote rows with status staged and no result', d1.query(`SELECT status, result_json FROM connector_staged`).results.every((r) => r.status === 'staged' && r.result_json === null));

  check('approve: another user cannot approve it (404)', (await post(env, { action: 'connector_approve', staged_id: push.body.staged_id }, 'user_b')).status === 404 && post_calls().length === 0);
  const go = await post(env, { action: 'connector_approve', staged_id: push.body.staged_id });
  const posts = post_calls();
  check('approve (the human click): creates the campaign, imports the mapped contacts, returns the Harbinger link', go.status === 200 && go.body.status === 'approved' && go.body.result.campaign_id === 'camp-9' && go.body.result.imported === 2 && go.body.result.approve_url === `${HB}/campaigns/camp-9`, JSON.stringify(go.body));
  check('approve: exactly POST campaigns then POST import-csv, with the contacts mapped and nothing sent', posts.map((c) => c.path).join() === '/api/campaigns,/api/import-csv' && posts[1].body.campaignId === 'camp-9' && posts[1].body.contacts[0].name === 'Jane Doe' && posts[1].body.contacts[1].email === 'raj@globex.test' && posts.every((c) => c.key === HB_KEY), JSON.stringify(posts));
  const again = await post(env, { action: 'connector_approve', staged_id: push.body.staged_id });
  check('approve: a second click returns the first result and runs nothing', again.body.already_approved === true && again.body.result.campaign_id === 'camp-9' && post_calls().length === 2);
  const pl = await post(env, { action: 'connector_approve', staged_id: plan.body.staged_id });
  check('approve plan_campaign: POST goal/plan with the goal', pl.body.result.id === 'plan1' && post_calls().at(-1).path === '/api/goal/plan' && post_calls().at(-1).body.goal === 'Book 10 demos in Q4');

  const old = await post(env, { action: 'connector_act', provider: 'harbinger', op: 'plan_campaign', args: { goal: 'A goal that expires' } });
  d1.raw.prepare(`UPDATE connector_staged SET expires_at='2020-01-01T00:00:00.000Z' WHERE id=?`).run(old.body.staged_id);
  const n = post_calls().length;
  const exp = await post(env, { action: 'connector_approve', staged_id: old.body.staged_id });
  check('approve: a stage older than an hour is refused (410) and runs nothing', exp.status === 410 && exp.body.error === 'expired' && post_calls().length === n);

  const fail = await post(env, { action: 'connector_act', provider: 'harbinger', op: 'plan_campaign', args: { goal: 'A goal that fails' } });
  fx.deny.add(HB_KEY);
  const failed = await post(env, { action: 'connector_approve', staged_id: fail.body.staged_id });
  check('approve: a provider failure is reported and the stage is marked failed (not retried)', failed.status === 400 && failed.body.status === 'failed' && failed.body.error === 'invalid_key' && d1.query(`SELECT status FROM connector_staged WHERE id=?`, fail.body.staged_id).results[0].status === 'failed');
  check('approve: a malformed id -> 400, an unknown id -> 404', (await post(env, { action: 'connector_approve', staged_id: 'x' })).status === 400 && (await post(env, { action: 'connector_approve', staged_id: '11111111-1111-4111-8111-111111111111' })).status === 404);
}
{
  reset();
  const { env } = fresh();
  await connect(env, 'beam', CB_KEY);
  const fid = await put(env, 'report.pdf', '%PDF-1.4 fake', 'application/pdf');
  fx.calls = [];
  const s = await post(env, { action: 'connector_act', provider: 'beam', op: 'share_file', args: { file_id: fid } });
  check('share_file: staged with file name and size; nothing uploaded', s.body.status === 'staged' && s.body.preview.file === 'report.pdf' && s.body.preview.size === 13 && fx.calls.length === 0, JSON.stringify(s.body));
  const go = await post(env, { action: 'connector_approve', staged_id: s.body.staged_id });
  const up = fx.calls.find((c) => c.url.startsWith('https://s3.fixture/'));
  check('approve share_file: init, PUT the bytes, finalize; the share link comes back', go.body.result.share_url === 'https://champbeam.com/s/ab' && fx.calls.map((c) => c.method + ' ' + c.path).join() === 'POST /api/v1/files,PUT /put?sig=1,POST /api/v1/files/f-1/finalize', JSON.stringify(go.body) + fx.calls.map((c) => c.path));
  check('approve share_file: the presigned upload does not receive the ChampBeam key', up && up.key === null);
  check('share_file: a file that does not exist -> not_found', (await post(env, { action: 'connector_act', provider: 'beam', op: 'share_file', args: { file_id: '22222222-2222-4222-8222-222222222222' } })).body.error === 'not_found');
}

// 4. the agent stages; it cannot approve; connector data and keys stay out of ai_log
{
  reset();
  const { env, d1 } = fresh();
  await connect(env, 'harbinger', HB_KEY);
  const fid = await put(env, 'leads.csv', CSV);
  fx.calls = [];
  fx.script = [tool('connector_pull', { provider: 'harbinger', op: 'campaigns' }), tool('connector_act', { provider: 'harbinger', op: 'push_campaign', args: { file_id: fid, mapping: MAPPING, name: 'Agent push' } }), say('I staged the campaign. You approve it in the window.')];
  const r = await post(env, { action: 'deepbot', message: `my key is ${HB_KEY}, push leads.csv as a campaign` });
  const staged = r.body.cards.find((c) => c.kind === 'staged');
  check('agent: pulled campaigns reach the model', toolMsgs(fx.chat[1])[0].data[0].name === 'SECRETCAMPAIGN Q4');
  check('agent: connector_act returns a staged card with the approve action; nothing was posted', r.status === 200 && staged && staged.data.status === 'staged' && staged.data.approve.action === 'connector_approve' && post_calls().length === 0, JSON.stringify(r.body).slice(0, 400));
  check('agent: the tool list has no approve or run tool', !fx.chat[0].tools.some((t) => /approve|run|send|push/.test(t.function.name)));
  fx.script = [tool('connector_approve', { staged_id: staged.data.staged_id }), say('x')];
  await post(env, { action: 'deepbot', message: 'approve it' });
  check('agent: calling connector_approve as a tool is unknown_tool and runs nothing', toolMsgs(fx.chat.at(-1))[0].error === 'unknown_tool' && post_calls().length === 0);
  const logs = JSON.stringify(d1.query('SELECT * FROM ai_log').results);
  check('privacy: ai_log has neither connector data nor the pasted key', !logs.includes('SECRETCAMPAIGN') && !logs.includes('SECRETKEYSECRET') && logs.includes('[connector data]'), logs.slice(0, 300));
  check('privacy: the pasted key never reached the model and is not in any stored turn or thread title', !JSON.stringify(fx.chat).includes('SECRETKEYSECRET') && !JSON.stringify(d1.query('SELECT * FROM deepbot_turns').results).includes('SECRETKEYSECRET') && !JSON.stringify(d1.query('SELECT * FROM deepbot_threads').results).includes('SECRETKEYSECRET'));
  fx.script = [say('unused')];
  const cat = await post(env, { action: 'deepbot', message: 'what can you do?' });
  const cn = cat.body.cards[0].data.connectors;
  check('catalog: shows live connection state, free', cn.find((c) => c.id === 'harbinger').status === 'connected' && cn.find((c) => c.id === 'beam').status === 'not_connected' && cat.body.cost_micro === 0);
}

// 5. the key is nowhere it should not be
{
  reset();
  const { env, d1 } = fresh();
  await connect(env, 'harbinger', HB_KEY);
  fx.deny.add(HB_KEY);
  await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' });
  fx.deny.clear(); fx.down.add('harbinger');
  await post(env, { action: 'connector_pull', provider: 'harbinger', op: 'campaigns' });
  fx.script = [tool('connector_pull', { provider: 'harbinger', op: 'campaigns' }), say('done')];
  const dumps = [];
  for (const t of ['toolkit_connections', 'connector_staged', 'ai_log', 'deepbot_turns', 'toolkit_events', 'toolkit_ops']) dumps.push(...d1.query(`SELECT * FROM ${t}`).results.map((x) => (t === 'toolkit_connections' ? { ...x, key_ciphertext: '' } : x)));
  check('logs: the key is in no console line, ai_log, event or op row (only the sealed column holds it)', !fx.errors.join('\n').includes('SECRETKEYSECRET') && !JSON.stringify(dumps).includes('SECRETKEYSECRET'));
}

// 6. invite requests
{
  reset();
  const { env, d1 } = fresh();
  fx.calls = [];
  check('invite: needs a session', (await post(env, { action: 'invite_request_create' }, 'user_a', null)).status === 401);
  const r1 = await post(env, { action: 'invite_request_create', note: 'I run outbound for Acme \u2014 need Harbinger.' });
  const row = d1.query('SELECT * FROM invite_requests').results[0];
  check('invite: 201, one open request, the email comes from the account', r1.status === 201 && r1.body.already_open === false && r1.body.request.status === 'open' && row.email === 'maya@acme.test', JSON.stringify(r1.body));
  check('invite: a draft for Deep is stored on the row, dashes cleaned, nothing sent', row.draft_to === 'deep1499@gmail.com' && /maya@acme\.test/.test(row.draft_body) && /outbound for Acme, need Harbinger/.test(row.draft_body) && !/[\u2014\u2013]/.test(row.draft_body + row.note) && /ChampHarbinger invite request/.test(row.draft_subject) && fx.calls.length === 0, row.draft_body);
  const r2 = await post(env, { action: 'invite_request_create' });
  check('invite: a second request while one is open returns it (200, already_open), no new row', r2.status === 200 && r2.body.already_open === true && r2.body.request.id === r1.body.request.id && d1.query('SELECT * FROM invite_requests').results.length === 1);
  check('invite: note over 500 characters -> 400', (await post(env, { action: 'invite_request_create', note: 'x'.repeat(501) }, 'user_b')).status === 400);
  check('admin list: non-admin -> 403', (await post(env, { action: 'admin_invite_requests' })).status === 403);
  const list = await post(env, { action: 'admin_invite_requests' }, 'user_admin');
  check('admin list: open requests with the staged draft', list.status === 200 && list.body.requests.length === 1 && list.body.requests[0].user_id === 'user_a' && list.body.requests[0].draft_body.includes('maya@acme.test') && list.body.requests[0].status === 'open', JSON.stringify(list.body).slice(0, 300));
  check('admin resolve: non-admin -> 403', (await post(env, { action: 'admin_invite_request_resolve', id: r1.body.request.id, status: 'invited' })).status === 403);
  check('admin resolve: bad status -> 400', (await post(env, { action: 'admin_invite_request_resolve', id: r1.body.request.id, status: 'maybe' }, 'user_admin')).status === 400);
  const done = await post(env, { action: 'admin_invite_request_resolve', id: r1.body.request.id, status: 'invited' }, 'user_admin');
  check('admin resolve: marks it invited; the open list is empty', done.body.status === 'invited' && (await post(env, { action: 'admin_invite_requests' }, 'user_admin')).body.requests.length === 0 && (await post(env, { action: 'admin_invite_requests', status: 'all' }, 'user_admin')).body.requests.length === 1);
  const r3 = await post(env, { action: 'invite_request_create' });
  const r4 = (async () => { await post(env, { action: 'admin_invite_request_resolve', id: r3.body.request.id, status: 'declined' }, 'user_admin'); return post(env, { action: 'invite_request_create' }); })();
  check('invite: after resolution a new request is allowed (201)', r3.status === 201 && r3.body.already_open === false);
  const r5 = await r4;
  const r6 = await (async () => { await post(env, { action: 'admin_invite_request_resolve', id: r5.body.request.id, status: 'declined' }, 'user_admin'); return post(env, { action: 'invite_request_create' }); })();
  check('invite: rate limit, 3 requests per user per day -> 429', r5.status === 201 && r6.status === 429 && r6.body.error === 'rate_limited', `${r5.status} ${r6.status}`);
  d1.raw.prepare(`UPDATE invite_requests SET user_id='u'||rowid, status='declined'`).run();
  d1.raw.exec(`INSERT INTO invite_requests (id, user_id, created_at, status) SELECT 'x'||value, 'bulk'||value, '${new Date().toISOString()}', 'declined' FROM (WITH RECURSIVE s(value) AS (SELECT 1 UNION ALL SELECT value+1 FROM s WHERE value<50) SELECT value FROM s)`);
  check('invite: a flood across users (50 in an hour) is refused -> 429', (await post(env, { action: 'invite_request_create' }, 'user_b')).status === 429);
}

console.error = realError;
finish('toolkit-connections-selftest');
