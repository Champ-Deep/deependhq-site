"""Sonar UI acceptance. Local fixture replies are explicit, no paid providers.
Run fixture_server.py on 3175 and toolkit-browser-server.mjs on 3176 first.
"""
import importlib.util
import json
import pathlib
import re
import subprocess
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'scratch/sonar'
OUT.mkdir(parents=True, exist_ok=True)
BASE = 'http://127.0.0.1:3175'
BRIDGE = 'http://127.0.0.1:3176'
spec = importlib.util.spec_from_file_location('v4', ROOT / 'scripts/toolkit-v4.browser.py')
assert spec is not None and spec.loader is not None
v4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v4)
reports, checks, console_errors = [], [], []


def track(page):
    page.on('pageerror', lambda e: console_errors.append(str(e)))
    page.on('console', lambda m: console_errors.append(m.text) if m.type == 'error' and not (m.location.get('url', '').endswith('/api/toolkit') and re.search(r'\b(429|503)\b', m.text)) else None)
    page.on('response', lambda r: console_errors.append(f'{r.status} {r.url}') if r.status >= 400 and not (r.url.endswith('/api/toolkit') and r.status in (429, 503)) else None)


def check(ok, name):
    assert ok, name
    checks.append(name)


def post(path, data):
    return json.load(urllib.request.urlopen(urllib.request.Request(BASE + path, data=json.dumps(data).encode(), headers={'Content-Type': 'application/json'})))


def capture(page, name, scroll=None):
    if scroll:
        page.locator(scroll).evaluate("e=>e.scrollIntoView({block:'start',behavior:'instant'})")
    page.wait_for_timeout(100)
    findings = page.evaluate(v4.audit.PROBE)
    sonar_failures = [f for f in findings if f['severity'] == 'FAIL' and 'sonar' in f.get('where', '').lower()]
    check(not sonar_failures, (name, 'Sonar audit', sonar_failures))
    sonar_pairs = page.evaluate(v4.TEXT_CONTRAST.replace("querySelectorAll('body *')", "querySelectorAll('.sonar *')"))
    bad_pairs = [r for r in sonar_pairs if r['ratio'] < 4.5]
    check(not bad_pairs, (name, 'contrast', bad_pairs))
    overflow = page.evaluate("""() => [...document.querySelectorAll('.sonar *')].filter(e => {
      if (!e.checkVisibility() || e.closest('.sonar-table-scroll')) return false;
      const r=e.getBoundingClientRect();return r.right>innerWidth+1 || r.left< -1;
    }).map(e=>e.className)""")
    check(not overflow, (name, 'geometry overflow', overflow))
    check(page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (name, 'page overflow'))
    targets = page.evaluate("""() => [...document.querySelectorAll('.sonar button,.sonar input,.sonar select')].filter(e=>e.checkVisibility()).map(e=>({label:e.textContent||e.id,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))""")
    check(all(t['w'] >= 44 and t['h'] >= 44 for t in targets), (name, 'targets', targets))
    check(not page.evaluate("/[\\u2013\\u2014]/.test(document.querySelector('.sonar').innerText)"), (name, 'dash-free'))
    check(page.evaluate('''() => {const host=document.querySelector('.sonar-host').getBoundingClientRect(),content=document.querySelector('.sonar-content').getBoundingClientRect(),guide=document.querySelector('.tg-launcher').getBoundingClientRect();return host.top>=content.bottom-1 && (host.right<=guide.left || host.bottom<=guide.top || host.left>=guide.right)}'''), (name, 'host clear zone and mare separation'))
    spacing = page.evaluate('''() => [...document.querySelectorAll('.sonar-rank')].map(e=>{const [label,track,value]=[...e.children].map(n=>n.getBoundingClientRect());return {gap:track.top>=label.bottom-1?track.top-label.bottom:track.left-label.right,valueGap:value.top<track.bottom&&value.bottom>track.top?value.left-track.right:null,valueRight:value.right}})''')
    check(all(r['gap'] >= 3 and (r['valueGap'] is None or r['valueGap'] >= 12) for r in spacing), (name, 'rank gaps', spacing))
    if spacing:
        check(max(r['valueRight'] for r in spacing)-min(r['valueRight'] for r in spacing)<1, (name, 'values aligned'))
    check(page.evaluate('''() => {const drop=document.querySelector('.sonar-drop').getBoundingClientRect(),input=document.querySelector('#sonar-file').getBoundingClientRect();return input.left>=drop.left+4&&input.right<=drop.right-4}'''), (name, 'file input inside drop boundary'))
    page.screenshot(path=str(OUT / (name + '.png')), full_page=False)
    reports.append({'name': name, 'audit': findings, 'sonar_contrast': sonar_pairs, 'targets': targets, 'rank_spacing': spacing})


