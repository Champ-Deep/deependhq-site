"""Resolve LOOK hypotheses using the actual live DOM and recapture lazy sections."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
base='https://deependhq-refresh-v2-preview-20261021.deep-ae0.workers.dev'
out=Path('docs/verification/release')
shots=Path('docs/shots/release')
report={}
with sync_playwright() as p:
    browser=p.chromium.launch()
    for scheme in ['light','dark']:
        page=browser.new_page(viewport={'width':375,'height':900},color_scheme=scheme)
        page.goto(base,wait_until='networkidle')
        page.add_style_tag(content='html{scroll-behavior:auto!important}')
        page.wait_for_selector('.gfc-root')
        before=page.locator('.gfc-root').evaluate_all("es=>es.map(e=>({entered:!!e.dataset.entered,opacity:getComputedStyle(e).opacity,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height}))")
        for folder in page.locator('.gfc-root').all():
            folder.scroll_into_view_if_needed();page.wait_for_timeout(450)
        page.wait_for_timeout(1500)
        after=page.locator('.gfc-root').evaluate_all("es=>es.map(e=>({entered:!!e.dataset.entered,opacity:getComputedStyle(e).opacity,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height}))")
        print('Folder state',scheme,len(after),json.dumps(after),flush=True)
        assert len(after)==12 and all(e['entered'] and e['opacity']=='1' for e in after)
        # Exercise the real dismiss control, do not hide or replace the assistant.
        close=page.locator('.dh-pro-x:visible')
        if close.count():close.first.click()
        page.locator('#ecosystem').screenshot(path=str(shots/f'375-{scheme}-section-ecosystem.png'))
        page.locator('.gfc-hit').first.click();page.wait_for_timeout(500)
        page.locator('#ecosystem').screenshot(path=str(shots/f'375-{scheme}-folder-open.png'))
        report['folders-'+scheme]={'before':before,'after':after,'count':12,'all_readable_after_real_scroll':True}
        page.set_viewport_size({'width':768,'height':900});page.goto(base,wait_until='networkidle')
        report['nav-'+scheme]=page.locator('.theme-switch,.theme-switch [data-dh-scheme-label],.nav-links a').evaluate_all("es=>es.map(e=>({text:e.textContent,rect:e.getBoundingClientRect().toJSON(),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,whiteSpace:getComputedStyle(e).whiteSpace}))")
        page.set_viewport_size({'width':1600,'height':900});page.goto(base,wait_until='networkidle')
        page.locator('.trn-canvas').scroll_into_view_if_needed();page.wait_for_timeout(900)
        report['terrain-'+scheme]=page.locator('.trn-canvas').evaluate("c=>{const s=c.terrainState();return {width:c.clientWidth,height:c.clientHeight,canvasWidth:c.width,canvasHeight:c.height,progress:s.progress,faces:s.faces.length,bounds:{minX:Math.min(...s.faces.flatMap(f=>f.points.map(p=>p[0]))),maxX:Math.max(...s.faces.flatMap(f=>f.points.map(p=>p[0]))),minY:Math.min(...s.faces.flatMap(f=>f.points.map(p=>p[1]))),maxY:Math.max(...s.faces.flatMap(f=>f.points.map(p=>p[1])))}}}")
        page.set_viewport_size({'width':1280,'height':900});page.goto(base,wait_until='networkidle')
        report['chart-'+scheme]=page.locator('.wx-metric-arcs li').evaluate_all("es=>es.map(e=>({text:e.textContent,track:e.querySelector('.wx-metric-track')?.getBoundingClientRect().width,bar:e.querySelector('.wx-metric-track i')?.getBoundingClientRect().width,declared:e.querySelector('.wx-metric-track i')?.style.width}))")
        report['footer-'+scheme]=page.locator('.hwf-col h3,.hwf-priv,.hwf-day').evaluate_all("es=>es.map(e=>({text:e.textContent.slice(0,50),top:e.getBoundingClientRect().top,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,color:getComputedStyle(e).color}))")
        page.goto(base+'/journey',wait_until='networkidle')
        report['journey-'+scheme]=page.locator('[class*="cs-"]').evaluate_all("es=>es.filter(e=>/canvas|stats|month|longest|stat-row/.test(e.className)).map(e=>({cls:e.className,text:e.textContent.slice(0,60),rect:e.getBoundingClientRect().toJSON()}))")
        page.goto(base+'/account',wait_until='networkidle')
        report['account-'+scheme]=page.locator('section[aria-labelledby="balance-h"]').inner_text()
        page.close()
    browser.close()
(out/'look-dom-resolution.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2)[:20000])
