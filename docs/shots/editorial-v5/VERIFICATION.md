# V5 preview verification

DRAFT for Deep. Deep has NOT visually approved v5. This document does not authorize production publication.

Preview: https://deependhq-editorial-v5-preview.deep-ae0.workers.dev
Cloudflare isolated Worker version: `ac0af56f-ebcc-4af3-87e8-ec601733614f`
Branch: `refresh/editorial-hero-v5` (exact final head in the card handoff).

## Checks executed

- All 15 release-gate commands in `docs/verification/release/gates.json` returned 0: production-mode build, test, guard/check, brand guard, contrast, worker/segment/copy/digest/privacy, toolkit node/store/API/billing, publisher syntax. Detailed outputs are in `docs/verification/release/gate-00.txt` through `gate-14.txt`. Brand guard now excludes the staged `.release` copy, not source; the missing genuine ChamPDF image was captured and supplied.
- 60 token contrast pairs across dark and light cleared 4.5:1. Dark ground is neutral `#080808`, terminal green `#30E060`; kintsugi gold `#C9A84C` is reserved for thin seams and booking fill. Light has neutral near-white ground and dark green/gold text twins. No navy/cream/olive theme retained in the v5 homepage. `npm run contrast` output is gate 04.
- `scripts/v5-browser.mjs` ran against the deployed URL, not a local server. 44 states including all 375/768/1280/1600 width and both system schemes, opened disclosures, day picker, terrain table, scheme override, mobile menu and reduced-motion states. Zero audit FAILs, zero rect overflow and zero page exceptions. All 26 booking clicks opened `https://scheduler.zoom.us/sreedeep`; every CTA was 44px or larger. Three booking links render even without JS. Five tools, twelve companies, day 354 and one terrain island were asserted. See `hosted/browser-results.json` and `docs/verification/editorial-v5/hosted-browser.txt`.
- The real deployed preview read back 165 public assets plus seven routes. Every served asset matched its staged bytes, allowing only the unchanged Worker's four documented HTML request hints and four legacy route redirects. `_headers` is intentionally platform-only and 404. See `docs/verification/release/http-results.json`.
- All 45 shipped HTML pages were searched for raw and HTML-entity en/em dashes: zero hits. `index.html` contains the draft booking phrase three times. Greeting-only `.dh-pro{display:none!important}` remains in `system.css` and does not remove the launcher.
- Final hosted capture set: `hosted/{375,768,1280,1600}-{dark,light}.png`; nine named section captures for each 375 and 1280 scheme; `hosted/reduced-{dark,light}.png`. All 46 were opened: eight fold shots individually, 36 source section shots via the 18 labeled native-resolution two-theme contact sheets in `hosted/review/`, two reduced-motion hero shots individually. The manifest names each source pair.

## Visual critique and resolution

- All eight folds have a readable oversized white/green headline and prominent gold call, plus the repeated outlined nav call. Review suggested removing the preview's DRAFT label and repeated nav CTA, but both are explicit task requirements and are retained. The bio hierarchy is subordinate to the headline. No confirmed fold clipping at any width or scheme.
- In the tool shelf, one visual read alleged the two screenshot images overlapped their title text. DOM rectangles measured their image bottoms at 1309.67px and title tops at 1334.67px on the hosted 1280 page, a 25px gap. No change was warranted. Phone and desktop dark/light tool shelves, company walls, mid-call, latest-only log, writing, off-hours, machine logs, closing calls and footers were inspected from paired section images.
- A visual read alleged the footer's floating chat badge was cut off by a bottom bar. That claim conflicts with the independent footer element capture and the tested rect geometry; the element capture shows complete legal text, privacy link and day count. No cutoff of the rejected giant Deep wordmark exists, since it is absent. The retained launcher may overlap passive content at some scroll positions, an inherited limitation, not a claim of comprehensive overlay clearance.
- Visual critiques of the log dates conflated entry day number with elapsed days. DOM shows the latest entry date `2026-10-20` and an age of two days in the preview build. Day 354 is its public journal index. The machine log's date range reflects the 170 rows in its actual dataset, not 354 calendar cells. The apparent contradiction was not a source-data defect.
- Minor open visual concerns, not gate failures: inherited Inter body font is reported by the slop audit, some dense long-form prose exceeds its 65-character heuristic, and the persistent launcher remains visually prominent. The requested conversion placement and no-fabricated-data constraints take precedence over speculative redesign churn.

## Explicit limits

The public `workers.dev` origin is rejected by the unchanged assistant service's exact-origin CORS. The 60 browser console errors are restricted to that module, widget config and outreach requests; there were zero page exceptions. Chat conversations and provider calls were not claimed working. No physical-device, Safari/Firefox, screen-reader, provider billing, performance FPS or production-origin verification. Spotify and PlayStation were not connected. No production merge/deploy or public-copy approval. The CTA copy remains a visible DRAFT for Deep's review.
