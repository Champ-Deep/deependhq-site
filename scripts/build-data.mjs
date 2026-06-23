#!/usr/bin/env node
// build-data.mjs
// Reads content.json (the source of truth) and regenerates data.js, the file
// the HTML pages actually load. Run after any edit to content.json:
//
//   node scripts/build-data.mjs
//
// No dependencies. Node 18+.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const SRC = join(root, 'content.json');
const OUT = join(root, 'data.js');

function main() {
  const raw = readFileSync(SRC, 'utf8');
  let content;
  try {
    content = JSON.parse(raw);
  } catch (err) {
    console.error('content.json is not valid JSON:', err.message);
    process.exit(1);
  }

  // _meta is editor-only context. Never ship it to the public bundle.
  const { _meta, ...data } = content;

  // Hard rule: NO em-dashes in any published output. Strip them from every
  // string value as a deterministic safety net, regardless of how they got in
  // (authoring slip, paste, manual edit). en-dashes too.
  const deDash = (s) => s.replace(/\s*[—–]\s*/g, ', ').replace(/[—–]/g, ', ');
  const scrub = (o) => Array.isArray(o) ? o.map(scrub)
    : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, scrub(v)]))
    : (typeof o === 'string' ? deDash(o) : o);
  const cleaned = scrub(data);
  Object.assign(data, cleaned);

  // Journey is always newest-first. Sort defensively so a manual edit to
  // content.json (pasting an entry in the wrong spot) never mis-orders the feed.
  if (Array.isArray(data.journey)) {
    data.journey.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    // Keep the brand pointer aligned to the newest entry.
    if (data.journey[0] && data.brand) {
      data.brand.today_date = data.journey[0].date;
      data.brand.today_day = data.journey[0].day;
    }
  }

  // stamp when this bundle was generated, for the footer "last updated" line
  data.built = new Date().toISOString();

  const banner =
    '// data.js : GENERATED FILE. Do not edit by hand.\n' +
    '// Source of truth is content.json. Regenerate with: node scripts/build-data.mjs\n' +
    `// Built ${new Date().toISOString()}\n\n`;

  const js = `${banner}window.DH_DATA = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(OUT, js, 'utf8');

  const days = data?.brand?.today_day ?? '?';
  const posts = Array.isArray(data?.posts) ? data.posts.length : 0;
  const entries = Array.isArray(data?.journey) ? data.journey.length : 0;
  console.log(`built data.js — day ${days}, ${entries} journey entries, ${posts} posts`);
}

main();
