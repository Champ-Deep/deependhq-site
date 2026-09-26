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
// Entry shape. Only date and shipping_now are required; everything else has a
// default. Schema v2 added the optional fields below, all of which render as
// chips, numbers and media on the day card instead of as more prose.
//
// {
//   "date": "2026-06-04", "day": 215, "mood": "🚀",
//   "shipping_now": "...", "yesterday_thread": "...", "raw_thought": "...",
//   "arcs": ["TheDeepEndHQ"], "arc_color": "green",
//
//   "github_commits": 7,
//   "metrics":   [ { "k": "notes judged", "v": 2861 }, { "k": "cost", "v": 0.02, "unit": "USD" } ],
//   "artifacts": [ { "kind": "repo", "label": "entity-resolution shadow run", "href": "https://github.com/..." } ],
//   "signals":   ["shipped", "external-meeting", "blocked"],
//   "energy": 4,
//   "meetings": { "count": 9, "external": 5 },
//   "media":     [ { "src": "img/log/2026-06-04-graph.webp", "alt": "...", "captured": "2026-06-04" } ],
//   "replay":    { "cast": "casts/2026-06-04-shadow.cast", "duration_s": 94, "label": "the shadow run, 94 seconds" },
//   "tools":     ["Celsus", "OpenRouter"]
// }
//
// v2 rules, all enforced here so a bad entry is refused rather than published:
//   metrics    cap 4, v must be a number, unit optional string
//   artifacts  cap 3, kind from the fixed list, href must be https
//   signals    only the controlled vocabulary, never invented
//   energy     integer 1 to 5
//   meetings   counts only, never names
//   media      cap 2, alt is mandatory and must be non-empty
//   replay     cast path only, no external URL

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


// ---------------------------------------------------------------------------
// schema v2 validation
// Every rule below exists because the alternative was a wrong number or a broken
// image on a public page. A refusal here is the build working, not failing.
// ---------------------------------------------------------------------------

const ARTIFACT_KINDS = new Set(['doc', 'repo', 'deck', 'site', 'deal', 'hire']);
const SIGNALS = new Set([
  'shipped', 'hosted', 'external-meeting', 'budget-unlocked',
  'hire', 'blocked', 'unblocked', 'launch', 'deal',
]);

const bad = (msg) => { console.error(`entry rejected: ${msg}`); process.exit(1); };

