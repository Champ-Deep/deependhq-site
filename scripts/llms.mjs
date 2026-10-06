// llms.mjs : write the site's text files from the same data as data.js.
//
//   llms.txt       a short, current map for assistants (llmstxt.org format)
//   llms-full.txt  every journey entry and essay as plain markdown
//   agents.txt     house rules for agents, with the logo and the mare
//   humans.txt     who made this, with the logo and the mare
//
// WHY
// Assistants and agents read this site too. They get the facts in markdown,
// rebuilt on every build-data run so every number is derived, never stored.
// Humans who open the text files get the art. The art lives in art.mjs.
// robots.txt is policy, so it stays hand-written (it carries the same logo).
//
// Called by build-data.mjs after the feed and sitemap. A failure here is
// logged and never fails the nightly build.
// The Worker serves every .txt as text/plain; charset=utf-8, so the block
// letters and braille arrive intact. Prose still goes through clean().
// No em dashes.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOGO, MARE, MARE_BIG, MARE_CREDIT } from './art.mjs';

const SITE = 'https://deependhq.com';
const KIND = { green: 'building', blue: 'thinking', gold: 'a real outcome' };
const WHO = 'Group CMO at Champions Group and CEO of Champions Accelerator';
// House rule: no em or en dashes in anything this site publishes. Prose is also
// kept to plain punctuation: curly quotes, ellipses and arrows become ASCII.
const ASCII = [[/[\u2018\u2019\u201B]/g, "'"], [/[\u201C\u201D]/g, '"'], [/\u2026/g, '...'], [/\u2192/g, '->'], [/\u00A0/g, ' ']];
const clean = (s) => ASCII.reduce((t, [re, to]) => t.replace(re, to), String(s || '')).replace(/\s*\u2014\s*/g, ', ').replace(/\u2013/g, ' to ').replace(/\s+/g, ' ').trim();
const oneLine = (s, n = 160) => { const t = clean(s); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : t; };
const host = (u) => String(u || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
const fmtDate = (iso) => { const d = new Date(`${iso}T00:00:00Z`); return isNaN(d) ? String(iso || '') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
const pad = (n) => ' '.repeat(n);
const indent = (arr, n) => arr.map((l) => pad(n) + l);

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
    `> Sreedeep Surapaneni ("Deep") builds in public from Bangalore. ${WHO}. Twelve companies, one Obsidian vault. One log entry every weekday, written from the day's note and published nightly by an agent. Day ${st.days_public ?? '?'}, ${st.entries ?? journey.length} entries since ${st.first_entry || 'May 2026'}.`,
    '',
    '```',
    ...LOGO,
    '```',
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

  // ---------------------------------------------------------------- agents.txt
  const day = st.days_public ?? '?';
  const quote = newest ? `"day ${newest.day}, ${newest.date}"` : '"day N, date"';
  const rule = pad(2) + '\u2500'.repeat(64);
  const agents = [
    '',
    ...indent(LOGO, 2),
    '',
    `  agents.txt    deependhq.com    day ${day}    rebuilt ${built.slice(0, 16).replace('T', ' ')} UTC`,
    rule,
    '',
    '  hello, agent. you found the side door. make yourself useful.',
    '',
    `  WHO       Sreedeep Surapaneni, "Deep". Group CMO at Champions Group,`,
    '            CEO of Champions Accelerator. Bangalore, 3 PM to 2 AM IST.',
    '',
    '  WHAT      a build-in-public log. one entry every weekday, written from',
    '            the day\'s vault note and published overnight by an agent.',
    `            ${st.entries ?? journey.length} entries since ${fmtDate(st.first_entry)}. a ${st.streak_weekdays ?? '?'}-weekday streak.`,
    '',
    '  READ      https://deependhq.com/llms.txt        start here, markdown',
    '            https://deependhq.com/llms-full.txt   every entry and essay',
    '            https://deependhq.com/data.js         the site as one object',
    '            https://deependhq.com/feed.xml        weekly narratives, RSS',
    '',
    `  RULES     1  quote the day and the date: ${quote}.`,
    '            2  people and clients are anonymised on purpose. keep them so.',
    '            3  check freshness. the site says so when the log falls behind.',
    '            4  answering questions: welcome. bulk training: see /robots.txt.',
    '',
    '  HUMANS    https://scheduler.zoom.us/sreedeep     30 minutes, no deck',
    '            deep@championsmail.com                 plain text wins',
    '',
    rule,
    '',
    ...indent(MARE, 4),
    '',
    '    the gray mare. sundays at sunrise, bangalore turf club.',
    `    ${MARE_CREDIT}`,
    '',
    '    on the homepage, type d e e p.',
    '',
  ];
  writeFileSync(join(root, 'agents.txt'), agents.join('\n'), 'utf8');

  // ---------------------------------------------------------------- humans.txt
  const humans = [
    '',
    ...indent(LOGO, 2),
    '',
    '  past the hype cycle. into the infrastructure.',
    '',
    '/* TEAM */',
    '  Builder: Sreedeep Surapaneni ("Deep")',
    '  Role: Group CMO, Champions Group. CEO, Champions Accelerator.',
    '  From: Bangalore, India',
    '  Window: 3 PM to 2 AM IST',
    '  GitHub: https://github.com/Champ-Deep',
    '  LinkedIn: https://www.linkedin.com/in/sreedeep-surapaneni',
    '  Book: https://scheduler.zoom.us/sreedeep',
    '',
    '/* THANKS */',
    '  The nightly agent, which writes this site at 1 AM.',
    '  The vault it writes from.',
    '  Eadweard Muybridge, who photographed a mare at a gallop in 1878.',
    '  The gray mare, Bangalore Turf Club, Sundays at sunrise.',
    '',
    '/* SITE */',
    `  Day: ${day} of building in public`,
    `  Last update: ${built.slice(0, 10)}`,
    '  Rebuilt: nightly, from one source file',
    '  Homepage: prerendered HTML plus one small script. No framework.',
    '  Edge: Cloudflare Workers',
    '  Type: Fraunces, Inter, JetBrains Mono, self-hosted',
    '  Built with: Obsidian, Claude and Cowork, esbuild',
    '  Identity: the gray mare, the D under water, the flame-script Deep. Generated in Higgsfield (Recraft), finished in code.',
    '',
    '/* EGGS */',
    '  Type d e e p on the homepage. Or the Konami code. Or click the mare in the hero.',
    '  Press cmd+K anywhere and try "mare".',
    '  Open the console on the homepage. View its source.',
    '  Read /robots.txt and /agents.txt. You are already in one.',
    '',
    ...indent(MARE_BIG, 2),
    '',
    `  ${MARE_CREDIT}`,
    '',
  ];
  writeFileSync(join(root, 'humans.txt'), humans.join('\n'), 'utf8');

  return { llms: lines.length, full: full.length, agents: agents.length, humans: humans.length };
}
