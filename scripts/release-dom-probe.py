from playwright.sync_api import sync_playwright
import json
from pathlib import Path
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':1280,'height':900},color_scheme='light')
    results={}
    for path in ['/', '/journey', '/account', '/lead-scorer']:
        page.goto('http://127.0.0.1:3277'+path,wait_until='networkidle')
        if path=='/lead-scorer':
            page.set_viewport_size({'width':375,'height':900})
            page.set_input_files('#file',{'name':'probe.csv','mimeType':'text/csv','buffer':b'Name,Email,Title\nCasey Example,casey@example.com,Director\n'})
        if path=='/account':page.set_viewport_size({'width':375,'height':900})
        results[path]=page.evaluate('''() => {
          const sels=['.hwf-day','.hwf-rule','.gfc-sheet-name','.gfc-sheet','.brand','.topbar','.topnav','.ep-wk','.dh-pill-gold'];
          return {styles:sels.flatMap(sel=>[...document.querySelectorAll(sel)].slice(0,1).map(e=>({sel,text:e.textContent.slice(0,70),style:e.getAttribute('style'),rect:e.getBoundingClientRect().toJSON(), chain:[e,e.parentElement,e.parentElement.parentElement].map(n=>({cls:n.className,c:getComputedStyle(n).color,bg:getComputedStyle(n).backgroundColor,opacity:getComputedStyle(n).opacity}))}))),overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&(r.right>innerWidth+1||r.left < -1)}).map(e=>({tag:e.tagName,cls:e.className,rect:e.getBoundingClientRect().toJSON(),overflow:getComputedStyle(e).overflowX}))};
        }''')
        page.set_viewport_size({'width':1280,'height':900})
    Path('docs/verification/release/dom-probe.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results,indent=2)[:16000])
    browser.close()
