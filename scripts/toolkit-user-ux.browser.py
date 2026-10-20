"""Task-first launcher acceptance: run against a local built site, no paid APIs."""
import json
import pathlib
import sys
from playwright.sync_api import sync_playwright

base=sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:3174'
out=pathlib.Path('/Users/deep/.hermes/cache/scratch/toolkit-user-ux')
out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
    browser=p.chromium.launch()
    for width in (375,768,1280,1600):
        page=browser.new_page(viewport={'width':width,'height':1000},reduced_motion='reduce')
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base+'/index.html',wait_until='networkidle')
        section=page.locator('#stack')
        assert section.get_by_role('heading',name='Tools for the work in front of you.').is_visible()
        assert section.get_by_role('link',name='Open Lead Scorer',exact=True).get_attribute('href')=='/lead-scorer'
        assert section.get_by_role('link',name='Explore Harbinger',exact=True).get_attribute('href')=='https://champharbinger.vercel.app'
        assert section.locator('.tk-home-feature').count()==2
        section.locator('summary').click()
        assert section.get_by_text('Internal Python scanner. Public release not verified.',exact=True).is_visible()
        assert section.get_by_text('Not a lead finder or a lead-scoring tool.',exact=True).is_visible()
        section.locator('summary').click()
        overflow=section.evaluate("""root=>[...root.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<0)}).map(e=>e.className)""")
        assert not overflow,overflow
        if width in (375,1280):
            page.add_style_tag(content='nav{visibility:hidden!important}')  # Exclude fixed chrome from section-only captures.
            section.locator('.tk-home-features').screenshot(path=str(out/f'home-tools-{width}.png'))
            section.locator('.tk-home-secondary').screenshot(path=str(out/f'home-secondary-{width}.png'))
        page.goto(base+'/toolkit.html',wait_until='networkidle')
        assert page.locator('.tk-products').get_by_role('heading',name='ChampHarbinger',exact=True).is_visible()
        assert page.locator('.tk-products').get_by_role('heading',name='Deep Scanner',exact=True).count()==0
        page.get_by_role('searchbox',name='Find a tool').fill('hiring')
        assert page.locator('.tk-product').count()==1
        assert page.get_by_role('link',name='Open ChampHarbinger',exact=False).get_attribute('href')=='https://champharbinger.vercel.app'
        page.get_by_role('searchbox',name='Find a tool').fill('')
        if width in (375,1280):
            page.locator('.tk-collection').screenshot(path=str(out/f'catalog-{width}.png'))
        assert not errors,errors
        reports.append({'width':width,'home_tasks':True,'harbinger':True,'scanner_explained':True,'search_by_job':True,'overflow':overflow,'js_errors':errors})
        page.close()
    browser.close()
(out/'report.json').write_text(json.dumps(reports,indent=2))
print(json.dumps(reports,indent=2))
