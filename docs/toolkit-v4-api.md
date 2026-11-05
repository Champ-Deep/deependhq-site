# Toolkit V4 API contract (delta on toolkit-v3-api.md)

Owner: default lane (architecture). Backend branch `feat/toolkit-v4-api`, UI branch `ui/toolkit-v4`, both cut from `toolkit-v4`.
Everything in `toolkit-v3-api.md` stays valid unless this file changes it. Units: 1 credit = 1000 micro = $0.001.
All actions are `POST /api/toolkit` with a Clerk session Bearer token, JSON body `{action, ...}`. Errors: `{error, message}`; show `message` as is.

## 1. Guided intake: `intake`

The user drops a file, types (or taps a chip for) what they want, and the model proposes a column mapping plus a plan. It runs multi-turn until the user approves.

Request:
```json
{"action": "intake",
 "file": {"name": "leads.csv", "rows_total": 50, "headers": ["Person Name", "Company", "Domain", "Job"],
          "samples": {"Person Name": ["Jane Doe", "Raj K"], "Job": ["VP Sales", "head of mktg"]}},
 "goal": "normalize titles and tell me which companies are SaaS",
 "history": [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```
Limits: headers 1 to 30, at most 5 samples per header, each 200 chars or less. Goal 2000 chars or less. History 12 turns or fewer, each 4000 chars or less.

Response:
```json
{"reply": "Plain-English answer, 600 chars or less",
 "question": "Optional single clarifying question, or null",
 "mapping": [{"source": "Person Name", "field": "person_name", "keep": true}],
 "plan": [{"column": "Job", "op": "normalize_title", "engine": "jev"},
          {"column": "Company", "op": "classify", "engine": "jev", "instruction": "Is this a SaaS company?", "categories": ["SaaS", "Not SaaS"]}],
 "chips": ["Also verify emails", "Research company size"],
 "model": "deepseek/deepseek-v4.1-flash", "cost_micro": 420}
```
- Field vocabulary: `person_name first_name last_name title company domain email phone linkedin_url city country industry other`.
- Every `plan` item must validate under the run rules in section 2. The server validates and drops invalid items, and adds a note to `reply` when it does. The UI always shows the mapping and plan as editable (dropdown per column, remove, add) and never runs anything from intake directly.
- Model is the admin setting `intake_model` (default `deepseek/deepseek-v4.1-flash`), via OpenRouter with `response_format: json_object`. Billing is the actual token cost: reserve 3000 micro, then settle. It counts against the same daily cap as runs.
- Starter chips the UI shows before the first turn: Enrichment, Title normalization, Categorization, Classification, Email verification, Company research.

## 2. Operations (quote and run)

| op | engines | notes |
|----|---------|-------|
| `normalize_title` | `jev` (default), `deepseek` | NEW. Returns `{title_normalized, seniority, function}`, 3 output columns |
| `classify` | `jev` (default), `deepseek` | unchanged |
| `verify` | `jev` (default), `deepseek` | unchanged |
| `research` | `deepseek` | NEW. `instruction` required, `output_columns` 1 to 3 names. Optional `web: true` uses the OpenRouter web plugin (max 3 results) and is priced into the quote |
| `enrich` | `treg` | unchanged |
| `verify_email` | `treg` | unchanged |

- `deepseek` means the admin setting `research_model` (default `deepseek/deepseek-v4.1-flash`). Prices come from the setting's stored per-token price (section 4).
- **Rows per job: up to 1000.** `quote` accepts up to 1000 rows. `run` stays at 100 or fewer rows per request. The UI splits a job into chunks of 100 with one `job_id` and one `request_id` per chunk, and stops on the first refused chunk. The quote must cover the whole job, and `can_run:false` explains which cap fails (user daily $1, balance, global $25 per day, pool).

## 3. Files (per user desktop storage)

