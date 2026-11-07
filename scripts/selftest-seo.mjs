// Run after npm run build. Exercise the real head helpers and generated sitemap.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const src = read('scripts/prerender.mjs');
const box = {};
vm.createContext(box);
vm.runInContext(src.slice(src.indexOf('const esc ='), src.indexOf('function inject(')) + '\nthis.headFor = headFor; this.applyHead = applyHead;', box);
const shell = '<html><head><title>Keep me</title><meta name="description" content="Keep this existing description."></head><body>Unchanged</body></html>';
for (const id of ['', 'now', 'journey', 'writing', 'toolkit', 'privacy']) {
  const meta = box.headFor({ id, kind: id ? 'page' : 'app' }, null);
  const out = box.applyHead(shell, meta);
  assert(out.includes('<title>Keep me</title>'));
  assert(out.includes('<body>Unchanged</body>'));
  assert.equal((out.match(/rel="canonical"/g) || []).length, 1);
  assert(out.includes(`href="https://deependhq.com/${id}"`));
  assert.equal(box.applyHead(out, meta), out, `${id}: repeat build changed metadata`);
  if (!['journey', 'toolkit'].includes(id)) assert(out.includes('Keep this existing description.'));
  assert(!out.includes('>undefined</script>'));
}
const home = box.headFor({ kind: 'app' }, null).ld['@graph'];
assert.deepEqual(Array.from(home, x => x['@type']), ['Person', 'WebSite']);
assert.equal(home[0].sameAs.length, 3);
for (const url of home[0].sameAs) assert(read('Footer.jsx').includes(url));
const post = { slug: 'test', title: '<title> $&', deck: 'A replacement description, not the old one.', date: '2026-10-28' };
const metadata = box.headFor({ entity: 'posts' }, post);
const duplicate = shell.replace('</head>', '<meta name="description" content="stale"><link rel="canonical" href="old"></head>');
const output = box.applyHead(duplicate, metadata);
assert.equal((output.match(/name="description"/g) || []).length, 1);
assert(output.includes(post.deck));
assert(output.includes('&lt;title&gt; $&'));
assert.equal(box.applyHead(output, metadata), output);
const safe = box.applyHead(shell, { ld: { text: '</script><script>alert(1)</script>' } });
assert.equal((safe.match(/<script/g) || []).length, 1);
assert.equal(JSON.parse(safe.match(/application\/ld\+json">(.*?)<\/script>/)[1]).text, '</script><script>alert(1)</script>');

const data = JSON.parse(read('content.json'));
const sitemap = read('sitemap.xml');
const entries = [...sitemap.matchAll(/<url><loc>(.*?)<\/loc>(.*?)<\/url>/g)];
const dates = new Map(entries.map(([, url, tail]) => [url, tail.match(/<lastmod>(.*?)<\/lastmod>/)?.[1]]));
assert.equal(entries.length, 6 + data.companies.length + data.posts.length);
assert.equal(dates.size, entries.length);
for (const alias of ['command', 'field-notes']) assert(!dates.has(`https://deependhq.com/${alias}`));
const built = { window: {} };
vm.runInNewContext(read('data.js'), built);
for (const path of ['', 'journey']) assert.equal(dates.get(`https://deependhq.com/${path}`), built.window.DH_DATA.brand.today_date);
for (const post of data.posts) assert.equal(dates.get(`https://deependhq.com/post/${post.slug}`), post.date);
for (const [, url] of entries) {
  const path = new URL(url).pathname;
  const file = path === '/' ? 'index.html' : path.startsWith('/post/') || path.startsWith('/company/') ? `${path.slice(1)}/index.html` : `${path.slice(1)}.html`;
  const html = read(file);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1, file);
  assert(html.includes(`<link rel="canonical" href="${url}">`), file);
  assert.equal((html.match(/name="description"/g) || []).length, 1, file);
}
const assets = JSON.parse(read('wrangler.jsonc')).assets;
assert.equal(assets.html_handling, 'drop-trailing-slash');
for (const kind of ['post', 'company']) assert(assets.run_worker_first.includes(`/${kind}/*`));
assert(read('.assetsignore').split('\n').includes('.git'), 'worktree pointer must not be a public asset');
console.log(`SEO selftest passed: metadata preservation, idempotence, escaping, social identity, and ${entries.length} sitemap pages.`);
