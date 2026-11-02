// toolkit-desktop.js : toolkit.deependhq.com. Desktop shell (windows, icons, dock), Files, Data Workbench,
// Deep Enrich, Account and Admin. API contract: docs/toolkit-v4-api.md. One module, no framework.
import * as session from './toolkit-session.js';
import {parseCsv,parseXlsx,chunk,toCsv,MAX_FILE_BYTES} from './toolkit-lib.js';
import * as wl from './toolkit-workbench-lib.js';
const {money} = wl;
const $ = s => document.querySelector(s);
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function button(text, fn, cls = 'btn btn-outline') { const n = el('button', text, cls); n.type = 'button'; n.addEventListener('click', fn); return n; }
// The control is named by its label text only; a wrapping label would otherwise fold the selected option into the name.
function field(label, control, cls) { const n = el('label', undefined, cls); control.setAttribute('aria-label', label); n.append(el('span', label, 'field-label'), control); return n; }
function input(value = '', type = 'text') { const n = el('input'); n.type = type; n.value = value; return n; }
function select(options, value) { const n = el('select'); for (const [v, t] of options) n.append(new Option(t, v)); if (value !== undefined) n.value = value; return n; }
function check(label, checked, onChange) { const c = input('', 'checkbox'); c.checked = checked; c.addEventListener('change', () => onChange(c.checked)); const l = el('label', undefined, 'check'); l.append(c, el('span', label)); return l; }
function table(headers, rows, label = 'Scrollable data table') {
  const wrap = el('div', undefined, 'table-scroll'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', label);
  const t = el('table'), head = el('thead'), tr = el('tr'); headers.forEach(h => tr.append(el('th', h))); head.append(tr); t.append(head);
  const body = el('tbody'); rows.forEach(row => { const r = el('tr'); row.forEach(v => { const cell = el('td'); cell.append(v instanceof Node ? v : document.createTextNode(String(v ?? ''))); r.append(cell); }); body.append(r); });
  t.append(body); wrap.append(t); return wrap;
}
function notice(root, text, bad = false) { const n = el('p', text, 'notice' + (bad ? ' bad' : '')); n.setAttribute('role', bad ? 'alert' : 'status'); root.append(n); return n; }
function eyebrow(text) { return el('p', text, 'eyebrow'); }
function saveBlob(blob, name) { const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const signedIn = () => session.authState().signedIn;
const mobile = () => innerWidth <= 768;
const errorText = e => e.data?.message || ({provider_not_configured: 'Setup needed. The selected provider is not configured. Nothing was sent to that provider.', insufficient_credits: 'Your balance is too low. Ask an administrator for credits.', daily_credit_cap: 'Daily spending allowance reached. Return after the UTC day resets.', global_daily_cap: 'The shared daily budget is exhausted. Ask an administrator.', batch_ceiling: 'A chunk is over the $0.25 limit. Use fewer operations.'}[e.message] || e.message);
function age(iso) { const ms = Date.now() - Date.parse(iso); if (!Number.isFinite(ms)) return 'Date unavailable'; const d = Math.floor(ms / 86400000); return d < 1 ? 'today' : d === 1 ? '1 day ago' : d + ' days ago'; }
function size(bytes) { const n = Number(bytes) || 0; return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
function metrics(values) { const n = el('dl', undefined, 'metrics'); for (const [label, value] of values) { const d = el('div'); d.append(el('dt', label), el('dd', value, 'money')); n.append(d); } return n; }

const ICON = {
  workbench: 'M4 5h24v22H4z M4 12h24 M12 12v15', enrich: 'M16 3l3.2 8.8L28 15l-8.8 3.2L16 27l-3.2-8.8L4 15l8.8-3.2z',
  files: 'M3 8h10l3 3h13v16H3z', beam: 'M4 16h24 M18 6l10 10-10 10', pdf: 'M8 3h11l6 6v20H8z M18 3v8h7 M12 17h9 M12 22h9',
  account: 'M21 10a5 5 0 1 1-10 0a5 5 0 1 1 10 0 M6 29v-5a10 10 0 0 1 20 0v5', admin: 'M4 8h24 M4 16h24 M4 24h24 M11 4v8 M21 12v8 M14 20v8',
  file: 'M8 3h11l6 6v20H8z M18 3v8h7', folder: 'M3 8h10l3 3h13v16H3z',
};
// Deep Enrich sits right after Data Workbench, in the dock and on the desktop.
const APPS = [['workbench', 'Data Workbench'], ['enrich', 'Deep Enrich'], ['files', 'Files'], ['beam', 'ChampBeam'], ['pdf', 'ChamPDF'], ['account', 'Account'], ['admin', 'Admin']];
const NAME = Object.fromEntries(APPS);
function icon(path) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', path); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.6'); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round');
  svg.append(p); return svg;
}
let usage = null, config = null, topZ = 10, active = null, authEpoch = 0, rootFiles = [];
const windows = new Map(), launchers = new Map(), desktopIcons = new Map();
const userKey = prefix => prefix + ':' + (session.authState().userId || 'guest');
const readJson = key => { try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { return {}; } };
const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode: layout just is not remembered */ } };

