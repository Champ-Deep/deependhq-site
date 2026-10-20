// Normalize source shells before prerender, including toolkit's standalone pages.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const controller = readFileSync('scheme.js', 'utf8');
const css = readFileSync('system.css', 'utf8');
writeFileSync('scheme-tokens.css', '/* Generated from system.css. */\n' + css.match(/:root \{[\s\S]*?\n\}/)[0] + '\n' + css.match(/:root\[data-scheme="light"\] \{[\s\S]*?\n\}/)[0] + '\n');
writeFileSync('islands.css', '/* Shared island styles, generated from home.css. */\n' + readFileSync('home.css','utf8').split('/* ---- halftone footer')[1].split('/* ---------- P5 lane:')[0].replace(/^/, '/* ---- halftone footer'));
for (const name of readdirSync('.').filter(name => name.endsWith('.html'))) {
  let html = readFileSync(name, 'utf8');
  if (/id="root"/.test(html) && !/href="\/islands.css"/.test(html)) html = html.replace('</head>', '<link rel="stylesheet" href="/islands.css">\n</head>');
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, script => /dh_scheme|dh_theme/.test(script) ? '' : script);
  html = html.replace(/<meta name="theme-color"[^>]*>/, match => `${match}\n<script>${controller}</script>`);
  html = html.replace(/\s*<script[^>]+src="(?:home-p[34]-island|p[34]-islands)\.js"[^>]*><\/script>/g, '');
  if (/id="root"/.test(html) && !/src="\/?home-islands.js"/.test(html)) html = html.replace('</body>', '<script src="/home-islands.js" defer></script>\n</body>');
  assert(!/dh_theme|data-theme/.test(html), `${name}: old theme remains`);
  if (/theme-color/.test(html)) assert.equal((html.match(/Single pre-paint scheme controller/g) || []).length, 1, `${name}: scheme controller count`);
  writeFileSync(name, html.replace(/^[ \t]+$/gm, ''));
}
console.log('Page shells: one shared scheme controller; canonical island bundle.');
