# Toolkit implementation contract (current)

This replaces Supabase OTP and ls_ database drafts. Host in existing Cloudflare Worker, use optional TOOLKIT_DB D1 binding and Clerk. No full-site Next migration. No deployment or commits in this task.

## Routes / response

GET `/api/toolkit/config`: `{configured,clerk_publishable_key,clerk_script_url,billing_enabled,credits_per_usd:1000,providers:{treg,jev}}`. clerk_script_url is operator config CLERK_JS_URL pinned full SDK URL on the production Clerk Frontend API domain. No fallback invented hostname. Missing settings configured=false. Frontend loads Clerk script only from this backend URL, sets data-clerk-publishable-key, awaits Clerk.load(); native JS mountPricingTable, openSignIn, mountUserButton. Look up these exact documented APIs before use. Never put tokens in URLs or localStorage. `Clerk.session.getToken()` at each API call. `Clerk.addListener` updates UI on auth state changes.

POST `/api/toolkit`: Authorization Bearer Clerk session token, JSON `{action,...}`. Backend validates authenticated user subject and authorizedParties. No client-selected user id except admin target. JSON failures `{error}` non-2xx. Only same-origin permitted. No permissive CORS. Read/config/billing response Cache-Control no-store.

- `usage`: `{user:{id,email,is_admin},usage:{day,credits_available,credits_held,credits_used,spent_micro,held_micro,rows,daily_credit_cap,daily_row_cap,disabled},providers:{treg,jev},runs:[{id,job_id,tool_id,list_name,status,created_at,row_count,credits_used,credits_held,spent_micro,held_micro}]}`.
- `quote`: `{rows,icp,enrich,verify_email,custom}` -> `{row_count,max_cost_micro,max_credits,breakdown:{enrichment_micro,email_micro,jev_micro},warnings:[]}`. No spending. Require signin for request throttling, no free public provider calls.
- `run`: `{tool_id:'lead-scorer',request_id:UUID,list_name,rows,icp,enrich,verify_email,custom,max_credits}` -> `{id,status,results,credits_used,credits_held,spent_micro,held_micro,ledger:[{provider,endpoint,status,cost_micro,reserved_micro}],error?}`. Maximum 5 rows per batch, UI sequential chunks; no automatic retry under NEW UUID. Same UUID/payload returns existing result/status, different payload rejects. Reservation is atomic global AND user budget AND wallet. Unknown provider costs retain holds; never count timeouts as free. No automatic hold expiry.
- `run_detail`: `{id}` -> same run, owner only, even admin cannot read other people's uploaded rows. `usage` history max30 initially.
- `admin_usage`: `{day,global:{daily_cap_micro,spent_micro,held_micro,welcome_credits,trial_pool_credits,default_daily_credit_cap,default_daily_row_cap},users:[{id,email,daily_credit_cap,daily_row_cap,disabled,credits_available,credits_used,credits_held,spent_micro,rows}]}`.
- `admin_update`: `{user_id,daily_credit_cap,daily_row_cap,disabled}` or `{global_daily_cap_micro,welcome_credits,trial_pool_credits,default_daily_credit_cap,default_daily_row_cap}`. Integers, explicit nonnegative bounds. No arbitrary credit grants in this endpoint. No self-admin elevation. Readback after save.

POST `/api/toolkit/webhook`: Clerk signed billing webhook. Verify official SDK. Treat as notification; fetch CURRENT user subscription from Clerk backend, do not trust body amount/metadata. Only configured plan matching ACTIVE PAID current period grants configured allowance, exactly once per user+subscription-item+period. No grants for free trials, past-due/incomplete or unverified webhook. Unsupported event ACK no grant. Duplicate/out-of-order delivery safe. Persist receipt / grant atomically. Simple first release uses subscription allowance grant model and explicit rollover (unused credits retained); do not invent expiration until commercial policy approved. Defaults welcome0 / paid grant0, global provider cap0. Document this as disabled pending config.

## Shared wallet implementation

Use Clerk subject strings, not Supabase UUID users. D1 SQLite transaction/trigger or batched conditional SQL, NEVER read balance then update without atomic guard. Store accounts, grants idempotency, runs reservations and per-provider operations. Available=granted-actual_credit_charge-held_credits. Pricing version stored per run, integer 1 credit = 1000 USD microdollars of provider-budget allowance (internal accounting unit, not a claim that paid subscription price equals cost). Credit settlement ceil actual micro/1000, unknown holds ceil reserve/1000; quote and reserves compute once using same helper. App hard scope ceiling 250000 micro per batch. Admin can set provider caps lower. Global spends count daily settlements plus ALL unresolved holds across days. Concurrency test with two tool ids against same wallet, but don't publish a second provider tool until actually integrated. Individual credit grants are bounded by aggregate configured trial pool.

## Provider module interface (parent owns)

`worker/lead-scorer.js` exports:

- `validateLeadInput(body)` -> canonical `{rows,icp,enrich,verify_email,custom}` or throws Error with safe validation message. At most5 rows, 30 columns,1000chars/value, row total 6000chars, icp2000chars, custom max3.
- `quoteLead(input)` -> quote shape above; uses static conservative configured ceilings per request: enrich 6000 micro/row, email verify 10000 micro/row, Jev 10000 micro for one batch (bounded input). Total <=90000 micro for5rows. Treg routed max-cost header enforced; Jev ceiling is a conservative application reservation, not an upstream guaranteed invoice ceiling. Must clearly document vendor price changes can break bound, overage halts execution.
- `executeLead(input, {tregKey,jevKey,model,call,fetcher?})` -> array of row results. `call({provider,endpoint,reserve_micro}, perform)` executes `perform()` exactly once and returns `{data,cost_micro:number|null,ok:boolean}`. perform handles HTTP/network timeout and returns raw JSON + cost if known. Adapter MUST log reservation before invoking perform; record actual after (including error responses). When cost unknown, hold full reserve; if cost exceeds ceiling halt further calls. Provider module never silently retries. Missing credentials detected before reservation/dispatch; no simulated fallback. Jev all questions batched in one request.

Result rows as initial contract: `{input,email_status,email_reason,email_checked_at,email_source,icp_fit,custom,enrichment_status,evidence,notes}`. 'Unjudged' missing Jev. Email statuses deliverable/undeliverable/risky/unknown/not_checked are provider-derived only.

## Frontend ownership

UI agent: replace lead-scorer.html + external lead-scorer.css/js/helper, author standalone `account.html` + `toolkit-account.js` if helpful. Shared `toolkit-session.js` handles Clerk loading/signin/account buttons, consumes config and wallet. Parent modifies ToolkitPage.jsx to add curated public launcher and shared signin mount alongside existing stack record. Don't alter toolkit.html prerender directly. All pages use same session module, no duplicate auth.

Keep no secret in any file. Clerk SDK is installed server-side only @clerk/backend by backend agent. Config/docs .example only names not real values. Parent owns worker/index.js routing, wrangler config, .assetsignore and main package merge. Backend agent owns worker/toolkit.js + worker/toolkit-store.js + migrations + backend test scripts in isolated worktree. No paid external calls, no deployment.
