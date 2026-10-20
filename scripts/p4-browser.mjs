import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import assert from 'node:assert/strict';
const ROOT = process.cwd(), OUT = 'docs/verification/p4', SHOTS = 'docs/shots/p4';
mkdirSync(SHOTS,{recursive:true});
const p1 = readFileSync('/Users/deep/repos/dh-p1-scaffold/system.css','utf8');
writeFileSync(`${OUT}/p1-system.css`,p1);
const auditSource = readFileSync('/Users/deep/champ-skills/design/skills/visual-verify/scripts/audit.py','utf8').split('PROBE = r"""')[1].split('"""')[0].replace('out.push({ severity:', "out.push({ owner: el ? (el.closest('#top,#day')?.id || 'other') : 'document', severity:");
const server = createServer((req,res) => {
  const path = resolve(ROOT, '.' + decodeURIComponent(new URL(req.url,'http://local').pathname === '/' ? '/index.html' : new URL(req.url,'http://local').pathname));
  if (!path.startsWith(ROOT+'/')) {res.writeHead(403).end();return;}
  try { const body = readFileSync(path); res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'application/javascript','.jsx':'text/plain','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.png':'image/png','.ico':'image/x-icon'})[extname(path)]||'application/octet-stream'}).end(body); }
  catch {res.writeHead(404).end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base = `http://127.0.0.1:${server.address().port}`;
const response = await fetch(base); assert.equal(response.status,200); assert((await response.text()).includes('data-island="terrain"'));
console.log('Server ready and exact P4 mount verified',base);
const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results = {serverReady:true, fixture:'Actual homepage with P1 system.css supplied by route interception. No P1 merge. External assistant script excluded; section captures hide global sticky nav.', cases:[],audits:[],screenshots:[],errors:[]};
async function context(width,scheme,more={}) {
  const c = await browser.newContext({viewport:{width,height:900},colorScheme:scheme,isMobile:width<700,hasTouch:width<700,...more});
  await c.addInitScript(s => {localStorage.setItem('dh_scheme',s);document.addEventListener('DOMContentLoaded',()=>document.documentElement.setAttribute('data-scheme',s),{once:true});},scheme);
  await c.route('**/system.css',route=>route.fulfill({contentType:'text/css',body:p1}));
  await c.route('https://assistant.deependhq.com/static/widget.js',route=>route.fulfill({contentType:'application/javascript',body:''}));
  return c;
}
async function loaded(page) {
  await page.goto(base,{waitUntil:'networkidle'});
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}::view-transition-old(root),::view-transition-new(root){animation:none!important}'});
  await page.locator('canvas[data-loaded="true"]').waitFor();
  await page.locator('.trn-canvas').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.trn-canvas').terrainState().progress===1);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(400);
}
async function shot(page,selector,name) {
  const path=`${SHOTS}/${name}.png`;await page.locator(selector).screenshot({path,style:'.sys-nav{visibility:hidden!important}'});results.screenshots.push(path);
}
async function audit(page,name) {
  const all=await page.evaluate(`(${auditSource})()`);
  const findings=all.filter(f=>['top','day','document'].includes(f.owner));
  results.audits.push({name,findings,unowned:all.filter(f=>f.owner==='other')});
  return findings;
}
try {
  for (const width of [375,768,1280]) for(const scheme of ['dark','light']) {
    const ctx=await context(width,scheme),page=await ctx.newPage();
    page.on('pageerror',e=>results.errors.push(String(e)));
    await loaded(page);
    assert.equal(await page.locator('h1').textContent(),'I lead B2B growth and build the systems behind it.');
    const pixelCount=await page.locator('.trn-canvas').evaluate(c=>{let n=0;for(let i=3,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;i<d.length;i+=4)if(d[i])n++;return n;});assert(pixelCount>1000);
    const state=await page.locator('.trn-canvas').evaluate(c=>c.terrainState());assert.equal(state.flat,width<768);
    await shot(page,'#top',`${width}-${scheme}-hero`);
    await audit(page,`${width}-${scheme}-hero`);
    const over=await page.evaluate(()=>[...document.querySelectorAll('#top *,#day *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&(b.right>innerWidth+1||b.left < -1)&&!e.closest('.trn-table-wrap,.trn-fb-strip')&&e.tagName!=='svg'&&!(e instanceof SVGElement);}).map(e=>e.className));
    assert.deepEqual(over,[],`${width} owned element geometry`);
    const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
    assert(pageWidth<=width,`${width} whole-page horizontal overflow`);
    const disabled=await page.locator('#top button,#top input,#top select,#day button').evaluateAll(es=>es.filter(e=>e.disabled||e.getAttribute('aria-disabled')==='true').map(e=>e.outerHTML));
    assert.deepEqual(disabled,[]);
    assert.equal(await page.locator('#day .wx-stage').count(),7);
    if(width<1024) {
      assert.equal(await page.locator('#day').evaluate(e=>e.classList.contains('wx-is-pinned')),false);
      assert.equal(await page.locator('#day .wx-stage:visible').count(),7);
      for(const stage of await page.locator('#day .wx-stage').all()) {await stage.scrollIntoViewIfNeeded();await page.waitForTimeout(500);}
      await shot(page,'#day',`${width}-${scheme}-day-list`);
    } else {
      const clocks=[];
      for(let i=0;i<7;i++) {
        await page.locator(`.wx-anat-sent[data-s="${i+1}"]`).evaluate(e=>{const r=e.getBoundingClientRect();window.scrollTo(0,scrollY+r.top+r.height/2-innerHeight/2)});
        await page.waitForFunction(n=>document.querySelector(`.wx-anat-rail li:nth-child(${n})`)?.getAttribute('aria-current')==='step',i+1);
        clocks.push(await page.locator('.wx-anat-clock .wx-v').textContent());
        await page.waitForTimeout(450);
        await audit(page,`${scheme}-lane-${i+1}`);
      }
      assert.deepEqual(clocks,['15:00','16:30','18:00','19:00','23:00','01:03','02:00']);
      results.cases.push({name:`${scheme} seven scroll clocks`,clocks});
      await shot(page,'.wx-anat-stick',`${width}-${scheme}-day-ship`);
    }
    // Native day selection is the keyboard/touch alternative to tiny towers.
    await page.locator('#trn-day').selectOption('0');
    await page.locator('#trn-day').focus();
    assert((await page.locator('.trn-readout').textContent()).includes('day 184'));
    assert.equal(await page.locator('.trn-open').getAttribute('href'),'journey.html#day-184');
    await page.locator('.trn-data summary').click();
    assert.equal(await page.locator('.trn-data tbody tr').count(),169);
    assert.equal(await page.locator('.trn-data').getAttribute('open'),'');
    await audit(page,`${width}-${scheme}-table`);
    if(width===375) await shot(page,'.trn-root',`${width}-${scheme}-table`);
    const gap=await page.locator('[data-island="terrain"]').evaluate(el=>JSON.parse(el.dataset.props).rows.findIndex(r=>!r));
    await page.locator('#trn-day').selectOption(String(gap));
    assert((await page.locator('.trn-readout').textContent()).includes('no entry'));
    assert.equal(await page.locator('.trn-open').getAttribute('href'),'journey.html');
    results.cases.push({name:`${width} ${scheme}`,pixelCount,flat:state.flat,ownedOverflow:over.length,pageWidth,disabled:disabled.length,dayOptions:169});
    await ctx.close();
  }
  // Actual pointer navigation targets the projected face under the pointer.
  const ctx=await context(1280,'dark'),page=await ctx.newPage();await loaded(page);
  await page.locator('.trn-canvas').scrollIntoViewIfNeeded();
  await page.locator('.trn-view').click();
  await page.waitForFunction(()=>document.querySelector('.trn-canvas').dataset.view==='flat');
  const pt=await page.locator('.trn-canvas').evaluate(c=>{const s=c.terrainState();const f=s.faces.find(f=>f.index===0);const r=c.getBoundingClientRect();return {x:r.x+f.points.reduce((n,p)=>n+p[0],0)/f.points.length,y:r.y+f.points.reduce((n,p)=>n+p[1],0)/f.points.length}});
  await page.mouse.move(pt.x,pt.y);assert((await page.locator('.trn-readout').textContent()).includes('day 184'));
  await Promise.all([page.waitForURL('**/journey.html#day-184'),page.mouse.click(pt.x,pt.y)]);
  await page.locator('#day-184').waitFor({timeout:20000});
  results.cases.push({name:'Projected pointer tower reaches actual oldest journey anchor',url:page.url()});
  await loaded(page);await page.locator('.trn-canvas').focus();await page.keyboard.press('ArrowUp');
  const selected=await page.locator('.trn-canvas').evaluate(c=>c.terrainState().selected);assert.equal(selected,167);
  await page.locator('#trn-day').selectOption('0');await page.locator('.trn-open').focus();
  await Promise.all([page.waitForURL('**/journey.html#day-184'),page.keyboard.press('Enter')]);
  results.cases.push({name:'Canvas arrow selection and ordinary keyboard link navigation'});
  await loaded(page);
  await page.locator('.trn-canvas').scrollIntoViewIfNeeded();
  const yawBefore=await page.locator('.trn-canvas').evaluate(c=>c.terrainState().yaw);
  const dragBox=await page.locator('.trn-canvas').boundingBox();
  await page.mouse.move(dragBox.x+dragBox.width/2,dragBox.y+dragBox.height/2);await page.mouse.down();await page.mouse.move(dragBox.x+dragBox.width/2+50,dragBox.y+dragBox.height/2,{steps:5});await page.mouse.up();
  assert.notEqual(await page.locator('.trn-canvas').evaluate(c=>c.terrainState().yaw),yawBefore);
  results.cases.push({name:'Desktop pointer drag changes actual projection without navigating'});
  await page.locator('.trn-view').click();assert.equal(await page.locator('.trn-view').getAttribute('aria-pressed'),'true');
  await page.locator('.trn-view').click();await page.waitForFunction(()=>document.querySelector('.trn-canvas').terrainState().progress===1);
  await page.evaluate(()=>{window.__p4Mare=0;window.addEventListener('dh:mare',()=>window.__p4Mare++);});
  await page.locator('.wx-hx-mare').click();assert.equal(await page.evaluate(()=>window.__p4Mare),1);
  const dark=await page.locator('.trn-canvas').screenshot();
  await page.evaluate(()=>document.documentElement.dataset.scheme='light');await page.waitForTimeout(100);
  const light=await page.locator('.trn-canvas').screenshot();assert(!dark.equals(light));
  assert.equal(await page.locator('.trn-canvas').evaluate(c=>c.terrainState().palette.text),'#0E1A33');
  await page.setViewportSize({width:375,height:900});await page.waitForFunction(()=>document.querySelector('.trn-canvas').terrainState().flat);
  await page.setViewportSize({width:1280,height:900});await page.waitForFunction(()=>!document.querySelector('.trn-canvas').terrainState().flat);
  await page.locator('#ways').scrollIntoViewIfNeeded();await page.waitForTimeout(100);
  assert.equal(await page.locator('.trn-canvas').evaluate(c=>c.terrainState().raf),false);
  assert.equal(await page.locator('.trn-canvas').evaluate(c=>c.terrainState().visible),false);
  results.cases.push({name:'Theme repaint byte differs, resize switches flat, offscreen RAF sleeps'});await ctx.close();
  const rm=await context(1280,'dark',{reducedMotion:'reduce'}),rp=await rm.newPage();await loaded(rp);
  assert.equal(await rp.locator('.trn-canvas').evaluate(c=>c.terrainState().flat),true);
  assert.equal(await rp.locator('.trn-view').count(),0);
  assert.equal(await rp.locator('#day .wx-stage:visible').count(),7);
  await shot(rp,'#top','1280-dark-reduced');await audit(rp,'reduced-motion');await rm.close();
  const no=await context(375,'dark',{javaScriptEnabled:false}),np=await no.newPage();await np.goto(base);
  assert.equal(await np.locator('h1').textContent(),'I lead B2B growth and build the systems behind it.');
  assert.equal(await np.locator('.trn-fb').count(),1);assert.equal(await np.locator('#day .wx-stage:visible').count(),7);
  await shot(np,'#top','375-dark-no-js');await no.close();results.cases.push({name:'Reduced-motion flat and complete list; JavaScript-off headline, fallback and seven lanes'});
  assert.deepEqual(results.errors,[]);
  const fails=results.audits.flatMap(a=>a.findings.filter(f=>f.severity==='FAIL').map(f=>({...f,state:a.name})));
  writeFileSync(`${OUT}/audit-failures.json`,JSON.stringify(fails,null,2));
  console.log('Audit failures',JSON.stringify(fails,null,2));
  assert.equal(fails.length,0,'Owned audit failures');
} finally {
  writeFileSync(`${OUT}/browser-results.json`,JSON.stringify(results,null,2));
  await browser.close();await new Promise(r=>server.close(r));console.log('Browser and owned HTTP listener closed.');
}
console.log('P4 browser gates passed.');
