// Real combined Worker gate. No route interception, hidden nav or substituted CSS.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const base = process.env.RELEASE_BASE || 'http://127.0.0.1:3277';
const out = 'docs/verification/release', shots = 'docs/shots/release';
mkdirSync(shots, {recursive:true});
const probe = readFileSync('/Users/deep/champ-skills/design/skills/visual-verify/scripts/audit.py','utf8').split('PROBE = r"""')[1].split('"""')[0];
const data = JSON.parse(readFileSync('content.json','utf8'));
const routes = ['/', '/journey', '/post/week-48-the-receipts-arc', '/company/lake-b2b', '/toolkit', '/lead-scorer', '/account'];
const result = {base, states:[], errors:[], consoleErrors:[], failedRequests:[], assertions:[]};
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
function observe(page) {
  page.on('pageerror',e=>result.errors.push({url:page.url(),error:String(e)}));
  page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push({url:page.url(),error:m.text()});});
  page.on('requestfailed',r=>result.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
}
async function load(page,path='/') {
  const response=await page.goto(base+path,{waitUntil:'networkidle'});
  assert.equal(response.status(),200,path);
  assert(response.headers()['content-security-policy'],`${path} served Worker CSP`);
  await page.evaluate(()=>document.fonts.ready);
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  if(path==='/') {
    await page.locator('.wg-island[data-ready="true"]').waitFor();
    await page.locator('canvas.trn-canvas[data-loaded="true"]').waitFor();
    assert.equal(await page.locator('[data-island][data-mounted="1"]').count(),4,'all four canonical islands');
  }
  return response;
}
async function audit(page,name) {
  const findings=await page.evaluate(`(${probe})()`);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{
    if(el instanceof SVGElement||el.closest('svg,.trn-table-wrap,.trn-fb-strip,.hwf-canvas,.gfc-tilt,.gfc-sheet-slot,.wg-card-sheen')||el.matches('.tbl table,.tbl table *'))return false;
    const s=getComputedStyle(el),r=el.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0&&(r.left < -1 || r.right>innerWidth+1)&&!el.closest('.sr,.skip');
  }).map(el=>({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON()})));
  result.states.push({name,findings,overflow});
}
async function order(page) {
  return page.locator('[data-widget-id]').evaluateAll(es=>es.map(e=>({id:e.dataset.widgetId,r:e.getBoundingClientRect()})).sort((a,b)=>a.r.top-b.r.top||a.r.left-b.r.left).map(e=>e.id));
}
async function until(page, predicate) {
  for(let i=0;i<100;i++){if(await page.evaluate(predicate))return;await page.waitForTimeout(50);}
  assert.fail('State did not settle: '+String(predicate));
}
try {
  for(const width of [375,768,1280,1600])for(const scheme of ['light','dark']) {
    const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:scheme,isMobile:width===375,hasTouch:width===375});
    const page=await ctx.newPage();observe(page);
    for(const path of width===1600?['/']:routes) {
      await load(page,path);
      assert.equal(await page.locator('html').getAttribute('data-scheme'),scheme);
      assert.equal(await page.locator('[data-dh-scheme]').count(),1,`${path} one scheme control`);
      await audit(page,`${width}-${scheme}-${path}`);
      if(width!==768||path==='/')await page.screenshot({path:`${shots}/${width}-${scheme}-${path==='/'?'home':path.split('/').at(-1)}.png`});
      if(path==='/') {
        assert.equal(await page.locator('.wx-stage').count(),7);
        assert.equal(await page.locator('#trn-day option').count(),170);
        assert.equal(await page.locator('.wx-hx-live[data-day="354"]').count(),1);
        assert.equal(await page.locator('#proof').count(),0,'metrics appear only in the log');
        assert(await page.locator('.trn-canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),'terrain actually paints pixels');
        if(width===375||width===1280) {
          for(const section of ['#top','#log','#stack','#ecosystem','#writing','#human','footer']) {
            if(section==='#ecosystem') {
              for(const folder of await page.locator('.gfc-root').all()) {await folder.scrollIntoViewIfNeeded();await page.waitForTimeout(150);}
              await page.waitForTimeout(1500);
              assert.equal(await page.locator('.gfc-root[data-entered]').count(),12);
            }
            await page.locator(section).scrollIntoViewIfNeeded();await page.waitForTimeout(500);
            await page.locator(section).screenshot({path:`${shots}/${width}-${scheme}-section-${section.replace('#','')}.png`});
          }
        }
        await page.locator('#trn-day').selectOption('0');
        assert.equal(await page.locator('.trn-open').getAttribute('href'),'journey.html#day-184');
        await page.locator('.trn-data summary').click();
        assert.equal(await page.locator('.trn-data tbody tr').count(),170);
        await audit(page,`${width}-${scheme}-table-open`);
        await page.locator('.trn-data summary').click();
        await page.locator('.gfc-hit').first().click();
        await page.waitForFunction(()=>document.querySelector('.gfc-hit').getAttribute('aria-expanded')==='true');
        await page.waitForTimeout(450);
        await audit(page,`${width}-${scheme}-folder-open`);
        if(width===375||width===1280)await page.locator('#ecosystem').screenshot({path:`${shots}/${width}-${scheme}-folder-open.png`});
        await page.locator('.gfc-hit').first().click();
        if(width===1280) {
          const clocks=[];
          for(let i=1;i<=7;i++) {
            await page.locator(`.wx-anat-sent[data-s="${i}"]`).evaluate(e=>{const r=e.getBoundingClientRect();scrollTo(0,scrollY+r.top+r.height/2-innerHeight/2)});
            await page.locator(`.wx-anat-rail li:nth-child(${i})[aria-current="step"]`).waitFor();
            clocks.push(await page.locator('.wx-anat-clock .wx-v').textContent());
            await page.waitForTimeout(450);await audit(page,`${scheme}-lane-${i}`);
            if(i===7)await page.locator('.wx-anat-stick').screenshot({path:`${shots}/1280-${scheme}-lane-7.png`});
          }
          assert.deepEqual(clocks,['15:00','16:30','18:00','19:00','23:00','01:03','02:00']);
        } else if(width===375)await page.locator('#day').screenshot({path:`${shots}/375-${scheme}-day-list.png`});
      }
      if(path==='/lead-scorer') {
        await page.locator('#file').setInputFiles({name:'release-fixture.csv',mimeType:'text/csv',buffer:Buffer.from('Name,Email,Title\nCasey Example,casey@example.com,Director\n')});
        await page.locator('#sell').fill('Fixture analytics product');await page.locator('#want').fill('Technology directors');
        await audit(page,`${width}-${scheme}-upload-mapped`);
      }
    }
    await ctx.close();
  }
  const ctx=await browser.newContext({viewport:{width:1280,height:1000},colorScheme:'dark'}),page=await ctx.newPage();observe(page);await load(page);
  await page.emulateMedia({colorScheme:'light'});await page.locator('html[data-scheme="light"]').waitFor();
  await page.locator('[data-dh-scheme]').click();assert.equal(await page.locator('[data-dh-scheme-label]').textContent(),'light');
  await page.emulateMedia({colorScheme:'dark'});assert.equal(await page.locator('html').getAttribute('data-scheme'),'light');
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-scheme'),'light');
  await page.locator('[data-dh-scheme]').click();assert.equal(await page.locator('html').getAttribute('data-scheme'),'dark');
  await page.locator('[data-dh-scheme]').click();assert.equal(await page.evaluate(()=>localStorage.getItem('dh_scheme')),null);
  await page.emulateMedia({colorScheme:'light'});await page.locator('html[data-scheme="light"]').waitFor();
  result.assertions.push('System, persisted override, reload, reset and changed system preference');
  await load(page);const before=await order(page);
  const first=page.locator(`[data-widget-id="${before[0]}"]`),second=page.locator(`[data-widget-id="${before[1]}"]`);
  await first.evaluate(el=>el.scrollIntoView({block:'center'}));const a=await first.boundingBox(),b=await second.boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+20);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+20,{steps:20});await page.locator('.wg-held').waitFor();
  await page.screenshot({path:`${shots}/pointer-mid-drag.png`});await page.mouse.up();
  await until(page,()=>!!localStorage.getItem('dh_log_order_v1'));await page.waitForTimeout(400);
  const dragged=await order(page);assert.notDeepEqual(dragged,before);await audit(page,'pointer-reordered');
  await page.reload();await page.locator('.wg-island[data-ready]').waitFor();assert.deepEqual(await order(page),dragged);
  await page.locator('.wg-reset').click();await page.waitForTimeout(400);assert.deepEqual(await order(page),before);
  await page.locator(`[data-widget-id="${before[0]}"]`).focus();await page.keyboard.press('Alt+ArrowRight');
  await until(page,()=>!!localStorage.getItem('dh_log_order_v1'));await page.waitForTimeout(400);assert.notDeepEqual(await order(page),before);
  await audit(page,'keyboard-reordered');await page.locator('.wg-reset').click();
  result.assertions.push('Pointer and keyboard reorder, persisted order and reset');
  await load(page);await page.locator('.trn-canvas').focus();await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');await page.waitForURL(url=>/\/journey(?:\.html)?$/.test(url.pathname)&&/^#day-\d+$/.test(url.hash));
  await page.locator(new URL(page.url()).hash).waitFor();result.assertions.push('Terrain keyboard reaches real expanded journey anchor');
  await ctx.close();
  const blockedCtx=await browser.newContext({viewport:{width:1280,height:900}});
  await blockedCtx.addInitScript(()=>{for(const key of ['getItem','setItem','removeItem'])Storage.prototype[key]=()=>{throw new DOMException('Storage blocked','SecurityError')};});
  const blocked=await blockedCtx.newPage();observe(blocked);await load(blocked);
  await blocked.locator('[data-widget-id]').first().focus();await blocked.keyboard.press('Alt+ArrowRight');
  await blocked.getByRole('status').filter({hasText:'Browser storage is unavailable'}).waitFor();await audit(blocked,'storage-unavailable');await blockedCtx.close();
  result.assertions.push('Blocked storage leaves the grid usable with an honest status');
  for(const js of [false,true]) {
    const ctx=await browser.newContext({viewport:{width:375,height:900},javaScriptEnabled:js,reducedMotion:'reduce'});
    const page=await ctx.newPage();observe(page);await page.goto(base,{waitUntil:'networkidle'});
    assert((await page.locator('h1').textContent()).includes('I lead B2B growth'));
    assert.equal(await page.locator('.wx-stage').count(),7);
    if(js){await page.locator('.wg-island[data-ready]').waitFor();assert.equal(await page.locator('.trn-canvas').getAttribute('data-view'),'flat');await audit(page,'reduced-motion');}
    else {assert.equal(await page.locator('.trn-fb').count(),1);assert.equal(await page.locator('.wg-fallback').count(),1);assert((await page.locator('footer').textContent()).includes('Site'));}
    await page.screenshot({path:`${shots}/375-${js?'reduced-motion':'no-js'}.png`});await ctx.close();
  }
  result.assertions.push('JS-off primary content, static island fallbacks and reduced-motion flat terrain');
} finally {
  writeFileSync(`${out}/browser-results.json`,JSON.stringify(result,null,2));await browser.close();
}
console.log(JSON.stringify({states:result.states.length,assertions:result.assertions,errors:result.errors,consoleErrors:result.consoleErrors},null,2));
assert.equal(result.errors.length,0,'No page errors');
assert.equal(result.states.flatMap(s=>s.overflow).length,0,'No unexpected element-rect overflow');
assert.equal(result.states.flatMap(s=>s.findings.filter(f=>f.severity==='FAIL')).length,0,'No interface audit failures');
