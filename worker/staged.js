// worker/staged.js : staged items and the human gate (docs/toolkit-v4-api.md section 10).
// One table, toolkit_staged, for DeepBot, a user's own agent (card B) and connector acts. A staged item does
// nothing on its own. Only staged_decide, a Clerk-session action, approves or rejects it; no agent tool reaches it.
// title is always written here or by the caller's server code from the payload, never from model or agent text.

import * as store from './toolkit-store.js';
import * as files from './toolkit-files.js';
import * as outbound from './outbound.js';

export const MAX_PENDING = 50;
export const STAGED_DAYS = 7;
export const NOTE_MAX = 280;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_STATUS = ['pending', 'approved', 'rejected', 'expired', 'all'];
const parse = (s) => { try { return s == null ? null : JSON.parse(s); } catch { return null; } };

export const approveUrl = (env, id) => `https://${(env && env.TOOLKIT_HOST) || 'toolkit.deependhq.com'}/#approvals/${id}`;

// Insert one pending item. The cap is checked inside the INSERT, so two parallel stages cannot pass 50 together.
export async function stageItem(db, env, { uid, kind, source, title, payload, note }) {
  if (note !== undefined && (typeof note !== 'string' || note.length > NOTE_MAX)) return { error: 'invalid_note', message: `note is text, ${NOTE_MAX} characters or less.` };
  const id = crypto.randomUUID(), now = new Date();
  const created = store.nowIso(now), expires = store.nowIso(new Date(now.getTime() + STAGED_DAYS * 86400000));
  const r = await db.prepare(`INSERT INTO toolkit_staged (id, user_id, kind, source, title, payload_json, note, status, created_at, expires_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9
    WHERE (SELECT COUNT(*) FROM toolkit_staged WHERE user_id=?2 AND status='pending' AND expires_at > ?8) < ?10`)
    .bind(id, uid, kind, source, title, JSON.stringify(payload), note ?? '', created, expires, MAX_PENDING).run();
  if (r.meta.changes !== 1) return { error: 'too_many_staged', message: `${MAX_PENDING} items are already waiting for approval. Approve or reject some first.`, http_status: 429 };
  outbound.emit(db, env, uid, 'staged.created', { staged_id: id, kind, source, status: 'pending', expires_at: expires });
  return { staged_id: id, status: 'pending_approval', kind, title, approve_url: approveUrl(env, id), expires_at: expires };
}

const view = (env, r, now) => ({
  id: r.id, kind: r.kind, source: r.source, title: r.title, note: r.note, status: r.status,
  expired: r.status === 'pending' && r.expires_at < now,
  payload: parse(r.payload_json), result: parse(r.result_json),
  created_at: r.created_at, decided_at: r.decided_at, expires_at: r.expires_at, approve_url: approveUrl(env, r.id),
});
const byId = (db, uid, id) => (UUID_RE.test(String(id)) ? db.prepare(`SELECT * FROM toolkit_staged WHERE id=?1 AND user_id=?2`).bind(String(id), uid).first() : null);

export async function listStaged(db, env, uid, status = 'pending') {
  if (!LIST_STATUS.includes(status)) return { error: 'invalid_status', message: `status is one of ${LIST_STATUS.join(', ')}.` };
  const now = store.nowIso();
  const where = { pending: `AND status='pending' AND expires_at >= ?2`, expired: `AND status='pending' AND expires_at < ?2`, approved: `AND status='approved'`, rejected: `AND status='rejected'`, all: '' }[status];
  const rows = (await db.prepare(`SELECT * FROM toolkit_staged WHERE user_id=?1 ${where} ORDER BY created_at DESC, id LIMIT 50`).bind(uid, ...(where.includes('?2') ? [now] : [])).all()).results;
  return { items: rows.map((r) => view(env, r, now)) };
}

// Another user's id and a malformed id look the same as a missing one.
export async function getStaged(db, env, uid, id) {
  const row = await byId(db, uid, id);
  return row ? { item: view(env, row, store.nowIso()) } : { error: 'not_found', message: 'No such staged item.', http_status: 404 };
}

