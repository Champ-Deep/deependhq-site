// Isolated P4 bundle. Final release uses P1 build-islands and registry.
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
await build({ entryPoints: ['islands/p4-local.jsx'], outfile: 'home-islands.js', bundle: true, minify: true, format: 'iife', target: ['es2023'], jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' } });
for (const path of ['Home.jsx', 'home.js', 'islands/terrain.island.jsx', 'index.html']) {
  if (/[\u2013\u2014]/u.test(readFileSync(path, 'utf8'))) throw Error(`Dash gate: ${path}`);
}
console.log('P4 terrain bundled; dash gate clean.');
