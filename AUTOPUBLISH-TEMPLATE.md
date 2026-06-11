# Autopublish Template : reusable daily-updating static site

The pattern behind deependhq.com, generalized so any microsite can reuse it.
Copy this file + the `scripts/` folder into a new site repo and follow the
checklist at the bottom.

## The concept

A site that updates itself every day from sources you choose, with zero manual
publishing. Four decoupled layers, each replaceable:

```
SOURCES            AUTHORING               BUILD                 PUBLISH + DEPLOY
(pick any)         (Claude, scheduled)     (deterministic)       (SSH push -> CF Pages)

daily notes   ─┐
GitHub        ─┤   Claude scheduled task   node scripts/         scripts/publish.sh
calendar      ─┼─> authors content in  ──> build-data.mjs   ──>  fresh clone + rsync
email triage  ─┤   your voice, writes      content.json ->       + commit + push  ──> host
social triage ─┘   content.json            data.js               (SSH deploy key)     auto-deploys
```

Why the layers are split this way:

1. **Sources are selectable.** The scheduled task's prompt names which sources
   feed the site (vault daily note, GitHub commits, anything reachable by a
   connector). Adding a source = editing one prompt, not touching code.
2. **Authoring is AI, surgery is code.** Claude writes the words; a dumb,
   deterministic script (`ingest-entry.mjs`) inserts them into `content.json`
   so the data file can never be corrupted by a creative model.
3. **One source of truth.** `content.json` holds everything. `data.js` is
   generated, never hand-edited. Pages are static and read `data.js`.
4. **Publishing never touches the local `.git`.** Sandboxed agent sessions
   cannot use the vault clone's git state or clean its stale lockfiles.
   `publish.sh` does a fresh shallow clone over SSH with a repo-scoped deploy
   key, mirrors the worktree onto it, commits, pushes. The local clone in the
   vault stays a pure worktree.
5. **The host redeploys on push.** Cloudflare Pages (or Netlify, or GitHub
   Pages) watches the branch. Push = deploy. No deploy credentials needed.
6. **Belt and suspenders.** A Mac LaunchAgent (`publish-native.sh`) runs daily
   and pushes anything a sandbox run could not. Two independent paths to live.

## Failure-loud, not failure-silent

The original pipeline failed silently for a month because the push step
reported success-ish "pending" notes nobody read. Rules now:

- `publish.sh` exits non-zero with a `PUBLISH-FAILED:` line on any failure.
- The scheduled task must VERIFY after publishing: fetch the live site's
  `data.js` and confirm `today_date` matches what it just published. If not,
  say so loudly in the run report.
- Three consecutive failed publishes = the task should tell the user to check
  the deploy key (still present on the repo? write access still enabled?) and
  the LaunchAgent log (`/tmp/<site>-publish.log`).

## New microsite checklist

1. Create the repo, static site, `content.json` + `scripts/build-data.mjs`
   (copy from deependhq-site and trim the schema to what the site needs).
2. Connect the repo to Cloudflare Pages. Note the production branch.
3. Generate a **repo-scoped SSH deploy key** (standing preference: SSH, never
   PATs): `ssh-keygen -t ed25519 -N "" -C "<site>-autopublish" -f
   <vault>/Other/.secrets/deploy_key_<repo-name>`
4. Add the `.pub` on github.com/<owner>/<repo> -> Settings -> Deploy keys,
   check **Allow write access**. Deploy keys do not expire.
5. Copy `scripts/publish.sh` (+ optionally `publish-native.sh` and
   `install-native-publisher.sh`). Set `PUBLISH_REPO` / `PUBLISH_BRANCH`
   defaults at the top, or pass them as env vars.
6. Create a Claude scheduled task: author content from the chosen sources,
   run the ingest script, run `bash scripts/publish.sh`, then verify live.
7. Run `bash scripts/publish.sh` once manually to confirm the loop end to end.

One deploy key per repo: a leaked key can touch one microsite, nothing else.
GitHub also enforces this (a deploy key cannot be reused across repos), which
is why each microsite gets its own keypair in `Other/.secrets/`.
