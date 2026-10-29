# Toolkit backend: setup and known limits

Scope: `worker/toolkit.js`, `worker/toolkit-store.js`, `migrations/0001_toolkit.sql`, test scripts. Contract: `docs/toolkit-api.md`. No commits, no deploys, no remote migrations were made for this work.

## Exports

- `worker/toolkit.js` exports `handleToolkit(request, env)`. Parent's `worker/index.js` routes `GET/POST /api/toolkit*` to it.
- `worker/toolkit.js` loads the provider via literal `import('./lead-scorer.js')` (parent-owned file, required for `quote` and `run`). There is no production stub. Tests inject a fixture only through `env.__TOOLKIT_TEST_PROVIDER`, a path never set in deployment config.
- `worker/toolkit-store.js` exports the SQL layer used by the handler and the selftests (`reserveStmt`, `settleRun`, `readSettings`, aggregates, grants, admin writes).

## Environment variables (all optional, backend fails closed when absent)

| Name | Purpose | Missing means |
| --- | --- | --- |
| `TOOLKIT_DB` (or `toolkitDB`) | D1 binding, new and optional | `configured=false`, all actions 503 |
| `CLERK_PUBLISHABLE_KEY` | session verification | 503 `clerk_not_configured` |
| `CLERK_SECRET_KEY` | Clerk backend API (user email, billing read) | 503 `clerk_not_configured` |
| `CLERK_JWT_KEY` | optional: local RS256 verify, skips JWKS fetch | falls back to remote JWKS |
| `CLERK_JS_URL` | pinned Clerk Frontend API script URL, no fallback invented | `configured=false` |
| `CLERK_WEBHOOK_SIGNING_SECRET` | svix verification of billing webhook | webhook 503, `billing_enabled=false` |
| `CLERK_AUTHORIZED_PARTIES` | optional comma list overriding default `[request origin]` | azp must equal request origin |
| `CLERK_ADMIN_IDS` | comma list of Clerk user ids with admin access | nobody is admin |
| `TREG_API_KEY`, `OPENROUTER_API_KEY` (alias `JEV_API_KEY`, one OpenRouter key serves Jev and the chat models) | provider credentials | `run` 503 before any reservation, `providers:{...}:false` |
| `LEAD_SCORER_MODEL` | passed through to `executeLead` as `model` | provider default |
| `__TOOLKIT_TEST_PROVIDER` | selftest module path only | never set in production |

## Dependency

- `@clerk/backend@3.25.0` (verified installed and used by the tests). It is NOT yet in `package.json`: the parent owns the package merge and must add it to `dependencies` before deploy.
- Runtime APIs used from it: `createClerkClient().authenticateRequest(request, {authorizedParties, acceptsToken:'session_token', jwtKey})`, `client.billing.getUserBillingSubscription(userId)`, `client.users.getUser(userId)`, and `verifyWebhook(request, {signingSecret})` from `@clerk/backend/webhooks`.

## Migration

`migrations/0001_toolkit.sql`, five tables: `toolkit_settings`, `toolkit_accounts`, `toolkit_events`, `toolkit_runs`, `toolkit_ops`.

- Validated twice: through `wrangler d1 execute --local` (real D1 tooling, throwaway config, local state only) and through every selftest running the same SQL on `node:sqlite`.
- Apply at deploy time (parent, remote): add to `wrangler.jsonc`:
  `"d1_databases": [{ "database_name": "toolkit-db", "binding": "TOOLKIT_DB", "migrations_dir": "migrations" }]`
  then `npx wrangler d1 migrations apply toolkit-db --remote` (not run here).

## Operator settings (row in `toolkit_settings`, set by SQL or `admin_update`)

`admin_update` accepts only: `global_daily_cap_micro`, `welcome_credits`, `trial_pool_credits`, `default_daily_credit_cap`, `default_daily_row_cap` (global shape), or per user `daily_credit_cap`, `daily_row_cap`, `disabled`. Integers only, bounds checked, unknown fields rejected, readback returned, no credit grants, no admin changes.

Paid plan config is operator-only, set directly in D1:

```sql
INSERT INTO toolkit_settings (key, value) VALUES
  ('paid_plan_id', 'plan_xxx'),            -- plan id or slug from Clerk Billing
  ('paid_allowance_credits', '500')        -- credits per paid period, 0 = disabled
ON CONFLICT(key) DO UPDATE SET value=excluded.value;
```

`billing_enabled` in config requires `CLERK_SECRET_KEY` + `CLERK_WEBHOOK_SIGNING_SECRET` + both paid rows set with allowance > 0.

## Tests (all executed, all green)

```
node scripts/toolkit-store-selftest.mjs     46 checks  SQL guards, atomicity, caps, grants, settlement
node scripts/toolkit-api-selftest.mjs       91 checks  auth/IDOR/admin/replay/origin, end-to-end accounting
node scripts/toolkit-billing-selftest.mjs   29 checks  signatures, duplicates, out-of-order, failed payment
```

166 checks total, exit 0 each. The api and billing suites mock `globalThis.fetch` before importing `worker/toolkit.js` (the SDK captures fetch at module load) and assert at the end that zero unexpected network calls happened. Real RS256 session tokens are verified by the real `authenticateRequest`; webhook bodies are hand-signed with standard-webhooks HMAC and verified by the real `verifyWebhook`.

## Design notes

- Reservation is one guarded `INSERT ... SELECT` statement: wallet, user daily credit cap, user daily row cap, global daily micro cap and the 250000 micro app ceiling are all WHERE clauses, so concurrent runs across tool ids cannot both pass a stale read.
- 0 or absent means disabled for every cap, welcome grant, pool and paid allowance. Safe defaults, fail closed.
- Global spend = today's settlements + ALL unresolved holds across days. User daily credit caps count today's settlements plus all outstanding holds of that user.
- Balance is derived: `SUM(toolkit_events.credits) - SUM(runs.credits_used + runs.credits_held)`. Grants and receipts are idempotent keyed inserts (`welcome:<uid>`, `paid:<uid>:<item>:<period>`, `evt:<svix-id>`).
- Webhook is notification only: the handler re-reads the current subscription from the Clerk backend and grants only when subscription status is `active`, the item matches `paid_plan_id`, `is_free_trial` is false and `period_start > 0`, exactly once per item and period.
- Unknown provider cost keeps the full reserve held (`status='held'`), actual cost above the per-call reserve is stored unclamped and charged. Runs interrupted mid-flight stay `new` with their hold counted forever.
- Settlement is a single `WHERE status='new'` guarded UPDATE: double settle is a no-op.
- Email for an account row is fetched from Clerk only on that user's first `usage` call that finds an empty email.

## Known limits

1. No rate limiting beyond requiring sign-in for `quote`. Add per-user request throttling before public launch if abuse shows up.
2. Holds never expire, by contract. Unknown-cost runs need manual reconciliation through `toolkit_ops` (each op keeps provider, endpoint, reserved_micro, cost_micro).
3. Day boundaries are UTC. Daily caps reset at 00:00 UTC, not IST midnight.
4. `usage.credits_used`, `spent_micro` and `rows` in `usage`/`admin_usage` are TODAY's numbers. `credits_available` is lifetime-derived, `credits_held`/`held_micro` are current outstanding holds.
5. `daily_credit_cap`/`daily_row_cap` in `admin_usage` users are raw overrides, `null` means use the global default shown in `global`.
6. Per-user caps in `admin_update` cannot be reset to null from the API; SQL update clears an override.
7. `run_detail` and history exclude nothing from the owner but return 404 to everyone else including admins, per contract.
8. Billing relies on Clerk Billing webhook delivery. If a webhook is never delivered, that period's grant is minted only when a later billing event for the user arrives (receipts make every delivery idempotent). No cron reconciler exists yet.
9. Org-payer subscriptions grant nothing (personal allowance model only).
10. Launch checklist items owned elsewhere: retire the legacy Supabase scorer function explicitly at launch, no legacy schema migration needed; CSP additions for Clerk protect domains and Stripe origins are parent-owned; frontend must load the Clerk script only from `clerk_script_url`.
11. Migration was validated with wrangler `--local` and node:sqlite, never against remote D1.
