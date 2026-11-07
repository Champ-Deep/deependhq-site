// worker/outbound.js : the toolkit calls the user's own agent (docs/toolkit-v4-api.md section 12).
//   A. their MCP server as one DeepBot tool, agent_call. The user approves each tool as off, read or ask; the
//      approved tools/list is pinned by its SHA-256, and any change turns every tool off until they approve again.
//   B. signed webhooks on staged.created, staged.decided and job.completed. One attempt, logged, manual resend.
// Every request goes through worker/outbound-guard.js. Tokens and webhook secrets are sealed in toolkit_connections
// (worker/connectors.js) and opened only inside the request that uses them; they never reach a log, a stored row in
// clear, an error or any response except webhook_set and webhook_rotate, which return the new secret once.

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { checkOutboundUrl, guardedFetch, OutboundError } from './outbound-guard.js';
import { seal, unseal, maskKey } from './connectors.js';
import * as store from './toolkit-store.js';

export const MCP_LIST_MS = 10000;
export const MCP_CALL_MS = 15000;
export const WEBHOOK_MS = 5000;
export const OUTPUT_MAX = 8000; // the whole result as JSON, so DeepBot's 8000-char tool message clip never cuts it
export const DESC_MAX = 300;
export const EVENTS = ['staged.created', 'staged.decided', 'job.completed'];
const MODES = ['off', 'read', 'ask'];
const MCP_ACCEPT = ['application/json', 'text/event-stream'];
const ARGS_MAX = 16384;
const SCHEMA_MAX = 2000;
const DELIVERIES_KEPT = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const enc = new TextEncoder();
const sha256 = async (s) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const parse = (s) => { try { return JSON.parse(s); } catch { return {}; } };
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
// A short token masked as first 8 + last 4 would show most of it, so those get no visible characters.
const hint = (secret) => (secret.length >= 24 ? maskKey(secret) : '****');
const CTRL = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g;

// Sorted keys at every level: the same tools/list gives the same hash whatever order the server wrote it in.
const canon = (v) => (Array.isArray(v) ? `[${v.map(canon).join(',')}]`
  : isObj(v) ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v ?? null));
export const toolsHash = (tools) => sha256(canon([...tools].map(({ name, description, inputSchema }) => ({ name, description: description ?? '', inputSchema: inputSchema ?? null })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))));

