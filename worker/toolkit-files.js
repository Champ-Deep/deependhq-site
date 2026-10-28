// worker/toolkit-files.js : per-user desktop files (docs/toolkit-v4-api.md section 3).
//
// Bytes in R2 (env.TOOLKIT_FILES) under a random key that never depends on the path, index in D1 `files`.
// Every query is scoped by user_id; another user's id is indistinguishable from a missing one (404).
// A folder's subtree is selected by the range [path + '/', path + '0'), since '0' sorts right after '/',
// so names never need LIKE escaping.

export const QUOTA_BYTES = 50 * 1024 * 1024;
export const QUOTA_ENTRIES = 500;
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
const NAME_MAX = 120;
const MIME = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf' };
// What browsers report for these files besides the canonical type.
const ALSO = { csv: ['application/vnd.ms-excel', 'text/plain'], md: ['text/plain', 'text/x-markdown'], json: ['text/json', 'text/plain'] };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class FileError extends Error {
  constructor(status, error, message) { super(message); this.status = status; this.error = error; }
}
const fail = (status, error, message) => { throw new FileError(status, error, message); };

// --- names and paths ----------------------------------------------------------
export function checkName(name) {
  if (typeof name !== 'string' || !name || name.length > NAME_MAX || name === '.' || name === '..' || /[/\\\u0000-\u001f\u007f]/.test(name) || name.trim() !== name) {
    fail(400, 'invalid_path', `Names must be 1 to ${NAME_MAX} characters, with no slashes, and not "." or "..".`);
  }
  return name;
}

// "/a/b" or "/a/b/" -> "/a/b"; "/" -> "/". Rejects "..", ".", empty segments and backslashes.
export function normPath(p) {
  if (typeof p !== 'string' || !p.startsWith('/') || p.length > 1000) fail(400, 'invalid_path', 'Paths start with "/".');
  if (p === '/') return '/';
  const segs = (p.endsWith('/') ? p.slice(0, -1) : p).slice(1).split('/');
  segs.forEach(checkName);
  return '/' + segs.join('/');
}
const join = (folder, name) => (folder === '/' ? '' : folder) + '/' + name;
const parentOf = (path) => path.slice(0, path.lastIndexOf('/')) || '/';
const ext = (name) => (name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '');

const entry = (r) => ({ id: r.id, kind: r.kind, name: r.name, path: r.path, size: r.size, mime: r.mime, updated: r.updated_at });

// --- content checks -------------------------------------------------------------
function decodeBase64(s) {
  if (typeof s !== 'string' || s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) fail(400, 'bad_content', 'content_base64 is not valid base64.');
  const size = (s.length / 4) * 3 - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);
  if (size > FILE_MAX_BYTES) fail(413, 'file_too_large', 'Files are limited to 10 MB.');
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Type is decided by the extension, then the bytes must agree with it. Returns the canonical mime.
export function checkType(name, mime, bytes) {
  const e = ext(name);
  const canonical = MIME[e];
  const allowed = 'Allowed file types: csv, xlsx, json, txt, md, pdf.';
  if (!canonical) fail(400, 'bad_type', allowed);
  const m = String(mime || '').split(';')[0].trim().toLowerCase();
  if (m && m !== 'application/octet-stream' && m !== canonical && !(ALSO[e] || []).includes(m)) fail(400, 'bad_type', `The file type does not match .${e}.`);
  const starts = (sig) => sig.every((b, i) => bytes[i] === b);
  if (e === 'pdf' && !starts([0x25, 0x50, 0x44, 0x46, 0x2d])) fail(400, 'bad_type', 'This is not a PDF file.');
  if (e === 'xlsx' && !starts([0x50, 0x4b, 0x03, 0x04])) fail(400, 'bad_type', 'This is not an xlsx file.');
  if (['csv', 'json', 'txt', 'md'].includes(e)) {
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { fail(400, 'bad_type', 'Text files must be UTF-8.'); }
  }
  return canonical;
}

