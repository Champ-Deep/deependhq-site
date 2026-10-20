"""Actual UI -> actual Clerk verification/API -> actual SQLite -> fixture providers.
Requires fixture_server.py:3175, toolkit-browser-server.mjs:3176, Wrangler:3177.
"""
import json,pathlib,urllib.request,importlib.util
from playwright.sync_api import sync_playwright
_spec=importlib.util.spec_from_file_location('visual_audit',str(pathlib.Path.home()/'champ-skills/design/skills/visual-verify/scripts/audit.py'))
assert _spec is not None and _spec.loader is not None
_audit=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_audit)
BASE='http://127.0.0.1:3175'
BRIDGE='http://127.0.0.1:3176'
OUT=pathlib.Path.home()/'.hermes/cache/scratch/toolkit-integrated'
OUT.mkdir(parents=True,exist_ok=True)
def get(path):
    return json.load(urllib.request.urlopen(BRIDGE+path))
def capture(page,selector,name):
    findings=page.evaluate(_audit.PROBE)
    (OUT/(name+'-audit.json')).write_text(json.dumps(findings,indent=2))
    assert not [f for f in findings if f['severity']=='FAIL'], (name,findings)
    page.locator(selector).screenshot(path=str(OUT/(name+'.png')))
with sync_playwright() as p:
    browser=p.chromium.launch()
    page=browser.new_page(viewport={'width':1280,'height':1000},reduced_motion='reduce')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
    urllib.request.urlopen(urllib.request.Request(BRIDGE+'/fixture/reset',data=b'{}',method='POST')).read()
    token=get('/fixture/token')['token']
    def clerk(route):
        response=route.fetch()
        route.fulfill(response=response,body=response.text().replace('FIXTURE_SESSION_TOKEN',token))
    def api(route):
        response=page.request.post(BRIDGE+'/api/toolkit',headers=route.request.headers,data=route.request.post_data)
        route.fulfill(status=response.status,headers={'content-type':'application/json'},body=response.body())
    page.route('**/fixture/clerk.js',clerk)
    page.route('**/api/toolkit',api)
    page.goto(BASE+'/lead-scorer',wait_until='networkidle')
    page.wait_for_function("document.querySelector('#wallet-credits').textContent==='1,000'")
    for width in (375,768,1280,1600):
        page.set_viewport_size({'width':width,'height':1000})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        if width in (375,1280): capture(page,'#stage-drop',f'upload-{width}')
    page.set_viewport_size({'width':1280,'height':1000})
    page.set_input_files('#file',{'name':'integration-fixture.csv','mimeType':'text/csv','buffer':b'Name,Email,Title\nCasey Example,casey@example.com,Director\n'})
    page.fill('#sell','Fixture analytics product')
    page.fill('#want','Directors in technology companies')
    page.click('#rubric-add')
    page.fill('#r-label-0','Priority')
    page.fill('#r-instr-0','Categorize using the uploaded title')
    page.select_option('#r-type-0','category')
    for label in ('Low','High'):
        page.fill('#r-crit-0',label);page.press('#r-crit-0','Enter')
    page.click('#quote-btn');page.wait_for_function("!document.querySelector('#run-btn').disabled")
    capture(page,'#approve','approval-1280')
    page.click('#run-btn');page.wait_for_function("document.querySelector('#results-table thead').textContent.includes('Priority')")
    assert 'Priority' in page.locator('#results-table thead').text_content()
    assert 'High' in page.locator('#results-table tbody').text_content()
    run=get('/fixture/state')['runs'][-1]
    assert run['status']=='completed'
    assert run['spent_micro']==1000+3000+500
    for width in (375,1280):
        page.set_viewport_size({'width':width,'height':1000})
        assert page.locator('.w-name').first.evaluate('(e)=>e.scrollWidth<=e.clientWidth'), 'Fixture name must not be truncated in the progress list'
        capture(page,'#console',f'ledger-{width}')
        capture(page,'#results',f'results-{width}')
    urllib.request.urlopen(BRIDGE+'/fixture/timeout').read()
    page.click('#quote-btn');page.wait_for_function("!document.querySelector('#run-btn').disabled")
    page.click('#run-btn');page.wait_for_function("parseFloat(document.querySelector('#t-held').textContent.replace('$',''))===0.01")
    state=get('/fixture/state')
    assert state['runs'][-1]['status']=='held'
    assert state['runs'][-1]['held_micro']==10000
    assert 'Unjudged' in page.locator('#results-table tbody').text_content()
    assert 'Not reconciled' in page.locator('#ledger-body').text_content()
    capture(page,'#console','held-ledger-1280')
    page.goto(BASE+'/account',wait_until='networkidle')
    page.wait_for_selector('#admin:not(.hide)')
    assert page.evaluate("""() => {
      const n=document.querySelector('#admin-status');n.textContent='Fixture success';n.classList.remove('hide','bad');
      return getComputedStyle(n).color===getComputedStyle(document.querySelector('main')).color;
    }""")
    for width in (375,1280):
        page.set_viewport_size({'width':width,'height':1000})
        capture(page,'section[aria-labelledby="balance-h"]',f'account-balance-{width}')
    page.set_viewport_size({'width':1280,'height':1000})
    page.unroute('**/api/toolkit');page.unroute('**/fixture/clerk.js')
    for path in ('/lead-scorer','/account','/toolkit'):
        response=page.goto('http://127.0.0.1:3177'+path,wait_until='networkidle')
        assert response.status==200
        assert 'content-security-policy' in response.headers
        assert response.headers.get('cache-control')=='no-store'
    assert not errors,errors
    browser.close()
print('PASS: browser, real JWT/API/SQLite/provider module, quote, custom output, cost settlement, held partial result, admin, served Worker CSP. Fixtures only, no paid calls.')
