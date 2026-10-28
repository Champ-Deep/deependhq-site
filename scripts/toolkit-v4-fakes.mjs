// TEST-ONLY fakes for the V4 actions the worker on this branch does not have yet (docs/toolkit-v4-api.md
// sections 1, 3 and 4): intake, files_*, file download, admin_settings_*, admin_ai_log*. In memory, no network.
// Delete each fake as feat/toolkit-v4-api lands the real action.
export const V4_ACTIONS = new Set(['intake', 'files_list', 'files_mkdir', 'files_put', 'files_move', 'files_delete', 'admin_settings_get', 'admin_settings_set', 'admin_ai_log', 'admin_ai_log_export']);
const MODELS = [
  {id: 'deepseek/deepseek-v4.1-flash', prompt_micro_per_mtok: 140000, completion_micro_per_mtok: 280000},
  {id: 'deepseek/deepseek-v4.1', prompt_micro_per_mtok: 550000, completion_micro_per_mtok: 2190000},
  {id: 'openai/gpt-5-mini', prompt_micro_per_mtok: 250000, completion_micro_per_mtok: 2000000},
];
const ALLOWED = /\.(csv|xlsx|json|txt|md|pdf)$/i, QUOTA = 50 * 1024 * 1024;
let files, settings, log, n;
export function resetFakes() {
  files = new Map(); settings = {intake_model: MODELS[0].id, research_model: MODELS[1].id}; log = []; n = 0;
}
resetFakes();
const parent = p => p.replace(/\/[^/]+$/, '') || '/';
const join = (folder, name) => (folder === '/' ? '' : folder) + '/' + name;
const strip = ({bytes, ...e}) => e;
const entryAt = path => [...files.values()].find(e => e.path === path);
function mkdirp(path) {
  if (path === '/') return null;
  const hit = entryAt(path); if (hit) return hit;
  mkdirp(parent(path));
  const e = {id: 'f_' + (++n), kind: 'folder', name: path.split('/').pop(), path, size: 0, mime: '', updated: new Date().toISOString()};
  files.set(e.id, e); return e;
}
function unique(folder, name) {
  let candidate = name, k = 1;
  const [base, ext] = name.includes('.') ? [name.slice(0, name.lastIndexOf('.')), name.slice(name.lastIndexOf('.'))] : [name, ''];
  while (entryAt(join(folder, candidate))) candidate = `${base} (${++k})${ext}`;
  return candidate;
}
const GUESS = [[/e-?mail/i, 'email'], [/company|account/i, 'company'], [/domain|website/i, 'domain'], [/title|job|role/i, 'title'], [/name/i, 'person_name']];
function record(user_id, action, extra) { log.push({id: 'log_' + (++n), ts: new Date().toISOString(), user_id, action, op: null, engine: null, model: settings.intake_model, tokens_in: 900, tokens_out: 210, cost_micro: 420, outcome: 'ok', prompt: '[value]', ...extra}); }