Storage: R2 bucket `toolkit-files` (binding `TOOLKIT_FILES`). Index: D1 table `files`.
Quota: 50 MB and 500 entries per user. File limit 10 MB. Allowed: csv, xlsx, json, txt, md, pdf.

| action | body | returns |
|--------|------|---------|
| `files_list` | `{folder: "/"}` | `{entries: [{id, kind: "file"/"folder", name, path, size, mime, updated}], used_bytes, quota_bytes}` |
| `files_mkdir` | `{path: "/Leads/October"}` | `{entry}` |
| `files_put` | `{folder, name, mime, content_base64}` | `{entry}`. The name is made unique with " (2)" |
| `files_move` | `{id, folder?, name?}` | `{entry}`. Covers rename and move; a folder moves its children |
| `files_delete` | `{id}` | `{ok}`. A folder is deleted recursively |

Download: `GET /api/toolkit/files/<id>` with the Bearer token streams the bytes. 404 if the file isn't the caller's.
Workbench results are saved automatically as `/Workbench results/<source name> <YYYY-MM-DD HHmm>.csv` and returned as `result_file` on the last chunk.
A file dropped on the desktop is saved to `/` and opened in the Workbench.

## 4. Admin

- `admin_settings_get` returns `{settings: {intake_model, research_model, ...existing caps}, models: [{id, prompt_micro_per_mtok, completion_micro_per_mtok}]}`.
- `admin_settings_set` takes `{intake_model?, research_model?}`. The server checks the id against `https://openrouter.ai/api/v1/models` and stores its pricing with it. An unknown id returns 400. `intake_model` (and the one-pick `model`) must also support `tools`, because DeepBot runs on it; a model without tool calls returns 400 `model_unsupported`.
- `admin_ai_log` takes `{page, user_id?, action?, since?}` and returns 50 rows per page. `admin_ai_log_export` takes `{since}` and returns JSONL (10k rows max).
- User removal stays in the Clerk dashboard (link out). There's no delete in our admin.

## 5. AI query log (training data)

Every model call writes one record to D1 `ai_log` and, when the binding exists, `env.AI_LOG.send([record])` to a Cloudflare Basin Pipeline. That pipeline sinks into an Apache Iceberg table `default.toolkit_ai_log` (R2 Basin Catalog, bucket `toolkit-ai-log`). A failed log write never fails the user's request.

Record: `{id, ts, user_id, job_id, action, op, engine, model, goal, headers_json, prompt, response, tokens_in, tokens_out, cost_micro, outcome}`.

Privacy rule (decided, do not relax without Deep): **cell values are never logged.** In `prompt` and `response`, sample and row values are replaced with `[value]`. What gets kept: the goal, the conversation, headers, instructions, categories, plans, model outputs about the schema, cost and outcome. Retention is 180 days in D1, and a daily cron deletes older rows; Iceberg is the long-term copy. The Workbench shows one line: "We keep your instructions and the AI conversation (never your cell values) to improve the toolkit." `/privacy` gets the same sentence.

## 6. Off-the-clock feed (main site)

`GET https://deependhq.com/api/now-playing` (public, cached 120 s):
```json
{"spotify": {"state": "playing", "track": "...", "artist": "...", "url": "https://open.spotify.com/track/...", "art": "https://i.scdn.co/...", "at": "ISO"},
 "game": {"state": "favorites", "title": null, "at": null},
 "favorites": ["Split Fiction", "Overwatch 2", "Marvel's Wolverine"]}
```
- `spotify.state`: `playing`, `recent` or `off`. `game.state`: `playing`, `recent` or `favorites`.
- With no secrets, the response is `spotify.state:"off"` and `game.state:"favorites"`. The UI must render that state well, since it's the launch state.
- Spotify: refresh token in KV (set once by `/api/spotify/callback`, guarded by a one-time `state`), with secrets `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`. It calls currently-playing, falling back to recently-played.
- PSN: optional, secret `PSN_NPSSO`, unofficial API. If it's absent or failing, fall back to favorites.

