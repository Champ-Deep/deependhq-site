// toolkit-lib.js : pure helpers shared by the Lead Scorer and account pages.
// No DOM, no network, no state. Everything here is covered by
// tests/toolkit-lib.test.js (node --test tests/).

export const MICRO_PER_CREDIT = 1000; // 1 credit = 1000 USD microdollars of provider budget
export const MAX_BATCH = 5;           // server contract: at most 5 rows per run call
export const MAX_FILE_ROWS = 1000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const CANONICAL = new Set(['name', 'email', 'title', 'company', 'domain', 'linkedin']);
const MAX_COLS = 30;
const MAX_VALUE_CHARS = 1000;
const MAX_ROW_CHARS = 6000;

// ------------------------------------------------------------------ money

// Settlement always rounds up: a partial credit of a milli-dollar still costs a credit.
export function creditsFromMicro(micro) {
  return Math.max(0, Math.ceil((Number(micro) || 0) / MICRO_PER_CREDIT));
}

// Exact cents print as cents, anything finer keeps four decimals so a
// 6000 micro quote never renders as "$0.01".
export function formatUsd(micro) {
  const m = Math.round(Number(micro) || 0);
  const v = m / 1e6;
  return '$' + (m % 10000 === 0 ? v.toFixed(2) : v.toFixed(4));
}

export function formatCredits(n) {
  return String(Math.max(0, Math.round(Number(n) || 0)))
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// -------------------------------------------------------------------- CSV

function detectDelim(text) {
  // First line only, quotes respected, so a comma inside a quoted header cell
  // cannot flip the delimiter choice.
  let inq = false;
  let line = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') inq = !inq;
    if (ch === '\n' && !inq) break;
    line += ch;
  }
  let best = ',';
  let bestCount = 0;
  for (const cand of [',', '\t', ';']) {
    let inq2 = false;
    let count = 0;
    for (const ch of line) {
      if (ch === '"') inq2 = !inq2;
      else if (ch === cand && !inq2) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = cand;
    }
  }
  return best;
}

function tokenize(text, delim) {
  const out = [];
  let row = [];
  let cell = '';
  let inq = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inq) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inq = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') inq = true; // quotes are only special at field start
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

function uniqueHeaders(raw) {
  const seen = new Map();
  const out = [];
  raw.forEach((h0, i) => {
    let h = String(h0 ?? '').trim();
    if (!h) h = 'col ' + (i + 1);
    if (!seen.has(h)) {
      seen.set(h, 1);
      out.push(h);
      return;
    }
    let n = seen.get(h) + 1;
    let cand = h + ' (' + n + ')';
    while (seen.has(cand)) {
      n++;
      cand = h + ' (' + n + ')';
    }
    seen.set(h, n);
    seen.set(cand, 1);
    out.push(cand);
  });
  return out;
}

export function parseCsv(text) {
  let src = String(text ?? '');
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const table = tokenize(src, detectDelim(src));
  const headers = uniqueHeaders(table.shift() || []);
  const rows = [];
  for (const cells of table) {
    if (cells.every((c) => c === '')) continue; // blank line
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? '';
    });
    for (let i = headers.length; i < cells.length; i++) obj['col ' + (i + 1)] = cells[i];
    rows.push(obj);
  }
  return { headers, rows };
}