export function fakeAction(body, user) {
  const a = body.action;
  if (a.startsWith('admin_') && !user.admin) return [403, {error: 'forbidden'}];
  if (a === 'intake') {
    const file = body.file || {};
    if (!Array.isArray(file.headers) || !file.headers.length || file.headers.length > 30) return [400, {error: 'invalid_intake', message: 'Send 1 to 30 headers.'}];
    if (Object.values(file.samples || {}).some(s => s.length > 5 || s.some(v => String(v).length > 200))) return [400, {error: 'invalid_intake', message: 'Samples are capped at 5 per header, 200 characters each.'}];
    const history = body.history || [];
    if (history.length > 12) return [400, {error: 'invalid_intake'}];
    const mapping = file.headers.map(h => ({source: h, field: (GUESS.find(([re]) => re.test(h)) || [0, 'other'])[1], keep: true}));
    const company = mapping.find(m => m.field === 'company')?.source || file.headers[0];
    const first = history.length === 0;
    const plan = [{column: company, op: 'classify', engine: 'jev', instruction: 'Is this a SaaS company?', categories: ['SaaS', 'Not SaaS']}];
    if (!first) plan.push({column: company, op: 'verify', engine: 'jev', instruction: 'Does this company sell to businesses?'});
    record(user.id, 'intake', {goal: String(body.goal || '').slice(0, 2000)});
    return [200, {
      reply: first ? `I read ${file.rows_total} rows. I will sort ${company} into SaaS or not SaaS.` : 'Done. I added a yes or no check for whether each company sells to businesses.',
      question: first ? 'Do you also want to know whether each company sells to businesses?' : null,
      mapping, plan, chips: first ? ['Yes, add that', 'Also verify emails'] : ['Research company size'],
      model: settings.intake_model, cost_micro: 420,
    }];
  }
  if (a === 'files_list') {
    const folder = body.folder || '/';
    const all = [...files.values()], used = all.reduce((s, e) => s + e.size, 0);
    return [200, {entries: all.filter(e => parent(e.path) === folder).map(strip), used_bytes: used, quota_bytes: QUOTA}];
  }
  if (a === 'files_mkdir') {
    if (typeof body.path !== 'string' || !body.path.startsWith('/') || body.path.length > 500) return [400, {error: 'invalid_path'}];
    return [200, {entry: strip(mkdirp(body.path))}];
  }
  if (a === 'files_put') {
    const folder = body.folder || '/', name = String(body.name || '');
    if (!ALLOWED.test(name) || /[/\\]/.test(name)) return [400, {error: 'file_type', message: 'Files takes CSV, XLSX, JSON, TXT, MD and PDF.'}];
    const bytes = Buffer.from(String(body.content_base64 || ''), 'base64');
    if (bytes.length > 10 * 1024 * 1024) return [400, {error: 'file_too_large'}];
    mkdirp(folder);
    const finalName = unique(folder, name);
    const e = {id: 'f_' + (++n), kind: 'file', name: finalName, path: join(folder, finalName), size: bytes.length, mime: body.mime || 'application/octet-stream', updated: new Date().toISOString(), bytes};
    files.set(e.id, e); return [200, {entry: strip(e)}];
  }
  if (a === 'files_move') {
    const e = files.get(body.id); if (!e) return [404, {error: 'not_found'}];
    const folder = body.folder ?? parent(e.path), name = body.name ?? e.name;
    if (/[/\\]/.test(name)) return [400, {error: 'invalid_name'}];
    if (e.kind === 'folder' && (folder === e.path || folder.startsWith(e.path + '/'))) return [400, {error: 'invalid_move'}];
    mkdirp(folder);
    const finalName = (folder === parent(e.path) && name === e.name) ? name : unique(folder, name), from = e.path, to = join(folder, finalName);
    for (const c of files.values()) if (c.path.startsWith(from + '/')) c.path = to + c.path.slice(from.length);
    Object.assign(e, {name: finalName, path: to, updated: new Date().toISOString()});
    return [200, {entry: strip(e)}];
  }
  if (a === 'files_delete') {
    const e = files.get(body.id); if (!e) return [404, {error: 'not_found'}];
    for (const [id, c] of files) if (c === e || c.path.startsWith(e.path + '/')) files.delete(id);
    return [200, {ok: true}];
  }
  if (a === 'admin_settings_get') return [200, {settings: {...settings}, models: MODELS}];
  if (a === 'admin_settings_set') {
    for (const k of ['intake_model', 'research_model']) if (body[k] !== undefined && !MODELS.some(m => m.id === body[k])) return [400, {error: 'unknown_model', message: 'That model id is not on OpenRouter.'}];
    for (const k of ['intake_model', 'research_model']) if (body[k]) settings[k] = body[k];
    return [200, {settings: {...settings}}];
  }
  const filtered = () => log.filter(r => (!body.user_id || r.user_id === body.user_id) && (!body.filter_action || r.action === body.filter_action) && (!body.since || r.ts >= body.since)).reverse();
  if (a === 'admin_ai_log') { const page = Number(body.page) || 1, rows = filtered(); return [200, {rows: rows.slice((page - 1) * 50, page * 50), has_more: rows.length > page * 50}]; }
  if (a === 'admin_ai_log_export') return [200, filtered().map(r => JSON.stringify(r)).join('\n') + '\n', 'application/x-ndjson'];
  return [400, {error: 'unknown_action'}];
}
// GET /api/toolkit/files/<id>
export function fakeDownload(id) { const e = files.get(id); return e?.kind === 'file' ? e : null; }
export function fakeState() { return {files: [...files.values()].map(strip), settings, log: log.length}; }
