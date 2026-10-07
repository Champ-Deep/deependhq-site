// derive-posts.mjs : build-time data for the interactive essay pages.
//
// For every post, derived from content.json on each build and never stored:
//   post.viz.window    the days the essay covers, ISO start and end
//   post.viz.days      one row per calendar day in that window: the log entry
//                      for that day if there is one (day number, arc colour,
//                      first line), so the side panel can draw the week
//   post.viz.para_days for each body block, the window dates it names
//                      ("tuesday shipped..." names the Tuesday in the window)
//   post.viz.nodes     what the week touched, for the graph: arcs from the
//                      week's entries, the companies the essay reads into, and
//                      tools from the stack that the essay names. Each node
//                      lists the body blocks it shows up in.
//   post.viz.words, post.viz.listen_min, post.viz.entries
//
// Pure: same data, same output. No em dashes.

const DOW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const toUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const addDays = (iso, n) => new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10);
const dowOf = (iso) => new Date(toUTC(iso)).getUTCDay();

export function blockText(b) {
  if (typeof b === 'string') return b;
  if (!b) return '';
  return [b.head, b.text, ...(Array.isArray(b.lines) ? b.lines : [])].filter(Boolean).join(' ');
}

// The window an essay covers. "Sep 28 - Oct 4" and "Sep 21 - 27" give an
// explicit start; "days 241-245" maps through the log's day numbers; anything
// else is the seven days ending on the essay date.
export function windowFor(post, journey) {
  const end = post.date;
  const r = String(post.day_range || '').toLowerCase().replace(/[\u2013\u2014]/g, '-');
  const days = r.match(/days?\s*(\d+)\s*-\s*(\d+)/);
  if (days) {
    const a = journey.find((e) => e.day === Number(days[1]));
    const b = journey.find((e) => e.day === Number(days[2]));
    if (a && b) return { start: a.date <= b.date ? a.date : b.date, end: a.date <= b.date ? b.date : a.date };
  }
  const md = r.match(/([a-z]{3})[a-z]*\s+(\d{1,2})\s*-/);
  if (md && end && MON.indexOf(md[1]) !== -1) {
    const y = Number(end.slice(0, 4));
    let start = `${y}-${String(MON.indexOf(md[1]) + 1).padStart(2, '0')}-${String(Number(md[2])).padStart(2, '0')}`;
    if (start > end) start = `${y - 1}${start.slice(4)}`;
    if (toUTC(end) - toUTC(start) <= 13 * 86400000) return { start, end };
  }
  return { start: addDays(end, -6), end };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (name) => new RegExp(`(^|[^A-Za-z0-9])${esc(name)}(?=$|[^A-Za-z0-9])`, name.length <= 3 ? '' : 'i');

export function derivePosts(data) {
  const journey = Array.isArray(data.journey) ? data.journey : [];
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const byDate = new Map(journey.map((e) => [e.date, e]));
  const tools = ((data.stack_now && data.stack_now.items) || [])
    .map((i) => String(i.name || '').trim())
    .filter((n) => n.length >= 4 && !/\s\+\s/.test(n));

  for (const p of posts) {
    if (!p || !p.date) continue;
    const blocks = Array.isArray(p.body) ? p.body : [];
    const texts = blocks.map(blockText);
    const win = windowFor(p, journey);

    const days = [];
    for (let d = win.start; d <= win.end; d = addDays(d, 1)) {
      const e = byDate.get(d);
      days.push({
        date: d,
        dow: DOW[dowOf(d)].slice(0, 3),
        day: e ? e.day : null,
        arc_color: e ? e.arc_color || null : null,
        arcs: e ? (e.arcs || []).slice(0, 2) : [],
        ship: e ? String(e.shipping_now || '').split(/(?<=[.!?])\s/)[0].slice(0, 140) : null,
      });
    }

    // Which day each block is about. Log entries are dated by the nightly
    // publish (01:03 IST), so the work of a weekday evening usually sits in the
    // entry dated the next morning, and weekend and after-midnight work sits
    // on its own date. So a weekday name in a block offers two candidates, that
    // date and the one after, and the entry whose text shares the most words
    // with the block wins (ties go to the named date). A block with no weekday
    // name is linked only when one entry shares at least five words with it.
    const tokens = (t) => new Set(String(t || '').toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []);
    const STOP = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'what', 'when', 'into', 'than', 'then', 'they', 'them', 'there', 'their', 'just', 'only', 'also', 'still', 'week', 'today', 'tonight', 'every', 'thing', 'things', 'been', 'which', 'would', 'could', 'about', 'after', 'before', 'again', 'other', 'same', 'nothing', 'something', 'actually']);
    const entryWords = new Map(days.map((d) => { const e = byDate.get(d.date); return [d.date, e ? tokens([e.shipping_now, e.yesterday_thread, e.raw_thought].join(' ')) : new Set()]; }));
    const overlap = (bw, date) => { const ew = entryWords.get(date); if (!ew) return 0; let n = 0; for (const w of bw) if (!STOP.has(w) && ew.has(w)) n++; return n; };
    const para_days = texts.map((t) => {
      const bw = tokens(t);
      const hit = [];
      for (let i = 0; i < 7; i++) {
        if (!new RegExp(`\\b${DOW[i]}\\b`, 'i').test(t)) continue;
        const named = days.filter((d) => dowOf(d.date) === i).map((d) => d.date);
        if (!named.length) continue;
        const base = named[named.length - 1];
        const cands = [base, addDays(base, 1)].filter((dt) => days.some((d) => d.date === dt && d.day));
        if (!cands.length) { hit.push(base); continue; }
        const best = cands.reduce((a, b) => (overlap(bw, b) > overlap(bw, a) ? b : a));
        if (!hit.includes(best)) hit.push(best);
      }
      if (!hit.length) {
        let best = null, score = 0;
        for (const d of days) { const sc = overlap(bw, d.date); if (sc > score) { score = sc; best = d.date; } }
        if (best && score >= 5) hit.push(best);
      }
      return hit;
    });

    // Graph nodes. Arcs come from the week's entries; a block "touches" an arc
    // when it names a day whose entry carries that arc, or names the arc itself.
    const nodes = [];
    const arcCount = new Map();
    for (const d of days) for (const a of d.arcs) arcCount.set(a, (arcCount.get(a) || 0) + 1);
    if (p.arc && !arcCount.has(p.arc)) arcCount.set(p.arc, 0);
    for (const [name, n] of [...arcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)) {
      const re = wordRe(name);
      const paras = texts.map((t, i) => ((para_days[i].some((dt) => (days.find((d) => d.date === dt) || {}).arcs?.includes(name)) || re.test(t)) ? i : -1)).filter((i) => i >= 0);
      nodes.push({ kind: 'arc', name, n, paras, href: `journey.html` });
    }
    const has = (name) => nodes.some((x) => x.name.toLowerCase() === name.toLowerCase());
    // A company joins the graph when the essay names it, or when the graph would
    // otherwise be too thin to read. Otherwise it repeats the arc it came from.
    for (const rc of (p.related_companies || []).slice(0, 3)) {
      if (has(rc.name)) continue;
      const re = wordRe(rc.name);
      const paras = texts.map((t, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0);
      if (paras.length || nodes.length < 3) nodes.push({ kind: 'company', name: rc.name, n: paras.length, paras, href: `company/${rc.slug}` });
    }
    const toolHits = [];
    for (const name of tools) {
      const re = wordRe(name);
      const paras = texts.map((t, i) => (re.test(t) ? i : -1)).filter((i) => i >= 0);
      if (paras.length && !has(name)) toolHits.push({ kind: 'tool', name, n: paras.length, paras, href: 'toolkit.html' });
    }
    toolHits.sort((a, b) => b.n - a.n);
    for (const t of toolHits.slice(0, Math.max(0, 8 - nodes.length))) nodes.push(t);

    const words = texts.join(' ').split(/\s+/).filter(Boolean).length;
    p.viz = {
      window: win,
      days,
      para_days,
      nodes,
      words,
      entries: days.filter((d) => d.day).length,
      // 165 words a minute is a calm narration pace; the audio file, when it
      // exists, replaces this estimate with its real length.
      listen_min: Math.max(1, Math.round(words / 165)),
    };
  }
  return data;
}
