// derive.mjs
// Build-time derivations for data.js. Everything here is computed from
// content.json on every build and never written back. The honesty rule of the
// site: any number on a page is derived here, never stored by hand.
//
// Exports one function, derive(data, now), which mutates `data` in place:
//   data.health     freshness of the log and of every dated section
//   data.recent     last 14 journey entries, compact
//   data.heatmap    last 16 weeks of the public log as a day grid
//   data.stats      counts the pages show (entries, streak, active companies)
//   data.stack_now  toolkit + shoutouts + tools, merged, with last-seen dates
//                   mined from the journey and the essays
//
// No dependencies. Node 18+. Pure: same input, same output (given `now`).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// IST calendar date (YYYY-MM-DD) for a JS Date. The log is kept in IST.
export function istDate(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

const toUTC = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDays = (iso, n) => new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10);
const isWeekend = (iso) => { const w = new Date(toUTC(iso)).getUTCDay(); return w === 0 || w === 6; };
const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);

// Weekdays strictly after `from`, up to and including `to`.
export function weekdaysAfter(from, to) {
  if (!from || !to || to <= from) return 0;
  let n = 0;
  for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (!isWeekend(d)) n++;
  return n;
}

export function derive(data, now = new Date()) {
  const today = istDate(now);
  const journey = Array.isArray(data.journey) ? data.journey : [];
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const companies = Array.isArray(data.companies) ? data.companies : [];
  const newest = journey[0] || null;

  // ---- health -------------------------------------------------------------
  const ageOf = (iso, thresholdDays) => {
    if (!iso) return { date: null, days_old: null, stale: true };
    const days_old = daysBetween(iso, today);
    return { date: iso, days_old, stale: days_old > thresholdDays };
  };
  const weekdays_stale = newest ? weekdaysAfter(newest.date, today) : 99;
  data.health = {
    built: now.toISOString(),
    built_date: today,
    newest_entry: newest ? { date: newest.date, day: newest.day } : null,
    weekdays_stale,
    stale: weekdays_stale > 2,
    sections: {
      now: ageOf(data.now && data.now.updated, 21),
      build_lanes: ageOf(data.build_lanes && data.build_lanes.updated, 21),
      shoutouts: ageOf(data.shoutouts && data.shoutouts.updated, 30),
    },
  };

  // ---- recent + heatmap ---------------------------------------------------
  const compact = (e) => ({
    day: e.day, date: e.date, mood: e.mood || '', arc_color: e.arc_color || 'green',
    arcs: Array.isArray(e.arcs) ? e.arcs.slice(0, 2) : [],
    ship: String(e.shipping_now || '').replace(/\s+/g, ' ').trim(),
  });
  data.recent = journey.slice(0, 14).map(compact);

  const byDate = new Map(journey.map((e) => [e.date, e]));
  const weeks = 16;
  // Grid ends on today's week (Mon..Sun), starts 16 weeks earlier.
  const dow = new Date(toUTC(today)).getUTCDay(); // 0 Sun .. 6 Sat
  const mondayOffset = (dow + 6) % 7;             // days since Monday
  const gridEnd = addDays(today, 6 - mondayOffset); // this week's Sunday
  const gridStart = addDays(gridEnd, -(weeks * 7 - 1));
  const cells = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    const e = byDate.get(d);
    cells.push({
      date: d,
      future: d > today,
      weekend: isWeekend(d),
      day: e ? e.day : null,
      arc_color: e ? e.arc_color : null,
      ship: e ? String(e.shipping_now || '').slice(0, 110) : null,
    });
  }
  data.heatmap = { start: gridStart, end: gridEnd, weeks, cells };

  // ---- stats ----------------------------------------------------------------
  const since30 = addDays(today, -30);
  let streak = 0;
  if (newest) {
    // consecutive weekdays with an entry, walking back from the newest entry
    for (let d = newest.date; ; d = addDays(d, -1)) {
      if (isWeekend(d)) continue;
      if (byDate.has(d)) streak++; else break;
      if (streak > 400) break;
    }
  }
  const monthKey = today.slice(0, 7);
  data.stats = {
    days_public: data.brand ? data.brand.today_day : null,
    entries: journey.length,
    entries_30d: journey.filter((e) => e.date >= since30).length,
    entries_this_month: journey.filter((e) => e.date.slice(0, 7) === monthKey).length,
    streak_weekdays: streak,
    essays: posts.length,
    companies: companies.length,
    companies_active_90d: companies.filter((c) => (c.related_journey || []).some((r) => r.date >= addDays(today, -90))).length,
    first_entry: journey.length ? journey[journey.length - 1].date : null,
    day_one: (data.brand && data.brand.day_one) || null,
    // what the log has actually been about, last 30 days, by arc label
    arcs_30d: (() => {
      const m = new Map();
      for (const e of journey) if (e.date >= since30) for (const a of e.arcs || []) m.set(a, (m.get(a) || 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([arc, n]) => ({ arc, n }));
    })(),
  };

  // ---- pillars ------------------------------------------------------------
  // Four doors instead of a wall of twelve cards. `last_ship` is derived from
  // the log, never stored: the newest journey entry whose arcs name a company
  // or a product in that pillar. A pillar with no recent log activity says so
  // rather than borrowing a date from somewhere else.
  const pillars = Array.isArray(data.pillars) ? data.pillars : [];
  if (pillars.length) {
    // Arc labels are free text in the log, not a controlled vocabulary, so a
    // pillar declares which labels count as its activity in content.json
    // (pillars[].arcs) rather than relying on an exact match against names.
    // An entry can land in two pillars when it names two.
    const labelsFor = (pl) => {
      const set = new Set(
        [...(pl.arcs || []),
         ...(pl.companies || []),
         ...(pl.products || []).map((p) => (typeof p === 'string' ? p : p.name)),
         pl.name]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase())
      );
      return set;
    };
    const companyByName = new Map(companies.map((c) => [String(c.name).toLowerCase(), c]));
    const entryPillars = new Map(); // date -> [pillar slug]
    for (const pl of pillars) {
      const labels = labelsFor(pl);
      let last = null; let day = null; let n30 = 0; const recent = [];
      for (const e of journey) {
        const hit = (e.arcs || []).some((a) => labels.has(String(a).toLowerCase()));
        if (!hit) continue;
        if (!entryPillars.has(e.date)) entryPillars.set(e.date, []);
        entryPillars.get(e.date).push(pl.slug);
        if (!last || e.date > last) { last = e.date; day = e.day; }
        if (e.date >= since30) { n30++; if (recent.length < 4) recent.push({ day: e.day, date: e.date, ship: String(e.shipping_now || '').replace(/\s+/g, ' ').trim().slice(0, 110) }); }
      }
      pl.last_ship = last;
      pl.last_ship_day = day;
      pl.days_since = last ? daysBetween(last, today) : null;
      pl.entries_30d = n30;
      pl.recent = recent;
      // Companies in this pillar that exist in companies[], so a card can link
      // straight to the company page instead of a dead anchor.
      pl.company_slugs = (pl.companies || [])
        .map((n) => companyByName.get(String(n).toLowerCase()))
        .filter(Boolean)
        .map((c) => c.slug);
      pl.counts = {
        companies: (pl.companies || []).length,
        products: (pl.products || []).length,
        labels: labelsFor(pl).size,
      };
    }
    // Every entry carries the pillars it touched, so a day card and the heatmap
    // can colour by pillar without a second pass over the content.
    for (const e of journey) {
      const slugs = entryPillars.get(e.date);
      if (slugs && slugs.length) e.pillars = slugs;
    }
    // The segment router maps people to doors, not to companies.
    const SEGMENT_DOORS = {
      founder: ['accelerator', 'champ'],
      operator: ['lakeb2b', 'champ'],
      hni: ['infratech-lagoons'],
      recruiter: ['accelerator'],
      engineer: ['champ', 'lakeb2b'],
    };
    const bySlug = new Map(pillars.map((pl) => [pl.slug, pl]));
    data.doors = {
      order: ['champ', 'infratech-lagoons', 'lakeb2b', 'accelerator'],
      segments: Object.fromEntries(
        Object.entries(SEGMENT_DOORS).map(([seg, slugs]) => [
          seg,
          slugs.map((s) => (bySlug.has(s) ? s : null)).filter(Boolean),
        ])
      ),
    };
    data.stats.pillars = pillars.length;
  }

  // ---- stack_now ------------------------------------------------------------
  // One list. Each item: name, what, url, kind, category, last_seen, mentions_90d.
  //   kind: built    a thing Deep made (toolkit tool/repo with a repo URL)
  //         using    shoutout tag "using", or a toolkit tool without a repo
  //         trying   shoutout tag "trying"
  //         watching shoutout tag "watching"
  //         skill    toolkit category skill or resource
  const items = [];
  const seen = new Set();
  const push = (it) => {
    const key = it.name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    items.push(it);
  };
  for (const t of Array.isArray(data.toolkit) ? data.toolkit : []) {
    const isRepo = /github\.com\//.test(t.url || '');
    const kind = t.category === 'skill' || t.category === 'resource' ? 'skill' : (isRepo ? 'built' : 'using');
    push({ name: t.title, what: t.description || '', url: t.url && t.url !== '#' ? t.url : null, kind, category: t.category || 'tool', featured: !!t.featured });
  }
  for (const s of (data.shoutouts && Array.isArray(data.shoutouts.items)) ? data.shoutouts.items : []) {
    push({ name: s.name, what: s.what || '', url: s.url || null, kind: s.tag || 'using', category: 'external', repo: s.repo || null });
  }
  for (const t of Array.isArray(data.tools) ? data.tools : []) {
    push({ name: t.name, what: t.what || '', url: null, kind: 'using', category: (t.kind || 'stack').toLowerCase() });
  }

  // Mine the log and the essays for mentions. Word-boundary match; short
  // names (3 chars or fewer) must match case exactly to avoid "Jan" the app
  // matching "Jan" the month.
  const corpus = [];
  // Optional per-entry `tools: []` (schema extension, filled by the nightly
  // authoring) counts as an explicit mention and is the preferred signal.
  for (const e of journey) corpus.push({ date: e.date, text: [e.shipping_now, e.yesterday_thread, e.raw_thought, ...(e.arcs || []), ...(Array.isArray(e.tools) ? e.tools : [])].join(' \n ') });
  for (const p of posts) {
    const body = Array.isArray(p.body) ? p.body.map((b) => (typeof b === 'string' ? b : (b && b.text) || '')).join(' ') : '';
    corpus.push({ date: p.date, text: [p.title, p.deck, p.eyebrow, body, ...(p.tags || [])].join(' \n ') });
  }
  const since90 = addDays(today, -90);
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const MONTH_WORDS = new Set(MONTHS.map((m) => m.toLowerCase()));
  for (const it of items) {
    const name = String(it.name || '').trim();
    const variants = new Set([name]);
    // "Claude + Cowork" -> also "Claude", "Cowork"; "Obsidian + Celsus" -> both.
    for (const part of name.split(/\s*[+/·]\s*/)) if (part.length >= 4) variants.add(part.trim());
    let last = null; let n90 = 0;
    for (const v of variants) {
      if (!v || MONTH_WORDS.has(v.toLowerCase())) continue;
      const flags = v.length <= 3 ? '' : 'i';
      const re = new RegExp(`(^|[^A-Za-z0-9])${escapeRe(v)}(?=$|[^A-Za-z0-9])`, flags);
      for (const c of corpus) {
        if (!re.test(c.text)) continue;
        if (!last || c.date > last) last = c.date;
        if (c.date >= since90) n90++;
      }
    }
    it.last_seen = last;
    it.mentions_90d = n90;
    it.days_since = last ? daysBetween(last, today) : null;
  }
  const rank = { built: 0, using: 1, trying: 2, watching: 3, skill: 4 };
  items.sort((a, b) => {
    const la = a.last_seen || '0000', lb = b.last_seen || '0000';
    if (la !== lb) return lb.localeCompare(la);
    return (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9);
  });
  data.stack_now = {
    items,
    counts: items.reduce((acc, it) => { acc[it.kind] = (acc[it.kind] || 0) + 1; return acc; }, {}),
    active_30d: items.filter((it) => it.days_since != null && it.days_since <= 30).length,
    mined_from: { entries: journey.length, essays: posts.length },
  };

  // ---- retire fake liveness ------------------------------------------------
  // These were hand-typed once and never true again. A fake clock on a live
  // site is worse than no clock. Location and state survive (state is derived).
  if (data.status && typeof data.status === 'object') {
    const keep = { location: data.status.location };
    if (newest) keep.last_ship = `day ${newest.day} · ${MONTHS[Number(newest.date.slice(5, 7)) - 1]} ${Number(newest.date.slice(8, 10))}`;
    keep.state = data.health.stale ? 'quiet' : 'shipping';
    data.status = keep;
  }
  return data;
}
