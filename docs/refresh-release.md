# DeepEndHQ refresh release

## Target and preserved baseline

Integration worktree: `/Users/deep/repos/deependhq-refresh`.
Integration branch: `release/deependhq-refresh-v2-20261021`.
Do not use the vault checkout as the git authority. Do not touch another lane's worktree.

Fetched production base: `3f83e7b00ecee9f476a3d3e222b65c3c06c0c726`, the October 20 publish. It contains day 354 and 132 entries. The old lanes start at October 19, so preserve this newer entry and all other newer production content.

Parent created release from that base and merged `refresh/2026-10` with merge commit `2d150ad`. This carries the circular scouter logo, all favicon exports and the refresh contract without losing the new daily entry. Production has NOT changed.

No `.github` workflow directory exists at this base. Do not claim CI passes if no workflow ran.

## Merge inputs, in order

| Order | Branch | Verified head at preparation | Role |
|---|---|---|---|
| 1 | refresh/p1-scaffold | bb07472 | Scheme, pre-paint scripts, nav toggle, static-plus-islands scaffold, disclosure guards |
| 2 | refresh/p2-footer-twelve | 82b977b | Halftone footer and folder-card islands |
| 3 | refresh/p5-off-the-clock | ac1d622 | Gaming, listening, Things to try |
| 4 | feat/lead-scorer-public | d38f2bc | Existing toolkit, fail-closed auth/credits/billing code and reskin |
| 5 | refresh/p3-log | Resolve final head after t_26a98217 completes | Widget grid, public log, weekly narratives |
| 6 | refresh/p4-hero-lanes | Resolve final head after t_03ded1f5 completes | Terrain hero, seven lanes and clock |

Merge all commits, do not cherry-pick only visible files. Preserve input ancestry and prove each branch head is an ancestor of final release. Do not delete branches.

Before each merge: clean status, exact input head, `git merge-tree --write-tree HEAD <branch>` captured to a scratch log, and extract the actual conflict paths. Source overlap is expected in Home.jsx, Footer.jsx, system.css, home.css, index.html, package.json, package-lock.json, scripts/prerender.mjs, worker/index.js and content.json. Generated HTML/data outputs also overlap. Stop for unexplained auth/billing/data-model changes, never pick one entire side just to silence a conflict.

## Conflict resolution contract

Home.jsx is a composition: P4 owns Hero and Day, P3 owns Log and Writing, P2 owns Pillars, P5 owns Stack and Human. P6 home chooser must not erase P5 Things to try or the new hero/log. Keep shared utilities required by all sections and deduplicate imports/const names. P1 accessibility/contrast fixes still apply to the composed sections.

Footer.jsx: P2's final footer and complete static fallback, with P1's scheme handling if still useful. Canonical islands/index.jsx registers all four real islands (terrain, widget grid, folder cards, halftone footer). Tiny proof badge is optional, not a release feature. Do not ship several test-only bundles or registries.

system.css: P1 is canonical for global schemes. Toolkit-specific aliases from P6 must coexist without overriding global --bg/--text differently per page. Retire classic data-theme/dh_theme toggle everywhere, including toolkit pages. One pre-paint script and one nav control govern the whole site. Meta theme-color follows the actual scheme.

content.json: start with the newest production content, preserve the latest journey entry, apply P1 disclosure removals and P5/P4 new keys. Do not restore sensitive wording from another branch. Never concatenate two JSON objects or discard the new entry. data.js, feeds, SEO text and prerendered entity pages are regenerated from final sources.

package.json: keep esbuild/react/react-dom and motion if actually used as runtime build dependencies; retain toolkit test commands. Regenerate package-lock.json from the composed manifest, never hand-merge it. Verify with npm ci afterwards.

Assets: the one shared circular scouter SVG is authoritative for favicon and main logo in all schemes; P5 adds game/music icons to the existing sprite. Rebuild raster exports with the real build script, not tiny headless viewports. Do not regenerate or redraw approved imagery. Higgsfield is the only permitted image-generation connector.

Worker/backend: keep P6 validation, fail-closed zero limits, JWT verification, payment signature checks, ledger idempotency and setup-needed states intact. No new production bindings, migrations, paid calls, pricing defaults, or secret values in this integration. Read docs/toolkit-launch.md for known live-service boundaries.

Publishing: the nightly publish scripts must build the island bundle too, not just prerender HTML. Avoid publishing an older committed bundle after fresh content regeneration. The build must work with NODE_ENV=production. Do not blindly run publish.sh: it mirrors to main with rsync --delete and is not a preview command.

## Reviewed Worker-test finding

Parent inspected worker/index.js, segment.js and scripts/selftest-worker.mjs. `/command` and `/command.html` are retired 301 redirects to `/journey#commits`; both server and client OPERATOR_PATHS intentionally omit command. The old selftest still expects `/command` to classify as operator and fails 29/30 on the unchanged pre-integration checkout. Do not change product classification to satisfy a stale test. If reconciling this test, add a real assertion for BOTH redirect aliases and target, retain the ordinary explorer classification expectation for the retired path, and prove that breaking the redirect makes the new assertion fail. Keep all original outage guards and audio tests. Parent reviews this change before publication.

## Acceptance and evidence

Run build, npm test, npm run check, brand guard, contrast, all Worker/segment/copy/digest/privacy selftests and the toolkit suites listed in docs/toolkit-launch.md. Exact commands, exits and counts go in docs/verification/release/. Any failing gate is a failure, even if a previous worker called it pre-existing.

Real combined browser test: home, journey, a nested essay and company page, toolkit, Lead Scorer and account. Both schemes at 375/768/1280; homepage also 1600. Check JS-off primary content, all four islands mounting, system theme, persisted override, reset to system, changed-system event, no horizontal scroll, keyboard and pointer grid reorder, reset/persistence, folder opening, terrain links, reduced motion, footer links and no page errors. Test served Worker CSP, not only a Python file server. External-service failures must be identified separately from product errors, not silently swallowed. Preserve one comprehensive final browser script.

Measure actual SVG/raster dimensions, match the source favicon hash, and verify nav/footer point at the new mark. Check the final public asset set excludes test fixtures, diagnostics, local SQLite files, worker source, docs/shots, and dependency trees. No secrets in emitted assets.

Screenshots must be opened and inspected. A saved image alone is not visual verification. Build success in six separate lanes is not an integrated pass.

## Publication boundary

Deliver one green release branch, reviewable diff, evidence and a disposable public preview. Wrangler OAuth access was verified by the parent on October 21, with Workers/Pages write permissions; that is not proof a preview deploy succeeds. Use a NEW preview Worker name with no production routes/domains or production D1 bindings. Read back the actual preview URL and verify it serves this release (favicon hash, island script and expected content). Never invent a URL or call a pushed branch a deployment.

Push only the release branch and open one draft PR to main using a body file with evidence and known external setup limitations. Do not merge main or delete any branch. Parent reviews exact release head and returns the production publication decision. Live Clerk signup, merchant eligibility, payment checkout and paid-provider calls remain UNVERIFIED until actually configured and exercised.
