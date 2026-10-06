// link-check.mjs : every internal href in the built site must resolve to
// something that exists.
//
// WHY THIS EXISTS
// On 2026-09-26 the Worker shipped a 301 from /field-notes to /mission-log, a
// page nobody had built. Two publishes succeeded, the redirect was live, and
// every visitor following an old link hit a 404. Nothing in the pipeline could
// see it, because nothing asked whether the target existed.
//
// This is the gate that would have caught it. It runs over the BUILT files
// (the prerendered HTML, which is what a visitor actually receives), not the
// JSX source, because a link can be written in three places and only the output
// proves where it lands.
//
//   node scripts/link-check.mjs            # check, exit 1 on a broken link
//   node scripts/link-check.mjs --verbose  # list every internal link

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve as resolvePath } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const verbose = process.argv.includes('--verbose');

// Files that are pages. Each one can be a link target.
const PAGE_EXT = /\.html?$/;

function listPages(dir = root, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'deependhq-next') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) { if (name === 'scripts' || name === 'fonts' || name === 'img' || name === 'casts') continue; listPages(full, acc); }
    else if (PAGE_EXT.test(name)) acc.push(full);
  }
  return acc;
}

const pages = listPages();
const pageSet = new Set(pages.map((p) => p.slice(root.length + 1)));
const staticSet = new Set(
  readdirSync(root).filter((n) => statSync(join(root, n)).isFile() && !PAGE_EXT.test(n))
);

// hrefs that legitimately point outside the file tree, and why they are fine.
const EXTERNAL = /^(https?:|mailto:|tel:|data:|#|javascript:)/i;

const broken = [];
const seen = new Map(); // href -> Set of pages that link to it

for (const page of pages) {
  const rel = page.slice(root.length + 1);
  const html = readFileSync(page, 'utf8');
  // A page may declare <base href="...">, which changes how the browser
  // resolves every relative href on it. The nested entity pages
  // (post/<slug>/index.html) do exactly that, because they are served from the
  // root but sit two directories deep on disk. Ignoring the base tag made every
  // relative link on those pages look broken, which was a false positive, so
  // resolve against the base the way a browser would.
  const baseTag = html.match(/<base\s[^>]*href=["']([^"']+)["']/i);
  // resolvePath, not dirname(join(...)): join(root, '/') keeps a trailing
  // slash and dirname of that is the PARENT of root, which sent every
  // relative link one level too high and reported all 27 pages as broken.
  const baseDir = baseTag
    ? (baseTag[1].startsWith('/')
      ? resolvePath(root, `.${baseTag[1]}`)
      : resolvePath(dirname(page), baseTag[1]))
    : dirname(page);
  // Every href and src in the built output, plus the two JSX-ish sources the
  // browser executes (Babel inlines them at runtime, so their links are live too).
  const targets = [];
  for (const m of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) targets.push(m[1]);
  for (const m of html.matchAll(/\b(?:to|href)\s*:\s*['"]([^'"]+)['"]/g)) targets.push(m[1]);
  for (const m of html.matchAll(/<a\s[^>]*href=\{?["'`]([^"'`]+)["'`]/gi)) targets.push(m[1]);

  for (const raw of targets) {
    const href = raw.trim();
    if (!href || EXTERNAL.test(href)) continue;

    // Split off query and hash, then work out which file is meant.
    const clean = href.split('#')[0].split('?')[0];
    if (!clean) continue;

    let targetFile;
    if (clean.startsWith('/')) {
      // A root-absolute path. The Worker serves .html for extensionless routes
      // only where a redirect or a route exists, so an extensionless root path
      // is a 404 unless a page of that exact name is deployed.
      // "/" is the one exception: it is the site root and is served by
      // index.html, so appending .html to it would look for "/.html" and
      // report the homepage as broken on every page that links to it.
      if (clean === '/') { targetFile = 'index.html'; }
      // A root-absolute asset (/favicon.ico, /brand/mare-night.svg, /system.css)
      // is a file, not a route: check that exact file, never "<asset>.html".
      else if (/\.[a-z0-9]+$/i.test(clean) && !clean.endsWith('.html')) {
        targetFile = existsSync(join(root, clean.slice(1))) ? clean.slice(1) : null;
      }
      else {
        const asHtml = clean.endsWith('.html') ? clean : `${clean}.html`;
        targetFile = existsSync(join(root, asHtml.replace(/^\//, ''))) ? asHtml.replace(/^\//, '') : null;
      }
    } else {
      targetFile = clean;
    }
    if (targetFile === null) { broken.push({ from: rel, href, why: 'no such page' }); continue; }

    const abs = resolvePath(baseDir, targetFile);
    const relTarget = abs.startsWith(root) ? abs.slice(root.length + 1) : abs;
    if (existsSync(abs)) continue;

    // A link to a directory, or a bare name that is a deployed asset.
    if (staticSet.has(relTarget) || pageSet.has(relTarget)) continue;

    broken.push({ from: rel, href, why: 'target not found' });
  }
}

const uniq = new Map();
for (const b of broken) {
  const k = `${b.from} -> ${b.href}`;
  uniq.set(k, b);
}

if (verbose) {
  console.log('--- internal links found ---');
  for (const [k, v] of seen) console.log(`  ${k}`);
}

console.log(`\nlink check: ${pages.length} pages scanned.`);
if (uniq.size) {
  console.error(`BROKEN INTERNAL LINKS: ${uniq.size}`);
  for (const [k, v] of uniq) console.error(`  ${k}  (${v.why})`);
  console.error('\n  A link to a page that does not exist is a 404 a visitor sees. Fix the target or ship the page.');
  process.exit(1);
}
console.log('all internal links resolve.');