// ---------------- Windows: drag, snap, resize, maximize, per-user geometry ----------------
const MIN_W = 360, MIN_H = 240;
function area() { const top = Math.round($('.menubar').getBoundingClientRect().bottom), dock = $('#app-launcher').getBoundingClientRect(); return {x: 0, y: top, w: innerWidth, h: Math.max(MIN_H, Math.round(dock.top - 12 - top))}; }
function saveGeo(id, w) { const all = readJson(userKey('dh_toolkit_windows')); all[id] = {...w.rect, zone: w.zone || null}; writeJson(userKey('dh_toolkit_windows'), all); }
function place(w) {
  const s = w.node.style;
  if (mobile()) { s.left = s.top = s.width = s.height = ''; return; }
  const a = area(), r = w.zone ? wl.zoneRect(w.zone, a) : wl.fitRect(w.rect, a, MIN_W, MIN_H);
  if (!w.zone) w.rect = r;
  Object.assign(s, {left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px'});
  w.node.dataset.zone = w.zone || '';
  const max = w.zone === 'max'; w.maxButton.setAttribute('aria-label', (max ? 'Restore ' : 'Maximize ') + NAME[w.id]); w.maxButton.textContent = max ? '❐' : '□';
}
function setActive(id) {
  active = id;
  for (const [key, w] of windows) { w.node.dataset.focused = String(key === id); w.node.inert = mobile() && key !== id; }
  if (id) { const w = windows.get(id); w.node.hidden = false; w.node.style.zIndex = String(++topZ); }
  for (const n of document.querySelectorAll('.menubar,.desktop,#app-launcher')) n.inert = mobile() && !!id;
}
const topWindow = () => [...windows].reverse().find(([, v]) => !v.node.hidden)?.[0] || null;
function closeWindow(id) { const w = windows.get(id); w?.cleanup?.(); w?.node.remove(); windows.delete(id); launchers.get(id).dataset.open = 'false'; setActive(topWindow()); launchers.get(id).focus(); }
function preview(rect) { const p = $('#snap-preview'); p.hidden = !rect; if (rect) Object.assign(p.style, {left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px'}); }
function openApp(id) {
  if (id === 'admin' && !usage?.user.is_admin) return null;
  if (windows.has(id)) { const w = windows.get(id); setActive(id); w.node.querySelector('button').focus(); return w; }
  const node = el('section', undefined, 'window'); node.dataset.app = id; node.setAttribute('aria-label', NAME[id]);
  const header = el('div', undefined, 'window-header'), title = el('h2', NAME[id], 'window-title'), controls = el('div', undefined, 'window-controls');
  const body = el('div', undefined, 'window-body');
  const w = {id, node, body, zone: null, rect: null};
  const min = button('−', () => { node.hidden = true; setActive(topWindow()); launchers.get(id).focus(); }, 'wc'); min.setAttribute('aria-label', 'Minimize ' + NAME[id]);
  w.maxButton = button('□', () => toggleMax(w), 'wc');
  const close = button('×', () => closeWindow(id), 'wc wc-close'); close.setAttribute('aria-label', 'Close ' + NAME[id]);
  controls.append(min, w.maxButton, close); header.append(title, controls); node.append(header, body);
  for (const edge of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) { const h = el('div', undefined, 'rz rz-' + edge); h.dataset.edge = edge; node.append(h); }
  $('#windows').append(node); windows.set(id, w);
  const a = area(), saved = readJson(userKey('dh_toolkit_windows'))[id], n = windows.size - 1;
  const ww = Math.min(940, a.w - 48), wh = Math.min(700, a.h - 24);
  w.rect = saved?.w ? {x: saved.x, y: saved.y, w: saved.w, h: saved.h} : {x: Math.round((a.w - ww) / 2) + n * 28, y: a.y + 12 + n * 28, w: ww, h: wh};
  w.zone = wl.zoneRect(saved?.zone, a) ? saved.zone : null;
  place(w); setActive(id); launchers.get(id).dataset.open = 'true';
  node.addEventListener('pointerdown', () => setActive(id)); node.addEventListener('focusin', () => setActive(id));
  dragWindow(w, header); resizeWindow(w);
  header.addEventListener('dblclick', e => { if (!e.target.closest('button') && !mobile()) toggleMax(w); });
  ({workbench, enrich: enrichApp, files: filesApp, beam: embedded, pdf: embedded, account, admin})[id](w);
  close.focus();
  return w;
}
function toggleMax(w) { w.zone = w.zone === 'max' ? null : 'max'; place(w); saveGeo(w.id, w); }
function dragWindow(w, header) {
  let drag = null;
  header.addEventListener('pointerdown', e => { if (e.button !== 0 || e.target.closest('button') || mobile()) return; const r = w.node.getBoundingClientRect(); drag = {sx: e.clientX, sy: e.clientY, ox: e.clientX - r.x, oy: e.clientY - r.y, moved: false, zone: null}; header.setPointerCapture(e.pointerId); });
  header.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true; w.node.dataset.dragging = 'true';
      // Dragging a snapped window restores its free size under the pointer, as a desktop OS does.
      if (w.zone) { const r = w.node.getBoundingClientRect(), rel = drag.ox / r.width; w.zone = null; drag.ox = Math.round(w.rect.w * rel); }
    }
    w.rect = {...w.rect, x: e.clientX - drag.ox, y: e.clientY - drag.oy}; place(w);
    drag.zone = wl.snapZone(e.clientX, e.clientY, area()); preview(drag.zone && wl.zoneRect(drag.zone, area()));
  });
  const end = () => { if (drag?.moved) { delete w.node.dataset.dragging; if (drag.zone) { w.zone = drag.zone; place(w); } saveGeo(w.id, w); } preview(null); drag = null; };
  header.addEventListener('pointerup', end); header.addEventListener('pointercancel', end);
}
function resizeWindow(w) {
  let rs = null;
  w.node.addEventListener('pointerdown', e => { const h = e.target.closest('.rz'); if (!h || e.button !== 0 || mobile()) return; e.preventDefault(); const r = w.node.getBoundingClientRect(); rs = {edge: h.dataset.edge, sx: e.clientX, sy: e.clientY, start: {x: r.x, y: r.y, w: r.width, h: r.height}}; w.zone = null; h.setPointerCapture(e.pointerId); w.node.dataset.resizing = 'true'; });
  w.node.addEventListener('pointermove', e => { if (!rs) return; w.rect = wl.resizeRect(rs.start, rs.edge, e.clientX - rs.sx, e.clientY - rs.sy, area(), MIN_W, MIN_H); place(w); });
  const end = () => { if (!rs) return; rs = null; delete w.node.dataset.resizing; saveGeo(w.id, w); };
  w.node.addEventListener('pointerup', end); w.node.addEventListener('pointercancel', end);
}
addEventListener('resize', () => { setActive(active); for (const w of windows.values()) place(w); layoutIcons(); });

// ---------------- Desktop icons on a grid ----------------
const CELL = {w: 100, h: 120};
function gridSize() { const r = $('#desktop-icons').getBoundingClientRect(); return {cols: Math.max(1, Math.floor(r.width / CELL.w)), rows: Math.max(1, Math.floor(r.height / CELL.h))}; }
const cellOf = d => (d.dataset.cell || '0,0').split(',').map(Number);
function setCell(d, cell) { d.dataset.cell = cell.join(); d.style.left = cell[0] * CELL.w + 'px'; d.style.top = cell[1] * CELL.h + 'px'; }
// Saved spots win, the rest fill columns top to bottom; two icons never share a cell.
function layoutIcons() {
  const visible = [...desktopIcons].filter(([, d]) => !d.hidden);
  if (mobile()) { for (const [, d] of visible) { d.style.left = d.style.top = ''; } return; }
  const {cols, rows} = gridSize(), saved = readJson(userKey('dh_toolkit_icons')), taken = new Set();
  let next = 0;
  for (const [key, d] of [...visible.filter(([k]) => Array.isArray(saved[k])), ...visible.filter(([k]) => !Array.isArray(saved[k]))]) {
    const want = Array.isArray(saved[key]) ? saved[key] : [Math.floor(next / rows), next++ % rows];
    // shortcut: a full grid stacks overflow icons in the last cell; 500 entries would need a scrolling desktop.
    const cell = wl.nearestFreeCell(want, cols, rows, taken) || [cols - 1, rows - 1];
    taken.add(cell.join()); setCell(d, cell);
  }
}
function saveIcons() { const out = {}; for (const [key, d] of desktopIcons) if (!d.hidden && d.dataset.cell) out[key] = cellOf(d); writeJson(userKey('dh_toolkit_icons'), out); }
function addDesktopIcon(key, name, path, open, entry) {
  const d = button('', () => { for (const x of desktopIcons.values()) x.dataset.selected = String(x === d); }, 'desk-icon');
  d.dataset.desktop = key; d.dataset.selected = 'false'; d.setAttribute('aria-label', name + '. Double click or press Enter to open');
  const sym = el('span', undefined, 'app-icon'); sym.append(icon(path));
  if (entry?.kind === 'file') sym.append(el('span', (entry.name.split('.').pop() || 'file').slice(0, 4).toUpperCase(), 'ext'));
  d.append(sym, el('span', name, entry?.kind === 'file' ? 'desk-label desk-file' : 'desk-label'));
  d.addEventListener('dblclick', open);
  d.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); open(); } const step = {ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1}[e.key]; if (step) { e.preventDefault(); const list = [...desktopIcons.values()].filter(x => !x.hidden); list[(list.indexOf(d) + step + list.length) % list.length].focus(); } });
  dragIcon(d, entry); $('#desktop-icons').append(d); desktopIcons.set(key, d); return d;
}
function dragIcon(d, entry) {
  let drag = null;
  d.addEventListener('pointerdown', e => { if (mobile() || e.button !== 0) return; drag = {sx: e.clientX, sy: e.clientY, x: parseFloat(d.style.left) || 0, y: parseFloat(d.style.top) || 0, from: cellOf(d), moved: false}; d.setPointerCapture(e.pointerId); });
  d.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return; drag.moved = true; d.dataset.dragging = 'true';
    const host = $('#desktop-icons').getBoundingClientRect();
    d.style.left = Math.max(-host.left, Math.min(innerWidth - host.left - CELL.w, drag.x + dx)) + 'px'; d.style.top = Math.max(0, Math.min(innerHeight - host.top - CELL.h, drag.y + dy)) + 'px';
  });
  const end = e => {
    if (!drag?.moved) { drag = null; return; }
    delete d.dataset.dragging;
    const target = document.elementsFromPoint(e.clientX, e.clientY).find(n => n.classList?.contains('window'));
    if (target && entry?.kind === 'file' && ['workbench', 'enrich'].includes(target.dataset.app)) { setCell(d, drag.from); openFileIn(entry, target.dataset.app); drag = null; return; }
    if (target && entry && target.dataset.app === 'files') { setCell(d, drag.from); drag = null; return; }
    const {cols, rows} = gridSize(), taken = new Set([...desktopIcons.values()].filter(x => x !== d && !x.hidden).map(x => x.dataset.cell));
    setCell(d, wl.nearestFreeCell([(parseFloat(d.style.left) || 0) / CELL.w, (parseFloat(d.style.top) || 0) / CELL.h], cols, rows, taken) || drag.from);
    saveIcons(); drag = null;
  };
  d.addEventListener('pointerup', end); d.addEventListener('pointercancel', () => { if (drag) setCell(d, drag.from); drag = null; delete d.dataset.dragging; });
}
for (const [id, name] of APPS) {
  const b = button('', () => openApp(id), 'dock-app'); b.dataset.launch = id; b.dataset.open = 'false'; b.setAttribute('aria-label', name);
  const sym = el('span', undefined, 'dock-symbol'); sym.append(icon(ICON[id])); b.append(sym, el('span', name, 'dock-label'));
  if (id === 'admin') b.hidden = true; $('#app-launcher').append(b); launchers.set(id, b);
  addDesktopIcon(id, name, ICON[id], () => openApp(id)).hidden = id === 'admin';
}
// 21st.dev 2572 cosine magnification (vanilla port), native buttons and no perpetual RAF loop.
$('#app-launcher').addEventListener('pointermove', e => { if (mobile() || matchMedia('(prefers-reduced-motion: reduce)').matches) return; for (const b of launchers.values()) { const r = b.getBoundingClientRect(); const distance = Math.abs(e.clientX - r.x - r.width / 2); b.style.setProperty('--scale', String(distance < 120 ? 1 + .12 * (1 + Math.cos(distance / 120 * Math.PI)) : 1)); } });
$('#app-launcher').addEventListener('pointerleave', () => launchers.forEach(b => b.style.removeProperty('--scale')));

