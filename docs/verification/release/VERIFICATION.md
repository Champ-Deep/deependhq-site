# Combined release verification

## Result and handles

Integrated runtime source: `54ad2d94e188a6e625bbaa18cf6549823f13b6d7` on `release/deependhq-refresh-v2-20261021`. Later commits contain evidence and excluded verification scripts only. The final PR head is read back in `pr-state.json`.

Preview: https://deependhq-refresh-v2-preview-20261021.deep-ae0.workers.dev

Cloudflare preview version: `a72b6eed-ce27-4663-a069-a4ff454d74e4`. Readback: `preview-status-final.txt`, `preview-version-final.txt`, `preview-deployments-final.txt`. Only ASSETS is bound. No D1, secrets, production routes or custom domains were added. Production publication belongs to downstream task `t_1ee6b328`, not this integration run.

## Reproduce

Run from `/Users/deep/repos/deependhq-refresh`:

```sh
npm ci
python3 scripts/release-gates.py
python3 scripts/stage-release.py
env -u PYTHONPATH python3 scripts/release-assets.py
python3 scripts/release-mutations.py
RELEASE_BASE=https://deependhq-refresh-v2-preview-20261021.deep-ae0.workers.dev python3 scripts/release-http.py
RELEASE_BASE=https://deependhq-refresh-v2-preview-20261021.deep-ae0.workers.dev node scripts/release-browser.mjs
```

`PYTHONPATH` in this tool environment points to a different Python ABI. Unsetting it selects the installed working Pillow/Playwright packages. No package was installed as a workaround.

## Executed gates

| Gate | Actual result | Evidence |
|---|---|---|
| Ordered ancestry | Six of six exact input heads contained, merge commits retained | containment.json, merge-ledger.txt, merge-1 through merge-6 logs |
| Production content | Oct 20/day 354, 132 entries. Latest entry equals remote production source | assets-proof.json, gate-00.txt |
| Production install | `npm ci --omit=dev` then `NODE_ENV=production npm run build`, both zero. Normal npm ci restored | production-ci.txt, production-build.txt, npm-ci.txt |
| Combined commands | 15 commands, 15 zero exits | gates.json and gate-00 through gate-14 |
| npm test | 11 disclosure/naming cases, 23 ingest cases, 48 gap-free grid layouts, 170 calendar dates/132 actual entries/seven lanes | gate-01.txt |
| Static safeguards | Brand, naming, disclosure and link checks pass. Contrast: 60 pairs, zero below 4.5 | gate-02 through gate-04 |
| Worker/segment/copy/digest/privacy | 35 / 37 / 42 / 26 / 33 assertions, all pass | gate-05 through gate-09 |
| Toolkit node tests | 40 collected, 40 pass, zero skipped | gate-10.txt |
| Toolkit store/API/billing | 46 / 91 / 29 assertions, all pass | gate-11 through gate-13 |
| Gate calibration | Both real retired-command redirect aliases and both frozen-copy markers fail when broken; restored gates pass | mutation-0 through mutation-3, mutations.json |
| Combined live browser | 84 audited states, zero FAILs, zero page errors, zero unexpected element-rectangle overflow | browser-results.json, browser-live.txt |
| CLI visual audit | Mobile 375 light and desktop 1280 dark, both zero FAILs | audit-cli-mobile.txt, audit-cli-desktop.txt |
| HTTP readback | 160 public files plus seven routes read back. Platform `_headers` is correctly not publicly served. Exact favicon/bundle/style/sprite hashes match | http-results.json |
| Identity | SVG 52x52 viewBox; ICO 16/32/48; PNG 192/512, mask 512, Apple 180. Favicon equals approved source and both brandmarks | assets-proof.json |
| Publication scripts | Both publisher paths now run complete build including canonical island bundle; shell syntax passes | gate-14.txt, scripts/publish*.sh |

There is no .github workflow directory and no CI run to claim. Main has branch protection but no required status checks in the readback. Do not infer CI from manual green gates.

## Browser scope

Real served Worker CSP, no substituted CSS or intercepted assistant. Home, journey, nested essay, nested company, toolkit, Lead Scorer and account: 375/768/1280 in both schemes. Home also 1600. Four canonical islands mount. Exercised system theme, persisted override, reload, reset and system-change event; pointer/keyboard grid reorder, persistence/reset and blocked storage; folder opening; terrain keyboard navigation to an actual expanded journey anchor; all seven scroll clocks through midnight; JS-off static reading; reduced-motion flat terrain and complete content.