function applyV2(e) {
  const out = {};

  if (e.github_commits !== undefined) {
    if (!Number.isInteger(e.github_commits) || e.github_commits < 0) bad(`github_commits must be a non-negative integer, got ${e.github_commits}`);
    out.github_commits = e.github_commits;
  }

  if (e.metrics !== undefined) {
    if (!Array.isArray(e.metrics)) bad('metrics must be an array');
    if (e.metrics.length > 4) bad(`metrics cap is 4, got ${e.metrics.length}`);
    out.metrics = e.metrics.map((m) => {
      if (!m || typeof m.k !== 'string' || !m.k.trim()) bad('each metric needs a k');
      if (typeof m.v !== 'number' || !isFinite(m.v)) bad(`metric "${m.k}" needs a numeric v, got ${JSON.stringify(m.v)}`);
      const o = { k: m.k.trim(), v: m.v };
      if (m.unit !== undefined) {
        if (typeof m.unit !== 'string' || m.unit.length > 8) bad(`metric "${m.k}" unit must be a short string`);
        o.unit = m.unit;
      }
      return o;
    });
  }

  if (e.artifacts !== undefined) {
    if (!Array.isArray(e.artifacts)) bad('artifacts must be an array');
    if (e.artifacts.length > 3) bad(`artifacts cap is 3, got ${e.artifacts.length}`);
    out.artifacts = e.artifacts.map((a) => {
      if (!a || !ARTIFACT_KINDS.has(a.kind)) bad(`artifact kind must be one of ${[...ARTIFACT_KINDS].join(', ')}`);
      if (typeof a.label !== 'string' || !a.label.trim()) bad('each artifact needs a label');
      const o = { kind: a.kind, label: a.label.trim() };
      if (a.href !== undefined) {
        if (typeof a.href !== 'string' || !a.href.startsWith('https://')) {
          bad(`artifact href must be an https url, got ${JSON.stringify(a.href)}`);
        }
        o.href = a.href;
      }
      return o;
    });
  }

  if (e.signals !== undefined) {
    if (!Array.isArray(e.signals)) bad('signals must be an array');
    for (const s of e.signals) {
      if (!SIGNALS.has(s)) bad(`signal "${s}" is not in the controlled vocabulary: ${[...SIGNALS].join(', ')}`);
    }
    out.signals = [...new Set(e.signals)];
  }

  if (e.energy !== undefined) {
    if (!Number.isInteger(e.energy) || e.energy < 1 || e.energy > 5) bad(`energy must be an integer 1 to 5, got ${e.energy}`);
    out.energy = e.energy;
  }

  if (e.meetings !== undefined) {
    const m = e.meetings;
    if (!m || typeof m !== 'object') bad('meetings must be an object with counts');
    if (!Number.isInteger(m.count) || m.count < 0) bad('meetings.count must be a non-negative integer');
    if (m.external !== undefined && (!Number.isInteger(m.external) || m.external < 0 || m.external > m.count)) {
      bad(`meetings.external must be 0 to ${m.count}`);
    }
    out.meetings = { count: m.count, ...(m.external !== undefined ? { external: m.external } : {}) };
  }

  if (e.media !== undefined) {
    if (!Array.isArray(e.media)) bad('media must be an array');
    if (e.media.length > 2) bad(`media cap is 2, got ${e.media.length}`);
    out.media = e.media.map((m) => {
      if (!m || typeof m.src !== 'string' || !m.src.trim()) bad('each media needs a src');
      // alt is mandatory and must be non-empty. A decorative-looking screenshot
      // with no alt is invisible to a screen reader and to a crawler.
      if (typeof m.alt !== 'string' || !m.alt.trim()) bad(`media "${m.src}" needs non-empty alt text`);
      const o = { src: m.src, alt: m.alt.trim() };
      if (m.captured !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(m.captured)) bad(`media captured must be YYYY-MM-DD, got ${m.captured}`);
        o.captured = m.captured;
      }
      return o;
    });
  }

  if (e.replay !== undefined) {
    const r = e.replay;
    if (!r || typeof r.cast !== 'string' || !r.cast.trim()) bad('replay needs a cast path');
    if (/^https?:/i.test(r.cast)) bad('replay.cast must be a local path committed to the repo, not a url');
    if (!r.cast.endsWith('.cast')) bad('replay.cast must end in .cast');
    const o = { cast: r.cast };
    if (r.duration_s !== undefined) {
      if (!Number.isInteger(r.duration_s) || r.duration_s <= 0) bad('replay.duration_s must be a positive integer');
      o.duration_s = r.duration_s;
    }
    if (r.label !== undefined) {
      if (typeof r.label !== 'string' || !r.label.trim()) bad('replay.label must be a non-empty string');
      o.label = r.label.trim();
    }
    out.replay = o;
  }

  if (e.tools !== undefined) {
    if (!Array.isArray(e.tools)) bad('tools must be an array of names');
    out.tools = e.tools.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim());
  }

  return out;
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

  // ---- schema v2, all optional, all validated before anything is written ----
  const v2 = applyV2(entry);

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
  // v2 fields are only attached when present, so an entry without them is
  // byte-identical in shape to every one of the 107 existing entries.
  for (const k of ['github_commits', 'metrics', 'artifacts', 'signals', 'energy', 'meetings', 'media', 'replay', 'tools']) {
    if (v2[k] !== undefined) journeyEntry[k] = v2[k];
  }
  content.journey = (content.journey || []).filter((e) => e.date !== entry.date);
  content.journey.unshift(journeyEntry);

  // 2. brand pointer
  content.brand.today_day = entry.day;
  content.brand.today_date = entry.date;

  // 3. status is NOT written here any more. It used to receive a hand-typed
  //    last_ship, a clock and a commit count, which is exactly how the ticker
  //    came to lie: those strings were typed once and never true again. The
  //    status strip is now derived in scripts/derive.mjs from the newest entry,
  //    so an entry cannot write a number the log does not support.

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
