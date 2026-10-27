"""V3 UI against the real toolkit handler, SQLite and fixture-only providers."""
import importlib.util
import json
import os
import pathlib
import urllib.request
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(os.environ.get('TOOLKIT_EVIDENCE', ROOT / 'scratch/toolkit-v3'))
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:3175'
BRIDGE = 'http://127.0.0.1:3176'
spec = importlib.util.spec_from_file_location('audit', pathlib.Path.home() / 'champ-skills/design/skills/visual-verify/scripts/audit.py')
assert spec is not None and spec.loader is not None
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
reports = []

def reset():
    urllib.request.urlopen(urllib.request.Request(BRIDGE+'/fixture/reset', data=b'{}', method='POST')).read()

def state():
    return json.load(urllib.request.urlopen(BRIDGE+'/fixture/state'))

def capture(page, name):
    findings = page.evaluate(audit.PROBE)
    (OUT/(name+'-audit.json')).write_text(json.dumps(findings, indent=2))
    failures = [f for f in findings if f['severity']=='FAIL']
    assert not failures, (name, failures)
    assert page.evaluate("!/[\u2013\u2014]/.test(document.body.innerText)")
    overflow = page.evaluate("""() => [...document.querySelectorAll('body *')].filter(e=>{
      if(e.closest('.table-scroll')||e.closest('[hidden]')||!e.getClientRects().length)return false;
      const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);
    }).map(e=>e.tagName+'.'+e.className)""")
    assert not overflow, (name, overflow)
    page.screenshot(path=str(OUT/(name+'.png')), full_page=True)
    reports.append({'capture':name,'failures':0,'warnings':[f for f in findings if f['severity']=='WARN']})

def open_app(page, app):
    page.locator('[data-launch="'+app+'"]').click()
    return page.locator('[data-app="'+app+'"]')

def close_app(page, name):
    page.get_by_role('button', name='Close '+name, exact=True).click()

def configure(page, rows=1, operation='classify'):
    w = open_app(page, 'workbench')
    page.set_input_files('#wb-file', {'name':'fixture.csv','mimeType':'text/csv','buffer':('Name,Email,Company\n'+''.join('Casey Example,casey@example.com,Example\n' for _ in range(rows))).encode()})
    page.get_by_role('button',name='Confirm mapping',exact=True).click()
    op=w.locator('.operation').first
    op.get_by_label('Source column',exact=True).select_option('Email' if operation in ('enrich','verify_email') else 'Company')
    op.get_by_label('Operation',exact=True).select_option(operation)
    if operation=='classify':
        op.get_by_label('Instructions for this column').fill('Classify the company industry from the supplied name.')
        op.get_by_label('Categories, separated by commas').fill('Technology, Other')
    return w

