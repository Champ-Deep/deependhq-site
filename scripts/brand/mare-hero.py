#!/usr/bin/env python3
"""mare-hero.py : build brand/mare-hero.svg, the gray mare at speed for the hero.

    python3 scripts/brand/mare-hero.py        (after build-brand.mjs)

Input is brand/mare-sticker.svg: the cream die-cut halo keeps her navy outline
visible on the navy hero. The kit mare faces left, so the speed smear trails
off her back to the RIGHT (the plan sketched it to the left for the braille
mare, who faced right). The viewBox grows to the right by 1.6 times her width,
which lands at about 2.3:1, the same box the braille block used.

The smear: render her silhouette at 1024px tall, then for bands of 1 to 3 rows
of 12px, start at the trailing (rightmost) filled pixel and run a rounded
streak away from her for a seeded 35 to 90 percent of her width. The first 55
percent of each run is near solid; after that it breaks into thinning dashes.
Three bands shift sideways by 2 to 5 rows as torn slices. Streaks are --line-2
(#434E64), every fifth one --line (#303C53), and the far end fades out through
a gradient mask (transparent at the far edge, opaque from 34 percent in).

Seeded (random.seed(1878), Muybridge's year), so the file is reproducible.
Rasterising needs Chromium through the Python playwright package; set
CHROME_BIN when the default browser is not installed. No em dashes.
"""
import io, os, random, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'brand', 'mare-sticker.svg')
OUT = os.path.join(ROOT, 'brand', 'mare-hero.svg')

random.seed(1878)
svg = open(SRC).read()
vx, vy, vw, vh = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
inner = re.sub(r'^[\s\S]*?<svg[^>]*>', '', svg)
inner = re.sub(r'</svg>\s*$', '', inner)
inner = re.sub(r'<title>[\s\S]*?</title>', '', inner)

# ---- silhouette raster -------------------------------------------------------
from PIL import Image
from playwright.sync_api import sync_playwright

RH = 1024
RW = int(round(RH * vw / vh))
s = RH / vh                      # raster px per svg unit
page_html = f'<html><body style="margin:0;background:transparent">' \
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx} {vy} {vw} {vh}" width="{RW}" height="{RH}">{inner}</svg></body></html>'
with sync_playwright() as p:
    kw = {'executable_path': os.environ['CHROME_BIN']} if os.environ.get('CHROME_BIN') else {}
    b = p.chromium.launch(**kw)
    pg = b.new_page(viewport={'width': RW, 'height': RH})
    pg.set_content(page_html)
    png = pg.screenshot(omit_background=True, clip={'x': 0, 'y': 0, 'width': RW, 'height': RH})
    b.close()
alpha = Image.open(io.BytesIO(png)).convert('RGBA').split()[3]
px = alpha.load()

def right_edge(y0, y1):
    """Rightmost filled x over raster rows y0..y1 (the trailing edge), or None."""
    best = None
    for y in range(y0, min(y1, RH)):
        for x in range(RW - 1, -1, -1):
            if px[x, y] > 128:
                if best is None or x > best:
                    best = x
                break
    return best

# ---- streaks -----------------------------------------------------------------
ROW = 12                                  # raster px
ext = 1.6 * vw                            # how far the viewBox grows to the right
streaks = []
y = 0
n = 0
torn = set(random.sample(range(8, 40), 3))
while y < RH:
    rows = random.choice([1, 1, 2, 2, 3])
    y0, y1 = y, y + rows * ROW
    edge = right_edge(y0, y1)
    y = y1 + ROW * random.choice([0, 1, 1, 2])
    if edge is None:
        continue
    n += 1
    # start a little inside the silhouette so the mare covers the root of the streak
    sx = vx + (edge / s) - 0.04 * vw
    sy = vy + y0 / s
    h = (y1 - y0) / s * 0.82
    run = random.uniform(0.35, 0.9) * vw * 1.55
    if n in torn:
        sx += random.uniform(2, 5) * ROW / s
    fill = '#303C53' if n % 5 == 0 else '#434E64'
    r = h / 2
    solid = run * 0.55
    streaks.append(f'<rect x="{sx:.1f}" y="{sy:.1f}" width="{solid:.1f}" height="{h:.1f}" rx="{r:.1f}" fill="{fill}"/>')
    # the tail: dashes that thin out and space out
    x = sx + solid + h * 0.6
    end = sx + run
    gap = h * 0.5
    while x < end:
        w = max(h * 0.8, random.uniform(0.04, 0.12) * vw * (1 - (x - sx) / run))
        if x + w > end:
            break
        streaks.append(f'<rect x="{x:.1f}" y="{sy:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r:.1f}" fill="{fill}"/>')
        x += w + gap
        gap *= random.uniform(1.25, 1.6)

nvx, nvw = vx, vw + ext
far = vx + nvw                            # the far end of the smear: fully transparent
opaque = far - 0.34 * ext                 # opaque from 34 percent of the run region in
smear = (
    '<defs><linearGradient id="mh-fade" gradientUnits="userSpaceOnUse" '
    f'x1="{far:.1f}" y1="0" x2="{opaque:.1f}" y2="0">'
    '<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>'
    f'<mask id="mh-mask" maskUnits="userSpaceOnUse" x="{nvx:.1f}" y="{vy:.1f}" width="{nvw:.1f}" height="{vh:.1f}">'
    f'<rect x="{nvx:.1f}" y="{vy:.1f}" width="{nvw:.1f}" height="{vh:.1f}" fill="url(#mh-fade)"/></mask></defs>'
    f'<g class="smear" mask="url(#mh-mask)">{"".join(streaks)}</g>'
)

# the single marigold path is the flame-shaped blaze
mare = re.sub(r'<path([^>]*?)fill="#f4a62a"', r'<path class="blaze"\1fill="#f4a62a"', inner, count=1, flags=re.I)
if 'class="blaze"' not in mare:
    sys.exit('mare-hero: no marigold blaze path found in the sticker')
out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{nvx:.1f} {vy:.1f} {nvw:.1f} {vh:.1f}">'
       f'{smear}<g class="mare">{mare}</g></svg>')
open(OUT, 'w').write(out)

# SVGO pass, keeping the classes, the ids and the viewBox
try:
    subprocess.run(['npx', '--yes', 'svgo@4', '-q', OUT, '-o', OUT,
                    '--config', os.path.join(os.path.dirname(__file__), 'svgo.hero.config.mjs')], check=True)
except Exception as e:
    print(f'mare-hero: svgo skipped ({e})')
import gzip
raw = open(OUT, 'rb').read()
print(f'brand/mare-hero.svg: {len(streaks)} streak pieces, viewBox {nvw / vh:.2f}:1, '
      f'{len(raw) / 1024:.1f} KB, {len(gzip.compress(raw)) / 1024:.1f} KB gzipped')