def ask(page, question, view=None):
    page.locator('#sonar-question').fill(question)
    page.locator('#sonar-question').press('Enter')
    expect(page.locator('.sonar-message')).not_to_have_text('Asking Sonar...')
    if view:
        expect(page.locator('.sonar-view')).to_have_attribute('data-view', view)
    expect(page.get_by_role('button', name='Ping', exact=True)).to_be_enabled()


def expected(page, plan):
    return page.evaluate("""async plan => {
      const {parseCsv}=await import('/toolkit-lib.js');
      const {runPlan,fmt}=await import('/sonar-core.js');
      const table=parseCsv(await (await fetch('/toolkit-sample-leads.csv')).text());
      const result=runPlan(table.rows,plan);return {...result,top:fmt(result.groups[0]?.value)};
    }""", plan)


def fixture_reply(page, reply=None, status=200):
    page.unroute('**/api/toolkit')
    def route(r):
        body = r.request.post_data_json
        if body.get('action') == 'sonar':
            r.fulfill(status=status, json=reply)
        else:
            r.continue_()
    page.route('**/api/toolkit', route)


def run():
    post('/fixture/reset', {})
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width in (375, 768, 1280, 1440, 1600):
            context = browser.new_context(viewport={'width': width, 'height': 1000}, reduced_motion='reduce', accept_downloads=True)
            page = context.new_page()
            track(page)
            page.goto(BASE + '/toolkit-app.html')
            expect(page.locator('#session-status')).to_have_attribute('data-state', 'ok')
            page.locator('[data-launch="sonar"]').click()
            if width in (375, 1280):
                capture(page, f'empty-{width}')
            page.set_input_files('#sonar-file', str(ROOT / 'toolkit-sample-leads.csv'))
            expect(page.locator('.sonar-file-head')).to_contain_text('200 rows x 9 columns')
            expected_rank = expected(page, {'view': 'rank', 'group_by': 'Full Name', 'measure': {'fn': 'count'}})
            if width in (375, 1280):
                post('/fixture/delay', {'ms': 1800})
                page.locator('#sonar-question').fill('Rank the names')
                page.get_by_role('button', name='Ping', exact=True).click()
                expect(page.locator('.sonar-terminal')).to_have_attribute('data-live', 'true')
                capture(page, f'thinking-{width}', '.sonar-terminal')
                expect(page.locator('.sonar-view')).to_have_attribute('data-view', 'rank')
                post('/fixture/delay', {'ms': 0})
            else:
                ask(page, 'Rank the names', 'rank')
            check(page.locator('.sonar-rank').count() == len(expected_rank['groups']), f'{width} rank count matches runPlan')
            check(re.findall(r'\d[\d,]*', page.locator('.sonar-bubble').inner_text()) == [expected_rank['top'], str(expected_rank['matched'])], f'{width} headline numbers from runPlan')
            capture(page, f'rank-{width}', '.sonar-answer')
            if width == 375:
                page.set_viewport_size({'width': 375, 'height': 812})
                capture(page, 'rank-phone-375x812', '.sonar-answer')
                page.set_viewport_size({'width': 375, 'height': 1000})
            page.evaluate("document.documentElement.dataset.scheme='light'")
            capture(page, f'light-rank-{width}', '.sonar-answer')
            page.evaluate("document.documentElement.dataset.scheme='dark'")
            ask(page, 'List the matching rows', 'list')
            expected_list = expected(page, {'view': 'list', 'limit': 20})
            check(page.locator('.sonar-table-scroll tbody tr').count() == len(expected_list['rows']), f'{width} list count matches runPlan')
            if width in (375, 1280):
                capture(page, f'list-{width}', '.sonar-answer')
                with page.expect_download() as download:
                    page.get_by_role('button', name=re.compile('Download CSV: first')).click()
                content = pathlib.Path(download.value.path()).read_text()
                check('Full Name' in content and len(content.splitlines()) == 21, f'{width} honest 20-row CSV export')
            calls = json.load(urllib.request.urlopen(BASE + '/fixture/calls'))['calls']
            sonar_calls = [c for c in calls if c.get('action') == 'sonar']
            # The fixture stores request records; inspect through its documented calls shape below.
            if sonar_calls:
                check(all(c['rows'] == 0 for c in sonar_calls), 'fixture saw no top-level rows in Sonar calls')
            if width == 375:
                edge_cases(page)
            context.close()
        # Live animations, not just reduced-motion end states.
        context = browser.new_context(viewport={'width': 1280, 'height': 1000}, reduced_motion='no-preference')
        page = context.new_page()
        track(page)
        page.goto(BASE + '/toolkit-app.html')
        expect(page.locator('#session-status')).to_have_attribute('data-state', 'ok')
        page.locator('[data-launch="sonar"]').click()
        page.set_input_files('#sonar-file', str(ROOT / 'toolkit-sample-leads.csv'))
        ask(page, 'Rank names', 'rank')
        page.wait_for_timeout(1800)
        check(page.locator('.sonar-bubble').inner_text().endswith('200 rows'), 'animated host headline settles')
        check(page.locator('.sonar-rank .sonar-bar').first.evaluate("e=>getComputedStyle(e).transform") in ('none', 'matrix(1, 0, 0, 1, 0, 0)'), 'animated bars reach final width')
        capture(page, 'rank-live-1280', '.sonar-answer')
        context.close()
        bridge_checks(browser)
        baseline_shell(browser)
        browser.close()
    check(not console_errors, ('console errors', console_errors))
    (OUT / 'browser-results.json').write_text(json.dumps({'checks': checks, 'captures': reports, 'console_errors': console_errors}, indent=2))
    print(f'PASS: {len(checks)} assertions, {len(reports)} captures, zero page errors')


