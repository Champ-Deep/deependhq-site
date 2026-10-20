# LOOK gate, live preview release shots (task t_9181204b)

Art-director pass over all 71 final PNGs in `docs/shots/release` (glob `*.png`, review subdir excluded).
Vision inspection: `vision_analyze`, 67 calls. Mechanical cross-checks: PIL row-gap scan over all 71 files.
Mechanical audit already reports zero FAILs, so every geometric item below is a hypothesis for parent to probe live, not proof.

## Method artifacts in this folder
- 375 tall sections cropped into <=1500px bands, stitched horizontally: `375-*-*.stitched.png` (14 files, 750 or 1125px wide).
- 375 folder/ecosystem re-banded to content-only region after pixel scan: `*.stitched-tight.png` (4 files).
- 1280 tall sections cropped to separate band files: `1280-*-section-log.band0/1.png`, `1280-*-section-stack.band0/1.png` (8 files).
- 375 fold captures grouped 3-up: `panel-375-{dark,light}-{account,browse,closer}.png`, plus `panel-375-nojs-reducedmotion.png` (7 files).

## Pixel facts (all 71 files scanned, ImageChops row scan)
- Four files carry a large internal empty band AND a huge empty tail:
  `375-dark-section-ecosystem` (content y0-400, empty y400-1600, content y1600-2600, empty y2600-4107),
  `375-light-section-ecosystem` (same shape), `375-dark-folder-open` (content y0-1000, empty y1000-1600, content y1600-2600, tail to 4107),
  `375-light-folder-open` (same shape). No other file has an internal gap >=120px or a tail >=300px.
- Everything else has internal gaps <120px and tails <130px (normal capture padding).

## Clean or near-clean (no defect found)
- `1280-dark-toolkit.png` (both reads clean), `pointer-mid-drag.png` (drag state reads correctly: active card outlined, origin gap placeholder sized right, grid intact).
- `375-no-js.png` and `375-reduced-motion.png`: full hero/log/card content renders, no missing or broken blocks.
- `1280-dark-home.png` / `1280-light-home.png`: header, hero, live log, Kokonut terrain widget (Show flat view, legend, Explore a day, Activity data table) all consistent across themes, no overlap or clipping found.

## Top defects (full list with fixes in docs/verification/release/visual-review.json)
- P0: mobile ecosystem/folder sections show a ~1200px empty band, only 3-5 folder cards, and a ~1600px empty tail in a 4107px capture.
- P1: mission-log tilted contribution graph overlaps the streak stats block and covers heatmap month labels (both themes).
- P1: open chat panel or FAB obscures content in 13 captures (folders, DMS sidebar, essay-spend chart, footer THE TWELVE, day 347 tag, terrain card, listen controls, footer CTA).
- P1: account page blank values (Providers configured empty, cap bars with no fill).
- P1: terrain/heatmap last column clipped at container edge (1600 home, section-top desktop and mobile, section-log grid).
- P1: 768 header `system` pill label clipped at right edge.
- P1: light mission-log bar chart bars not proportional to their values (17 reads shorter than 11).
- P1: sticky/fixed header captured over toolkit cards and section intros in section-stack, section-ecosystem, section-writing.
- P1: light-theme contrast clusters (no-entry heatmap cells, footer fine print, back link, folder subtitles, gray microcopy).

## Limits
- Vision reads disagree by one card on the desktop ecosystem grid (dark read 10 cards, light reads 11 cards plus one empty slot in row 3 col 4). Folder counts on mobile (3 and 5) come from vision, not from DOM.
- `1280-{dark,light}-section-stack.band0/1.png` were generated but not opened; the full 1677px images were read instead.
- Chat-open state in the captures may be intentional; overlap findings apply to that state.
- No numerical design scores, no product or source edits, no claim that geometry defects reproduce live.