// ---------------- Files on the desktop ----------------
async function refreshDesktopFiles() {
  const epoch = authEpoch;
  let entries = [];
  if (signedIn()) { try { entries = (await session.api('files_list', {folder: '/'})).entries || []; $('#files-note').hidden = true; } catch (e) { $('#files-note').hidden = false; $('#files-note').textContent = 'Desktop files unavailable: ' + errorText(e); } }
  if (epoch !== authEpoch) return;
  rootFiles = entries;
  for (const [key, d] of [...desktopIcons]) if (key.startsWith('file:')) { d.remove(); desktopIcons.delete(key); }
  for (const entry of entries) addDesktopIcon('file:' + entry.id, entry.name, ICON[entry.kind === 'folder' ? 'folder' : 'file'], () => openEntry(entry), entry);
  layoutIcons();
}
async function saveFile(folder, file) {
  if (!wl.FILE_TYPES.test(file.name)) throw new Error(file.name + ' was not saved. Files takes CSV, XLSX, JSON, TXT, MD and PDF.');
  if (file.size > wl.FILE_LIMIT) throw new Error(file.name + ' is over 10 MB. Split it and try again.');
  const mime = file.type || ({csv: 'text/csv', json: 'application/json', md: 'text/markdown', txt: 'text/plain', pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[file.name.split('.').pop().toLowerCase()]);
  return (await session.api('files_put', {folder, name: file.name, mime, content_base64: wl.toBase64(new Uint8Array(await file.arrayBuffer()))})).entry;
}
const tabular = name => /\.(csv|xlsx)$/i.test(name);
async function openFileIn(entry, app = 'workbench') {
  try { const blob = await session.fetchFile(entry.id); const w = openApp(app); w?.load(new File([blob], entry.name, {type: blob.type || entry.mime || ''})); }
  catch (e) { status(errorText(e)); }
}
async function download(entry) { try { saveBlob(await session.fetchFile(entry.id), entry.name); } catch (e) { status(errorText(e)); } }
function openEntry(entry) {
  if (entry.kind === 'folder') { const w = openApp('files'); w?.go(entry.path); return; }
  if (tabular(entry.name)) openFileIn(entry); else download(entry);
}
function status(text) { $('#session-status').textContent = text; }
// An OS file dropped on the desktop is saved to / and, when it is a table, opened in Data Workbench.
addEventListener('dragover', e => { if (!e.dataTransfer?.types.includes('Files')) return; e.preventDefault(); $('#main').dataset.drop = 'true'; });
addEventListener('dragleave', e => { if (!e.relatedTarget) delete $('#main').dataset.drop; });
addEventListener('drop', async e => {
  if (!e.dataTransfer?.types.includes('Files')) return; e.preventDefault(); delete $('#main').dataset.drop;
  const f = e.dataTransfer.files[0]; if (!f) return;
  if (!wl.FILE_TYPES.test(f.name)) { status(f.name + ' was not opened. Drop a CSV, XLSX, JSON, TXT, MD or PDF.'); return; }
  if (signedIn()) { try { await saveFile('/', f); await refreshDesktopFiles(); status(f.name + ' saved to your desktop.'); } catch (err) { status(errorText(err)); } }
  else status('Sign in to keep files on your desktop. ' + (tabular(f.name) ? 'Opened in Data Workbench for now.' : ''));
  if (tabular(f.name)) openApp('workbench')?.load(f);
});
// Desktop and dock repaint from fresh config and usage after sign-in, sign-out and Refresh connection.
function paintUsage() {
  const u = usage?.usage;
  $('#daily').textContent = u ? money(Math.max(0, u.daily_credit_cap - u.credits_used - u.credits_held) * 1000, 'down') : 'Unavailable';
  $('#balance').textContent = u ? money(u.credits_available * 1000, 'down') : 'Unavailable';
  const recent = $('#recent-runs'), runs = wl.groupRuns(usage?.runs || []).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 5);
  recent.replaceChildren(...(!usage ? [el('li', signedIn() ? 'Runs unavailable. Refresh the connection.' : 'Sign in to see your recent runs.', 'empty')] : !runs.length ? [el('li', 'No runs yet', 'empty')] : runs.map(r => { const li = el('li'); li.append(el('strong', r.list_name || r.tool_id), el('span', r.status + ' / ' + r.row_count + ' ' + (r.row_count === 1 ? 'row' : 'rows') + ' / ' + money(r.spent_micro)), el('small', age(r.created_at))); return li; })));
  $('#identity').textContent = usage?.user.email || 'Your files stay in your browser until you approve a run.';
  $('#menu-user').textContent = usage?.user.email || (signedIn() ? 'Signed in' : 'Signed out');
  const admin = !!usage?.user.is_admin; launchers.get('admin').hidden = desktopIcons.get('admin').hidden = !admin; if (!admin && windows.has('admin')) closeWindow('admin');
  layoutIcons();
}
async function refreshUsage() { const epoch = authEpoch; const next = await session.api('usage', {}); if (epoch !== authEpoch) return; usage = next; paintUsage(); }
function setStatus(text, state) { const s = $('#session-status'); s.textContent = text; s.dataset.state = state; }
async function connect() {
  setStatus('Connecting to your workspace...', 'loading');
  try { config = await session.loadConfig(true); if (!config.configured) throw new Error('Setup needed. Secure sign-in and providers are not configured yet. You can explore the desktop.'); await session.startClerk(); await authChanged(session.authState()); }
  catch (e) { setStatus(errorText(e), 'bad'); }
}
async function authChanged(s) {
  const epoch = ++authEpoch; $('#signin-link').hidden = s.signedIn; $('#signout').hidden = !s.signedIn;
  if (!s.signedIn) { usage = null; for (const id of [...windows.keys()]) closeWindow(id); await refreshDesktopFiles(); paintUsage(); setStatus('Signed out. Sign in to access private runs and quotes.', 'off'); return; }
  try {
    await Promise.all([refreshUsage(), refreshDesktopFiles()]); if (epoch !== authEpoch) return;
    const u = usage.usage;
    setStatus(u.disabled ? 'Account disabled. Contact an administrator.' : !usage.providers.treg && !usage.providers.jev ? 'Setup needed. Providers are not configured yet.' : u.daily_credit_cap === 0 ? 'No daily allowance enabled. Ask an administrator to set your limits.' : 'Workspace connected. Choose an app below.', u.disabled || u.daily_credit_cap === 0 ? 'bad' : 'ok');
  } catch (e) { setStatus(errorText(e), 'bad'); }
}
session.onAuthChange(authChanged);
$('#retry-session').addEventListener('click', connect);
$('#signout').addEventListener('click', () => session.signOut().catch(e => setStatus(e.message, 'bad')));

// ---------------- Apps ----------------
function requireSignIn(body) {
  if (signedIn()) return true;
  notice(body, config?.configured ? 'Sign in to load this private app.' : 'Setup needed. Sign-in is not configured yet.');
  const a = el('a', 'Go to sign in', 'btn btn-gold'); a.href = '/sign-in'; body.append(a); return false;
}
function embedded(w) {
  const beam = w.id === 'beam', url = beam ? 'https://www.champbeam.com' : 'https://champdf.com';
  const bar = el('div', undefined, 'embed-bar'); bar.append(el('p', beam ? 'ChampBeam has its own sign-in. Some browsers block its session inside a frame.' : 'ChamPDF is free. If it does not load here, open it in a new tab.'));
  const a = el('a', 'Open in new tab', 'btn btn-outline'); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; bar.append(a);
  const frame = el('iframe'); frame.src = url; frame.title = beam ? 'ChampBeam' : 'ChamPDF'; frame.referrerPolicy = 'no-referrer';
  w.body.classList.add('embed'); w.body.append(bar, frame);
}
// Drop zones light up under an OS file drag, take Files rows and desktop file icons too, and keep the drop to themselves.
const DH_FILE = 'application/x-dh-file';
function dropTarget(zone, onFile, app) {
  zone.addEventListener('dragover', e => { if (!e.dataTransfer?.types.includes('Files') && !e.dataTransfer?.types.includes(DH_FILE)) return; e.preventDefault(); e.stopPropagation(); delete $('#main').dataset.drop; zone.dataset.over = 'true'; });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.dataset.over = 'false'; });
  zone.addEventListener('drop', e => {
    const id = e.dataTransfer?.getData(DH_FILE);
    if (!id && !e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault(); e.stopPropagation(); zone.dataset.over = 'false';
    if (id) { const entry = JSON.parse(id); openFileIn(entry, app); } else onFile(e.dataTransfer.files[0]);
  });
}
async function readTable(f, cut = false) {
  if (!f) throw new Error('Choose a file.');
  if (!tabular(f.name)) throw new Error('Choose a CSV or XLSX file. Nothing was uploaded.');
  if (f.size > MAX_FILE_BYTES) throw new Error('This file exceeds 5 MiB. Split it and try again.');
  const table = /\.xlsx$/i.test(f.name) ? await parseXlsx(await f.arrayBuffer()) : parseCsv(await f.text());
  if (!cut) return wl.validateFileTable(table);
  // Workbench: the server refuses values over 1,000 characters, so the copy it is sent is cut; originals stay for the download.
  const long = new Set(), rows = table.rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => { const t = String(v ?? ''); if (t.length > 1000) long.add(k); return [k, t.length > 1000 ? t.slice(0, 1000) : v]; })));
  return {...wl.validateFileTable({...table, rows}), originals: table.rows, long};
}
function fileDrop(id, hint) {
  const drop = el('div', undefined, 'dropzone'), file = input('', 'file'); file.id = id; file.accept = '.csv,.xlsx';
  drop.append(icon(ICON.file), field('Drop a CSV or XLSX here, or choose a file', file), el('small', hint));
  return {drop, file};
}
const loadedText = n => `${n} ${n === 1 ? 'row' : 'rows'} loaded in your browser. Nothing is sent until you approve a run.`;

