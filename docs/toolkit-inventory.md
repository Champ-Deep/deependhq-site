# Toolkit inventory audit: owned public tools

Read-only consolidation audit for the deependhq.com toolkit gallery. Source of truth: `content.json` `toolkit` (30 entries), the derived `stack_now` in `data.js` (51 items, built by `scripts/derive.mjs:210`), `ToolkitPage.jsx`, `worker/index.js`, `lead-scorer.html`.

Method: HTTP GET only, no login, no paid API calls. 28 unique URLs probed: 25 x HTTP 200, 1 x 301 (ChampUTM repo, see duplicates), 2 x 405 (`/api/decide`, `/api/collect`, expected, POST-only routes confirmed present). An extra 404 probe of `assistant.deependhq.com/widget.js` was my wrong path; the real path `/static/widget.js` returns 200.

Availability wording is deliberate. "HTTP 200 reachable" means the URL answered. It does not mean the tool is integrated, authenticated, or that its core workflow was exercised. No row below is marked integrated, because none was verified as integrated.

## Canonical inventory

| id | name | source path | product URL | observed availability | Clerk / shared wallet | recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| champbeam | ChampBeam | `content.json#toolkit[0]` | https://champbeam.com | HTTP 200, title "Champbeam". Workflow (create/link/track) not exercised | unknown, no Clerk code in repo | canonical gallery card for smart links. Product URL first, GitHub secondary. Absorb ChampUTM |
| champutm | ChampUTM | `content.json#toolkit[3]` | none (GitHub only) | GitHub 301 redirects to `Champ-Deep/ChampBeam`. Duplicate, already merged upstream | unknown | fold into champbeam, keep one row, preserve old link as alias |
| lead-scorer | Lead Scorer | `content.json#toolkit[2]`, `lead-scorer.html:254`, `wrangler.jsonc:27` | https://deependhq.com/lead-scorer | HTTP 200, title "Lead Scorer". Scoring workflow not exercised, team passcode required | known, not integrated. Uses team passcode against a Supabase edge function, no Clerk anywhere | first Clerk candidate per platform doc. Replace passcode auth, then reserve/settle credits server side |
| champpdf | ChamPDF | `content.json#toolkit[23]` | https://champdf.com | HTTP 200, title "ChamPDF - Free Online PDF & Media Tools". Browser-local claims not exercised | unknown, no Clerk code in repo | free/browser-local category. No signup, no credit charge for client-side work |
| event-scout | Event Scout | `content.json#toolkit[24]` | https://event-scout-delta.vercel.app | HTTP 200, title "Event Scout - Mobile". Vercel preview host, status "building". Workflow not exercised | unknown, no Clerk code in repo | label as preview/building, no Try now until a stable host and verified flow |
| deep-scan | Deep Scanner | `content.json#toolkit[1]` | placeholder `#` | no URL exists, status "building", no public artifact | unknown | omit from public launcher or show as coming soon, no button |
| champset | ChampSet | `content.json#toolkit[5]` | placeholder `#` | no URL, description says "building now" | unknown | coming soon, no button |
| champops | ChampOps | `content.json#toolkit[6]` | placeholder `#` | no URL, internal maintenance loop | unknown | internal only, keep out of the customer gallery |
| champmail | ChampMail | `content.json#toolkit[4]` | none (GitHub only) | GitHub 200. No product site advertised | unknown, no Clerk code in repo | repo/stack section. Do not advertise as a public product until a product URL exists |
| champgraph | ChampGraph | `content.json#toolkit[7]` | none (GitHub only) | GitHub 200 (`Graphiti-knowledge-graph`) | unknown | stack section, internal engine behind ChampIQ |
| b2b-pulse | B2B Pulse | `content.json#toolkit[8]` | none (GitHub only) | GitHub 200 | unknown | internal automation, stack section only |
| deependhq-site | deependhq-site | `content.json#toolkit[9]` | none (GitHub only) | GitHub 200 | unknown | build record, /stack secondary section |
| champcms | ChampCMS | `content.json#toolkit[10]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| champlens | ChampLens | `content.json#toolkit[19]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| champiq | ChampIQ | `content.json#toolkit[20]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| lak stream | LakeStream | `content.json#toolkit[21]` | none (GitHub only) | GitHub 200, status "internal" | unknown | internal only, keep out of the public launcher |
| five-level-email-personalizer | 5-Level Email Personalizer | `content.json#toolkit[22]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| champ-obscura | Champ Obscura | `content.json#toolkit[25]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| lakecurrent | LakeCurrent | `content.json#toolkit[26]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| champquest | ChampQuest | `content.json#toolkit[27]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| slidesmith | SlideSmith | `content.json#toolkit[28]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| champvideo | ChampVideo | `content.json#toolkit[29]` | none (GitHub only) | GitHub 200 | unknown | repo-only listing, /stack section |
| showcase | Showcase page | `worker/index.js:349`, route `worker/index.js:533` | https://deependhq.com/showcase?d=example.com | verified workflow, read-only. GET returned a rendered page for example.com, cached a day | unknown, no auth by design, stores nothing about the asker | keep free and ungated, it spends nothing. Showcase as a same-site utility |
| decide-demo | Decide demo endpoint | `worker/index.js:251`, route `worker/index.js:532` | https://deependhq.com/api/decide | route present, GET returns 405. POST workflow not exercised, it would spend OpenRouter credits | unknown, no auth, returns 503 when the key is absent | metered candidate. Needs identity plus a credit gate before it is showcased as usable |
| ask-deep | Ask Deep chat widget | `index.html:74`, host `assistant.deependhq.com` | https://assistant.deependhq.com/static/widget.js | widget script HTTP 200. Chat conversation not exercised | unknown, third-party widget host, footer discloses IP/location capture | not a launcher tool. Keep as site feature, do not put in the credit gallery |

