// selftest-worker.mjs : catch the bugs that blank the whole site.
//
// WHY THIS FILE EXISTS
// On 2026-10-02 a deploy took the entire site down. Every page returned 200 with
// a sixteen-byte body: "<!doctype html>\n". The Worker assigned a segment label to
// this.segment and also defined a method called segment(), so the prototype method
// shadowed the property, the HTMLRewriter call site invoked a string, and the
// handler threw mid-stream. The headers were perfect, the status was 200, the CSP
// was right, and the site was still completely blank.
//
// Nothing about that failure looks like a failure from the outside. No error
// page, no non-200, no missing header. It is the single most expensive class of
// bug on a site like this, so it gets asserted directly rather than trusted.
//
//   node scripts/selftest-worker.mjs
//
// This loads the real worker/index.js. It does not mock it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(root, 'worker/index.js'), 'utf8');

let pass = 0;
const fails = [];
const check = (name, got, want = true) => {
  if (got === want) pass++;
  else fails.push(`${name}\n      got ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

console.log('\nworker selftest\n');

// ------------------------------------------------ the outage
console.log('the 2026-10-02 outage: a property shadowed by a method');

// Extract the Personalize class and run it for real, because the whole point is
// that this failed only when actually executed.
// Bound the slice at the export, or the snippet is not a valid script.
const classStart = src.indexOf('class Personalize');
const classSrc = src.slice(classStart, src.indexOf('export default', classStart));
const classifySrc = src.slice(
  src.indexOf('const OPERATOR_PATHS'),
  src.indexOf('// ---------', src.indexOf('const OPERATOR_PATHS'))
);

const box = { console, Response, Headers, URL, HTMLRewriter: class {}, Request: class {} };
box.self = box; box.globalThis = box;
vm.createContext(box);
// The real worker file never exports the class, because nothing else needs it.
// Expose it here so the test can construct it, which is the whole point: the
// outage only appeared when the method was actually called.
vm.runInContext(classifySrc + '\n' + classSrc + '\nglobalThis.Personalize = Personalize;\nglobalThis.classifySegment = classifySegment;',
  box, { filename: 'worker-snippet.js' });

const P = box.Personalize;
check('the Personalize class loads', typeof P === 'function');

// The exact call the HTMLRewriter handler makes, against a stub element.
function stamp(pathname, referer) {
  const attrs = {};
  const el = { setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: () => {} };
  const p = new P('Asia/Kollata', 'in', referer, pathname);
  p.segment(el); // if segment is a string, this throws, exactly as in production
  return attrs;
}

let attrs;
try {
  attrs = stamp('/', 'https://github.com/x');
  check('the html handler can call p.segment(el) without throwing', true);
} catch (e) {
  check('the html handler can call p.segment(el) without throwing', false);
  fails.push(`      threw: ${e.message}\n      this is the outage: every page truncated to a 16-byte body`);
}

// And the four attributes the client reads.
try {
  attrs = stamp('/now', 'https://github.com/x');
  check('it stamps data-tz', attrs['data-tz'] === 'Asia/Kollata');
  check('it stamps data-country', attrs['data-country'] === 'IN');
  check('it stamps data-segment', !!attrs['data-segment']);
  // data-ref is the legacy two-value pair and must stay EMPTY for the control
  // segment, so anything still reading the old attribute keeps treating explorer
  // as untagged rather than as a third, newly-invented case.
  check('data-ref stays empty for a referrerless control visit',
    stamp('/', '')['data-ref'], '');
  check('data-ref carries the legacy value for a treated visit',
    stamp('/', 'https://github.com/x')['data-ref'], 'operator');
} catch (e) {
  fails.push(`      threw: ${e.message}`);
}

// ------------------------------------------------ structural guards
console.log('structural guards against the same class of bug');

// A class must not define a method whose name is also assigned in the
// constructor. That exact collision blanked the site once.
const classBody = src.slice(src.indexOf('class Personalize'), src.indexOf('export default'));
const assigned = [...classBody.matchAll(/this\.(\w+)\s*=/g)].map((m) => m[1]);
const methods = [...classBody.matchAll(/^\s{2}(\w+)\s*\(/gm)].map((m) => m[1]);
const collisions = assigned.filter((a) => methods.includes(a));
check('no constructor property collides with a method name',
  collisions.length === 0 ? true : collisions);
if (collisions.length) {
  fails.push(`      colliding names: ${collisions.join(', ')}`);
}

// ------------------------------------------------ classification parity
console.log('classification');

const cls = box.classifySegment;
check('the function is exported into scope', typeof cls === 'function');

const cases = [
  ['/', '', 'explorer'],
  ['/now', '', 'narrative'],
  ['/post/week-45-the-wall-we-named/', '', 'narrative'],
  ['/toolkit', '', 'operator'],
  ['/command', '', 'operator'],
  ['/pillars', '', 'operator'],
  ['/privacy', '', 'explorer'],
  ['/anything', 'https://github.com/x', 'operator'],
  ['/anything', 'https://www.linkedin.com/feed', 'narrative'],
  ['/anything', 'https://bsky.app', 'narrative'],
  ['/anything', 'https://news.ycombinator.com', 'explorer'],
  ['/now', 'https://github.com/x', 'operator'],
];
for (const [path, ref, want] of cases) {
  check(`${path || '/'} from ${ref || 'direct'} is ${want}`, cls(path, ref), want);
}

// A referrer must never be read as a path, and vice versa. Getting these two
// backwards would classify by accident.
check('a path that merely contains a segment word does not leak', cls('/api/post', ''), 'explorer');
check('a deep path still classifies', cls('/post/a/b/c/', ''), 'narrative');

// ------------------------------------------------ audio ranges
// The asset store answers a Range request with the whole file, so a browser
// cannot seek in an essay reading. handleAudio slices it. Run it for real.
console.log('\naudio: Range requests get a 206 the browser can seek with');
{
  const aStart = src.indexOf('async function handleAudio');
  const aSrc = src.slice(aStart, src.indexOf('// ---------', aStart));
  const ab = { console, Response, Headers, URL, Request };
  ab.globalThis = ab; vm.createContext(ab);
  vm.runInContext(aSrc + '\nglobalThis.handleAudio = handleAudio;', ab, { filename: 'audio-snippet.js' });
  const body = new Uint8Array(1000).map((_, i) => i % 251);
  const env = { ASSETS: { fetch: async () => new Response(body, { status: 200, headers: { 'content-type': 'audio/mpeg', 'content-length': '1000' } }) } };
  const get = (range) => ab.handleAudio(new Request('https://deependhq.com/audio/x.mp3', { headers: range ? { range } : {} }), env);
  const full = await get();
  check('no Range: 200 with accept-ranges', `${full.status} ${full.headers.get('accept-ranges')}`, '200 bytes');
  const mid = await get('bytes=100-199');
  const midBody = new Uint8Array(await mid.arrayBuffer());
  check('bytes=100-199 is a 206', mid.status, 206);
  check('bytes=100-199 says where it is', mid.headers.get('content-range'), 'bytes 100-199/1000');
  check('bytes=100-199 returns those 100 bytes', `${midBody.length} ${midBody[0]}`, `100 ${100 % 251}`);
  const open = await get('bytes=900-');
  check('an open range runs to the end', open.headers.get('content-range'), 'bytes 900-999/1000');
  const tail = await get('bytes=-50');
  check('a suffix range is the last bytes', tail.headers.get('content-range'), 'bytes 950-999/1000');
  const bad = await get('bytes=2000-');
  check('a range past the end is a 416', bad.status, 416);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('worker selftest: the site cannot blank itself this way again.');