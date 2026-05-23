# Deepend HQ: Deploy Runbook

Target: deependhq.com on Cloudflare Pages. One project, one deployment.
Repo: github.com/Champ-Deep/deependhq-site

## What is in here
- `thedeependhq/` : Next.js homepage, configured for static export.
- `deependhq-content/` : Astro content site. /journey, /toolkit, /journey/field-notes.
- `build.sh` : builds both projects, merges their static output into `deploy/`.
- `package.json` : root. `npm run build` runs build.sh.
- `.nvmrc` : pins Node 22 for the Cloudflare build image.

## Prerequisites
- Node 20 or newer (22 recommended) and git on your machine.
- The GitHub repo Champ-Deep/deependhq-site.
- Cloudflare account (Deep@championsmail.com) with deependhq.com already on Cloudflare DNS.

## Step 1: Push the code to GitHub
From inside this `deependhq-site/` folder:
```
git init
git add .
git commit -m "Deepend HQ: homepage + content site"
git branch -M main
git remote add origin https://github.com/Champ-Deep/deependhq-site.git
git push -u origin main
```
If the repo already has commits, run `git pull --rebase origin main` first. If it is an empty scaffold, a force push is fine.

## Step 2: Test the build locally (optional but recommended)
```
npm run build
npx serve deploy
```
Open the localhost URL it prints. `deploy/` is the full merged static site. Do not open `deploy/index.html` directly as a file, the asset paths are absolute.

## Step 3: Create the Cloudflare Pages project
1. dash.cloudflare.com, then Workers and Pages, then Create, then Pages, then Connect to Git.
2. Select the Champ-Deep/deependhq-site repo, branch `main`.
3. Build settings:
   - Framework preset: None
   - Build command: `npm run build`
   - Build output directory: `deploy`
   - Root directory: leave as `/`
4. Environment variables: none required. The `.nvmrc` pins Node 22. If the build still picks an old Node, add `NODE_VERSION` = `22`.
5. Save and Deploy. First build runs about 3 to 6 minutes (it installs and builds both sub-projects).

## Step 4: Verify the preview
The build produces a `deependhq-site.pages.dev` URL. Check:
- Homepage renders dark, with the hero and the 12 company cards.
- /journey, /toolkit, /journey/field-notes all load.
- Nav moves cleanly between the homepage and the content pages.

## Step 5: Attach the custom domain
Pages project, then Custom domains, then Set up a domain. Add `deependhq.com` and `www.deependhq.com`. Cloudflare creates the DNS records automatically because the zone is already on Cloudflare. SSL provisions within a few minutes.

Done. Every push to `main` now auto-deploys.

## Notes
- /blog 404s for now. The blog and EmDash CMS are a later phase. The homepage "How I Think" cards point to `/blog/#` placeholders.
- `thedeependhq/worker/` is an optional Cloudflare Worker router, unused in this single-project deploy. Keep it for a future split into two independently deployed origins.
- Email for deep@deependhq.com is separate. See `Efforts/Active/Inbox-Operations/deependhq-Setup-Plan.md`, section 5 (Cloudflare Email Routing).
- Alternative without Git: `npx wrangler pages deploy deploy --project-name deependhq-site` after running `npm run build` locally.
- Once pushed to GitHub you can delete this local `deependhq-site/` folder to keep the vault lean. GitHub and Cloudflare become the live copies.
