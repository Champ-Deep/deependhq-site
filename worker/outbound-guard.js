// worker/outbound-guard.js : the only way the toolkit fetches a URL a user typed (docs/toolkit-v4-api.md section 12).
// Pure except for the DoH lookup, and both the lookup and fetch are injectable for tests.
//   checkOutboundUrl(url, {resolve})                               -> {url} or {error}
//   guardedFetch(url, init, {timeoutMs, maxBytes, accept, fetch, resolve}) -> Response (body buffered, capped) or throws OutboundError
// Error codes are fixed strings and never carry the URL's query, a header or a token.
// Residual: the Worker resolves the name again when it fetches, so a DNS rebind between the DoH check and the fetch
// is not closed here (a Worker cannot pin the IP). The check is defence in depth.

export const MAX_URL = 2048;
export const MAX_BYTES = 256 * 1024;
const DOH = 'https://cloudflare-dns.com/dns-query';

export class OutboundError extends Error {
  constructor(code) { super(code); this.code = code; }
}

// Our own hosts, and the ChampBeam and Harbinger hosts the connectors call (worker/connectors.js).
const BLOCKED_SUFFIXES = ['localhost', 'local', 'internal', 'deependhq.com', 'deep-ae0.workers.dev', 'champbeam.com'];
const blockedName = (h) => BLOCKED_SUFFIXES.some((s) => h === s || h.endsWith('.' + s));

// --- addresses -----------------------------------------------------------------------
const V4_BLOCKED = [['10.0.0.0', 8], ['172.16.0.0', 12], ['192.168.0.0', 16], ['127.0.0.0', 8], ['0.0.0.0', 8], ['169.254.0.0', 16], ['100.64.0.0', 10], ['224.0.0.0', 4], ['240.0.0.0', 4]];
const v4int = (s) => {
  const p = String(s).split('.');
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
  return p.reduce((n, x) => n * 256 + Number(x), 0);
};
const inV4 = (n, [base, bits]) => Math.floor(n / 2 ** (32 - bits)) === Math.floor(v4int(base) / 2 ** (32 - bits));

// Eight 16-bit groups, or null. Takes an embedded dotted IPv4 tail (::ffff:1.2.3.4).
function v6groups(s) {
  let str = String(s).toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(str);
  if (tail) {
    const n = v4int(tail[1]);
    if (n === null) return null;
    str = str.slice(0, -tail[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = str.split('::');
  if (halves.length > 2) return null;
  const part = (x) => (x ? x.split(':') : []);
  const head = part(halves[0]), rest = halves.length === 2 ? part(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const all = [...head, ...Array(fill).fill('0'), ...rest];
  if (all.length !== 8 || all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

// True for an address the toolkit must never call. Anything unparseable counts as private.
export function privateAddress(ip) {
  const n = v4int(ip);
  if (n !== null) return V4_BLOCKED.some((r) => inV4(n, r));
  const g = v6groups(ip);
  if (!g) return true;
  const zeroTo = (k) => g.slice(0, k).every((x) => x === 0);
  if (zeroTo(8) || (zeroTo(7) && g[7] === 1)) return true;                   // :: and ::1
  if ((g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00) return true; // fc00::/7, fe80::/10, ff00::/8
  const v4 = `${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`;
  if (zeroTo(5) && g[5] === 0xffff) return privateAddress(v4);              // ::ffff:a.b.c.d mapped
  if (zeroTo(6)) return true;                                               // ::a.b.c.d, deprecated compatible form
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return privateAddress(v4); // NAT64
  return false;
}

// --- DoH ----------------------------------------------------------------------------
// [{type, data}] for A (1), AAAA (28) and CNAME (5) answers. Throws OutboundError('dns_failed').
export async function dohResolve(name, f = (u, i) => fetch(u, i)) {
  const out = [];
  for (const type of ['A', 'AAAA']) {
    let j;
    try {
      const r = await f(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(3000) });
      j = r.ok ? await r.json() : null;
    } catch { j = null; }
    if (!j || (j.Status !== 0 && j.Status !== 3)) throw new OutboundError('dns_failed'); // 3 = NXDOMAIN for this type, judged below
    for (const a of Array.isArray(j.Answer) ? j.Answer : []) if ([1, 5, 28].includes(a.type)) out.push({ type: a.type, data: String(a.data).replace(/\.$/, '').toLowerCase() });
  }
  return out;
}

// --- the URL check ------------------------------------------------------------------
export async function checkOutboundUrl(raw, { resolve = dohResolve } = {}) {
  if (typeof raw !== 'string') return { error: 'bad_url' };
  if (raw.length > MAX_URL) return { error: 'url_too_long' };
  let u;
  try { u = new URL(raw); } catch { return { error: 'bad_url' }; }
  if (u.protocol !== 'https:') return { error: 'https_only' };
  if (u.port !== '' && u.port !== '443') return { error: 'port_not_allowed' };
  if (u.username || u.password) return { error: 'userinfo_not_allowed' };
  // WHATWG URL parsing already turned decimal (2130706433), hex (0x7f000001) and octal (0177.0.0.1) forms into dotted
  // IPv4, and IPv6 keeps its brackets. Both are refused here as literals, whatever they point at.
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[') || v4int(host) !== null || /^[\d.]+$/.test(host) || /(^|\.)0x[0-9a-f]*$/.test(host)) return { error: 'ip_literal' };
  if (!host.includes('.') || blockedName(host)) return { error: 'host_not_allowed' };
  let answers;
  try { answers = await resolve(host); } catch { return { error: 'dns_failed' }; }
  const ips = answers.filter((a) => a.type === 1 || a.type === 28);
  if (!ips.length) return { error: 'dns_failed' };
  if (answers.some((a) => a.type === 5 && blockedName(a.data))) return { error: 'host_not_allowed' };
  if (ips.some((a) => privateAddress(a.data))) return { error: 'private_address' };
  return { url: u.href };
}

// --- the fetch ----------------------------------------------------------------------
// One request. No redirects followed, a hard timeout over the whole exchange, at most maxBytes of body.
// accept: content types allowed on a 2xx answer with a body (no list = any).
export async function guardedFetch(url, init = {}, { timeoutMs, maxBytes = MAX_BYTES, accept, fetch: f = (u, i) => fetch(u, i), resolve } = {}) {
  const deadline = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  const fail = (code) => { throw new OutboundError(deadline.aborted ? 'timeout' : code); };
  const chk = await checkOutboundUrl(String(url), resolve ? { resolve } : {});
  if (chk.error) throw new OutboundError(chk.error);
  let res;
  try { res = await f(chk.url, { ...init, redirect: 'manual', signal }); } catch { fail('fetch_failed'); }
  if ((res.status >= 300 && res.status < 400) || res.type === 'opaqueredirect') { res.body?.cancel().catch(() => {}); throw new OutboundError('redirect_refused'); }
  const chunks = [];
  let size = 0;
  if (res.body) {
    const reader = res.body.getReader();
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { reader.cancel().catch(() => {}); throw new OutboundError('too_large'); }
        chunks.push(value);
      }
    } catch (e) { if (e instanceof OutboundError) throw e; fail('read_failed'); }
  }
  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (accept && size > 0 && res.ok && !accept.includes(type)) throw new OutboundError('bad_content_type');
  const body = [204, 205].includes(res.status) ? null : new Blob(chunks);
  return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
}
