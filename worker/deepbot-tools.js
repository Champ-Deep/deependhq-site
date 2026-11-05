// worker/deepbot-tools.js : one handler per REGISTRY name (worker/deepbot-core.js, docs/toolkit-v4-api.md sections 8 and 10).
// Used by DeepBot's loop and, from card B, by the inbound agent API. Every handler is scoped to `uid`.
// No handler reaches the run action, files_delete or staged_decide: spend, deletion and approval stay human clicks.
//   source  'deepbot' or 'key:<key id>', recorded on staged items
//   targets the page's registered ids, for page_steps
//   out     {steps, cards, asks, seen}: what DeepBot shows the page, and the cell text the model saw (redacted from storage)
// A handler returns a plain result, or {result, log} where log replaces fields in ai_log. Files errors throw files.FileError.

import * as store from './toolkit-store.js';
import * as files from './toolkit-files.js';
import * as staged from './staged.js';
import { parseCsv } from '../toolkit-lib.js';
import { validateSteps } from './deepbot-core.js';
import { GUIDE_STAGES, readCsvFile, readRawFile, actionIntake, actionQuoteColumns, catalogFor, connPull, connStage, runResponse } from './toolkit.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
// Every string inside a run's results, for redaction (numbers stay: redacting "100" would garble credit counts in the reply).
const leaves = (v) => (v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : typeof v === 'string' ? [v] : []);
const TEXT_TYPES = ['text/csv', 'text/plain', 'text/markdown', 'application/json'];
export const READ_PAGE = 65536;
// DeepBot gets each tool result clipped to 8,000 characters (toolkit.js), so its pages are smaller than an API caller's.
const DEEPBOT_READ_PAGE = 4096;
export const SAVE_MAX = 65536; // DeepBot
export const KEY_SAVE_MAX = 1024 * 1024; // an API key's text content; content_base64 takes the 10 MB file limit
const viaAction = async (res) => { const j = await res.json(); return res.status === 200 ? j : { error: j.error, message: j.message }; };

