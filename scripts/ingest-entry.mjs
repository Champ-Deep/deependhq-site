#!/usr/bin/env node
// ingest-entry.mjs
// The deterministic half of the daily auto-publish pipeline. It takes ONE
// already-synthesized journey entry as JSON and surgically updates content.json:
//   - unshifts the entry onto journey[] (newest first), de-duped by date
//   - bumps brand.today_day / brand.today_date
//   - refreshes status.last_ship, status.vault_commits, status.time_ist
//   - rolls the entry into status_board.recently (keeps the 4 freshest)
// Then it regenerates data.js by importing build-data.mjs.
//
// The SYNTHESIS (reading the daily note + GitHub, deciding the wording and the
// mood/arc) is done by the daily scheduled task, NOT here. This script only does
// the safe, repeatable data surgery so the pipeline never corrupts the file.
//
// Usage:
//   node scripts/ingest-entry.mjs '<json>'
//   node scripts/ingest-entry.mjs --file entry.json
//   echo '<json>' | node scripts/ingest-entry.mjs
//
// Entry shape (all fields optional except date, day, shipping_now):
// {
//   "date": "2026-06-04", "day": 215, "mood": "🚀",
//   "shipping_now": "...", "yesterday_thread": "...", "raw_thought": "...",
//   "arcs": ["TheDeepEndHQ"], "arc_color": "green",
//   "github_commits": 7, "last_ship": "short label"
// }

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SRC = join(root, 'content.json');

const DAY_ONE = '2025-11-01';
const ARC_COLORS = new Set(['green', 'blue', 'gold']);

function readEntryArg() {
  const args = process.argv.slice(2);
  if (args[0] === '--file' && args[1]) return readFileSync(args[1], 'utf8');
  if (args[0] && args[0] !== '-') return args[0];
  // stdin fallback
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function dayNumberFor(isoDate) {
  const a = Date.UTC(...DAY_ONE.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
  const b = Date.UTC(...isoDate.split('-').map((n, i) => (i === 1 ? +n - 1 : +n)));
  return Math.floor((b - a) / 86400000) + 1;
}

function istClock() {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} IST`;
}

function main() {
  const rawEntry = readEntryArg().trim();
  if (!rawEntry) {
    console.error('No entry provided. Pass JSON as an argument, with --file, or via stdin.');
    process.exit(1);
  }

  let entry;
  try { entry = JSON.parse(rawEntry); } catch (e) {
    console.error('Entry is not valid JSON:', e.message);
    process.exit(1);
  }

  if (!entry.date) { console.error('Entry needs a "date" (YYYY-MM-DD).'); process.exit(1); }
  if (!entry.shipping_now) { console.error('Entry needs a "shipping_now" line.'); process.exit(1); }

  if (!entry.day) entry.day = dayNumberFor(entry.date);
  if (!entry.mood) entry.mood = '🛠️';
  if (!Array.isArray(entry.arcs) || entry.arcs.length === 0) entry.arcs = ['Building in Public'];
  if (!ARC_COLORS.has(entry.arc_color)) entry.arc_color = 'green';
  entry.yesterday_thread = entry.yesterday_thread || '';
  entry.raw_thought = entry.raw_thought || '';

  const github_commits = Number.isFinite(entry.github_commits) ? entry.github_commits : null;
  const lastShipLabel = entry.last_ship || entry.shipping_now;

  const content = JSON.parse(readFileSync(SRC, 'utf8'));

  // 1. journey — de-dupe by date, then unshift newest first.
  const journeyEntry = {
    date: entry.date, day: entry.day, mood: entry.mood,
    shipping_now: entry.shipping_now,
    yesterday_thread: entry.yesterday_thread,
    raw_thought: entry.raw_thought,
    arcs: entry.arcs, arc_color: entry.arc_color,
  };
  content.journey = (content.journey || []).filter((e) => e.date !== entry.date);
  content.journey.unshift(journeyEntry);

  // 2. brand pointer
  content.brand.today_day = entry.day;
  content.brand.today_date = entry.date;

  // 3. status strip
  content.status = content.status || {};
  content.status.last_ship = `${lastShipLabel} · just now`;
  content.status.time_ist = istClock();
  if (github_commits !== null) content.status.vault_commits = github_commits;

  // 4. status_board.recently — prepend this ship, keep freshest 4.
  content.status_board = content.status_board || {};
  const recently = content.status_board.recently || [];
  const shortText = entry.shipping_now.length > 90
    ? entry.shipping_now.slice(0, 87).trimEnd() + '...'
    : entry.shipping_now;
  recently.unshift({ text: shortText, tag: `shipped d${entry.day}` });
  content.status_board.recently = recently.slice(0, 4);

  writeFileSync(SRC, JSON.stringify(content, null, 2) + '\n', 'utf8');
  console.log(`ingested day ${entry.day} (${entry.date}) into content.json`);

  // 5. regenerate data.js
  execFileSync(process.execPath, [join(here, 'build-data.mjs')], { stdio: 'inherit' });
}

main();
