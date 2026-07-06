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

  // ---------------------------------------------------------------------------
  // CONTENT RELATIONSHIP ENGINE
  // Compute derived cross-links AFTER the journey sort. These live in data.js
  // ONLY. They are never written back into content.json. Deterministic and
  // null-safe: a missing arc_map, empty journey, or absent posts all no-op.
  // ---------------------------------------------------------------------------
  const companies = Array.isArray(data.companies) ? data.companies : [];
  const journey = Array.isArray(data.journey) ? data.journey : [];
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const arcMap = (data.arc_map && typeof data.arc_map === 'object') ? data.arc_map : {};

  const kebab = (s) => String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\./g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const byName = new Map(companies.map((c) => [c.name, c]));
  const slugByName = new Map();
  for (const c of companies) {
    c.slug = kebab(c.name);
    slugByName.set(c.name, c.slug);
  }

  // Resolve an arc/tag label to a canonical company name (or null).
  // Order: explicit arc_map entry (may be null) -> exact company-name match -> null.
  const resolveArc = (label) => {
    if (label == null) return null;
    if (Object.prototype.hasOwnProperty.call(arcMap, label)) return arcMap[label];
    if (byName.has(label)) return label;
    return null;
  };

  const truncate = (s, n) => {
    const str = String(s || '');
    if (str.length <= n) return str;
    return str.slice(0, n).replace(/\s+\S*$/, '') + '…';
  };

  // Seed containers on each company.
  for (const c of companies) {
    c.related_journey = [];
    c.related_writing = [];
  }

  // journey -> company. Journey is already newest-first from the sort above.
  for (const e of journey) {
    const arcs = Array.isArray(e.arcs) ? e.arcs : [];
    const links = [];
    const hitCompanies = new Set();
    for (const arc of arcs) {
      const name = resolveArc(arc);
      const slug = name ? (slugByName.get(name) || null) : null;
      links.push({ arc, company_name: name || null, slug });
      if (name && slugByName.has(name)) hitCompanies.add(name);
    }
    e.company_links = links;
    for (const name of hitCompanies) {
      const c = byName.get(name);
      if (c && c.related_journey.length < 12) {
        c.related_journey.push({
          day: e.day,
          date: e.date,
          shipping_now: truncate(e.shipping_now, 130),
          arc_color: e.arc_color,
        });
      }
    }
  }

  // posts -> companies (from post.arc + post.tags), and back-link on companies.
  for (const p of posts) {
    const labels = [p.arc, ...(Array.isArray(p.tags) ? p.tags : [])];
    const seen = new Set();
    const rel = [];
    for (const label of labels) {
      const name = resolveArc(label);
      if (!name || !slugByName.has(name) || seen.has(name)) continue;
      seen.add(name);
      const c = byName.get(name);
      rel.push({ name, slug: c.slug, tag: c.tag });
      c.related_writing.push({ slug: p.slug, title: p.title, date: p.date, read: p.read });
    }
    p.related_companies = rel;
  }
  // Keep each company's related_writing newest-first.
  for (const c of companies) {
    c.related_writing.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }

  const withJourney = companies.filter((c) => c.related_journey.length > 0).length;
  const linkedPosts = posts.filter((p) => (p.related_companies || []).length > 0).length;
  console.log(`cross-links: ${withJourney}/${companies.length} companies have journey, ${linkedPosts} posts linked`);

  // stamp when this bundle was generated, for the footer "last updated" line
  data.built = new Date().toISOString();

  const banner =
    '// data.js : GENERATED FILE. Do not edit by hand.\n' +
    '// Source of truth is content.json. Regenerate with: node scripts/build-data.mjs\n' +
    `// Built ${new Date().toISOString()}\n\n`;

  const js = `${banner}window.DH_DATA = ${JSON.stringify(data, null, 2)};\n`;
  writeFileSync(OUT, js, 'utf8');

  const days = data?.brand?.today_day ?? '?';
  const postCount = Array.isArray(data?.posts) ? data.posts.length : 0;
  const entryCount = Array.isArray(data?.journey) ? data.journey.length : 0;
  console.log(`built data.js — day ${days}, ${entryCount} journey entries, ${postCount} posts`);
}

main();
