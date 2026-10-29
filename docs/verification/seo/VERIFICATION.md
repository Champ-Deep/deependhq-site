# SEO fixes: t_dbad7fe8

## Scope

P0.1 through P0.4 and P1.1 only. Fresh worktree from origin/main dfccfd0, branch fix/seo-t_dbad7fe8. The original checkout's scripts/publish.sh modification was preserved.

Source changes: wrangler.jsonc drops trailing slashes; build-data.mjs removes redirected sitemap aliases and emits source-backed lastmod dates; prerender.mjs gives static pages canonical URLs, home Person/WebSite JSON-LD, and journey/toolkit descriptions. The shared head writer now replaces rather than duplicates metadata, preserves unspecified titles/descriptions, updates JSON-LD on rebuild, and escapes script delimiters. Added scripts/selftest-seo.mjs. Added .git to .assetsignore because a worktree uses a file, not a directory.

No visible copy, component, stylesheet, auth, billing, booking or analytics change. Existing 21st-based islands were retained; build-islands reports five registry checks OK. No new UI component or dependency was needed. Generated build output was used for preview verification but is not committed: the production build regenerates it after review.

## Published preview

https://deependhq-seo-dbad7fe8-preview.deep-ae0.workers.dev

Preview version: e82333a3-278b-47b2-9228-1b28bef357cf. This separate Worker has only the ASSETS binding. No production domains, schedules, secrets, D1, R2, or KV bindings were deployed to it. Production was not deployed or merged.

An initial version-only upload to deependhq, 0076aac7-7417-47f4-a86d-55919f16b0fa, received no traffic and its preview alias returned 403. Do not deploy that version: it preceded the .git pointer exclusion. The final isolated preview returns 404 for /.git. Cleanup requires owner approval.

## Commands and results

- npm ci: successful, existing audit summary reports five vulnerabilities. No lockfile changes.
- npm run build: exit 0. Guard passed. Sitemap: 37 URLs. Prerender produced 39 page variants. Existing logger prints `39/10` because ten page definitions expand to entity variants. build-islands: 407098 bytes, five registry checks OK.
- node scripts/selftest-worker.mjs: 35 passed, zero failed.
- node scripts/selftest-segment.mjs: 37 passed, zero failed.
- node scripts/selftest-copy.mjs: 42 passed, zero failed.
- node scripts/selftest-digest.mjs: 26 passed, zero failed.
- node scripts/selftest-privacy.mjs: 33 passed, zero failed.
- node scripts/selftest-seo.mjs, after build: passed. Checks preservation, idempotence, escaping, social URLs against Footer.jsx, sitemap dates/counts, unique generated metadata, entity Worker globs, and .git asset exclusion.
- npm run links: 49 pages scanned, all internal links resolve.
- python3 ~/.hermes/scripts/dhq_seo_check.py --selftest: selftest ok.

Before: python3 ~/.hermes/scripts/dhq_seo_check.py against production printed `deependhq SEO check: 43 issues across 39 sitemap URLs`.

After: the same watchdog module against the published preview printed nothing (zero bytes). Its hardcoded SITE and production canonical expectations were preserved. The verification wrapper substitutes only the network destination in fetch(), from https://deependhq.com to the preview origin. It does not rewrite HTML, sitemap URLs, canonical expectations, statuses, or classifier logic. Running the unmodified CLI still checks production, which deliberately remains unchanged.

Additional HTTP verification: all 37 sitemap URLs answer 200 with CSP, nosniff, X-Frame-Options, and nonempty page bodies. All 31 entity slash and /index.html aliases redirect to the no-slash URL. These real preview requests exercise the /post/* and /company/* run_worker_first paths.

## Browser proof and limits

Chrome with Playwright: eight routes at 375, 768 and 1440, 24 states. Canonical and description remain unique and correct after client scripts run; home JSON-LD parses; post and company titles match their records. Clicking the latest essay from Writing reaches the canonical no-slash URL at each width. Zero uncaught page exceptions.

Ten viewport screenshots were opened: homepage at all three widths, and now, journey, writing, toolkit, privacy, latest post and Lake B2B at 1440. Headings and primary content render. Fixed bottom navigation covers content at the viewport edge; this is existing scrolling UI, not a new layout change. Full-page visual review and every application control were not tested.

The visual audit is NOT clean sitewide. It reports 76 FAIL instances, all on /now: 60 at 375 and eight each at 768 and 1440. An identical live-production audit reproduces the same counts: small rhythm links and controls, plus width animations. Other tested routes have zero FAILs. Warnings include existing styling and density choices; none were changed in this metadata-only task.

Console records 42 preview-origin errors, solely assistant.deependhq.com script CORS rejection and corresponding net::ERR_FAILED. The assistant is not verified on this preview. No fabricated response, interception, or hidden error was used.

## Security and follow-up

Focused source review found no new auth, ownership, persistence, or data exposure path in the SEO diff. HTML attributes retain escaping; JSON-LD now escapes `<`; the worktree pointer is excluded from assets.

The mandatory deploy gate returned exit 0 only through the repository's existing WARN-ONLY policy, not a clean security scan. It reports two generic-api-key history findings in toolkit-admin-selftest.mjs and HIGH/CRITICAL dependency findings in deependhq-next/package-lock.json. No override, exemption, suppression or dependency upgrade was added. These existing findings and /now accessibility remediation are routed to t_ed97d8c8 for main-profile triage.

Context7 lookup was attempted but monthly quota was exhausted. Cloudflare's official HTML-handling documentation was fetched instead; the option was also exercised on the real Cloudflare preview.

Booking URL, GA4, H1 aria-hidden changes, production publish, merge, and vault publisher synchronization remain outside this card. Deep reviews and merges the PR. Production SEO verification must run again after that deployment.
