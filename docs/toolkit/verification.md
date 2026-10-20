# Toolkit verification record

## Scope
Integrated worktree: public toolkit catalog/gallery and homepage, Lead Scorer upload/quote/run/results flow, shared Clerk account and billing UI, D1 ledger and cap administration, provider validation/execution, Worker routing and toolkit CSP. The separate UI and database worktrees have been copied into this worktree and exercised together. No product commit, push or deployment was performed.

## Executed checks
`npm run build` completed, including naming/disclosure guard and prerender. `node --test scripts/lead-scorer.test.mjs scripts/toolkit-catalog.test.mjs scripts/toolkit-routing.test.mjs` passed 12 tests. These provider tests use explicit fixtures, not live paid calls.

`python3 scripts/toolkit-gallery.browser.py` exercised search, empty search, product filters, the build-stack disclosure, and geometry checks at 375, 768, 1280 and 1600 pixels. All four reports had no page JS errors or gallery overflow. The gallery was served with a local static server; this is not proof of the Worker CSP or Clerk operation.

The visual audit at 375 pixels had zero FAIL findings after touch-target and hidden-disclosure fixes. The intentional Inter font is a brand requirement, not an accidental default. The old footer's h2-to-h4 heading skip remains outside the new gallery. Full-page Worker integration must be tested separately.

## Visual critique and fixes
1. A global link rule overrode the gallery's Paper link color. Increased the gallery selector's specificity rather than changing global theme rules.
2. The assistant widget overlaid the product collection on mobile. Removed it from the toolkit shell; private workflow surfaces must not load it either.
3. The original product descriptions were too verbose for a compact catalog. Use their first sentence and unique product-labelled actions. Free ChamPDF explicitly consumes no toolkit credits; Event Scout is labelled preview.
4. The legacy build-stack section overwhelmed the actual product launcher. Put it behind a native details disclosure, retaining the original content and interactions.

Screenshots and browser report: `/Users/deep/.hermes/cache/scratch/toolkit-verify/`. Desktop/mobile fold, feature pair and separate-product collection screenshots were opened through vision review. Re-run captures after the final integration changes.

## Confirmed baseline defect
`node scripts/selftest-worker.mjs` reports 29 passed, 1 failed: `/command from direct is operator` receives `explorer`. Reproduced the same failure with both `worker/index.js` and `scripts/selftest-worker.mjs` read from HEAD into an isolated scratch fixture. It predates these toolkit changes. Do not report the repository-wide Worker selftest as green.

## Inventory evidence
`docs/toolkit-inventory.md` records the discovery audit. Its integration counts describe the pre-build state, not the worktree now being implemented. Public HTTP responses establish reachability only. No authenticated external-product workflow or shared-credit integration has been verified for the separate products.

## Homepage refinement and Harbinger

Harbinger is now in canonical catalog data and the homepage's primary task chooser. Its advertised Vercel marketing site was fetched successfully, but no authenticated workflow was exercised. Deep Scanner was traced to its real internal Python source and public packaging brief; the public GitHub endpoint returned 404, so it is labelled internal rather than launchable.

The homepage now separates evaluating an existing list from researching buying signals, gives explicit input/output summaries and destination actions, moves the build stack out of the primary chooser, and explains Deep Scanner through an expandable disclosure. The catalog defaults to product sites; source and preview filters remain available. Actual 21st.dev reference pages, code and preview images used are documented in `surface-home.md`.

`toolkit-user-ux.browser.py` passed at 375,768,1280,1600, including Harbinger links on both pages, job-based search, scanner disclosure, geometry and page-error checks. The refreshed gallery browser suite passed at all four widths. The homepage-section audit (with its real ancestor styles, including expanded scanner) and the complete toolkit-page audits have zero FAILs at 375 and 1280. Intentional brand font and pre-existing footer hierarchy/measure warnings remain. Impeccable's detector returned an empty findings array for the changed JSX/CSS targets. All 12 parent-owned Node tests and `git diff --check` passed.

The two screenshot review rounds are in `/Users/deep/.hermes/cache/scratch/toolkit-user-ux/`. Fixed navigation is excluded only from the section-only captures to avoid misleading overlay artifacts; interaction and geometry checks run against the real page. Visual suggestions to label Harbinger free were rejected because no free entitlement was verified. The contrast audit, rather than a subjective screenshot impression, verifies the existing muted brand colors.

## Final integration gates

| Gate | Executed result |
|---|---|
| `npm run build`, `npm run check`, `npm test` | Passed, including brand/disclosure guards and internal links |
| Node provider/catalog/routing/session/integration/parser suite | 40 passed |
| SQL ledger selftest | 46 assertions passed |
| Clerk-auth/API/IDOR/admin/replay selftest | 91 assertions passed |
| Signed webhook and paid-period grant selftest | 29 assertions passed |
| Local Wrangler D1 migration | Applied successfully, local only |
| Wrangler deploy `--dry-run` | Worker bundled successfully, no deployment |
| `tests/browser_flows.py` | All nine fixture flows passed, including export, cancellation, history and cap readback |
| `scripts/toolkit-integrated.browser.py` | Two consecutive final passes through browser, real JWT verification, real API, real SQLite and the real provider module with fixture provider responses |
| Homepage and catalog browser scripts | Passed at 375, 768, 1280 and 1600 |
| Existing segment/copy/digest/privacy selftests | Passed; the separately documented baseline Worker classification failure remains |

The integrated browser test measures the live UI's dynamic states as well as the default screen: upload, custom criteria, approval, results, known spend, unknown-cost hold, and account balance. Every captured state's audit has zero FAIL findings. The intentionally horizontally scrolling provider table produces a flex-truncation warning; the max/actual/held summary produces a three-card INFO. These are functional, labelled accounting views, not decorative counters. Initial default-page audits alone missed 24px criterion removal controls and mobile mapping selects below 16px; both were fixed and remeasured. Progress rows now keep the fixture person's name visible at 375px.

Integration fixes caught with failing tests: preserve partial paid results through failed/held run envelopes; preserve custom column names separately from result labels; mark requested but unsuccessful email verification unknown; show unknown provider cost as Not reconciled; retry transient authoritative billing reads instead of acknowledging a lost grant; reject oversized streamed request bodies; require complete safe Clerk config; bound XLSX decompression to 20 MiB per part. Account success feedback no longer uses the error color.

Final state screenshots and per-state audits: `/Users/deep/.hermes/cache/scratch/toolkit-integrated/`. Browser identities and provider results are explicit fixtures. Real Clerk-hosted signup, actual paid checkout and provider network behavior were not substituted with claims about these fixtures.

Wrangler 4.125.0's watcher became unstable with the repository root as its asset directory, including an ENOENT on a transient `.hermes-tmp` file and a reload loop. The final served-header gate uses the actual dry-run Worker bundle and a copied public-asset snapshot in `/Users/deep/.hermes/cache/scratch/toolkit-preview`, with local D1. `scripts/stage-toolkit-preview.py` records this reproducible staging step. No production files or deployment were altered to work around the local watcher.

## Not yet verified
Real Clerk sign-in, Clerk Billing eligibility and checkout, signed live webhooks, remote D1 migration, real provider cost reconciliation, production deployment and cross-product wallet integration. Do not convert fixture success into a claim that these are live.
