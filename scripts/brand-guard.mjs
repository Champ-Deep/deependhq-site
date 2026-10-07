#!/usr/bin/env node
// brand-guard.mjs : fails when a retired colour from the old near-black and
// gold palette is still in the code. Identity kit v1 (Oct 2026) moved the site
// to navy, marigold and cream; every colour now comes from the tokens in
// system.css. A hard-coded old value is a page that did not get the memo.
//
//   node scripts/brand-guard.mjs        exit 0 when clean, 1 with a list of hits
//
// Scope: *.css *.jsx *.js *.html *.mjs, excluding node_modules, deependhq-next,
// lead-scorer.html (a standalone team tool), scripts/brand/ (the brand build
// reads the masters) and this file. Also checks the rgb() spellings of the
// two colours that were most often written that way. The classic theme block
// is exempt by marker (see below), and nothing else is. No em dashes.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const RETIRED = ['#0D0F14', '#12151D', '#181C26', '#1E2330', '#2A2E3A', '#3A3F50', '#E8E4DC', '#C9A84C', '#EC6A4A'];
const RETIRED_RGB = [
  ['201, 168, 76', 'old gold #C9A84C'],
  ['13, 15, 20', 'old ground #0D0F14'],
];
const EXT = new Set(['.css', '.jsx', '.js', '.html', '.mjs']);
const SKIP_DIRS = new Set(['node_modules', 'deependhq-next', '.git', '.wrangler', '.prerender-cache', '.shots', '.claude-scratch']);
const SKIP_FILES = new Set(['lead-scorer.html', 'scripts/brand-guard.mjs']);

const hexRe = new RegExp(`(${RETIRED.map((h) => h.slice(1)).join('|')})(?![0-9a-f])`, 'i');
const rgbRe = new RegExp(`rgba?\\(\\s*(${RETIRED_RGB.map(([t]) => t.replace(/,\s*/g, ',\\s*')).join('|')})`, 'i');

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(name) || rel === join('scripts', 'brand')) continue;
      walk(p);
      continue;
    }
    if (!EXT.has(extname(name)) || SKIP_FILES.has(rel)) continue;
    const lines = readFileSync(p, 'utf8').split('\n');
    // The classic theme (the visitor toggle) is the one place the old values
    // live on purpose. They sit between brand-guard:classic-start and
    // brand-guard:classic-end, or on a line that says brand-guard:classic.
    let classic = false;
    lines.forEach((line, i) => {
      if (/brand-guard:classic-start/.test(line)) { classic = true; return; }
      if (/brand-guard:classic-end/.test(line)) { classic = false; return; }
      if (classic || /brand-guard:classic\b/.test(line)) return;
      const h = line.match(new RegExp(`#${hexRe.source}`, 'i'));
      if (h) hits.push(`${rel}:${i + 1}  ${h[0]}`);
      const r = line.match(rgbRe);
      if (r) hits.push(`${rel}:${i + 1}  rgb(${r[1]})`);
    });
  }
}
walk(root);

if (hits.length) {
  console.error(`brand guard: ${hits.length} retired colour value(s). Use the tokens in system.css.`);
  for (const h of hits) console.error('  ' + h);
  process.exit(1);
}
console.log('brand guard: clean. no retired colour values.');
