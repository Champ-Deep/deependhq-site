"""Toolkit guide: the pixel mare launcher and panel, against the real toolkit handler (bridge 3176) and the static
fixture (3175), with only the `guide` action mocked by route interception.

Run after starting tests/fixture_server.py --port 3175 and scripts/toolkit-browser-server.mjs (3176), then
    python3 scripts/toolkit-guide.browser.py
Checks the sprite files first, then at 375, 768 and 1280 in dark and light: launcher size and placement, open and
Escape, chip sends `guide` with the active stage, point_to lights the stepper step and Go to switches stage, the
designed error lines, no horizontal scroll, panel text contrast, and the signed-out page making no API call.
Screenshots land in docs/shots/guide/.
"""
import importlib.util
import json
import pathlib
import re

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('v4', HERE / 'toolkit-v4.browser.py')
v4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v4)
ROOT, BASE, BRIDGE = v4.ROOT, v4.BASE, v4.BRIDGE
SHOTS = ROOT / 'docs/shots/guide'; SHOTS.mkdir(parents=True, exist_ok=True)
PALETTE = {'#0E1A33', '#F4EBD9', '#A9ABA6', '#F4A62A'}
LAMP = '#F4A62A'
REPLY = {'reply': 'Open the quote first, nothing runs before it.', 'point_to': 'quote', 'chips': ['What is a credit?', 'Can I change columns?', 'How long does a run take?'], 'model': 'deepseek/deepseek-v4.1-flash', 'cost_micro': 210}
# Fixed things that may share the bottom right corner with the launcher.
CORNER = "sel => { const b = document.querySelector(sel || '.tg-launcher').getBoundingClientRect(); return [...document.querySelectorAll('#app-launcher, .v3-dock, .stage-foot, [data-ask-deep], .ask-deep, #ask-deep, .ask-fab')].filter(n => n.checkVisibility()).map(n => { const r = n.getBoundingClientRect(); return {n: n.id || n.className, hit: r.width > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top}; }); }"
WIDE = "() => [...document.querySelectorAll('body *')].filter(n => n.checkVisibility() && n.getBoundingClientRect().right > innerWidth + 1 && !n.closest('.table-wrap, .wb-table, [data-app] .stepper')).map(n => n.tagName + '.' + n.className).slice(0, 5)"


def sprite_check():
    """Every fill is a palette colour, every coordinate an integer in 0..32, the badge has no lamp, the JSON matches."""
    data = json.loads((ROOT / 'brand/pixel-mare.json').read_text())
    assert sorted(data['frames']) == ['blink', 'idle', 'point', 'think']
    for name in ['brand/pixel-mare.svg', 'brand/pixel-mare-badge.svg']:
        svg = (ROOT / name).read_text()
        fills = set(re.findall(r'fill="([^"]+)"', svg))
        assert fills and fills <= PALETTE, (name, fills)
        nums = [n for d in re.findall(r' d="([^"]+)"', svg) for n in re.findall(r'-?[\d.]+', d)]
        assert nums and all(re.fullmatch(r'\d+', n) and 0 <= int(n) <= 32 for n in nums), (name, [n for n in nums if not re.fullmatch(r'\d+', n) or int(n) > 32][:5])
        assert 'crispEdges' in svg
    assert LAMP not in (ROOT / 'brand/pixel-mare-badge.svg').read_text(), 'lamp never sits on the paper badge'
    assert re.findall(r'<symbol id="mare-(\w+)"', (ROOT / 'brand/pixel-mare.svg').read_text()) == ['idle', 'blink', 'think', 'point']
    print('sprite: 4 frames, fills', sorted(PALETTE), 'integer coords in 0..32, badge without lamp')


def sprite_sheet():
    """The four frames and the badge at 8x (256px), on ink, for the PR."""
    sprite = (ROOT / 'brand/pixel-mare.svg').read_text().replace('<svg ', '<svg style="display:none" ', 1)
    cells = ''.join(f'<figure><svg width="256" height="256" viewBox="0 0 32 32" shape-rendering="crispEdges"><use href="#mare-{f}"/></svg><figcaption>{f}</figcaption></figure>' for f in ('idle', 'blink', 'think', 'point'))
    badge = (ROOT / 'brand/pixel-mare-badge.svg').read_text().replace('<svg ', '<svg width="256" height="256" ', 1)
    html = f'<body style="margin:0;padding:16px;display:flex;gap:16px;background:#0E1A33;color:#F4EBD9;font:14px monospace"><style>figure{{margin:0}}</style>{sprite}{cells}<figure>{badge}<figcaption>badge</figcaption></figure></body>'
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1480, 'height': 340}); pg.set_content(html)
        pg.screenshot(path=str(SHOTS / 'sprite-8x.png')); b.close()


def contrast(page):
    rows = [r for r in page.evaluate(v4.TEXT_CONTRAST.replace("document.querySelectorAll('body *')", "document.querySelectorAll('.tg-panel *')"))]
    bad = [r for r in rows if r['ratio'] < r['min']]
    assert rows and not bad, bad
    return sorted({(r['tag'], r['fg'], r['bg'], r['ratio']) for r in rows}, key=lambda r: r[3])


