# Toolkit launch handoff

## Current artifact

The integrated implementation is in `/Users/deep/repos/lead-scorer-public`, branch `feat/lead-scorer-public`. Product changes remain uncommitted and undeployed. Test identities, account balances, plans and provider responses used in browser verification are fixtures, not live customer data.

The real local Worker preview is at `http://127.0.0.1:3177`. It correctly reports setup needed. Upload, mapping and preview can run locally; paid execution remains disabled. The copied preview is a snapshot, not a live-edit server.

## Product scope

| Surface | Role | Account/credit state |
|---|---|---|
| Lead Scorer | Evaluate CSV/XLSX lists with enrichment, email verification, ICP fit and custom rubric columns | Integrated code, awaiting production setup |
| Harbinger | Buying-signal research and its broader outreach workspace | Linked as a separate product, not connected to this wallet |
| Deep Scanner | Internal local-file sensitivity scanning before cloud sync | Explained as internal, no public launch promise |
| ChamPDF | Browser PDF tools | No artificial execution-credit charge |
| ChampBeam | Link tracking | Separate product site/account |

21st.dev feature and file-upload references were adapted to the existing static interface. No Tailwind/shadcn runtime or whole-site framework migration was introduced. Reference provenance is in `toolkit/surface-home.md` and `lead-scorer/DESIGN.md`.

## Before enabling public spending

1. Configure the chosen shared Clerk application and its allowed domains. Put backend secrets in the deployment secret manager, never in chat or browser code. Required names and interfaces are in `toolkit-backend.md`.
2. Verify the actual merchant entity's eligibility for Clerk Billing. Residence does not establish merchant country. Keep paid billing off until eligible and tested.
3. Provision the production D1 database, insert its returned real `database_id` and `TOOLKIT_DB` binding into the production Wrangler configuration, and apply the migration only after deployment approval. `wrangler.toolkit-local.jsonc` and the staged scratch config are explicitly local-only; their local database identifier must never be deployed.
4. Approve welcome credits, total welcome pool, daily user credits/rows, global provider ceiling, paid plan identifier and allowance. Defaults are zero and fail closed. Subscription pricing and execution-credit allowances are distinct decisions.
5. Configure the signed billing webhook and verify an actual checkout/renewal plus an actual grant readback. The implemented retriable webhook path does not replace a periodic reconciler for wholly missed events.
6. Verify the deployed Clerk and Stripe flows with the actual CSP. The local gate proves served headers and setup-needed behavior, not a live identity/payment flow.
7. Authorize a small, capped live provider smoke test. Verify Treg call IDs/cost headers and Jev billed cost against the ledger before inviting users. No such calls were made during this build.
8. Disable or retire the old Supabase scoring endpoint and any old deployments, not just their former browser page. The new `/api/decide` is retired with HTTP 410.

## Operational limits to resolve explicitly

Unknown-cost holds do not expire automatically. Reconcile the recorded provider operations before releasing them; do not directly mint credits or call them free. A reconciliation operator workflow and a periodic missed-billing-event reconciler remain operational follow-ups.

The usage endpoint returns the recent 30 runs, and the administrative list is bounded to 500 users. Caps and ledger accounting apply to all accounts, but larger account-history/admin navigation needs pagination. Quote requests require authentication but have no separate rate limiter. Set a public data-retention/deletion policy before accepting customer lead files.

XLSX parsing targets the first worksheet and preserves Excel date serials, not formatted date interpretations. Uploads are capped at 5 MiB and 1,000 rows, scoring runs at five rows per paid batch, and inflated ZIP parts at 20 MiB. Server-side row/column/character validation remains independent of the browser.

## Verification

See `toolkit/verification.md` for executed commands, state screenshots, fixture boundaries and the pre-existing `/command` classification test failure. The product is locally integrated and verified under those boundaries, not declared production-ready.

The default-page audit is not sufficient: rerun `scripts/toolkit-integrated.browser.py` to exercise custom-criteria removal targets, mapping controls, cost approval, failed-provider results, held costs and account state. Its bridge uses real backend code and SQLite but fixture providers and locally signed test identities.

For the local browser fixture stack, run `tests/fixture_server.py --port 3175` and `node scripts/toolkit-browser-server.mjs` (3176). For the actual Worker preview, first bundle with Wrangler `--dry-run`, stage with `scripts/stage-toolkit-preview.py`, apply its D1 migration locally, then serve its scratch configuration on 3177. Do not run the repository-root asset watcher during editing: it was observed to reload continuously and fail on transient patch files. No fixture endpoint is included in public deployment assets.