// --- MCP client ---------------------------------------------------------------------
// The SDK's transport takes an injected fetch, so every request it makes (initialize, tools/list, tools/call, the
// legacy GET stream, session close) is a guardedFetch. One deadline covers the whole session.
const codeOf = (e) => { for (let x = e, i = 0; x && i < 6; x = x.cause, i++) if (x instanceof OutboundError) return x.code; return 'agent_failed'; };
async function session(conn, ms, fn) {
  const deadline = Date.now() + ms;
  const client = new Client({ name: 'deependhq-toolkit', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
  const transport = new StreamableHTTPClientTransport(new URL(conn.url), {
    fetch: (u, init) => guardedFetch(String(u), init, { timeoutMs: Math.max(1, deadline - Date.now()), accept: MCP_ACCEPT }),
    ...(conn.token ? { requestInit: { headers: { authorization: `Bearer ${conn.token}` } } } : {}),
  });
  try {
    await client.connect(transport);
    return await fn(client);
  } catch (e) {
    return { error: codeOf(e), message: 'Your agent did not answer that.' }; // the SDK's own message can quote the URL; it is never returned
  } finally {
    client.close().catch(() => {});
  }
}
// shortcut: 5 pages of tools/list at most; raise if someone connects a server with more tools than that.
async function listAll(client) {
  const tools = [];
  let cursor;
  for (let i = 0; i < 5; i++) {
    const r = await client.listTools(cursor ? { cursor } : undefined);
    tools.push(...(Array.isArray(r.tools) ? r.tools : []));
    if (!(cursor = r.nextCursor)) break;
  }
  return { tools, hash: await toolsHash(tools) };
}
const listTools = (conn, ms = MCP_LIST_MS) => session(conn, ms, listAll);
const toolView = (t, modes = {}) => ({ name: clip(t.name, 128), description: clip(t.description, DESC_MAX).replace(CTRL, ''), read_only_hint: t.annotations?.readOnlyHint === true, mode: Object.hasOwn(modes, t.name) ? modes[t.name] : 'off' });

// Text of a tools/call result, control characters stripped, cut so the result serializes to OUTPUT_MAX chars at most
// (escaping makes JSON longer than the text, so the JSON length is measured). Never placed in a system prompt.
function agentOutput(r) {
  const parts = (Array.isArray(r.content) ? r.content : []).map((c) => (c && c.type === 'text' ? String(c.text) : c ? `[${clip(c.type, 20)}]` : ''));
  let text = parts.join('\n');
  if (!text && r.structuredContent !== undefined) text = JSON.stringify(r.structuredContent);
  text = text.replace(CTRL, '');
  const shape = (t) => ({ truncated: t.length < text.length, untrusted_agent_output: t, ...(r.isError ? { is_error: true } : {}) });
  const fits = (n) => JSON.stringify(shape(text.slice(0, n))).length <= OUTPUT_MAX;
  if (fits(text.length)) return shape(text);
  // Binary search for the longest prefix that fits; JSON length only grows with the prefix.
  let lo = 0, hi = Math.min(text.length - 1, OUTPUT_MAX);
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fits(mid)) lo = mid; else hi = mid - 1; }
  return shape(text.slice(0, lo));
}

// --- rows -----------------------------------------------------------------------------
const aad = (uid, provider) => `${uid}:${provider}`;
async function rowOf(db, uid, provider) {
  const row = await db.prepare(`SELECT key_ciphertext, key_hint, label, created_at, meta_json FROM toolkit_connections WHERE user_id=?1 AND provider=?2`).bind(uid, provider).first();
  return row ? { ...row, meta: parse(row.meta_json) } : null;
}
const saveMeta = (db, uid, provider, meta) => db.prepare(`UPDATE toolkit_connections SET meta_json=?3 WHERE user_id=?1 AND provider=?2`).bind(uid, provider, JSON.stringify(meta)).run();
const upsert = async (db, env, uid, provider, secret, label, meta) => db.prepare(`INSERT INTO toolkit_connections (user_id, provider, key_ciphertext, key_hint, label, created_at, meta_json) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  ON CONFLICT (user_id, provider) DO UPDATE SET key_ciphertext=excluded.key_ciphertext, key_hint=excluded.key_hint, label=excluded.label, created_at=excluded.created_at, meta_json=excluded.meta_json`)
  .bind(uid, provider, await seal(env.CONNECTIONS_SECRET, aad(uid, provider), secret), secret ? hint(secret) : '', label, store.nowIso(), JSON.stringify(meta)).run();

// The user's MCP connection with its token opened, or {error}.
async function mcpConn(db, env, uid, id) {
  const row = await rowOf(db, uid, 'agent_mcp');
  if (!row || typeof id !== 'string' || row.meta.id !== id) return { error: 'not_found', message: 'No such agent connection.' };
  if (!env.CONNECTIONS_SECRET) return { error: 'connections_not_configured', message: 'Connections are not switched on yet.' };
  let token;
  try { token = await unseal(env.CONNECTIONS_SECRET, aad(uid, 'agent_mcp'), row.key_ciphertext); } catch { return { error: 'key_unreadable', message: 'The saved token cannot be read. Connect again.' }; }
  return { row, meta: row.meta, url: row.meta.url, token };
}

