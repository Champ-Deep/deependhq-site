// guard-selftest.mjs : prove the guard actually fails. A gate that has never
// been seen to fail is a gate nobody knows is armed.
//
// Each case injects a known-bad string into a COPY of content.json, runs the
// guard against that copy, and asserts the exit code. The real content.json is
// never touched.
//
//   node scripts/guard-selftest.mjs

import { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// A minimal tree: scripts/guard.mjs plus a content.json we control.
const work = mkdtempSync(join(tmpdir(), 'dh-guard-'));
mkdirSync(join(work, 'scripts'), { recursive: true });
copyFileSync(join(here, 'guard.mjs'), join(work, 'scripts', 'guard.mjs'));

const BASE = {
  brand: { today_day: 1, today_date: '2026-09-26' },
  journey: [
    {
      date: '2026-09-26', day: 1, mood: 'x',
      shipping_now: 'shipped a thing',
      yesterday_thread: '', raw_thought: 'ordinary reflection about a pipeline week',
      arcs: ['Lake B2B'], arc_color: 'green',
    },
  ],
  companies: [{ name: 'Acme Data', desc: 'a fictional company', tag: 'Data' }],
  now: { updated: '2026-09-26', focus: [{ k: 'SHIPPING', color: 'green', text: 'normal focus text' }] },
};

function run(caseName, mutate, denylist, extraArgs = []) {
  const content = JSON.parse(JSON.stringify(BASE));
  mutate(content);
  writeFileSync(join(work, 'content.json'), JSON.stringify(content, null, 2), 'utf8');
  writeFileSync(join(work, 'scripts', 'denylist.json'), JSON.stringify(denylist, { names: [], clients: [] }), 'utf8');
  let code = 0;
  let out = '';
  try {
    out = execFileSync(process.execPath, [join(work, 'scripts', 'guard.mjs'), ...extraArgs], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = e.status == null ? -1 : e.status;
    out = (e.stdout || '') + (e.stderr || '');
  }
  return { caseName, code, out };
}

const CASES = [
  {
    name: 'clean content passes',
    denylist: { names: [], clients: [] },
    mutate: () => {},
    expect: 0,
  },
  {
    name: 'a denylisted first name fails the build',
    denylist: { names: ['Rohan'], clients: [] },
    mutate: (c) => { c.journey[0].shipping_now = 'paired with Rohan on the schema change'; },
    expect: 1,
  },
  {
    name: 'a denylisted client name fails the build',
    denylist: { names: [], clients: ['Northwind'] },
    mutate: (c) => { c.journey[0].yesterday_thread = 'Northwind asked for a second scope'; },
    expect: 1,
  },
  {
    name: 'the word pipeline never trips the sensitive gate',
    denylist: { names: [], clients: [] },
    mutate: (c) => { c.journey[0].raw_thought = 'the pipeline widened again. hospitality is a different class of capital.'; },
    expect: 0,
  },
  {
    name: 'a severance dispute fails the build',
    denylist: { names: [], clients: [] },
    mutate: (c) => { c.journey[0].raw_thought = 'one of them is in a severance dispute right now'; },
    expect: 1,
  },
  {
    name: 'a performance plan fails the build',
    denylist: { names: [], clients: [] },
    mutate: (c) => { c.journey[0].yesterday_thread = 'someone pushed back on a performance plan'; },
    expect: 1,
  },
  {
    name: 'a medical detail fails the build',
    denylist: { names: [], clients: [] },
    mutate: (c) => { c.journey[0].raw_thought = 'shared his diagnosis with me last week'; },
    expect: 1,
  },
  {
    name: 'a sensitive hit passes only with --allow-sensitive',
    denylist: { names: [], clients: [] },
    mutate: (c) => { c.journey[0].raw_thought = 'a severance dispute, anonymised'; },
    expect: 0,
    extraArgs: ['--allow-sensitive'],
  },
  {
    name: 'a name hit still fails even with --allow-sensitive',
    denylist: { names: ['Rohan'], clients: [] },
    mutate: (c) => { c.journey[0].shipping_now = 'shipped with Rohan'; },
    expect: 1,
    extraArgs: ['--allow-sensitive'],
  },
];

let pass = 0;
let fail = 0;
console.log('--- guard self test ---');
for (const c of CASES) {
  const r = run(c.name, c.mutate, c.denylist, c.extraArgs || []);
  const ok = r.code === c.expect;
  if (ok) { pass++; console.log(`ok   ${c.name} (exit ${r.code})`); }
  else {
    fail++;
    console.log(`FAIL ${c.name}: expected exit ${c.expect}, got ${r.code}`);
    console.log('     ' + r.out.split('\n').filter((l) => l.trim()).slice(0, 6).join('\n     '));
  }
}
console.log(`\nguard self test: ${pass}/${CASES.length} cases behave as specified.`);
if (fail) process.exitCode = 1;
