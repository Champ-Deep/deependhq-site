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
# Every visible text node, in every colour, measured against the ground it actually sits on. Translucent layers are
# composited outward to the first opaque ancestor; text that reaches the body also sits on the matrix wallpaper,
# so it is measured against a worst case of 10% green over the page (glyph layer .09 opacity plus the glow).
# Threshold is 4.5:1, or 3:1 for large text (24px and up, or 18.66px bold).
TEXT_CONTRAST = """() => {
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
    if (!fg || fg[3] === 0) continue;
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700);
    const layers = []; let ground = null;
    for (let n = el; n && n !== document.body; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c[3] > 0) { if (c[3] >= 1) { ground = c; break; } layers.push(c); } }
    const grounds = ground ? [ground] : [body, over([...green.slice(0, 3), .10], body)];
    const measured = grounds.map(g => { let bg = g; for (const l of layers.slice().reverse()) bg = over(l, bg); return [ratio(fg, bg), hex(bg)]; }).sort((a, b) => a[0] - b[0])[0];
    rows.push({text: el.textContent.trim().slice(0, 40), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), size: cs.fontSize, fg: hex(fg), bg: measured[1], ratio: Math.round(measured[0] * 100) / 100, min: large ? 3 : 4.5});
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
    green = page.evaluate(TEXT_CONTRAST)
    assert green, (name, 'no text measured')
    low = [g for g in green if g['ratio'] < g['min']]
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

def drag(page, box, dx, dy, at=(20, 20)):
    x, y = box['x']+at[0], box['y']+at[1]
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x+dx, y+dy, steps=6); page.mouse.up()

DROP = """([selector, name, body, types]) => { const dt = new DataTransfer(); dt.items.add(new File([body], name, {type: 'text/csv'}));
  const t = document.querySelector(selector); for (const type of types) t.dispatchEvent(new DragEvent(type, {bubbles: true, cancelable: true, dataTransfer: dt})); }"""

def drag_checks(page):
    """Windows drag by the title bar inside the viewport, icons drag and persist per user, files drop onto the desktop."""
    vw, vh = page.viewport_size['width'], page.viewport_size['height']
    w = open_app(page, 'account')
    before = w.bounding_box()
    dock = page.locator('#app-launcher').bounding_box()
    assert before['y']+before['height'] <= dock['y'], ('window runs under the dock', before, dock)
    drag(page, w.locator('.window-title').bounding_box(), -150, 60)
    after = w.bounding_box()
    assert abs(after['x']-(before['x']-150)) < 2 and abs(after['y']-(before['y']+60)) < 2, ('window drag', before, after)
    drag(page, w.locator('.window-title').bounding_box(), vw, vh)
    b = w.bounding_box()
    assert b['x'] >= 0 and b['y'] >= 64 and b['x']+b['width'] <= vw+1 and b['y']+b['height'] <= vh+1, ('window clamp', b)
    drag(page, w.locator('.window-title').bounding_box(), -vw, -vh)
    b = w.bounding_box()
    assert b['x'] >= 0 and b['y'] >= 64, ('window clamp top left', b)
    pdf = open_app(page, 'pdf')
    z = lambda loc: int(loc.evaluate('n => getComputedStyle(n).zIndex'))
    assert z(pdf) > z(w)
    w.locator('.window-title').click()
    assert z(w) > z(pdf) and w.get_attribute('data-focused') == 'true', 'focus raises the window'
    close_app(page, 'ChamPDF'); close_app(page, 'Account')
    # Icons: drag does not open, the spot survives a reload under this user's key, arrows walk the icons.
    icon = page.locator('[data-desktop="pdf"]')
    start = icon.bounding_box()
    drag(page, start, 300, 120, at=(start['width']/2, start['height']/2))
    moved = icon.bounding_box()
    assert abs(moved['x']-start['x']-300) < 2 and abs(moved['y']-start['y']-120) < 2, ('icon drag', start, moved)
    assert page.locator('[data-app="pdf"]').count() == 0
    saved = page.evaluate("localStorage.getItem('dh_toolkit_icons:user_FIXTURE0001')")
    assert saved and json.loads(saved)['pdf'] == [300, 120], saved
    page.reload()
    page.wait_for_function("document.querySelector('#daily').textContent.includes('$')")
    again = page.locator('[data-desktop="pdf"]').bounding_box()
    assert abs(again['x']-moved['x']) < 2 and abs(again['y']-moved['y']) < 2, ('icon persisted', moved, again)
    page.screenshot(path=str(OUT/'drag-icon-moved-1440.png'))
    # A spot saved on a big monitor is clamped into a smaller viewport, on load and on resize.
    page.evaluate("localStorage.setItem('dh_toolkit_icons:user_FIXTURE0001', JSON.stringify({pdf:[1200,700]}))")
    for size, reload in (((900, 700), True), ((800, 600), False)):
        page.set_viewport_size({'width': size[0], 'height': size[1]})
        if reload:
            page.reload()
            page.wait_for_function("document.querySelector('#daily').textContent.includes('$')")
        page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")  # let the resize event land
        b = page.locator('[data-desktop="pdf"]').bounding_box()
        assert b['x'] >= 0 and b['y'] >= 64 and b['x']+b['width'] <= size[0]+1 and b['y']+b['height'] <= size[1]+1, ('icon clamp', size, b)
    assert json.loads(page.evaluate("localStorage.getItem('dh_toolkit_icons:user_FIXTURE0001')"))['pdf'] == [1200, 700], 'clamping keeps the saved spot'
    page.set_viewport_size({'width': vw, 'height': vh})
    page.evaluate("localStorage.removeItem('dh_toolkit_icons:user_FIXTURE0001')")
    page.reload()
    page.wait_for_function("document.querySelector('#daily').textContent.includes('$')")
    page.locator('[data-desktop="account"]').focus()
    page.keyboard.press('ArrowDown')
    assert page.evaluate("document.activeElement.dataset.desktop") == 'scanner'
    # Desktop drop: the desktop lights up during the drag, a CSV opens Data Workbench with its rows.
    page.evaluate(DROP, ['.desktop-intro h1', 'dropped.csv', 'Name,Email\nAda,ada@example.com\nBo,bo@example.com\n', ['dragenter', 'dragover']])
    assert page.locator('main#main').get_attribute('data-drop') == 'true'
    page.evaluate(DROP, ['.desktop-intro h1', 'dropped.csv', 'Name,Email\nAda,ada@example.com\nBo,bo@example.com\n', ['drop']])
    assert page.locator('main#main').get_attribute('data-drop') is None
    wb = page.locator('[data-app="workbench"]')
    wb.get_by_text('2 rows read locally', exact=False).wait_for()
    assert wb.locator('.table-scroll tbody tr').count() == 2 and 'ada@example.com' in wb.inner_text()
    page.evaluate(DROP, ['[data-app="workbench"] .dropzone', 'x.csv', 'a', ['dragover']])
    zone = wb.locator('.dropzone')
    assert zone.get_attribute('data-over') == 'true' and zone.evaluate("n => getComputedStyle(n).borderTopStyle") == 'solid'
    zone.screenshot(path=str(OUT/'drop-hover-workbench.png'))
    page.evaluate(DROP, ['[data-app="workbench"] .dropzone', 'x.csv', 'a', ['dragleave']])
    assert zone.get_attribute('data-over') == 'false'
    # A text drop is left alone (so fields still accept it): the desktop drop handler only cancels file drops.
    assert page.evaluate("""() => { const dt = new DataTransfer(); dt.setData('text/plain', 'hello');
      const e = new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt});
      document.querySelector('[data-app="workbench"] .window-body').dispatchEvent(e); return e.defaultPrevented; }""") is False, 'text drop cancelled'
    close_app(page, 'Data Workbench')
    sc = open_app(page, 'scanner')
    fb = sc.locator('input[type=file]').evaluate("n => { const s = getComputedStyle(n, '::file-selector-button'); return [s.backgroundColor, s.color, s.borderTopColor, s.borderTopLeftRadius]; }")
    assert fb == ['rgb(0, 0, 0)', 'rgb(0, 255, 65)', 'rgb(0, 143, 17)', '0px'], ('file button off palette', fb)
    page.evaluate(DROP, ['[data-app="scanner"] .dropzone', 'notes.txt', 'confidential', ['dragover']])
    assert sc.locator('.dropzone').get_attribute('data-over') == 'true'
    page.evaluate(DROP, ['[data-app="scanner"] .dropzone', 'notes.txt', 'confidential', ['drop']])
    sc.get_by_role('heading', name='notes.txt').wait_for()
    assert page.locator('[data-app="workbench"]').count() == 0, 'a scanner drop stays in the scanner'
    close_app(page, 'Deep Scanner')

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
            drag_checks(page)
            for width in (375,390,768,1280,1440,1600):
                page.set_viewport_size({'width':width,'height':1000})
                capture(page,f'desktop-{theme}-{width}')
            for width in (390,1440):
                page.set_viewport_size({'width':width,'height':1000})
                page.get_by_role('button',name='Sign out',exact=True).click()
                page.get_by_role('link',name='Sign in',exact=True).click()
                page.wait_for_selector('[data-fixture="signin"]')
                look=json.loads(page.locator('#toolkit-signin-root').get_attribute('data-appearance'))
                assert {k:look.get(k) for k in ('colorPrimary','colorPrimaryForeground','colorBackground','colorText','colorInputBackground','colorInputText','borderRadius')}=={'colorPrimary':'#00FF41','colorPrimaryForeground':'#000000','colorBackground':'#050505','colorText':'#00FF41','colorInputBackground':'#000000','colorInputText':'#00FF41','borderRadius':'0px'},look
                assert 'JetBrains Mono' in look.get('fontFamily',''),look
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
                if width<=768:
                    fixed=w.bounding_box()
                    drag(page,w.locator('.window-title').bounding_box(),120,80)
                    assert w.bounding_box()==fixed and fixed['x']==0 and fixed['y']==0,('phone windows do not drag',fixed)
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
    pairs={}
    for r in table:
        k=(r['fg'],r['bg'])
        if k not in pairs or r['ratio']<pairs[k]['ratio']:pairs[k]=r
    print(f'Text contrast: {len(table)} distinct text/ground nodes, {len(pairs)} colour pairs, every one at or above its threshold.')
    for (fg,bg),r in sorted(pairs.items(),key=lambda kv:kv[1]['ratio']):
        print(f'  {fg} on {bg}: {r["ratio"]}:1 (min {r["min"]}, e.g. {r["tag"]} {r["text"][:24]!r} at {r["size"]})')
    print(f'PASS: V3 fixture browser flows; {len(reports)} audited screenshots; zero JS errors. Live Clerk and embedded sessions not tested.')

if __name__=='__main__':
    verify()
