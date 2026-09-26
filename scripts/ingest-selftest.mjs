// ingest-selftest.mjs : prove the schema v2 validator refuses bad entries, and
// that a good v2 entry is accepted with every optional field intact.
//
// Runs against a THROWAWAY copy of the repo's scripts plus a synthetic
// content.json, so the real content.json and data.js are never touched.
//
//   node scripts/ingest-selftest.mjs

import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const work = mkdtempSync(join(tmpdir(), 'dh-ingest-'));
mkdirSync(join(work, 'scripts'), { recursive: true });
for (const f of ['ingest-entry.mjs', 'build-data.mjs', 'derive.mjs', 'guard.mjs', 'denylist.json']) {
  copyFileSync(join(here, f), join(work, 'scripts', f));
}

const BASE_CONTENT = {
  brand: { today_day: 329, today_date: '2026-09-25', day_one: '2025-11-01' },
  companies: [{ name: 'Lake B2B', desc: 'd', tag: 'Data', url: 'https://lakeb2b.com', products: [] }],
  journey: [
    { date: '2026-09-25', day: 329, mood: 'x', shipping_now: 'yesterday', yesterday_thread: '', raw_thought: '', arcs: ['Lake B2B'], arc_color: 'green' },
  ],
  posts: [], now: { updated: '2026-09-25', focus: [] }, build_lanes: { updated: '2026-09-25', live: [] },
  shoutouts: { updated: '2026-09-25', items: [] }, toolkit: [], tools: [], stack: [], off_hours: [], rolodex: [],
};

function run(entry) {
  writeFileSync(join(work, 'content.json'), JSON.stringify(BASE_CONTENT, null, 2), 'utf8');
  let code = 0; let out = '';
  try {
    out = execFileSync(process.execPath, [join(work, 'scripts', 'ingest-entry.mjs'), JSON.stringify(entry)], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = e.status == null ? -1 : e.status;
    out = (e.stdout || '') + (e.stderr || '');
  }
  const written = JSON.parse(readFileSync(join(work, 'content.json'), 'utf8'));
  return { code, out, content: written };
}

const OK = { date: '2026-09-26', shipping_now: 'a valid entry' };
const CASES = [
  { name: 'the minimum viable entry is accepted', entry: OK, expect: 0 },
  { name: 'a missing date is rejected', entry: { shipping_now: 'x' }, expect: 1 },
  { name: 'a missing shipping_now is rejected', entry: { date: '2026-09-26' }, expect: 1 },
  {
    name: 'a full v2 entry is accepted with every field intact',
    entry: {
      ...OK,
      github_commits: 14,
      metrics: [{ k: 'notes judged', v: 2861 }, { k: 'cost', v: 0.02, unit: 'USD' }],
      artifacts: [{ kind: 'repo', label: 'shadow run', href: 'https://github.com/Champ-Deep/x' }, { kind: 'doc', label: 'internal strategy doc' }],
      signals: ['shipped', 'external-meeting', 'blocked'],
      energy: 4,
      meetings: { count: 9, external: 5 },
      media: [{ src: 'img/log/x.webp', alt: 'graph of 635 ambiguous mentions', captured: '2026-09-26' }],
      replay: { cast: 'casts/2026-09-26-shadow.cast', duration_s: 94, label: 'the shadow run, 94 seconds' },
      tools: ['Celsus', 'OpenRouter'],
    },
    expect: 0,
    assert: (c) => {
      const e = c.journey.find((x) => x.date === '2026-09-26');
      const need = ['github_commits', 'metrics', 'artifacts', 'signals', 'energy', 'meetings', 'media', 'replay', 'tools'];
      for (const k of need) if (e[k] === undefined) throw new Error(`field ${k} was dropped`);
      if (e.metrics.length !== 2) throw new Error('metrics not preserved');
      if (e.replay.cast !== 'casts/2026-09-26-shadow.cast') throw new Error('replay not preserved');
    },
  },
  { name: 'a non-integer github_commits is rejected', entry: { ...OK, github_commits: 1.5 }, expect: 1 },
  { name: 'a negative github_commits is rejected', entry: { ...OK, github_commits: -2 }, expect: 1 },
  { name: 'more than 4 metrics is rejected', entry: { ...OK, metrics: [1, 2, 3, 4, 5].map((v) => ({ k: 'm' + v, v })) }, expect: 1 },
  { name: 'a non-numeric metric is rejected', entry: { ...OK, metrics: [{ k: 'm', v: 'lots' }] }, expect: 1 },
  { name: 'a metric with no key is rejected', entry: { ...OK, metrics: [{ v: 5 }] }, expect: 1 },
  { name: 'an invented artifact kind is rejected', entry: { ...OK, artifacts: [{ kind: 'screenshot', label: 'x' }] }, expect: 1 },
  { name: 'more than 3 artifacts is rejected', entry: { ...OK, artifacts: [1, 2, 3, 4].map((i) => ({ kind: 'doc', label: 'a' + i })) }, expect: 1 },
  { name: 'a non-https artifact href is rejected', entry: { ...OK, artifacts: [{ kind: 'repo', label: 'x', href: 'http://insecure.example' }] }, expect: 1 },
  { name: 'an invented signal is rejected', entry: { ...OK, signals: ['shipped', 'vibing'] }, expect: 1 },
  { name: 'energy 0 is rejected', entry: { ...OK, energy: 0 }, expect: 1 },
  { name: 'energy 6 is rejected', entry: { ...OK, energy: 6 }, expect: 1 },
  { name: 'energy 3.5 is rejected', entry: { ...OK, energy: 3.5 }, expect: 1 },
  { name: 'external meetings above the total is rejected', entry: { ...OK, meetings: { count: 2, external: 5 } }, expect: 1 },
  { name: 'media with no alt text is rejected', entry: { ...OK, media: [{ src: 'img/x.webp' }] }, expect: 1 },
  { name: 'media with empty alt text is rejected', entry: { ...OK, media: [{ src: 'img/x.webp', alt: '   ' }] }, expect: 1 },
  { name: 'more than 2 media is rejected', entry: { ...OK, media: [1, 2, 3].map((i) => ({ src: `i${i}.webp`, alt: 'a' + i })) }, expect: 1 },
  { name: 'a malformed media date is rejected', entry: { ...OK, media: [{ src: 'i.webp', alt: 'a', captured: '26-09-2026' }] }, expect: 1 },
  { name: 'a replay url instead of a path is rejected', entry: { ...OK, replay: { cast: 'https://example.com/a.cast' } }, expect: 1 },
  { name: 'a replay that is not a .cast is rejected', entry: { ...OK, replay: { cast: 'casts/a.txt' } }, expect: 1 },
];

let pass = 0; let fail = 0;
console.log('--- ingest schema v2 self test ---');
for (const c of CASES) {
  const r = run(c.entry);
  let ok = r.code === c.expect;
  let why = '';
  if (ok && c.assert) {
    try { c.assert(r.content); } catch (e) { ok = false; why = e.message; }
  }
  if (ok) { pass++; console.log(`ok   ${c.name}`); }
  else {
    fail++;
    console.log(`FAIL ${c.name}: expected exit ${c.expect}, got ${r.code}${why ? ' (' + why + ')' : ''}`);
    console.log('     ' + r.out.split('\n').filter((l) => l.trim()).slice(-4).join('\n     '));
  }
}
console.log(`\ningest self test: ${pass}/${CASES.length} cases behave as specified.`);
if (fail) process.exitCode = 1;
