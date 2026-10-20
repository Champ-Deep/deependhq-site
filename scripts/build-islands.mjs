// build-islands.mjs : bundle islands/index.jsx into home-islands.js at the
// repo root. Minified, IIFE, jsx automatic, react and react-dom from
// dependencies. Runs last in `npm run build`, after prerender has written the
// markup the islands mount into.
// No em dashes.

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const out = await build({
  entryPoints: [join(root, 'islands', 'index.jsx')],
  outfile: join(root, 'home-islands.js'),
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2019'],
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});

if (out.errors.length) process.exit(1);
console.log(`islands: home-islands.js written (${out.warnings.length} warning(s)).`);
