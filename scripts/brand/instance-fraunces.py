#!/usr/bin/env python3
"""instance-fraunces.py : cut the four-axis Fraunces files down to what the site uses.

The identity kit (Oct 2026) sets display type in Fraunces Black with SOFT 100
and WONK on. Google serves SOFT and WONK only with the full axis set, which
more than doubles the files. This pins SOFT at 100 and limits wght to 700..900,
keeping opsz and WONK, which lands at roughly the old file size.

    python3 scripts/brand/instance-fraunces.py           # every fonts/fraunces-*-v2.woff2

Run after scripts/fetch-fonts.mjs. Idempotent: a file whose SOFT axis is
already gone is skipped. Needs fontTools and brotli. No em dashes.
"""
import glob, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
files = sorted(glob.glob(os.path.join(root, 'fonts', 'fraunces-*-v2.woff2')))
if not files:
    sys.exit('no fonts/fraunces-*-v2.woff2 files. run node scripts/fetch-fonts.mjs first.')
for path in files:
    font = TTFont(path)
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in font['fvar'].axes} if 'fvar' in font else {}
    if 'SOFT' not in axes:
        print(f'skip {os.path.basename(path)}: already instanced, axes {sorted(axes)}')
        continue
    before = os.path.getsize(path)
    limits = {'SOFT': 100}
    lo, hi = axes.get('wght', (700, 900))
    limits['wght'] = (max(lo, 700), min(hi, 900))
    font = instancer.instantiateVariableFont(font, limits)
    font.flavor = 'woff2'
    font.save(path)
    after = os.path.getsize(path)
    kept = sorted(a.axisTag for a in font['fvar'].axes)
    print(f'{os.path.basename(path)}: {before/1024:.1f} KB to {after/1024:.1f} KB, axes {kept}')