// --- agent_call (DeepBot) ---------------------------------------------------------------
const NOT_ALLOWED = { error: 'not_allowed', message: 'That tool is not approved on the user\'s agent.' };
const CHANGED = { error: 'not_allowed', message: 'The user\'s agent changed its tools. The user must review them again in My agent.' };
const modeOf = (meta, tool) => (meta.status === 'active' && isObj(meta.modes) && Object.hasOwn(meta.modes, tool) && MODES.includes(meta.modes[tool]) ? meta.modes[tool] : 'off');

// Re-list on the open session; a hash that is not the approved one marks the connection changed and refuses.
async function pinned(db, uid, c, client) {
  const l = await listAll(client);
  if (l.hash === c.meta.approved_hash) return null;
  await saveMeta(db, uid, 'agent_mcp', { ...c.meta, status: 'changed' });
  return CHANGED;
}
const callOn = (db, uid, c, tool, args) => session(c, MCP_CALL_MS, async (client) => (await pinned(db, uid, c, client)) || agentOutput(await client.callTool({ name: tool, arguments: args })));

// Returns {untrusted_agent_output, truncated} (read), {stage: {title, payload}} (ask), or {error}.
export async function agentCall(db, env, uid, a) {
  const args = a.arguments === undefined ? {} : a.arguments;
  if (!isObj(args) || JSON.stringify(args).length > ARGS_MAX) return { error: 'invalid_args', message: `arguments is an object, ${ARGS_MAX / 1024} KB or less as JSON.` };
  const c = await mcpConn(db, env, uid, a.connection_id);
  if (c.error) return c;
  const mode = typeof a.tool === 'string' ? modeOf(c.meta, a.tool) : 'off';
  if (mode === 'off') return c.meta.status === 'changed' ? CHANGED : NOT_ALLOWED;
  if (mode === 'read') return callOn(db, uid, c, a.tool, args);
  const check = await session(c, MCP_LIST_MS, (client) => pinned(db, uid, c, client));
  if (check) return check;
  return { stage: { title: `Call ${clip(a.tool, 64).replace(CTRL, '')} on your agent at ${clip(c.row.label, 80)}`, payload: { connection_id: c.meta.id, tool: a.tool, arguments: args } } };
}

// staged_decide approve of an agent_call item: the same pins, checked again now, then the call.
export async function runStagedCall(db, env, uid, p) {
  const c = await mcpConn(db, env, uid, p.connection_id);
  if (c.error) return c;
  if (modeOf(c.meta, p.tool) === 'off') return c.meta.status === 'changed' ? CHANGED : NOT_ALLOWED;
  return callOn(db, uid, c, p.tool, isObj(p.arguments) ? p.arguments : {});
}

// What DeepBot's catalog shows: approved tools only. Text from the agent is labelled untrusted.
export async function agentCatalog(db, uid) {
  const row = await rowOf(db, uid, 'agent_mcp');
  if (!row) return null;
  const m = row.meta;
  return { connection_id: m.id, status: m.status, tools: m.status === 'active' ? (m.tools || []).map((t) => ({ ...t, mode: modeOf(m, t.name) })).filter((t) => t.mode !== 'off') : [] };
}

// --- webhooks -------------------------------------------------------------------------
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
export const signature = async (secret, t, body) => `t=${t},v1=${await hmacHex(secret, `${t}.${body}`)}`;
const deliveryView = (r) => ({ id: r.id, event_id: r.event_id, event: r.event, status_code: r.status_code, error: r.error, ms: r.ms, ts: r.ts });

