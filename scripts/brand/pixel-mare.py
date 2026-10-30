#!/usr/bin/env python3
"""pixel-mare.py : the gray mare as 32x32 pixel art for the toolkit guide.

    python3 scripts/brand/pixel-mare.py            render brand/pixel-mare.svg and the badge from the JSON
    python3 scripts/brand/pixel-mare.py --trace    re-trace brand/mare.svg into brand/pixel-mare.json first

brand/pixel-mare.json is the source of truth: four frames (idle, blink, think,
point), each 32 strings of 32 characters, one character per cell:

    .  transparent    i  ink #0E1A33    p  paper #F4EBD9    m  mare #A9ABA6    l  lamp #F4A62A

Edit cells by hand and rerun without --trace. --trace overwrites hand edits.

Tracing: Chromium (Python playwright) draws brand/mare.svg onto a canvas at 16
samples per cell. Each sample snaps to the nearest palette colour (or transparent
below half alpha) and each cell takes its majority colour, with two rules that
keep the art readable at 32px: lamp wins a cell at a third of its samples, so
the face blaze survives, and every opaque cell touching transparency becomes
ink, so the silhouette keeps its outline. The badge traces the head alone onto
a paper disc with a one-cell ink ring, the brandmark's geometry; lamp is not
allowed on paper (1.72:1), so on the badge the blaze is drawn in ink.
No em dashes.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'brand', 'mare.svg')
JSON_PATH = os.path.join(ROOT, 'brand', 'pixel-mare.json')
SPRITE = os.path.join(ROOT, 'brand', 'pixel-mare.svg')
BADGE = os.path.join(ROOT, 'brand', 'pixel-mare-badge.svg')
N = 32
PALETTE = {'i': '#0E1A33', 'p': '#F4EBD9', 'm': '#A9ABA6', 'l': '#F4A62A'}
FRAMES = ('idle', 'blink', 'think', 'point')
SPRITE_CROP = (.5, .44)   # fraction of the source width and height kept for the sprite bust
BADGE_CROP = (.46, .4)    # and for the badge head

TRACE_JS = """async ([src, box, n, k]) => {
  const img = new Image(); img.src = src; await img.decode();
  const [x0, y0, w, h, dx, dy, dw, dh] = box, c = document.createElement('canvas'); c.width = c.height = n * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
  g.drawImage(img, x0, y0, w, h, dx * k, dy * k, dw * k, dh * k);
  const d = g.getImageData(0, 0, n * k, n * k).data;
  const pal = {i: [14, 26, 51], p: [244, 235, 217], m: [169, 171, 166], l: [244, 166, 42]};
  const near = (r, gg, b) => Object.entries(pal).sort((a, z) => ((a[1][0]-r)**2 + (a[1][1]-gg)**2 + (a[1][2]-b)**2) - ((z[1][0]-r)**2 + (z[1][1]-gg)**2 + (z[1][2]-b)**2))[0][0];
  const rows = [];
  for (let cy = 0; cy < n; cy++) { let row = '';
    for (let cx = 0; cx < n; cx++) { const t = {'.': 0, i: 0, p: 0, m: 0, l: 0};
      for (let sy = 0; sy < k; sy++) for (let sx = 0; sx < k; sx++) { const o = ((cy * k + sy) * n * k + cx * k + sx) * 4; t[d[o + 3] < 128 ? '.' : near(d[o], d[o + 1], d[o + 2])]++; }
      row += t.l * 3 >= k * k ? 'l' : Object.entries(t).sort((a, z) => z[1] - a[1])[0][0]; }
    rows.push(row); }
  return rows;
}"""


def outline(rows):
    """Every opaque cell that touches transparency or the edge becomes ink."""
    g = [list(r) for r in rows]
    out = [r[:] for r in g]
    for y in range(N):
        for x in range(N):
            if g[y][x] == '.':
                continue
            nb = [g[y + dy][x + dx] if 0 <= y + dy < N and 0 <= x + dx < N else '.' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if '.' in nb:
                out[y][x] = 'i'
    return [''.join(r) for r in out]


def stamp(rows, cells, ch):
    g = [list(r) for r in rows]
    for x, y in cells:
        g[y][x] = ch
    return [''.join(r) for r in g]


def trace():
    from playwright.sync_api import sync_playwright
    import base64
    svg = open(SRC).read()
    vx, vy, vw, vh = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    w, h = int(re.search(r'width="([\d.]+)"', svg).group(1)), int(re.search(r'height="([\d.]+)"', svg).group(1))
    src = 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode()).decode()
    # The source is the whole mare in stride; at 32 cells only the head and neck read, so both traces crop to the bust.
    # Sprite: bust in the bottom left 24 cells, leaving the top rows for the think dots and the right columns for the arrow.
    bust = [0, 0, w * SPRITE_CROP[0], h * SPRITE_CROP[1]]
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        idle = outline(pg.evaluate(TRACE_JS, [src, bust + [0, N - 24, 24, 24], N, 16]))
        # Badge: a tighter crop of the head, centred in the disc.
        head = outline(pg.evaluate(TRACE_JS, [src, [0, 0, w * BADGE_CROP[0], h * BADGE_CROP[1]] + [4, 5, 24, 24], N, 16]))
        b.close()
    return idle, head


def frames_from(idle):
    """Starting points for the other frames; hand-tune them in the JSON."""
    lamp = [(x, y) for y, r in enumerate(idle) for x, c in enumerate(r) if c == 'l']
    blink = stamp(idle, lamp, 'i') if lamp else idle  # the lit eye closes to an ink line
    think = stamp(idle, [(15, 7), (18, 5), (21, 3)], 'l')  # three dots rising beside the head
    arrow = [(x, 16) for x in range(24, 30)] + [(29, 14), (29, 15), (30, 15), (30, 16), (31, 16), (29, 17), (30, 17), (29, 18)]
    point = stamp(idle, arrow, 'l')  # a lamp arrow off to the right at eye height
    return {'idle': idle, 'blink': blink, 'think': think, 'point': point}


def runs(rows, ch):
    """Absolute integer rectangles, one per horizontal run of ch."""
    out = []
    for y, r in enumerate(rows):
        x = 0
        while x < N:
            if r[x] != ch:
                x += 1; continue
            s = x
            while x < N and r[x] == ch:
                x += 1
            out.append(f'M{s} {y}H{x}V{y + 1}H{s}Z')
    return ''.join(out)


def paths(rows, keep=PALETTE):
    return ''.join(f'<path fill="{hexv}" d="{runs(rows, ch)}"/>' for ch, hexv in keep.items() if runs(rows, ch))


def check(data):
    assert set(data['frames']) == set(FRAMES), 'exactly four frames'
    for name, rows in list(data['frames'].items()) + [('badge', data['badge'])]:
        assert len(rows) == N and all(len(r) == N and set(r) <= set('.' + ''.join(PALETTE)) for r in rows), name
    assert 'l' not in ''.join(data['badge']), 'lamp never sits on the paper badge'


def render(data):
    check(data)
    symbols = ''.join(f'<symbol id="mare-{f}" viewBox="0 0 {N} {N}">{paths(data["frames"][f])}</symbol>' for f in FRAMES)
    sprite = (f'<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 {N} {N}">'
              f'<title>Pixel mare, four frames: idle, blink, think, point</title>{symbols}<use href="#mare-idle"/></svg>\n')
    open(SPRITE, 'w').write(sprite)
    open(BADGE, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" viewBox="0 0 {N} {N}">'
                           f'<title>Toolkit guide</title>{paths(data["badge"])}</svg>\n')


def disc(head):
    """Paper disc with a one-cell ink ring (radius 16 on the 32 grid), the head inside, lamp turned to ink.
    The head is cut one cell inside the ring and re-outlined, so a clean paper band runs all the way round."""
    c = (N - 1) / 2
    dist = lambda x, y: ((x - c) ** 2 + (y - c) ** 2) ** .5
    head = outline([''.join(head[y][x] if dist(x, y) <= 13.4 else '.' for x in range(N)) for y in range(N)])
    rows = []
    for y in range(N):
        row = ''
        for x in range(N):
            d = dist(x, y)
            if d > 15.6:
                row += '.'
            elif d > 14.4:
                row += 'i'
            else:
                v = head[y][x]
                row += 'p' if v == '.' else 'i' if v == 'l' else v
        rows.append(row)
    return rows


if __name__ == '__main__':
    if '--trace' in sys.argv:
        idle, head = trace()
        data = {'note': 'Cells: . transparent, i ink #0E1A33, p paper #F4EBD9, m mare #A9ABA6, l lamp #F4A62A. Hand-edit, then run scripts/brand/pixel-mare.py.',
                'palette': PALETTE, 'frames': frames_from(idle), 'badge': disc(head)}
        open(JSON_PATH, 'w').write(json.dumps(data, indent=1) + '\n')
    data = json.load(open(JSON_PATH))
    render(data)
    print('wrote', os.path.relpath(SPRITE, ROOT), 'and', os.path.relpath(BADGE, ROOT), 'from', os.path.relpath(JSON_PATH, ROOT))
