"""V4 toolkit UI against the real toolkit handler, SQLite and fixture-only providers."""
import importlib.util
import json
import os
import pathlib
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(os.environ.get('TOOLKIT_EVIDENCE', ROOT / 'scratch/toolkit-v4'))
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
# composited outward to the first opaque ancestor; text that reaches the body is measured against the page ground.
# Threshold is 4.5:1, or 3:1 for large text (24px and up, or 18.66px bold).
TEXT_CONTRAST = """() => {
  const parse = c => { let m = c.match(/^rgba?\\(([^)]+)\\)/); if (m) { const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; }
    m = c.match(/^color\\(srgb ([^)]+)\\)/); if (m) { const p = m[1].split(/[ \\/]+/).filter(Boolean).map(Number); return [p[0]*255, p[1]*255, p[2]*255, p[3] ?? 1]; } return null; };
  const over = (top, bottom) => [0, 1, 2].map(i => top[i]*top[3] + bottom[i]*(1-top[3])).concat(1);
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v/12.92 : ((v+.055)/1.055) ** 2.4; }); return .2126*r + .7152*g + .0722*b; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
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
    const grounds = [ground || body];
    const measured = grounds.map(g => { let bg = g; for (const l of layers.slice().reverse()) bg = over(l, bg); return [ratio(fg, bg), hex(bg)]; }).sort((a, b) => a[0] - b[0])[0];
    rows.push({text: el.textContent.trim().slice(0, 40), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''), size: cs.fontSize, fg: hex(fg), bg: measured[1], ratio: Math.round(measured[0] * 100) / 100, min: large ? 3 : 4.5});
  }
  return rows;
}"""


def reset():
    urllib.request.urlopen(urllib.request.Request(BRIDGE+'/fixture/reset', data=b'{}', method='POST')).read()

def state():
    return json.load(urllib.request.urlopen(BRIDGE+'/fixture/state'))

def capture(page, name, full=True):
    findings = page.evaluate(audit.PROBE)
    (OUT/(name+'-audit.json')).write_text(json.dumps(findings, indent=2))
    failures = [f for f in findings if f['severity']=='FAIL']
    assert not failures, (name, failures)
    rows = page.evaluate(TEXT_CONTRAST)
    assert rows, (name, 'no text measured')
    low = [g for g in rows if g['ratio'] < g['min']]
    assert not low, (name, low)
    for g in rows:
        contrast_rows.setdefault((g['tag'], g['text'], g['bg']), {**g, 'captures': []})['captures'].append(name)
    assert page.evaluate("document.documentElement.dataset.scheme") == 'dark', name
    assert not page.evaluate("/\\$\\d[\\d,]*\\.\\d{3}/.test(document.body.innerText)"), (name, 'money shows more than 2 decimals')
    assert page.evaluate("!/[\u2013\u2014]/.test(document.body.innerText)"), (name, 'dash in visible text')
    assert page.evaluate("!/VT323|Matrix/.test(getComputedStyle(document.body).fontFamily)"), name
    overflow = page.evaluate("""() => [...document.querySelectorAll('body *')].filter(e=>{
      if(e.closest('.table-scroll')||e.closest('[hidden]')||e.closest('.dock')||!e.getClientRects().length||!e.checkVisibility())return false;
      const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left< -1);
    }).map(e=>e.tagName+'.'+e.className)""")
    assert not overflow, (name, overflow)
    # No dead buttons: anything disabled says so in its own state (a quote that cannot run, a busy save).
    dead = page.evaluate("""() => [...document.querySelectorAll('button')].filter(b=>b.checkVisibility()&&b.disabled&&!['wb-run','en-run'].includes(b.id)&&!/Previous|Next|Add operation|Thinking/.test(b.textContent)).map(b=>b.textContent)""")
    assert not dead, (name, 'disabled buttons', dead)
    page.screenshot(path=str(OUT/(name+'.png')), full_page=full)
    reports.append({'capture':name,'failures':0,'warnings':[f for f in findings if f['severity']=='WARN']})

def open_app(page, app):
    page.locator('[data-launch="'+app+'"]').click()
    return page.locator('[data-app="'+app+'"]')

def close_app(page, name):
    page.get_by_role('button', name='Close '+name, exact=True).click()

def rect(loc):
    b = loc.bounding_box(); return {k: round(b[k]) for k in ('x', 'y', 'width', 'height')}

def drag(page, start, end, check=None):
    page.mouse.move(*start); page.mouse.down(); page.mouse.move(*end, steps=8)
    if check: check()
    page.mouse.up()

def title_point(w):
    b = w.locator('.window-title').bounding_box(); return (b['x']+20, b['y']+b['height']/2)

def csv(rows):
    return ('Person Name,Company Name,Work Email,Job\n'+''.join(f'Person {i},Acme {i%3},p{i}@example.com,VP Sales\n' for i in range(rows))).encode()