// The engine both Data Workbench and Deep Enrich share: quote a whole job, run it in chunks of 100, save the results.
// ui (Data Workbench only): boxes per stage, stage(name) to switch the visible stage, trace() for the run, report() for the results.
function jobEngine(w, box, runId, ui = {}) {
  let job = null, quotes = null, version = 0, busy = false, closed = false;
  const B = {quote: ui.boxes?.quote || box, run: ui.boxes?.run || box, results: ui.boxes?.results || box};
  const eb = t => ui.stage ? '' : eyebrow(t); // the Workbench stepper already names the stage
  const prior = w.cleanup; w.cleanup = () => { closed = true; prior?.(); };
  function reset() { version++; job = null; quotes = null; if (!busy) for (const b of new Set(Object.values(B))) b.replaceChildren(); }
  async function quote(next) {
    if (busy) return;
    if (!signedIn()) throw new Error('Sign in before requesting a quote. Your file is still only in your browser.');
    if (next.rows.length > wl.MAX_JOB_ROWS) throw new Error('A job takes up to 20,000 rows. Split the file and try again.');
    reset(); const v = version; ui.stage?.('quote'); B.quote.replaceChildren(); const wait = notice(B.quote, 'Pricing your job. Nothing runs yet.'); wait.classList.add('loading');
    const batches = chunk(next.rows, wl.CHUNK_ROWS), qs = [];
    try { qs.push(await session.api('quote', {rows: next.rows, columns: next.columns})); } // one quote covers the whole job
    catch (e) { if (v === version) { B.quote.replaceChildren(); notice(B.quote, errorText(e), true); } return; }
    if (closed || v !== version) return;
    job = {...next, batches}; quotes = qs; renderQuote();
  }
  function renderQuote() {
    const box = B.quote; box.replaceChildren(); const q = wl.quoteSummary(quotes), left = q.allowance.remaining_daily_micro ?? q.allowance.remaining_daily_credits * 1000;
    const k = job.batches.length;
    box.append(eb('Step 4 / Quote'), el('h3', 'Your quote'));
    box.append(metrics([['Up to', money(q.micro)], ['Rows', q.rows.toLocaleString('en-US')], ['Chunks of 100', String(k)], ['Left today after this job', money(Math.max(0, left - q.micro), 'down')]]));
    box.append(el('p', `${q.rows} rows in ${k} ${k === 1 ? 'chunk' : 'chunks'} of up to 100, run one after another. ${money(left, 'down')} left today before this job. Duplicate values in a chunk are billed once, and you pay what the providers actually charge, never more than this.`, 'plain'));
    box.append(table(['What happens', 'Column', 'Engine', 'Up to'], job.columns.map((c, i) => [wl.OP_LABEL[c.op] || c.op, c.column, wl.ENGINE_LABEL[c.engine] || c.engine, money(quotes.reduce((s, x) => s + (x.columns?.[i]?.max_cost_micro || 0), 0))]), 'Quote by operation'));
    if (q.reasons.length) { const n = notice(box, 'This job cannot run yet. ', true); n.append(q.reasons.join(' ')); }
    const run = button('Approve up to ' + money(q.micro) + ' and run', runAll, ui.stage ? 'btn btn-gold' : 'btn btn-green'); run.id = runId; run.disabled = q.reasons.length > 0; box.append(run);
    run.scrollIntoView({block: 'nearest'});
  }
  async function runAll() {
    if (busy || !job) return; busy = true; const {batches, columns, name, onSaved} = job, total = job.rows.length, jobId = crypto.randomUUID();
    const box = B.run; ui.stage?.('run'); box.replaceChildren(eb('Step 5 / Run'), el('h3', 'Running your job'));
    const bar = el('progress'); bar.max = total; bar.value = 0; bar.setAttribute('aria-label', 'Rows done');
    const line = el('p', `Chunk 1 of ${batches.length} running...`, 'run-line'); line.setAttribute('aria-live', 'polite'); box.append(bar, line);
    const trace = ui.trace?.(box, batches.length, total);
    const outputs = []; let stopped = null, pending = null, last = null, spent = 0, at = 0;
    try {
      for (let i = 0; i < batches.length; i++) {
        if (closed || !signedIn()) { stopped = 'The window closed or you signed out. Remaining chunks were not started.'; break; }
        at = i; trace?.chunk(i, 'running');
        const body = {tool_id: 'data-workbench', job_id: jobId, chunk_index: i, chunk_count: batches.length, source_name: name.replace(/\.(csv|xlsx)$/i, ''), request_id: crypto.randomUUID(), list_name: name, rows: batches[i], columns, max_credits: quotes[0].max_credits};
        pending = body; const result = await session.api('run', body); pending = null; last = result; spent += result.spent_micro || 0;
        const added = wl.resultRows(body.rows, columns, result.results); outputs.push(...added); bar.value = outputs.length; trace?.chunk(i, result.status, added, outputs.length - added.length, spent);
        line.textContent = `Chunk ${i + 1} of ${batches.length} ${result.status}. ${outputs.length} of ${total} rows done, ${money(spent)} spent.`;
        if (result.status !== 'completed') { stopped = 'Run stopped: ' + (result.error || result.status) + '. Finished results are kept. Held costs are not free.'; break; }
      }
    } catch (e) {
      stopped = errorText(e) + ' No further chunks were started.'; trace?.chunk(at, 'failed');
      if (pending) { const body = pending; box.append(button('Check or retry the same request', async () => { try { const r = await session.api('run', body); if (['new', 'running'].includes(r.status)) { notice(box, 'The original request is still running. Check again shortly.'); return; } outputs.push(...wl.resultRows(body.rows, columns, r.results)); results(outputs, null, 'Original request: ' + r.status + '. Remaining chunks were not run.'); await refreshUsage(); } catch (err) { notice(box, errorText(err), true); } })); }
    } finally { busy = false; }
    if (closed) return;
    if (stopped) notice(box, stopped, true);
    await results(outputs, last?.result_file, stopped ? null : `Done. ${outputs.length} rows, ${money(spent)} spent. Review the flags before you use the results.`, stopped);
    refreshUsage().catch(() => {}); onSaved?.();
  }
  async function results(outputs, savedFile, doneText, stopNote) {
    if (!outputs.length) return;
    // Long cells were cut to 1,000 characters for the providers; the download keeps the original values.
    if (job?.originals) outputs = outputs.map((r, i) => ({...r, ...job.originals[i]}));
    ui.stage?.('results'); B.run.querySelector('h3')?.replaceChildren('Job finished');
    const wrap = el('section', undefined, 'results'); B.results.append(wrap);
    wrap.append(eb('Step 6 / Results'), el('h3', ui.report ? 'Your report' : 'Results with review flags'));
    if (doneText) notice(wrap, doneText);
    if (stopNote && ui.stage) notice(wrap, stopNote, true);
    const headers = Object.keys(outputs[0]), csv = toCsv(headers, outputs), base = (job?.name || 'results').replace(/\.(csv|xlsx)$/i, '');
    const actions = el('div', undefined, 'toolbar'); wrap.append(actions);
    actions.append(button('Download CSV', () => saveBlob(new Blob([csv], {type: 'text/csv;charset=utf-8'}), base + ' results.csv'), 'btn btn-gold'));
    const saved = el('p', 'Saving to Files...', 'saved-line'); wrap.append(saved);
    ui.report?.(outputs, wrap, actions, base);
    wrap.append(table(headers, outputs.slice(0, 100).map(r => headers.map(h => r[h])), 'Results table'));
    if (outputs.length > 100) wrap.append(el('p', `Showing the first 100 of ${outputs.length} rows. The CSV has all of them.`, 'plain'));
    // The worker saves the whole job to Files and returns result_file on the last chunk.
    if (savedFile) { saved.textContent = 'Saved to Files: ' + savedFile.path; actions.append(button('Open in Files', () => openApp('files')?.go('/Workbench results'))); }
    else { saved.textContent = 'Not saved to Files because the job did not finish. Download the CSV instead.'; saved.classList.add('bad'); }
    wrap.scrollIntoView({block: 'start'});
  }
  return {quote, reset, busy: () => busy};
}

