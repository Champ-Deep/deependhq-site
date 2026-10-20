# Lead Scorer public upgrade contract

> SUPERSEDED for identity, usage and billing by `toolkit-platform.md`. User correction: Clerk handles shared accounts and Clerk Billing; one platform credit wallet spans all integrated tools. Do not implement Supabase OTP, standalone per-tool accounts or admin-grant-only public trials. The upload, provider evidence and results shapes below remain useful draft specifications.

Scope: upgrade /lead-scorer in the existing static site, keep Supabase backend, no framework rewrite. Public email OTP signup. Each user owns their runs. New accounts have zero paid allowance. Only an administrator can grant daily row and USD limits. No payments, outreach sending, public share links or chat agent in this release.

## API

New Supabase Edge Function `lead-scorer-public`. Every POST sends `Authorization: Bearer <Supabase access token>` and JSON `{action,...}`. User identity always comes from `/auth/v1/user`, never from request body. GET `?action=config` returns `{supabase_url,publishable_key,configured}` (public key only). JSON failures `{error}` with non-2xx status. All money is integer USD microdollars, displayed by dividing by 1000000. UTC daily reset.

Actions:

- `usage`: `{user:{id,email,is_admin}, usage:{day,spent_micro,held_micro,rows,daily_cap_micro,daily_row_cap,disabled}, providers:{treg:boolean,jev:boolean}, runs:[{id,list_name,status,created_at,row_count,spent_micro,held_micro}]}`. Never expose other users to normal users.
- `quote`: input `{rows,icp,enrich,verify_email,custom}`; output `{row_count,max_cost_micro,breakdown:{enrichment_micro,email_micro,jev_micro},warnings:[]}`. No provider calls.
- `run`: input `{request_id:UUID,list_name,rows,icp,enrich,verify_email,custom,max_cost_micro}`. Response `{id,status,results,spent_micro,held_micro,ledger:[{provider,endpoint,status,cost_micro,reserved_micro}],error?}`. At most 5 rows per batch. UUID reused on retry with same payload. Existing in-flight run returns status without reissuing provider calls. The UI must not retry a failed run under a new UUID automatically.
- `run_detail`: input `{id}`; same run response, only owner. Private history can be revisited.
- `admin_usage`: admins only. `{day,global:{daily_cap_micro,spent_micro,held_micro},users:[{id,email,daily_cap_micro,daily_row_cap,disabled,spent_micro,held_micro,rows}]}`.
- `admin_update`: admins only. `{user_id,daily_cap_micro,daily_row_cap,disabled}` or `{global_daily_cap_micro}`. Read back admin_usage after save.

Row is a string-valued object, maximum 30 columns and 1000 characters per value. Canonical fields `name,email,title,company,domain,linkedin`. Preserve other uploaded columns for user-defined scoring. UI maps source columns to canonical fields without discarding the source. Server validates limits and URL/email shape. Maximum ICP 2000 characters.

`custom`: array of at most 3 `{id,label,type,instructions,criteria}`. id is c0, c1, c2. type is `score` or `category`. instructions max 500 characters. criteria is an ordered array of 2 to 5 distinct labels, each max 100 characters. Scores display the returned bucket label and index, not an invented calibrated probability. Category must use one of the requested labels.

Results: `{input:row,email_status:'deliverable'|'undeliverable'|'risky'|'unknown'|'not_checked',email_reason,email_checked_at,email_source,icp_fit:'Strong fit'|'Possible fit'|'Weak fit'|'Not a fit'|'Unjudged',custom:{[id]:{label,index?}},enrichment_status:'found'|'not_found'|'not_checked'|'error',evidence:{title?,company?,source?,checked_at?},notes:string[]}`. Deliverability is always a provider observation, never a Jev prediction; risky/catch-all never maps to deliverable. No guarantee of inbox placement. Missing/malformed Jev answers are Unjudged, never a rules score posing as a model result.

## UI

Use a same-origin external ES module and CSS, not a CDN application bundle. Existing SheetJS can be reused only by vendoring a patched release with provenance. Native CSV parser and CSV export require tests. Upload maximum 5 MB / 1000 rows. Browser holds the file; sends selected mapped rows in batches of five. Explain transfer to Supabase, Treg and Jev before run. No real people or client data in examples. Page stays useful while signed out: configure brief, local preview, estimated workflow. Missing backend produces a clear setup-needed state, never fake results.

Three main tabs: Workspace, Run history, Usage. Admin only: Users & limits. Cost panel shows maximum authorized cost, actual spend and unresolved holds separately. Allow run budget input, explicit confirmation via run button. Stop between batches, no promise to cancel a provider request already dispatched. Exports formula-safe CSV. Session stays in memory or sessionStorage, clear on signout; never URL tokens or localStorage credentials. Email OTP sent using Supabase REST /auth/v1/otp then verified /auth/v1/verify. Configure email OTP template and abuse protection before public deployment.

## Implementation boundary

Changes reach frontend upload/auth/results/export/admin callers, new backend validation/provider/metering modules, Postgres migration with RLS and service-role-only RPCs, API tests, concurrency database tests, browser fixtures, asset exclusions and route CSP, design spec and release instructions. Existing unrelated site content and legacy database records are untouched. Retire the legacy Edge Function at release rather than leave a second uncontrolled spending path.

Production is not deployed by this task. No provider credentials are present in the current process. Live vendor calls and hosted signup must be verified after server-side configuration. Tests use explicitly labelled provider fixtures, not claimed live verification.
