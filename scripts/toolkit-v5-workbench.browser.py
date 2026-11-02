"""Data Workbench v5: the six stages against the real toolkit handler (bridge 3176) and the static fixture (3175).

Run after starting tests/fixture_server.py --port 3175 and scripts/toolkit-browser-server.mjs (3176).
At 1440 and 390: load the sample, confirm columns, ask (503 path first, then the assistant), quote, run, report.
Every report number is checked against a recount of the downloaded result rows done here in Python.
"""
import csv
import importlib.util
import io
import json
import pathlib
import re

from playwright.sync_api import sync_playwright, expect

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('v4', HERE / 'toolkit-v4.browser.py')
v4 = importlib.util.module_from_spec(spec); spec.loader.exec_module(v4)
ROOT, BASE, BRIDGE = v4.ROOT, v4.BASE, v4.BRIDGE
OUT = v4.OUT
SAMPLE = list(csv.DictReader(io.StringIO((ROOT / 'toolkit-sample-leads.csv').read_text())))
META = re.compile(r' / (confidence|evidence|checked_at|review)$')
FULL_HEADERS = """sel => [...document.querySelectorAll(sel)].map(th => ({text: th.textContent, clipped: th.scrollWidth > th.clientWidth + 1 || th.scrollHeight > th.clientHeight + 1, title: th.title}))"""


def pct(n, d):
    x = round(n / d * 1000) / 10 if d else 0
    return int(x) if x == int(x) else x  # prints like the JS number


