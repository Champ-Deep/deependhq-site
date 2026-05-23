# deependhq.com

The personal brand homepage for Sreedeep Surapaneni ("Deep"), Group CMO at
Champions Group, Bangalore. A single-page Next.js homepage plus a Cloudflare
Worker that routes the production domain between this homepage and a separate
content site.

## Stack

- Next.js 16 (App Router, TypeScript strict mode)
- Tailwind CSS v4
- framer-motion (entrance animations)
- gsap + ScrollTrigger (hero headline parallax)
- lucide-react (icons)
- Fonts: Inter, Fraunces, JetBrains Mono via `next/font/google`

Design system: "Gotham Workshop". Dark mode only. Tokens live as CSS custom
properties in `app/globals.css`.

## Project layout

```
app/
  layout.tsx          Root layout, fonts, metadata
  page.tsx            Homepage composition
  globals.css         Design system tokens + base styles
  components/         Section components (Nav, Hero, ShippingNow, etc.)
lib/
  content.ts          All copy and structured data
worker/
  router.js           Cloudflare Worker edge router
wrangler.toml         Worker deploy config
```

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
```

## Deploy the homepage (Vercel)

1. Push the repo to GitHub.
2. Import the project in Vercel. The framework preset (Next.js) is detected
   automatically.
3. Deploy. The homepage will be live at `thedeependhq.vercel.app`.

## Deploy the Worker (Cloudflare)

The Worker routes `deependhq.com` traffic:

- `/blog/*`, `/journey/*`, `/toolkit/*` are served from the content site
  (`deependhq-content.pages.dev`).
- Everything else, including `/` and `/_next/*`, is proxied to the Next.js
  homepage on Vercel (`thedeependhq.vercel.app`).

```bash
npm install -g wrangler   # if not already installed
wrangler deploy
```

Before the Worker can serve the production domain, uncomment the `[[routes]]`
block in `wrangler.toml` and set the zone for `deependhq.com`.