// Spreadsheet formula injection guard: any cell a sheet would evaluate gets a
// leading apostrophe. Numbers pass through untouched.
function csvCell(v) {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  let s = String(v ?? '');
  if (/^[ \t\r]*[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(headers, rows) {
  const out = [headers.map(csvCell).join(',')];
  for (const r of rows || []) {
    out.push(headers.map((h) => (r ? r[h] : '') ?? '').map(csvCell).join(','));
  }
  return out.join('\n') + '\n';
}

// ---------------------------------------------------------------- mapping

const FIELDS = {
  email: ['email', 'business email', 'work email', 'email address', 'e-mail'],
  linkedin: ['linkedin', 'linkedin url', 'profile url', 'prospect url', 'linkedin profile', 'li url'],
  domain: ['domain', 'website', 'company url', 'company website', 'url', 'web'],
  title: ['title', 'job title', 'designation', 'position', 'role'],
  company: ['company', 'company name', 'account', 'organization', 'organisation', 'org', 'employer'],
  name: ['full name', 'name', 'contact', 'contact name', 'person'],
  first: ['first name', 'first', 'firstname', 'given name'],
  last: ['last name', 'last', 'lastname', 'surname', 'family name'],
};
// Email is claimed before name so a "Contact Email" column can never be read
// as the person's name.
const GUESS_ORDER = ['email', 'linkedin', 'domain', 'title', 'company', 'name', 'first', 'last'];

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Exact matches win first, then partial matches. Every header is claimed at
// most once, in either pass.
export function guessMapping(headers) {
  const m = {};
  GUESS_ORDER.forEach((f) => {
    m[f] = '';
  });
  const hs = (headers || []).map(String);
  const used = new Set();
  for (const pass of ['exact', 'partial']) {
    for (const f of GUESS_ORDER) {
      if (m[f]) continue;
      for (const h of hs) {
        if (used.has(h)) continue;
        const n = norm(h);
        const hit = pass === 'exact' ? FIELDS[f].includes(n) : FIELDS[f].some((a) => n.includes(a));
        if (hit) {
          m[f] = h;
          used.add(h);
          break;
        }
      }
    }
  }
  return m;
}

function cleanDomain(s) {
  let d = String(s).trim().toLowerCase();
  d = d.replace(/^[a-z]+:\/\//, '').replace(/^www\./, '');
  d = d.split('/')[0].split('?')[0].split('#')[0];
  return d.replace(/:\d+$/, '').replace(/\.$/, '');
}

// Canonical fields first (mapping picks the source columns), then every unused
// source column so custom rubrics still see the uploader's own data.
export function mapRows(source, mapping) {
  const m = mapping || {};
  const used = new Set(Object.values(m).filter(Boolean).map(String));
  return (source || []).map((raw) => {
    const out = {};
    const g = (k) => {
      const src = m[k];
      const v = src && raw[src] !== undefined ? raw[src] : '';
      return String(v ?? '').trim();
    };
    const name = g('name') || [g('first'), g('last')].filter(Boolean).join(' ');
    if (name) out.name = name;
    const email = g('email');
    if (email) out.email = email;
    const title = g('title');
    if (title) out.title = title;
    const company = g('company');
    if (company) out.company = company;
    let domain = g('domain');
    if (domain) domain = cleanDomain(domain);
    else if (email.includes('@')) domain = email.split('@')[1].trim().toLowerCase();
    if (domain) out.domain = domain;
    const li = g('linkedin');
    if (li) out.linkedin = li;
    for (const [k, v] of Object.entries(raw || {})) {
      if (used.has(String(k))) continue;
      let key = String(k);
      let n = 2;
      while (Object.prototype.hasOwnProperty.call(out, key)) {
        key = k + '_' + n;
        n++;
      }
      out[key] = String(v ?? '');
    }
    return out;
  });
}

// Server limits: 30 columns, 1000 chars a value, 6000 chars a row. Canonical
// fields are never dropped; trailing extra columns go first.
export function sanitizeRow(row) {
  const entries = Object.entries(row || {}).map(([k, v]) => [String(k), String(v ?? '').slice(0, MAX_VALUE_CHARS)]);
  const kept = entries.slice(0, MAX_COLS);
  const sum = () => kept.reduce((n, [, v]) => n + v.length, 0);
  while (sum() > MAX_ROW_CHARS) {
    let j = -1;
    for (let x = kept.length - 1; x >= 0; x--) {
      if (!CANONICAL.has(kept[x][0])) {
        j = x;
        break;
      }
    }
    if (j < 0) break; // 6 canonical fields at 1000 chars can never exceed 6000
    kept.splice(j, 1);
  }
  return Object.fromEntries(kept);
}

// ---------------------------------------------------------------- batching

export function chunk(arr, size = MAX_BATCH) {
  const out = [];
  const list = arr || [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// -------------------------------------------------------------------- XLSX

// Minimal OOXML reader: zip central directory, then inflate with the platform
// DecompressionStream. shortcut: cell dates stay Excel serial numbers (no
// styles.xml pass) and XML is read with tag matching, so a writer that emits
// CDATA or phonetic runs in shared strings would need a real XML parser.
async function inflateRaw(raw) {
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new Error('Expanded spreadsheet part exceeds 20 MiB. Export a smaller CSV or XLSX.');
    }
    chunks.push(value);
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; }
  return output;
}

async function readZip(u8) {
  let eocd = -1;
  const scanFrom = Math.max(0, u8.length - 66000);
  for (let i = u8.length - 22; i >= scanFrom; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('That file is not a readable xlsx file.');
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const total = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const files = new Map();
  for (let n = 0; n < total; n++) {
    if (off + 46 > u8.length || dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const localOff = dv.getUint32(off + 42, true);
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const start = localOff + 30 + lNameLen + lExtraLen;
    files.set(name, { method, raw: u8.subarray(start, start + compSize) });
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return files;
}

async function zipEntry(files, name) {
  const f = files.get(name);
  if (!f) return null;
  if (f.method === 0) return f.raw;
  if (f.method === 8) return inflateRaw(f.raw);
  throw new Error('That file is not a readable xlsx file: unsupported compression.');
}

function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    const map = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    return map[ent] ?? m;
  });
}

function tagBlocks(xml, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?(?:\\s*/>|>([\\s\\S]*?)</' + name + '>)', 'g');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1] ?? '');
  return out;
}

function innerTexts(xml, name) {
  return tagBlocks(xml, name).map(decodeEntities);
}

function colIndex(ref) {
  let n = 0;
  for (const ch of String(ref)) {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) n = n * 26 + (c - 64);
    else break;
  }
  return n - 1;
}

export async function parseXlsx(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = await readZip(u8);
  const sheetName = files.has('xl/worksheets/sheet1.xml')
    ? 'xl/worksheets/sheet1.xml'
    : [...files.keys()].filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0];
  if (!sheetName) throw new Error('That file is not a readable xlsx file: no worksheet found.');
  const dec = new TextDecoder();
  const sst = await zipEntry(files, 'xl/sharedStrings.xml');
  const shared = sst ? tagBlocks(dec.decode(sst), 'si').map((inner) => innerTexts(inner, 't').join('')) : [];
  const sheet = dec.decode(await zipEntry(files, sheetName));

  const grid = [];
  for (const rowXml of tagBlocks(sheet, 'row')) {
    const cells = [];
    const cellRe = /<c\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRe.exec(rowXml))) {
      const attr = cm[1] || '';
      const body = cm[2] || '';
      const refM = /r="([^"]+)"/.exec(attr);
      const tM = /t="([^"]+)"/.exec(attr);
      const type = tM ? tM[1] : 'n';
      const idx = refM ? colIndex(refM[1]) : cells.length;
      const vM = /<v>([\s\S]*?)<\/v>/.exec(body);
      let val = '';
      if (type === 's') val = vM ? (shared[Number(decodeEntities(vM[1]))] ?? '') : '';
      else if (type === 'inlineStr') val = innerTexts(body, 't').join('');
      else if (vM) {
        val = decodeEntities(vM[1]);
        if (type === 'b') val = val === '1' ? 'TRUE' : 'FALSE';
      }
      cells[idx] = val;
    }
    grid.push(cells);
  }

  const rowsWithData = grid.filter((r) => (r || []).some((c) => c !== undefined && c !== ''));
  const headers = uniqueHeaders((rowsWithData.shift() || []).map((h) => h ?? ''));
  const rows = [];
  for (const cells of rowsWithData) {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? '';
    });
    for (let i = headers.length; i < cells.length; i++) {
      if (cells[i] !== undefined) obj['col ' + (i + 1)] = cells[i];
    }
    rows.push(obj);
  }
  return { headers, rows };
}
