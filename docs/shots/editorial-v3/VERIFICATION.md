# Editorial v3 preview verification

Status: preview ready for Deep's visual approval. Not production approval.

Preview: https://deependhq-editorial-v3-preview.deep-ae0.workers.dev
Branch: refresh/editorial-hero-v3
Tested runtime commit: 237b9641f4b908103a564010124abf5a1035b46e
Cloudflare version: 3680b4c7-4c9a-4c5d-b4f3-c72f8a115b39
Only ASSETS is bound. No production routes, D1, billing, secrets or paid calls were added. Original preview and production were not overwritten. Final evidence commit follows the runtime commit without changing public assets.

## Scope and decisions

Personal editorial cover, not the rejected chart dashboard. Deep is prominent, followed by the marketer/builder statement, real roles, booking/tools actions and an actual dated log excerpt. Terrain moves intact to #log. Mobile order is name, statement, roles, introduction, actions, proof, public log. The full mobile hero capture is 1100px tall; it is not a claim that the whole cover fits a short phone's first screen.

Dark is neutral black/charcoal, gold and green. Light is separately composed buttery cream, espresso, antique gold and olive. Approved scouter files are unchanged. All six input tips remain ancestors, content remains day354/132 entries, and islands/, worker/, migrations/, package manifests and tool internals are unchanged. No generated imagery or new runtime dependency.

Change reach: Home.jsx and app.jsx composition, home.css, canonical system.css and generated scheme-tokens.css, scheme.js and generated page shells, shell build script, copy-engine.js label controls, existing hero/location/copy assertions, isolated staging name and the new real-page browser gate. CTA personalization targets only the inner label; its duration is separately frozen, so the existing engine cannot replace the arrow or change 30 minutes. No data is deleted or new private data exposed.

Actual adoption: 21st.dev/nextjsshop Arrow Dots Button. Its four five-dot chevrons are mounted in the prerendered booking CTA, with source provenance in SOURCES.md. Existing Kokonut Activity Terrain and the other three canonical islands remain mounted. Not a catalog-only claim.

## Real execution

| Gate | Result |
|---|---|
| scripts/release-gates.py | 15/15 commands exit0 |
| Build | 38 prerendered pages, canonical 407036-byte islands bundle |
| npm test | guard11, ingest23, 48 gap-free layouts, 170 real calendar days and seven clocks |
| Privacy/brand/internal links | pass, 90 HTML files scanned including local staged copies |
| Worker/segment/copy/digest/privacy | 35 / 37 / 44 / 26 / 33 passing assertions |
| Toolkit node tests | 40/40 pass |
| Toolkit store/API/billing | 46 / 91 / 29 pass, fixtures, not paid services |
| Canonical contrast | 60 pairs, zero below4.5 |
| Existing focused P4 browser | 27 audited states, 13 cases, zero owned FAILs; actual pointer/keyboard navigation, drag, flat view, seven lanes, offscreen RAF, no-JS |
| Deployed editorial browser | 20 audit states, 12 check groups, zero FAILs, zero unexpected rect overflow, zero page exceptions |
| Live HTTP | 160 public assets and7 routes read back; _headers correctly404 |
| Static asset readback | exact local system.css, home.css, copy-engine.js bytes; favicon/islands/style/sprite hashes pass |
| Exclusions | backend, migrations, scripts, docs, tests and .env probe paths404 |

The established public asset set retains browser-required legacy JSX for the existing Babel routes. It does not expose backend/test/operational sources. No claim is made that every frontend source is bundled. The Worker HTML contains the exact new hero marker; byte equality is asserted for static assets, not transformed HTML responses.

Screens: 375 /768 /1280 /1600, dark and light, actual hosted URL. All8 nav+hero images were opened. Four terrain/table images were opened too. After final changes, seven hero PNGs were byte-identical to the inspected set; the changed768-dark image and all four terrain images were opened again. The P4 test's16 temporary captures were opened; historical P4 screenshot files were restored rather than mislabeled as new evidence. Final deliverable shots are the12 PNGs in this directory.

Checks cover actual CTA hrefs, tools click, scheme system/override/reload/reset, matching computed palette and browser theme-color, four mounted islands, 44px nav/hero target geometry, keyboard focus, actual day selection,170 table rows, gaps, flat/reduced terrain, no-JS primary content in both OS preferences and the corrected two-column terrain geometry. JS-off preserves primary content but does not promise automatic OS theme parity.

