#!/usr/bin/env node
// og-render.mjs : render the brand OG cards from og.html into og/<id>.png.
// Run by hand after a copy or brand change; the PNGs are committed because CI
// has no Chromium. Bump ?v= in the page heads when an image changes (LinkedIn
// caches cards for about 7 days, Slack for 24 hours).
//
//   node scripts/brand/og-render.mjs [id ...]      default: every page id
//
// PNG, not WebP (older Slack and Discord clients skip WebP), 1200 by 630, and
// under 300 KB each, because WhatsApp drops larger previews. No em dashes.

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const IDS = ['home', 'journey', 'writing', 'toolkit', 'now', 'pillars', 'company', 'field-notes', 'default'];
const ids = process.argv.slice(2).length ? process.argv.slice(2) : IDS;
const require_ = createRequire(join(root, 'package.json'));
const { chromium } = require_('playwright-core');
const exe = [process.env.CHROME_BIN, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => p && existsSync(p));
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
mkdirSync(join(root, 'og'), { recursive: true });
let bad = 0;
for (const id of ids) {
  const url = `${pathToFileURL(join(root, 'og.html')).href}?page=${encodeURIComponent(id)}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const out = join(root, 'og', `${id}.png`);
  await page.locator('#og').screenshot({ path: out });
  const kb = statSync(out).size / 1024;
  if (kb > 300) bad++;
  console.log(`og/${id}.png ${kb.toFixed(0)} KB${kb > 300 ? '  OVER 300 KB' : ''}`);
}
await browser.close();
if (bad) { console.error(`${bad} card(s) over 300 KB`); process.exit(1); }