## 7. Later (not in V4)
ChampBeam "Save to toolkit desktop" (postMessage from the ChampBeam iframe to `files_put`) comes after ChampBeam's Clerk cutover.

## 8. DeepBot (the toolkit agent)

One action, `deepbot`, on `POST /api/toolkit`. Bearer session token like every other action. It runs a tool loop over the same OpenRouter path as `intake` and `guide`, with the admin `intake_model` (the one-pick `model` setting sets it) and `OPENROUTER_API_KEY`. The model must support tool calls; routing sends `require_parameters: true`, so a model that does not fails the call (502) instead of ignoring `tools`.

Request:
```json
{"action": "deepbot", "thread_id": "uuid, omit to start a thread", "message": "1 to 2000 characters",
 "context": {"stage": "one of the guide stages", "window": "desktop app id, 40 chars", "targets": ["workbench.file.drop"], "selection": {"file_id": "uuid"}}}
```
`context` is optional. `targets` is the list of ids the page says it has (up to 200, letters, digits, dots, dashes, underscores). The model never sees the DOM and never emits a selector.

Response (200):
```json
{"thread_id": "uuid", "reply": "plain English, no em dashes",
 "steps": [{"op": "open|go|point|click|say", "target": "id", "say": "caption"}],
 "cards": [{"kind": "plan|quote|report|catalog|staged", "data": {}}],
 "asks": [{"id": "q1", "question": "...", "options": ["..."]}],
 "cost_micro": 0, "model": "deepseek/deepseek-v4.1-flash"}
```
Errors: 400 `invalid_deepbot`, 404 `thread_not_found` (another user's thread looks the same), 413 `turn_too_large`, 429 or 403 from the shared reservation (daily caps, balance), 502 `deepbot_failed` (provider down or empty reply; nothing is stored, the cost is settled), 503 `provider_not_configured`.

### Loop and limits
- Up to **6 tool rounds**, then one last call with no tools, so a turn always ends in a reply. A round may carry up to 4 tool calls.
- **60 s budget.** No new model call starts after 45 s (each call can take 15 s). Past a limit the reply is a fixed "I ran out of room" line and `ai_log.outcome` is `limit`.
- **Metering.** One reservation per turn on the shared ledger: `toolkit_runs.tool_id = 'deepbot'`, reserve **20,000 micro**, settled at the sum of the real call costs. Each model call is one `toolkit_ops` row. Before every call the loop prices it at the model's rates with the same upper bound the Workbench quote uses and stops if it could pass the reservation. Same daily caps as runs. `intake_plan` runs the existing intake action, which reserves and settles its own 3,000 micro as a separate `intake` run.
- **Free answers.** "What can you do?" (and `help`) returns the catalog card with no model call, no charge and no stored turn; `thread_id` is echoed or `null`.

### Tools (closed list, server side)
| Tool | Does | Output to the page |
|------|------|--------------------|
| `files_list {folder?}` | the Files `files_list` action | none |
| `file_peek {id}` | CSV only: headers (40 max), 5 sample rows, row and column counts | none |
| `intake_plan {file_id, goal}` | the `intake` action on that file's headers and samples | `plan` card, and an `ask` when intake has a question |
| `quote {file_id, plan}` | the `quote` action for column operations | `quote` card. **Never runs.** There is no tool that calls `run` |
| `report_summary {job_id}` | totals from the run ledger: chunks, rows, credits, spend, statuses | `report` card |
| `page_steps {steps}` | validates the steps below; the latest valid call becomes `steps` | `steps` |
| `catalog {}` | fixed JSON of apps, tools, connectors | none |
| `connector_pull {provider, op, args?}`, `connector_act {provider, op, args}` | the connector adapters (section 9). Act only stages | `staged` card for an act |

`page_steps` grammar (closed, up to 8 steps): `open` takes a desktop app id (`workbench`, `enrich`, `files`, `beam`, `pdf`, `account`), `go` takes a guide stage, `point` and `click` take an id from `context.targets`, `say` takes a caption. One bad step refuses the whole call with `{"error": "step_refused", "index": n}` and the model retries; the page receives nothing. A `click` on an id ending in `.run` or `.approve` is always refused: spend and approval are the user's click.

### Storage and privacy
Migration `0004_deepbot.sql`: `deepbot_threads (id, user_id, title, created_at)` and `deepbot_turns (thread_id, seq, role, content_json, cost_micro, ts)`. The last 20 turns (user and assistant, by `seq`) are the model's context. Tool calls inside a turn are not replayed.

Cell values are never stored. Sample values that `file_peek` or `intake_plan` handed to the model are replaced with `[value]` (the same `redact` as section 5) in `deepbot_turns`, the thread title and `ai_log`; the `file_peek` result is also logged with its sample rows removed. The reply the user sees is not redacted. `ai_log` gets **one record per turn** (`action: "deepbot"`, `op: "rounds=n"`, the whole tool transcript as `prompt`, tokens and cost summed), not one per model call.

## 9. Connections, connectors and invite requests

People connect their own work tools to the toolkit. Every connector has the same three verbs: **pull** (read), **work** (DeepBot and the user), **act**. An act never executes. It **stages** and returns a preview plus an approve action. The approve action is a separate API call that only the user's session makes, from a click in the mini window. No DeepBot tool can call it (the registry has no approve tool, and `connector_approve` as a tool name is `unknown_tool`).

Connector code lives in `worker/connectors.js`: one object per provider `{id, label, prefix, base(env), test(c), pulls, acts}`. Adding HubSpot later is one object and one catalog row.

### Setup (operator)
- Migration `0005_connections.sql`: `toolkit_connections`, `connector_staged`, `invite_requests`. Apply with `npx wrangler d1 migrations apply toolkit-db --remote`.
- Worker secret `CONNECTIONS_SECRET` (`openssl rand -base64 32`). Without it every connection action answers 503 `connections_not_configured`. Rotating it makes saved keys unreadable (`key_unreadable`); users save them again.
- Optional vars `HARBINGER_API_URL` (default `https://champ-harbinger.deep-ae0.workers.dev`) and `BEAM_API_URL` (default `https://champbeam.com`). The base URL is never taken from a request.

### Keys
Stored as AES-GCM ciphertext under `CONNECTIONS_SECRET`, bound to `user_id:provider` (a copied row does not open under another user). Read APIs return only a masked hint (`hb_live_****1234`). A key is **tested on save** with one read call to the provider; a key the provider refuses is not stored. A key in a DeepBot message is replaced with `[key]` before the model, the stored turn and `ai_log` see it. The key appears nowhere else: not in logs, errors, `ai_log` or tool results.

### Connection actions (session token)
| Action | Request | Response |
|--------|---------|----------|
| `connection_list` | `{}` | `{configured, connections: [{provider, label, key_prefix, state: "connected" or "not_connected", key_hint?, account?, connected_at?, pulls: [op], acts: [op]}]}` |
| `connection_save` | `{provider: "harbinger" or "beam", api_key}` | `{provider, state: "connected", key_hint, account}`. Errors: 400 `invalid_key_format` (wrong prefix: `hb_live_` Harbinger, `cb_live_` ChampBeam), 400 `key_rejected`, 400 `unknown_provider`, 502 `provider_down`, 503 `connections_not_configured`. Saving again replaces the key |
| `connection_delete` | `{provider}` | `{provider, state: "not_connected"}` |

### Pull, act, approve (session token)
`connector_pull {provider, op, args?}` returns `{provider, op, data}`. `connector_act {provider, op, args}` returns the staged object:
```json
{"staged_id": "uuid", "provider": "harbinger", "op": "push_campaign", "status": "staged",
 "preview": {"name": "Q4 push", "file": "leads.csv", "rows": 2, "will_import": 2, "fields": ["person_name", "email"], "note": "..."},
 "approve": {"action": "connector_approve", "staged_id": "uuid"}, "expires_at": "ISO, one hour"}
```
`connector_approve {staged_id}` runs it, once. Responses: 200 `{staged_id, status: "approved", result}`; a second click 200 with `already_approved: true` and the first result, nothing runs again; 404 (not yours or unknown); 409 `not_approvable` (already approving or failed); 410 `expired`; 400 or 502 `{error, message, staged_id, status: "failed"}` when the provider fails (a failed stage is not retried: stage again).

Errors for pull, act and approve: `unknown_provider`, `unknown_op`, `not_connected`, `connections_not_configured`, `key_unreadable`, `invalid_key` (provider 401: revoked, ask for a new key), `not_allowed` (provider 403: for Harbinger, no invite yet), `provider_down`, `provider_refused`, `invalid_args`, and file errors (`not_found`, `unsupported_type`). A mini window maps these to its states: no key (`not_connected`), invalid key, invite-only (`not_allowed`), provider down.

| Provider | Pulls | Acts (staged, then approved) | Calls made |
|----------|-------|------------------------------|------------|
| `harbinger` (`X-API-Key: hb_live_...`) | `capacity_today` (sends left per mailbox), `campaigns` (`id, name, status`, 50 max), `drafts_pending` (50 max) | `plan_campaign {goal, file_id?}` approve = `POST /api/goal/plan` (spends nothing). `push_campaign {file_id, mapping, name}` approve = `POST /api/campaigns` then `POST /api/import-csv`, result `{campaign_id, imported, approve_url}` (2,000 contacts max). Sending stays inside Harbinger's own approve surface | `GET integrations/status` (test), `GET overview/today`, `GET campaigns`, `GET outreach/drafts?status=pending` |
| `beam` (`X-API-Key: cb_live_...`) | `stats {id}` (a ChampBeam file id; `GET /api/v1/files/{id}/summary`) | `share_file {file_id}` (toolkit file, 20 MB max) approve = init, PUT, finalize, result `{file_id, share_url}` | `GET content/mine/shares` (test) |

`push_campaign.mapping` is intake's mapping: `[{source: header, field, keep?}]` with `field` from the intake field list. It needs a name, email or LinkedIn column. `will_import` in the preview is the real cap.

### In DeepBot
`connector_pull` and `connector_act` replace the section 8 stubs. Pulled data goes to the model but `ai_log` records `[connector data]`. `connector_act` adds a `{kind: "staged", data: <staged object>}` card for the window to render; the reply must not claim it happened. The free catalog (`catalog` tool and "what can you do") shows each connector as `connected` or `not_connected` with its pulls and acts.

### Invite requests (ChampHarbinger access)
A user asks Deep for a Harbinger invite; Deep mints it by hand; the user then saves their own `hb_live_` key.

| Action | Who | Request | Response |
|--------|-----|---------|----------|
| `invite_request_create` | signed-in user | `{note?}` (500 characters) | 201 `{request: {id, status: "open", created_at}, already_open: false}`. With one already open: 200, same shape, `already_open: true`, no new row. 429 `rate_limited` at 3 requests per user per 24 hours or 50 across all users per hour |
| `admin_invite_requests` | admin | `{status?: "open" (default), "invited", "declined", "all"}` | `{requests: [{id, user_id, email, note, status, draft_to, draft_subject, draft_body, created_at, resolved_at}]}`, newest first, 200 max |
| `admin_invite_request_resolve` | admin | `{id, status: "invited" or "declined"}` | `{id, status}`; 404 `not_open` if already resolved. Resolving lets the user ask again |

**Nothing is sent.** There is no outbox in the Worker, so the email to Deep is a draft stored on the row (`draft_to` is the first `CLERK_ADMIN_EMAILS`, plus `draft_subject` and `draft_body`), shown in the admin list. Deep copies it or lets the inbox lane stage the Outlook draft from it. The user's note is stored with dashes and control characters cleaned.