The comprehensive runner is `scripts/release-browser.mjs`. Initial and final runs are separate: `browser.txt` is local, `browser-live.txt` is the public preview. The final machine-readable browser-results.json is the preview run.

Toolkit fixture stack used real UI, locally signed identities, actual JWT verification/API/SQLite/provider modules, and fixture provider responses. It exercised custom output, quote approval, settled costs, timeout/held partial results, cancellation, history, account/admin limits and setup-needed behavior. Logs: toolkit-browser.txt, toolkit-flows.txt, toolkit-gallery.txt, toolkit-ux.txt. These are not live customer/auth/payment/provider tests. Reproduce with tests/fixture_server.py on 3175 and scripts/toolkit-browser-server.mjs on 3176; `WORKER_BASE` selects the actual Worker for the integrated browser script. Backend and migrations are byte-identical to the approved P6 branch.

## LOOK pass and resolution

All 71 final combined-view source captures were opened in an independent visual pass. Tall images were read as cropped bands. The initial 17 visual hypotheses and named inspected files are in visual-review.json and docs/shots/release/review/LOOK-notes.md. Measurements are in look-dom-resolution.json.

1. The reported missing mobile folders were a section-capture artifact: offscreen IntersectionObserver entrances had not run. Real scrolling revealed all 12 folders, each opacity 1, uniformly spaced at 311.64px. The runner now visits every folder before full-section capture. No invented cards or product behavior change.
2. The tablet scheme label really exceeded its shrinking button. Tablet navigation now uses the existing menu until 1024px. Both final tablet captures were reopened and show contained labels/actions.
3. Contribution skyline stat labels had graph pixels behind them. Existing corner panels now have opaque card backgrounds. Final image review sees readable labels; a vision response became repetitive, so its truncated conclusion is not treated as a separate numerical gate.
4. Signed-out account providers had an empty placeholder. It now says `Setup or sign-in required`. Cap labels already explicitly say `no cap set`; zero fills are not invented balances. Final account captures reopened.
5. Terrain clipping, bar proportionality and footer alignment were disproved by DOM measurement. Terrain faces fit within x76.07 to611.53 in a690px canvas. Bar widths are211.55px for17 and136.89px for11, on identical373.34px tracks, with a30-entry denominator. All three footer headings share the same top; privacy scrollWidth equals clientWidth.
6. A mobile account crop ending at the viewport fold is not clipped document content. The page scrolls. No source padding hack was added.

Final revised folder dark capture confirms all12 cards; the redundant light stitched re-review timed out, but the light source was inspected in the complete pass and the final DOM independently confirms12 fully entered cards. Review crop padding is not site content. No physical device or assistive screen-reader test was performed.

## Warnings and real external boundaries

The live browser reports zero page errors, not zero console errors. The real assistant launcher/greeting is present, but assistant.deependhq.com rejects preview origins through CORS for its chat module/config/outreach endpoints. All external errors are retained in browser-results.json; none were stubbed or silently swallowed. No live chat response was claimed. This must be retested on the authorized production origin by the downstream publisher.

WARN categories are retained rather than filtered: Inter is the locked brand face; static folder material and inherited blurred surfaces trigger glass-count; legacy journey/essay treatments retain side stripes and decorative icons; footer/legal measure is intentionally dense; desktop inline links have a24px pointer threshold rather than the44px mobile threshold; inherited transition-all and heading warnings remain non-gating debt. Mobile computed controls have zero FAILs. Optional style cleanup was not mixed into release integration.

Production dependency audit: one moderate esbuild development-server advisory. This build uses esbuild as a bundler, not an exposed esbuild server. Full tooling audit: four high findings across Wrangler/miniflare/sharp/undici plus that moderate. No forced upgrades or audit-pass claim. Both JSON reports are saved.

Clerk signup, merchant eligibility, real checkout/renewal, paid-provider calls, production D1 provisioning/migrations, screen-reader/physical-device checks and sustained mid-tier FPS remain unverified. Spending and billing stay zero-default/fail-closed. Spotify playlist/current-game inputs remain honestly unconfigured. No new credit/pricing decisions, production publication, domain change, branch deletion or external-service retirement occurred here.
