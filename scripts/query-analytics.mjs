// query-analytics.mjs : read the events back out of Analytics Engine.
//
// The write path is /api/collect. This is the read path, over the same dataset,
// so the numbers on a dashboard and the numbers here cannot disagree.
//
//   node scripts/query-analytics.mjs today
//   node scripts/query-analytics.mjs 7d
//   node scripts/query-analytics.mjs 30d pages
//
// REQUIRES a Cloudflare API token with Account Analytics read. It is never in
// this file. Export it before running:
//
//   export CLOUDFLARE_API_TOKEN=...        # Account > Analytics > Read
//   export CF_ACCOUNT_ID=...               # the account that owns the Worker
//   export CF_DATASET=deependhq_events     # optional, this is the default
//
// Without a token this prints what to set up and exits 2. It never prints a
// placeholder result, because a dashboard that shows invented numbers is worse
// than no dashboard.

import { readFileSync } from 'node:fs';

const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const ACCOUNT = process.env.CF_ACCOUNT_ID || '';
const DATASET = process.env.CF_DATASET || 'deependhq_events';

// Analytics Engine indexes are exactly 20 bytes. Truncating matters: a longer
// index is rejected at write time, and a query filter that does not match the
// stored form silently returns nothing, which reads as "no traffic".
const idx = (s, n = 20) => String(s == null ? '' : s).slice(0, n);

const RANGES = { today: 1, '7d': 7, '30d': 30, '90d': 90 };

function datasetInfo() {
  const wrangler = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '');
  const j = JSON.parse(wrangler);
  return (j.analytics && j.analytics.dataset) || DATASET;
}

async function query(sql) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloudflare ${res.status}: ${body.slice(0, 400)}`);
  }
  const j = await res.json();
  if (!j.success) throw new Error(`query failed: ${JSON.stringify(j.errors || j).slice(0, 400)}`);
  return j.result || [];
}

async function main() {
  const arg = (process.argv[2] || '7d').toLowerCase();
  const what = (process.argv[3] || 'summary').toLowerCase();
  const days = RANGES[arg];
  if (!days) {
    console.error(`unknown range "${arg}". use one of: ${Object.keys(RANGES).join(', ')}`);
    process.exit(2);
  }
  const dataset = datasetInfo();

  if (!TOKEN || !ACCOUNT) {
    console.log('Analytics Engine is live and collecting, but reading it needs two values');
    console.log('this machine does not have. Nothing here is fabricated, so it stops here.\n');
    console.log('  CLOUDFLARE_API_TOKEN  Account > Analytics > Read');
    console.log('  CF_ACCOUNT_ID         the account that owns the deependhq Worker\n');
    console.log(`  dataset in use: ${dataset}`);
    console.log('\nAlternatively the Cloudflare dashboard shows the same data at');
    console.log('Workers and Pages > deependhq > Analytics Engine > Query.');
    process.exit(2);
  }

  const fmt = (rows, cols) => {
    if (!rows.length) return '  (no rows)';
    const head = Object.keys(rows[0]);
    const w = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
    const line = (cells) => '  ' + cells.map((c, i) => String(c).padEnd(w[i])).join('  ');
    return [line(head), '  ' + '-'.repeat(w.join('  -  '.length)), ...rows.map((r) => line(cols.map((c) => r[c] ?? '')))].join('\n');
  };

  if (what === 'pages') {
    const sql = `SELECT blob1 AS path, SUM(double5) AS views
                 FROM ${dataset}
                 WHERE index1 = '${idx('page')}' AND timestamp >= now() - ${days} * 86400
                 GROUP BY path ORDER BY views DESC LIMIT 40`;
    console.log(`\npage views, last ${days} day(s)\n`);
    console.log(fmt(await query(sql), ['path', 'views']));
    return;
  }

  if (what === 'sources') {
    const sql = `SELECT index2 AS source, SUM(double5) AS views
                 FROM ${dataset}
                 WHERE index1 = '${idx('page')}' AND timestamp >= now() - ${days} * 86400
                 GROUP BY source ORDER BY views DESC LIMIT 30`;
    console.log(`\nwhere visits came from, last ${days} day(s)\n`);
    console.log(fmt(await query(sql), ['source', 'views']));
    return;
  }

  if (what === 'countries') {
    const sql = `SELECT blob3 AS country, SUM(double5) AS views
                 FROM ${dataset}
                 WHERE index1 = '${idx('page')}' AND timestamp >= now() - ${days} * 86400
                 GROUP BY country ORDER BY views DESC LIMIT 30`;
    console.log(`\ncountry, last ${days} day(s)\n`);
    console.log(fmt(await query(sql), ['country', 'views']));
    return;
  }

  if (what === 'intent') {
    const sql = `SELECT index1 AS event, index2 AS label, SUM(double5) AS n
                 FROM ${dataset}
                 WHERE index1 IN ('${idx('cta')}', '${idx('outbound')}', '${idx('easter_egg')}', '${idx('widget')}')
                   AND timestamp >= now() - ${days} * 86400
                 GROUP BY event, label ORDER BY n DESC LIMIT 40`;
    console.log(`\nintent, last ${days} day(s)\n`);
    console.log(fmt(await query(sql), ['event', 'label', 'n']));
    return;
  }

  if (what === 'depth') {
    const sql = `SELECT double1 AS depth, SUM(double5) AS n
                 FROM ${dataset}
                 WHERE index1 = '${idx('scroll')}' AND timestamp >= now() - ${days} * 86400
                 GROUP BY depth ORDER BY depth`;
    console.log(`\nscroll depth, last ${days} day(s)\n`);
    console.log(fmt(await query(sql), ['depth', 'n']));
    return;
  }

  // summary
  const total = await query(
    `SELECT SUM(double5) AS views FROM ${dataset} WHERE index1 = '${idx('page')}' AND timestamp >= now() - ${days} * 86400`);
  const engages = await query(
    `SELECT SUM(double5) AS n, AVG(double2) AS avg_secs, AVG(double3) AS avg_scroll
     FROM ${dataset} WHERE index1 = '${idx('engage')}' AND timestamp >= now() - ${days} * 86400`);
  const byEvent = await query(
    `SELECT index1 AS event, SUM(double5) AS n FROM ${dataset}
     WHERE timestamp >= now() - ${days} * 86400 GROUP BY event ORDER BY n DESC`);

  console.log(`\ndeependhq, last ${days} day(s). dataset: ${dataset}\n`);
  console.log(`  page views      ${total[0] ? total[0].views || 0 : 0}`);
  console.log(`  engaged visits  ${engages[0] ? engages[0].n || 0 : 0}`);
  console.log(`  avg dwell       ${engages[0] && engages[0].avg_secs ? Math.round(engages[0].avg_secs) + 's' : 'n/a'}`);
  console.log(`  avg max scroll  ${engages[0] && engages[0].avg_scroll ? Math.round(engages[0].avg_scroll) + '%' : 'n/a'}`);
  console.log('\n  events');
  console.log(fmt(byEvent, ['event', 'n']));
  console.log('\n  next: query-analytics.mjs 7d pages | sources | countries | intent | depth\n');
}

main().catch((e) => {
  console.error('query failed:', e.message);
  process.exit(1);
});