// 21st.dev Basic Stepper (29925), vanilla port: numbered circles, connecting line, check when done, active gold, future dim.
// Only stages already reached can be clicked; the rest are aria-disabled, never [disabled].
const CHECK = 'M7 16.5l6 6L25 10';
function stepper(names, onPick) {
  const ol = el('ol', undefined, 'stepper'); ol.setAttribute('aria-label', 'Workbench stages');
  const items = names.map((name, i) => {
    const li = el('li'), b = button('', () => { if (b.getAttribute('aria-disabled') !== 'true') onPick(i); }, 'step-btn');
    const dot = el('span', String(i + 1), 'step-dot'); dot.setAttribute('aria-hidden', 'true');
    b.append(dot, el('span', name, 'step-name')); li.append(b); ol.append(li); return {li, b, dot};
  });
  function at(n, reached) {
    items.forEach(({li, b, dot}, i) => {
      li.dataset.state = i === n ? 'active' : i < reached || i < n ? 'done' : 'todo'; // reached but not yet passed stays numbered
      dot.replaceChildren(li.dataset.state === 'done' ? icon(CHECK) : String(i + 1));
      if (i === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-disabled', String(i > reached));
      b.setAttribute('aria-label', `${i + 1}. ${names[i]}${li.dataset.state === 'done' ? ', done' : i > reached ? ', not reached yet' : ''}`);
    });
  }
  return {ol, at};
}
const ADDS = {normalize_title: () => 'a clean title, seniority and function', classify: p => 'one of: ' + (p.categories || 'your categories'), verify: () => 'a yes or no answer',
  research: p => p.output_columns ? 'columns: ' + p.output_columns : 'research answers', enrich: p => 'contact ' + p.fields.join(', '), verify_email: () => 'a deliverability verdict'};
const ENGINE_SHORT = {treg: 'Treg', jev: 'Jev', deepseek: 'DeepSeek'};
const STAGES = ['File', 'Columns', 'Ask', 'Quote', 'Run', 'Report'];

function workbench(w) {
  const root = w.body; root.classList.add('flow', 'wb');
  const head = el('header', undefined, 'app-head'); head.append(eyebrow('Data Workbench'), el('h3', 'Drop a messy list. Get it back clean and enriched.', 'app-title')); root.append(head);
  let current = 0, reached = 0;
  const steps = stepper(STAGES, i => go(i)); root.append(steps.ol);
  // One section per stage; only the active one is on screen.
  const S = STAGES.map((name, i) => { const sec = el('section', undefined, 'stage'); sec.dataset.stage = name.toLowerCase(); sec.setAttribute('aria-label', name); sec.hidden = i > 0; root.append(sec); return sec; });
  function go(i) { current = i; reached = Math.max(reached, i); toReport.hidden = reached < 5; S.forEach((sec, k) => { sec.hidden = k !== i; }); steps.at(i, reached); root.scrollTop = 0; }
  const foot = (...kids) => { const f = el('div', undefined, 'stage-foot'); f.append(...kids); return f; };
  const back = i => button('Back', () => go(i), 'btn btn-outline');
  const msgUnder = () => { const m = el('div', undefined, 'msg'); m.setAttribute('aria-live', 'polite'); return m; };
  const say = (m, text, bad = false) => { m.replaceChildren(); if (text) notice(m, text, bad); };
  steps.at(0, 0);

  // Stages 4 to 6 belong to the shared engine; Workbench gives it a box per stage and the trace and report hooks.
  const qBox = el('div'), rBox = el('div'), resBox = el('div');
  const toReport = button('See the report', () => go(5), 'btn btn-gold'); toReport.hidden = true;
  S[3].append(qBox, foot(back(2))); S[4].append(rBox, foot(back(3), toReport)); S[5].append(resBox, foot(back(2)));
  const eng = jobEngine(w, qBox, 'wb-run', {boxes: {quote: qBox, run: rBox, results: resBox}, stage: n => go({quote: 3, run: 4, results: 5}[n]), trace, report});

  let source = null, filename = '', fileSize = 0, turns = [], mapping = [], plan = [], specs = [], asking = false, manual = false, aiSpent = 0, aiModel = '';
  function changed() { eng.reset(); reached = Math.min(reached, current); steps.at(current, reached); }

  // ---- 1. File ----
  const {drop, file} = fileDrop('wb-file', 'Any CSV or XLSX up to 5 MiB. You see the price before anything runs.');
  const fileMsg = msgUnder(), fileInfo = el('div', undefined, 'file-info');
  const sample = button('Try the sample', async () => {
    try { const r = await fetch('/toolkit-sample-leads.csv'); if (!r.ok) throw new Error('HTTP ' + r.status); load(new File([await r.blob()], 'sample-leads.csv', {type: 'text/csv'})); }
    catch (e) { say(fileMsg, 'The sample did not load (' + e.message + '). Drop your own file instead.', true); }
  }, 'btn btn-outline'); sample.id = 'wb-sample';
  const toCols = button('Map the columns', () => go(1), 'btn btn-gold'); toCols.id = 'wb-to-columns';
  const fileFoot = foot(toCols); fileFoot.hidden = true;
  S[0].append(drop, fileMsg, el('div', undefined, 'or-row'), fileInfo, fileFoot); S[0].querySelector('.or-row').append(el('span', 'No file handy?'), sample);
  async function load(f) {
    if (eng.busy()) return;
    try { source = await readTable(f, true); } catch (e) { say(fileMsg, e.message, true); return; }
    filename = f.name; fileSize = f.size; turns = []; plan = []; manual = false; aiSpent = 0; aiModel = '';
    mapping = wl.guessFields(source.headers).map(m => ({...m, sure: wl.guessSure(m.field, samplesOf(m.source))}));
    eng.reset(); reached = 0; go(0); say(fileMsg, loadedText(source.rows.length));
    fileInfo.replaceChildren(metrics([['File', f.name], ['Rows', source.rows.length.toLocaleString('en-US')], ['Columns', String(source.headers.length)], ['Size', size(f.size)]]),
      el('h4', 'First 5 rows'), table(source.headers, source.rows.slice(0, 5).map(r => source.headers.map(h => r[h])), 'File preview'));
    fileFoot.hidden = false; S[0].querySelector('.or-row').hidden = true; reached = 1; steps.at(0, 1); renderColumns(); renderAsk(); toCols.focus();
  }
  w.load = load; file.addEventListener('change', () => load(file.files[0])); dropTarget(drop, load, 'workbench');
  function samplesOf(h) { const seen = new Set(); for (const r of source.originals) { const v = String(r[h] ?? '').trim(); if (v) seen.add(v); if (seen.size >= 3) break; } return [...seen]; }

  // ---- 2. Columns: 21st.dev Import Patchbay (26969), vanilla port. Source jack, cable, field socket. ----
  function renderColumns() {
    const n = source.rows.length, bay = el('div', undefined, 'patchbay'); bay.setAttribute('role', 'group'); bay.setAttribute('aria-label', 'Column mapping');
    for (const m of mapping) {
      const filled = source.originals.filter(r => String(r[m.source] ?? '').trim()).length, pct = n ? Math.round(filled / n * 100) : 0;
      const row = el('div', undefined, 'map-row'); row.dataset.source = m.source; row.dataset.keep = String(m.keep); row.dataset.sure = String(m.sure);
      const src = el('div', undefined, 'pb-src'); src.append(el('strong', m.source, 'map-source'));
      const sm = el('ul', undefined, 'pb-samples'); sm.setAttribute('aria-label', 'Sample values from ' + m.source);
      for (const v of samplesOf(m.source)) sm.append(el('li', v.length > 60 ? v.slice(0, 60) + '...' : v));
      if (!sm.childElementCount) sm.append(el('li', 'No values', 'empty'));
      const fill = el('p', undefined, 'pb-fill'); fill.append(el('span', `${pct}% filled`), el('span', undefined, 'pb-meter')); fill.lastChild.style.setProperty('--p', pct + '%');
      src.append(sm, fill);
      const cable = el('span', undefined, 'pb-cable'); cable.setAttribute('aria-hidden', 'true');
      const dst = el('div', undefined, 'pb-dst');
      const s = select(wl.FIELDS.map(f => [f, wl.FIELD_LABEL[f]]), m.field); s.setAttribute('aria-label', 'Field for ' + m.source);
      const tag = el('small', undefined, 'pb-tag'), paint = () => { s.disabled = !m.keep; tag.textContent = !m.keep ? 'Stays in your browser' : m.sure ? 'Matched' : 'Not sure, check it'; };
      s.addEventListener('change', () => { m.field = s.value; m.sure = true; row.dataset.sure = 'true'; paint(); changed(); });
      const keep = check('Keep', m.keep, v => { m.keep = v; row.dataset.keep = String(v); paint(); changed(); }); keep.querySelector('input').setAttribute('aria-label', 'Keep ' + m.source); paint();
      dst.append(s, tag, keep); row.append(src, cable, dst);
      if (source.long.has(m.source)) row.append(el('p', 'Long values are cut to 1,000 characters before they are sent; your download keeps the original.', 'pb-long'));
      bay.append(row);
    }
    const unsure = mapping.filter(m => !m.sure).map(m => m.source);
    const confirm = button('Confirm columns', () => { for (const m of mapping) m.sure = true; bay.querySelectorAll('.map-row').forEach(r => { r.dataset.sure = 'true'; }); go(2); S[2].querySelector('#wb-goal')?.focus(); }, 'btn btn-gold'); confirm.id = 'wb-confirm';
    S[1].replaceChildren(el('h3', 'Check how your columns line up'),
      el('p', `${mapping.length} columns. ${unsure.length ? 'Dashed means not sure, check: ' + unsure.join(', ') + '. ' : ''}Untick Keep for anything that should never leave your browser.`, 'plain'),
      bay, foot(back(0), confirm));
  }

  // ---- 3. Ask: 21st.dev AI Prompt Box (10442) with the Suggestions chips (12342), vanilla port on the site tokens. ----
  const askMsg = msgUnder(), planMsg = msgUnder();
  function renderAsk() {
    // The last exchange stays in view; older turns fold away so the plan cards stay near the quote button.
    const bubbles = list => { const ol = el('ol', undefined, 'chat-log'); for (const t of list) {
      const li = el('li', undefined, 'bubble ' + (t.role === 'user' ? 'from-user' : 'from-ai'));
      li.append(el('span', t.role === 'user' ? 'You' : 'Toolkit assistant', 'who'), el('p', t.reply ?? t.content));
      if (t.question) li.append(el('p', t.question, 'question'));
      ol.append(li); } return ol; };
    const log = el('div'); log.setAttribute('aria-live', 'polite');
    if (turns.length > 2) { const d = el('details', undefined, 'older'); d.append(el('summary', `Earlier messages (${turns.length - 2})`), bubbles(turns.slice(0, -2))); log.append(d); }
    log.append(bubbles(turns.slice(-2)));
    const chips = el('div', undefined, 'chips'); chips.setAttribute('aria-label', 'Suggestions');
    const lastAi = [...turns].reverse().find(t => t.role === 'assistant');
    for (const c of (turns.length ? lastAi?.chips || [] : wl.STARTER_CHIPS)) chips.append(button(c, () => send(c), 'chip'));
    const form = el('form', undefined, 'promptbox'), box = el('textarea'); box.id = 'wb-goal'; box.rows = 1; box.maxLength = 2000;
    box.placeholder = turns.length ? 'Answer, or ask for a change' : 'For example: clean up the job titles and tell me which companies are SaaS';
    box.setAttribute('aria-label', turns.length ? 'Your reply' : 'Describe the job in your own words');
    const grow = () => { box.style.height = 'auto'; box.style.height = Math.min(box.scrollHeight, 240) + 'px'; }; box.addEventListener('input', grow);
    const sendBtn = button('', () => {}, 'pb-send'); sendBtn.type = 'submit'; sendBtn.setAttribute('aria-label', asking ? 'Thinking' : 'Send'); sendBtn.append(icon('M16 26V7 M8 14l8-8 8 8')); sendBtn.dataset.busy = String(asking);
    const row = el('div', undefined, 'pb-row'); row.append(el('small', 'Enter to send, Shift Enter for a new line', 'pb-hint'), sendBtn);
    form.append(box, row);
    form.addEventListener('submit', e => { e.preventDefault(); send(box.value); });
    box.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(box.value); } });
    const meta = el('p', undefined, 'pb-meta');
    if (aiModel) { meta.append(el('span', aiModel, 'model-badge'), el('span', 'Assistant cost so far: ' + money(aiSpent), 'pb-cost')); }
    else meta.append(el('span', 'The assistant plans the job. It does not touch your cell values.', 'pb-cost'));
    const planBox = el('section', undefined, 'plan-box'); planBox.setAttribute('aria-label', 'The plan');
    if (plan.length || manual) {
      planBox.append(el('h4', plan.length ? 'The plan' : 'Build the plan'), el('p', 'Edit any card. Nothing runs until you approve the quote.', 'plain'));
      const ops = el('ol', undefined, 'plan'); plan.forEach((p, i) => ops.append(planCard(p, i)));
      if (!plan.length) ops.append(el('li', 'No operations yet. Add one.', 'empty'));
      const add = button('Add operation', () => { plan.push(wl.planItem({}, source.headers.filter(h => mapping.find(m => m.source === h)?.keep))); changed(); renderAsk(); }); add.disabled = plan.length >= 8;
      planBox.append(ops, el('div', undefined, 'toolbar'), planMsg); planBox.querySelector('.toolbar').append(add);
    } else planBox.append(button('Skip the assistant and set it up by hand', () => { manual = true; renderAsk(); }, 'btn btn-ghost link-btn'));
    const quote = button('Looks right, get the quote', getQuote, 'btn btn-gold'); quote.id = 'wb-quote';
    // The plan sits right under the conversation so the cards being approved stay next to the quote button.
    S[2].replaceChildren(el('h3', 'What should happen to this file?'), log, planBox, chips, form, meta, askMsg, el('p', wl.PRIVACY_LINE, 'privacy'), plan.length || manual ? foot(back(1), quote) : foot(back(1)));
    requestAnimationFrame(grow);
  }
  async function send(text) {
    text = String(text || '').trim(); if (!text || asking || !source) return;
    if (!signedIn()) { say(askMsg, 'Sign in to talk to the assistant, or set the plan up by hand below. Your file is still only in your browser.', true); manual = true; renderAsk(); return; }
    turns.push({role: 'user', content: text}); asking = true; say(askMsg, 'Thinking about your file...'); askMsg.firstChild.classList.add('loading'); renderAsk();
    try {
      const history = turns.slice(1).map(t => ({role: t.role, content: String(t.content).slice(0, 4000)})).slice(-12);
      const r = await session.api('intake', {file: wl.intakeFile(filename, source.headers, source.rows), goal: turns[0].content.slice(0, 2000), history});
      turns.push({role: 'assistant', content: [r.reply, r.question].filter(Boolean).join(' '), reply: r.reply, question: r.question, chips: r.chips || []});
      aiModel = r.model || aiModel; aiSpent += Number(r.cost_micro) || 0;
      // Confirmed columns stay as the user set them; the assistant's mapping only fills the plan.
      if (Array.isArray(r.plan) && r.plan.length) plan = r.plan.map(p => wl.planItem(p, source.headers));
      say(askMsg); changed(); refreshUsage().catch(() => {});
    } catch (e) {
      turns.pop();
      if (e.message === 'provider_not_configured') { manual = true; say(askMsg, 'The assistant is not switched on yet. Set it up by hand below.'); }
      else say(askMsg, errorText(e) + ' Try again, or set the plan up by hand below.', true);
    } finally { asking = false; renderAsk(); S[2].querySelector('#wb-goal')?.focus(); }
  }
  async function getQuote() {
    say(planMsg);
    try { specs = wl.planToSpecs(plan, mapping, source.headers); } catch (e) { say(planMsg, e.message, true); return; }
    const long = [...source.long].some(h => mapping.find(m => m.source === h)?.keep);
    try { await eng.quote({name: filename, rows: wl.keptRows(source.rows, mapping), originals: long ? wl.keptRows(source.originals, mapping) : null, columns: specs}); }
    catch (e) { go(2); say(planMsg, e.message, true); }
  }
  function planCard(p, i) {
    const li = el('li', undefined, 'op-card'); li.dataset.operation = i;
    const head = el('div', undefined, 'op-head'), sum = el('div', undefined, 'op-sum');
    const badge = el('span', ENGINE_SHORT[p.engine] || p.engine, 'engine-badge'); badge.dataset.engine = p.engine;
    sum.append(el('strong', (i + 1) + '. ' + (wl.OP_LABEL[p.op] || p.op)), badge, el('span', `on ${p.column || 'a column'}, adds ${ADDS[p.op]?.(p) || 'a column'}`, 'op-adds'));
    head.append(sum, button('Remove', () => { plan.splice(i, 1); changed(); renderAsk(); }, 'btn btn-ghost'));
    head.lastChild.setAttribute('aria-label', 'Remove operation ' + (i + 1)); li.append(head);
    const grid = el('div', undefined, 'form-grid'), redraw = () => { changed(); li.replaceWith(planCard(p, i)); };
    const col = select(source.headers.map(h => [h, h]), p.column), op = select(Object.keys(wl.OPS).map(k => [k, wl.OP_LABEL[k]]), p.op), engine = select(wl.OPS[p.op].map(e => [e, wl.ENGINE_LABEL[e]]), p.engine);
    col.addEventListener('change', () => { p.column = col.value; redraw(); });
    op.addEventListener('change', () => { p.op = op.value; p.engine = wl.OPS[p.op][0]; redraw(); });
    engine.addEventListener('change', () => { p.engine = engine.value; redraw(); });
    grid.append(field('Column', col), field('Operation', op), field('Engine', engine));
    const text = (label, key, multi) => { const n = multi ? el('textarea') : input(p[key]); if (multi) n.value = p[key]; n.maxLength = 1000; n.addEventListener('input', () => { p[key] = n.value; changed(); }); grid.append(field(label, n, multi ? 'wide' : '')); };
    if (p.op === 'classify') { text('What should decide the category?', 'instruction', true); text('Categories, separated by commas', 'categories'); }
    if (p.op === 'verify') text('Yes or no question', 'instruction', true);
    if (p.op === 'research') { text('Research question', 'instruction', true); text('Output column names, separated by commas', 'output_columns'); grid.append(check('Search the web (priced into the quote)', p.web, v => { p.web = v; changed(); })); }
    li.append(grid);
    if (p.op === 'enrich') { const c = el('div', undefined, 'checks'); c.append(el('span', 'Fields to add', 'field-label')); for (const k of ['name', 'title', 'company']) c.append(check(k[0].toUpperCase() + k.slice(1), p.fields.includes(k), v => { p.fields = v ? [...p.fields, k] : p.fields.filter(x => x !== k); changed(); })); li.append(c); }
    if (p.op === 'verify_email') li.append(el('p', 'Checks each address with the provider. Not a model guess.', 'plain'));
    return li;
  }

  // ---- 5. Run: ReUI trace CSV import (40158), vanilla port. Per chunk bars, counters, flagged rows as they arrive. ----
  function trace(box, count, total) {
    const nums = metrics([['Rows done', '0 of ' + total.toLocaleString('en-US')], ['Spent so far', money(0)], ['Flagged for review', '0'], ['Skipped or not run', '0']]); nums.classList.add('trace-nums');
    const dd = [...nums.querySelectorAll('dd')];
    const list = el('ol', undefined, 'trace'); list.setAttribute('aria-label', 'Chunks');
    const items = Array.from({length: count}, (_, i) => { const li = el('li'); li.dataset.state = 'waiting'; const bar = el('progress'); bar.max = Math.min(wl.CHUNK_ROWS, total - i * wl.CHUNK_ROWS); bar.value = 0; bar.setAttribute('aria-label', 'Chunk ' + (i + 1)); const st = el('span', 'waiting', 'trace-state'); li.append(el('span', 'Chunk ' + (i + 1), 'trace-name'), bar, st); list.append(li); return {li, bar, st}; });
    const flags = el('ul', undefined, 'trace-flags'); flags.setAttribute('aria-live', 'polite'); flags.setAttribute('aria-label', 'Flagged rows');
    box.append(nums, list, el('h4', 'Flagged as they arrive'), flags);
    let flagged = 0, skipped = 0, shown = 0;
    return {chunk(i, state, rows = [], offset = 0, spent = 0) {
      const it = items[i]; if (!it) return;
      it.li.dataset.state = state; it.st.textContent = state;
      if (state === 'running') { it.li.scrollIntoView?.({block: 'nearest'}); return; }
      it.bar.value = rows.length; dd[0].textContent = (offset + rows.length).toLocaleString('en-US') + ' of ' + total.toLocaleString('en-US'); dd[1].textContent = money(spent);
      rows.forEach((r, k) => {
        const keys = Object.keys(r), why = keys.filter(h => / \/ review$/.test(h) && r[h] === 'Review needed').map(h => h.replace(/ \/ review$/, ''));
        skipped += keys.filter(h => /^Result \d+: [^/]+ \/ [^/]+$/.test(h)).some(h => ['skipped', 'not_run'].includes(r[h])) ? 1 : 0;
        if (!why.length) return; flagged++;
        if (shown++ < 50) flags.append(el('li', `Row ${offset + k + 1}: ${why.join(', ')}`));
      });
      dd[2].textContent = String(flagged); dd[3].textContent = String(skipped);
      if (!flags.childElementCount) flags.replaceChildren(el('li', 'Nothing flagged yet.', 'empty'));
      else flags.querySelector('.empty')?.remove();
    }};
  }

  // ---- 6. Report: counted in the browser from the result rows; SPAN data-card style, three exports. ----
  function report(outputs, wrap, actions, base) {
    const kept = mapping.filter(m => m.keep).map(m => m.source);
    const brief = wl.agentBrief({name: filename, rows: source.rows.length, columns: source.headers.length, size_bytes: fileSize}, mapping, specs, wl.reportAggregates(source.originals, outputs, kept));
    const cards = el('div', undefined, 'rp-grid'); cards.innerHTML = wl.reportCards(brief); // every value passes through esc()
    actions.append(button('Download report', () => saveBlob(new Blob([wl.reportHtml(brief)], {type: 'text/html;charset=utf-8'}), base + ' report.html')),
      button('Agent brief (JSON)', () => saveBlob(new Blob([JSON.stringify(brief, null, 2)], {type: 'application/json'}), base + ' brief.json')));
    wrap.append(cards, el('h4', 'Result rows'));
  }
}

