#!/usr/bin/env node
// sync-content.mjs
// Keeps repo-root content.json (the daily pipeline's source of truth) flowing
// into the Next app without touching the pipeline. Runs automatically before
// `next dev` and `next build` (predev/prebuild).
//
// - If ../content.json exists (normal case inside deependhq-site), copy it to
//   ./content.gen.json.
// - If it does not exist (app checked out standalone), fall back to the
//   committed content.gen.json snapshot and warn.

import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");
const src = join(appRoot, "..", "content.json");
const dest = join(appRoot, "content.gen.json");

if (existsSync(src)) {
  copyFileSync(src, dest);
  console.log("[sync-content] copied ../content.json -> content.gen.json");
} else if (existsSync(dest)) {
  console.warn("[sync-content] ../content.json not found; using committed content.gen.json snapshot");
} else {
  console.error("[sync-content] FATAL: no ../content.json and no content.gen.json snapshot");
  process.exit(1);
}