No em/en dashes occur in newly authored Home.jsx, home.css, index.html or DESIGN.md. Identity SVGs remain byte-identical.

## Measured readable pairs

| Pair | Dark | Light |
|---|---:|---:|
| Body on ground |15.93|12.28|
| Muted on ground |10.02|6.29|
| Dim on raised card |5.76|4.62|
| Gold text on ground |9.45|5.75|
| Green/olive text on ground |9.01|5.95|

These are calculated WCAG ratios, not approved palette claims. The computed live tokens are independently asserted so duplicate later CSS blocks cannot silently replace the proposed palette.

## Critique and fixes

1. Early light screenshots were not actually buttery: two later old white/navy blocks overrode the proposal. Removed those duplicate primitive overrides, retained legacy aliases and asserted live computed tokens.
2. The nav booking fill competed with the hero. Kept the real nav, changed that action to a quiet outline and left gold to the hero action.
3. Relocated terrain inherited grid-column9 on its metadata sibling, creating implicit empty columns. Reset that span, assert measured column widths and recapture the expanded terrain.
4. Existing desktop email target was20px high. It is now44px in all sizes.
5. The automated copy gate caught an accidentally disconnected CTA slot. Restored label-only personalization, aligned its control strings and added frozen-duration/arrow assertions. All15 gates then passed.
6. An isolated terrain screenshot caught the sticky nav in its crop. Recaptured only those section shots with nav positioned at the document top; nav is never hidden in the required hero screenshots.

Final hierarchy and five-second identity checks pass across the eight hero images. The deliberate name prominence, right-column dated proof and three-line excerpt were retained rather than following contradictory vision suggestions to demote the name or expand the excerpt. This reads as Deep's working publication rather than a consultancy dashboard. The selected mark, real roles and log facts pass the swap test.

Known visual limit: the small retained launcher can cover a few characters of passive table text at a viewport edge in an isolated mobile crop. Table/page scrolling exposes that text; all tested hero/log/footer control centers remain actionable. No claim is made that floating chrome never covers passive pixels. Moving or suppressing the launcher was not authorized by the greeting-only decision.

Audit WARNs are preserved: Inter is the locked brand UI font,13 counted blurred surfaces belong to the preserved folder/overlay components rather than13 simultaneously visible nav layers, and measure warnings are long data-table excerpts/footer legal copy. No warning was converted to a fabricated PASS. Touch-target warnings were fixed.

## Approved greeting-only change and service boundary

The coordinated t_ba6ef6e6 change is .dh-pro{display:none!important}, all sizes. Launcher and user-opened chat are preserved. Its report and raw four-state real-service evidence are in docs/verification/assistant-greeting/. The report proves12 delayed-card scroll samples,28 target checks and opening/filling/clearing/closing the real textarea on a local HTTPS Worker mapped to the permitted deependhq.com origin, with no message submission. This is not a production deployment.

The actual public workers.dev preview still receives the assistant service's unchanged exact-origin CORS refusal. Final live browser evidence retains36 console errors:18 module CORS refusals plus18 corresponding failed-resource messages, zero page exceptions. Therefore chat on this public preview is not claimed usable or console-clean. No assistant service/CORS change or paid call was attempted. The private .dh-pro selector can drift, and CSS suppression does not stop outreach requests.

## Limits and next gate

No main merge, push, production deployment, nightly publisher reconciliation, provider/chat turn, billing activation, physical-device test, screen-reader session, Safari/Firefox pass or sustained hardware FPS measurement. Tool-internal literals and OG assets remain follow-up token consumers, not a silently approved sitewide rollout. The runtime dependencies were not upgraded; inherited audit advisories were not re-audited in this task.

Explicit visual approval card t_652aa871 is BLOCKED and is a dependency of both production publisher and root. Completing this preview task does not release production. Deep must approve the final hero and both palettes first, then integration/reverification can proceed.

Reproduce: python3 scripts/release-gates.py; npm run test:p4:browser; EDITORIAL_BASE=https://deependhq-editorial-v3-preview.deep-ae0.workers.dev node scripts/editorial-browser.mjs; RELEASE_BASE=https://deependhq-editorial-v3-preview.deep-ae0.workers.dev python3 scripts/release-http.py.
