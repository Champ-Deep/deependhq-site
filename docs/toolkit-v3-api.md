# Toolkit V3 API contract (frontend lane)

Extends `docs/toolkit-api.md` (still authoritative for `config`, `usage`, legacy lead-scorer `quote`/`run`, `run_detail`, `admin_usage`, `admin_update`, webhook). This file covers what V3 added. Source of truth is the code: `worker/toolkit.js`, `worker/column-ops.js`, `worker/index.js`.

## Hosts

| Host | Path | Serves |
|---|---|---|
| toolkit.deependhq.com | `/` | `toolkit-app.html` (desktop) |
| toolkit.deependhq.com | `/sign-in` | `toolkit-signin.html` |
| toolkit.deependhq.com | `/api/toolkit`, `/api/toolkit/config`, `/api/toolkit/webhook` | toolkit handler |
| toolkit.deependhq.com | anything else | 404 |
| deependhq.com | unchanged, `/toolkit` stays the public gallery | |

All calls: `POST /api/toolkit`, same origin only, `Authorization: Bearer <Clerk.session.getToken()>`, JSON `{action, ...}`. Errors are non-2xx `{error, message?}`.

## Units

1 credit = 1,000 USD micro = $0.001. Show money as dollars: `micro / 1e6`. Deep's daily cap is $1 = `daily_credit_cap` 1000. Defaults are 0 (fail closed) until the admin sets them, so a fresh deploy shows zero allowance: design that state.

## Data Workbench: `quote` with `columns`

Sending `columns` switches `quote`/`run` into column-ops mode.

Request:

```json
{
  "action": "quote",
  "rows": [{"Company": "Acme", "Domain": "acme.com", "Email": "a@acme.com", "Contact": "Jane Doe"}],
  "columns": [
    {"column": "Email", "op": "verify_email"},
    {"column": "Domain", "op": "enrich", "fields": ["name", "title", "company"], "name_column": "Contact", "domain_column": "Domain"},
    {"column": "Company", "op": "classify", "engine": "jev", "instruction": "Which industry is this company in?",
     "categories": [{"name": "SaaS", "description": "sells software"}, "Manufacturing"]},
    {"column": "Company", "op": "verify", "engine": "deepseek", "instruction": "Is this a real company name?"}
  ]
}
```

Limits (validation errors return 400 `invalid_columns` with a human `message`, show it as is):

- rows 1 to 100 per run (chunk bigger files in the UI), 1 to 30 keys per row, cell <= 1000 chars, column name <= 100 chars.
- columns 1 to 8 operations; `column`, `name_column`, `domain_column` must be keys present in rows.
- `op`: `enrich` | `verify_email` | `classify` | `verify`.
- `engine`: enrich and verify_email are `treg` only (default). classify and verify are `jev` (default) or `deepseek` (`deepseek/deepseek-v4.1-flash`).
- `enrich.fields`: subset of `name`, `title`, `company` (default all). An enrich cell is usable if it is a LinkedIn profile URL, an email, or a domain plus a person name (`name_column`).
- `classify`: `instruction` required (<= 1000), 2 to 30 distinct `categories` (string or `{name<=80, description<=200}`). An `Unclassified` option is added automatically.
- `verify`: `instruction` required, a yes/no question. No categories.

Response:

```json
{
  "row_count": 1,
  "max_cost_micro": 26000,
  "max_credits": 26,
  "columns": [{"column": "Email", "op": "verify_email", "engine": "treg", "distinct_count": 1, "skipped_rows": 0, "calls": 1, "max_cost_micro": 10000}],
  "warnings": ["..."],
  "fits_batch_ceiling": true,
  "batch_ceiling_micro": 250000,
  "allowance": {"credits_available": 2000, "daily_credit_cap": 1000, "remaining_daily_credits": 974,
                "remaining_daily_micro": 974000, "daily_row_cap": 0, "remaining_daily_rows": 0, "disabled": 0},
  "can_run": true
}
```

