// worker/agent-api.js : the inbound agent API (docs/toolkit-v4-api.md section 11).
// A user's own agent calls the toolkit with a dhk_live_ API key, over MCP (Streamable HTTP, stateless, JSON responses)
// or as OpenAI function tools. Every tool is a REGISTRY entry (worker/deepbot-core.js) with inbound: true, run by the
// handler worker/deepbot-tools.js makes for it. Nothing is defined twice here.
//
//   POST /api/toolkit/mcp            MCP tools/list, tools/call (plus initialize, ping and discovery, from the SDK)
//   GET  /api/toolkit/v1/tools       {tools: [{type: 'function', function: {name, description, parameters}}]}
//   POST /api/toolkit/v1/tools/call  {name, arguments} -> {result} or {error, message}
//   GET  /api/toolkit/v1/files/<id>  file bytes (files:read)
//
// Keys are created, listed and revoked only by Clerk-session actions on POST /api/toolkit (keyAction below).
// Stored as sha256 hex, never as text. toolkit_api_calls gets the tool name and outcome, never arguments or results.

import { Server, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { REGISTRY } from './deepbot-core.js';
import { makeToolHandlers } from './deepbot-tools.js';
import * as files from './toolkit-files.js';
import * as store from './toolkit-store.js';
import { json, sha256Hex } from './toolkit.js';

export const SCOPES = ['files:read', 'files:write', 'jobs:read', 'jobs:plan', 'jobs:stage', 'connections:read', 'connections:stage'];
export const MAX_KEYS = 5;
const KEY_PREFIX = 'dhk_live_';
const BEARER_RE = /^Bearer (dhk_live_[A-Za-z0-9_-]{43})$/;
const LABEL_MAX = 40;

// Keys get bigger files_save limits than DeepBot (deepbot-tools.js enforces them by source); the schema says so.
const FILES_SAVE_KEY = {
  description: 'Save a new file. Never overwrites: a taken name gets a number. Send content (UTF-8 text of a csv, txt, md or json file, 1 MB or less) or content_base64 (a csv, xlsx, json, txt, md or pdf file, 10 MB or less).',
  extra: { content: { type: 'string', description: 'UTF-8 text, 1 MB or less.' }, content_base64: { type: 'string', description: 'Base64 of the file bytes, 10 MB or less.' } },
};
export const INBOUND = REGISTRY.filter((t) => t.inbound).map((t) => (t.name !== 'files_save' ? t : {
  ...t, description: FILES_SAVE_KEY.description,
  parameters: { ...t.parameters, properties: { ...t.parameters.properties, ...FILES_SAVE_KEY.extra }, required: ['name'] },
}));
// A tool outside the key's scopes does not exist for that key: absent from both lists, and a call on it is unknown_tool.
export const toolsFor = (scopes) => INBOUND.filter((t) => !t.scope || scopes.includes(t.scope));
const annotations = (t) => ({ readOnlyHint: t.cls === 'read', ...(t.cls === 'read' ? {} : { destructiveHint: false }), openWorldHint: t.name.startsWith('connector_') });

// The method each agent path takes, or null when the path is not one of them.
export const agentMethod = (p) =>
  p === '/api/toolkit/mcp' || p === '/api/toolkit/v1/tools/call' ? 'POST'
    : p === '/api/toolkit/v1/tools' || p.startsWith('/api/toolkit/v1/files/') ? 'GET' : null;

// Top-level check of arguments against the registry's JSON Schema (each handler checks the values it uses).
const TYPES = { string: (v) => typeof v === 'string', integer: Number.isSafeInteger, array: Array.isArray, object: (v) => !!v && typeof v === 'object' && !Array.isArray(v) };
const TYPE_NAMES = { string: 'text', integer: 'a whole number', array: 'a list', object: 'an object' };
function badArgs(schema, a) {
  if (!TYPES.object(a)) return 'arguments is an object.';
  const unknown = Object.keys(a).find((k) => !Object.hasOwn(schema.properties, k));
  if (unknown !== undefined) return `${unknown.slice(0, 40)} is not an argument of this tool.`;
  const missing = schema.required.find((k) => a[k] === undefined);
  if (missing) return `${missing} is required.`;
  for (const [k, v] of Object.entries(a)) {
    const p = schema.properties[k];
    if (p.type && !TYPES[p.type](v)) return `${k} is ${TYPE_NAMES[p.type]}.`;
    if (p.enum && !p.enum.includes(v)) return `${k} is one of ${p.enum.join(', ')}.`;
    if (p.minimum !== undefined && v < p.minimum) return `${k} is ${p.minimum} or more.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// auth: hash lookup (no cache, so a revoke is immediate), daily cap, burst limit
// ---------------------------------------------------------------------------
export async function authKey(request, env, db) {
  const m = BEARER_RE.exec(request.headers.get('authorization') || '');
  if (!m) return { error: 'unauthorized', message: 'Send Authorization: Bearer dhk_live_...', status: 401 };
  const row = await db.prepare(`SELECT id, user_id, scopes, revoked_at FROM toolkit_api_keys WHERE key_hash=?1`).bind(await sha256Hex(m[1])).first();
  if (!row || row.revoked_at) return { error: 'unauthorized', message: 'This key is not valid.', status: 401 };
  const perDay = (await store.readSettings(db)).api_daily_calls_per_key;
  if (perDay <= 0) return { error: 'api_disabled', message: 'The agent API is switched off.', status: 403 };
  const today = await db.prepare(`SELECT COUNT(*) AS n FROM toolkit_api_calls WHERE key_id=?1 AND ts>=?2`).bind(row.id, store.utcDayStart()).first();
  if (store.num(today && today.n) >= perDay) return { error: 'daily_limit', message: `This key has used its ${perDay} calls for today (UTC).`, status: 429 };
  // Cloudflare's counters are per location, so this is a burst guard, not a quota. No binding (local tests) = no burst limit.
  if (env.AGENT_API_RL && !(await env.AGENT_API_RL.limit({ key: row.id })).success) return { error: 'rate_limited', message: 'Too many calls. Wait a minute.', status: 429, retryAfter: 60 };
  let scopes = [];
  try { scopes = JSON.parse(row.scopes); } catch { /* no scopes */ }
  return { key: { id: row.id, user_id: row.user_id, scopes: Array.isArray(scopes) ? scopes : [] } };
}

export function authError(auth) {
  const r = json({ error: auth.error, message: auth.message }, auth.status);
  if (auth.retryAfter) r.headers.set('retry-after', String(auth.retryAfter));
  return r;
}

// ---------------------------------------------------------------------------
// one tool call, shared by MCP tools/call and /v1/tools/call
// ---------------------------------------------------------------------------
async function callTool(db, env, key, name, args) {
  const tool = typeof name === 'string' ? toolsFor(key.scopes).find((t) => t.name === name) : null;
  if (!tool) return { tool: 'unknown', cost: 0, status: 404, body: { error: 'unknown_tool', message: 'No such tool.' } };
  const bad = badArgs(tool.parameters, args);
  if (bad) return { tool: name, cost: 0, status: 400, body: { error: 'bad_arguments', message: bad } };
  const out = {};
  let r;
  try {
    r = await makeToolHandlers({ db, env, uid: key.user_id, source: `key:${key.id}`, out })[name](args);
  } catch (e) {
    if (e instanceof files.FileError) r = { error: e.error, message: e.message, http_status: e.status };
    else { console.error('toolkit: agent tool failed:', name); r = { error: 'tool_failed', message: 'The tool failed. Try again.', http_status: 500 }; }
  }
  r = r && r.result ? r.result : r; // {result, log}: log is for ai_log only
  const cost = out.cost_micro || 0;
  if (r && r.error) return { tool: name, cost, status: r.http_status || 400, body: { error: r.error, message: r.message || r.error } };
  return { tool: name, cost, status: 200, body: { result: r } };
}

async function mcp(request, db, env, key) {
  const rec = { tool: 'mcp', status: 'ok', cost: 0 };
  const msg = await request.clone().json().catch(() => null);
  if (msg && typeof msg.method === 'string' && /^[a-z]+(\/[A-Za-z_]+){0,3}$/.test(msg.method) && msg.method.length <= 40) rec.tool = 'mcp:' + msg.method;
  const tools = toolsFor(key.scopes);
  const server = new Server({ name: 'deependhq-toolkit', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler('tools/list', async () => ({
    tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.parameters, annotations: annotations(t) })),
  }));
  server.setRequestHandler('tools/call', async (req) => {
    const c = await callTool(db, env, key, req.params.name, req.params.arguments ?? {});
    Object.assign(rec, { tool: c.tool, cost: c.cost, status: c.status === 200 ? 'ok' : 'error' });
    if (c.status !== 200) return { content: [{ type: 'text', text: JSON.stringify(c.body) }], isError: true };
    return { content: [{ type: 'text', text: JSON.stringify(c.body.result) }], structuredContent: c.body.result };
  });
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const res = await transport.handleRequest(request);
  res.headers.set('cache-control', 'no-store'); // same headers as every other toolkit answer, and still no CORS
  res.headers.set('x-content-type-options', 'nosniff');
  if (res.status >= 400) rec.status = 'error';
  return { res, rec };
}

// After authKey passed. One toolkit_api_calls row and a last_used_at update per authenticated request.
export async function handleAgent(request, env, url, key, db) {
  const p = url.pathname;
  let res, rec = { tool: p.slice('/api/toolkit/'.length).split('/').slice(0, 2).join('/'), status: 'ok', cost: 0 };
  if (p === '/api/toolkit/mcp') ({ res, rec } = await mcp(request, db, env, key));
  else if (p === '/api/toolkit/v1/tools') {
    res = json({ tools: toolsFor(key.scopes).map(({ name, description, parameters }) => ({ type: 'function', function: { name, description, parameters } })) });
  } else if (p === '/api/toolkit/v1/tools/call') {
    const b = await request.json().catch(() => null);
    if (!b || typeof b !== 'object' || Array.isArray(b)) { res = json({ error: 'bad_json', message: 'Send {"name", "arguments"}.' }, 400); rec.status = 'error'; }
    else {
      const c = await callTool(db, env, key, b.name, b.arguments ?? {});
      res = json(c.body, c.status);
      rec = { tool: c.tool, status: c.status === 200 ? 'ok' : 'error', cost: c.cost };
    }
  } else if (!env.TOOLKIT_FILES) { res = json({ error: 'files_not_configured', message: 'File storage is not configured.' }, 503); rec.status = 'error'; }
  else {
    const found = key.scopes.includes('files:read') && await files.downloadFile(db, env.TOOLKIT_FILES, key.user_id, p.slice('/api/toolkit/v1/files/'.length));
    res = found || json({ error: 'not_found', message: 'No such file.' }, 404);
    if (!found) rec.status = 'error';
  }
  const now = store.nowIso();
  try {
    await db.batch([
      db.prepare(`INSERT INTO toolkit_api_calls (key_id, user_id, tool, status, cost_micro, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`).bind(key.id, key.user_id, rec.tool, rec.status, rec.cost, now),
      db.prepare(`UPDATE toolkit_api_keys SET last_used_at=?2 WHERE id=?1`).bind(key.id, now),
    ]);
  } catch { console.error('toolkit: agent call log failed'); } // the caller still gets its answer
  return res;
}

// ---------------------------------------------------------------------------
// key management: Clerk-session actions on POST /api/toolkit only. Returns [body, status].
// admin() is isAdmin for this user, called only when the open setting is off.
// ---------------------------------------------------------------------------
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const keyView = (r) => ({ id: r.id, label: r.label, prefix: r.prefix, scopes: JSON.parse(r.scopes), created_at: r.created_at, last_used_at: r.last_used_at });

export async function keyAction(action, db, uid, body, admin) {
  const open = async () => (await store.readSettings(db)).api_keys_open === 1 || await admin();
  if (action === 'api_keys_list') {
    const rows = (await db.prepare(`SELECT * FROM toolkit_api_keys WHERE user_id=?1 AND revoked_at IS NULL ORDER BY created_at DESC, id`).bind(uid).all()).results;
    return [{ keys: rows.map(keyView), open: await open() }, 200];
  }
  if (action === 'api_key_revoke') {
    const r = await db.prepare(`UPDATE toolkit_api_keys SET revoked_at=?3 WHERE id=?1 AND user_id=?2 AND revoked_at IS NULL`).bind(String(body.id ?? ''), uid, store.nowIso()).run();
    return r.meta.changes === 1 ? [{ ok: true }, 200] : [{ error: 'not_found', message: 'No such key.' }, 404];
  }
  // api_key_create
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label || label.length > LABEL_MAX || /[\u0000-\u001f\u007f]/.test(label)) return [{ error: 'invalid_label', message: `label is 1 to ${LABEL_MAX} characters.` }, 400];
  const asked = body.scopes;
  if (!Array.isArray(asked) || !asked.length || asked.some((s) => !SCOPES.includes(s)) || new Set(asked).size !== asked.length) return [{ error: 'invalid_scopes', message: `scopes is a list from ${SCOPES.join(', ')}.` }, 400];
  if (!(await open())) return [{ error: 'api_keys_closed', message: 'API keys are not open yet.' }, 403];
  const scopes = SCOPES.filter((s) => asked.includes(s));
  const key = KEY_PREFIX + b64url(crypto.getRandomValues(new Uint8Array(32)));
  const id = crypto.randomUUID(), prefix = key.slice(0, 16);
  const r = await db.prepare(`INSERT INTO toolkit_api_keys (id, user_id, label, prefix, key_hash, scopes, created_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7 WHERE (SELECT COUNT(*) FROM toolkit_api_keys WHERE user_id=?2 AND revoked_at IS NULL) < ?8`)
    .bind(id, uid, label, prefix, await sha256Hex(key), JSON.stringify(scopes), store.nowIso(), MAX_KEYS).run();
  if (r.meta.changes !== 1) return [{ error: 'too_many_keys', message: `${MAX_KEYS} keys are active. Revoke one first.` }, 409];
  return [{ key, id, label, prefix, scopes }, 200]; // the only response that ever carries the key
}
