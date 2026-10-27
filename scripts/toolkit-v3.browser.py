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
contrast_rows = {}
# Every green (--build-text) text node measured against the ground it actually sits on. Translucent layers are
# composited outward to the first opaque ancestor; text that reaches the body also sits on the matrix wallpaper,
# so it is measured against a worst case of 10% green over the page (glyph layer .09 opacity plus the glow).
GREEN_CONTRAST = """() => {
  const parse = c => { let m = c.match(/^rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = c.match(/^color\\(srgb ([^)]+)\\)/); if (m) { const p = m[1].split(/[ \\/]+/).filter(Boolean).map(Number); return [p[0]*255, p[1]*255, p[2]*255, p[3] ?? 1]; } return null; };
  const over = (top, bottom) => [0, 1, 2].map(i => top[i]*top[3] + bottom[i]*(1-top[3])).concat(1);
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const green = parse(getComputedStyle(document.body).getPropertyValue('--build-text').trim().replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r,16)}, ${parseInt(g,16)}, ${parseInt(b,16)})`));
  const body = parse(getComputedStyle(document.body).backgroundColor);
  const rows = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length || el.closest('[hidden]') || !el.checkVisibility()) continue;
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el), fg = parse(cs.color);
    if (!fg || fg.slice(0, 3).some((v, i) => Math.abs(v - green[i]) > 1)) continue;
    const layers = []; let ground = null;
    for (let n = el; n && n !== document.body; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { if (c[3] >= 1) { ground = c; break; } layers.push(c); } }
    const grounds = ground ? [ground] : [body, over([...green.slice(0, 3), .10], body)];
    const measured = grounds.map(g => { let bg = g; for (const l of layers.slice().reverse()) bg = over(l, bg); return [ratio(fg, bg), hex(bg)]; }).sort((a, b) => a[0] - b[0])[0];
    rows.push({text: el.textContent.trim().slice(0, 40), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), size: cs.fontSize, fg: hex(fg), bg: measured[1], ratio: Math.round(measured[0] * 100) / 100});
  }
  return rows;
}"""

def reset():
    urllib.request.urlopen(urllib.request.Request(BRIDGE+'/fixture/reset', data=b'{}', method='POST')).read()

def state():
    return json.load(urllib.request.urlopen(BRIDGE+'/fixture/state'))

def capture(page, name):
    findings = page.evaluate(audit.PROBE)
    (OUT/(name+'-audit.json')).write_text(json.dumps(findings, indent=2))
    failures = [f for f in findings if f['severity']=='FAIL']
    assert not failures, (name, failures)
    green = page.evaluate(GREEN_CONTRAST)
    low = [g for g in green if g['ratio'] < 4.5]
    assert not low, (name, low)
    for g in green:
        contrast_rows.setdefault((g['tag'], g['text'], g['bg']), {**g, 'captures': []})['captures'].append(name)
    assert page.evaluate("document.documentElement.dataset.scheme") == 'dark', name
    assert not page.evaluate("/\\$\\d[\\d,]*\\.\\d{3}/.test(document.body.innerText)"), (name, 'money shows more than 2 decimals')
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
        # The toolkit is dark only: the OS asks for light and a stale site preference says light, the pages stay dark.
        for theme in ('dark',):
            context=browser.new_context(viewport={'width':1440,'height':1000},color_scheme='light',reduced_motion='reduce')
            context.add_init_script("try{localStorage.setItem('dh_scheme','light')}catch(_){}")
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
            assert page.locator('[data-dh-scheme]').count()==0
            page.locator('#recent-runs').get_by_text('No runs yet',exact=True).wait_for()
            # Desktop icons: one click selects without opening, double click opens, Enter opens.
            icon=page.locator('[data-desktop="account"]')
            icon.click()
            assert icon.get_attribute('data-selected')=='true' and page.locator('[data-app="account"]').count()==0
            icon.dblclick()
            page.locator('[data-app="account"]').wait_for()
            close_app(page,'Account')
            page.locator('[data-desktop="pdf"]').focus()
            page.keyboard.press('Enter')
            page.locator('[data-app="pdf"]').wait_for()
            close_app(page,'ChamPDF')
            assert page.locator('[data-desktop="admin"]').is_visible()==page.locator('[data-launch="admin"]').is_visible()
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
                assert not state()['provider_calls'] or width==1440
                quote=w.inner_text()
                assert 'Unique values' in quote and 'Blank or unusable rows (not billed)' in quote and 'Distinct' not in quote
                assert 'Jev: calibrated judge (default)' in quote and '1 batch of up to 100 rows.' in quote and 'batch(es)' not in quote
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
            assert '2 batches, run one after another, up to 100 rows each.' in w.inner_text()
            page.locator('#wb-run').click()
            w.get_by_role('button',name='Export CSV',exact=True).wait_for()
            assert len(state()['runs'])==2
            assert page.locator('#recent-runs li').count()>=1 and 'No runs yet' not in page.locator('#recent-runs').inner_text()
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
                    engine=op.get_by_label('Engine',exact=True)
                    assert engine.locator('option').all_inner_texts()==['Jev: calibrated judge (default)','DeepSeek Flash: cheaper, for simple calls']
                    engine.select_option('deepseek')
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
    table=sorted(contrast_rows.values(),key=lambda r:r['ratio'])
    (OUT/'contrast.json').write_text(json.dumps(table,indent=2))
    print(f'Green text contrast: {len(table)} distinct label/ground pairs, minimum {table[0]["ratio"]}:1 ({table[0]["text"]!r} on {table[0]["bg"]}).')
    print(f'PASS: V3 fixture browser flows; {len(reports)} audited screenshots; zero JS errors. Live Clerk and embedded sessions not tested.')

if __name__=='__main__':
    verify()
