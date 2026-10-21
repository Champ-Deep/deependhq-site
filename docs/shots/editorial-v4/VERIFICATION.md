# Editorial v4 preview verification

Deep has NOT approved v4. This is an isolated visual proposal, not a publication request.

Preview: https://deependhq-editorial-v4-preview.deep-ae0.workers.dev
Branch: refresh/editorial-hero-v4
Runtime/source head: bc19aca0e86c9cc4d152ea18f1b553257d292770
Parent: refresh/editorial-hero-v3, 56d9fc3373d149bb9ff909ce13b7f01884d26740
Cloudflare preview version: 7df1b822-913c-4204-a429-b4a5217dfc80
The final branch head in the Kanban handoff adds excluded evidence only. No production merge, push or deployment was performed.

## What changed

| Requested change | Preview result |
| --- | --- |
| Remove boring mission log beneath hero | Reading order is identity, useful tools, latest dispatch, weekly edition, companies, day-to-entry process, machine logs, off-hours and contact. Counts and terrain live under Machine Logs, not beneath the hero. |
| Legible Explore Day | Native labelled date input plus 44px previous/next day buttons replaces the long select. Entry and gap readouts remain honest. The existing earlier seven-lane clock and terminal progression are retained, not replaced by another generic card set. |
| Terminal green and gold dark; accented cream light | Dark ground #09140D, green #71F394, gold #E6BD60. Light buttery #F7EDCE, espresso #30291F, olive #48612B and antique gold #795515. The tool shelf is an actual olive band in light, not cream with tiny accent specks. |
| Latest public entry, archive elsewhere | One full latest dispatch, day 354. Three previous entries are compact dated archive links, not draggable bento cards. Full entries remain at /journey. |
| Merge tools and Things to Try | One five-job shelf directly after the hero. Duplicate ToolkitChooser mount removed. Full stack remains a disclosure inside the same section. |
| Twelve company folders | Twelve numbered native disclosures with products, company links and dates. Glass folder island removed from the page. |
| Weekly and off-hours redesign | Weekly edition stamp, one essay and its source-week rows, compact archive and AI disclosure. Listening and playing form a two-part shelf with real off-hours notes. No fabricated account activity. |
| Bottom banner and Deep wordmark | Removed homepage signoff marks and halftone footer mount. Navigation and legal copy are in document flow. Footer has bottom safe-area space. |
| 21st research and components | Authenticated research covers nine section types. Installed A11YPros Accordion and ln-dev7 Footer17 are adapted into rendered markup. Existing Arrow Dots CTA and Kokonut terrain remain. COMPONENTS.md distinguishes actual source adoption from native compositions and gives alternatives per section. Activity Feed and Spotify registry installs failed; these are not falsely claimed as installed. |
| Preserve approved pieces | Scouter/icon bytes, greeting-only .dh-pro suppression, content.json, all 132 entries, day 354, backend, migrations and package manifests remain unchanged relative to v3. Launcher and chat were not removed. |

## Scope and callers

The change reaches Home.jsx, app.jsx, Footer.jsx, home.css, system.css, scheme.js, generated scheme-tokens.css and generated HTML/data/feed files. The terrain date-picker caller and browser tests now use a native date value rather than select-option indexes. P4/editorial/release browser assertions and source/HTTP asset gates now expect one island instead of four. Public staging targets only the isolated v4 Worker. Existing unmounted helper definitions were not turned into an unrelated cleanup project.

The new registry research helper accepts TWENTY_FIRST_API_KEY only from its environment. It does not read another Hermes profile's credential file. The excluded installation sandbox was not added to public assets or runtime dependencies.

## Execution evidence

| Check | Actual result |
| --- | --- |
| scripts/release-gates.py | All 15 commands exit 0, including production-mode build, npm tests/check/brand/contrast, Worker/segmentation/copy/digest/privacy, toolkit and lead-scorer tests, and publish-script syntax. See docs/verification/release/gates.json and gate-*.txt. |
| Contrast | 60 token pairs measured, none below 4.5:1. Lowest reported ratio 4.62:1. Both schemes included. |
| Hosted scripts/editorial-browser.mjs | 44 audit states, 12 check groups, 60 source screenshots, zero FAIL findings, zero element-rectangle overflow and zero page exceptions. Includes all 375/768/1280/1600 scheme pairs, open company/AI/full-stack/table states, menu, scheme persistence/reset, real terrain pixels, entry/gap selection, no-JS content and reduced motion. No network mocks. |
| Focused scripts/p4-browser.mjs | 13 cases and 27 audit states pass, including seven desktop clock stops, mobile static lanes, table, terrain keyboard navigation, entry/gap selection, no-JS and reduced motion. Its 16 source screenshots were opened too. This focused suite intentionally excludes the external assistant; it is not used as evidence that hosted chat works. |
| Hosted look-probe.mjs | Eight size/scheme cases. 320 control-center checks pass for tools, company summaries, archive, disclosures and footer links. Verified logo stays in viewport, all three archive links remain unclipped, date-picker boundary buttons disable correctly, previous/next change actual selected dates and privacy is static in flow. |
| Public readback | 161 staged paths: 160 served asset responses plus intentionally unserved _headers. Seven page routes also read back. Every served asset matches staged bytes after removing the unchanged Worker's four opening-html request hints. Four legacy HTML aliases correctly match their redirected current pages; see html-aliases.json. |
| Privacy / public boundary | No dot directories, docs, scripts, tests, worker source, migrations, database or private-key material in the staged asset set. The site's legacy public browser-required JSX remains public. |
| Scope | git diff against v3 has no changes to worker/, migrations/, content.json, package manifests, favicon.svg or brand/icons.svg. v3 ancestry verified. |
| Source checks | git diff --check and Python compilation pass. Generated HTML has zero em or en dashes. Changed-file secret-pattern scan finds no key payloads. |