def run(width, scheme, report):
    v4.reset()
    errors, calls, mode = [], [], {'guide': 'ok'}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={'width': width, 'height': 900 if width > 500 else 812}, reduced_motion='reduce')
        token = json.load(v4.urllib.request.urlopen(BRIDGE + '/fixture/token'))['token']
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and not m.text.startswith('Failed to load resource:') else None)

        def clerk(route):
            response = route.fetch(); route.fulfill(response=response, body=response.text().replace('FIXTURE_SESSION_TOKEN', token))

        def api(route):
            req = route.request
            body = json.loads(req.post_data or '{}') if req.method == 'POST' else {}
            if req.method == 'POST': calls.append(body)
            if body.get('action') == 'guide':
                status, out = {'ok': (200, REPLY), '503': (503, {'error': 'provider_not_configured'}), '429': (429, {'error': 'daily_credit_cap'}),
                               '502': (502, {'error': 'guide_failed'}), '400': (400, {'error': 'invalid_guide', 'message': 'Ask in 500 characters or fewer.'})}[mode['guide']]
                return route.fulfill(status=status, content_type='application/json', body=json.dumps(out))
            response = page.request.fetch(BRIDGE + req.url[len(BASE):], method=req.method, headers=req.headers, data=req.post_data_buffer)
            route.fulfill(status=response.status, headers={'content-type': response.headers.get('content-type', 'application/json')}, body=response.body())
        page.route('**/fixture/clerk.js', clerk)
        page.route('**/api/toolkit', api)
        page.route('**/api/toolkit/files/**', api)
        page.route(BASE + '/', lambda r: r.fulfill(path=str(ROOT / 'toolkit-app.html'), content_type='text/html'))
        page.route(BASE + '/sign-in', lambda r: r.fulfill(path=str(ROOT / 'toolkit-signin.html'), content_type='text/html'))
        tag = f'{width}-{scheme}'

        def set_scheme():
            page.evaluate('s => document.documentElement.dataset.scheme = s', scheme)

        # Signed out, on the desktop and on the sign-in page: tips answer from the page, no API call at all.
        page.goto(BASE + '/'); page.wait_for_function(v4.WAIT_SIGNED)
        page.get_by_role('button', name='Sign out', exact=True).click()
        page.wait_for_function("document.querySelector('#daily').textContent === 'Unavailable'")
        launcher = page.locator('.tg-launcher'); panel = page.get_by_role('complementary', name='Toolkit guide')
        for where in ('desktop', 'signin'):
            if where == 'signin':
                page.get_by_role('link', name='Sign in', exact=True).click(); page.wait_for_selector('[data-fixture="signin"]')
            set_scheme(); calls.clear()
            launcher.click()
            assert panel.is_visible() and launcher.get_attribute('aria-expanded') == 'true'
            assert panel.get_by_role('link', name='Sign in to ask anything').is_visible()
            chips = panel.locator('.tg-chip'); assert chips.count() == 5
            chips.nth(2).click(); panel.get_by_text('Up to 5 MiB, 20,000 rows and 200 columns.').wait_for()
            assert not [c for c in calls if c.get('action') == 'guide'], 'signed out never calls the API'
            for sel in ('.tg-launcher', '.tg-panel'): assert not [c for c in page.evaluate(CORNER, sel) if c['hit']], (sel, page.evaluate(CORNER, sel))
            page.screenshot(path=str(SHOTS / f'signed-out-{where}-{tag}.png'))
            page.keyboard.press('Escape')
        page.get_by_role('button', name='Continue with Google (fixture)').click()

        # Signed in: the desktop.
        page.wait_for_function(v4.WAIT_SIGNED); set_scheme()
        box = launcher.bounding_box(); assert box['width'] >= 44 and box['height'] >= 44, box
        corner = page.evaluate(CORNER); assert not [c for c in corner if c['hit']], corner
        launcher.click(); assert panel.is_visible()
        assert page.evaluate("document.activeElement.id") == 'tg-q', 'focus moves into the panel'
        page.keyboard.press('Escape')
        assert panel.is_hidden() and launcher.get_attribute('aria-expanded') == 'false'
        assert page.evaluate("document.activeElement.classList.contains('tg-launcher')"), 'Escape returns focus to the launcher'
        launcher.click()
        page.wait_for_function("document.querySelector('#mare-idle') && document.querySelector('.tg-panel').dataset.face")
        hits = [c for c in page.evaluate(CORNER, '.tg-panel') if c['hit']]; assert not hits, ('the open panel clears the dock', hits)
        gap = page.evaluate("document.querySelector('.tg-panel').getBoundingClientRect().top - document.querySelector('.menubar').getBoundingClientRect().bottom"); assert gap >= 0, ('the panel clears the menu bar', gap)
        page.screenshot(path=str(SHOTS / f'gallery-{tag}.png'))
        calls.clear(); panel.locator('.tg-chip').first.click(); panel.locator('.tg-meta').first.wait_for()
        assert [c for c in calls if c.get('action') == 'guide'][-1]['stage'] == 'gallery'
        page.keyboard.press('Escape')

        # The Workbench on Columns; a chip asks with that stage, the reply points at Quote.
        w = v4.open_app(page, 'workbench')
        if width > 800: page.get_by_role('button', name='Maximize Data Workbench').click()
        page.locator('#wb-sample').click(); page.locator('#wb-to-columns').click(); v4.stage_is(page, 'Columns')
        corner = page.evaluate(CORNER); assert not [c for c in corner if c['hit']], ('launcher clear of the stage footer', corner)
        launcher.click(); calls.clear()
        before = panel.locator('.tg-meta').count()
        panel.locator('.tg-chip').nth(1).click()
        page.wait_for_function("n => document.querySelectorAll('.tg-panel .tg-meta').length > n && document.querySelector('.tg-panel').dataset.face === 'point'", arg=before)
        sent = [c for c in calls if c.get('action') == 'guide'][-1]
        assert sent['stage'] == 'columns' and len(sent['history']) == 2, sent
        assert panel.locator('.tg-meta').last.inner_text() == 'deepseek/deepseek-v4.1-flash · 1 credit'
        assert page.locator('.tg-mascot use').get_attribute('href').endswith('#mare-point')
        seen = page.evaluate("() => { const b = document.querySelector('.tg-body').getBoundingClientRect(), m = [...document.querySelectorAll('.tg-bot')].pop().getBoundingClientRect(); return m.top >= b.top && m.top < b.bottom - 20; }")
        assert seen, 'the newest answer opens at its first line'
        ring = page.evaluate("[...document.querySelectorAll('[data-app=workbench] .stepper li')].map(li => li.hasAttribute('data-guide-point'))")
        assert ring == [False, False, False, True, False, False], ring
        outline = page.evaluate("getComputedStyle(document.querySelector('.stepper li[data-guide-point]'), '::after').borderTopColor")
        assert outline in ('rgb(244, 166, 42)', 'rgb(138, 90, 0)'), outline
        assert [c.inner_text() for c in panel.locator('.tg-chip').all()] == REPLY['chips']
        contrast_rows = contrast(page)
        page.screenshot(path=str(SHOTS / f'point-{tag}.png'))
        # visual-verify audit plus whole-page contrast with the panel open, FAIL blocks. Dark only: the toolkit host ships
        # data-scheme=dark, and its own dock has no light twin yet; the panel itself is measured in both schemes above.
        if scheme == 'dark': v4.capture(page, f'guide-point-{tag}')
        panel.get_by_role('button', name='Go to Quote').click(); v4.stage_is(page, 'Quote')
        if panel.is_hidden(): launcher.click()

        # Designed errors, never raw codes.
        for code, line in [('503', 'The guide is offline right now.'), ('429', 'Your AI allowance for today is used up. These tips are free.'),
                           ('502', 'That one did not land. Try again or rephrase.'), ('400', 'Ask in 500 characters or fewer.')]:
            mode['guide'] = code
            before = panel.locator('.tg-error').count()
            page.locator('#tg-q').fill('How much will this cost?'); page.locator('#tg-q').press('Enter')
            page.wait_for_function("n => document.querySelectorAll('.tg-panel .tg-error').length > n", arg=before)
            assert panel.locator('.tg-error .tg-text').last.inner_text() == line, (code, panel.locator('.tg-error').last.inner_text())
            if code in ('503', '429'): assert panel.locator('.tg-chip').count() == 5, code
            assert page.locator('.tg-mascot use').get_attribute('href').endswith('#mare-idle')
            assert not panel.get_by_text(re.compile('provider_not_configured|daily_credit_cap|guide_failed|invalid_guide')).count()
            if code == '503': page.screenshot(path=str(SHOTS / f'offline-{tag}.png'))
        assert page.locator('#tg-count').inner_text() == '0 / 500'
        page.locator('#tg-q').fill('x' * 600); assert page.locator('#tg-q').input_value() == 'x' * 500
        wide = page.evaluate(WIDE)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth') and not wide, wide
        assert not errors, errors
        report.append({'width': width, 'scheme': scheme, 'launcher': [round(box['width']), round(box['height'])], 'corner': corner, 'contrast': contrast_rows})
        print(tag, 'ok', 'launcher', report[-1]['launcher'], 'min contrast', contrast_rows[0])
        browser.close()


if __name__ == '__main__':
    sprite_check(); sprite_sheet()
    report = []
    for width in (375, 768, 1280):
        for scheme in ('dark', 'light'):
            run(width, scheme, report)
    (SHOTS / 'contrast.json').write_text(json.dumps(report, indent=1) + '\n')
    print('all guide checks passed;', len(report), 'runs; shots in', SHOTS.relative_to(ROOT))
