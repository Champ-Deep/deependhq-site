#!/usr/bin/env node
// build-brand.mjs : copy the identity kit v1 masters into brand/ as web files,
// and build everything derived from them. Run by hand when a mark changes; the
// outputs are committed, because CI has no Chromium.
//
//   node scripts/brand/build-brand.mjs [--identity <dir>] [--no-raster]
//
// The masters live in the vault at Efforts/Active/DeependHQ Site/identity/ and
// are never edited. This script reads them, never writes them.
//
// What it does, in order:
//   1. SVGO v4 (npx svgo@4) on every master into brand/. The default preset
//      strips the C2PA <metadata> block (about 7.7 KB each) and keeps viewBox
//      and <title>, which logos and accessible marks need.
//   2. favicon.svg at the site root.
//   3. brand/icons.svg: the eight icons as <symbol id="i-NAME"> in one sprite.
//      Fills are rewritten so one sprite works on both grounds: navy becomes
//      currentColor, cream cutouts become var(--icon-cut), marigold becomes
//      var(--icon-accent). Custom properties inherit into the <use> tree.
//   4. PNG icons and favicon.ico, rendered from favicon.svg with playwright-core
//      (skipped with a warning when no Chromium is found), ICO packed by Pillow.
//   5. manifest.webmanifest.
// No em dashes.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const argv = process.argv.slice(2);
const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

// The repo worktree sits at Efforts/Active/TheDeepEndHQ/deependhq-site and the
// release staging copy at Efforts/Active/DeependHQ Site/deependhq-identity-release,
// so the masters are found from either place.
const candidates = [
  flag('--identity'),
  process.env.DEEP_IDENTITY_DIR,
  resolve(root, '..', 'identity'),
  resolve(root, '..', '..', 'DeependHQ Site', 'identity'),
].filter(Boolean);
const IDENTITY = candidates.find((d) => existsSync(join(d, 'assets', 'brandmark.svg')));
if (!IDENTITY) {
  console.error('build-brand: identity masters not found. pass --identity <dir> (the folder that holds assets/brandmark.svg).');
  process.exit(2);
}
const A = join(IDENTITY, 'assets');
const BRAND = join(root, 'brand');
mkdirSync(BRAND, { recursive: true });

// master file -> published path, relative to the repo root
const COPY = [
  ['brandmark.svg', 'brand/brandmark.svg'],
  ['brandmark-reverse.svg', 'brand/brandmark-reverse.svg'],
  ['wordmark.svg', 'brand/wordmark.svg'],
  ['mascot-mare.svg', 'brand/mare.svg'],
  ['mascot-mare-sticker.svg', 'brand/mare-sticker.svg'],
  ['mascot-mare-night.svg', 'brand/mare-night.svg'],
  ['tagline.svg', 'brand/tagline.svg'],
  ['tagline-on-navy.svg', 'brand/tagline-on-navy.svg'],
  ['flame.svg', 'brand/flame.svg'],
  ['favicon.svg', 'favicon.svg'],
];
// 'gi' replaced the belt knot on 7 Oct 2026 (it read as a bow). Its source is
// in scripts/brand/icons/, beside any other icon drawn after the kit; the
// vault masters are never edited.
const ICONS = ['diya', 'moon', 'prompt', 'horseshoe', 'gi', 'crown', 'pot', 'book'];
const LOCAL_ICONS = join(here, 'icons');
const iconSrc = (n) => (existsSync(join(LOCAL_ICONS, `icon-${n}.svg`)) ? join(LOCAL_ICONS, `icon-${n}.svg`) : join(A, `icon-${n}.svg`));

