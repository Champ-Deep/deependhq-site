// digest.mjs : the weekly written read on what the site is actually doing.
//
// WHAT THIS IS
// One file in the vault per week. It compares the last 7 days against the
// previous 7 and reports three things: what changed, what it cannot yet explain,
// and one concrete recommendation. It proposes. It never applies, with one
// exception described below.
//
// WHAT IT IS NOT ALLOWED TO DO
// No causal language without a sample size. It may say "essay A was read to 80%
// by 12 visitors", never "A is more engaging, therefore write more like A". Every
// quantitative line carries the n it rests on, and any line whose n is under
// MIN_N is reported as inconclusive rather than as a finding. That is not
// politeness, it is the only way a weekly report stays worth reading after the
// third week of noise.
//
// THE ONE THING IT DOES WRITE
// copy-rules.json, and only when a variant has actually beaten the control by a
// margin worth acting on. That file is what the browser copy engine reads, and it
// is the single path from "the data said so" to "a visitor sees different words".
// Everything else in this file is a suggestion for a human.
//
//   node scripts/digest.mjs 7d > /tmp/digest.md
//
// Exits 2 with setup instructions rather than printing a number it cannot verify.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Below this, a difference is noise. Twelve visitors is not a sample.
const MIN_N = 30;
// A variant must beat the control by this share to be worth applying.
const MIN_LIFT = 0.15;

// Everything below the render boundary is a pure function of `data`. The CLI
// collects, the renderer renders, and the selftest feeds the renderer fixtures
// directly. That split exists because the renderer's job is to be honest about
// thin data, and you cannot test honesty by running the thing through a process
// exit.
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CF_ACCOUNT_ID;
const DATASET = process.env.ANALYTICS_DATASET || 'deependhq_events';

if (!TOKEN || !ACCOUNT) {
  console.error(`digest: cannot read the dataset without Cloudflare credentials.

  export CLOUDFLARE_API_TOKEN=***   # Account > Analytics > Read
  export CF_ACCOUNT_ID=***

Nothing below this line can be produced honestly without them, so this tool
refuses to invent numbers.`);
  process.exit(2);
}

function dRange(daysAgo, offsetDays = 0) {
  const now = new Date();
  const a = new Date(now.getTime() - (daysAgo + offsetDays) * 864e5);
  const b = new Date(now.getTime() - (daysAgo - 1 + offsetDays) * 864e5);
  const iso = (d) => d.toISOString().slice(0, 19);
  return [iso(a), iso(b)];
}

async function query(sql, daysAgo, offset = 0) {
  const [start, end] = dRange(daysAgo, offset);
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ query: sql, since: start, until: end, limit: 10000 }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`analytics query failed ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  return j.result || j.data || [];
}

const n = (v) => (v == null ? 0 : Number(v));



const days = Number((process.argv[2] || '7d').replace(/d$/, '')) || 7;

// ------------------------------------------------------------------ collect

let totals, prevTotals, segRows, pageRows, ctaRows, askRows, bandRows, thisWeekVisitors;

try {
  totals = await query(
    `SELECT blob2 AS kind, COUNT(*) AS views, SUM(double3) AS avg_scroll, COUNT(DISTINCT blob5) AS visitors
     FROM ${DATASET} WHERE index1 = 'page' GROUP BY blob2`,
    days
  );
  prevTotals = await query(
    `SELECT blob2 AS kind, COUNT(*) AS views, SUM(double3) AS avg_scroll, COUNT(DISTINCT blob5) AS visitors
     FROM ${DATASET} WHERE index1 = 'page' GROUP BY blob2`,
    days, days
  );
  segRows = await query(
    `SELECT blob4 AS segment, COUNT(*) AS views, COUNT(DISTINCT blob5) AS visitors, SUM(double5) AS ctas
     FROM ${DATASET} WHERE index1 = 'page' GROUP BY blob4 ORDER BY views DESC`,
    days
  );
  bandRows = await query(
    `SELECT blob6 AS band, COUNT(*) AS visits, SUM(double6) AS intent
     FROM ${DATASET} WHERE index1 = 'engage' GROUP BY blob6 ORDER BY visits DESC`,
    days
  );
  pageRows = await query(
    `SELECT blob1 AS page, COUNT(*) AS views, COUNT(DISTINCT blob5) AS visitors,
            AVG(double3) AS avg_scroll, SUM(double4) AS avg_dwell
     FROM ${DATASET} WHERE index1 = 'page' GROUP BY blob1 ORDER BY views DESC LIMIT 12`,
    days
  );
  ctaRows = await query(
    `SELECT blob2 AS label, COUNT(*) AS clicks, COUNT(DISTINCT blob5) AS visitors
     FROM ${DATASET} WHERE index1 = 'cta' GROUP BY blob2 ORDER BY clicks DESC`,
    days
  );
  askRows = await query(
    `SELECT blob2 AS answer, blob3 AS question, COUNT(*) AS n
     FROM ${DATASET} WHERE index1 = 'ask' GROUP BY blob2, blob3 ORDER BY n DESC`,
    days
  );
} catch (err) {
  console.error(`digest: ${err.message}`);
  console.error('\nThis usually means the dataset does not exist yet. Create');
  console.error(`${DATASET} in Cloudflare (Workers and Pages > Analytics Engine),`);
  console.error('then deploy. Until then this tool has nothing honest to report.');
  process.exit(1);
}

// ------------------------------------------------------------------ render
// The report text is produced by digest-render.mjs, which is a pure function of
// the rows above. Keeping it separate is what lets scripts/selftest-digest.mjs
// feed it fixtures and assert on the wording, which is the part that matters: a
// weekly report full of confident claims built on nine visitors is worse than no
// report at all.

const { render } = await import('./digest-render.mjs');

const text = render(
  { totals, prevTotals, segRows, bandRows, pageRows, ctaRows, askRows },
  { days, minN: MIN_N, minLift: MIN_LIFT, today: new Date().toISOString().slice(0, 10) }
);

const out = process.env.DIGEST_OUT || '/tmp/digest.md';
writeFileSync(out, text);
console.log(text);
console.error(`\ndigest: written to ${out}`);