## Screenshot LOOK pass

All five rejection attachments were opened before the resumed visual review. All 60 hosted source screenshots were reviewed: the eight fold shots individually, and the remaining 52 through labelled native-resolution contact sheets. All sixteen focused P4 source shots were also reviewed through labelled sheets. That is 76 output source screenshots, not a claim that historical screenshots elsewhere in the repository were reviewed.

Source inventory: browser-results.json here and docs/verification/p4/browser-results.json. The review/manifest.json maps nineteen section contact sheets back to every hosted source PNG. P4 sheets include both narrow/tall seven-lane views and desktop states, rather than a single unreadable full-page thumbnail.

After the final deployment, the complete hosted suite was recaptured. Forty-eight source PNGs were byte-identical to their opened versions. All twelve changed PNGs were opened again, individually or in rebuilt labelled sheets. docs/verification/editorial-v4/final-shot-diff.json preserves that comparison. All 161 staged files also match the runtime/source commit byte-for-byte; live HTML is separately checked after the unchanged Worker adds request hints and follows four legacy aliases.

### Critique and disposition

1. The initial v4 implementation had olive-band inherited text colors in the expanded full stack and ambiguous disclosure-link names. These were fixed in the interrupted implementation run. The resumed live audit and screenshot review show legible shelf actions and the open-stack audit passes in every size/scheme pair.
2. The LOOK pass hypothesized a clipped mobile logo, hidden desktop archive entries and a misspelt company heading. Live geometry/text probes disprove them: logo is inside the viewport, all three archive anchors have no scroll clipping, and the heading reads 'Group CMO across twelve companies'. A fold capture ending at Things to Try is a screenshot boundary, not clipped page content. The weekly deck is deliberately limited to three lines with a full essay link.
3. Footer review confirms no giant wordmark or layered privacy banner. Legal links and text are in flow and readable in both schemes. All footer control centers tested clear of the real retained launcher. The launcher can still cover passive words at arbitrary scroll positions; there is no claim of perfect passive-content clearance.
4. Mobile illustrative commands wrap naturally. All seven clock labels and commands remain present and readable. No smaller-font or horizontal-scroll shortcut was introduced to force desktop commands onto one phone line.
5. Palette differences in the launcher and service labels are intentional theme adaptations, not inconsistent state. Spotify and PlayStation-related typography uses the installed site fonts with service-like weight/tracking; no proprietary fonts or account match are claimed.

6. The final LOOK pass again found the retained launcher overlapping passive mobile essay words in some scroll positions. This is real, not dismissed as a crop artifact. Control centers remain clear, and the limitation remains explicit below. The grayscale audio/progress concern was checked against the live computed-style audit, which has no contrast FAILs; no palette was changed on the strength of a scaled screenshot alone. A timed hosted check also confirms the actual delayed greeting mounts at display:none with a zero-size rectangle. The launcher is not the greeting.

## Warnings, errors and limits

The hosted machine pass is not warning-free: 1,352 WARN observations and 88 INFO observations across repeated states. Their exact categories are preserved in browser-results.json. The 1,260 measure observations mostly concern full data-table/readout paragraphs and legal copy; these are dense source/reference surfaces rather than long-form essay measures. Forty-four default-font observations reflect the deliberately retained brand-mandated Inter. Forty-four heading observations identify the existing footer h4 navigation-group labels beneath the page's h2 structure; those headings are retained within the footer landmark, not described as a perfect document-outline pass. Four emoji warnings inspect the hidden external greeting's descendant markup: its parent is display:none and the live timed geometry check confirms zero width/height. Eighty-eight three-card-row INFO observations reflect compact archive/off-hours groups, not an unremoved draggable bento.

Hosted assistant console is NOT clean: 70 console errors in the final full run, all the existing workers.dev CORS refusal and failed-resource/preflight consequences for assistant.deependhq.com (module, outreach and widget-config endpoints). There are zero page exceptions. No assistant origin/CORS/backend changes, paid turns or production credentials were authorized. The launcher is retained and greeting-only suppression is intact, but a working assistant conversation on this preview is not claimed.

Spotify and PlayStation accounts are not connected. No public playlist is configured, so real playback and account typography/content matching were not tested. Spotify and Activity Feed source installs failed as recorded in install.json and spotify-retry.txt. Native fallback composition is disclosed in COMPONENTS.md, not nine falsely advertised installed components.

Not checked: physical devices, assistive screen-reader output, Safari/Firefox, real account authentication/billing, external product execution, FPS/performance profiling or production behavior. No new service bindings, accounts or secrets. Existing literal-token/OG surfaces outside the homepage proposal are not claimed redesigned.

## Approval handoff

Gate t_652aa871 must present this v4 preview to Deep and obtain explicit visual approval. Completion of this frontend card means implementation/evidence handoff only. It does not approve this design, unblock publication by itself or authorize any production merge/deploy. Exact final branch head is recorded in the task completion metadata; that last commit contains excluded evidence only.
