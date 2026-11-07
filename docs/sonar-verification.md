# Sonar verification

## Result

Local implementation is ready for main-profile review. No production deployment or paid model call was made.

Preview: http://127.0.0.1:3175/toolkit-app.html
Worker-handler fixture bridge: http://127.0.0.1:3176

The preview uses canned plans. Choose toolkit-sample-leads.csv, then ask a rank or list question. The browser suite also injects explicitly labelled fixture plans for number, share, trend and compare.

## Executed checks

| Command | Result |
| --- | --- |
| `/opt/anaconda3/bin/python3 scripts/sonar-browser.py` | Exit 0. 264 assertions, 22 captures, zero page errors |
| `node --check toolkit-sonar.js` | Exit 0 |
| `npm test` | Exit 0, including all 167 toolkit-v4 cases and sonar-selftest |
| `node scripts/selftest-worker.mjs` | Exit 0, 35 passed |
| `node scripts/selftest-segment.mjs` | Exit 0, 37 passed |
| `node scripts/selftest-copy.mjs` | Exit 0, 42 passed |
| `node scripts/selftest-digest.mjs` | Exit 0, 26 passed |
| `node scripts/selftest-privacy.mjs` | Exit 0, 33 passed |
| `node scripts/guard.mjs` | Exit 0, GUARD PASSED |
| `npm run contrast` | Exit 0, 60 pairs measured, none below 4.5 |
| `git diff --check` | Exit 0 |

Node commands use the nvm v24.13.1 binary. Exact regression output is in scratch/sonar/regression-final.json. The npm user-config and experimental SQLite warnings are pre-existing warnings, not failures.

## Browser proof

- All six views run over local rows. Rank group counts and headline numbers, plus list rows, are checked against runPlan over the same CSV.
- CSV and both stored/deflated XLSX fixtures parse. Oversize, unsupported and empty files preserve the previously loaded table.
- File drops on the Sonar desktop icon and inside its window work. Workbench, Enrich and Files handoffs were driven through their real controls and the worker-handler fixture bridge.
- Planning requests contain a column profile, not a rows property. Short column samples are disclosed before asking. History preserves raw assistant JSON and caps at six paired turns.
- Invalid, null and inherited-name plans do not execute. Digit-bearing model headlines are rejected again in the browser. The 503 setup and 429 server-message states are recoverable.
- CSV export is explicitly limited to the first preview rows. It makes no server request.
- Dark and light rank states at 375, 768, 1280, 1440 and 1600. Also 375 by 812 phone geometry, normal animation and reduced motion.
- Sonar controls are at least 44 by 44. Trend has keyboard/focus tooltips and a full-size touch selector.
- No horizontal page overflow. Only the list table scrolls horizontally. The host occupies a separate footer with a 120px grid track and does not overlap the mare launcher.
- Sonar-scoped deterministic audit has zero failures, including its desktop and dock launchers. Minimum measured Sonar text contrast is 5.44:1.
- Console and response watchers cover every test context. Only deliberately injected 429/503 responses are excluded from the error gate.
- Served HTML, JS, CSS, font and host image bytes were compared to this worktree and match.

## Visual review

All screenshot states were opened through vision analysis. The original content-flow host footer was replaced with a dedicated footer so long results cannot push the host out of the window. Its phone inset keeps the human and mare separate. Answer-child sizing prevents horizontal overflow.

Later vision claims of touching rank labels and misaligned values were disproved by DOM measurements: 4px vertical gaps in stacked rows, 16px horizontal gaps on desktop, and aligned value-column right edges. The file input is measured inside the drop boundary. Table columns beyond the viewport are deliberately reachable inside the table scroll box, not clipped by the page.

Screenshot directory: scratch/sonar/

Required pairs at 375 and 1280: empty, thinking, rank, list, light-rank. Additional shots: rank and light-rank at 768/1440/1600, number/share/trend/compare at 375, rank-live-1280, rank-phone-375x812.

## Licenses and assets

The five component pages explicitly declare MIT: Terminal 29817, Count Up 20068, Rank Bars 29452, 8-bit Table 13078, Suggestions 12342. These are vanilla ports, not unused React installs. URLs and behavior mappings are in sonar-design.md; fetched license evidence is in scratch/sonar/license-evidence.json.

Pixelify Sans is self-hosted with fonts/pixelify-sans-OFL.txt. The host uses the eight registered Pixel Art Standard layers. No dependency or lockfile changes.

## Boundaries and follow-ups

- worker/, sonar-core.js and every existing selftest remain untouched by this frontend change.
- Shared validator issue: validatePlan accepts the inherited view name constructor at the backend baseline. The UI rejects non-own VIEWS keys before execution. Backend hardening is separately routed as t_c81bdefc and should be reviewed before production release.
- Existing shell issues were reproduced on untouched 7caaa0f: seven light dock-label contrast failures and fifteen desktop layout-animation findings. Sonar-specific launcher instances are corrected without changing the other apps. Broader shell triage is t_1db24a8b.
- Unchecked: paid-provider behavior, production deployment, Safari/Firefox, physical mobile keyboards and screen-reader hardware. Full-site prerender was not rerun because this change is static Toolkit modules; browser execution and the required regression gates were run.
- Main profile must review before merge. Nothing was merged or deployed.
