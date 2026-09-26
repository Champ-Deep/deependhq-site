#!/usr/bin/env node
// shot.mjs : screenshot a local page at real viewport widths, and separately
// capture what a JavaScript-disabled visitor sees.
//
//   node scripts/shot.mjs <baseUrl> <name:width> [<name:width> ...]
//   node scripts/shot.mjs --nojs <baseUrl> <name>
//
// Used to check the definition of done at 375, 768, 1280 and 1600 without a
// browser in the loop. Writes PNGs to scripts/.shots/ and prints the console
// errors and the horizontal-overflow measurement for each shot.

import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '.shots');
mkdirSync(OUT, { recursive: true });

const require_ = createRequire(import.meta.url);
let chromium;
for (const mod of ['playwright', 'playwright-core', 'puppeteer-core']) {
  try { ({ chromium } = require_(mod)); break; } catch { /* next */ }
}
if (!chromium) {
  console.error('no playwright or puppeteer available. install one, or pass CHROME_BIN.');
  process.exit(2);
}

const CHROME = process.env.CHROME_BIN
  || ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'].find((p) => existsSync(p));

const args = process.argv.slice(2);
const nojs = args[0] === '--nojs';
const rest = nojs ? args.slice(1) : args;
const base = rest[0];
const specs = rest.slice(1);
if (!base || !specs.length) {
  console.error('usage: node scripts/shot.mjs [--nojs] <baseUrl> <name[:width]> ...');
  process.exit(2);
}

const launch = chromium.launch
  ? chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--font-render-hinting=none'] })
  : null;
if (!launch) { console.error('this puppeteer build has no chromium launcher'); process.exit(2); }

const browser = await launch;
let bad = 0;

for (const spec of specs) {
  const [name, wRaw] = spec.split(':');
  const width = wRaw ? parseInt(wRaw, 10) : 1280;
  const height = name === 'nojs' ? 1400 : 1200;
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    javaScriptEnabled: !nojs,
  });
  const page = await ctx.newPage();
  const errors = [];
  const failedReq = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => failedReq.push(`${r.url()} ${r.failure()?.errorText || ''}`));
  const external = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!u.startsWith(base) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
  });

  const target = `${base}/${name === 'nojs' ? '' : name}.html`;
  const resp = await page.goto(target, { waitUntil: 'load', timeout: 30000 }).catch((e) => ({ status: () => 'ERR ' + e.message }));
  const status = resp && resp.status ? resp.status() : 'n/a';
  await page.waitForTimeout(nojs ? 300 : 2200);

  // Measurements. With JS off, only the prerendered markup exists, which is
  // exactly what we want to measure.
  // Optional CSS selector to screenshot or measure one component.
  const sel = process.env.SEL || null;

  const m = await page.evaluate((sel) => {
    const de = document.documentElement;
    const over = [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > de.clientWidth + 1)
      .slice(0, 6)
      .map((el) => `${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`);
    return {
      scrollW: de.scrollWidth,
      clientW: de.clientWidth,
      overflow: de.scrollWidth > de.clientWidth + 1,
      offenders: over,
      rootText: (document.getElementById('root')?.innerText || '').trim().length,
      h1: document.querySelector('h1')?.innerText?.trim().slice(0, 70) || null,
      title: document.title,
      selText: sel ? ((document.querySelector(sel)?.innerText || '').trim().slice(0, 400)) : null,
    };
  }, sel);

  if (sel) {
    console.log(`     selector "${sel}" text:\n${(m.selText || '(not found)').split('\n').map((l) => '       ' + l).join('\n')}`);
  }
  const file = join(OUT, `${name}-${width}${nojs ? '-nojs' : ''}${sel ? '-sel' : ''}.png`);
  // The homepage is over 9000px tall. A full-page shot at 2x device scale on
  // that height times out in Chromium, so full page is opt-in via FULL=1 and
  // the default is the viewport, which is what the 375 first-paint check needs.
  const full = process.env.FULL === '1' && !nojs;
  // animations:'disabled' freezes CSS animations and the caret. The design
  // system has a blinking cursor and a pulse on the status dot, and an
  // infinitely animating element makes Chromium's screenshot stability check
  // spin until the timeout instead of ever settling.
  // A clip bounds the capture region, which is what stops Chromium's screenshot
  // from waiting for a 9000px page to become "stable". The clip is the measured
  // document height, so the image is still the whole page.
  let clip;
  if (full) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    clip = { x: 0, y: 0, width: width, height: Math.min(h, 20000) };
  }
  const shotOpts = { path: file, animations: 'disabled', caret: 'hide', timeout: 45000 };
  if (sel) {
    const el = await page.$(sel);
    if (el) await el.screenshot(shotOpts).catch((e) => console.log(`     (element shot failed: ${String(e.message).split('\n')[0]})`));
    else console.log(`     selector "${sel}" not found in the DOM`);
  } else {
    if (clip) shotOpts.clip = clip;
    await page.screenshot(shotOpts).catch((e) => console.log(`     (shot failed: ${String(e.message).split('\n')[0]})`));
  }
  writeFileSync(join(OUT, `${name}-${width}${nojs ? '-nojs' : ''}.json`),
    JSON.stringify({ status, ...m, errors, failedReq, external: [...new Set(external)] }, null, 2));

  const flag = m.overflow || errors.length ? 'WARN' : 'ok  ';
  if (m.overflow || errors.length) bad++;
  console.log(`${flag} ${name}@${width}${nojs ? ' (no js)' : ''} status=${status} rootText=${m.rootText} scrollW=${m.scrollW}/${m.clientW} h1="${m.h1}"`);
  if (m.overflow) console.log(`     horizontal overflow, first offenders: ${m.offenders.join(', ')}`);
  for (const e of errors.slice(0, 4)) console.log(`     console: ${e.slice(0, 160)}`);
  for (const e of failedReq.slice(0, 4)) console.log(`     failed req: ${e.slice(0, 120)}`);
  for (const e of [...new Set(external)].slice(0, 6)) console.log(`     external: ${e.slice(0, 120)}`);
  await ctx.close();
}

await browser.close();
console.log(`\nshots in ${OUT}`);
if (bad) { console.log(`${bad} shot(s) need attention.`); process.exitCode = 1; }
