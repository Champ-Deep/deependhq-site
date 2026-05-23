#!/usr/bin/env bash
# Builds the Next.js homepage and the Astro content site, then merges their
# static output into ./deploy for a single Cloudflare Pages deployment.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "==> [1/3] Building homepage (Next.js, static export)"
cd "$ROOT/thedeependhq"
npm install
npm run build

echo "==> [2/3] Building content site (Astro)"
cd "$ROOT/deependhq-content"
npm install
npm run build

echo "==> [3/3] Merging static output into ./deploy"
cd "$ROOT"
rm -rf deploy
cp -R thedeependhq/out deploy
cp -R deependhq-content/dist/journey deploy/journey
cp -R deependhq-content/dist/toolkit deploy/toolkit
cp -R deependhq-content/dist/_astro deploy/_astro

echo "==> Done. Static site ready in ./deploy"
