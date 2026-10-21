"""Check the exact LOOK fixes on the deployed preview, without changing app state."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
base='https://deependhq-refresh-v2-preview-20261021.deep-ae0.workers.dev'
rows=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for scheme in ['light','dark']:
        page=browser.new_page(viewport={'width':768,'height':900},color_scheme=scheme)
        page.goto(base,wait_until='networkidle')
        label=page.locator('.theme-switch')
        assert label.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        page.locator('.nav-burger').click()
        assert page.locator('.nav-burger').get_attribute('aria-expanded')=='true'
        assert page.locator('#nav-drawer a').first.is_visible()
        page.locator('.nav-burger').click()
        assert page.locator('.nav-burger').get_attribute('aria-expanded')=='false'
        page.set_viewport_size({'width':1280,'height':900})
        page.goto(base+'/journey',wait_until='networkidle')
        panels=page.locator('.cs-corner').evaluate_all('es=>es.map(e=>getComputedStyle(e).backgroundColor)')
        assert panels and all(c not in ['transparent','rgba(0, 0, 0, 0)'] for c in panels)
        page.goto(base+'/account',wait_until='networkidle')
        assert page.locator('#b-providers').inner_text()=='Setup or sign-in required'
        assert page.locator('#setup-banner').is_visible()
        rows.append({'scheme':scheme,'tablet_toggle_and_menu':True,'opaque_graph_stat_panels':panels,'honest_provider_placeholder':True})
        page.close()
    browser.close()
Path('docs/verification/release/final-smoke.json').write_text(json.dumps(rows,indent=2)+'\n')
print('Two schemes: tablet label/menu, opaque graph stats and setup provider placeholder pass.')
