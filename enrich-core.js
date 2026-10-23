// enrich-core.js : pure logic for /enrich. No DOM, so scripts/enrich-selftest.mjs can run it.
// This is NOT a data-provider lookup. It builds likely work emails from name + domain and checks
// that the domain can receive mail (MX over DNS-over-HTTPS). It cannot confirm a mailbox exists.
// shortcut: no SMTP probe (browsers and Workers cannot open port 25), upgrade by adding a verifier API.

export const DOH = 'https://cloudflare-dns.com/dns-query';

// Most common corporate patterns first. Rank is a convention, not a measured hit rate.
const PATTERNS = [
  (f, l) => `${f}.${l}`, (f) => f, (f, l) => `${f[0]}${l}`, (f, l) => `${f}${l}`,
  (f, l) => `${f[0]}.${l}`, (f, l) => `${f}${l[0]}`, (f, l) => l, (f, l) => `${f}_${l}`, (f, l) => `${l}.${f}`,
];

export function parseCSV(text) {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (!src) return [];
  const delim = src.split('\n', 1)[0].includes('\t') ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); rows.push(row);
  const [head, ...body] = rows;
  const keys = head.map((h) => h.trim());
  return body.filter((r) => r.some((v) => v.trim())).map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] || '').trim()])));
}

export function csvEscape(v) {
  const s = String(v ?? '');
  // Leading = + - @ would execute as a formula when the output is opened in Excel.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCSV(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
}

// Pick the input columns from whatever headers ZoomInfo, Apollo or Lusha exports use.
export function detectColumns(row) {
  const keys = Object.keys(row);
  const find = (...res) => keys.find((k) => res.some((re) => re.test(k))) || null;
  return {
    first: find(/^first\s*name$/i, /^first$/i),
    last: find(/^last\s*name$/i, /^last$/i, /^surname$/i),
    full: find(/^(full\s*)?name$/i, /^contact(\s*name)?$/i),
    email: find(/^(work\s*|business\s*|primary\s*)?e-?mail(\s*address)?$/i, /^email/i),
    domain: find(/^(company\s*)?domain$/i, /website/i, /^url$/i, /company\s*url/i),
  };
}

export function cleanDomain(v) {
  const d = String(v || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/^www\./, '').split(/[/?#:\s]/)[0];
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d) ? d : '';
}

const ascii = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export function splitName(first, last, full) {
  if (first || last) return [ascii(first || ''), ascii(last || '')];
  const parts = String(full || '').replace(/,.*$/, '').trim().split(/\s+/);
  return parts.length < 2 ? ['', ''] : [ascii(parts[0]), ascii(parts[parts.length - 1])];
}

export function candidates(first, last, domain, n = 3) {
  if (!first || !last || !domain) return [];
  return [...new Set(PATTERNS.map((p) => `${p(first, last)}@${domain}`))].slice(0, n);
}

export const validSyntax = (e) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(e);

// Resolves true (has MX), false (NXDOMAIN or no MX) or null (lookup failed, unknown).
export async function hasMX(domain, fetchFn = fetch) {
  try {
    const r = await fetchFn(`${DOH}?name=${encodeURIComponent(domain)}&type=MX`, { headers: { accept: 'application/dns-json' } });
    if (!r.ok) return null;
    const j = await r.json();
    return j.Status === 0 && (j.Answer || []).some((a) => a.type === 15);
  } catch { return null; }
}

export const OUT_COLS = ['email', 'email_alt_1', 'email_alt_2', 'status'];

// status: verified_domain | no_mx | lookup_failed | bad_syntax | missing_input
export async function enrichRows(rows, { fetchFn = fetch, concurrency = 8, onProgress = () => {} } = {}) {
  if (!rows.length) return [];
  const cols = detectColumns(rows[0]);
  const cache = new Map();
  const mx = (d) => { if (!cache.has(d)) cache.set(d, hasMX(d, fetchFn)); return cache.get(d); };
  let done = 0;
  const out = new Array(rows.length);
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const i = next++;
      out[i] = { ...rows[i], ...(await one(rows[i], cols, mx)) };
      onProgress(++done, rows.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, worker));
  return out;
}

async function one(row, cols, mx) {
  const res = { email: '', email_alt_1: '', email_alt_2: '', status: '' };
  const existing = cols.email ? row[cols.email] : '';
  let domain = cleanDomain(cols.domain && row[cols.domain]);
  if (existing) {
    // A supplied email is kept as is. We only check it.
    res.email = existing;
    if (!validSyntax(existing)) return { ...res, status: 'bad_syntax' };
    domain = existing.split('@')[1].toLowerCase();
    return { ...res, status: statusOf(await mx(domain)) };
  }
  const [f, l] = splitName(cols.first && row[cols.first], cols.last && row[cols.last], cols.full && row[cols.full]);
  const list = candidates(f, l, domain);
  if (!list.length) return { ...res, status: 'missing_input' };
  [res.email, res.email_alt_1, res.email_alt_2] = [list[0], list[1] || '', list[2] || ''];
  return { ...res, status: statusOf(await mx(domain)) };
}

const statusOf = (m) => (m === true ? 'verified_domain' : m === false ? 'no_mx' : 'lookup_failed');
