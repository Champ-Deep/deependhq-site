# deependhq-next

deependhq.com v2 on Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind v4, running the Gotham Workshop round 6 v4 design system: v5 token layer (body is mono by design), Bayer-dither background, whole-screen spatial layer (icosahedron core inside a labeled network shell fed by what is actually being built), kinetic Inter-variable headline, magnetic CTAs, split-flap bio, scroll-opened MacBook framing a live /command, guest terminal in the hero bento, signals bento, frosted glass everywhere, and enhanced rails (proof numbers, waypoints, progress wire, live widgets, commit sparkline). Palettes: operator (default), ember, dopamine via the cmd-k palette. Legacy inner pages and the command center ride along untouched. Round 6 source of record: `Gotham Workshop Design System/round6/` (README there has the owner flags).

## Test locally (one click)

Double-click `run-local.command` in this folder. First run installs dependencies, then the site opens at http://localhost:4321 (port 4321, since 3000 belongs to Open WebUI on this Mac).

Or by hand:

```bash
cd deependhq-next
npm install
npm run dev
```

Every page: `/` `/now` `/journey` `/writing` `/writing/<slug>` `/field-notes` `/toolkit` `/command` `/company/<slug>` plus `/feed.xml`, `/sitemap.xml`, `/cta` redirect, and a styled 404.

## Content pipeline (unchanged)

Repo-root `content.json` stays the single source of truth. `scripts/sync-content.mjs` copies it to `content.gen.json` before every dev/build (`predev`/`prebuild`). The nightly publish keeps editing `content.json` exactly as before; once on Vercel, its push to `main` triggers the rebuild. `data.js` remains for the legacy site until cutover.

## Deploy to Vercel

1. Push the repo to GitHub as usual (the `.assetsignore` guard keeps Cloudflare from serving this folder, so pushing is safe while the old site is live).
2. vercel.com -> Add New Project -> import `Champ-Deep/deependhq-site`.
3. Root Directory: `deependhq-next`. Framework: Next.js (auto). Build defaults are fine.
4. Optional env var: `CONTACT_WEBHOOK_URL` for the contact endpoint.
5. Preview URL first; move the `deependhq.com` domain only when satisfied. Keep the Cloudflare Worker as rollback.

## Writing new essays as MDX

Create `app/writing/<slug>/page.mdx`. It becomes a route automatically (see `app/writing/_drafts/` for a template; underscore folders stay unpublished). Pipeline-authored posts in `content.json` keep rendering at `/writing/<slug>` as before.

## Notes

- `node_modules/` lives here after `npm install`. It is gitignored; consider adding this folder to Obsidian's excluded files so the vault stays snappy.
- Fonts load from Google Fonts as in the legacy site; self-hosting is a later optimization.
- The tweaks panel from the Home v4 preview was a design tool and is intentionally not shipped; the chosen defaults (operator palette, canvas globe, kinetic on, dither on) are baked in.