def recount(source, outputs, kept):
    """Independent recount of the report, from the rows only."""
    rows = len(outputs)
    headers = list(outputs[0].keys())
    added = [h for h in headers if re.match(r'^Result \d+: ', h) and not META.search(h)]
    filled = lambda v: str(v or '').strip() != ''
    fill = {h: (pct(sum(filled(r.get(h)) for r in source[:rows]) if h in kept else 0, rows), pct(sum(filled(r[h]) for r in outputs), rows)) for h in kept + added}
    dist = {}
    for h in added:
        tally = {}
        for r in outputs:
            v = r[h].strip() if filled(r[h]) else '(empty)'
            tally[v] = tally.get(v, 0) + 1
        dist[h] = sorted(tally.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    review = [h for h in headers if h.endswith(' / review')]
    flagged = sum(any(r[h] == 'Review needed' for h in review) for r in outputs)
    return {'rows': rows, 'kept': len(kept), 'added': len(added), 'fill': fill, 'dist': dist, 'flagged': flagged}


def window_shot(page, name):
    page.locator('[data-app="workbench"]').screenshot(path=str(OUT / f'v5-{name}.png'))


def run(width):
    v4.reset()
    errors, calls, mode = [], [], {'intake503': False}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={'width': width, 'height': 1000 if width > 500 else 844}, reduced_motion='reduce', accept_downloads=True)
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
            if mode['intake503'] and body.get('action') == 'intake':
                return route.fulfill(status=503, content_type='application/json', body=json.dumps({'error': 'provider_not_configured'}))
            response = page.request.fetch(BRIDGE + req.url[len(BASE):], method=req.method, headers=req.headers, data=req.post_data_buffer)
            route.fulfill(status=response.status, headers={'content-type': response.headers.get('content-type', 'application/json')}, body=response.body())
        page.route('**/fixture/clerk.js', clerk)
        page.route('**/api/toolkit', api)
        page.route('**/api/toolkit/files/**', api)
        page.route(BASE + '/', lambda r: r.fulfill(path=str(ROOT / 'toolkit-app.html'), content_type='text/html'))
        page.goto(BASE + '/')
        page.wait_for_function(v4.WAIT_SIGNED)
        w = v4.open_app(page, 'workbench')
        if width > 500: page.get_by_role('button', name='Maximize Data Workbench').click()

        # 1. File: sample, summary, full headers, no stray native text.
        v4.stage_is(page, 'File')
        assert w.get_by_text('Any CSV or XLSX up to 5 MiB. You see the price before anything runs.', exact=True).is_visible()
        assert page.locator('#wb-file').evaluate('n => getComputedStyle(n).color') == 'rgba(0, 0, 0, 0)', 'the native "No file chosen" text is hidden'
        window_shot(page, f'0-empty-{width}')
        page.locator('#wb-sample').click()
        w.get_by_text(f'{len(SAMPLE)} rows loaded in your browser. Nothing is sent until you approve a run.', exact=True).wait_for()
        heads = page.evaluate(FULL_HEADERS, '[data-app="workbench"] .file-info th')
        assert [h['text'] for h in heads] == list(SAMPLE[0].keys()) and not any(h['clipped'] for h in heads), heads
        assert [d.inner_text() for d in w.locator('.file-info .metrics dd').all()][:3] == ['sample-leads.csv', '200', '9']
        v4.capture(page, f'v5-1-file-{width}'); window_shot(page, f'1-file-{width}')

        # 2. Columns: patchbay rows, dashed unsure guesses, long-value notice, nothing sent before confirm.
        calls.clear()
        page.locator('#wb-to-columns').click(); v4.stage_is(page, 'Columns')
        assert w.locator('.map-row').count() == 9 and w.locator('.map-row[data-sure="false"]').count() >= 1
        assert w.locator('.map-row[data-sure="false"]').first.evaluate('n => getComputedStyle(n).borderTopStyle') == 'dashed'
        notes = w.locator('.map-row[data-source="Notes"]')
        assert 'Long values are cut to 1,000 characters before they are sent; your download keeps the original.' in notes.inner_text()
        assert all(r.locator('.pb-samples li').count() <= 3 for r in w.locator('.map-row').all())
        assert not calls, 'nothing is sent before Confirm columns'
        geo = page.evaluate('''() => { const r = document.querySelector('[data-app=workbench] .map-row'), cb = r.querySelector('.check input').getBoundingClientRect();
          return {cb: [Math.round(cb.width), Math.round(cb.height)], jack: getComputedStyle(r.querySelector('.pb-src'), '::after').display,
            over: [...document.querySelectorAll('[data-app=workbench] .map-row *')].filter(n => n.getBoundingClientRect().right > r.getBoundingClientRect().right + 1).length}; }''')
        print(width, 'columns geometry', geo)
        assert geo['over'] == 0
        v4.capture(page, f'v5-2-columns-{width}'); window_shot(page, f'2-columns-{width}')
        page.locator('#wb-confirm').click(); v4.stage_is(page, 'Ask')
        assert w.locator('.map-row[data-sure="false"]').count() == 0

        # 3a. Ask with the assistant switched off: a plain notice and the manual builder, never a red box.
        mode['intake503'] = True
        w.get_by_role('button', name='Categorization', exact=True).click()
        w.get_by_text('The assistant is not switched on yet. Set it up by hand below.', exact=True).wait_for()
        assert w.locator('[data-stage="ask"] .notice.bad').count() == 0
        assert w.get_by_role('button', name='Add operation', exact=True).is_visible() and page.locator('#wb-quote').is_visible()
        v4.capture(page, f'v5-3a-ask-503-{width}'); window_shot(page, f'3a-ask-503-{width}')
        mode['intake503'] = False

        # 3b. Ask for real: Shift Enter is a newline, Enter sends; model badge and cost appear; plan cards with engine badges.
        box = page.locator('#wb-goal')
        box.fill('Sort the companies into SaaS or not')
        box.press('Shift+Enter')
        assert box.input_value() == 'Sort the companies into SaaS or not\n' and not [c for c in calls if c.get('action') == 'intake' and not mode['intake503'] and c.get('goal', '').startswith('Sort')]
        calls.clear(); box.press('Enter')
        w.get_by_text('Do you also want to know whether each company sells to businesses?').wait_for()
        intake = [c for c in calls if c['action'] == 'intake'][-1]
        assert len(intake['file']['headers']) == 9 and intake['file']['rows_total'] == 200
        badge = w.locator('.model-badge').inner_text(); cost = w.locator('.pb-cost').inner_text()
        assert badge and re.search(r'Assistant cost so far: (under )?\$', cost), (badge, cost)
        expect(w.locator('.op-card')).to_have_count(1)
        assert w.locator('.op-card .engine-badge').first.text_content() == 'Jev'
        v4.capture(page, f'v5-3b-ask-{width}'); window_shot(page, f'3b-ask-{width}')

        # 4. Quote: whole job priced once, long values cut in what is sent.
        calls.clear()
        page.locator('#wb-quote').click(); v4.stage_is(page, 'Quote')
        page.wait_for_selector('#wb-run:not([disabled])')
        q = [c for c in calls if c['action'] == 'quote'][-1]
        assert len(q['rows']) == 200 and max(len(r['Notes']) for r in q['rows']) == 1000, 'long Notes cut to 1,000'
        text = w.locator('[data-stage="quote"]').inner_text()
        assert 'Left today after this job' in text and '200 rows in 2 chunks' in text, text
        assert 'btn-gold' in page.locator('#wb-run').get_attribute('class')
        v4.capture(page, f'v5-4-quote-{width}'); window_shot(page, f'4-quote-{width}')

        # 5 and 6. Run, then the report.
        page.locator('#wb-run').click()
        w.get_by_text('Saved to Files: /Workbench results/sample-leads ', exact=False).wait_for(timeout=60000)
        v4.stage_is(page, 'Report')
        assert w.locator('.trace li[data-state="completed"]').count() == 2
        with page.expect_download() as dl:
            w.get_by_role('button', name='Download CSV', exact=True).click()
        outputs = list(csv.DictReader(io.StringIO(pathlib.Path(dl.value.path()).read_text())))
        assert len(outputs) == 200 and max(len(r['Notes']) for r in outputs) > 1000, 'the download keeps the original long Notes'
        rc = recount(SAMPLE, outputs, list(SAMPLE[0].keys()))
        cards = w.locator('[data-stage="report"] .rp-card')
        summary = [d.inner_text() for d in cards.first.locator('dd').all()]
        assert summary == [str(rc['rows']), str(rc['kept']), str(rc['added']), str(rc['flagged'])], (summary, rc)
        fills = {li.locator('.rp-label').inner_text(): li.locator('.rp-val').inner_text() for li in w.locator('[data-kind="fill"] li').all()}
        assert fills == {h: f'{b}% to {a}%' for h, (b, a) in rc['fill'].items()}, (fills, rc['fill'])
        for h, top in rc['dist'].items():
            card = cards.filter(has=page.get_by_role('heading', name=h, exact=True))
            got = [(li.locator('.rp-label').inner_text(), li.locator('.rp-val').inner_text()) for li in card.locator('li').all()]
            assert got == [(v, f'{n} ({pct(n, rc["rows"])}%)') for v, n in top], (h, got, top)
        assert f'{rc["flagged"]} of {rc["rows"]} rows' in cards.last.inner_text()
        assert all(c.locator('.rp-src').count() == 1 and c.locator('.rp-note').count() == 1 for c in cards.all()), 'every card names its source and a note'
        heads = page.evaluate(FULL_HEADERS, '[data-stage="report"] .results th')
        assert [h['text'] for h in heads] == list(outputs[0].keys()) and not any(h['clipped'] for h in heads)
        v4.capture(page, f'v5-6-report-{width}'); window_shot(page, f'6-report-{width}')

        with page.expect_download() as dl:
            w.get_by_role('button', name='Download report', exact=True).click()
        report = pathlib.Path(dl.value.path()); html = report.read_text()
        assert '<script' not in html
        standalone = context.new_page(); bad = []
        standalone.on('console', lambda m: bad.append(m.text) if m.type == 'error' else None)
        standalone.on('pageerror', lambda e: bad.append(str(e)))
        saved = OUT / f'v5-report-{width}.html'; saved.write_text(html)
        standalone.goto(saved.as_uri())
        assert standalone.locator('.rp-card').count() == cards.count() and not bad, bad
        gaps = standalone.evaluate("() => { const g = document.querySelector('.rp-grid').getBoundingClientRect(); return [...document.querySelectorAll('.rp-card')].filter(c => !c.nextElementSibling || c.nextElementSibling.getBoundingClientRect().top > c.getBoundingClientRect().top + 1).map(c => Math.round(g.right - c.getBoundingClientRect().right)); }")
        assert all(x <= 1 for x in gaps), ('every card row ends at the grid edge', gaps)
        standalone.screenshot(path=str(OUT / f'v5-report-standalone-{width}.png'), full_page=True); standalone.close()

        with page.expect_download() as dl:
            w.get_by_role('button', name='Agent brief (JSON)', exact=True).click()
        brief = json.loads(pathlib.Path(dl.value.path()).read_text())
        assert set(brief) == {'file', 'mapping', 'plan', 'aggregates', 'generated_at'} and brief['aggregates']['rows'] == 200 and len(brief['mapping']) == 9, list(brief)

        # Back works from the report, and the stepper reopens the run trace.
        w.get_by_role('button', name='5. Run, done').click(); v4.stage_is(page, 'Run')
        assert '200 of 200' in w.locator('.trace-nums').inner_text()
        assert w.locator('[data-stage="run"] h3').inner_text() == 'Job finished'
        w.get_by_role('button', name='See the report', exact=True).click(); v4.stage_is(page, 'Report')
        w.get_by_role('button', name='5. Run, done').click(); v4.stage_is(page, 'Run')
        v4.capture(page, f'v5-5-run-{width}'); window_shot(page, f'5-run-{width}')
        w.get_by_role('button', name='Back', exact=True).click(); v4.stage_is(page, 'Quote')
        assert not errors, errors
        context.close(); browser.close()
    return rc


if __name__ == '__main__':
    for width in (1440, 390):
        rc = run(width)
        print(f'{width}: six stages, one on screen at a time; report recount matches ({rc["rows"]} rows, {rc["added"]} added columns, {rc["flagged"]} flagged); 503 path shows the manual builder; HTML report standalone with 0 errors; brief has every key.')
    v4.OUT.joinpath('v5-report.json').write_text(json.dumps(v4.reports, indent=2))
    print(f'PASS: Data Workbench v5 browser pass; {len(v4.reports)} audited screenshots; zero JS errors.')
