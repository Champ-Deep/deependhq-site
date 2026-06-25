#!/usr/bin/env node
// check-gaps.mjs — catch-up guard for the daily auto-publish pipeline.
//
// Prints any WEEKDAY dates between the newest journey entry and yesterday (IST)
// that have NO journey entry yet. The daily publish task should read this, then
// author + ingest one entry per missing day (oldest first) BEFORE today's entry.
//
// Output (machine-readable, last line):
//   MISSING_DAYS=2026-06-24,2026-06-26
//   MISSING_DAYS=            (nothing missing)
//
// Why this exists: on 2026-06-24 the pipeline did not run and that day was
// silently skipped (235 -> 237). This guard makes a missed day self-heal on the
// next successful run instead of leaving a permanent hole.
//
// No dependencies. Node 18+.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(readFileSync(join(here, '..', 'content.json'), 'utf8'));
const have = new Set((content.journey || []).map((e) => e.date));

// "Yesterday" in IST (the most recent day that should already be published).
const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
const start = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() - 1);

const missing = [];
for (let i = 0; i < 10; i++) {
  const d = new Date(start - i * 86400000);
  const iso = d.toISOString().slice(0, 10);
  if (have.has(iso)) break;            // reached the last published day; older is fine
  const dow = d.getUTCDay();           // 0 = Sun, 6 = Sat
  if (dow !== 0 && dow !== 6) missing.push(iso);  // weekdays only; weekends skip by design
}
missing.reverse();                     // oldest first, so backfill reads chronologically

console.log('MISSING_DAYS=' + missing.join(','));