export function makeToolHandlers({ db, env, uid, source, targets = [], out = {} }) {
  out.steps ??= []; out.cards ??= []; out.asks ??= []; out.seen ??= [];
  const bucket = env.TOOLKIT_FILES;
  const readCsv = (id) => readCsvFile(db, env, uid, id);
  // The quote action on a file's rows. {t, j} or an error.
  const quoteOf = async (fileId, plan) => {
    const t = await readCsv(fileId);
    if (t.error) return t;
    const j = await viaAction(await actionQuoteColumns(db, uid, { rows: t.rows, columns: plan }));
    return j.error ? j : { t, j };
  };

  return {
    async catalog() { return catalogFor(db, uid); },
    async files_list(a) {
      if (!bucket) return { error: 'files_not_configured' };
      const r = await files.filesAction('files_list', db, bucket, uid, { folder: typeof a.folder === 'string' ? a.folder : '/' });
      return { entries: r.entries.slice(0, 100).map(({ id, kind, name, path, size }) => ({ id, kind, name, path, size })) };
    },
    async file_peek(a) {
      const t = await readCsv(a.id);
      if (t.error) return t;
      const headers = t.headers.slice(0, 40);
      const sample_rows = t.rows.slice(0, 5).map((r) => Object.fromEntries(headers.map((h) => [h, clip(r[h], 60)])));
      out.seen.push(...sample_rows.flatMap((r) => Object.values(r)));
      return { result: { id: a.id, name: t.name, rows: t.rows.length, columns: t.headers.length, headers, sample_rows }, log: { sample_rows: '[value]' } };
    },
    async file_read(a) {
      const f = await readRawFile(db, env, uid, a.id);
      if (f.error) return f;
      if (!TEXT_TYPES.includes(f.mime)) return { error: 'unsupported_type', message: 'file_read reads csv, txt, md and json files.' };
      const bytes = new Uint8Array(f.bytes);
      const offset = a.offset ?? 0;
      if (!Number.isSafeInteger(offset) || offset < 0 || offset > bytes.length) return { error: 'invalid_offset', message: `offset is 0 to ${bytes.length}.` };
      // Page on UTF-8 character boundaries: skip continuation bytes (10xxxxxx) at both ends.
      let start = offset;
      while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start++;
      let end = Math.min(bytes.length, start + (source === 'deepbot' ? DEEPBOT_READ_PAGE : READ_PAGE));
      while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80) end--;
      const text = new TextDecoder().decode(bytes.subarray(start, end));
      out.seen.push(...text.split(/[\r\n,]+/)); // text lines and naive cells the model saw are redacted from turns and ai_log
      if (f.mime === 'text/csv') { const t = parseCsv(text); out.seen.push(...t.headers, ...t.rows.flatMap(Object.values)); } // quoted cells like "Doe, X"
      return { result: { id: a.id, name: f.name, size: bytes.length, offset: start, next_offset: end < bytes.length ? end : null, untrusted_file_text: text }, log: { untrusted_file_text: '[file text]' } };
    },
    async account_usage() { // read only: actionUsage writes (account row, welcome grant, email)
      const dayStart = store.utcDayStart();
      const settings = await store.readSettings(db);
      const agg = await store.getUserAggregate(db, uid, dayStart);
      const n = (k) => store.num(agg?.[k]);
      return {
        usage: {
          day: store.utcDay(), credits_available: n('credits_available'), credits_held: n('credits_held'), credits_used: n('credits_used'),
          spent_micro: n('spent_micro'), held_micro: n('held_micro'), rows: n('rows'),
          daily_credit_cap: agg?.daily_credit_cap == null ? settings.default_daily_credit_cap : n('daily_credit_cap'),
          daily_row_cap: agg?.daily_row_cap == null ? settings.default_daily_row_cap : n('daily_row_cap'),
          disabled: n('disabled'),
        },
        runs: await store.listRuns(db, uid, dayStart, 30),
      };
    },
    async run_detail(a) { // owner only, like the run_detail action
      const id = clip(a.id, 64);
      if (!UUID_RE.test(id)) return { error: 'bad_run_id' };
      const run = await store.getRunForOwner(db, id, uid);
      if (!run) return { error: 'not_found' };
      const body = runResponse(run, await store.listOps(db, run.id));
      out.seen.push(...leaves(body.results)); // enriched values the model saw are redacted from turns and ai_log
      return { result: body, log: { results: '[results]' } };
    },
    async report_summary(a) { // totals from the run ledger; shortcut: no per-column review counts, add them when the report JSON is stable
      const id = String(a.job_id);
      if (!UUID_RE.test(id)) return { error: 'bad_job_id' };
      const runs = (await db.prepare(`SELECT status, row_count, credits_used, spent_micro FROM toolkit_runs WHERE user_id=?1 AND tool_id='data-workbench' AND (job_id=?2 OR id=?2)`).bind(uid, id).all()).results;
      if (!runs.length) return { error: 'not_found' };
      const sum = (k) => runs.reduce((n, r) => n + store.num(r[k]), 0);
      const statuses = {};
      for (const r of runs) statuses[r.status] = (statuses[r.status] || 0) + 1;
      const data = { job_id: id, chunks: runs.length, rows: sum('row_count'), credits_used: sum('credits_used'), spent_micro: sum('spent_micro'), statuses };
      out.cards.push({ kind: 'report', data });
      return data;
    },
    async staged_list(a) { return staged.listStaged(db, env, uid, a.status); },
    async staged_get(a) { return staged.getStaged(db, env, uid, a.id); },
    async intake_plan(a) { // the existing intake action: it reserves and settles its own small charge
      const t = await readCsv(a.file_id);
      if (t.error) return t;
      const samples = Object.fromEntries(t.headers.map((h) => [h, t.rows.slice(0, 5).map((r) => clip(r[h], 200))]));
      out.seen.push(...Object.values(samples).flat());
      const j = await viaAction(await actionIntake(db, env, uid, { file: { name: t.name, rows_total: t.rows.length, headers: t.headers, samples }, goal: clip(a.goal, 2000) }, { source }));
      if (j.error) return j;
      out.cost_micro = (out.cost_micro ?? 0) + (j.cost_micro ?? 0); // the agent API's call log
      out.cards.push({ kind: 'plan', data: { file_id: a.file_id, mapping: j.mapping, plan: j.plan } });
      if (j.question) out.asks.push({ id: `q${out.asks.length + 1}`, question: j.question, options: j.chips });
      return { reply: j.reply, question: j.question, mapping: j.mapping, plan: j.plan, chips: j.chips };
    },
    async quote(a) { // prices only
      const q = await quoteOf(a.file_id, a.plan);
      if (q.error) return q;
      out.cards.push({ kind: 'quote', data: { file_id: a.file_id, plan: a.plan, ...q.j } });
      const { row_count, max_cost_micro, max_credits, can_run, reason, message } = q.j;
      return { row_count, max_cost_micro, max_credits, can_run, reason, message, note: 'A quote card was shown. The user presses Run.' };
    },
    async files_mkdir(a) {
      if (!bucket) return { error: 'files_not_configured' };
      return files.filesAction('files_mkdir', db, bucket, uid, { path: a.path });
    },
    async files_save(a) { // a new file only: saveFile picks a free name, nothing is overwritten
      if (!bucket) return { error: 'files_not_configured' };
      // An API key may save text up to 1 MB, or any allowed file type as content_base64 up to the 10 MB file limit.
      const keyed = String(source).startsWith('key:');
      const b64 = keyed && a.content_base64 !== undefined;
      if (keyed && b64 === (a.content !== undefined)) return { error: 'bad_content', message: 'Send exactly one of content or content_base64.' };
      if (!b64 && typeof a.content !== 'string') return { error: 'bad_content', message: 'content is text.' };
      const max = keyed ? KEY_SAVE_MAX : SAVE_MAX;
      const bytes = b64 ? files.decodeBase64(a.content_base64) : new TextEncoder().encode(a.content);
      if (!b64 && bytes.length > max) return { error: 'file_too_large', message: `content is ${max / 1024} KB or less.` };
      const name = files.checkName(a.name);
      const mime = files.checkType(name, '', bytes);
      if (!b64 && !TEXT_TYPES.includes(mime)) return { error: 'bad_type', message: 'files_save writes csv, txt, md and json files.' };
      const entry = await files.saveFile(db, bucket, uid, { folder: a.folder ?? '/', name, mime, bytes });
      return { entry, ...(entry.name !== name ? { note: `${name} was taken, so it was saved as ${entry.name}.` } : {}) };
    },
    async stage_run(a) { // quote, then a pending row. Never the run action: the user approves it and presses Run.
      const q = await quoteOf(a.file_id, a.plan);
      if (q.error) return q;
      const { row_count, max_credits, can_run } = q.j;
      const n = a.plan.length;
      const s = await staged.stageItem(db, env, {
        uid, kind: 'run', source, note: a.note,
        title: `Run ${n} operation${n === 1 ? '' : 's'} on ${q.t.name}, up to ${max_credits} credits`,
        payload: { file_id: a.file_id, plan: a.plan, quote: { row_count, max_credits, can_run } },
      });
      if (s.error) return s;
      out.cards.push({ kind: 'staged', data: s });
      return { ...s, can_run, note: 'Staged, not run. The user approves it in Approvals and presses Run. Never say it ran.' };
    },
    async stage_files_move(a) {
      if (a.folder === undefined && a.name === undefined) return { error: 'invalid_move', message: 'Give a folder, a name or both.' };
      const row = UUID_RE.test(String(a.id)) ? await db.prepare(`SELECT id, path, parent, name FROM files WHERE user_id=?1 AND id=?2`).bind(uid, String(a.id)).first() : null;
      if (!row) return { error: 'not_found', message: 'No such file or folder.' };
      const folder = a.folder === undefined ? row.parent : files.normPath(a.folder);
      const name = a.name === undefined ? row.name : files.checkName(a.name);
      const to = (folder === '/' ? '' : folder) + '/' + name;
      if (to === row.path) return { error: 'invalid_move', message: 'That is where it already is.' };
      const s = await staged.stageItem(db, env, {
        uid, kind: 'files_move', source, note: a.note,
        title: folder === row.parent ? `Rename ${row.path} to ${name}` : `Move ${row.path} to ${to}`,
        payload: { id: row.id, ...(a.folder !== undefined ? { folder } : {}), ...(a.name !== undefined ? { name } : {}), from: row.path, to },
      });
      if (s.error) return s;
      out.cards.push({ kind: 'staged', data: s });
      return { ...s, note: 'Staged, not moved. The user approves it in Approvals. Never say it moved.' };
    },
    async connector_pull(a) { // pulled rows are the user's own work data: the model sees them, ai_log does not
      const r = await connPull(db, env, uid, a);
      return r.error ? r : { result: { provider: r.provider, op: r.op, data: r.data }, log: { data: '[connector data]' } };
    },
    async connector_act(a) { // stages only (a toolkit_staged row). The user approves it in the window; no tool executes it.
      const r = await connStage(db, env, uid, a, source);
      if (r.error) return r;
      out.cards.push({ kind: 'staged', data: r });
      return { staged_id: r.staged_id, preview: r.preview, approve_url: r.approve_url, note: 'Staged, not done. The user approves it in the window. Never say it has happened.' };
    },
    async page_steps(a) {
      const v = validateSteps(a.steps, { targets, stages: GUIDE_STAGES });
      if (v.error) return v;
      out.steps = v.steps;
      return { ok: true, count: v.steps.length };
    },
  };
}
