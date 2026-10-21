# Assistant greeting suppression: verified preview-only change

Task: t_ba6ef6e6. Integration owner: t_18bcdbd6.

## Decision and scope

Deep explicitly approved hiding the unsolicited `.dh-pro` greeting at all screen sizes, ONLY in the new design preview. Worktree: `/Users/deep/repos/deependhq-editorial-preview`, branch `refresh/editorial-hero-v3`. Verified working-tree base: `5aa451babcad1f27a8f39399871048355675e9ad`, with pre-existing uncommitted editorial work preserved. No commit, merge, push or deployment was performed by this task. Production hold t_1ee6b328 is unchanged.

The entire product change is a comment plus `.dh-pro{display:none!important}` in `system.css:1004-1005`. Actual `https://assistant.deependhq.com/static/widget.js` was read first: its light-DOM `.dh-pro` wrapper gets `display:flex` from a style element injected after the site's stylesheets. The important declaration wins that later rule. It targets neither `#dh-assistant-btn` nor the `deep-assistant` custom element/shadow DOM. No observer, dependency, configuration, exports, fixtures, analytics, assistant-service, backend or CORS/CSP changes.

Source consumers: existing shared `system.css` links on the site shells, including the homepage, log and privacy page. There is no generated copy of this rule, so no canonical rebuild or generated-file rewrite was necessary. Existing dirty shell and bundle output was left alone. Local served `/system.css` was fetched and byte-compared to the source.

Verified CSS SHA-256: `04fc74ded436e3a2139a504a9c3134e51b71fc78a8492b1ebe6477ad4fc5c0ae`.

## Method

Reused/adapted `docs/verification/production-review/real-assistant-origin.mjs` from the integrated worktree into this directory, preserving the real-origin approach and adding failure assertions. Local Wrangler serves the actual editorial working tree over HTTPS on port 8444. Only Chrome's resolution of `deependhq.com` maps to it; `location.origin` remains `https://deependhq.com`. Assistant requests reach the real service. No routing interception, mock responses, CORS/CSP relaxation or provider message submission.

Re-run from the preview repo with a local HTTPS Wrangler Worker on that port:

`PORT=8444 node docs/verification/assistant-greeting/real-assistant-origin.mjs`

Each fresh browser context waits 12 seconds after the launcher, requires the actual delayed `.dh-pro` node to exist, then checks its computed display, zero-size geometry and control hit-tests at top/middle/bottom. Requiring attachment prevents a failed/missing widget from producing a false pass.

## Results

| Check | 375 light | 375 dark | 1280 light | 1280 dark |
|---|---|---|---|---|
| Pre-fix regression fails on the real visible greeting | pass | pass | pass | pass |
| Pre-fix blocked controls at top/middle/bottom | 2/9/6 | 2/9/6 | 0/0/2 | 0/0/2 |
| Post-fix delayed card attached, computed display none, width zero | pass | pass | pass | pass |
| Post-fix blocked controls at top/middle/bottom | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 |
| Seven pointer-actionability checks | pass | pass | pass | pass |
| Actual tools CTA and back-to-top clicks | pass | pass | pass | pass |
| Launcher opens editable textarea, fill/clear without submission | pass | pass | pass | pass |
| Chat closes, reopens and closes again | pass | pass | pass | pass |
| Actual /privacy click loads expected privacy heading | pass | pass | pass | pass |
| Console warnings/errors, page errors, failed requests | 0 | 0 | 0 | 0 |

Seven actionability targets per state: current hero tools CTA, current latest-shipped proof link, a log link, footer Now, RSS, back to top, and /privacy. These are real pointer-actionability trial clicks, not only DOM presence assertions. The current editorial hero replaces the old "See what I build" CTA, so the current equivalent is checked rather than restoring obsolete markup. Total: four passing states, 12 scroll samples, 28 target checks. Classic `widget.js` returns 200 without requiring ACAO; module `deep-assistant.js`, `/widget-config` and `/outreach/check` each return 200 with ACAO `https://deependhq.com`.

`npm test`, `npm run links` (90 pages), `npm run contrast` (60 pairs, none below 4.5), `node --check` for the adapted probe, `git diff --check -- system.css` and reverse dry-run of the isolated two-line patch all pass. Existing Playwright 1.49 `waitForFunction` conflicts with real CSP, so the probe uses bounded CDP evaluation polling without changing CSP. An initial mistaken back-to-top anchor selector was corrected to the existing `button.hwf-up`; these were harness failures, not product regressions.

## Evidence and visual check

Final machine results: `real-assistant-origin.json`. Pre-fix red results: `baseline-real-assistant-origin.json`. Capture files: `../../shots/assistant-greeting/{375,1280}-{light,dark}-{greeting-hidden,footer,assistant-open}.png`. All 12 final screenshots were inspected in four three-panel sheets: no unsolicited greeting in hero/footer, launcher retained, footer links legible, user-opened chat input and close control legible. An intentionally opened conversation still overlays page content, as expected and outside unsolicited-greeting suppression. This is not approval of the overall editorial design.

Isolated patch: `/Users/deep/.hermes/kanban/workspaces/t_ba6ef6e6/assistant-greeting.patch`. No pre-existing editorial diff was staged or included in that patch. Shared-file hotspot was flagged on both task threads and the edit window was released to the integration owner.

## Limits and risk

The selector is private third-party markup and can change. Re-run the delayed real-service regression when the widget changes; if its markup/styling no longer matches, upgrade to an owner-provided configuration switch. UI suppression does not stop outreach requests, recording, unread badges or greeting context carried into a user-opened chat. Launcher and user-opened chat are deliberately unchanged.

No real physical-device/touch test, other-browser pass, paid chat turn, full accessibility audit, public preview-origin assistant pass, or production deployment. Public preview origins remain subject to the assistant's unchanged exact-origin allowlist. No new feature flags, mobile-only variants, compact cards or service changes were added.
