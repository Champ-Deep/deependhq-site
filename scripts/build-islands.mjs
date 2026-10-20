#!/usr/bin/env node
// build-islands.mjs : bundle the React islands into one deferred
// home-islands.js at the repo root (refresh contract section 2).
//
//   node scripts/build-islands.mjs
//
// esbuild is a real dependency (prerender bundles with it too), react and
// react-dom come from node_modules, and the output is minified. The check at
// the end is an assert-based self-check: a bundle that lost a registry entry
// would mount half the page, which is worse than mounting none.
// No em dashes.

import { build } from 'esbuild';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const entry = join(root, 'islands', 'index.jsx');
const out = join(root, 'home-islands.js');

if (!existsSync(entry)) {
  console.error(`build-islands: missing ${entry}`);
  process.exit(1);
}

const result = await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  jsx: 'automatic',
  loader: { '.jsx': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: out,
  logLevel: 'warning',
});

if (result.errors && result.errors.length) process.exit(1);

const code = readFileSync(out, 'utf8');
const required = ['halftone-footer', 'folder-cards', 'widget-grid', 'terrain', 'data-island'];
const missing = required.filter((m) => !code.includes(m));
if (code.length < 5000 || missing.length) {
  console.error(
    `build-islands: bundle check failed (${code.length} bytes${missing.length ? `, missing ${missing.join(', ')}` : ''})`
  );
  process.exit(1);
}
// eslint-disable-next-line no-control-regex
if (/[\u2013\u2014]/.test(code)) {
  console.error('build-islands: en dash or em dash in the bundle');
  process.exit(1);
}
console.log(`build-islands: home-islands.js ${code.length} bytes, ${required.length} registry checks ok`);