def verify():
    reset()
    token=json.load(urllib.request.urlopen(BRIDGE+'/fixture/token'))['token']
    with sync_playwright() as p:
        browser=p.chromium.launch()
        for theme in ('dark','light'):
            context=browser.new_context(viewport={'width':1440,'height':1000},color_scheme=theme,reduced_motion='reduce')
            page=context.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m: errors.append(m.text) if m.type=='error' and not m.text.startswith('Failed to load resource:') else None)
            def clerk(route):
                response=route.fetch()
                route.fulfill(response=response,body=response.text().replace('FIXTURE_SESSION_TOKEN',token))
            def api(route):
                response=page.request.post(BRIDGE+'/api/toolkit',headers=route.request.headers,data=route.request.post_data)
                route.fulfill(status=response.status,headers={'content-type':'application/json'},body=response.body())
            page.route('**/fixture/clerk.js',clerk)
            page.route('**/api/toolkit',api)
            page.route(BASE+'/',lambda r:r.fulfill(path=str(ROOT/'toolkit-app.html'),content_type='text/html'))
            page.route(BASE+'/sign-in',lambda r:r.fulfill(path=str(ROOT/'toolkit-signin.html'),content_type='text/html'))
            for host in ('https://www.champbeam.com/**','https://champdf.com/**'):
                page.route(host,lambda r:r.fulfill(content_type='text/html',body='<p>External app fixture. Live session not tested.</p>'))
            page.goto(BASE+'/')
            page.wait_for_function("document.querySelector('#daily').textContent.includes('$')")
            for width in (375,390,768,1280,1440,1600):
                page.set_viewport_size({'width':width,'height':1000})
                capture(page,f'desktop-{theme}-{width}')
            for width in (390,1440):
                page.set_viewport_size({'width':width,'height':1000})
                page.get_by_role('button',name='Sign out',exact=True).click()
                page.get_by_role('link',name='Sign in',exact=True).click()
                page.wait_for_selector('[data-fixture="signin"]')
                capture(page,f'signin-{theme}-{width}')
                page.get_by_role('button',name='Continue with Google (fixture)').click()
                page.wait_for_selector('[data-launch="admin"]:visible')
                for app,name in [('beam','ChampBeam'),('pdf','ChamPDF'),('account','Account'),('scanner','Deep Scanner'),('admin','Admin')]:
                    w=open_app(page,app)
                    if app=='admin':w.get_by_role('button',name='Save default allowances').wait_for()
                    if app=='account':w.get_by_role('heading',name='Run history').wait_for()
                    if app=='scanner':
                        before=state()['provider_calls']
                        w.locator('input[type=file]').set_input_files({'name':'example.txt','mimeType':'text/plain','buffer':b'confidential\noperator@example.com'})
                        w.get_by_role('cell',name='Sensitive language').wait_for()
                        assert before==state()['provider_calls']
                        assert 'operator@example.com' not in w.inner_text()
                    if app in ('beam','pdf'):
                        assert w.locator('iframe').get_attribute('src')==('https://www.champbeam.com' if app=='beam' else 'https://champdf.com')
                        assert w.get_by_role('link',name='Open in new tab').get_attribute('target')=='_blank'
                    capture(page,f'{app}-{theme}-{width}')
                    page.get_by_role('button',name='Minimize '+name,exact=True).click()
                    assert w.is_hidden()
                    open_app(page,app)
                    assert w.is_visible()
                    close_app(page,name)
                w=configure(page)
                capture(page,f'operations-{theme}-{width}')
                page.get_by_role('button',name='Get dollar quote',exact=True).click()
                page.wait_for_selector('#wb-run:not([disabled])')
                assert not state()['provider_calls'] or theme=='light' or width==1440
                page.locator('#wb-run').scroll_into_view_if_needed()
                capture(page,f'quote-{theme}-{width}')
                page.locator('#wb-run').click()
                w.get_by_role('button',name='Export CSV',exact=True).wait_for()
                assert 'Technology' in w.inner_text()
                assert '0.95' in w.inner_text()
                with page.expect_download() as download:
                    w.get_by_role('button',name='Export CSV',exact=True).click()
                export=download.value.path().read_text() if isinstance(download.value.path(),pathlib.Path) else pathlib.Path(download.value.path()).read_text()
                assert 'Technology' in export and 'confidence' in export and 'Casey Example' in export
                capture(page,f'results-{theme}-{width}')
                close_app(page,'Data Workbench')
            # Admin grant exercises verified-email lookup and SQLite, not a fabricated success response.
            w=open_app(page,'admin')
            w.get_by_label('Grant to verified email',exact=True).fill('fixture.operator@example.com')
            w.get_by_label('Amount in dollars',exact=True).fill('0.1')
            w.get_by_label('Reason',exact=True).fill('Fixture UI verification')
            w.get_by_role('button',name='Grant credits',exact=True).click()
            w.get_by_text('Grant recorded.',exact=False).wait_for()
            capture(page,f'admin-granted-{theme}')
            close_app(page,'Admin')
            # Sequential chunks preserve every row and ask for one total approval.
            reset()
            w=configure(page,101)
            page.get_by_role('button',name='Get dollar quote',exact=True).click()
            page.wait_for_selector('#wb-run:not([disabled])')
            page.locator('#wb-run').click()
            w.get_by_role('button',name='Export CSV',exact=True).wait_for()
            assert len(state()['runs'])==2
            assert sum(r['row_count'] for r in state()['runs'])==101
            close_app(page,'Data Workbench')
            # All provider operation types, then cap and held failure paths.
            reset()
            w=configure(page,operation='enrich')
            for operation in ('verify_email','verify'):
                w.get_by_role('button',name='Add column operation').click()
                op=w.locator('.operation').last
                op.get_by_label('Source column',exact=True).select_option('Email')
                op.get_by_label('Operation',exact=True).select_option(operation)
                if operation=='verify':
                    op.get_by_label('Engine',exact=True).select_option('deepseek')
                    op.get_by_label('Yes/no question',exact=True).fill('Is this an email address?')
            page.get_by_role('button',name='Get dollar quote',exact=True).click()
            page.wait_for_selector('#wb-run:not([disabled])')
            page.locator('#wb-run').click()
            w.get_by_role('button',name='Export CSV',exact=True).wait_for()
            assert state()['runs'][-1]['status']=='completed',state()['runs'][-1]
            assert 'deliverable' in w.inner_text() and 'found' in w.inner_text() and 'pass' in w.inner_text()
            close_app(page,'Data Workbench')
            urllib.request.urlopen(BRIDGE+'/fixture/cap').read()
            w=configure(page)
            page.get_by_role('button',name='Get dollar quote',exact=True).click()
            page.wait_for_selector('#wb-run[disabled]')
            assert 'Daily spending allowance reached' in w.inner_text()
            capture(page,f'cap-{theme}')
            close_app(page,'Data Workbench')
            reset()
            urllib.request.urlopen(BRIDGE+'/fixture/timeout').read()
            w=configure(page,operation='verify_email')
            page.get_by_role('button',name='Get dollar quote',exact=True).click()
            page.wait_for_selector('#wb-run:not([disabled])')
            page.locator('#wb-run').click()
            w.get_by_role('button',name='Export CSV',exact=True).wait_for()
            assert state()['runs'][-1]['status']=='held'
            assert 'Held costs are not free' in w.inner_text()
            capture(page,f'held-{theme}')
            close_app(page,'Data Workbench')
            reset()
            # File error states are local and never call a provider.
            w=open_app(page,'workbench')
            for name,body,message in [('empty.csv',b'Email\n','no data rows'),('bad.exe',b'bad','Choose a CSV or XLSX')]:
                page.set_input_files('#wb-file',{'name':name,'mimeType':'text/plain','buffer':body})
                w.get_by_text(message,exact=False).wait_for()
                capture(page,f'{name}-{theme}')
            assert not state()['provider_calls']
            close_app(page,'Data Workbench')
            # Set-up needed is the real no-key deployment surface.
            page.request.post(BASE+'/fixture/config',data={'configured':0})
            page.goto(BASE+'/sign-in')
            page.get_by_text('Setup needed.',exact=False).wait_for()
            for width in (390,1440):
                page.set_viewport_size({'width':width,'height':1000})
                capture(page,f'setup-{theme}-{width}')
            page.request.post(BASE+'/fixture/config',data={'configured':1})
            assert not errors,errors
            context.close()
        browser.close()
    (OUT/'report.json').write_text(json.dumps(reports,indent=2))
    print(f'PASS: V3 fixture browser flows; {len(reports)} audited screenshots; zero JS errors. Live Clerk and embedded sessions not tested.')

if __name__=='__main__':
    verify()