DROP = """([selector, name, body, types]) => { const dt = new DataTransfer(); dt.items.add(new File([body], name, {type: 'text/csv'}));
  const t = document.querySelector(selector); for (const type of types) t.dispatchEvent(new DragEvent(type, {bubbles: true, cancelable: true, dataTransfer: dt})); }"""
WAIT_SIGNED = "document.querySelector('#daily').textContent.includes('$')"
USER = 'user_FIXTURE0001'

def window_checks(page):
    """Resize from edges and corners, snap with a preview, double-click maximize, geometry per user, no Move button."""
    vw, vh = page.viewport_size['width'], page.viewport_size['height']
    top = round(page.locator('.menubar').bounding_box()['height'])
    dock = page.locator('#app-launcher').bounding_box()
    area = {'x': 0, 'y': top, 'width': vw, 'height': round(dock['y']-12-top)}
    w = open_app(page, 'account')
    assert w.get_by_role('button', name='Move', exact=False).count() == 0, 'the Move button is gone'
    assert [b.get_attribute('aria-label') for b in w.locator('.window-controls button').all()] == ['Minimize Account', 'Maximize Account', 'Close Account']
    r0 = rect(w)
    assert r0['y']+r0['height'] <= dock['y'], ('window runs under the dock', r0, dock)
    se = w.locator('.rz-se').bounding_box(); drag(page, (se['x']+7, se['y']+7), (se['x']+107, se['y']+87))
    r1 = rect(w); assert (r1['width']-r0['width'], r1['height']-r0['height'], r1['x'], r1['y']) == (100, 80, r0['x'], r0['y']), ('resize se', r0, r1)
    nw = w.locator('.rz-nw').bounding_box(); drag(page, (nw['x']+7, nw['y']+7), (nw['x']+2000, nw['y']+2000))
    r2 = rect(w); assert (r2['width'], r2['height']) == (360, 240), ('resize floor 360x240', r2)
    assert r2['x']+r2['width'] == r1['x']+r1['width'] and r2['y']+r2['height'] == r1['y']+r1['height'], 'nw resize keeps the opposite corner'
    e = w.locator('.rz-e').bounding_box(); drag(page, (e['x']+4, e['y']+e['height']/2), (e['x']+504, e['y']+e['height']/2))
    assert rect(w)['x']+rect(w)['width'] <= vw, ('east edge stops at the desktop', rect(w))
    ww = w.locator('.rz-w').bounding_box(); before = rect(w)
    drag(page, (ww['x']+4, ww['y']+ww['height']/2), (ww['x']+4-(560-before['width']), ww['y']+ww['height']/2))
    assert rect(w)['width'] == 560 and rect(w)['x']+560 == before['x']+before['width'], ('resize west edge', before, rect(w))
    seen = {}
    def preview():
        seen['preview'] = page.locator('#snap-preview').is_visible() and rect(page.locator('#snap-preview'))
    drag(page, title_point(w), (4, area['y']+area['height']//2), preview)
    left = {'x': 0, 'y': area['y'], 'width': vw//2, 'height': area['height']}
    assert seen['preview'] == left and rect(w) == left and w.get_attribute('data-zone') == 'left', ('snap left', seen, rect(w))
    drag(page, title_point(w), (vw//2, area['y']+4), preview)
    assert rect(w) == area and w.get_attribute('data-zone') == 'max', ('snap top maximizes', rect(w), area)
    drag(page, title_point(w), (vw-3, area['y']+area['height']-10), preview)
    hh = int(area['height']/2+.5)  # JS Math.round, not banker's rounding
    quarter = {'x': vw-vw//2, 'y': area['y']+area['height']-hh, 'width': vw//2, 'height': hh}
    assert seen['preview'] == quarter and rect(w) == quarter, ('snap corner quarter', seen, rect(w), quarter)
    page.screenshot(path=str(OUT/'window-snap-corner-1440.png'))
    drag(page, title_point(w), (vw//2, area['y']+200))
    free = rect(w); assert w.get_attribute('data-zone') == '' and free['width'] == 560, ('dragging out restores the free size', free)
    w.locator('.window-title').dblclick()
    assert rect(w) == area and w.get_attribute('data-zone') == 'max', 'double click maximizes'
    assert w.get_by_role('button', name='Restore Account').is_visible()
    w.locator('.window-title').dblclick()
    assert rect(w) == free, ('double click restores', rect(w), free)
    saved = json.loads(page.evaluate(f"localStorage.getItem('dh_toolkit_windows:{USER}')"))
    assert saved['account']['w'] == 560 and saved['account']['zone'] is None, saved
    page.reload(); page.wait_for_function(WAIT_SIGNED)
    w = open_app(page, 'account')
    assert rect(w) == free, ('geometry survives a reload', rect(w), free)
    pdf = open_app(page, 'pdf')
    z = lambda loc: int(loc.evaluate('n => getComputedStyle(n).zIndex'))
    assert z(pdf) > z(w)
    page.locator('[data-launch="account"]').click()
    assert z(w) > z(pdf) and w.get_attribute('data-focused') == 'true', 'opening an open app raises its window'
    close_app(page, 'ChamPDF'); close_app(page, 'Account')
    page.evaluate(f"localStorage.removeItem('dh_toolkit_windows:{USER}')")

def label_checks(page, width):
    """Desktop labels break only between words (spaces or hyphens); app and folder names are never clipped."""
    rows = page.evaluate("""() => [...document.querySelectorAll('.desk-icon:not([hidden]) .desk-label')].filter(l => l.checkVisibility()).map(l => {
      const r = document.createRange(); r.selectNodeContents(l);
      const box = l.getBoundingClientRect(), tops = new Set([...r.getClientRects()].filter(x => x.width > 0 && x.bottom <= box.bottom + 1).map(x => Math.round(x.top)));
      return [l.textContent, tops.size, l.textContent.trim().split(/[\\s-]+/).length, l.scrollWidth - l.clientWidth, l.classList.contains('desk-file')];
    })""")
    assert rows, ('no desktop labels', width)
    # Lines are counted inside the label box, so a long file name clamped to 2 lines with an ellipsis counts as 2.
    # Only app and folder labels must fit sideways; a user file name may clamp with an ellipsis.
    bad = [r for r in rows if r[1] > r[2] or (r[3] > 0 and not r[4])]
    assert not bad, ('desktop label breaks inside a word or clips', width, bad)

def cells(page):
    return page.evaluate("[...document.querySelectorAll('.desk-icon:not([hidden])')].map(d=>[d.dataset.desktop, d.dataset.cell, d.style.left, d.style.top])")

def icon_checks(page):
    """Icons land on the grid, never share a cell, keep their cell per user, and arrows walk them."""
    def center(sel):
        b = page.locator(sel).bounding_box(); return (b['x']+b['width']/2, b['y']+b['height']/2)
    start = center('[data-desktop="pdf"]')
    drag(page, start, (start[0]+250, start[1]+30))
    assert page.locator('[data-app="pdf"]').count() == 0, 'dragging does not open'
    c = cells(page)
    for key, cell, left, top in c:
        col, row = map(int, cell.split(','))
        assert (left, top) == (f'{col*100}px', f'{row*120}px'), ('icon off the grid', key, cell, left, top)
    assert len({x[1] for x in c}) == len(c), ('icons share a cell', c)
    moved = dict((k, v) for k, v, *_ in c)['pdf']
    # Dropped on an occupied cell, the icon takes the nearest free one.
    occupied = center('[data-desktop="workbench"]'); now = center('[data-desktop="pdf"]')
    drag(page, now, (occupied[0]+3, occupied[1]+3))
    c = cells(page); cellmap = dict((k, v) for k, v, *_ in c)
    assert cellmap['pdf'] != cellmap['workbench'] and len({x[1] for x in c}) == len(c), ('overlap on drop', c)
    page.screenshot(path=str(OUT/'icons-grid-1440.png'))
    saved = json.loads(page.evaluate(f"localStorage.getItem('dh_toolkit_icons:{USER}')"))
    assert ','.join(map(str, saved['pdf'])) == cellmap['pdf'], (saved, cellmap)
    page.reload(); page.wait_for_function(WAIT_SIGNED)
    assert dict((k, v) for k, v, *_ in cells(page))['pdf'] == cellmap['pdf'], 'cell survives a reload'
    page.evaluate(f"localStorage.removeItem('dh_toolkit_icons:{USER}')")
    page.reload(); page.wait_for_function(WAIT_SIGNED)
    page.locator('[data-desktop="workbench"]').focus(); page.keyboard.press('ArrowDown')
    assert page.evaluate("document.activeElement.dataset.desktop") == 'enrich', 'Deep Enrich sits right after Data Workbench'
    assert [b.get_attribute('data-launch') for b in page.locator('#app-launcher > button').all()][:3] == ['workbench', 'enrich', 'files']
    assert page.locator('[data-launch="scanner"],[data-desktop="scanner"]').count() == 0, 'Deep Scanner is gone'
    return moved

def drop_checks(page):
    """An OS file dropped on the desktop is saved to / and opens in the Workbench; a file icon dragged onto the Workbench loads."""
    page.evaluate(DROP, ['.desktop', 'dropped.csv', 'Name,Email\nAda,ada@example.com\nBo,bo@example.com\n', ['dragenter', 'dragover']])
    assert page.locator('main#main').get_attribute('data-drop') == 'true'
    page.evaluate(DROP, ['.desktop', 'dropped.csv', 'Name,Email\nAda,ada@example.com\nBo,bo@example.com\n', ['drop']])
    wb = page.locator('[data-app="workbench"]')
    wb.get_by_text('2 rows loaded in your browser. Nothing is sent until you approve a run.', exact=True).wait_for()
    assert page.locator('main#main').get_attribute('data-drop') is None
    assert wb.locator('.table-scroll tbody tr').count() == 2 and 'ada@example.com' in wb.inner_text()
    page.locator('.desk-icon[aria-label^="dropped.csv"]').wait_for()
    assert [f['path'] for f in state()['v4']['files']] == ['/dropped.csv'], state()['v4']['files']
    page.evaluate(DROP, ['[data-app="workbench"] .dropzone', 'x.csv', 'a', ['dragover']])
    zone = wb.locator('.dropzone')
    assert zone.get_attribute('data-over') == 'true' and zone.evaluate("n => getComputedStyle(n).borderTopStyle") == 'solid'
    zone.screenshot(path=str(OUT/'drop-hover-workbench.png'))
    page.evaluate(DROP, ['[data-app="workbench"] .dropzone', 'x.csv', 'a', ['dragleave']])
    assert zone.get_attribute('data-over') == 'false'
    assert page.evaluate("""() => { const dt = new DataTransfer(); dt.setData('text/plain', 'hello');
      const e = new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer: dt});
      document.querySelector('[data-app="workbench"] .window-body').dispatchEvent(e); return e.defaultPrevented; }""") is False, 'text drop cancelled'
    close_app(page, 'Data Workbench')
    wb = open_app(page, 'workbench')
    b = page.locator('.desk-icon[aria-label^="dropped.csv"]').bounding_box(); target = wb.locator('.dropzone').bounding_box()
    drag(page, (b['x']+b['width']/2, b['y']+30), (target['x']+80, target['y']+40))
    wb.get_by_text('2 rows loaded in your browser', exact=False).wait_for()
    close_app(page, 'Data Workbench')

def files_checks(page, width):
    """Folders, new folder, rename, move by drag, delete with confirm, download."""
    f = open_app(page, 'files')
    f.locator('.file-row').first.wait_for()
    capture(page, f'files-root-{width}')
    f.get_by_role('button', name='New folder', exact=True).click()
    f.get_by_label('New folder name').fill('Leads')
    f.get_by_role('button', name='Create folder').click()
    f.get_by_text('Created Leads.').wait_for()
    folder = f.locator('.file-row[data-kind="folder"]', has_text='Leads')
    page.locator('.desk-icon[aria-label^="Leads"]').wait_for()
    page.drag_and_drop('[data-app="files"] .file-row[data-kind="file"]', '[data-app="files"] .file-row[data-kind="folder"]')
    f.get_by_text('Moved dropped.csv to /Leads.').wait_for()
    assert '/Leads/dropped.csv' in [x['path'] for x in state()['v4']['files']]
    expect(page.locator('.desk-icon[aria-label^="dropped.csv"]'), 'a moved file leaves the desktop').to_have_count(0)
    folder.get_by_role('button', name='Open folder Leads').click()
    row = f.locator('.file-row', has_text='dropped.csv'); row.wait_for()
    expect(f.locator('[aria-current="location"]')).to_have_text('Leads')
    row.get_by_role('button', name='Rename dropped.csv').click()
    f.get_by_label('New name for dropped.csv').fill('renamed.csv')
    f.get_by_role('button', name='Save name').click()
    f.get_by_text('Renamed to renamed.csv.').wait_for()
    with page.expect_download() as dl:
        f.get_by_role('button', name='Download renamed.csv').click()
    assert pathlib.Path(dl.value.path()).read_text().startswith('Name,Email'), 'download streams the stored bytes'
    capture(page, f'files-folder-{width}')
    f.get_by_role('button', name='Delete renamed.csv').click()
    f.get_by_role('alertdialog').get_by_text('Delete renamed.csv? This cannot be undone.').wait_for()
    capture(page, f'files-confirm-{width}')
    f.get_by_role('button', name='Delete for good').click()
    f.get_by_text('Deleted renamed.csv.').wait_for()
    assert [x['path'] for x in state()['v4']['files']] == ['/Leads']
    f.get_by_role('button', name='Files', exact=True).click()
    f.locator('.file-row', has_text='Leads').get_by_role('button', name='Delete Leads').click()
    f.get_by_role('button', name='Delete for good').click()
    f.get_by_text('Deleted Leads.').wait_for()
    assert state()['v4']['files'] == []
    page.wait_for_function("!document.querySelector('.desk-icon[aria-label^=\"Leads\"]')")
    close_app(page, 'Files')

ONE_STAGE = """() => { const w = document.querySelector('[data-app="workbench"]'); const on = [...w.querySelectorAll('.stage')].filter(s => !s.hidden && s.checkVisibility());
  const cur = w.querySelector('.step-btn[aria-current="step"] .step-name'); return [on.map(s => s.dataset.stage), cur && cur.textContent]; }"""

def stage_is(page, name):
    """Exactly one stage's content is on screen, and it is the stage the stepper marks current."""
    page.wait_for_function("n => { const s = [...document.querySelectorAll('[data-app=workbench] .stage')].filter(x => !x.hidden); return s.length === 1 && s[0].dataset.stage === n; }", arg=name.lower())
    assert page.evaluate(ONE_STAGE) == [[name.lower()], name], page.evaluate(ONE_STAGE)

def workbench_flow(page, width, rows, calls):
    """Six stages: File, Columns, Ask, Quote, Run, Report. One stage on screen at a time, Back works, results saved to Files."""
    w = open_app(page, 'workbench')
    stage_is(page, 'File')
    capture(page, f'workbench-0-empty-{width}')
    page.set_input_files('#wb-file', {'name': 'leads.csv', 'mimeType': 'text/csv', 'buffer': csv(rows)})
    w.get_by_text(f'{rows} rows loaded in your browser. Nothing is sent until you approve a run.', exact=True).wait_for()
    assert [t.inner_text() for t in w.locator('.file-info th').all()] == ['PERSON NAME', 'COMPANY NAME', 'WORK EMAIL', 'JOB']
    capture(page, f'workbench-1-file-{width}')
    page.locator('#wb-to-columns').click(); stage_is(page, 'Columns')
    assert w.locator('.map-row').count() == 4 and w.locator('.map-row[data-source="Job"] .pb-samples li').first.inner_text() == 'VP Sales'
    w.get_by_label('Field for Job', exact=True).select_option('title')
    w.get_by_label('Keep Work Email', exact=True).uncheck()
    assert w.locator('.map-row[data-source="Work Email"]').get_attribute('data-keep') == 'false'
    capture(page, f'workbench-2-columns-{width}')
    w.get_by_role('button', name='Back', exact=True).click(); stage_is(page, 'File')
    w.get_by_role('button', name='2. Columns', exact=True).click(); stage_is(page, 'Columns')
    page.locator('#wb-confirm').click(); stage_is(page, 'Ask')
    assert w.get_by_text('We keep your instructions and the AI conversation (never your cell values) to improve the toolkit.', exact=True).is_visible()
    assert [c.inner_text() for c in w.locator('.chips .chip').all()] == ['Enrichment', 'Title normalization', 'Categorization', 'Classification', 'Email verification', 'Company research']
    calls.clear()
    w.get_by_role('button', name='Categorization', exact=True).click()
    w.get_by_text('Do you also want to know whether each company sells to businesses?').wait_for()
    intake = [c for c in calls if c['action'] == 'intake'][-1]
    assert intake['goal'] == 'Categorization' and intake['history'] == [] and intake['file']['rows_total'] == rows
    assert all(len(v) <= 5 and all(len(s) <= 200 for s in v) for v in intake['file']['samples'].values())
    expect(w.locator('.op-card')).to_have_count(1)
    assert w.locator('.model-badge').inner_text() and 'Assistant cost so far: ' in w.locator('.pb-cost').inner_text()
    w.get_by_role('button', name='Yes, add that', exact=True).click()
    w.get_by_text('I added a yes or no check', exact=False).wait_for()
    second = [c for c in calls if c['action'] == 'intake'][-1]
    assert [h['role'] for h in second['history']] == ['assistant', 'user'] and second['goal'] == 'Categorization'
    expect(w.locator('.op-card'), 'the second turn updated the plan').to_have_count(2)
    assert all(b.inner_text() for b in w.locator('.op-card .engine-badge').all())
    capture(page, f'workbench-3-ask-{width}')
    # Edit the plan: add, change and remove an operation.
    w.get_by_role('button', name='Add operation', exact=True).click()
    op = w.locator('.op-card').nth(2)
    op.get_by_label('Operation', exact=True).select_option('normalize_title')
    op = w.locator('.op-card').nth(2)
    assert op.get_by_label('Engine', exact=True).locator('option').all_inner_texts() == ['Jev (fast, cheap labels)', 'DeepSeek (research and reasoning)']
    op.get_by_role('button', name='Remove operation 3').click()
    assert w.locator('.op-card').count() == 2
    calls.clear()
    page.locator('#wb-quote').click()
    stage_is(page, 'Quote')
    page.wait_for_selector('#wb-run:not([disabled])')
    quotes = [c for c in calls if c['action'] == 'quote']
    chunks = -(-rows // 100)
    assert len(quotes) == 1 and len(quotes[0]['rows']) == rows and all('Work Email' not in r for r in quotes[0]['rows']), 'one quote covers the whole job and skips Work Email'
    text = w.locator('[data-stage="quote"]').inner_text()
    assert 'Up to' in text and 'left today' in text and f'{rows} rows in {chunks} chunk' in text, text
    assert 'Jev (fast, cheap labels)' in text
    capture(page, f'workbench-4-quote-{width}')
    before = len(state()['runs'])
    page.locator('#wb-run').click()
    w.get_by_text('Saved to Files: /Workbench results/leads ', exact=False).wait_for(timeout=60000)
    stage_is(page, 'Report')
    runs = state()['runs'][before:]
    assert len(runs) == chunks and sum(r['row_count'] for r in runs) == rows and all(r['status'] == 'completed' for r in runs), runs
    chunk_calls = [c for c in calls if c['action'] == 'run']
    assert len({c['job_id'] for c in chunk_calls}) == 1 and [c['chunk_index'] for c in chunk_calls] == list(range(chunks)) and {c['chunk_count'] for c in chunk_calls} == {chunks}, 'one job_id, ordered chunks'
    assert f'{rows} of {rows} rows done' in w.locator('.run-line').inner_text()
    assert w.locator('.trace li[data-state="completed"]').count() == chunks
    saved = [x for x in state()['v4']['files'] if x['path'].startswith('/Workbench results/leads ')]
    assert saved, state()['v4']['files']
    assert w.locator('.rp-card').count() >= 3
    with page.expect_download() as dl:
        w.get_by_role('button', name='Download CSV', exact=True).click()
    out = pathlib.Path(dl.value.path()).read_text()
    assert out.count('\n') >= rows and 'SaaS' in out and 'Person 0' in out
    capture(page, f'workbench-5-report-{width}')
    w.get_by_role('button', name='5. Run, done').click(); stage_is(page, 'Run')
    capture(page, f'workbench-run-{width}')
    close_app(page, 'Data Workbench')

def enrich_flow(page, width):
    w = open_app(page, 'enrich')
    capture(page, f'enrich-1-file-{width}')
    page.set_input_files('#en-file', {'name': 'contacts.csv', 'mimeType': 'text/csv', 'buffer': csv(3)})
    w.get_by_text('3 rows loaded in your browser', exact=False).wait_for()
    assert w.get_by_label('Email column', exact=True).input_value() == 'Work Email'
    w.get_by_text('Email check', exact=True).click()
    capture(page, f'enrich-2-pick-{width}')
    page.locator('#en-quote').click()
    page.wait_for_selector('#en-run:not([disabled])')
    assert 'Treg (contact data)' in w.inner_text()
    capture(page, f'enrich-3-quote-{width}')
    page.locator('#en-run').click()
    w.get_by_text('Saved to Files: /Workbench results/contacts ', exact=False).wait_for(timeout=30000)
    assert 'deliverable' in w.inner_text() or 'valid' in w.inner_text()
    capture(page, f'enrich-4-results-{width}')
    close_app(page, 'Deep Enrich')

def admin_checks(page, width):
    w = open_app(page, 'admin')
    w.get_by_role('button', name='Save default allowances').wait_for()
    capture(page, f'admin-limits-{width}')
    w.get_by_role('button', name='Save default allowances').click()
    w.get_by_text('Default allowances saved and read back.').wait_for()
    w.get_by_role('tab', name='Users').click()
    link = w.get_by_role('link', name='Manage in Clerk')
    assert link.get_attribute('href') == 'https://dashboard.clerk.com/' and link.get_attribute('target') == '_blank'
    w.get_by_role('button', name='Save user').first.wait_for()
    capture(page, f'admin-users-{width}')
    w.get_by_role('tab', name='Models').click()
    intake = w.get_by_label('Intake model (the chat that plans a job)')
    intake.wait_for()
    assert 'per 1M tokens' in intake.inner_text()
    w.get_by_label('Search models for intake model').fill('gpt')
    ids = [o.split(' / ')[0].strip() for o in intake.locator('option').all_inner_texts()]
    assert ids == ['deepseek/deepseek-v4.1-flash', 'openai/gpt-5-mini'], ('search keeps the current pick plus matches', ids)
    intake.select_option('openai/gpt-5-mini')
    capture(page, f'admin-models-{width}')
    w.get_by_role('button', name='Save models').click()
    w.get_by_text('Models saved and read back.').wait_for()
    assert state()['v4']['settings']['intake_model'] == 'openai/gpt-5-mini'
    w.get_by_text('Current: openai/gpt-5-mini', exact=False).first.wait_for()
    w.get_by_role('tab', name='AI log').click()
    w.get_by_role('region', name='AI log').wait_for()
    w.get_by_label('Action', exact=True).select_option('intake')
    w.get_by_role('button', name='Apply filters').click()
    w.get_by_role('region', name='AI log').locator('tbody tr').first.wait_for()
    page.wait_for_function("[...document.querySelectorAll('[data-app=admin] .table-scroll[aria-label^=AI] tbody tr')].every(r => r.children[2].textContent === 'intake')")
    capture(page, f'admin-log-{width}')
    with page.expect_download() as dl:
        w.get_by_role('button', name='Export JSONL').click()
    lines = [json.loads(l) for l in pathlib.Path(dl.value.path()).read_text().splitlines() if l]
    assert any(l['action'] == 'intake' for l in lines), lines[:2]
    assert not any(v in l['prompt'] + l['response'] for l in lines for v in ('Person 0', 'p0@example.com', 'Acme 1')), 'cell values never reach the AI log'
    close_app(page, 'Admin')

def refresh_checks(page, token):
    """Sign-out empties the desktop, in-page sign-in and Refresh connection repaint it without a reload."""
    page.evaluate("window.__noReload = true")
    page.get_by_role('button', name='Sign out', exact=True).click()
    page.wait_for_function("document.querySelector('#daily').textContent === 'Unavailable'")
    expect(page.locator('.desk-icon[data-desktop^="file:"]')).to_have_count(0)
    expect(page.locator('[data-launch="admin"]')).to_be_hidden()
    expect(page.locator('#session-status')).to_contain_text('Signed out')
    page.evaluate("Clerk.openSignIn()")
    page.wait_for_function(WAIT_SIGNED)
    page.locator('[data-launch="admin"]').wait_for(state='visible')
    page.locator('.desk-icon[data-desktop^="file:"]').first.wait_for()
    assert page.locator('#session-status').get_attribute('data-state') == 'ok'
    # A file saved elsewhere appears after Refresh connection.
    page.request.post(BRIDGE+'/api/toolkit', headers={'Authorization': 'Bearer '+token, 'content-type': 'application/json'},
        data=json.dumps({'action': 'files_put', 'folder': '/', 'name': 'from-elsewhere.csv', 'mime': 'text/csv', 'content_base64': 'YSxiCjEsMgo='}))
    page.locator('#retry-session').click()
    page.locator('.desk-icon[aria-label^="from-elsewhere.csv"]').wait_for()
    assert page.evaluate("window.__noReload") is True, 'no page reload'

def verify():
    reset()
    token = json.load(urllib.request.urlopen(BRIDGE+'/fixture/token'))['token']
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # The toolkit is dark only: the OS asks for light and a stale site preference says light, the pages stay dark.
        context = browser.new_context(viewport={'width': 1440, 'height': 1000}, color_scheme='light', reduced_motion='reduce', accept_downloads=True)
        context.add_init_script("try{localStorage.setItem('dh_scheme','light')}catch(_){}")
        page = context.new_page()
        errors, calls = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and not m.text.startswith('Failed to load resource:') else None)
        def clerk(route):
            response = route.fetch()
            route.fulfill(response=response, body=response.text().replace('FIXTURE_SESSION_TOKEN', token))
        def api(route):
            req = route.request
            if req.method == 'POST':
                calls.append(json.loads(req.post_data or '{}'))
            response = page.request.fetch(BRIDGE+req.url[len(BASE):], method=req.method, headers=req.headers, data=req.post_data_buffer)
            route.fulfill(status=response.status, headers={'content-type': response.headers.get('content-type', 'application/json')}, body=response.body())
        page.route('**/fixture/clerk.js', clerk)
        page.route('**/api/toolkit', api)
        page.route('**/api/toolkit/files/**', api)
        page.route(BASE+'/', lambda r: r.fulfill(path=str(ROOT/'toolkit-app.html'), content_type='text/html'))
        page.route(BASE+'/sign-in', lambda r: r.fulfill(path=str(ROOT/'toolkit-signin.html'), content_type='text/html'))
        for host in ('https://www.champbeam.com/**', 'https://champdf.com/**'):
            page.route(host, lambda r: r.fulfill(content_type='text/html', body='<p>External app fixture. Live session not tested.</p>'))
        page.goto(BASE+'/')
        page.wait_for_function(WAIT_SIGNED)
        page.locator('#recent-runs').get_by_text('No runs yet', exact=True).wait_for()
        icon = page.locator('[data-desktop="account"]')
        icon.click()
        assert icon.get_attribute('data-selected') == 'true' and page.locator('[data-app="account"]').count() == 0
        icon.dblclick(); page.locator('[data-app="account"]').wait_for(); close_app(page, 'Account')
        page.locator('[data-desktop="pdf"]').focus(); page.keyboard.press('Enter')
        page.locator('[data-app="pdf"]').wait_for(); close_app(page, 'ChamPDF')
        window_checks(page)
        icon_checks(page)
        drop_checks(page)
        files_checks(page, 1440)
        reset()
        page.reload(); page.wait_for_function(WAIT_SIGNED)
        workbench_flow(page, 1440, 250, calls)
        enrich_flow(page, 1440)
        refresh_checks(page, token)
        admin_checks(page, 1440)
        for width in (375, 390, 768, 1280, 1440, 1600):
            page.set_viewport_size({'width': width, 'height': 1000})
            capture(page, f'desktop-{width}')
            label_checks(page, width)
        page.set_viewport_size({'width': 390, 'height': 900})
        for app, name in [('beam', 'ChampBeam'), ('pdf', 'ChamPDF'), ('account', 'Account')]:
            w = open_app(page, app)
            if app == 'account': w.get_by_role('heading', name='Run history').wait_for()
            else: assert w.get_by_role('link', name='Open in new tab').get_attribute('target') == '_blank'
            fixed = rect(w); drag(page, title_point(w), (200, 400))
            assert rect(w) == fixed and fixed['x'] == 0 and fixed['y'] == 0, ('phone windows fill the screen and do not drag', fixed)
            capture(page, f'{app}-390')
            page.get_by_role('button', name='Minimize '+name, exact=True).click(); assert w.is_hidden()
            open_app(page, app); assert w.is_visible(); close_app(page, name)
        reset(); page.reload(); page.wait_for_function(WAIT_SIGNED)
        page.evaluate(DROP, ['.desktop', 'dropped.csv', 'Name,Email\nAda,ada@example.com\nBo,bo@example.com\n', ['dragover', 'drop']])
        page.locator('[data-app="workbench"]').get_by_text('2 rows loaded', exact=False).wait_for(); close_app(page, 'Data Workbench')
        files_checks(page, 390)
        workbench_flow(page, 390, 5, calls)
        enrich_flow(page, 390)
        admin_checks(page, 390)
        # File error states are local and never call a provider.
        reset()
        w = open_app(page, 'workbench')
        for name, body, message in [('empty.csv', b'Email\n', 'no data rows'), ('bad.exe', b'bad', 'Choose a CSV or XLSX')]:
            page.set_input_files('#wb-file', {'name': name, 'mimeType': 'text/plain', 'buffer': body})
            w.get_by_text(message, exact=False).wait_for()
            capture(page, f'{name}-390')
        assert not state()['provider_calls']
        close_app(page, 'Data Workbench')
        # Daily cap: the quote names the cap and refuses to run.
        urllib.request.urlopen(BRIDGE+'/fixture/cap').read()
        page.set_viewport_size({'width': 1440, 'height': 1000})
        w = open_app(page, 'enrich')
        page.set_input_files('#en-file', {'name': 'contacts.csv', 'mimeType': 'text/csv', 'buffer': csv(2)})
        page.locator('#en-quote').click()
        page.wait_for_selector('#en-run[disabled]')
        assert 'Your daily limit is $0.00' in w.inner_text(), w.inner_text()[-400:]
        capture(page, 'cap-1440')
        close_app(page, 'Deep Enrich')
        reset()
        # Sign-in reads as a page of deependhq.com: marigold primary, ink text, card ground, Inter, 6px corners.
        for width in (390, 1440):
            page.set_viewport_size({'width': width, 'height': 1000})
            page.get_by_role('button', name='Sign out', exact=True).click()
            page.get_by_role('link', name='Sign in', exact=True).click()
            page.wait_for_selector('[data-fixture="signin"]')
            look = json.loads(page.locator('#toolkit-signin-root').get_attribute('data-appearance'))
            assert {k: look.get(k) for k in ('colorPrimary', 'colorPrimaryForeground', 'colorBackground', 'colorText', 'borderRadius')} == {'colorPrimary': '#C9A84C', 'colorPrimaryForeground': '#0D0F14', 'colorBackground': '#181C26', 'colorText': '#E8E4DC', 'borderRadius': '6px'}, look
            assert 'Inter' in look.get('fontFamily', ''), look
            capture(page, f'signin-{width}')
            page.get_by_role('button', name='Continue with Google (fixture)').click()
            page.wait_for_function(WAIT_SIGNED)
        page.request.post(BASE+'/fixture/config', data={'configured': 0})
        page.goto(BASE+'/sign-in')
        page.get_by_text('Setup needed.', exact=False).wait_for()
        for width in (390, 1440):
            page.set_viewport_size({'width': width, 'height': 1000})
            capture(page, f'setup-{width}')
        page.request.post(BASE+'/fixture/config', data={'configured': 1})
        assert not errors, errors
        context.close()
        browser.close()
    (OUT/'report.json').write_text(json.dumps(reports, indent=2))
    table = sorted(contrast_rows.values(), key=lambda r: r['ratio'])
    (OUT/'contrast.json').write_text(json.dumps(table, indent=2))
    pairs = {}
    for r in table:
        k = (r['fg'], r['bg'])
        if k not in pairs or r['ratio'] < pairs[k]['ratio']: pairs[k] = r
    print(f'Text contrast: {len(table)} distinct text/ground nodes, {len(pairs)} colour pairs, every one at or above its threshold.')
    for (fg, bg), r in sorted(pairs.items(), key=lambda kv: kv[1]['ratio'])[:8]:
        print(f'  {fg} on {bg}: {r["ratio"]}:1 (min {r["min"]}, e.g. {r["tag"]} {r["text"][:24]!r} at {r["size"]})')
    print(f'PASS: V4 toolkit browser flows; {len(reports)} audited screenshots; zero JS errors. Real V4 handler with fixture providers; live Clerk and embedded sessions not tested.')

if __name__ == '__main__':
    verify()