function enrichApp(w) {
  const root = w.body; root.classList.add('flow');
  const head = el('header', undefined, 'app-head'); head.append(eyebrow('Deep Enrich'), el('h3', 'Add contact data and research answers to a list.', 'app-title')); root.append(head);
  if (!requireSignIn(root)) return;
  const msg = el('div', undefined, 'msg'); msg.setAttribute('aria-live', 'polite');
  const {drop, file} = fileDrop('en-file', 'Up to 5 MiB. Pick the columns, choose what to add, approve the quote.'); root.append(drop, msg);
  const form = el('div', undefined, 'enrich-form'), engineBox = el('section', undefined, 'engine'); root.append(form, engineBox);
  const eng = jobEngine(w, engineBox, 'en-run');
  let source = null, filename = '';
  const message = (text, bad = false) => { msg.replaceChildren(); notice(msg, text, bad); };
  async function load(f) {
    if (eng.busy()) return;
    try { source = await readTable(f); } catch (e) { message(e.message, true); return; }
    filename = f.name; eng.reset(); message(loadedText(source.rows.length)); render();
  }
  w.load = load; file.addEventListener('change', () => load(file.files[0])); dropTarget(drop, load, 'enrich');
  function render() {
    form.replaceChildren();
    const guess = wl.guessFields(source.headers), pick = f => guess.find(m => m.field === f)?.source || '';
    const opts = [['', 'Not in this file'], ...source.headers.map(h => [h, h])];
    const cols = {email: select(opts, pick('email')), person_name: select(opts, pick('person_name')), domain: select(opts, pick('domain')), company: select(opts, pick('company'))};
    const grid = el('div', undefined, 'form-grid'); grid.append(field('Email column', cols.email), field('Person name column', cols.person_name), field('Company domain column', cols.domain), field('Company column', cols.company));
    const treg = el('fieldset', undefined, 'pick'); treg.append(el('legend', 'Contact data: ' + wl.ENGINE_LABEL.treg));
    const want = {name: true, title: true, company: false, email: false};
    for (const [k, label] of [['name', 'Name'], ['title', 'Title'], ['company', 'Company'], ['email', 'Email check']]) treg.append(check(label, want[k], v => { want[k] = v; eng.reset(); }));
    const ds = el('fieldset', undefined, 'pick'); ds.append(el('legend', 'Research: ' + wl.ENGINE_LABEL.deepseek));
    const questions = [1, 2, 3].map(n => { const q = input(); q.maxLength = 1000; q.placeholder = n === 1 ? 'For example: Is this company B2B SaaS?' : ''; q.addEventListener('input', () => eng.reset()); ds.append(field('Research question ' + n, q)); return q; });
    let web = false; ds.append(check('Search the web (priced into the quote)', false, v => { web = v; eng.reset(); }));
    for (const s of Object.values(cols)) s.addEventListener('change', () => eng.reset());
    const go = button('Get quote', async () => {
      try {
        const mapping = source.headers.map(h => ({source: h, field: Object.keys(cols).find(k => cols[k].value === h) || 'other', keep: true})), plan = [];
        const fields = ['name', 'title', 'company'].filter(k => want[k]), idCol = cols.email.value || cols.domain.value;
        if (fields.length) { if (!idCol) throw new Error('Contact data needs an email column, or a company domain column plus a person name column.'); plan.push(wl.planItem({column: idCol, op: 'enrich', engine: 'treg', fields}, source.headers)); }
        if (want.email) { if (!cols.email.value) throw new Error('Choose the email column for the email check.'); plan.push(wl.planItem({column: cols.email.value, op: 'verify_email', engine: 'treg'}, source.headers)); }
        const about = cols.company.value || cols.domain.value;
        questions.map(q => q.value.trim()).filter(Boolean).forEach((q, i) => { if (!about) throw new Error('Research needs a company or company domain column.'); plan.push(wl.planItem({column: about, op: 'research', engine: 'deepseek', instruction: q, output_columns: 'Answer ' + (i + 1), web}, source.headers)); });
        if (!plan.length) throw new Error('Choose at least one contact field or write a research question.');
        await eng.quote({name: filename, rows: source.rows, columns: wl.planToSpecs(plan, mapping, source.headers)});
      } catch (e) { message(e.message, true); }
    }, 'btn btn-gold'); go.id = 'en-quote';
    form.append(el('h4', 'Columns'), grid, treg, ds, go);
  }
}

