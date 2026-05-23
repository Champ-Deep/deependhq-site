# deependhq-content

The static content engine for **deependhq.com**, the personal brand site of
Sreedeep Surapaneni ("Deep").

This is a standalone Astro site with static output. It owns three URL paths:

- `/journey` : the build-in-public timeline feed
- `/toolkit` : tools, repos, skills, and resources from the workshop
- `/journey/field-notes` : a wiki-style reference of characters, plot lines,
  themes, and callbacks

## How it fits together

`deependhq.com` is served by a Cloudflare Worker (in the separate
`thedeependhq` repo). That Worker proxies the `/blog`, `/journey`, and
`/toolkit` path prefixes to this site. Everything else is served by the main
application. This repo is purely the content layer for those paths.

## Local development

```bash
npm install
npm run dev      # local dev server
npm run build    # static build to dist/
npm run preview  # preview the built output
```

## Deployment (Cloudflare Pages)

Connect this repository to a Cloudflare Pages project:

- **Framework preset:** Astro (or None)
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node version:** 22

Cloudflare Pages builds `dist/` and serves it. The `thedeependhq` Worker then
proxies the relevant path prefixes here, so the content appears seamlessly
under `deependhq.com`.

`_routes.json` is included so Pages serves everything as static assets with no
Pages Functions invocation.

## Tech

- Astro (static output), TypeScript strict.
- Plain `.astro` components plus one global stylesheet. No UI framework.
- Design system: "Gotham Workshop", dark mode only.
- Fonts: Inter, Fraunces, JetBrains Mono via Google Fonts.

## Content

All page content lives in `src/data/` as JSON:

- `journey.json` : timeline entries
- `toolkit.json` : toolkit items
- `field-notes.json` : characters, plot lines, themes, callbacks

Edit the JSON and rebuild to update the site.