// One attempt. The row records the event sent, the status code (or an error code) and the time taken.
async function deliver(db, env, uid, hook, event) {
  const body = JSON.stringify(event);
  const t0 = Date.now();
  let status = null, error = null;
  try {
    const secret = await unseal(env.CONNECTIONS_SECRET, aad(uid, 'agent_webhook'), hook.key_ciphertext);
    const t = Math.floor(Date.now() / 1000);
    const res = await guardedFetch(hook.meta.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-toolkit-signature': await signature(secret, t, body), 'x-toolkit-event': event.type }, body }, { timeoutMs: WEBHOOK_MS, maxBytes: 65536 });
    status = res.status;
  } catch (e) { error = e instanceof OutboundError ? e.code : 'delivery_failed'; }
  const row = { id: crypto.randomUUID(), event_id: event.id, event: event.type, status_code: status, error, ms: Date.now() - t0, ts: store.nowIso() };
  await db.batch([
    db.prepare(`INSERT INTO toolkit_deliveries (id, user_id, event_id, event, body_json, status_code, error, ms, ts) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`).bind(row.id, uid, row.event_id, row.event, body, status, error, row.ms, row.ts),
    db.prepare(`DELETE FROM toolkit_deliveries WHERE user_id=?1 AND id NOT IN (SELECT id FROM toolkit_deliveries WHERE user_id=?1 ORDER BY ts DESC, rowid DESC LIMIT ?2)`).bind(uid, DELIVERIES_KEPT),
  ]);
  return row;
}

export const makeEvent = (type, data) => ({ id: `evt_${crypto.randomUUID()}`, type, created: Math.floor(Date.now() / 1000), data });

// Fire one event at the user's webhook, if they have one for this type, inside ctx.waitUntil. data may be a function
// so it is only computed when a hook exists. No request context (cron, a direct call in a test) means no delivery.
export function emit(db, env, uid, type, data) {
  if (!env || typeof env.waitUntil !== 'function' || !db || !env.CONNECTIONS_SECRET) return;
  env.waitUntil((async () => {
    const hook = await rowOf(db, uid, 'agent_webhook');
    if (!hook || !Array.isArray(hook.meta.events) || !hook.meta.events.includes(type)) return;
    await deliver(db, env, uid, hook, makeEvent(type, typeof data === 'function' ? await data() : data));
  })().catch(() => console.error('toolkit: webhook delivery failed')));
}

// job.completed data: totals over the job's chunks. Ids, counts, status and credits only.
export async function jobCompleted(db, uid, jobId, resultFileId) {
  const runs = (await db.prepare(`SELECT status, row_count, credits_used FROM toolkit_runs WHERE user_id=?1 AND tool_id='data-workbench' AND (job_id=?2 OR id=?2)`).bind(uid, jobId).all()).results;
  const statuses = {};
  for (const r of runs) statuses[r.status] = (statuses[r.status] || 0) + 1;
  const sum = (k) => runs.reduce((n, r) => n + store.num(r[k]), 0);
  return { job_id: jobId, chunks: runs.length, rows: sum('row_count'), credits_used: sum('credits_used'), status: runs.every((r) => r.status === 'completed') ? 'completed' : 'partial', statuses, result_file_id: resultFileId ?? null };
}

// --- session actions ------------------------------------------------------------------
const bad = (error, message, status = 400) => [{ error, message }, status];
const failed = (r) => [{ error: r.error, message: r.message }, ['not_found', 'not_allowed'].includes(r.error) ? 404 : r.error === 'connections_not_configured' ? 503 : 502];
async function urlOk(raw) {
  const chk = await checkOutboundUrl(raw);
  return chk.error ? { error: chk.error, message: 'That URL is not allowed. It must be a public https address on port 443.' } : chk;
}

async function agentConnect(db, env, uid, b) {
  const token = b.token === undefined || b.token === '' ? '' : b.token;
  if (typeof token !== 'string' || token.length > 4096 || /[\s\u0000-\u001f\u007f]/.test(token)) return bad('invalid_token', 'token is text without spaces, 4096 characters or less.');
  const u = await urlOk(b.url);
  if (u.error) return bad(u.error, u.message);
  const l = await listTools({ url: u.url, token });
  if (l.error) return failed(l);
  const meta = { id: crypto.randomUUID(), url: u.url, status: 'pending', seen_hash: l.hash, approved_hash: null, modes: {}, tools: [] };
  await upsert(db, env, uid, 'agent_mcp', token, new URL(u.url).host, meta);
  return [{ connection_id: meta.id, url: u.url, status: 'pending', key_hint: token ? hint(token) : '', tools: l.tools.map((t) => toolView(t)) }, 200];
}

async function agentToolsSet(db, env, uid, b) {
  if (!isObj(b.tools) || Object.values(b.tools).some((m) => !MODES.includes(m))) return bad('invalid_tools', 'tools maps each tool name to off, read or ask.');
  const c = await mcpConn(db, env, uid, b.connection_id);
  if (c.error) return failed(c);
  const l = await listTools(c);
  if (l.error) return failed(l);
  if (l.hash !== c.meta.seen_hash) { // the list moved since the user last saw it: show it again, approve nothing
    await saveMeta(db, uid, 'agent_mcp', { ...c.meta, seen_hash: l.hash, status: c.meta.approved_hash ? 'changed' : c.meta.status });
    return [{ error: 'tools_changed', message: 'Your agent\'s tools changed since you saw them. Review them again.', tools: l.tools.map((t) => toolView(t)) }, 409];
  }
  const unknown = Object.keys(b.tools).find((n) => !l.tools.some((t) => t.name === n));
  if (unknown !== undefined) return bad('unknown_tool', `${clip(unknown, 64)} is not one of your agent's tools.`);
  const modes = Object.fromEntries(l.tools.map((t) => [t.name, Object.hasOwn(b.tools, t.name) ? b.tools[t.name] : 'off']));
  // DeepBot sees these through catalog. A schema that is too big is left out rather than cut into invalid JSON.
  const tools = l.tools.filter((t) => modes[t.name] !== 'off').map((t) => {
    const s = JSON.stringify(t.inputSchema ?? {});
    return { name: t.name, untrusted_description: clip(t.description, DESC_MAX).replace(CTRL, ''), ...(s.length <= SCHEMA_MAX ? { input_schema: t.inputSchema ?? {} } : {}) };
  });
  await saveMeta(db, uid, 'agent_mcp', { ...c.meta, status: 'active', approved_hash: l.hash, modes, tools });
  return [{ connection_id: c.meta.id, status: 'active', tools: l.tools.map((t) => toolView(t, modes)) }, 200];
}

async function agentTest(db, env, uid, b) {
  const c = await mcpConn(db, env, uid, b.connection_id);
  if (c.error) return failed(c);
  const l = await listTools(c);
  if (l.error) return failed(l);
  const changed = !!c.meta.approved_hash && l.hash !== c.meta.approved_hash;
  const status = changed ? 'changed' : c.meta.status;
  await saveMeta(db, uid, 'agent_mcp', { ...c.meta, seen_hash: l.hash, status });
  return [{ ok: true, connection_id: c.meta.id, status, changed, tools: l.tools.map((t) => toolView(t, changed ? {} : c.meta.modes)) }, 200];
}

const newSecret = () => 'whsec_' + b64url(crypto.getRandomValues(new Uint8Array(32)));
async function webhookSet(db, env, uid, b) {
  const ev = b.events;
  if (!Array.isArray(ev) || !ev.length || ev.some((e) => !EVENTS.includes(e)) || new Set(ev).size !== ev.length) return bad('invalid_events', `events is a list from ${EVENTS.join(', ')}.`);
  const u = await urlOk(b.url);
  if (u.error) return bad(u.error, u.message);
  const secret = newSecret();
  const meta = { id: crypto.randomUUID(), url: u.url, events: EVENTS.filter((e) => ev.includes(e)) };
  await upsert(db, env, uid, 'agent_webhook', secret, new URL(u.url).host, meta);
  return [{ webhook_id: meta.id, url: meta.url, events: meta.events, secret, key_hint: hint(secret), note: 'Copy the secret now. It is not shown again.' }, 200];
}

async function webhookRotate(db, env, uid) {
  const hook = await rowOf(db, uid, 'agent_webhook');
  if (!hook) return bad('not_found', 'No webhook is set.', 404);
  const secret = newSecret();
  await db.prepare(`UPDATE toolkit_connections SET key_ciphertext=?3, key_hint=?4 WHERE user_id=?1 AND provider=?2`).bind(uid, 'agent_webhook', await seal(env.CONNECTIONS_SECRET, aad(uid, 'agent_webhook'), secret), hint(secret)).run();
  return [{ webhook_id: hook.meta.id, secret, key_hint: hint(secret), note: 'Copy the secret now. It is not shown again. The old one stopped working.' }, 200];
}

async function webhookResend(db, env, uid, b) {
  const id = String(b.delivery_id ?? '');
  const d = UUID_RE.test(id) ? await db.prepare(`SELECT body_json FROM toolkit_deliveries WHERE id=?1 AND user_id=?2`).bind(id, uid).first() : null;
  if (!d) return bad('not_found', 'No such delivery.', 404);
  const hook = await rowOf(db, uid, 'agent_webhook');
  if (!hook) return bad('not_found', 'No webhook is set.', 404);
  return [{ delivery: deliveryView(await deliver(db, env, uid, hook, parse(d.body_json))) }, 200]; // same event id, so the receiver can dedupe
}

// POST /api/toolkit actions agent_* and webhook_* (session only; no tool and no API key reaches them). Returns [body, status].
export async function handle(action, db, env, uid, b) {
  if (action === 'agent_status') {
    const [m, w] = [await rowOf(db, uid, 'agent_mcp'), await rowOf(db, uid, 'agent_webhook')];
    return [{
      configured: Boolean(env.CONNECTIONS_SECRET),
      mcp: m && { connection_id: m.meta.id, url: m.meta.url, status: m.meta.status, key_hint: m.key_hint, modes: m.meta.modes, connected_at: m.created_at },
      webhook: w && { webhook_id: w.meta.id, url: w.meta.url, events: w.meta.events, key_hint: w.key_hint, created_at: w.created_at },
    }, 200];
  }
  if (action === 'webhook_deliveries') {
    const rows = (await db.prepare(`SELECT * FROM toolkit_deliveries WHERE user_id=?1 ORDER BY ts DESC, rowid DESC LIMIT ?2`).bind(uid, DELIVERIES_KEPT).all()).results;
    return [{ deliveries: rows.map(deliveryView) }, 200];
  }
  if (action === 'agent_disconnect' || action === 'webhook_remove') {
    const provider = action === 'agent_disconnect' ? 'agent_mcp' : 'agent_webhook';
    const row = await rowOf(db, uid, provider);
    if (!row || (provider === 'agent_mcp' && row.meta.id !== b.connection_id)) return bad('not_found', 'Nothing to remove.', 404);
    await db.batch([
      db.prepare(`DELETE FROM toolkit_connections WHERE user_id=?1 AND provider=?2`).bind(uid, provider),
      ...(provider === 'agent_webhook' ? [db.prepare(`DELETE FROM toolkit_deliveries WHERE user_id=?1`).bind(uid)] : []),
    ]);
    return [{ ok: true }, 200];
  }
  if (!env.CONNECTIONS_SECRET) return bad('connections_not_configured', 'Connections are not switched on yet.', 503);
  if (action === 'agent_connect') return agentConnect(db, env, uid, b);
  if (action === 'agent_tools_set') return agentToolsSet(db, env, uid, b);
  if (action === 'agent_test') return agentTest(db, env, uid, b);
  if (action === 'webhook_set') return webhookSet(db, env, uid, b);
  if (action === 'webhook_rotate') return webhookRotate(db, env, uid);
  if (action === 'webhook_resend') return webhookResend(db, env, uid, b);
  return [{ error: 'unknown_action' }, 400];
}