## Counts, computed from the data

| measure | value | source |
| --- | --- | --- |
| `content.json` `toolkit` entries | 30 | 9 tool, 13 repo, 5 skill, 3 resource |
| `stack_now` items | 51 | built 19, using 15, trying 4, watching 5, skill 8 |
| external entries inside `stack_now` (not owned) | 21 | 15 `shoutouts.items` + 6 `tools` |
| skills/resources excluded from this product inventory | 8 | all carry placeholder `#` |
| owned rows in this inventory | 25 | 22 toolkit products + 3 same-site worker/host surfaces |
| placeholder `#` URLs across all toolkit entries | 11 | 3 tools + 8 skills/resources |
| GitHub-only owned listings | 15 | no product URL advertised |
| owned entries with a real product/site URL | 3 | ChampBeam, ChamPDF, Event Scout |
| same-site path entries | 1 | Lead Scorer at `/lead-scorer` |
| unique URLs probed by GET | 28 | 25 x 200, 1 x 301, 2 x 405 |
| Clerk integrations found in repo code | 0 | grep for clerk/billing/shared credit matches only journey prose |
| tools verified as integrated with a shared wallet | 0 | none claimed, none proven |

## Duplicates and consolidation

- ChampUTM is a duplicate of ChampBeam. The ChampBeam description in `content.json` already says "ChampUTM lives inside it now", and `https://github.com/Champ-Deep/ChampUTM` issues a 301 to `Champ-Deep/ChampBeam`. The catalog still lists two cards. One canonical row: champbeam.
- "The Champ Suite" in `content.json` `tools` is a name-only aggregate of ChampMail, ChampGraph, ChampVoice. Not a runnable product, no URL. Keep out of the launcher.
- "ChampOps loop" in `tools` duplicates the ChampOps entry. Same story.

## Availability classes, applied

| class | entries |
| --- | --- |
| public reachable, workflow exercised read-only | showcase page |
| public reachable, workflow NOT exercised | ChampBeam site, ChamPDF site, Event Scout site, Lead Scorer page, Ask Deep widget script |
| route present, workflow NOT exercised | decide demo (405 on GET), analytics collect (405 on GET, not a user tool) |
| repo-only listing, GitHub 200, no product URL | 15 entries, see table |
| duplicate, redirects to canonical | ChampUTM |
| placeholder URL, nothing to visit | 11 entries, 3 tools + 8 skills/resources |
| internal-only | LakeStream (status internal), ChampOps, Deep Scanner, ChampSet |
| external dependency, never ours to gate | 21 shoutout/stack entries (Supabase, Firecrawl, Claude, Cloudflare, Jules and friends) |

## Clerk and shared-wallet status

Zero Clerk, billing, or shared-credit code exists in this repository outside of prose. The only Clerk mention is a journey log line about a different product's HR portal. Lead Scorer today authenticates with a team passcode against `kdxmzaliwestummrnygd.supabase.co/functions/v1/lead-scorer`, which the platform doc explicitly supersedes. Every row is therefore "unknown" except Lead Scorer, which is "known not integrated".

Cross-tool credit enforcement cannot be read from this repo at all. It needs a server-side ledger per `docs/toolkit-platform.md`, and no such ledger exists here.

## Not checked, and the risk that comes with it

Skipped: POST to `/api/decide` (spends OpenRouter credits), any login or paid flow on champbeam.com/champdf.com, and the whole `deependhq-next/` app, which is not evidence of the live host. Risk: "HTTP 200 reachable" on three product sites is a liveness fact only. If the gallery renders them as working, sign-in-ready tools, that claim is unsupported by everything measured here.
