"""Browser contract for the actual toolkit gallery, no product API fixtures."""
import json
import pathlib
import sys
from playwright.sync_api import sync_playwright

out = pathlib.Path(sys.argv[2] if len(sys.argv)>2 else '/Users/deep/.hermes/cache/scratch/toolkit-verify')
out.mkdir(parents=True, exist_ok=True)
url = sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3174/toolkit.html'
report=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width in (375,768,1280,1600):
        page=browser.new_page(viewport={'width':width,'height':900},reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(url,wait_until='networkidle')
        page.wait_for_selector('.tk-product')
        page.evaluate('document.fonts.ready')
        assert page.locator('h1').count()==1
        page.get_by_role('button',name='All products',exact=True).click()
        initial=page.locator('.tk-product').count()
        assert initial>0
        page.get_by_role('button',name='Product sites',exact=True).click()
        assert page.locator('.tk-product').count()>0
        assert all('Separate product' in t for t in page.locator('.tk-product-meta').all_text_contents())
        page.get_by_role('button',name='All products',exact=True).click()
        assert page.locator('.tk-product').count()==initial
        page.get_by_role('searchbox',name='Find a tool').fill('no-such-tool-for-test')
        assert page.locator('.tk-product').count()==0
        assert page.get_by_role('status').is_visible()
        page.get_by_role('searchbox',name='Find a tool').fill('ChampBeam')
        assert page.locator('.tk-product').count()==1
        assert page.get_by_role('link',name='Open ChampBeam',exact=False).get_attribute('href')=='https://champbeam.com'
        page.get_by_role('searchbox',name='Find a tool').fill('')
        assert page.locator('.tk-product').count()==initial
        page.locator('.tk-stack-details>summary').click()
        assert page.locator('.tk-stack-details').get_attribute('open') is not None
        page.locator('.tk-stack-details>summary').click()
        overflow=page.evaluate("""[...document.querySelectorAll('.tk-launcher *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<0)}).map(e=>e.className)""")
        assert not overflow,overflow
        page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
        if width in (375,1280):
            page.screenshot(path=str(out/f'gallery-{width}.png'))
            page.locator('.tk-feature-grid').screenshot(path=str(out/f'feature-{width}.png'))
            page.get_by_role('button',name='Product sites',exact=True).click()
            page.locator('.tk-collection').screenshot(path=str(out/f'collection-{width}.png'))
        assert not errors,errors
        report.append({'width':width,'cards':initial,'search':True,'filters':True,'disclosure':True,'overflow':overflow,'js_errors':errors})
        page.close()
    browser.close()
(out/'gallery-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