def edge_cases(page):
    for view in ('number', 'share', 'trend', 'compare'):
        plan = {'view': view, 'measure': {'fn': 'count'}}
        if view != 'number':
            plan['group_by'] = 'Country'
        fixture_reply(page, {'plan': plan, 'headline': '{value} rows', 'question': None, 'follow_ups': ['List matching rows'], 'cost_micro': 300})
        ask(page, 'Test ' + view, view)
        if view == 'number':
            expect(page.locator('.sonar-number')).to_have_text('200', timeout=100)
            check(True, 'reduced motion final number immediately')
        if view == 'trend':
            page.locator('.sonar-trend-point').first.focus()
            expect(page.locator('.sonar-tooltip')).to_contain_text('rows')
            check(True, 'trend keyboard tooltip')
            page.locator('#sonar-trend-choice').select_option('1')
            expect(page.locator('.sonar-tooltip')).to_contain_text('rows')
            check(True, 'trend full-size touch picker')
        if view == 'compare':
            check(2 <= page.locator('.sonar-stat').count() <= 4, 'compare bounded at four tiles')
        capture(page, view + '-375', '.sonar-answer')
    for plan in (None, {'view': 'rank', 'group_by': 'Unknown', 'measure': {'fn': 'count'}}, {'view': 'constructor', 'measure': {'fn': 'count'}}):
        fixture_reply(page, {'plan': plan, 'headline': '999 invented', 'question': 'Which column should I use?', 'follow_ups': [], 'cost_micro': 300})
        ask(page, 'Clarify')
        expect(page.locator('.sonar-bubble')).to_have_text('Which column should I use?')
        check(page.locator('.sonar-view').inner_text() == '', 'invalid or null plan never executes')
    fixture_reply(page, {'plan': {'view': 'number', 'measure': {'fn': 'count'}}, 'headline': '999 invented', 'follow_ups': [], 'cost_micro': 300})
    ask(page, 'Count', 'number')
    expect(page.locator('.sonar-bubble')).to_have_text('rows: 200')
    check(True, 'digit headline rejected again in browser')
    fixture_reply(page, {'plan': {'view': 'number', 'measure': {'fn': 'count'}}, 'headline': None, 'follow_ups': [], 'cost_micro': 1})
    ask(page, 'Count cheaply', 'number')
    expect(page.locator('.sonar-plan')).to_contain_text('0.001 credits')
    check(True, 'small positive question cost is not rounded to free')
    for status, reply, text in [(503, {'error': 'provider_not_configured', 'message': 'provider missing'}, 'Setup needed'), (429, {'error': 'daily_credit_cap', 'message': 'Fixture daily allowance reached.'}, 'Fixture daily allowance reached.')]:
        fixture_reply(page, reply, status)
        ask(page, 'Try again')
        expect(page.locator('.sonar-message')).to_contain_text(text)
        check(True, f'error {status} recoverable')
    page.unroute('**/api/toolkit')
    for xlsx in ('leads-deflate.xlsx', 'leads-stored.xlsx'):
        page.set_input_files('#sonar-file', str(ROOT / 'tests/fixtures' / xlsx))
        expect(page.locator('.sonar-file-head')).to_contain_text(xlsx)
        check(page.locator('.sonar-column').count() > 0, xlsx + ' parsed and profiled')
    page.set_input_files('#sonar-file', {'name': 'starter.csv', 'mimeType': 'text/csv', 'buffer': b'Country,Employees,Date\nIndia,20,2026-01-01\nUSA,40,2026-02-01\n'})
    expect(page.locator('.sonar-columns')).to_contain_text('# Employees')
    expect(page.locator('.sonar-columns')).to_contain_text('◷ Date')
    expect(page.locator('.sonar-suggestions').first.locator('button')).to_have_count(3)
    page.get_by_role('button', name='Average Employees by Country', exact=True).click()
    expect(page.locator('.sonar-view')).to_have_attribute('data-view', 'rank')
    check(True, 'three profile-based starter chips and numeric/date glyphs work')
    for name, data, text in [('empty.csv', b'Country\n', 'no data rows'), ('bad.exe', b'bad', 'Choose a CSV or XLSX'), ('large.csv', b'x' * (5 * 1024 * 1024 + 1), 'exceeds 5 MiB')]:
        page.set_input_files('#sonar-file', {'name': name, 'mimeType': 'text/plain', 'buffer': data})
        expect(page.locator('.sonar-message')).to_contain_text(text)
        expect(page.get_by_role('button', name='Ping', exact=True)).to_be_enabled()
        check(True, name + ' refused, previous file retained')


