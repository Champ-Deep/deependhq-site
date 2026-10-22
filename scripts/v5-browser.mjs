// V5 real-browser acceptance matrix. No network mocks or fabricated service output.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright-core';
const base=process.env.EDITORIAL_BASE||'http://127.0.0.1:3295';
const out=process.env.V5_OUT||'docs/shots/editorial-v5/local';mkdirSync(out,{recursive:true});
const probe=readFileSync('/Users/deep/champ-skills/design/skills/visual-verify/scripts/audit.py','utf8').split('PROBE = r"""')[1].split('"""')[0];
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const result={base,states:[],screenshots:[],errors:[],consoleErrors:[],checks:[],clicks:[]};
async function audit(page,name){
 const findings=await page.evaluate(`(${probe})()`);
 const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>{
  if(e instanceof SVGElement||e.closest('svg,.trn-table-wrap,.trn-fb-strip,.sr,.skip'))return false;
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&(r.left < -1||r.right>innerWidth+1);
 }).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON()})));
 result.states.push({name,findings,overflow});
}
async function load(ctx){
 const page=await ctx.newPage();page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text());});
 assert.equal((await page.goto(base,{waitUntil:'networkidle'})).status(),200);
 await page.evaluate(()=>document.fonts.ready);await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
 await page.locator('.trn-canvas[data-loaded="true"]').waitFor();return page;
}
async function shot(page,name,selector){
 const path=`${out}/${name}.png`;
 if(selector)await page.locator(selector).screenshot({path,style:'.sys-nav{position:absolute!important;top:0!important}'});else await page.screenshot({path});
 result.screenshots.push(path);
}
async function clickBooking(page,selector,name){
 const a=page.locator(selector);assert.equal(await a.getAttribute('href'),'https://scheduler.zoom.us/sreedeep');
 const popup=page.waitForEvent('popup');await a.click();const p=await popup;
 await p.waitForURL('https://scheduler.zoom.us/sreedeep*',{waitUntil:'commit',timeout:30000});
 result.clicks.push({name,url:p.url()});await p.close();
}
try{
 for(const width of [375,768,1280,1600])for(const scheme of ['dark','light']){
  const name=`${width}-${scheme}`,ctx=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,isMobile:width===375,hasTouch:width===375});
  const page=await load(ctx);
  assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
  assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'),scheme==='dark'?'#080808':'#F5F7F6');
  assert.equal(await page.locator('.v5-widget').count(),5);assert.equal(await page.locator('.v4-company').count(),12);
  assert.equal(await page.locator('.v4-latest[data-day="354"]').count(),1);assert.equal(await page.locator('.v4-previous a').count(),3);
  assert.equal(await page.locator('[data-island][data-mounted="1"]').count(),1);assert.equal(await page.locator('#machine [data-island="terrain"]').count(),1);
  assert.equal(await page.locator('.v5-book').count(),3);assert.equal(await page.locator('.v5-book-arrow').count(),3);
  assert.equal(await page.locator('#top [data-island]').count(),0);
  const geometry=await page.locator('.v5-book,.v5-hero-rail a,.sys-nav a:visible,.sys-nav button:visible').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.trim(),w:r.width,h:r.height};}));
  assert(geometry.every(r=>r.w>=44&&r.h>=44),JSON.stringify(geometry));
  const images=await page.locator('.v5-product-shot img').evaluateAll(es=>es.map(e=>({src:e.src,loaded:e.complete&&e.naturalWidth>0})));
  assert(images.every(r=>r.loaded),JSON.stringify(images));
  await page.locator('.v5-book').first().focus();assert.notEqual(await page.locator('.v5-book').first().evaluate(e=>getComputedStyle(e).outlineStyle),'none');await page.locator('.v5-book').first().blur();
  const fold=await page.locator('[data-booking="hero"] .v5-book').evaluate(e=>e.getBoundingClientRect().bottom);assert(fold<900,'Booking visible at mobile/desktop fold');
  await audit(page,name);await shot(page,name);
  for(const loc of ['hero','middle','footer'])await clickBooking(page,`[data-booking="${loc}"] .v5-book`,`${name}-${loc}`);
  for(const selector of ['#stack','#ecosystem','.v5-call','#log','#writing','#human','#machine','#ways','footer']){
   if(width===375||width===1280)await shot(page,`${name}-${selector.replace(/[#.]/g,'')}`,selector);
  }
  await page.locator('.v4-company summary').first().focus();await page.keyboard.press('Enter');assert(await page.locator('.v4-company').first().evaluate(e=>e.open));await audit(page,`${name}-company-open`);await page.keyboard.press('Enter');
  await page.locator('.otc-fs summary').click();assert(await page.locator('.otc-fs').evaluate(e=>e.open));await audit(page,`${name}-stack-open`);await page.locator('.otc-fs summary').click();
  await page.locator('.v4-ai summary').click();assert.equal(await page.locator('.v4-ai a:visible').count(),4);await audit(page,`${name}-ai-open`);await page.locator('.v4-ai summary').click();
  await page.locator('#trn-day').fill('2026-05-04');assert((await page.locator('.trn-readout').textContent()).includes('day 184'));assert.equal(await page.locator('.trn-open').getAttribute('href'),'journey.html#day-184');
  await page.locator('.trn-data summary').click();assert.equal(await page.locator('.trn-data tbody tr').count(),170);await audit(page,`${name}-terrain-table`);await page.locator('.trn-data summary').click();
  await page.evaluate(()=>window.scrollTo(0,0));await page.locator('[data-dh-scheme]').click();assert.equal(await page.locator('html').getAttribute('data-scheme'),'light');await page.locator('[data-dh-scheme]').click();assert.equal(await page.locator('html').getAttribute('data-scheme'),'dark');
  await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('html').getAttribute('data-scheme'),'dark');await page.locator('[data-dh-scheme]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('dh_scheme')),null);assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
  await page.waitForTimeout(500);
  if(width===375){await page.locator('.nav-burger').click();assert.equal(await page.locator('.nav-burger').getAttribute('aria-expanded'),'true');await audit(page,`${name}-menu`);await page.keyboard.press('Escape');}
  result.checks.push({name,geometry,images,fold});await ctx.close();
 }
 for(const scheme of ['dark','light']){
  const ctx=await browser.newContext({viewport:{width:375,height:900},javaScriptEnabled:false,colorScheme:scheme});const page=await ctx.newPage();await page.goto(base);
  assert.equal(await page.locator('.v5-book').count(),3);assert.equal(await page.locator('.v4-company').count(),12);assert.equal(await page.locator('.trn-fb').count(),1);await ctx.close();
  const rm=await browser.newContext({viewport:{width:1280,height:900},colorScheme:scheme,reducedMotion:'reduce'}),p=await load(rm);
  await audit(p,`reduced-${scheme}`);await shot(p,`reduced-${scheme}`);assert.equal(await p.locator('.trn-canvas').evaluate(c=>c.terrainState().flat),true);await clickBooking(p,'[data-booking="hero"] .v5-book',`reduced-${scheme}`);await rm.close();
 }
 result.failures=result.states.flatMap(s=>s.findings.filter(f=>f.severity==='FAIL').map(f=>({...f,state:s.name})));
 result.rectOverflow=result.states.flatMap(s=>s.overflow.map(o=>({...o,state:s.name})));
 assert.deepEqual(result.errors,[]);assert.equal(result.rectOverflow.length,0,'rect overflow, see browser-results.json');assert.equal(result.failures.length,0,'audit failures, see browser-results.json');
}finally{writeFileSync(`${out}/browser-results.json`,JSON.stringify(result,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({states:result.states.length,screenshots:result.screenshots.length,clicks:result.clicks.length,errors:result.errors.length,consoleErrors:result.consoleErrors.length,failures:result.failures.length}));
