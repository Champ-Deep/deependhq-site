// Isolated lane bundle. Does not modify the parent island registry or HTML shell.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
for (const file of ['Home.jsx', 'home.css', 'index.html', 'islands/widget-grid.island.jsx']) {
  if (/[\u2013\u2014]/.test(readFileSync(file, 'utf8'))) throw new Error(`${file}: typographic dash is not permitted`);
}
await build({ entryPoints: ['islands/p3-local.jsx'], outfile: 'docs/verification/p3/widget-grid.js', bundle: true, minify: true, format: 'iife', platform: 'browser', target: ['es2019'], jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
console.log('P3 local island bundle written. Parent registry integration remains separate.');
