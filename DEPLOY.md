# Deepend HQ: Deploy Runbook

The site is the Gotham Workshop kit. It is a no-build static site: four HTML
pages that render React components in the browser. There is nothing to compile
and nothing to install. Deploying it is just uploading a folder.

## Step 1: Clean the folder

The earlier Next.js and Astro build is still sitting in this folder. The build
environment could not delete it, but your Mac can. From Terminal:

```
cd "/Users/deep/Celsus/Efforts/Active/TheDeepEndHQ/deependhq-site"
rm -rf .git thedeependhq deependhq-content deploy node_modules \
       build.sh package.json package-lock.json .nvmrc \
       design-canvas.jsx Deliverables.html
```

After this the folder holds only the site: four HTML pages, the .jsx
components, styles.css, styles-x.css, data.js, [[README]].md, DEPLOY.md.

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