// ---- 1, 2: SVGO pass ---------------------------------------------------------
const tmp = join(tmpdir(), `dh-brand-${process.pid}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(tmp, 'in'), { recursive: true });
for (const [src] of COPY) copyFileSync(join(A, src), join(tmp, 'in', src));
for (const n of ICONS) copyFileSync(iconSrc(n), join(tmp, 'in', `icon-${n}.svg`));
execFileSync('npx', ['--yes', 'svgo@4', '-q', '-f', join(tmp, 'in'), '-o', join(tmp, 'out')], { stdio: 'inherit' });

let total = 0;
for (const [src, dest] of COPY) {
  const svg = readFileSync(join(tmp, 'out', src), 'utf8');
  if (/<metadata/i.test(svg)) throw new Error(`${src}: metadata survived SVGO`);
  writeFileSync(join(root, dest), svg, 'utf8');
  total += svg.length;
  console.log(`${dest}: ${(svg.length / 1024).toFixed(1)} KB`);
}

// ---- 3: icon sprite ----------------------------------------------------------
const FILL = {
  '#0e1a33': 'currentColor',
  '#f4ebd9': 'var(--icon-cut, #0E1A33)',
  '#f4a62a': 'var(--icon-accent, #F4A62A)',
};
const recolour = (s) => s
  .replace(/\s(fill|stroke)="(#[0-9a-f]{6})"/gi, (m, attr, hex) => {
    const v = FILL[hex.toLowerCase()];
    if (!v) throw new Error(`icon sprite: unmapped colour ${hex}`);
    return v === 'currentColor' ? ` ${attr}="currentColor"` : ` style="${attr}:${v}"`;
  });
const symbols = ICONS.map((n) => {
  const svg = readFileSync(join(tmp, 'out', `icon-${n}.svg`), 'utf8');
  const vb = svg.match(/viewBox="([^"]+)"/)[1];
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title>[\s\S]*?<\/title>/, '');
  return `<symbol id="i-${n}" viewBox="${vb}">${recolour(inner)}</symbol>`;
});
const sprite = `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>\n`;
writeFileSync(join(BRAND, 'icons.svg'), sprite, 'utf8');
console.log(`brand/icons.svg: ${ICONS.length} symbols, ${(sprite.length / 1024).toFixed(1)} KB`);
rmSync(tmp, { recursive: true, force: true });

// ---- 4: PNG icons and favicon.ico ---------------------------------------------
async function raster() {
  if (argv.includes('--no-raster')) { console.log('raster: skipped (--no-raster)'); return; }
  const require_ = createRequire(join(root, 'package.json'));
  let chromium;
  try { ({ chromium } = require_('playwright-core')); } catch { console.warn('raster: playwright-core missing, PNGs not rebuilt'); return; }
  const exe = [process.env.CHROME_BIN, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
  let browser;
  try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) {
    console.warn(`raster: no Chromium (${e.message.split('\n')[0]}). PNG icons not rebuilt; the committed ones stay.`);
    return;
  }
  const fav = readFileSync(join(root, 'favicon.svg'), 'utf8');
  const NAVY = '#0E1A33';
  // size, file, inner scale (fraction of the canvas the tile occupies), bleed
  const jobs = [
    [16, 'scripts/.brand-16.png', 1, false], [32, 'scripts/.brand-32.png', 1, false], [48, 'scripts/.brand-48.png', 1, false],
    [192, 'icon-192.png', 1, false], [512, 'icon-512.png', 1, false],
    // iOS rounds the corners itself: a full navy square, the tile inset 16px of 180.
    [180, 'apple-touch-icon.png', (180 - 32) / 180, true],
    // maskable: navy full bleed, the D inside the central 80 percent safe circle.
    [512, 'icon-mask.png', 0.72, true],
  ];
  // One roomy viewport for every size: headless Chromium will not paint a
  // 16 by 16 window, so each icon is drawn in the corner and clipped out.
  const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
  for (const [size, file, scale, bleed] of jobs) {
    const s = Math.round(size * scale);
    const html = `<!doctype html><html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:${bleed ? NAVY : 'transparent'}">
      <div style="width:${s}px;height:${s}px">${fav.replace('<svg ', `<svg width="${s}" height="${s}" style="display:block" `)}</div></div></body></html>`;
    await page.setContent(html);
    await page.screenshot({ path: join(root, file), omitBackground: !bleed, clip: { x: 0, y: 0, width: size, height: size } });
  }
  await browser.close();
  // ICO: 16, 32 and 48 in one file.
  execFileSync('python3', ['-c', `
from PIL import Image
imgs=[Image.open(p).convert('RGBA') for p in ${JSON.stringify(['scripts/.brand-16.png', 'scripts/.brand-32.png', 'scripts/.brand-48.png'].map((p) => join(root, p)))}]
imgs[2].save(${JSON.stringify(join(root, 'favicon.ico'))}, format='ICO', sizes=[(16,16),(32,32),(48,48)], append_images=imgs[:2])
`], { stdio: 'inherit' });
  for (const p of ['16', '32', '48']) rmSync(join(root, `scripts/.brand-${p}.png`), { force: true });
  console.log('raster: favicon.ico (16, 32, 48), apple-touch-icon.png, icon-192.png, icon-512.png, icon-mask.png');
}
await raster();

// ---- 5: manifest ---------------------------------------------------------------
const manifest = {
  name: 'deep, building in public', short_name: 'deep', start_url: '/',
  display: 'browser', background_color: '#0E1A33', theme_color: '#0E1A33',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-mask.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(root, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`manifest.webmanifest written. brand SVGs total ${(total / 1024).toFixed(1)} KB before gzip.`);
