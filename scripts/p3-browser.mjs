// Real local HTTP browser gate. Readiness comes from listen + HTTP + DOM, never a sleep.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
const root = process.cwd(), out = resolve('docs/verification/p3'), shots = resolve('docs/shots/p3');
mkdirSync(out, { recursive: true }); mkdirSync(shots, { recursive: true });
const html = readFileSync('index.html', 'utf8');
const scheme = readFileSync('/Users/deep/repos/dh-p1-scaffold/system.css', 'utf8');
const tokens = scheme.match(/:root \{[\s\S]*?\n\}/)[0] + '\n' + scheme.match(/:root\[data-scheme="light"\] \{[\s\S]*?\n\}/)[0];
writeFileSync(resolve(out, 'scheme-reference.css'), tokens);
const sections = ['log', 'writing'].map((id) => html.match(new RegExp(`<section[^>]* id="${id}"[^>]*>[\\s\\S]*?<\\/section>`))[0]).join('\n');
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepEndHQ P3 local verification</title><link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/system.css"><link rel="stylesheet" href="/docs/verification/p3/scheme-reference.css"><link rel="stylesheet" href="/home.css"><style>@view-transition{navigation:none}html{scroll-behavior:auto!important}.wx-ink{animation:none!important;opacity:1!important}h1{font:700 1rem var(--font-ui);margin:24px var(--pad)}.wx-main{min-width:0}</style><script>document.documentElement.dataset.scheme=new URLSearchParams(location.search).get('scheme')||'dark'</script></head><body><div class="home-wx"><h1>P3 / the log and the weekly narratives</h1><main class="wx-main">${sections}</main></div><script src="/docs/verification/p3/widget-grid.js" defer></script></body></html>`;
writeFileSync(resolve(out, 'fixture.html'), fixture);
const data = { window: {} }; vm.runInNewContext(readFileSync('data.js', 'utf8'), data);
const source = data.window.DH_DATA;
const canonical = source.journey.slice(0, 10).map((e) => String(e.day));
const auditFile = '/Users/deep/champ-skills/design/skills/visual-verify/scripts/audit.py';
const probe = readFileSync(auditFile, 'utf8').match(/PROBE = r"""([\s\S]*?)"""/)[1];
const server = createServer((req, res) => {
  try {
    const name = new URL(req.url, 'http://local').pathname;
    const path = resolve(root, `.${name === '/' ? '/index.html' : name}`);
    if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(path)] || 'application/octet-stream');
    res.end(readFileSync(path));
  } catch { res.writeHead(404).end('Not found'); }
});
await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
const port = server.address().port, base = `http://127.0.0.1:${port}`;
const url = (theme = 'dark') => `${base}/docs/verification/p3/fixture.html?scheme=${theme}`;
assert((await (await fetch(url())).text()).includes('data-island="widget-grid"'));
console.log(`HTTP readiness confirmed: ${base}, PID ${process.pid}, P3 mount present.`);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const results = [], errors = [];
async function ready(page, theme = 'dark') {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url(theme)); await page.locator('.wg-island[data-ready="true"]').waitFor(); await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-widget-id]')].every((el) => !el.style.transform || el.style.transform === 'none'));
}
async function order(page) {
  return page.locator('[data-widget-id]').evaluateAll((els) => els.map((el) => ({ id: el.dataset.widgetId, r: el.getBoundingClientRect() })).sort((a, b) => a.r.top - b.r.top || a.r.left - b.r.left).map((e) => e.id));
}
async function audit(page, state) {
  const findings = await page.evaluate(`(${probe})()`);
  writeFileSync(resolve(out, `audit-${state}.json`), JSON.stringify(findings, null, 2));
  const fails = findings.filter((f) => f.severity === 'FAIL');
  if (fails.length) console.log(JSON.stringify({ state, fails }, null, 2));
  assert.equal(fails.length, 0, `interface audit ${state}`);
  results.push({ state, audit: findings.reduce((a, f) => ({ ...a, [f.severity]: (a[f.severity] || 0) + 1 }), {}) });
}
try {
  for (const width of [375, 768, 1280]) for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: width === 375, isMobile: width === 375 });
    const page = await context.newPage(); await ready(page, theme);
    assert.equal(await page.locator('[data-widget-id]').count(), width === 375 ? 6 : 10);
    const layout = await page.locator('[data-slot="widget-grid"]').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(layout, width === 375 ? 2 : width === 768 ? 3 : 4);
    const overflow = await page.locator('main *').evaluateAll((els) => els.filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map((el) => ({ cls: el.className, rect: el.getBoundingClientRect().toJSON(), style: el.getAttribute('style') })));
    if (overflow.length) await page.locator('#log').screenshot({ path: resolve(shots, 'overflow-debug.png') });
    assert.deepEqual(overflow, [], `element-rect overflow at ${width}`);
    const metrics = await page.locator('.wx-metric-card dd').allTextContents();
    assert.deepEqual(metrics, [source.stats.days_public, source.stats.streak_weekdays, source.stats.entries, source.stats.companies].map(String));
    assert.equal(await page.locator('.wx-metric-week li').count(), 7);
    assert.equal(await page.locator('.wx-w-touch').count(), 0);
    const essay = source.posts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
    const expectedWords = essay.viz.nodes.filter((n) => n.kind === 'arc').map((n) => n.paras.reduce((sum, i) => { const b = essay.body[i]; return sum + (typeof b === 'string' ? b : [b.head, b.text, ...(b.lines || [])].filter(Boolean).join(' ')).split(/\s+/).filter(Boolean).length; }, 0));
    assert.deepEqual(await page.locator('.wx-w-spend li b').allTextContents(), Array.from(expectedWords, (n) => `${n} words`), 'word counts match source-linked paragraphs');
    assert.equal(await page.locator('.wx-wplay-btn').count(), 1);
    assert.equal(await page.locator('button:disabled').count(), 0);
    const clipped = await page.locator('.wg-card').evaluateAll((els) => els.filter((el) => el.scrollHeight > el.clientHeight + 1 || [...el.children].some((child) => child.getBoundingClientRect().bottom > el.getBoundingClientRect().bottom + 1)).map((el) => el.textContent.slice(0, 30)));
    assert.deepEqual(clipped, [], 'required card fields fit their tiles');
    const overlaps = await page.locator('[data-widget-id]').evaluateAll((els) => els.flatMap((el, i) => els.slice(i + 1).filter((other) => { const a = el.getBoundingClientRect(), b = other.getBoundingClientRect(); return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1; }).map((other) => [el.dataset.widgetId, other.dataset.widgetId])));
    assert.deepEqual(overlaps, [], 'settled widgets do not overlap');
    await audit(page, `${width}-${theme}`);
    for (const section of ['log', 'writing']) await page.locator(`#${section}`).screenshot({ path: resolve(shots, `${section}-${width}-${theme}.png`), animations: 'disabled' });
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }); await ready(page);
  const before = await order(page);
  const first = page.locator(`[data-widget-id="${before[0]}"]`), second = page.locator(`[data-widget-id="${before[1]}"]`);
  await first.scrollIntoViewIfNeeded();
  const a = await first.boundingBox(), b = await second.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + 20); await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + 20, { steps: 20 });
  await page.waitForFunction(() => !!document.querySelector('.wg-held'));
  await page.screenshot({ path: resolve(shots, 'pointer-mid-drag.png') });
  await page.mouse.up();
  await page.waitForFunction(() => localStorage.getItem('dh_log_order_v1'));
  await page.waitForFunction(() => [...document.querySelectorAll('[data-widget-id]')].every((el) => !el.style.transform || el.style.transform === 'none'));
  const dragged = await order(page); assert.notDeepEqual(dragged, before, 'pointer actually rearranged visible cards');
  await audit(page, 'reordered-reset-visible');
  await page.reload(); await page.locator('.wg-island[data-ready]').waitFor(); assert.deepEqual(await order(page), dragged, 'persisted visible order');
  await page.locator('.wg-reset').click(); await page.waitForFunction(() => localStorage.getItem('dh_log_order_v1') === null);
  assert.deepEqual(await order(page), before, 'reset visible order');
  await page.locator(`[data-widget-id="${before[0]}"]`).focus(); await page.keyboard.press('Alt+ArrowRight');
  await page.waitForFunction(() => !!localStorage.getItem('dh_log_order_v1'));
  assert.notDeepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('dh_log_order_v1'))), canonical, 'keyboard reordered');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.widgetId), before[0], 'keyboard retained focus');
  await page.locator('.wg-reset').click();
  await page.locator(`[data-widget-id="${before[0]}"] .wg-entry-link`).click();
  assert(new URL(page.url()).pathname.endsWith('/journey.html'), 'ordinary full-entry link activated');
  await ready(page);
  await page.evaluate(() => localStorage.setItem('dh_log_order_v1', '["353","353"]'));
  await page.reload(); await page.locator('.wg-island[data-ready]').waitFor(); assert.deepEqual(await order(page), before, 'invalid saved order rejected');
  await page.context().close();
  const touchContext = await browser.newContext({ viewport: { width: 375, height: 900 }, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage(); await ready(touchPage);
  const cdp = await touchContext.newCDPSession(touchPage);
  const small = touchPage.locator(`[data-widget-id="${canonical[1]}"]`); await small.scrollIntoViewIfNeeded();
  let box = await small.boundingBox();
  const scrollBefore = await touchPage.evaluate(() => scrollY);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 40, y: box.y + 80 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 40, y: box.y + 30 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 40, y: box.y - 40 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touchPage.waitForFunction((y) => scrollY > y, scrollBefore);
  assert.equal(await touchPage.evaluate(() => localStorage.getItem('dh_log_order_v1')), null, 'mobile scrolling does not reorder');
  await small.scrollIntoViewIfNeeded(); box = await small.boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 40, y: box.y + 20 }] });
  await small.locator('..').locator('[data-phase="lifted"]').waitFor();
  for (let step = 1; step <= 12; step++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 40 + (box.width + 20) * step / 12, y: box.y + 20 }] });
    await touchPage.evaluate(() => new Promise(requestAnimationFrame));
  }

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touchPage.waitForFunction(() => !!localStorage.getItem('dh_log_order_v1'));
  results.push({ state: 'touch', scrollAndLongPressReorder: true });
  await touchContext.close();
  const noStorage = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await noStorage.addInitScript(() => { for (const key of ['getItem', 'setItem', 'removeItem']) Storage.prototype[key] = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; });
  const blocked = await noStorage.newPage(); await ready(blocked);
  await blocked.locator('[data-widget-id]').first().focus(); await blocked.keyboard.press('Alt+ArrowRight');
  await blocked.getByRole('status').filter({ hasText: 'Browser storage is unavailable' }).waitFor();
  await audit(blocked, 'storage-unavailable'); await blocked.locator('.wg-reset').click();
  await blocked.getByRole('status').filter({ hasText: 'Newest-first order restored for this visit' }).waitFor();
  await noStorage.close();
  for (const js of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 375, height: 900 }, javaScriptEnabled: js, reducedMotion: 'reduce' });
    const p = await context.newPage(); await p.goto(url());
    if (js) await p.locator('.wg-island[data-reduced="true"]').waitFor();
    assert.equal(await p.locator('.wg-fallback > li:visible').count(), 6);
    assert.equal(await p.locator('[data-widget-id]').count(), 0);
    assert.equal(await p.locator('.wg-fallback > li:visible .wg-entry-link').count(), 6);
    if (js) await audit(p, 'reduced-motion');
    await p.locator('.wg-recent').screenshot({ path: resolve(shots, js ? 'reduced-motion.png' : 'javascript-off.png'), animations: 'disabled' });
    await p.locator('.wg-fallback .wg-entry-link').first().click(); assert(new URL(p.url()).pathname.endsWith('/journey.html'));
    await context.close();
  }
  // Whole legacy page is measured separately; third-party integrations are outside P3.
  const full = await browser.newPage({ viewport: { width: 375, height: 900 } });
  await full.route('https://**', (route) => route.abort()); await full.goto(`${base}/index.html`);
  const over = await full.locator('body *').evaluateAll((els) => els.filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !el.closest('svg,.wx-anat-track,.wx-hx-mare'); }).map((el) => ({ tag: el.tagName, cls: String(el.className).slice(0, 60) })));
  writeFileSync(resolve(out, 'whole-page-overflow.json'), JSON.stringify(over, null, 2));
  assert.equal(over.length, 0, 'whole homepage element-rect overflow'); await full.close();
  // Execute the actual audit.py CLI in addition to the in-flow probe above.
  for (const width of [375, 1280]) {
    const result = await promisify(execFile)('python3', [auditFile, url('dark'), '--width', String(width), '--theme', 'dark', '--json', resolve(out, `audit-cli-${width}.json`)]);
    writeFileSync(resolve(out, `audit-cli-${width}.txt`), result.stdout + result.stderr);
  }
  assert.deepEqual(errors, []);
  const report = { passed: true, scenarios: ['six viewport/scheme renders', 'four source-derived metrics', 'seven differentiated week tiles', 'element-rect overflow', 'pointer reorder', 'persistence', 'reset', 'Alt+arrow and focus', 'ordinary link activation', 'invalid storage', 'JS-off fallback', 'reduced motion', 'whole-page mobile overflow', 'audit.py CLI'], audits: results, consoleErrors: errors };
  writeFileSync(resolve(out, 'browser-results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); await new Promise((ok) => server.close(ok)); console.log('Browser and HTTP server closed.'); }
