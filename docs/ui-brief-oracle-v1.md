# UI brief: ChampOracle in the deependhq toolkit (`/oracle`)

Owner of this brief: main lane. Builder: `frontend` lane. Reviewer: `reviewer`.

## Goal

A tool page on deependhq.com where Deep (or the team, with the passcode) pastes a client's current messaging and gets back a share link to that client's simulated audience universe and insights report. The run happens on the hosted champoracle-agent; this page only collects the brief, shows progress, and hands over the link.

## Where

- Repo `~/repos/deependhq-site`, branch `oracle-toolkit` (branch from it).
- New page `oracle.html` next to `lead-scorer.html` (same head, favicon, manifest, `noindex`, same CSS variable set and `--font-ui`/`--font-mono`), plus its script inline or as `oracle.js`.
- Toolkit entry: add to `content.json` (never hand-edit `data.js`, run `npm run build:data`): title "ChampOracle messaging simulation", category `tool`, url `/oracle`, description in the site voice (lowercase, dry, one line; see the Lead Scorer entry for register).
- `wrangler.jsonc`: add `/oracle` to `run_worker_first` (every HTML route is listed so the security headers apply).
- Worker proxy already exists and is tested: `POST /api/oracle/reports` (brief JSON, header `x-passcode`), `GET /api/oracle/reports/<id>` (poll; `share_url` is absolute once `status` is `done`). Errors: 503 `not_configured`, 401 `unauthorized`, 404 `not_found`, upstream 400 `{error}`. Self-test: `scripts/oracle-proxy-selftest.mjs`. **Do not change `worker/index.js`.**

## Page flow (one column, operator voice)

1. **Passcode**: same pattern as Lead Scorer (stored in localStorage, cleared on 401).
2. **Brief form**: client name; site URL; up to 3 ads (headline, body, url) with add/remove; audience description (textarea); reader roles (chips, 2 to 4); geos; pains; channel for the ads (meta_ad or search_ad); panel size (slider 8 to 40, default 20); B2C toggle which sets `mix` to null out `seniority`, `company_size`, `decision_role`, `inbox_load`. Contact name and email prefilled from localStorage.
3. **Run**: POST, then poll every 5s. Show a stepper: queued, audience built, site judged, ads judged, report ready. The API only exposes `running | done | failed`, so the stepper advances on elapsed time with the real status gating the last step; label it "estimated" and never show a fake percent. A 20-persona, 2-channel run is about 4 to 6 minutes.
4. **Done**: the share link in a copy input group, an "open universe" button (new tab), and the brief echoed back as JSON for the record. **No send button of any kind**: Deep emails the link himself.
5. **Failed**: the upstream error text, the brief kept in the form.

## Components (21st.dev, decided; vendor as static HTML/CSS, name them in the handover)

| Region | Component (author, id) | Role | Visual contract |
|---|---|---|---|
| Brief | Multi-Step Form (ravikatiyar162, 8281) | Three steps: client copy, audience, run | Step header with numbered dots, back/next, every field labelled, errors inline |
| Ads list | Textarea (originui, 189, required variant) | Ad body fields | Resizable, char count, required marker on headline |
| Progress | Stepper (originui, 769, progress variant) | Run stages | Horizontal at 768+, vertical at 390; active step pulses, done steps filled; "estimated" tag on time-driven steps |
| Share | Share Link Input Group (sean0205, 29814) | Copy the share URL | Read-only input, copy button, aria-live "copied" |
| Status / errors | Alert (shadcn, 1170) | not_configured, unauthorized, failed | Variant per error; plain sentences in the site voice |

## Hard rules

- Site voice: lowercase labels, no marketing adjectives, no em or en dashes anywhere.
- The passcode is sent only as the `x-passcode` header; never log it, never put it in the URL.
- Client copy typed into this form is a client's data: no analytics beacon on form contents, no third-party scripts, no public preview of a filled form.
- Check contrast on the dark theme for every state colour (the site's `--text` on `--card` and the stepper colours).
- Controls 44px minimum; works at 375, 390, 768, 1440 (`responsive-viewport-qa`).

## Acceptance (prove each)

1. `npm run check` and `npm test` pass; `node scripts/oracle-proxy-selftest.mjs` still passes against a local champoracle (`uv run champoracle serve --port 3117` in `~/repos/champoracle-agent`, workspace key from `uv run champoracle init`).
2. Playwright (`playwright-core` is in devDependencies): fill the form, intercept `/api/oracle/reports` with a fake `running` then `done` response, assert the stepper reaches "report ready", the share input holds the `share_url`, and the open button targets `_blank` with `rel=noopener`. A second test asserts 401 clears the stored passcode and shows the alert.
3. `/oracle` appears on `/toolkit` from the regenerated `data.js`, with the `tool` filter.
4. Screenshots at the four widths, `scrollWidth == innerWidth`.
5. No `—` or `–` in `oracle.html` or in rendered `innerText`.
6. Handover lists the 21st.dev components used; then `kanban_request_review(reviewer="reviewer")`. Preview: `PREVIEW:` comment per the frontend lane rule, but with the form empty (no client copy on a public preview).

## Out of scope

Hosting the champoracle instance and setting `ORACLE_URL`, `ORACLE_KEY`, `ORACLE_PASSCODE` on the Worker: a separate decision card. Until then the page shows the 503 state honestly.