def bridge_checks(browser):
    urllib.request.urlopen(urllib.request.Request(BRIDGE + '/fixture/reset', data=b'{}')).read()
    token = json.load(urllib.request.urlopen(BRIDGE + '/fixture/token'))['token']
    context = browser.new_context(viewport={'width': 1280, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    track(page)
    calls = []
    def clerk(route):
        r = route.fetch()
        route.fulfill(response=r, body=r.text().replace('FIXTURE_SESSION_TOKEN', token))
    def api(route):
        req = route.request
        if req.method == 'POST':
            calls.append(req.post_data_json)
        r = page.request.fetch(BRIDGE + req.url[len(BASE):], method=req.method, headers=req.headers, data=req.post_data_buffer)
        route.fulfill(status=r.status, content_type=r.headers.get('content-type', 'application/json'), body=r.body())
    page.route('**/fixture/clerk.js', clerk)
    page.route('**/api/toolkit', api)
    page.route('**/api/toolkit/files/**', api)
    page.goto(BASE + '/toolkit-app.html')
    expect(page.locator('#session-status')).to_have_attribute('data-state', 'ok')
    page.locator('[data-launch="sonar"]').click()
    page.set_input_files('#sonar-file', str(ROOT / 'toolkit-sample-leads.csv'))
    ask(page, 'Rank names', 'rank')
    ask(page, 'List matching rows', 'list')
    sonar_calls = [c for c in calls if c.get('action') == 'sonar']
    check(len(sonar_calls) == 2 and all('rows' not in c['file'] for c in sonar_calls), 'real handler receives profiles, not rows')
    check(len(sonar_calls[-1]['history']) == 2 and json.loads(sonar_calls[-1]['history'][1]['content'])['plan']['view'] == 'rank', 'history retains raw assistant JSON')
    page.locator('.sonar-answer').get_by_role('button', name='Average by country?', exact=True).click()
    expect(page.locator('.sonar-view')).to_have_attribute('data-view', 'rank')
    for i in range(4):
        ask(page, 'Rank again ' + str(i), 'rank')
    recent = [c for c in calls if c.get('action') == 'sonar'][-1]
    check(len(recent['history']) == 6, 'history capped at six turns')
    check([t['role'] for t in recent['history']] == ['user', 'assistant'] * 3, 'history stays paired')
    check(any(c.get('question') == 'Average by country?' for c in calls), 'follow-up chip sends its question')
    # Real Workbench and Enrich results exercise the shared one-call handoff.
    page.get_by_role('button', name='Close Sonar', exact=True).click()
    page.locator('[data-launch="workbench"]').click()
    page.set_input_files('#wb-file', {'name': 'workbench-chain.csv', 'mimeType': 'text/csv', 'buffer': b'Company,Title\nExample,VP Sales\nAcme,CFO\n'})
    page.locator('#wb-to-columns').click()
    page.locator('#wb-confirm').click()
    page.locator('#wb-goal').fill('Classify companies')
    page.locator('#wb-goal').press('Enter')
    expect(page.locator('.op-card')).to_have_count(1)
    page.locator('#wb-quote').click()
    page.locator('#wb-run').click()
    page.locator('[data-app="workbench"]').get_by_role('button', name='Ask Sonar about this', exact=True).click()
    expect(page.locator('.sonar-file-head')).to_contain_text('workbench-chain results.csv')
    expect(page.locator('.sonar-columns')).to_contain_text('Result')
    check(True, 'Workbench report hands current output rows to Sonar')
    page.get_by_role('button', name='Close Sonar', exact=True).click()
    page.get_by_role('button', name='Close Data Workbench', exact=True).click()
    page.locator('[data-launch="enrich"]').click()
    page.set_input_files('#en-file', {'name': 'chain.csv', 'mimeType': 'text/csv', 'buffer': b'Email,Name,Company\na@example.com,Ada,Example\nb@example.com,Bo,Example\n'})
    page.locator('#en-quote').click()
    page.locator('#en-run').click()
    chain = page.locator('[data-app="enrich"]').get_by_role('button', name='Ask Sonar about this', exact=True)
    chain.wait_for()
    chain.click()
    expect(page.locator('.sonar-file-head')).to_contain_text('chain results.csv')
    expect(page.locator('.sonar-columns')).to_contain_text('Result')
    check(True, 'Enrich hands enriched columns to Sonar without re-upload')
    page.get_by_role('button', name='Close Sonar', exact=True).click()
    page.get_by_role('button', name='Close Deep Enrich', exact=True).click()
    page.locator('[data-launch="files"]').click()
    page.locator('[data-app="files"]').get_by_role('button', name='Workbench results', exact=False).first.click()
    page.locator('[data-app="files"]').get_by_role('button', name=re.compile('Ask Sonar about this')).first.click()
    expect(page.locator('.sonar-file-head')).to_contain_text('rows x')
    check(True, 'Files opens saved table in Sonar')
    page.get_by_role('button', name='Close Sonar', exact=True).click()
    page.get_by_role('button', name='Close Files', exact=True).click()
    page.evaluate(v4.DROP, ['[data-desktop="sonar"]', 'dropped.csv', 'Country,Count\nIndia,20\nUSA,30\n', ['dragover', 'drop']])
    expect(page.locator('.sonar-file-head')).to_contain_text('dropped.csv')
    check(True, 'native file drop on desktop Sonar icon loads locally')
    page.evaluate(v4.DROP, ['.sonar', 'window-drop.csv', 'Country,Count\nIndia,20\nUSA,30\n', ['dragover', 'drop']])
    expect(page.locator('.sonar-file-head')).to_contain_text('window-drop.csv')
    check(True, 'native file drop inside Sonar replaces locally')
    context.close()


def baseline_shell(browser):
    """Prove inherited shell findings against the untouched backend commit."""
    context = browser.new_context(viewport={'width': 1280, 'height': 1000}, reduced_motion='no-preference')
    page = context.new_page()
    track(page)
    for filename in ('toolkit-desktop.js', 'toolkit-app.html', 'scheme-tokens.css'):
        content = subprocess.check_output(['git', 'show', '7caaa0f:' + filename], cwd=ROOT).decode()
        mime = 'text/html' if filename.endswith('.html') else 'text/css' if filename.endswith('.css') else 'application/javascript'
        page.route('**/' + filename, lambda route, request, body=content, mime=mime: route.fulfill(body=body, content_type=mime))
    page.goto(BASE + '/toolkit-app.html')
    expect(page.locator('#session-status')).to_have_attribute('data-state', 'ok')
    page.evaluate("document.documentElement.dataset.scheme='light'")
    findings = page.evaluate(v4.audit.PROBE)
    (OUT / 'baseline-shell-audit.json').write_text(json.dumps(findings, indent=2))
    check(any(f['rule'] == 'contrast' and 'dock-label' in f['where'] for f in findings), 'light dock contrast issue reproduced on untouched 7caaa0f')
    check(any(f['rule'] == 'layout-animation' and 'desk-icon' in f['where'] for f in findings), 'desktop layout animation issue reproduced on untouched 7caaa0f')
    context.close()


if __name__ == '__main__':
    run()
