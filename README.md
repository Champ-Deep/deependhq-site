# deependhq.com

Personal site for Sreedeep Surapaneni. Hybrid build, one deployment.

- `thedeependhq/` : Next.js 15/16 homepage. Static export. Cinematic Terminal design.
- `deependhq-content/` : Astro content site. /journey, /toolkit, /journey/field-notes.
- `build.sh` : builds both, merges static output into `deploy/`.
- `worker/` (inside thedeependhq) : optional Cloudflare Worker router, unused in the
  default single-project deploy. Kept for a future split into two origins.

## Deploy

One Cloudflare Pages project. See `DEPLOY.md` for the full walkthrough.

Build command: `npm run build`
Output directory: `deploy`
