# deependhq.com Agent Personalization Roadmap

Status: drafted 2026-10-28. Grounded in the `cloudflare-containers` branch of
`ajaykarthikpogula0101/deep-agent` (Ajay's fork, 18 files changed vs `main`) and
the live site at `Efforts/Active/TheDeepEndHQ/deependhq-site`.
This is a plan, not task tracking. Promote items to kanban only when Deep approves a phase.

## 1. What the branch already ships (vs main)

All verified against the actual diff, not memory.

| Area | State | Evidence |
|------|-------|----------|
| Cloudflare Containers deploy: Worker wrapper, wrangler config, one-command deploy | Live, tested | `cloudflare/src/index.ts`, `cloudflare/wrangler.jsonc`, `cloudflare/deploy.sh`, `tests/test_container_backup.py` |
| Docker image: embedded Postgres 16 + pgvector, baked fastembed model, OpenUI digest toolchain | Live, tested | `Dockerfile`, `docker/entrypoint.sh` |
| R2 snapshot restore/backup loop, boot log to R2, final snapshot on stop | Live, tested | `docker/backup.py` + tests |
| Widget personality flipped LakeB2B -> Deep (copy, quick replies, ACTIONS) | Live | `static/widget.js`, `static/deep-assistant.js` |
| Chat-learned identity reaches /me and prefills the booking form | Live, tested | `app/chat.py` (booking trigger), `app/main.py` (/me overlay), `app/memory.py` (public fallback), `app/session_memory.py` (booking reason), `tests/test_memory.py` |
| Return-visitor memory exposed to the host page via `deep-assistant:me` event | **Scaffolded, not consumed** | Emitted by `widget.js` (visits > 1) and the component on mount. Verified: zero listeners anywhere in `deependhq-site` (index.html, all 12 company pages). |

Existing in `main` already (not new in this branch): the chat welcome screen greets
returning visitors from memory (`headline`/`line`, "Hi {first}, I'm Deep"),
device identity via a localStorage `dh_vid` UUID, MaxMind geoip, and the
bookings/leads tables.

## 2. Gap analysis against the three asks

| Ask | Already there | Missing |
|-----|---------------|---------|
| 1. Knowledge base of the person | Known-facts store (name, company, topics, visits), chat-learned identity, session memory | No structured profile (segment bucket, interests, page affinity, confidence per field), no consent state, no visitor-facing "what I know" / clear-data surface, no admin view |
| 2. Returning-user greeting + form to IP tie | Greeting text in chat, /me memory, visitor UUID | Host page does nothing with the memory (the :me event is dead code on the site). Forms (toolkit-signin, enrich, booking) never record visitor_id or IP. No join between form contacts and visitor records. No company-level identity: everything is device-local, so a form filled on another device or a colleague's office cannot join the profile |
| 3. Jev-driven adaptive pages | Nothing | Whole feature. Site is 12 static `company/<slug>/index.html` pages rendered from `content.json`. No segment schema, no per-page variants, no decision layer, no marquee |

## 3. Roadmap

Order matters: each phase feeds the next. P0 and P1 are small and unblock the
story; P2 is the data foundation P3 needs; P3 is the flagship.

### P0: Consume the :me event on the site (smallest live proof)

What: one tiny listener module on deependhq-site that reads the memory from the
`deep-assistant:me` CustomEvent (or fetches `/me` directly) and applies it:
per-visitor class on `<body>`, greeting strip in the hero, later hooks for P3.
Used by both the static pages and Home.jsx.

Files: `deependhq-site/personalize.js` (new, ~40 lines), `index.html`, `Home.jsx`.
Done when: a returning visitor's company/name visibly changes a page element, verified in a real browser with a real cookie jar (per visitor-tracking skill: harness-only proof is not proof).

### P1: Identity join, forms + IP, company-level profile

What:
- Capture `visitor_id` and the server-side IP (CF-Connecting-IP through the Worker, never the client header) on every form submit; store on the lead/booking rows.
- Join in profile(): a lead/booking with the same IP within a recent window folds its company/industry into the profile as a weakly-identified fact (badged, separate from verified facts).
- Greet by company only when confidence is high; otherwise degrade to the generic greeting (the skill rule: degrade the content, never block; a shared office IP must not kill the personalization).
- Consent: add a notice and store consent as timestamp + notice version (the skill treats bare booleans as unprovable). Wire it into the existing `privacy.html`.
- Never ship person fields in payloads derived from a company-level signal; the CRM/lead rows must carry the reason, not a guessed contact.

Files: `app/memory.py`, `app/main.py`, `app/visitors.py`, `static/widget.js` (form hook), the site's form handlers, `tests/test_memory.py`.
Done when: a form filled on device A causes a recognizable greeting on device B from the same IP, with the weak-identity badge set and the one-per-visitor rule enforced.

### P2: Structured knowledge base per person

What:
- Profile record per visitor: facts (existing), segment bucket, page affinity, intent score, per-field confidence and source (chat/form/sign-in), last_seen, consent version.
- Segment inference runs on events (booking, chat topic, page dwell), stored, not recomputed per pageview.
- Visitor surface: "what I know about you" with clear-data and opt-out (privacy.html link exists).
- Admin pane for Deep: one screen per visitor with facts, sources, confidence, timeline.

Files: `app/memory.py` (schema), `app/me.py` or admin route, `tests/`.
Done when: a profile survives a month and multiple devices/IPs, consent gates every enrichment write, and a visitor can see and delete it.

### P3: Jev-powered one page that serves many segments

The mechanism (Tofu/Mutiny inspo, inverted): Tofu generates a whole new page per
segment; Mutiny swaps blocks on an existing page. The ask is Mutiny-style on one
page: the 12 company pages stay, but every variable they can serve across
industries/roles becomes a variant. No page proliferation.

What:
- Content model: `content.json` gains `variants` per page variable: hero headline, tagline, case study, CTA, proof. Each variable has a neutral default plus industry/role variants. One template renders all.
- Segment schema: the fixed list of categories each page can serve (e.g. LakeB2B page serving data teams, sales ops, healthcare, recruitment).
- Decision layer (Jev/TypeSafe, per the integration skill): a `choice` question maps profile -> category, batched (one request, keyed per page variable), buckets not magnitudes. Rule-first scorer runs with no API key and JEV sharpens the ranking; JEV down or uncalibrated = the rule score wins, never a free pass.
- Marquee: while confidence is below threshold, rotate the top-N variants on each load (undecided state). When a profile settles (confidence above threshold, or a returning visitor with a stored bucket), stabilize and keep the chosen variant; acknowledge on render, so a failed display does not burn the visitor's once-chance.
- No profile: neutral defaults, no flicker.

Files: `content.json` (variants), one page template replacing the 12 duplicate rules, `deependhq-site/personalize.js` (marquee + settle), a new `app/segments.py` (inference + JEV client), `tests/`.
Done when: one URL serves 10 industries with visibly different, correct, stable content, and a cold visitor sees the neutral default.

## 4. Sequencing and dependencies

P0 -> P1 -> P2 -> P3, strictly. P3's marquee needs P0's host hook and P2's stored
bucket; P1's IP join is what turns P2 profiles into company-level ones. P1 and P2
could merge if someone else builds the form side first; nothing else moves earlier.

## 5. Standing constraints (from the visitor-tracking and JEV skills)

- Consent is a hard precondition for any enrichment based on IP or cross-device join. This is personal data under India's DPDP Act; the site is India-first.
- Never announce what was watched. Greet and personalize without reciting visit history.
- Company-level signals must not leak into person fields (name, email, role) in any payload.
- Identity cookie is client-generated localStorage today. If the join (P1) carries the product, move to server-side Set-Cookie (Safari ITP caps JS-created cookies and breaks exactly the returning visitors this feature is for).
- JEV scores are weakly calibrated: use buckets, not magnitudes; batch questions; keep the deterministic scorer in front.