# deependhq.com — content + daily auto-publish pipeline

The site is a no-build static React kit (HTML + Babel standalone). It loads
`data.js`, which is **generated**. Do not hand-edit `data.js`.

## Source of truth

```
content.json   <- edit this (or let the daily task edit it)
   │  node scripts/build-data.mjs
   ▼
data.js        <- generated, loaded by every *.html page
```

After any manual edit to `content.json`:

```bash
node scripts/build-data.mjs
```

## Pages

| File | Surface | Body component |
|------|---------|----------------|
| index.html | home | app.jsx |
| now.html | /now snapshot | NowPage.jsx |
| journey.html | daily feed | JourneyPage.jsx |
| writing.html | essays + weekly narratives | WritingPage.jsx |
| post.html?slug=… | single post | PostPage.jsx |
| field-notes.html | wiki (tools, arcs, themes) | FieldNotesPage.jsx |
| toolkit.html | tools/repos/skills | ToolkitPage.jsx |

New styles for /now, /writing, and posts live in `pages.css` (Gotham tokens).

## Daily auto-publish

Scheduled task `deependhq-daily-publish` runs at **01:30 IST daily**. It:

1. Reads the day's daily note (`Calendar/Daily Notes/YYYY/MM/…`) + GitHub commit count.
2. Claude **authors** a journey entry in Sreedeep's voice (mood, arcs, three lines), applying the public-naming rules below.
3. Runs `node scripts/ingest-entry.mjs '<json>'` — unshifts the entry, bumps the day counter, refreshes the status strip and "recently shipped", regenerates `data.js`.
4. On Sundays, optionally authors a weekly narrative into `posts[]`.
5. Runs `bash scripts/publish.sh` — fresh shallow clone over SSH using the
   repo-scoped deploy key at `Other/.secrets/deploy_key_deependhq-site` (vault),
   rsyncs this worktree onto it, commits, pushes `initial-site`. Cloudflare
   Pages redeploys.
6. Verifies: fetches `https://deependhq.com/data.js` and confirms `today_date`
   matches the published entry. Reports loudly if not.

Manual one-off entry:

```bash
node scripts/ingest-entry.mjs '{"date":"2026-06-05","shipping_now":"...","raw_thought":"...","arcs":["TheDeepEndHQ"],"arc_color":"green","github_commits":7}'
```

## Public-naming rules (hard)

This is a personal-brand surface, not a company page.

- Never name real team members. Anonymize to roles ("a sales lead", "the SEO team").
- Refer to the group patriarch only as **Chief**.
- Team codenames (Phoenix, Assassins, Synergies, Prodigies, ChampOps) are fine; individuals are not.

## Deploy note

Cloudflare Pages project `deependhq` deploys from this GitHub repo
(`Champ-Deep/deependhq-site`), branch `initial-site`.

Two publish paths (see AUTOPUBLISH-TEMPLATE.md for the full design):

- **Primary — `scripts/publish.sh`**: works from ANY environment with SSH
  egress (including sandboxed agent sessions). Fresh shallow clone over SSH
  using a repo-scoped DEPLOY KEY, mirror worktree, commit, push. Never touches
  this clone's `.git`, so stale lockfiles are irrelevant.
- **Fallback — `scripts/publish-native.sh`**: runs on the Mac via LaunchAgent
  `com.champ.deependhq-publish` (daily 02:15 IST), uses the local `.git` +
  Sreedeep's personal SSH key, clears stale `index.lock` itself. Installer:
  `bash scripts/install-native-publisher.sh` (run once in Terminal).

Deploy key: `<vault>/Other/.secrets/deploy_key_deependhq-site` (ed25519,
added with write access on github.com/Champ-Deep/deependhq-site -> Settings ->
Deploy keys). Pinned host keys: `Other/.secrets/github_known_hosts`.
Standing preference: SSH deploy keys, not PATs, for all publish automation.
