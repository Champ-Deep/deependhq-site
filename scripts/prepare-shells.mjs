// Normalize source shells before prerender, including toolkit's standalone pages.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const controller = readFileSync('scheme.js', 'utf8');
const classic = readFileSync('site-classic.js', 'utf8');
const css = readFileSync('system.css', 'utf8');
if (!process.argv.includes('--public-only')) writeFileSync('scheme-tokens.css', '/* Generated from system.css. */\n' + css.match(/:root \{[\s\S]*?\n\}/)[0] + '\n' + css.match(/:root\[data-scheme="light"\] \{[\s\S]*?\n\}/)[0] + '\n');
writeFileSync('islands.css', '/* Shared island styles, generated from home.css. */\n' + readFileSync('home.css','utf8').split('/* ---- halftone footer')[1].split('/* ---------- P5 lane:')[0].replace(/^/, '/* ---- halftone footer'));
for (const name of readdirSync('.').filter(name => name.endsWith('.html'))) {
  let html = readFileSync(name, 'utf8');
  const publicSite = /id="root"/.test(html) || name === '404.html'; // the 404 is a public page too
  if (process.argv.includes('--public-only') && !publicSite) continue;
  if (publicSite && !/href="\/?site-v3.css"/.test(html)) html = html.replace('</head>', '<link rel="stylesheet" href="/site-v3.css">\n</head>');
  if (name === 'index.html' && !/src="site-v3.js"/.test(html)) html = html.replace('</body>', '<script src="site-v3.js" defer></script>\n</body>');
  if (/id="root"/.test(html) && !/href="\/islands.css"/.test(html)) html = html.replace('</head>', '<link rel="stylesheet" href="/islands.css">\n</head>');
  // the trailing newline goes with the script so repeated builds stay byte-identical
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>\n?/g, script => /dh_scheme|dh_theme|Classic is the public site's only look/.test(script) ? '' : script);
  html = html.replace(/<meta name="theme-color"[^>]*>/, match => `${match}\n<script>${publicSite ? classic : controller}</script>`);
  html = html.replace(/\s*<script[^>]+src="(?:home-p[34]-island|p[34]-islands)\.js"[^>]*><\/script>/g, '');
  if (/id="root"/.test(html) && !/src="\/?home-islands.js"/.test(html)) html = html.replace('</body>', '<script src="/home-islands.js" defer></script>\n</body>');
  assert(!/dh_theme|data-theme/.test(html), `${name}: old theme remains`);
  if (/theme-color/.test(html)) assert.equal((html.match(publicSite ? /Classic is the public site's only look/g : /Single pre-paint scheme controller/g) || []).length, 1, `${name}: controller count`);
  writeFileSync(name, html.replace(/^[ \t]+$/gm, ''));
}
console.log('Page shells: public classic, standalone toolkit scheme preserved; canonical island bundle.');
