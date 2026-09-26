# Deepend HQ: Deploy Runbook

> **UPDATED 2026-09-26.** The short version below used to be right and is now
> wrong in two places that will break your build. Read this first.

## What changed

The site is no longer "no build, nothing to install". It is still served as
static files with React in the browser, but there are now three things that
must happen before a push:

1. `scripts/build-data.mjs` regenerates `data.js` from `content.json` and
   derives every number on the site.
2. `scripts/guard.mjs` fails the build if a real name or a sensitive
   disclosure would go public.
3. `scripts/prerender.mjs` renders every page to static HTML inside `#root`, so
   crawlers and visitors with JavaScript off see the text. It needs esbuild.
4. `scripts/link-check.mjs` fails the build if any link points at a page that
   does not exist.

The deploy is a Cloudflare **Worker** with static assets, not a Pages upload.
`worker/index.js` holds the redirects and the security headers.

## Two traps that cost real time on 2026-09-26

**Do not delete `package.json`.** It used to be gitignored and DEPLOY.md step 1
told you to remove it. It is now tracked and load-bearing. esbuild is a
**runtime** dependency, not a dev one, because Cloudflare builds may install
with `NODE_ENV=production`, which skips devDependencies and would leave
prerender with no bundler, publishing pages with an empty `#root`.

**`node_modules` must stay in `.assetsignore`.** Cloudflare builds runs
`npm install` in the checkout. Without that ignore line, `node_modules/workerd`
(135MB) is uploaded as a Worker asset and trips the 25MB per-asset limit, so
the build fails and **nothing deploys while the publish still reports success**.
If a push says PUBLISHED and the live site is unchanged, check this first.

## Verify a deploy actually landed

A successful `publish.sh` only means the push happened. Check the live site:

```
curl -s https://deependhq.com/data.js | sed -n '3p'   # Built <timestamp>
curl -sI https://deependhq.com/ | grep -i content-security-policy
```

The second command returning nothing means the Worker did not deploy. The
first timestamp older than your local `data.js` means the same.

## Step 1: Clean the folder (obsolete Next.js/Astro leftovers only)

The earlier Next.js and Astro build is still sitting in this folder. From
Terminal, remove the leftovers. **Note what is no longer in this list:**
`package.json` and `package-lock.json` are now tracked and required.

```
cd "/Users/deep/Celsus/Efforts/Active/TheDeepEndHQ/deependhq-site"
rm -rf thedeependhq deependhq-content deploy \
       build.sh .nvmrc design-canvas.jsx Deliverables.html
```

## Step 2: Deploy to Cloudflare Pages

Pick one. Option A is the fastest.

### Option A: Dashboard upload (no CLI, no GitHub)
1. dash.cloudflare.com, then Workers and Pages, then Create, then Pages, then "Upload assets".
2. Project name: `deependhq`
3. Drag the whole `deependhq-site` folder into the uploader.
4. Click Deploy. Live on a `*.pages.dev` URL in under a minute.

### Option B: Wrangler CLI
```
cd "/Users/deep/Celsus/Efforts/Active/TheDeepEndHQ/deependhq-site"
npx wrangler pages deploy . --project-name deependhq
```
The first run opens a browser to authorize Wrangler with your Cloudflare account.

### Option C: Git-connected (auto-deploy on every change)
Push the cleaned folder to github.com/Champ-Deep/deependhq-site, then in
Cloudflare Pages connect the repo. Build command: leave EMPTY. Output
directory: `/`. Framework preset: None.

## Step 3: Attach the domain

Pages project, then Custom domains, then add `deependhq.com` and
`www.deependhq.com`. Cloudflare creates the DNS automatically because the zone
is already on Cloudflare. SSL provisions within a few minutes.

## How the URLs map
- `index.html` to `/`
- `journey.html` to `/journey`
- `toolkit.html` to `/toolkit`
- `field-notes.html` to `/field-notes`

Cloudflare Pages serves the `.html` files extensionless automatically.

## Notes
- All copy and data lives in `data.js`. Edit there, redeploy.
- The site loads React and Babel from a CDN and renders in the browser. It
  works as-is. If you later want a faster first paint, the JSX can be
  pre-compiled without changing the design. Optional, not needed to ship.
- The full Gotham Workshop design system is kept as reference one folder up,
  at `Efforts/Active/TheDeepEndHQ/Gotham Workshop Design System/`.
