## Combined DeepEndHQ refresh

Draft release for independent exact-head review and authorized downstream production publication. Do not squash if retaining input ancestry. Production deploy, native publisher reconciliation and live production readback are assigned to task t_1ee6b328, not claimed here.

Preview: https://deependhq-refresh-v2-preview-20261021.deep-ae0.workers.dev
Cloudflare version: a72b6eed-ce27-4663-a069-a4ff454d74e4
Tested runtime source: 54ad2d94e188a6e625bbaa18cf6549823f13b6d7. Later commits contain excluded evidence/verification utilities only. Compare public file hashes in docs/verification/release/assets-proof.json and http-results.json.

### Input merits and containment

| Input | Exact head | Call | Merge |
|---|---|---|---|
| P1 scaffold | bb07472dbda1a91e733ce957d4f54a170b3f71cd | Land: canonical schemes/static-plus-islands | 8ad7daa |
| P2 footer/twelve | 82b977b95506dc3bc9651fc4e1f1d997fa163384 | Land: actual folder/footer ports and fallbacks | 97ebbc9 |
| P5 off-clock | ac1d622bbec2086f982c6a96857d1d1dbd648747 | Land: Things to try and honest personal inputs | 83f1af1 |
| P6 toolkit | d38f2bce308fee1a7f9a656d400f3871226d61fb | Land fail-closed, not permission to enable spending | 6c2014e |
| P3 log | 0d93a1341d34de5c08bebae6866017bcdcc053eb | Land: real draggable grid and source-linked narratives | 9955874 |
| P4 hero/lanes | 5a9dfb9d46d44d7a98e7b3bf9ad08c86625dd78c | Land: actual-data Kokonut terrain and seven illustrative lanes | f826659 |

Six of six exact input heads are ancestors. Source overlap was composed by ownership; generated outputs were rebuilt from newest production content, not selected wholesale. Oct20/day354 and132 entries survive. Canonical registry replaces P3/P4 harness bundles. P6 Worker/backend and migrations are byte-identical to its approved branch.

Follow-up commits 6680ea2 and54ad2d reconcile global styles, toolkit tokens, publishing rebuilds, static assets, copy contracts, mobile targets and measured LOOK findings. All numbered merge dry-runs and real conflict sets are saved in docs/verification/release; they matched exactly.

### Actual gates

Full report: docs/verification/release/VERIFICATION.md. Runnable commands: scripts/release-gates.py, scripts/release-assets.py, scripts/release-mutations.py, scripts/release-http.py, scripts/release-browser.mjs.

| Gate | Result |
|---|---|
| Combined commands | 15/15 zero exits |
| Production install/build | npm ci --omit=dev then NODE_ENV=production build, both zero |
| npm test | 11 guard cases,23 ingest,48 grid layouts;170 actual calendar dates/132 entries/seven exact clocks |
| Worker/segment/copy/digest/privacy | 35/37/42/26/33 passing assertions |
| Toolkit node tests | 40 collected,40 pass,0 skipped |
| Toolkit store/API/billing | 46/91/29 passing assertions |
| Gate calibration | Four mutations rejected, restored Worker/copy gates green |
| Contrast | 60 token pairs,0 below4.5 |
| Live combined browser | 84 states,0 audit FAILs,0 page errors,0 unexpected rect overflow |
| Public readback | 160 files +7 Worker routes, exact favicon/bundle/style/sprite hashes; _headers correctly non-public |
| Identity | Unchanged approved52x52 source SVG; ICO16/32/48, PNG192/512, mask512, Apple180 |
| LOOK | 71 combined captures opened; final targeted revisions and DOM resolutions recorded |

No .github workflows or GitHub Actions test suite exist. Cloudflare attaches a managed Workers Builds check after pushes; its exact-head conclusion is read back separately. Repository main protection has no required status checks in the API readback. Manual green is not provider CI green.

The old /command test is reconciled to its real retired redirect: both aliases execute against the Worker and target /journey#commits. Mutation tests prove wrong destination/status fail. The old copy assertions now test the factual frozen hero/metrics and the single aligned CTA, retaining numeric, evidence, privacy, outage and audio guards.

### Fixture and external boundaries

Toolkit browser results use actual JWT verification/API/SQLite/provider modules with fixture identities and provider responses. They do not verify live Clerk signup, billing or paid APIs. Preview has only ASSETS, no D1, secret bindings, production routes or custom domains. Setup-needed states are honest; zero-default limits and fail-closed spending remain intact. No production migration or spending occurred.

Real assistant behavior was not excluded: launcher/greeting renders, but assistant.deependhq.com rejects preview-origin module/config/outreach requests via CORS. These console errors are retained, separately from zero product page errors. Retest on the authorized production origin after merge. No chat response was fabricated.

Warnings remain documented: locked brand fonts, inherited legacy transition/stripe/icon treatments, dense legal measure and desktop inline target warnings. npm audit --omit=dev reports one moderate esbuild dev-server advisory; full tooling audit has four high plus one moderate. No blind forced upgrades. Spotify playlist/current game remain unconfigured.

### Environment surface, names only

Toolkit feature flags/caps and secret names are documented in docs/toolkit-backend.md. This integration adds no new names beyond approved P6. The complete added names relative to main are generated into docs/verification/release/environment-names.txt. No values or credentials are included.

### Superseded set

No open PRs existed when inspected. The six branches above are contained, but none is deleted or closed. If a source PR is later opened, suggested reason: "Superseded by this combined release; commits contained, verified with git merge-base --is-ancestor." Do not delete a branch without repeating containment against merged main.

### Publication seam

Downstream review must fetch latest main, independently verify exact PR head, preserve any newer content, merge with a head match guard, publish the reviewed tree, reconcile the actual native publishing source without losing local edits, and verify deependhq.com itself. This draft does not claim production publication. No additional auth/billing/pricing decisions are bundled into release approval.