// --- store ----------------------------------------------------------------------------
const byPath = (db, uid, path) => db.prepare(`SELECT * FROM files WHERE user_id=?1 AND path=?2`).bind(uid, path).first();
const byId = (db, uid, id) => (UUID_RE.test(String(id)) ? db.prepare(`SELECT * FROM files WHERE user_id=?1 AND id=?2`).bind(uid, id).first() : null);
async function usage(db, uid) {
  const r = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(size),0) AS bytes FROM files WHERE user_id=?1`).bind(uid).first();
  return { n: Number(r.n), bytes: Number(r.bytes) };
}
async function checkQuota(db, uid, addEntries, addBytes) {
  const u = await usage(db, uid);
  if (u.n + addEntries > QUOTA_ENTRIES) fail(413, 'quota_exceeded', `Your desktop holds ${QUOTA_ENTRIES} files and folders. Delete some to make room.`);
  if (addBytes > 0 && u.bytes + addBytes > QUOTA_BYTES) fail(413, 'quota_exceeded', 'Your desktop holds 50 MB. Delete some files to make room.');
}

// Folders on the way to `path` that do not exist yet, outermost first. A file in the way is an error.
async function missingFolders(db, uid, path) {
  const out = [];
  for (let p = path; p !== '/'; p = parentOf(p)) {
    const r = await byPath(db, uid, p);
    if (r) { if (r.kind !== 'folder') fail(409, 'name_taken', `${r.path} is a file, not a folder.`); break; }
    out.unshift(p);
  }
  return out;
}
const insertStmt = (db, uid, r) => db.prepare(
  `INSERT INTO files (id, user_id, kind, path, parent, name, size, mime, r2_key, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`
).bind(r.id, uid, r.kind, r.path, parentOf(r.path), r.path.slice(r.path.lastIndexOf('/') + 1), r.size || 0, r.mime || '', r.r2_key || null, r.now);
const folderStmts = (db, uid, paths, now) => paths.map((path) => insertStmt(db, uid, { id: crypto.randomUUID(), kind: 'folder', path, now }));

async function uniqueName(db, uid, folder, name) {
  const dot = name.lastIndexOf('.');
  const [base, suffix] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 1; n <= QUOTA_ENTRIES + 1; n++) {
    const candidate = n === 1 ? name : `${base} (${n})${suffix}`;
    if (candidate.length > NAME_MAX) fail(400, 'invalid_path', `Names must be ${NAME_MAX} characters or less.`);
    if (!(await byPath(db, uid, join(folder, candidate)))) return candidate;
  }
  fail(409, 'name_taken', 'That name is taken.');
}

// Save bytes as a new file. Shared by files_put and the Workbench auto-save.
export async function saveFile(db, bucket, uid, { folder, name, mime, bytes }) {
  folder = normPath(folder);
  checkName(name);
  const missing = await missingFolders(db, uid, folder);
  await checkQuota(db, uid, missing.length + 1, bytes.length);
  const now = new Date().toISOString();
  const finalName = await uniqueName(db, uid, folder, name);
  const row = { id: crypto.randomUUID(), kind: 'file', path: join(folder, finalName), size: bytes.length, mime, r2_key: `u/${uid}/f/${crypto.randomUUID()}`, now };
  await bucket.put(row.r2_key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await db.batch([...folderStmts(db, uid, missing, now), insertStmt(db, uid, row)]);
  } catch (e) {
    await bucket.delete(row.r2_key).catch(() => {});
    if (String(e?.message).includes('UNIQUE')) fail(409, 'name_taken', 'That name was just taken. Try again.');
    throw e;
  }
  return entry({ ...row, name: finalName, updated_at: now });
}

// --- actions ------------------------------------------------------------------------
export async function filesAction(action, db, bucket, uid, body) {
  if (action === 'files_list') {
    const folder = normPath(body.folder ?? '/');
    if (folder !== '/') {
      const f = await byPath(db, uid, folder);
      if (!f || f.kind !== 'folder') fail(404, 'not_found', 'No such folder.');
    }
    const rows = (await db.prepare(`SELECT * FROM files WHERE user_id=?1 AND parent=?2 ORDER BY kind DESC, name`).bind(uid, folder).all()).results;
    const u = await usage(db, uid);
    return { entries: rows.map(entry), used_bytes: u.bytes, quota_bytes: QUOTA_BYTES };
  }
  if (action === 'files_mkdir') {
    const path = normPath(body.path);
    if (path === '/') fail(400, 'invalid_path', 'The root folder always exists.');
    const missing = await missingFolders(db, uid, path);
    if (!missing.length) return { entry: entry(await byPath(db, uid, path)) };
    await checkQuota(db, uid, missing.length, 0);
    await db.batch(folderStmts(db, uid, missing, new Date().toISOString()));
    return { entry: entry(await byPath(db, uid, path)) };
  }
  if (action === 'files_put') {
    const folder = normPath(body.folder ?? '/');
    const name = checkName(body.name);
    const bytes = decodeBase64(body.content_base64);
    const mime = checkType(name, body.mime, bytes);
    return { entry: await saveFile(db, bucket, uid, { folder, name, mime, bytes }) };
  }
  if (action === 'files_move') {
    const row = await byId(db, uid, body.id);
    if (!row) fail(404, 'not_found', 'No such file or folder.');
    const folder = body.folder === undefined ? row.parent : normPath(body.folder);
    const name = body.name === undefined ? row.name : checkName(body.name);
    if (row.kind === 'file' && ext(name) !== ext(row.name)) fail(400, 'invalid_name', 'Renaming cannot change the file type.');
    const to = join(folder, name);
    if (to === row.path) return { entry: entry(row) };
    if (row.kind === 'folder' && (folder === row.path || folder.startsWith(row.path + '/'))) fail(400, 'invalid_move', 'A folder cannot move into itself.');
    if (await byPath(db, uid, to)) fail(409, 'name_taken', 'Something with that name is already there.');
    const missing = await missingFolders(db, uid, folder);
    if (missing.length) await checkQuota(db, uid, missing.length, 0);
    const now = new Date().toISOString();
    const stmts = [
      ...folderStmts(db, uid, missing, now),
      db.prepare(`UPDATE files SET path=?1, parent=?2, name=?3, updated_at=?4 WHERE user_id=?5 AND id=?6`).bind(to, folder, name, now, uid, row.id),
    ];
    if (row.kind === 'folder') {
      // Children: swap the old prefix for the new one in path and parent. length() and substr() count the same characters.
      stmts.push(db.prepare(
        `UPDATE files SET path = ?1 || substr(path, length(?2) + 1),
                          parent = CASE WHEN parent = ?2 THEN ?1 ELSE ?1 || substr(parent, length(?2) + 1) END
         WHERE user_id=?3 AND path >= ?2 || '/' AND path < ?2 || '0'`
      ).bind(to, row.path, uid));
    }
    try { await db.batch(stmts); } catch (e) {
      if (String(e?.message).includes('UNIQUE')) fail(409, 'name_taken', 'Something with that name is already there.');
      throw e;
    }
    return { entry: entry(await byId(db, uid, row.id)) };
  }
  if (action === 'files_delete') {
    const row = await byId(db, uid, body.id);
    if (!row) fail(404, 'not_found', 'No such file or folder.');
    const sub = `user_id=?1 AND (id=?2 OR (path >= ?3 || '/' AND path < ?3 || '0'))`;
    const keys = row.kind === 'folder'
      ? (await db.prepare(`SELECT r2_key FROM files WHERE ${sub} AND r2_key IS NOT NULL`).bind(uid, row.id, row.path).all()).results.map((r) => r.r2_key)
      : [row.r2_key];
    // Index first: a dangling R2 object is unreachable, a dangling row would 404 on download.
    await db.prepare(row.kind === 'folder' ? `DELETE FROM files WHERE ${sub}` : `DELETE FROM files WHERE user_id=?1 AND id=?2`).bind(uid, row.id, ...(row.kind === 'folder' ? [row.path] : [])).run();
    for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
    return { ok: true };
  }
  return null;
}

// GET /api/toolkit/files/<id>: owner only, always an attachment so a stored file never renders on our origin.
export async function downloadFile(db, bucket, uid, id) {
  const row = await byId(db, uid, id);
  if (!row || row.kind !== 'file') return null;
  const obj = await bucket.get(row.r2_key);
  if (!obj) return null;
  return new Response(obj.body, {
    headers: {
      'content-type': row.mime + (row.mime.startsWith('text/') || row.mime === 'application/json' ? '; charset=utf-8' : ''),
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      'content-length': String(row.size),
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    },
  });
}