Show per-column `max_cost_micro` and total as "up to $X", plus `remaining_daily_micro` as "left today". Identical values in a column are billed once (`distinct_count`); blank or unusable cells are skipped (`skipped_rows`). `can_run:false` must explain which limit failed (batch ceiling, disabled, balance, daily credits, daily rows).

## Data Workbench: `run`

```json
{"action": "run", "tool_id": "data-workbench", "request_id": "<uuid v4>", "list_name": "Oct leads",
 "rows": [...], "columns": [...], "max_credits": 26}
```

`max_credits` must be >= the quote's `max_credits` (else 400 `max_credits_below_quote`). Same `request_id` + same payload returns the stored run; a different payload with that id is 409 `request_conflict`. Never auto-retry under a new id.

Errors: 503 `provider_not_configured` (today's real state, no keys), 400 `batch_ceiling`, 400 `invalid_columns`, plus the reservation failures from `docs/toolkit-api.md` (insufficient credits, daily caps, global cap).

Response: same envelope as legacy runs (`id, status, credits_used, credits_held, spent_micro, held_micro, ledger, error?`) with `results` an array per column operation:

```json
{"column": "Company", "op": "classify", "engine": "jev", "distinct_count": 2,
 "row_map": [0, 1, -1],
 "items": [{"value": "Acme", "label": "SaaS", "confidence": 0.91, "review": false}]}
```

- Map item results back to rows with `row_map[rowIndex]` (`-1` = skipped row).
- `label` values: classify: a category or `Unclassified`; verify: `pass` | `fail` | `review`; verify_email: `deliverable` | `undeliverable` | `risky` | `unknown` | `not_checked`; enrich: `found` | `not_found`; any op: `error` (with `note`) or `not_run`.
- `review: true` means a human should look. Enrich hits carry `name/title/company` (as requested), `source`, `checked_at`, `note`. Email results carry `status`, `source`, `checked_at`, `note`.
- If a provider charge cannot be reconciled the run stops, finished items are kept, and status is held or failed. Never present a held run as free.

## Admin (only when `usage.user.is_admin`)

Admin = Clerk user with a VERIFIED address in `CLERK_ADMIN_EMAILS` (`deep1499@gmail.com`), or uid in `CLERK_ADMIN_IDS`. Non-admin calls get 403.

`admin_users` `{page?: 1}` -> `{day, page, page_size: 50, total, has_more, users: [{id, email, credits_available, credits_held, credits_used_today, spent_micro_today, rows_today, daily_credit_cap|null, effective_daily_credit_cap, daily_row_cap|null, effective_daily_row_cap, disabled}]}`. `null` cap = uses the global default.

`admin_grant` `{target_email | target_uid (exactly one), credits: 1..100000, reason: 1..200 chars, idempotency_key: /^[A-Za-z0-9._:-]{8,64}$/}` -> `{granted, replayed, user: {id, email}, credits_available}`. Generate one key per form submission (e.g. `crypto.randomUUID()`) and reuse it on retry. Errors: 400 `invalid_credits` | `invalid_reason` | `invalid_idempotency_key` | `invalid_target`, 404 `target_not_found` (no Clerk user with that VERIFIED email), 409 `idempotency_conflict`, 503 `clerk_unavailable`.

`admin_update` (unchanged): per user `{user_id, daily_credit_cap?, daily_row_cap?, disabled?}` or global `{global_daily_cap_micro?, welcome_credits?, trial_pool_credits?, default_daily_credit_cap?, default_daily_row_cap?}`.

## Fixtures for the browser gates

`tests/fixture_server.py --port 3175` and `node scripts/toolkit-browser-server.mjs` (3176) run the real handler against SQLite with fixture providers and locally signed identities. Extend `scripts/toolkit-integrated.browser.py`. No fixture endpoint ships in public assets.

## Known limits

- Enrich returns only name, title, company in V3.
- 100 rows per run; the UI chunks larger files sequentially with fresh request ids per chunk.
- Live Treg, OpenRouter (Jev, DeepSeek) and Clerk email lookup are unverified until keys exist.