function filesApp(w) {
  const root = w.body; root.classList.add('files');
  if (!requireSignIn(root)) { w.go = () => {}; return; }
  let folder = '/', entries = [], busy = false;
  const bar = el('div', undefined, 'files-bar'), crumbs = el('nav', undefined, 'crumbs'), tools = el('div', undefined, 'toolbar');
  crumbs.setAttribute('aria-label', 'Folder path');
  const upload = input('', 'file'); upload.id = 'files-upload'; upload.accept = '.csv,.xlsx,.json,.txt,.md,.pdf';
  const uploadLabel = el('label', undefined, 'btn btn-outline file-btn'); uploadLabel.append('Upload', upload);
  tools.append(button('New folder', newFolder, 'btn btn-outline'), uploadLabel);
  bar.append(crumbs, tools);
  const msg = el('div', undefined, 'msg'); msg.setAttribute('aria-live', 'polite');
  const form = el('div'), listBox = el('ul', undefined, 'files-list'), quota = el('p', undefined, 'quota');
  root.append(bar, msg, form, listBox, quota);
  const message = (text, bad = false) => { msg.replaceChildren(); if (text) notice(msg, text, bad); };
  const join = (base, name) => (base === '/' ? '' : base) + '/' + name;
  const parentOf = path => path.replace(/\/[^/]+$/, '') || '/';
  async function act(fn, done) { if (busy) return; busy = true; try { await fn(); await go(folder, true); if (folder === '/' || done) await refreshDesktopFiles(); if (done) message(done); } catch (e) { message(errorText(e), true); } finally { busy = false; } }
  function droppable(node, path) {
    node.addEventListener('dragover', e => { if (!e.dataTransfer.types.includes(DH_FILE)) return; e.preventDefault(); node.dataset.over = 'true'; });
    node.addEventListener('dragleave', () => { node.dataset.over = 'false'; });
    node.addEventListener('drop', e => { const raw = e.dataTransfer.getData(DH_FILE); if (!raw) return; e.preventDefault(); e.stopPropagation(); node.dataset.over = 'false'; const entry = JSON.parse(raw); if (entry.path === path || parentOf(entry.path) === path || path.startsWith(entry.path + '/')) return; act(() => session.api('files_move', {id: entry.id, folder: path}), `Moved ${entry.name} to ${path}.`); });
  }
  async function go(path = folder, keepMessage = false) {
    folder = path; if (!keepMessage) message('');
    crumbs.replaceChildren(); let acc = '';
    for (const part of ['/', ...path.split('/').filter(Boolean)]) { acc = part === '/' ? '/' : join(acc, part); const target = acc; const b = button(part === '/' ? 'Files' : part, () => go(target), 'crumb'); if (target === path) b.setAttribute('aria-current', 'location'); droppable(b, target); crumbs.append(b); }
    listBox.replaceChildren(el('li', 'Loading ' + path + '...', 'empty'));
    try { const r = await session.api('files_list', {folder: path}); entries = r.entries || []; quota.textContent = `${size(r.used_bytes)} of ${size(r.quota_bytes)} used. Files up to 10 MB: CSV, XLSX, JSON, TXT, MD, PDF.`; render(); }
    catch (e) { listBox.replaceChildren(); message(errorText(e), true); }
  }
  w.go = path => go(path);
  function render() {
    listBox.replaceChildren();
    if (!entries.length) { listBox.append(el('li', 'This folder is empty. Upload a file, drop one on the desktop, or run a Workbench job.', 'empty')); return; }
    for (const entry of [...entries].sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'folder' ? -1 : 1))) {
      const li = el('li', undefined, 'file-row'); li.dataset.entry = entry.id; li.dataset.kind = entry.kind; li.draggable = true;
      li.addEventListener('dragstart', e => { e.dataTransfer.setData(DH_FILE, JSON.stringify(entry)); e.dataTransfer.effectAllowed = 'move'; });
      if (entry.kind === 'folder') droppable(li, entry.path);
      const sym = el('span', undefined, 'file-sym'); sym.append(icon(ICON[entry.kind === 'folder' ? 'folder' : 'file']));
      const open = button(entry.name, () => openEntry(entry), 'file-name'); open.setAttribute('aria-label', (entry.kind === 'folder' ? 'Open folder ' : tabular(entry.name) ? 'Open in Data Workbench ' : 'Download ') + entry.name);
      const meta = el('span', entry.kind === 'folder' ? 'Folder' : size(entry.size) + ' / ' + age(entry.updated), 'file-meta');
      const acts = el('span', undefined, 'file-acts');
      acts.append(button('Rename', () => rename(li, entry), 'btn btn-ghost'));
      if (entry.kind === 'file') acts.append(button('Download', () => download(entry), 'btn btn-ghost'));
      acts.append(button('Delete', () => confirmDelete(li, entry), 'btn btn-ghost danger'));
      for (const b of acts.children) b.setAttribute('aria-label', b.textContent + ' ' + entry.name);
      li.append(sym, open, meta, acts); listBox.append(li);
    }
  }
  function inline(li, label, value, verb, onOk) {
    const f = el('form', undefined, 'inline-form'), name = input(value); name.maxLength = 120; name.required = true;
    const ok = button(verb, () => {}, 'btn btn-gold'); ok.type = 'submit';
    f.append(field(label, name), ok, button('Cancel', () => { f.remove(); li?.removeAttribute('data-editing'); }, 'btn btn-ghost'));
    f.addEventListener('submit', e => { e.preventDefault(); const v = name.value.trim(); if (!v || /[/\\]/.test(v)) { message('Use a name without slashes.', true); return; } f.remove(); onOk(v); });
    (li || form).append(f); li?.setAttribute('data-editing', 'true'); name.focus(); name.select();
  }
  function newFolder() { form.replaceChildren(); inline(null, 'New folder name', 'New folder', 'Create folder', v => act(() => session.api('files_mkdir', {path: join(folder, v)}), `Created ${v}.`)); }
  function rename(li, entry) { inline(li, 'New name for ' + entry.name, entry.name, 'Save name', v => act(() => session.api('files_move', {id: entry.id, name: v}), `Renamed to ${v}.`)); }
  function confirmDelete(li, entry) {
    const c = el('div', undefined, 'confirm'); c.setAttribute('role', 'alertdialog'); c.setAttribute('aria-label', 'Confirm delete');
    c.append(el('p', entry.kind === 'folder' ? `Delete the folder ${entry.name} and everything inside it? This cannot be undone.` : `Delete ${entry.name}? This cannot be undone.`));
    const yes = button('Delete for good', () => act(() => session.api('files_delete', {id: entry.id}), `Deleted ${entry.name}.`), 'btn btn-danger');
    c.append(yes, button('Keep it', () => c.remove(), 'btn btn-ghost')); li.append(c); yes.focus();
  }
  upload.addEventListener('change', () => { const f = upload.files[0]; if (f) act(() => saveFile(folder, f), `Uploaded ${f.name}.`); upload.value = ''; });
  go('/');
}

function account(w) {
  const b = w.body; if (!requireSignIn(b)) return;
  const head = el('div', undefined, 'app-head row'); head.append(el('h3', 'Balance and runs', 'app-title'));
  const refresh = button('Refresh account', load); head.append(refresh); b.append(head);
  const content = el('div'); b.append(content);
  async function load() {
    refresh.disabled = true;
    try {
      await refreshUsage(); if (!w.node.isConnected) return; content.replaceChildren(); const u = usage.usage;
      content.append(metrics([['Available balance', money(u.credits_available * 1000, 'down')], ['Spent today', money(u.spent_micro)], ['Held, not free', money(u.held_micro)]]));
      content.append(el('p', 'Daily spending cap: ' + money(u.daily_credit_cap * 1000) + '. Used: ' + money(u.credits_used * 1000) + '. Resets at 00:00 UTC.', 'plain'));
      const meter = el('progress'); meter.max = u.daily_credit_cap || 1; meter.value = u.credits_used + u.credits_held; meter.setAttribute('aria-label', 'Daily allowance used and held'); content.append(meter, el('h3', 'Run history'));
      if (!usage.runs.length) notice(content, 'No runs yet. Start in Data Workbench to get a quote.');
      else content.append(table(['Run', 'Status', 'Rows', 'Spent', 'Held', 'When'], usage.runs.map(r => [r.list_name || r.tool_id, r.status, r.row_count, money(r.spent_micro), money(r.held_micro), age(r.created_at)]), 'Run history'));
    } catch (e) { notice(content, errorText(e), true); } finally { refresh.disabled = false; }
  }
  load();
}