// staged_decide. Returns [body, status]. The server never runs a Workbench job: a run is approved by the browser
// after the user pressed Run, with the job_id that run produced. hooks.connector(id) is the connector approve of section 9.
export async function decide(db, env, uid, body, hooks) {
  if (!['approve', 'reject'].includes(body.decision)) return [{ error: 'invalid_decision', message: 'decision is approve or reject.' }, 400];
  const row = await byId(db, uid, body.id);
  if (!row) return [{ error: 'not_found' }, 404];
  const reread = async () => ({ item: view(env, await byId(db, uid, row.id), store.nowIso()) });
  if (row.kind === 'connector_act' && body.decision === 'approve') { // its own claim, expiry and failure handling
    const [b, s] = await hooks.connector(row.id);
    return s === 200 ? [await reread(), 200] : [b, s];
  }
  if (row.status !== 'pending') return [{ error: 'not_pending', status: row.status }, 409];
  const now = store.nowIso();
  if (row.expires_at < now) return [{ error: 'expired', message: 'This expired. Stage it again.' }, 410];
  const finish = async (status, result, from = 'pending') => {
    const r = await db.prepare(`UPDATE toolkit_staged SET status=?3, result_json=?4, decided_at=?5 WHERE id=?1 AND user_id=?2 AND status=?6`)
      .bind(row.id, uid, status, result === undefined ? null : JSON.stringify(result), store.nowIso(), from).run();
    if (r.meta.changes === 1) outbound.emit(db, env, uid, 'staged.decided', { staged_id: row.id, kind: row.kind, status });
    return r.meta.changes === 1;
  };
  if (body.decision === 'reject') return (await finish('rejected')) ? [await reread(), 200] : [{ error: 'not_pending' }, 409];

  const payload = parse(row.payload_json) || {};
  if (row.kind === 'run') {
    const jobId = String(body.job_id ?? '');
    const ran = UUID_RE.test(jobId) && await db.prepare(`SELECT id FROM toolkit_runs WHERE user_id=?1 AND tool_id='data-workbench' AND (job_id=?2 OR id=?2) LIMIT 1`).bind(uid, jobId.toLowerCase()).first();
    if (!ran) return [{ error: 'invalid_job_id', message: 'Approve a staged run with the job_id of the run you started from it.' }, 400];
    return (await finish('approved', { job_id: jobId.toLowerCase() })) ? [await reread(), 200] : [{ error: 'not_pending' }, 409];
  }
  if (row.kind === 'files_move' || row.kind === 'agent_call') {
    if (row.kind === 'files_move' && !env.TOOLKIT_FILES) return [{ error: 'files_not_configured' }, 503];
    // Claim first so a double click moves (or calls the agent) once.
    const claim = await db.prepare(`UPDATE toolkit_staged SET status='approving' WHERE id=?1 AND user_id=?2 AND status='pending'`).bind(row.id, uid).run();
    if (claim.meta.changes !== 1) return [{ error: 'not_pending' }, 409];
    if (row.kind === 'agent_call') { // the user's agent, under this session; the tool pins are checked again now
      const out = await outbound.runStagedCall(db, env, uid, payload);
      await finish(out.error ? 'failed' : 'approved', out, 'approving');
      return out.error ? [{ error: out.error, message: out.message, ...(await reread()) }, 502] : [await reread(), 200];
    }
    const move = { id: payload.id, ...(payload.folder !== undefined ? { folder: payload.folder } : {}), ...(payload.name !== undefined ? { name: payload.name } : {}) };
    try {
      const out = await files.filesAction('files_move', db, env.TOOLKIT_FILES, uid, move);
      await finish('approved', out, 'approving');
      return [await reread(), 200];
    } catch (e) {
      const err = e instanceof files.FileError ? { error: e.error, message: e.message } : { error: 'move_failed', message: 'The move could not be done.' };
      if (!(e instanceof files.FileError)) console.error('toolkit: staged move failed:', e && e.message);
      await finish('failed', err, 'approving');
      return [{ ...err, ...(await reread()) }, e instanceof files.FileError ? e.status : 500];
    }
  }
  return [{ error: 'unsupported_kind', message: `${row.kind} items cannot be approved yet.` }, 400];
}

// POST /api/toolkit actions staged_list, staged_get, staged_decide (session only). Returns [body, status].
export async function handle(action, db, env, uid, body, hooks) {
  const strip = ({ http_status, ...b }) => [b, http_status || (b.error ? 400 : 200)];
  if (action === 'staged_list') return strip(await listStaged(db, env, uid, body.status));
  if (action === 'staged_get') return strip(await getStaged(db, env, uid, body.id));
  if (action === 'staged_decide') return decide(db, env, uid, body, hooks);
  return [{ error: 'unknown_action' }, 400];
}
