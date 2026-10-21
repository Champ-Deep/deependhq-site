// Adapted from production-review/real-assistant-origin.mjs. Real service, no response substitution.
// Chrome maps only deependhq.com to the local HTTPS Worker serving the editorial preview.
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const PORT = process.env.PORT || '8444';
const shots = 'docs/shots/assistant-greeting', out = 'docs/verification/assistant-greeting';
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: [`--host-resolver-rules=MAP deependhq.com 127.0.0.1:${PORT}`, '--ignore-certificate-errors'],
});
const report = { origin: 'https://deependhq.com (host-mapped to local editorial-preview Worker)', states: [] };
try {
  for (const width of [375, 1280]) for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, isMobile: width === 375, hasTouch: width === 375, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const s = { width, scheme, console: [], failed: [], assistantResponses: [], pageErrors: [] };
    report.states.push(s);
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) s.console.push(`${m.type()}: ${m.text()}`); });
    page.on('requestfailed', r => s.failed.push({ url: r.url(), err: r.failure()?.errorText }));
    page.on('pageerror', e => s.pageErrors.push(String(e)));
    page.on('response', r => { if (r.url().includes('assistant.deependhq.com')) s.assistantResponses.push({ url: r.url(), status: r.status(), acao: r.headers()['access-control-allow-origin'] || null }); });
    try {
      const resp = await page.goto('https://deependhq.com/', { waitUntil: 'networkidle' });
      s.status = resp.status(); s.origin = await page.evaluate(() => location.origin);
      assert.equal(s.status, 200); assert.equal(s.origin, 'https://deependhq.com');
      await page.locator('#dh-assistant-btn').waitFor({ timeout: 15000 });
      // Do not pass on an absent or failed widget: its real delayed card must exist in the DOM.
      await page.waitForTimeout(12000);
      await page.locator('.dh-pro').waitFor({ state: 'attached', timeout: 15000 });
      s.overlay = [];
      for (const frac of [0, 0.5, 1]) {
        await page.evaluate(f => scrollTo({ top: (document.documentElement.scrollHeight - innerHeight) * f, behavior: 'instant' }), frac);
        await page.waitForTimeout(600);
        s.overlay.push(await page.evaluate(frac => {
          const card = document.querySelector('.dh-pro'), style = getComputedStyle(card);
          const blocked = [...document.querySelectorAll('a[href],button,input,select,textarea,summary')].filter(e => !e.closest('.dh-pro,#dh-assistant-btn'))
            .map(e => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight)
            .filter(({ r }) => document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('.dh-pro'))
            .map(({ e }) => ({ text: (e.textContent || '').trim().slice(0, 40), href: e.getAttribute('href') }));
          return { frac, greetingPresent: true, display: style.display, greetingRect: card.getBoundingClientRect().toJSON(), blocked };
        }, frac));
      }
      await page.screenshot({ path: `${shots}/${width}-${scheme}-footer.png` });
      assert(s.overlay.every(o => o.display === 'none' && o.greetingRect.width === 0 && o.blocked.length === 0), 'Delayed greeting must be hidden and block no controls');
      // Trial clicks run real pointer actionability checks without navigating away or spending on a chat.
      s.links = [];
      for (const selector of ['.ev3-tools', '.ev3-proof-link', '#log a[href*="journey"]', 'footer a[href="now.html"]', 'footer a[href="feed.xml"]', 'footer button.hwf-up', 'footer a[href="/privacy"]']) {
        const link = page.locator(selector).last();
        await link.click({ trial: true, timeout: 5000 });
        s.links.push({ selector, href: await link.getAttribute('href'), clickable: true });
      }
      // Actual in-page CTA and back-to-top clicks, then the real shadow-DOM chat.
      await page.locator('.ev3-tools').click(); assert.equal(new URL(page.url()).hash, '#stack');
      await page.locator('footer button.hwf-up').click();
      // Poll via CDP evaluation: Playwright 1.49 waitForFunction uses eval blocked by the real CSP.
      for (let n = 0; n < 60 && await page.evaluate(() => scrollY > 0); n++) await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => scrollY), 0);
      await page.screenshot({ path: `${shots}/${width}-${scheme}-greeting-hidden.png` });
      await page.locator('#dh-assistant-btn').click();
      const input = page.locator('deep-assistant textarea#q');
      await input.waitFor({ state: 'visible' });
      assert(await input.isEditable());
      await input.fill('Local input check. Not submitted.');
      assert.equal(await input.inputValue(), 'Local input check. Not submitted.');
      await input.fill(''); s.usable = true;
      await page.screenshot({ path: `${shots}/${width}-${scheme}-assistant-open.png` });
      await page.locator('deep-assistant button.close').click();
      await input.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('deep-assistant').getAttribute('open'), null);
      s.closed = true;
      await page.locator('deep-assistant button.launcher').click();
      await input.waitFor({ state: 'visible' }); s.reopened = true;
      await page.locator('deep-assistant button.close').click();
      await input.waitFor({ state: 'hidden' });
      await page.locator('footer a[href="/privacy"]').last().click();
      await page.waitForURL('https://deependhq.com/privacy');
      s.privacyNavigated = await page.locator('h1').textContent() === 'What this site records, and what it refuses to.';
      assert(s.privacyNavigated);
      assert(s.assistantResponses.some(r => new URL(r.url).pathname === '/static/widget.js' && r.status === 200));
      for (const path of ['/static/deep-assistant.js', '/widget-config', '/outreach/check']) {
        assert(s.assistantResponses.some(r => new URL(r.url).pathname === path && r.status === 200 && r.acao === 'https://deependhq.com'), `${path}: real origin response`);
      }
      assert.deepEqual(s.pageErrors, []); assert.deepEqual(s.failed, []); assert.deepEqual(s.console, []);
      s.pass = true;
    } catch (e) { s.error = String(e); s.pass = false; }
    finally { await ctx.close(); }
    console.log(JSON.stringify({ width, scheme, pass: s.pass, error: s.error, overlay: s.overlay, links: s.links?.length, usable: s.usable, closed: s.closed, reopened: s.reopened, privacyNavigated: s.privacyNavigated }));
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/real-assistant-origin.json`, JSON.stringify(report, null, 2) + '\n');
}
assert.equal(report.states.length, 4);
assert(report.states.every(s => s.pass), 'Real-assistant greeting regression failed; see JSON');
