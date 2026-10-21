// Preview-only gate. Real homepage assets and assistant, no network substitution.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const base = process.env.EDITORIAL_BASE || 'http://127.0.0.1:3294';
const out = 'docs/shots/editorial-v4';
mkdirSync(out, {recursive:true});
const probe = readFileSync('/Users/deep/champ-skills/design/skills/visual-verify/scripts/audit.py','utf8').split('PROBE = r"""')[1].split('"""')[0];
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const result = {base, states:[], screenshots:[], errors:[], consoleErrors:[], checks:[]};
async function audit(page,name) {
  const findings = await page.evaluate(`(${probe})()`);
  const overflow = await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{
    if(el instanceof SVGElement || el.closest('svg,.trn-table-wrap,.trn-fb-strip,.hwf-canvas,.gfc-tilt,.gfc-sheet-slot,.wg-card-sheen,.sr,.skip'))return false;
    const r=el.getBoundingClientRect(), s=getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && r.width>0 && r.height>0 && (r.left < -1 || r.right>innerWidth+1);
  }).map(el=>({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON()})));
  result.states.push({name,findings,overflow});
  assert.equal(overflow.length,0,`${name} element rect overflow`);
}
async function load(ctx) {
  const page=await ctx.newPage();
  page.on('pageerror',e=>result.errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push({url:page.url(),message:m.text()});});
  assert.equal((await page.goto(base,{waitUntil:'networkidle'})).status(),200);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.locator('.trn-canvas[data-loaded="true"]').waitFor();
  assert.equal(await page.locator('[data-island][data-mounted="1"]').count(),1, 'Only the terrain needs an island');
  return page;
}
async function shot(page,name) {
  const path=`${out}/${name}.png`;
  await page.screenshot({path}); result.screenshots.push(path);
}
try {
  for(const width of [375,768,1280,1600]) for(const scheme of ['dark','light']) {
    const ctx=await browser.newContext({viewport:{width,height:width===375?1100:900},colorScheme:scheme,isMobile:width===375,hasTouch:width===375});
    const page=await load(ctx), name=`${width}-${scheme}`;
    assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),scheme==='dark'?'#09140D':'#F7EDCE');
    const palette=await page.evaluate(()=>Object.fromEntries(['bg','text','build-text','win-text'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()])));
    assert.equal(palette.bg,scheme==='dark'?'#09140D':'#F7EDCE');
    assert.equal(palette.text,scheme==='dark'?'#EDF5DC':'#30291F');
    assert.equal(palette['build-text'],scheme==='dark'?'#71F394':'#48612B');
    assert.equal(await page.locator('h1').textContent(),'Deep.Sreedeep Surapaneni');
    assert.equal(await page.locator('.ev3-story h2').textContent(),'Marketer first.Builder by instinct.');
    assert.equal(await page.locator('#top [data-island]').count(),0);
    assert.equal(await page.locator('#machine [data-island="terrain"]').count(),1);
    const logWidths=await page.locator('.ev3-log-grid').evaluate(e=>({total:e.getBoundingClientRect().width,terrain:e.querySelector('.ev3-terrain').getBoundingClientRect().width,meta:e.querySelector('.wx-log-meta').getBoundingClientRect().width}));
    if(width>=768)assert(logWidths.terrain>logWidths.meta && logWidths.terrain+logWidths.meta>logWidths.total-60,JSON.stringify(logWidths));
    assert.equal(await page.locator('.ev3-arrow-icon i').count(),20,'21st source actually prerendered');
    assert.equal(await page.locator('.ev3-book').getAttribute('href'),'https://scheduler.zoom.us/sreedeep');
    assert.equal(await page.locator('.ev3-tools').getAttribute('href'),'#stack');
    assert.equal(await page.locator('.v4-latest .wx-tlink').getAttribute('href'),'journey.html#day-354');
    assert.equal(await page.locator('.v4-latest').getAttribute('data-day'),'354');
    assert.equal(await page.locator('.v4-company').count(),12);
    assert.equal(await page.locator('.v4-previous a').count(),3);
    assert.equal(await page.locator('.v4-tools .otc-try-card').count(),5);
    assert.equal(await page.locator('.tk-home,.gfc-root,.wg-island,.hwf-root,.signoff').count(),0);
    const geometry=await page.locator('.ev3-actions a,.v4-index a,.sys-nav a:visible,.sys-nav button:visible').evaluateAll(es=>es.map(e=>{
      const r=e.getBoundingClientRect();return {text:e.textContent.trim(),width:r.width,height:r.height};
    }));
    assert(geometry.every(r=>r.width>=44 && r.height>=44),JSON.stringify(geometry));
    await page.locator('.ev3-book').focus();
    const focus=await page.locator('.ev3-book').evaluate(e=>({width:getComputedStyle(e).outlineWidth,style:getComputedStyle(e).outlineStyle}));
    assert.notEqual(focus.width,'0px');assert.notEqual(focus.style,'none');
    await page.locator('.ev3-book').blur();
    // Settle actual external launcher before testing potential content obstruction.
    await page.locator('#dh-assistant-btn').waitFor({timeout:15000});
    const blocked=await page.locator('.ev3-actions a,.v4-index a').evaluateAll(es=>es.map(e=>{
      const r=e.getBoundingClientRect();return {text:e.textContent.trim(),inView:r.top>=0&&r.bottom<=innerHeight,clear:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))};
    }));
    assert(blocked.every(r=>!r.inView||r.clear),JSON.stringify(blocked));
    await audit(page,name);await shot(page,name);
    // Capture every redesigned section on the actual page, not a demo harness.
    for (const selector of ['#stack','#log','#writing','#ecosystem','#human','footer']) {
      const path=`${out}/${name}-${selector.replace('#','')}.png`;
      await page.locator(selector).screenshot({path,style:'.sys-nav{position:absolute!important;top:0!important}'});
      result.screenshots.push(path);
    }
    await page.locator('.v4-company summary').first().focus();await page.keyboard.press('Enter');
    assert(await page.locator('.v4-company').first().evaluate(e=>e.open));
    await audit(page,`${name}-company-open`);
    await page.keyboard.press('Enter');
    await page.locator('.v4-ai summary').click();
    assert.equal(await page.locator('.v4-ai a:visible').count(),4);
    await audit(page,`${name}-ai-open`);await page.locator('.v4-ai summary').click();
    await page.locator('.otc-fs summary').click();
    assert(await page.locator('.otc-fs').evaluate(e=>e.open));
    await audit(page,`${name}-full-stack-open`);await page.locator('.otc-fs summary').click();
    await page.locator('.ev3-tools').click();assert.equal(new URL(page.url()).hash,'#stack');
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.locator('[data-dh-scheme]').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('dh_scheme')),'light');
    await page.locator('[data-dh-scheme]').click();assert.equal(await page.locator('html').getAttribute('data-scheme'),'dark');
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('html').getAttribute('data-scheme'),'dark');
    await page.locator('[data-dh-scheme]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('dh_scheme')),null);
    assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
    await page.waitForTimeout(500); // Theme colour transitions must settle before measuring contrast.
    if(width===375) {
      await page.locator('.nav-burger').click();assert.equal(await page.locator('.nav-burger').getAttribute('aria-expanded'),'true');
      await audit(page,`${name}-menu`);await page.locator('.nav-burger').click();
    }
    await page.locator('.trn-canvas').scrollIntoViewIfNeeded();
    for(let n=0;n<100;n++) {
      if(await page.locator('.trn-canvas').evaluate(c=>c.terrainState().progress===1))break;
      await page.waitForTimeout(50);
    }
    assert.equal(await page.locator('.trn-canvas').evaluate(c=>c.terrainState().progress),1);
    const terrain=await page.locator('.trn-canvas').evaluate(c=>{const s=c.terrainState();return {flat:s.flat,rows:s.faces.length,pixels:c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)};});
    assert.equal(terrain.flat,width<768);assert(terrain.pixels);
    await page.locator('#trn-day').fill('2026-05-04');
    assert((await page.locator('.trn-readout').textContent()).includes('day 184'));
    assert.equal(await page.locator('.trn-open').getAttribute('href'),'journey.html#day-184');
    await page.locator('.trn-data summary').click();
    assert.equal(await page.locator('.trn-data tbody tr').count(),170);
    await audit(page,`${name}-terrain-table`);
    if(width===375 || width===1280){const path=`${out}/${name}-terrain.png`;await page.locator('.trn-root').screenshot({path,style:'.sys-nav{position:absolute!important;top:0!important}'});result.screenshots.push(path);}
    const gap=await page.locator('[data-island="terrain"]').evaluate(e=>JSON.parse(e.dataset.props).rows.findIndex(r=>!r));
    await page.locator('#trn-day').fill(new Date(Date.parse('2026-05-04')+gap*864e5).toISOString().slice(0,10));assert((await page.locator('.trn-readout').textContent()).includes('no entry'));
    assert.equal(await page.locator('.trn-open').getAttribute('href'),'journey.html');
    if(width>=768){await page.locator('.trn-view').click();assert.equal(await page.locator('.trn-view').getAttribute('aria-pressed'),'true');}
    result.checks.push({name,palette,geometry,focus,blocked,terrain});await ctx.close();
  }
  for(const scheme of ['dark','light']) {
    const ctx=await browser.newContext({viewport:{width:375,height:1100},colorScheme:scheme,javaScriptEnabled:false});
    const page=await ctx.newPage();await page.goto(base);
    assert((await page.locator('h1').textContent()).includes('Sreedeep Surapaneni'));
    assert.equal(await page.locator('.ev3-book').count(),1);assert.equal(await page.locator('.trn-fb').count(),1);
    assert.equal(await page.locator('.wx-stage:visible').count(),7);
    result.checks.push({name:`no-js-${scheme}`,primaryContent:true});await ctx.close();
    const rm=await browser.newContext({viewport:{width:1280,height:900},colorScheme:scheme,reducedMotion:'reduce'});
    const rp=await load(rm);await rp.locator('.trn-canvas').scrollIntoViewIfNeeded();
    assert.equal(await rp.locator('.trn-canvas').evaluate(c=>c.terrainState().flat),true);
    assert.equal(await rp.locator('.trn-view').count(),0);assert.equal(await rp.locator('.wx-stage:visible').count(),7);
    await audit(rp,`reduced-${scheme}`);result.checks.push({name:`reduced-${scheme}`,flat:true});await rm.close();
  }
  assert.deepEqual(result.errors,[]);
  const fails=result.states.flatMap(s=>s.findings.filter(f=>f.severity==='FAIL').map(f=>({...f,state:s.name})));
  result.failures=fails;assert.deepEqual(fails,[],'machine audit failures');
} finally {
  writeFileSync(`${out}/browser-results.json`,JSON.stringify(result,null,2)+'\n');await browser.close();
}
console.log(JSON.stringify({states:result.states.length,screenshots:result.screenshots.length,checks:result.checks.length,pageErrors:result.errors.length,consoleErrors:result.consoleErrors.length}));