function admin(w) {
  const b = w.body; if (!usage?.user.is_admin) return;
  const tabs = el('div', undefined, 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Admin sections');
  const msg = el('div', undefined, 'msg'); msg.setAttribute('aria-live', 'polite');
  const status = (text, bad = false) => { msg.replaceChildren(); notice(msg, text, bad); };
  const panels = {}; b.append(tabs, msg);
  const sections = [['limits', 'Credits and limits', limits], ['users', 'Users', users], ['models', 'Models', models], ['log', 'AI log', aiLog]];
  for (const [key, label, render] of sections) {
    const t = button(label, () => show(key), 'tab'); t.setAttribute('role', 'tab'); t.id = 'tab-' + key; t.dataset.tab = key; tabs.append(t);
    const p = el('div', undefined, 'tab-panel'); p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', t.id); p.hidden = true; panels[key] = {p, t, render}; b.append(p);
  }
  function show(key) { msg.replaceChildren(); for (const [k, x] of Object.entries(panels)) { x.p.hidden = k !== key; x.t.setAttribute('aria-selected', String(k === key)); } panels[key].p.replaceChildren(); return panels[key].render(panels[key].p); }
  tabs.addEventListener('keydown', e => { const d = {ArrowRight: 1, ArrowLeft: -1}[e.key]; if (!d) return; const keys = sections.map(s => s[0]), i = keys.indexOf(document.activeElement.dataset.tab); const next = keys[(i + d + keys.length) % keys.length]; show(next); panels[next].t.focus(); });
  function limits(p) {
    let grantKey = null, grantPayload = null;
    p.append(el('p', 'Money values are dollars. Daily user caps cannot exceed $1 here. Zero turns an allowance off.', 'plain'));
    const grant = el('form', undefined, 'card-form'), email = input('', 'email'), amount = input('', 'number'), reason = input();
    amount.min = '.01'; amount.max = '100'; amount.step = '.01'; email.required = amount.required = reason.required = true; reason.maxLength = 200;
    const grid = el('div', undefined, 'form-grid'); grid.append(field('Grant to verified email', email), field('Amount in dollars', amount), field('Reason', reason));
    const submit = button('Grant credits', () => {}, 'btn btn-gold'); submit.type = 'submit'; grant.append(el('h4', 'Grant credits'), grid, submit); p.append(grant);
    grant.addEventListener('input', () => { grantKey = null; grantPayload = null; });
    grant.addEventListener('submit', async e => { e.preventDefault(); submit.disabled = true; try { const credits = Math.round(Number(amount.value) * 1000); if (!Number.isSafeInteger(credits) || credits < 10 || credits > 100000) throw new Error('Enter $0.01 to $100.'); grantKey ??= crypto.randomUUID(); grantPayload ??= {target_email: email.value.trim(), credits, reason: reason.value.trim(), idempotency_key: grantKey}; const r = await session.api('admin_grant', grantPayload); status((r.replayed ? 'Existing grant confirmed.' : 'Grant recorded.') + ' Recipient balance: ' + money(r.credits_available * 1000, 'down') + '.'); grantKey = null; grantPayload = null; grant.reset(); } catch (err) { status(errorText(err) + '. Retry keeps the same grant key.', true); } finally { submit.disabled = false; } });
    const defaults = el('div'); p.append(defaults);
    (async () => {
      try {
        const global = (await session.api('admin_usage', {})).global; if (!w.node.isConnected) return;
        const f = el('form', undefined, 'card-form'), g = el('div', undefined, 'form-grid'), fields = {};
        for (const [key, label, value, factor, max] of [['welcome_credits', 'Welcome credit grant ($)', global.welcome_credits, 1000, 100], ['default_daily_credit_cap', 'Default daily user cap ($)', global.default_daily_credit_cap, 1000, 1], ['global_daily_cap_micro', 'Shared daily provider cap ($)', global.daily_cap_micro, 1e6, 1000], ['default_daily_row_cap', 'Default daily row cap', global.default_daily_row_cap, 1, 100000], ['trial_pool_credits', 'Total welcome credit pool ($)', global.trial_pool_credits, 1000, 100000]]) { const n = input(String(value / factor), 'number'); n.min = '0'; n.max = String(max); n.step = factor === 1 ? '1' : '.001'; fields[key] = {n, factor, src: key === 'global_daily_cap_micro' ? 'daily_cap_micro' : key}; g.append(field(label, n)); }
        const save = button('Save default allowances', () => {}, 'btn btn-gold'); save.type = 'submit'; f.append(el('h4', 'Default allowances'), g, save);
        f.addEventListener('submit', async e => { e.preventDefault(); save.disabled = true; try { const want = Object.fromEntries(Object.entries(fields).map(([k, {n, factor}]) => [k, Math.round(Number(n.value) * factor)])); await session.api('admin_update', want); const back = (await session.api('admin_usage', {})).global; const off = []; for (const [k, {n, factor, src}] of Object.entries(fields)) { n.value = String(back[src] / factor); if (back[src] !== want[k]) off.push(k); } status(off.length ? 'Saved, but the server reports different values for ' + off.join(', ') + '. The fields now show what it stored.' : 'Default allowances saved and read back.', !!off.length); } catch (err) { status(errorText(err), true); } finally { save.disabled = false; } });
        defaults.append(f);
      } catch (e) { status(errorText(e), true); }
    })();
  }
  function users(p) {
    let page = 1;
    const head = el('div', undefined, 'app-head row'); head.append(el('p', 'Caps and the disabled switch live here. Removing a person happens in Clerk.', 'plain'));
    const clerk = el('a', 'Manage in Clerk', 'btn btn-outline'); clerk.href = 'https://dashboard.clerk.com/'; clerk.target = '_blank'; clerk.rel = 'noopener noreferrer'; head.append(clerk);
    const list = el('div'), nav = el('div', undefined, 'toolbar'), prev = button('Previous users', () => { page--; load(); }), next = button('Next users', () => { page++; load(); });
    nav.append(prev, next); p.append(head, list, nav);
    async function load() {
      try {
        const r = await session.api('admin_users', {page}); if (!w.node.isConnected) return; list.replaceChildren();
        if (!r.users.length) notice(list, 'No users on this page.');
        else list.append(table(['User', 'Balance / spent today', 'Daily cap ($)', 'Disabled', 'Action'], r.users.map(u => {
          const cap = input(String(u.effective_daily_credit_cap / 1000), 'number'); cap.min = '0'; cap.max = '1'; cap.step = '.001'; cap.setAttribute('aria-label', 'Daily dollar cap for ' + (u.email || u.id));
          const disabled = input('', 'checkbox'); disabled.checked = !!u.disabled; disabled.setAttribute('aria-label', 'Disable ' + (u.email || u.id));
          const save = button('Save user', async () => { if (!cap.reportValidity()) return; save.disabled = true; try { await session.api('admin_update', {user_id: u.id, daily_credit_cap: Math.round(Number(cap.value) * 1000), disabled: disabled.checked}); await load(); status('User settings saved and read back.'); } catch (err) { status(errorText(err), true); } finally { save.disabled = false; } });
          return [u.email || u.id, money(u.credits_available * 1000, 'down') + ' / ' + money(u.spent_micro_today), cap, disabled, save];
        }), 'Users'));
        prev.disabled = page <= 1; next.disabled = !r.has_more;
      } catch (e) { status(errorText(e), true); }
    }
    load();
  }
  const price = m => m ? `${money(m.prompt_micro_per_mtok)} in, ${money(m.completion_micro_per_mtok)} out per 1M tokens` : 'price unknown';
  function models(p) {
    p.append(el('p', 'Pick the model for the intake chat and for DeepSeek operations. The server checks the id with OpenRouter and stores its price.', 'plain'));
    const box = el('form', undefined, 'card-form'); p.append(box);
    // resolves with the settings it rendered, so a save can read them back
    return (async () => {
      try {
        const r = await session.api('admin_settings_get', {}); if (!w.node.isConnected) return;
        const settings = r.settings || {}, all = r.models || [], byId = new Map(all.map(m => [m.id, m])), picks = {};
        for (const [key, label] of [['intake_model', 'Intake model (the chat that plans a job)'], ['research_model', 'Research model (DeepSeek operations)']]) {
          const current = r.settings?.[key] || '', wrap = el('div', undefined, 'model-pick');
          const search = input('', 'search'); search.placeholder = 'Search ' + all.length + ' models';
          const list = el('select'); list.size = 6; list.setAttribute('aria-label', label);
          const fill = () => { const q = search.value.trim().toLowerCase(), keep = list.value || current; list.replaceChildren(...all.filter(m => !q || m.id.toLowerCase().includes(q) || m.id === keep).slice(0, 200).map(m => new Option(m.id + '  /  ' + price(m), m.id))); list.value = keep; };
          search.addEventListener('input', fill); fill();
          const now = el('p', 'Current: ' + (current || 'not set') + (current ? ', ' + price(byId.get(current)) : ''), 'plain');
          wrap.append(el('h4', label), now, field('Search models for ' + label.split(' (')[0].toLowerCase(), search), list); box.append(wrap); picks[key] = list;
        }
        const save = button('Save models', () => {}, 'btn btn-gold'); save.type = 'submit'; box.append(save);
        box.addEventListener('submit', async e => { e.preventDefault(); save.disabled = true; try { const want = Object.fromEntries(Object.entries(picks).map(([k, s]) => [k, s.value])); await session.api('admin_settings_set', want); const back = await show('models'); if (!back) return; const off = Object.keys(want).filter(k => back[k] !== want[k]); status(off.length ? 'Saved, but the server now reports ' + off.map(k => k + ' = ' + (back[k] || 'not set')).join(', ') + '.' : 'Models saved and read back.', !!off.length); } catch (err) { status(errorText(err), true); } finally { save.disabled = false; } });
        return settings;
      } catch (e) { status(errorText(e), true); }
    })();
  }
  function aiLog(p) {
    let page = 1;
    const f = el('form', undefined, 'filters'), user = input(), action = select([['', 'All actions'], ['intake', 'Intake chat'], ['run', 'Run'], ['quote', 'Quote']]), since = input('', 'date');
    const apply = button('Apply filters', () => {}, 'btn btn-outline'); apply.type = 'submit';
    const exp = button('Export JSONL', exportLog, 'btn btn-gold');
    f.append(field('User id', user), field('Action', action), field('Since', since), apply, exp);
    f.addEventListener('submit', e => { e.preventDefault(); page = 1; load(); });
    const list = el('div'), nav = el('div', undefined, 'toolbar'), prev = button('Previous page', () => { page--; load(); }), next = button('Next page', () => { page++; load(); });
    nav.append(prev, next); p.append(el('p', 'One row per model call. Cell values are never logged, only [value].', 'plain'), f, list, nav);
    const sinceIso = () => since.value ? since.value + 'T00:00:00Z' : undefined;
    async function load() {
      try {
        const body = {page}; if (user.value.trim()) body.user_id = user.value.trim(); if (action.value) body.filter_action = action.value; if (sinceIso()) body.since = sinceIso();
        const r = await session.api('admin_ai_log', body); if (!w.node.isConnected) return; const rows = r.rows || [];
        list.replaceChildren(rows.length ? table(['When', 'User', 'Action', 'Operation', 'Engine', 'Model', 'Tokens in', 'Tokens out', 'Cost', 'Outcome'], rows.map(x => [x.ts ? new Date(x.ts).toISOString().replace('T', ' ').slice(0, 16) : '', x.user_id, x.action, x.op || '', x.engine || '', x.model || '', x.tokens_in ?? '', x.tokens_out ?? '', money(x.cost_micro), x.outcome || '']), 'AI log') : el('p', 'No model calls match these filters.', 'notice'));
        prev.disabled = page <= 1; next.disabled = r.has_more === undefined ? rows.length < 50 : !r.has_more;
      } catch (e) { status(errorText(e), true); }
    }
    async function exportLog() {
      exp.disabled = true;
      try { // No date picked: export the whole 180-day retention window.
      const body = await session.apiText('admin_ai_log_export', {since: sinceIso() || new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10)}); saveBlob(new Blob([body], {type: 'application/x-ndjson'}), 'toolkit-ai-log-' + new Date().toISOString().slice(0, 10) + '.jsonl'); status('Exported ' + body.split('\n').filter(Boolean).length + ' rows.'); }
      catch (e) { status(errorText(e), true); } finally { exp.disabled = false; }
    }
    load();
  }
  show('limits');
}
layoutIcons();
connect();
