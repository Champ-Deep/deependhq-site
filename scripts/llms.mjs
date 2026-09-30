// llms.mjs : write llms.txt and llms-full.txt from the same data as data.js.
//
// WHY
// Assistants and agents read this site too. llms.txt (llmstxt.org) gives them
// a short, current map in markdown: who this is, what is here, the latest
// entries, and where the raw data lives. llms-full.txt is every journey entry
// and essay as plain markdown, so an assistant can answer from the source
// instead of scraping rendered pages. Both are rebuilt on every build-data
// run, so every number is derived, never stored.
//
// Called by build-data.mjs after the feed and sitemap. A failure here is
// logged and never fails the nightly build.
// No em dashes.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://deependhq.com';
const KIND = { green: 'building', blue: 'thinking', gold: 'a real outcome' };
// House rule: no em or en dashes in anything this site publishes.
const clean = (s) => String(s || '').replace(/\s*—\s*/g, ', ').replace(/–/g, ' to ').replace(/\s+/g, ' ').trim();
const oneLine = (s, n = 160) => { const t = clean(s); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : t; };
const host = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

export function writeLlms(root, data) {
  const st = data.stats || {};
  const journey = Array.isArray(data.journey) ? data.journey : [];
  const posts = (Array.isArray(data.posts) ? data.posts : []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const items = (data.stack_now && Array.isArray(data.stack_now.items)) ? data.stack_now.items : [];
  const newest = journey[0];
  const built = data.built || new Date().toISOString();

  const builtHere = items.filter((i) => i.kind === 'built').sort((a, b) => {
    const r = (i) => (i.site ? 0 : i.status ? 1 : 2);
    return r(a) - r(b) || String(b.last_seen || '').localeCompare(String(a.last_seen || ''));
  }).slice(0, 12);

  const lines = [
    '# deep >_ (deependhq.com)',
    '',
    `> Sreedeep Surapaneni ("Deep") builds in public from Bangalore. Group CMO at Champions Group, twelve companies run from one Obsidian vault. One log entry every weekday, written from the day's note and published nightly by an agent. Day ${st.days_public ?? '?'}, ${st.entries ?? journey.length} entries since ${st.first_entry || 'May 2026'}.`,
    '',
    `Rebuilt ${built.slice(0, 16).replace('T', ' ')} UTC. Every number on the site is derived from one source file at build time. Team members are never named and clients in active deals are described by role, on purpose.`,
    '',
    '## Read',
    `- [Home](${SITE}/): the working window, 3 PM to 2 AM IST, and how a day becomes an entry`,
    `- [Mission Log](${SITE}/journey.html): every weekday entry, newest first, with arcs and dates`,
    `- [Writing](${SITE}/writing.html): the weekly narratives, one essay a week written from the log`,
    `- [Pillars](${SITE}/pillars.html): the four pillars of Champions Group and the companies in each`,
    `- [Stack](${SITE}/toolkit.html): tools built, used, tried and watched, dated by their last mention in the log`,
    `- [Now](${SITE}/now.html): what has attention right now`,
    '',
    '## Latest entries',
    ...journey.slice(0, 7).map((e) => `- [Day ${e.day}, ${e.date}](${SITE}/journey.html#day-${e.day}): ${oneLine(e.shipping_now)}`),
    '',
    '## Essays',
    ...posts.slice(0, 6).map((p) => `- [${clean(p.title)}](${SITE}/post.html?slug=${encodeURIComponent(p.slug)}): ${p.date}${p.read ? `, ${p.read}` : ''}`),
    '',
    '## Built here',
    ...builtHere.map((i) => {
      const link = i.site || i.url;
      const tag = i.site ? ` (live at ${host(i.site)})` : i.status === 'internal' ? ' (internal, runs in-house)' : '';
      return link ? `- [${i.name}](${link}): ${oneLine(i.what, 120)}${tag}` : `- ${i.name}: ${oneLine(i.what, 120)}${tag}`;
    }),
    '',
    '## Machine-readable',
    `- [llms-full.txt](${SITE}/llms-full.txt): every journey entry and essay as plain markdown`,
    `- [data.js](${SITE}/data.js): the whole site as one object, window.DH_DATA, rebuilt nightly around 01:00 IST`,
    `- [feed.xml](${SITE}/feed.xml): RSS for the weekly narratives`,
    `- [sitemap.xml](${SITE}/sitemap.xml)`,
    `- [agents.txt](${SITE}/agents.txt): house rules for assistants and agents`,
    '',
    '## Contact',
    '- Book 30 minutes: https://scheduler.zoom.us/sreedeep',
    '- Email: deep@championsmail.com',
    '- GitHub: https://github.com/Champ-Deep',
    '',
    '## Optional',
    `- [humans.txt](${SITE}/humans.txt): who made this, and a gray mare`,
    `- Freshness: if the newest entry is more than two weekdays old, the site says so at the top. Newest entry right now: day ${newest ? newest.day : '?'}, ${newest ? newest.date : '?'}.`,
    '',
  ];
  writeFileSync(join(root, 'llms.txt'), lines.join('\n'), 'utf8');

  const full = [
    '# deep >_ (deependhq.com): full text',
    '',
    `> Every public journey entry (${journey.length}) and every weekly essay (${posts.length}), newest first. Rebuilt ${built.slice(0, 10)}. Cite the day number and date when quoting, for example "day ${newest ? newest.day : 1}, ${newest ? newest.date : ''}".`,
    '',
    '## Journey',
    '',
  ];
  for (const e of journey) {
    full.push(`### Day ${e.day}, ${e.date}${KIND[e.arc_color] ? ` (${KIND[e.arc_color]})` : ''}`, '');
    full.push(clean(e.shipping_now), '');
    if (e.yesterday_thread) full.push(`Thread: ${clean(e.yesterday_thread)}`, '');
    if (e.raw_thought) full.push(`Raw thought: ${clean(e.raw_thought)}`, '');
    if (Array.isArray(e.arcs) && e.arcs.length) full.push(`Arcs: ${e.arcs.map(clean).join(', ')}`, '');
    full.push(`Link: ${SITE}/journey.html#day-${e.day}`, '');
  }
  full.push('## Essays', '');
  for (const p of posts) {
    full.push(`### ${clean(p.title)}`, '', `${p.date}${p.read ? `, ${p.read}` : ''}${p.arc ? `, ${clean(p.arc)}` : ''}. ${SITE}/post.html?slug=${encodeURIComponent(p.slug)}`, '');
    if (p.deck) full.push(clean(p.deck), '');
    const body = Array.isArray(p.body) ? p.body : [];
    for (const b of body) {
      const t = typeof b === 'string' ? b : (b && b.text) || '';
      if (t) full.push(clean(t), '');
    }
  }
  writeFileSync(join(root, 'llms-full.txt'), full.join('\n'), 'utf8');
  return { llms: lines.length, full: full.length };
}
