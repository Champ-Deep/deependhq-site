# P4 verification and integration handoff

Local implementation branch: refresh/p4-hero-lanes.
Implementation checkpoint: 0230f1f. Final verification commit is the branch HEAD containing this report.

## Delivered

Hero and Day only in Home.jsx. Kokonut Activity Terrain default export in islands/terrain.island.jsx, mounted by isolated islands/p4-local.jsx and scripts/build-p4-island.mjs. Prefixed rules appended to home.css. home.js uses each active lane's literal clock instead of the obsolete five-stage CSS clock, and displays only the active lane's command. Existing proof section is deliberately untouched.

Terrain source: https://kokonutui.com/r/activity-terrain.json, MIT, @dorianbaffier. Saved registry and original source beside this report. Projection, visible cuboid faces, polygon drawing and hit-testing were ported. Demo data, Tailwind, spring/coast machinery and generic contribution totals were omitted. React and React DOM are the P1-approved runtime dependencies. No image assets were generated, no new general-purpose library was added, no 21st substitution was needed for the explicitly selected Kokonut terrain.

Source is 169 dates from 2026-05-04 through canonical brand.today_date 2026-10-19. It contains 131 actual entries, not 353 fabricated observations. Every day is checked against content.json: recorded github_commits including zero, otherwise 1 for an entry, otherwise 0. Missing days retain zero tower height. Peak annotation names newest actual entry. Existing real JourneyPage deep-link expansion was inspected and the oldest day-184 anchor was reached in Chrome.

Seven clocks: 15:00 calls, 16:30 outreach, 18:00 research, 19:00 build, 23:00 write, 01:03 compile, 02:00 ship. Commands are escaped React text, visibly illustrative. Removed heuristic last-lane dates and the false deployment receipt. No actual send counts or terminal results are invented.

## Real execution

npm run build: exit 0. 38 prerendered pages, isolated terrain bundle, dash gate clean.
npm test: exit 0. 9 guard cases, 23 ingest cases, plus all 169 terrain dates, canonical endpoints, entry IDs, kinds, real Journey anchor/deep-link implementation, seven clock fields and honest snippet assertions.
node scripts/brand-guard.mjs: exit 0.
npm run test:p4:browser: exit 0. Browser and owned HTTP listener closed in finally. Exact served mount was checked after readiness, not assumed from process startup.

Browser cases use actual homepage route with the completed P1 system.css supplied by route interception, not merged into this branch. The exact stylesheet snapshot is p1-system.css. External assistant widget script is excluded in the final fixture. Section screenshots suppress only global sticky navigation, preventing full-element captures from photographing the nav in the middle of a long section. This is local fixture evidence, not a production or fully integrated scheme claim.

Checks: nonblank canvas pixel count at all six width/scheme pairs; actual projected-column pointer navigation to journey.html#day-184; keyboard arrow selection and ordinary link activation; day selector including gaps; all 169 table rows; opening native details; desktop drag changes actual yaw without navigating; both view-toggle directions; mare dispatch; theme repaint changes canvas bytes; responsive flat/terrain switching; offscreen RAF stops; default controls not disabled; reduced-motion flat view and all seven visible lanes; JS-off headline, CTAs, latest log and static activity fallback. Whole-page scrollWidth equals viewport and owned element rectangles do not overflow at 375, 768, 1280. No page runtime errors in captured cases.

Machine audit: audit.py's unchanged rules evaluated in 27 live interaction states. Owner attribution was added to findings, not rule suppression: top/day/document findings gate P4, other section findings are separately retained in browser-results.json. Owned result: zero FAILs, 33 WARNs. Warnings are the brand-mandated Inter font and six long-measure readout warnings in the wider single-column operator surface; content remains capped to the source excerpt with a full-entry link. Unowned inherited findings remain red and are not claimed fixed.

Standalone audit.py CLI also executed over owned-static-fixture.html served from a confirmed owned listener: 375 light exit 0, 1280 dark exit 0, zero FAILs and one brand-font warning each. This additional fixture contains the exact static Hero and Day source markup with P1 CSS, not a separate component harness. Initial file:// audit could not inspect cross-file CSS rules and reported focus/motion false negatives; serving the same bytes over HTTP resolved those checks. CLI logs contain the successful HTTP runs.

## Visual review

16 full section/state PNGs: docs/shots/p4. Heroes and Day at 375, 768, 1280, dark/light; mobile opened tables; desktop reduced motion; mobile JS disabled. Every final shot was reviewed directly or through readable JPEG bands/contact sheets. Long Day shots are split into 900px review bands so the complete seven-lane list is covered.

Initial defects and fixes:
1. Legend lacked explicit colour mapping. Added three token-coloured swatches with text labels.
2. Mobile live log followed the terrain. Reordered it before terrain; desktop remains copy/live/mare left, terrain right.
3. Mobile flat canvas wasted vertical space. Reduced it to 132px; desktop remains 280px.
4. Light-scheme inherited green in the owned log link and Day eyebrow failed measured contrast. Switched those owned selectors to P1 -text twins.
5. Section captures initially caught transient COMPILE glyphs and global sticky navigation. Settled every lane before capturing and excluded global chrome from section shots. Exact command DOM assertions and all seven clocks pass.
6. Tiny select type risked iOS zoom. Raised select to 16px, retained 44px controls.

Final visual reads confirm readable dark/light heroes, no overlapping columns, flat reduced-motion version, contained activity tables and complete legible Day lists. A cropped last tablet band contained only section padding, not missing ship content. Narrow command wrapping is intentional pre-wrap, not truncation. Low-contrast text hypotheses were not accepted without measurement: the machine audit clears all owned text pairs. The external assistant bubble overlapped early unisolated captures; its behaviour belongs to P0/release and is explicitly not repaired by this lane.

## Required integration and limits

Register Terrain as terrain in the canonical P1 islands/index.jsx, remove the isolated P4 registry/build step, and keep a single bundle. Preserve P3 Log/Writing, P2/P5 sections, all newer production content (day 354 / 132 entries on the release branch), and regenerate. Do not replace Home.jsx or content.json wholesale with this branch. Keep existing proof until the integrator resolves metric placement. All docs/probes/source snapshots/fixtures must be excluded from public asset uploads.

The prior untracked .hermes-tmp.1NVvDj was inspected as a Home.jsx draft, not executed. Its contents are preserved as prior-worker-draft.txt. No reset, merge, push, deployment, or edits to sibling worktrees occurred. Context7 library resolution and effect-cleanup queries both returned HTTP 200; responses are saved here.

Not checked: real physical phones, assistive screen-reader session, sustained 60fps on mid-tier hardware, third-party scheduler booking, external assistant, production deployment. The finite terrain wave and offscreen sleep were exercised, but no hardware FPS claim is made. Legacy routes and unowned light-mode contrast still need combined release verification. The operator-reported P6 selftest-worker.mjs RED is outside this branch; npm test passing here is not a claim that every repository self-test is green. npm install reported five dependency vulnerabilities; no unreviewed forced upgrades were applied.
