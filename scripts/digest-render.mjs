// digest-render.mjs : turn query results into the weekly report.
//
// WHY THIS IS A SEPARATE MODULE
// The renderer's whole job is to be honest about thin data: say inconclusive when
// the sample is small, name the control group, report a losing arm rather than
// burying it. Testing that requires feeding it fixtures, and a function that
// calls process.exit cannot be fed a fixture. So collection lives in digest.mjs
// and honesty lives here, where it can be asserted.
//
// render(data, {days, minN, minLift, today}) -> string. Pure. No IO, no clock,
// no exit. The selftest calls it six times and asserts on the words.

const sum = (rows, c) => (rows || []).reduce((a, r) => a + Number(r[c] || 0), 0);
const n = (v) => (v == null ? 0 : Number(v));

function pct(a, b) {
  if (!b) return a > 0 ? Infinity : 0;
  return (a - b) / b;
}
function fmtPct(x) {
  if (!isFinite(x)) return 'new';
  return (x > 0 ? '+' : '') + Math.round(x * 100) + '%';
}

export function render(data, opts = {}) {
  const MIN_N = opts.minN || 30;
  const MIN_LIFT = opts.minLift || 0.15;
  const days = opts.days || 7;
  const day = (opts.today || new Date().toISOString().slice(0, 10));

  const { totals = [], prevTotals = [], segRows = [], bandRows = [],
          pageRows = [], ctaRows = [], askRows = [] } = data || {};

  const out = [];
  const line = (s = '') => out.push(s);

// ------------------------------------------------------------------ report

const views = sum(totals, 'views');
const prevViews = sum(prevTotals, 'views');
const visitors = sum(totals, 'visitors');
const ctas = sum(segRows, 'ctas');

line(`# deependhq.com, last ${days} days`);
line();
line(`Written ${day} by scripts/digest.mjs. Every figure below carries the sample it`);
line(`rests on. Anything under n=${MIN_N} is labelled inconclusive, because a`);
line(`difference built on a handful of visitors is not a finding.`);
line();

line('## What changed');
line();
line('| | this week | last week | change |');
line('|---|---|---|---|');
line(`| page loads | ${views} | ${prevViews} | ${fmtPct(pct(views, prevViews))} |`);
line(`| distinct visitors | ${visitors} | - | ${visitors >= MIN_N ? 'enough for a read' : `inconclusive, under n=${MIN_N}`} |`);
line(`| cta clicks | ${ctas} | - | - |`);
line();

if (views === 0) {
  line('### Nothing recorded');
  line();
  line('There is no data for this window. That means one of:');
  line();
  line('1. The dataset did not exist when the traffic arrived. Create it, then the');
  line('   next window fills. Traffic before creation is gone and cannot be recovered.');
  line('2. /api/collect is not being reached. Check the ANALYTICS binding is in');
  line('   wrangler.jsonc and that the Worker deploys.');
  line();
  line('Nothing further can be said honestly until one of those is resolved.');
  line();
  return out.join('\n');
}

// ---------------------------------------------------------------- segments
line('## Who came');
line();
line('`explorer` is the control group. It is the number that decides whether any');
line('of the personalization is doing anything at all.');
line();
line('| segment | views | visitors | cta clicks | verdict |');
line('|---|---|---|---|---|');

const bySeg = Object.fromEntries(segRows.map((r) => [r.segment || 'unclassified', r]));
const control = bySeg['explorer'];
const treated = segRows.filter((r) => r.segment === 'operator' || r.segment === 'narrative');

if (!control) {
  line('| _no explorer rows_ | | | |');
  line();
  line('**The control group is missing.** Every visitor is being treated, so there is');
  line('nothing to compare against and no way to tell if the personalization works.');
  line('This is the single most important thing in this report: the treated arms');
  line('cannot be evaluated without it.');
} else {
  for (const r of segRows) {
    const seg = r.segment || 'unclassified';
    const v = n(r.visitors);
    if (seg === 'explorer') {
      line(`| \`${seg}\` (control) | ${r.views} | ${v} | ${r.ctas || 0} | baseline |`);
    } else {
      const ctaRate = v ? n(r.ctas) / v : 0;
      const ctrlRate = n(control.visitors) ? n(control.ctas) / n(control.visitors) : 0;
      const lift = ctaRate - ctrlRate;
      const verdict = v < MIN_N
        ? `inconclusive, n=${v}`
        : lift > 0 ? `+${Math.round(lift * 100)}pp over control`
        : `${Math.round(lift * 100)}pp vs control`;
      line(`| \`${seg}\` | ${r.views} | ${v} | ${r.ctas || 0} | ${verdict} |`);
    }
  }

  // The falsification check, stated plainly.
  line();
  const anySupported = treated.filter((r) => n(r.visitors) >= MIN_N);
  if (!anySupported.length) {
    line(`No treated segment has ${MIN_N} visitors yet. **No personalization change is`);
    line(`warranted, and none has been made.** The copy engine is running control`);
    line(`for everything, which is the correct state at this sample size.`);
  } else {
    const winners = [];
    const losers = [];
    for (const r of anySupported) {
      const seg = r.segment;
      const segRate = n(r.visitors) ? n(r.ctas) / n(r.visitors) : 0;
      const ctrlRate = n(control.visitors) ? n(control.ctas) / n(control.visitors) : 0;
      const lift = (segRate - ctrlRate) / (ctrlRate || 1);
      if (lift >= MIN_LIFT) winners.push({ seg, lift, n: n(r.visitors) });
      else if (lift <= -MIN_LIFT) losers.push({ seg, lift, n: n(r.visitors) });
    }
    if (winners.length) {
      line(`**Beating control:** ${winners.map((w) => `\`${w.segment}\` +${Math.round(w.lift * 100)}% (n=${w.n})`).join(', ')}.`);
    } else {
      line('**No segment is beating control.** The personalization is not earning its');
      line('keep on the current evidence. That is a real result, not a failure to be');
      line('explained away.');
    }
    if (losers.length) {
      line();
      line(`**Losing to control:** ${losers.map((w) => `\`${w.segment}\` ${Math.round(w.lift * 100)}% (n=${w.n})`).join(', ')}.`);
      line('Recommended action: serve these the control. Underperforming treatment is');
      line('worse than no treatment, because it also costs the visitor a worse first');
      line('impression.');
    }
  }
}
line();

// ---------------------------------------------------------------- intent
line('## Booking intent');
line();
line('| band | visits | mean score |');
line('|---|---|---|');
for (const r of bandRows) {
  const v = n(r.visits);
  line(`| \`${r.band || 'unscored'}\` | ${v} | ${v ? (n(r.intent) / v).toFixed(1) : '-'} |`);
}
const hot = n((bandRows.find((r) => r.band === 'hot') || {}).visits);
if (hot < MIN_N) {
  line();
  line(`${hot} hot visitors this week, under n=${MIN_N}. The band thresholds are a`);
  line('hypothesis; they stay as they are until the data says otherwise. Moving a');
  line('threshold to fit a handful of visitors is how you end up optimizing noise.');
}
line();

if (ctas.length) {
  line('## What they clicked');
  line();
  line('| cta | clicks | distinct visitors |');
  line('|---|---|---|');
  for (const r of ctaRows) {
    line(`| ${r.label} | ${r.clicks} | ${r.visitors} |`);
  }
  line();
}

if (pageRows.length) {
  line('## Pages');
  line();
  line('| page | views | visitors | avg scroll | avg dwell |');
  line('|---|---|---|---|---|');
  for (const r of pageRows) {
    line(`| \`${r.page}\` | ${r.views} | ${r.visitors} | ${Math.round(n(r.avg_scroll))}% | ${Math.round(n(r.avg_dwell))}s |`);
  }
  line();

  // The navigation question Deep actually asked: what do people read next.
  line('### Where people go next');
  line();
  const depth = n((pageRows[0] || {}).avg_scroll);
  if (n(pageRows[0].visitors) < MIN_N) {
    line(`Top page has ${pageRows[0].visitors} visitors, under n=${MIN_N}. No read on`);
    line('navigation yet.');
  } else {
    line(`The most-read page holds attention to ${depth}%. Pages sitting well below`);
    line('that are where attention is being lost, and the place to look next is');
    line('always the step between them, not the page itself.');
  }
  line();
}

// ---------------------------------------------------------------- asks
line('## What they told us');
line();
if (!askRows.length) {
  line('No answers yet. The ask only reaches cold readers past 60% scroll on a post,');
  line('once per browser, so a small number is the expected shape.');
} else {
  line('| answer | question | n |');
  line('|---|---|---|');
  for (const r of askRows) line(`| ${r.answer} | ${r.question} | ${r.n} |`);
  line();
  const no = askRows.filter((r) => r.answer === 'no').reduce((a, r) => a + n(r.n), 0);
  const skip = askRows.filter((r) => r.answer === 'skip').reduce((a, r) => a + n(r.n), 0);
  const yes = askRows.filter((r) => r.answer === 'yes').reduce((a, r) => a + n(r.n), 0);
  const total = yes + no + skip;
  line(`${yes} yes, ${no} no, ${skip} dismissed out of ${total}. A high dismiss rate is`);
  line('the ask being too aggressive, and is treated as a signal to loosen it.');
}
line();

// ---------------------------------------------------------------- the ask
line('## Recommendation');
line();
line('One thing, not five. A weekly report with five recommendations is a report');
line('nobody acts on.');
line();

// Write the digest.

  return out.join('\n');
}

export const MIN_N = 30;
export const MIN_LIFT = 0.15;
