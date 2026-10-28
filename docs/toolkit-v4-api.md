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
- `admin_settings_set` takes `{intake_model?, research_model?}`. The server checks the id against `https://openrouter.ai/api/v1/models` and stores its pricing with it. An unknown id returns 400.
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
