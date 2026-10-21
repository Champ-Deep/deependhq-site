// Resolve screenshot hypotheses against the actual hosted page.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const base = 'https://deependhq-editorial-v4-preview.deep-ae0.workers.dev';
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results = [];
try {
  for (const width of [375,768,1280,1600]) for (const colorScheme of ['dark','light']) {
    const ctx = await browser.newContext({viewport:{width,height:900},colorScheme,isMobile:width===375,hasTouch:width===375});
    const page = await ctx.newPage();
    await page.goto(base,{waitUntil:'networkidle'});
    await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
    await page.locator('#dh-assistant-btn').waitFor();
    assert.equal(await page.locator('#wx-eco-h').textContent(),'Group CMO across twelve companies');
    const logo = await page.locator('.sys-nav a').first().boundingBox();
    assert(logo && logo.x>=0 && logo.y>=0 && logo.x+logo.width<=width);
    const previous = await page.locator('.v4-previous a').evaluateAll(es=>es.map(e=>({text:e.textContent,width:e.clientWidth,scrollWidth:e.scrollWidth,height:e.clientHeight,scrollHeight:e.scrollHeight})));
    assert.equal(previous.length,3);
    assert(previous.every(e=>e.scrollWidth<=e.width+1 && e.scrollHeight<=e.height+1));
    const controls = [];
    for (const selector of ['.v4-tools a','.v4-company summary','.v4-previous a','.v4-ai summary','.otc-fs summary','footer a']) {
      for (const element of await page.locator(selector).all()) {
        await element.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
        const row = await element.evaluate(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim().slice(0,70),clear:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),disabled:!!e.disabled}});
        controls.push(row);
      }
    }
    assert(controls.every(e=>e.clear&&!e.disabled),JSON.stringify(controls.filter(e=>!e.clear||e.disabled)));
    await page.locator('.trn-canvas[data-loaded="true"]').waitFor();
    await page.locator('#trn-day').fill('2026-05-04');
    assert(await page.getByRole('button',{name:'Previous calendar day',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Next calendar day',exact:true}).click();
    assert.equal(await page.locator('#trn-day').inputValue(),'2026-05-05');
    await page.getByRole('button',{name:'Previous calendar day',exact:true}).click();
    assert.equal(await page.locator('#trn-day').inputValue(),'2026-05-04');
    const end = await page.locator('#trn-day').getAttribute('max');
    await page.locator('#trn-day').fill(end);
    assert(await page.getByRole('button',{name:'Next calendar day',exact:true}).isDisabled());
    const footer = await page.locator('.foot-bottom').evaluate(e=>({position:getComputedStyle(e).position,text:e.textContent,height:e.clientHeight,scrollHeight:e.scrollHeight}));
    assert.equal(footer.position,'static');
    assert(footer.scrollHeight<=footer.height+1);
    assert.equal(await page.locator('.hwf-root,.signoff-marks').count(),0);
    let greeting = null;
    if (width===375 && colorScheme==='light') {
      await page.waitForTimeout(23000);
      greeting = await page.locator('.dh-pro').evaluateAll(es=>es.map(e=>({display:getComputedStyle(e).display,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
      assert(greeting.length>0 && greeting.every(e=>e.display==='none' && e.width===0 && e.height===0));
    }
    results.push({width,colorScheme,logo,previous,controls,footer,greeting,dayPickerBoundaries:true});
    await ctx.close();
  }
} finally {
  await browser.close();
  writeFileSync('docs/verification/editorial-v4/look-dom.json',JSON.stringify({base,results},null,2)+'\n');
}
console.log(`${results.length} hosted size/scheme cases: logo, three archive links, all directory/tool/footer controls, day-picker boundaries and in-flow privacy verified.`);
