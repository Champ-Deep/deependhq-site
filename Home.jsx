// Home.jsx : the homepage, "The Window". Oct 2026.
// Design note: Efforts/Active/DeependHQ Site/DeepEndHQ Homepage Redesign 2026-10-01.md
//
// HOW THIS PAGE RUNS
// These components run at BUILD time only. scripts/prerender.mjs renders them
// to static HTML inside #root, and index.html ships that HTML plus home.js, a
// small vanilla island. The homepage does not load React or Babel in the
// browser, so nothing re-renders over the markup and restarts the motion.
// Scroll-linked motion is CSS (animation-timeline) in home.css. home.js does
// ages, the COMPILE behaviour, the pinned day, the heatmap readout, the glyph
// field and the lazy cmd+K palette.
//
// Every number is derived from data.js at build time. Every date also carries
// its ISO value so home.js can recompute its age in the visitor's browser.
// No em dashes.

(() => {
const { fmtDate, ageOf } = window.Sys;
const DH = window.DH_DATA;
const BOOK = 'https://scheduler.zoom.us/sreedeep';
const EXT = { target: '_blank', rel: 'noopener noreferrer' };
const KIND = { green: 'building', blue: 'thinking', gold: 'a real outcome' };
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dow = (iso) => { const [y, m, d] = iso.split('-').map(Number); return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };

// Age chip. Rendered at build time, recomputed live by home.js from dateTime
// and data-age, which is 'log' (weekday aware) or a day limit.
// 'plain' shows the age without a fresh/warn/stale colour: old history is not stale.
const WxAge = ({ date, mode }) => {
  const a = ageOf(date, mode === 'plain' ? 99999 : mode);
  if (mode === 'plain') return <time className="wx-age-plain" dateTime={date} data-age="plain">{a.label}</time>;
  return <time className="age" dateTime={date} data-age={String(mode)} data-state={a.state}>{a.label}</time>;
};

const istClock = (iso) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)).replace(',', '');
  } catch (e) { return ''; }
};

// ---------------------------------------------------------------- 15:00 hero
// The hero is an editorial grid: the headline is set in three giant rows with
// the words spaced across twelve columns, hairline guides at each row's x-height
// and baseline, and small notes in the margins. The visual is the gray mare at a
// gallop, drawn in braille from Muybridge's 1878 frames, with speed streaks
// trailing off her back like a scanline smear. prerender.mjs puts the still frame
// on window.DH_MARE_HERO from mare-hero.json; home.js gallops her on load and on
// hover from the same file. Word order in the DOM reads as one sentence.
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const Hero = () => {
  const e = DH.journey[0];
  const st = DH.stats || {};
  const nCo = (DH.companies || []).length;
  const MH = window.DH_MARE_HERO;
  const still = MH && MH.stillFrame ? MH.stillFrame.join('\n') : '';
  let i = 0;
  const W = (t, k) => <span className={`wx-hw wx-hw-${k}`} style={{ '--i': i++ }}>{t}</span>;
  return (
    <section className="wx-hero mode-editorial" id="top" aria-labelledby="wx-hero-h">
      <div className="wx-hx">
        <p className="wx-eyebrow-ed wx-hx-eye">Sreedeep Surapaneni · Bangalore</p>
        <span className="wx-hx-gl wx-hx-gl1" aria-hidden="true" />
        <span className="wx-hx-gl wx-hx-gl2" aria-hidden="true" />
        <span className="wx-hx-gl wx-hx-gl3" aria-hidden="true" />
        <h1 className="wx-hx-h" id="wx-hero-h">
          {W('i’m', 'im')} {W('Deep', 'deep')}<span className="wx-hbr" aria-hidden="true" />{' '}
          {W('and', 'and')} {W('i', 'i')} {W('ship', 'ship')}<span className="wx-hbr" aria-hidden="true" />{' '}
          {W('every', 'every')}<span className="wx-hbr wx-hbr-sm" aria-hidden="true" />{' '}
          <span className="wx-hw wx-hw-wk" style={{ '--i': i++ }}><em>weekday</em><span className="wx-cursor" aria-hidden="true" /></span>
        </h1>
        <p className="wx-hx-note wx-hx-n1">group cmo,<br />champions group</p>
        <p className="wx-hx-note wx-hx-n2" data-dh-frozen>day {st.days_public}<br />of building in public</p>
        <p className="wx-hx-note wx-hx-n3">ceo,<br />champions accelerator</p>
        <p className="wx-hx-note wx-hx-n4" data-dh-frozen>{NUM[nCo] || nCo} companies,<br />one vault</p>
        <div className="wx-hx-mare" aria-hidden="true" style={{ '--cols': MH ? MH.cols : 102 }}><pre>{still}</pre></div>
        <div className="wx-hx-foot">
          {/* data-dh-hero: the ONLY prose in the hero the copy engine may rewrite.
            It carries no build-time number and no claim that could be falsified.
            The h1 above and every note beside it are deliberately left untagged,
            and the numbered notes are additionally frozen, because "day 335" and
            "twelve companies" are facts derived at build time and an engine must
            never be able to edit a fact. */}
        <p className="wx-hx-lede" data-dh-hero="hero_subline">Past the hype cycle, into the infrastructure. Every entry starts as a note in the vault and goes live by 2 AM IST.</p>
          <article className="wx-live wx-hx-live mode-operator" aria-label="Latest entry from the log" data-newest={e.date} data-day={e.day}>
            <p className="wx-live-k">live from the log · <WxAge date={e.date} mode="log" /></p>
            <p className="wx-hx-live-t"><b>day {e.day}</b> <span>{fmtDate(e.date, true)}</span></p>
            <p className="wx-live-txt" data-compile="">{e.shipping_now}</p>
            <a className="wx-tlink" href={`journey.html#day-${e.day}`}>read day {e.day} in full →</a>
          </article>
        </div>
        <div className="wx-hx-cta">
          {/* data-dh-cta: the second and last element the copy engine may rewrite.
              Only the LABEL varies; the href is untouched, so the destination can
              never be changed by personalization. */}
          <a className="wx-hx-paren wx-hx-book" data-dh-cta="cta_label" href={BOOK} {...EXT}>book 30 minutes</a>
          <a className="wx-hx-paren" href="#log">what shipped today ↓</a>
        </div>
      </div>
      <div className="wx-hero-rule" aria-hidden="true" />
    </section>
  );
};

// ---------------------------------------------------------------- 15:40 proof
const Proof = () => {
  const st = DH.stats || {};
  const figs = [
    { k: 'days in public', n: st.days_public, sub: 'derived nightly, never typed in', live: true },
    { k: 'weekday streak', n: st.streak_weekdays, sub: 'weekends do not count, gaps do' },
    { k: `entries since ${fmtDate(st.first_entry)}`, n: st.entries, sub: `${st.entries_30d} in the last 30 days` },
    { k: 'companies, 1 operator', n: st.companies, sub: `${st.companies_active_90d} made the log in the last 90 days` },
  ];
  return (
    <section className="wx-band mode-operator" id="proof" aria-label="The log in numbers">
      <dl className="wx-figs">
        {figs.map((f) => (
          <div key={f.k} className={`wx-fig${f.live ? ' wx-fig-live' : ''}`}>
            <dt className="wx-fig-k">{f.k}</dt>
            <dd className="wx-fig-n"><span>{f.n}</span></dd>
            <dd className="wx-fig-sub">{f.sub}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

// ------------------------------------------------ 15:00 to 02:00 the pinned day
// Stage lines are reconstructed from days 333 and 334 until the asciinema
// recordings exist (build plan 3.6). The compile stage reads the real build.
// The clock keyframes in home.css key off these hours: 15:00, 19:00, 23:00,
// 01:03 (the daily-note-recap schedule) and 02:00.
const STAGES = [
  { hour: '15:00', short: 'calls', title: 'Calls first.',
    body: 'Client, vendor and partner calls fill the afternoon. Each one lands in the vault as a note, or it did not happen.',
    lines: [['cmd', 'ls vault/Calendar/Meetings | tail -1'], ['out', '2026-09-29 enterprise IT services client.md'], ['out', '+ <b>10-day trial</b> instead of a walkout · daily updates · shared sheet']] },
  { hour: '19:00', short: 'build', title: 'Build what the calls exposed.',
    body: 'If a call surfaced a gap, it gets built that night, without a ticket or a slot on a roadmap.',
    lines: [['cmd', 'git push origin main'], ['out', '<b>141 files</b> changed · <b>56</b> backend tests green'], ['ok', 'end-to-end run passed twice']] },
  { hour: '23:00', short: 'write', title: 'Write it down, unedited.',
    body: 'The daily note is the raw material: what shipped, what it connects to, what I think.',
    lines: [['cmd', 'open vault/Calendar/Daily/2026-09-30.md'], ['out', 'shipping_now · yesterday_thread · raw_thought · arcs']] },
  { hour: '01:03', short: 'compile', title: 'An agent compiles the entry.',
    body: 'A nightly agent reads the note, writes the entry and rebuilds every number on this page from source. Nothing is typed in by hand.',
    lines: null },
  { hour: '02:00', short: 'ship', title: 'Live by 2 AM.',
    body: 'It pushes, the Cloudflare Worker serves it, and when an entry is late the top of the site says so.',
    lines: [['cmd', 'bash scripts/publish.sh'], ['ok', 'deploy ok · deependhq.com'], ['out', 'next window opens 15:00 IST']] },
];
// Stage boundaries as fractions of the pinned range. They match the clock
// keyframes (30, 55, 75, 90 percent) so the stage and the clock agree.
const BOUNDS = [0, 0.30, 0.55, 0.75, 0.90, 1];
const TRACK = 420; // svh, keep in step with .wx-anat-track height in home.css

const Day = () => {
  const st = DH.stats || {};
  const stages = STAGES.map((s) => (s.lines ? s : { ...s, lines: [
    ['cmd', 'node scripts/build-data.mjs'],
    ['out', `day <b>${st.days_public}</b> · <b>${st.entries}</b> entries · <b>${st.essays}</b> essays · <b>${st.companies}</b> companies`],
    ['ok', `data.js written · built ${istClock(DH.built)} IST`],
  ] }));
  const sent = STAGES.map((_, i) => {
    const top = i === 0 ? 0 : BOUNDS[i] * (TRACK - 100) + 50;
    const end = i === STAGES.length - 1 ? TRACK : BOUNDS[i + 1] * (TRACK - 100) + 50;
    return { top: +top.toFixed(2), h: +(end - top).toFixed(2) };
  });
  return (
    <section className="wx-anat wx-sec mode-operator" id="day" aria-labelledby="wx-day-h">
      <header className="wx-sec-head">
        <p className="wx-eyebrow-op">how this site runs</p>
        <h2 className="wx-op-h wx-ink" id="wx-day-h">How a day becomes an entry.</h2>
        <p className="wx-lead">The window runs 3 PM to 2 AM IST. At 2 AM the site publishes itself.</p>
      </header>
      <div className="wx-anat-track">
        <div className="wx-anat-stick">
          <div className="wx-anat-left">
            <div>
              <p className="wx-anat-ctx">how a day becomes an entry</p>
              <p className="wx-anat-clock" aria-hidden="true"><span className="wx-v">15:00</span></p>
              <p className="wx-anat-clock-k" aria-hidden="true">IST, inside the working window</p>
            </div>
            <ol className="wx-stages">
              {stages.map((s) => (
                <li key={s.hour} className="wx-stage" data-hour={s.hour}>
                  <p className="wx-stage-clock">{s.hour}</p>
                  <h3 className="wx-stage-t">{s.title}</h3>
                  <p className="wx-stage-c">{s.body}</p>
                  <div className="wx-term" role="img" aria-label={`Terminal, ${s.title}`}>
                    <div className="wx-term-body">
                      {s.lines.map(([k, t], i) => <p key={i} className={`wx-tl wx-${k}`} data-compile="" dangerouslySetInnerHTML={{ __html: t }} />)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <ol className="wx-anat-rail" aria-label="The five stages">
              {stages.map((s) => <li key={s.hour}><b>{s.hour}</b>{s.short}</li>)}
            </ol>
          </div>
          <div className="wx-anat-right" aria-hidden="true">
            <div className="wx-term">
              <div className="wx-term-bar"><span className="wx-term-dots"><i /><i /><i /></span><span className="wx-term-title">reconstructed from days 333 and 334 · recordings replace this</span></div>
              <div className="wx-anat-meter"><span>15:00</span><i /><span>02:00</span></div>
              <div className="wx-term-body" />
            </div>
          </div>
        </div>
        {sent.map((s, i) => <span key={i} className="wx-anat-sent" data-s={i + 1} style={{ top: `${s.top}svh`, height: `${s.h}svh` }} />)}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 17:00 the log
const Heat = () => {
  const H = DH.heatmap;
  const seen = new Set();
  const months = [];
  const latestIdx = H.cells.reduce((m, c, i) => (c.day ? i : m), 0);
  const cells = H.cells.map((c, i) => {
    const col = Math.floor(i / 7) + 2, row = (i % 7) + 2;
    const mon = fmtDate(c.date).split(' ')[0];
    const dnum = parseInt(c.date.slice(8), 10);
    if (row === 2 && dnum <= 7 && !seen.has(mon)) { seen.add(mon); months.push({ col, label: mon.toLowerCase() }); }
    const label = `${dow(c.date)} ${fmtDate(c.date)}`;
    let cls = '', kind;
    if (c.day) kind = KIND[c.arc_color] || 'logged';
    else if (c.future) { cls = 'wx-future'; kind = 'not yet'; }
    else if (c.weekend) { cls = 'wx-wkend'; kind = 'weekend, no entry'; }
    else { cls = 'wx-gap'; kind = 'no entry, a missed weekday'; }
    const aria = c.day ? `${label}, day ${c.day}, ${kind}` : `${label}, ${kind}`;
    return (
      <button key={c.date} type="button" className={`wx-cell ${cls}`.trim()} style={{ gridColumn: col, gridRow: row, '--i': i }}
        tabIndex={i === latestIdx ? 0 : -1} data-date={c.date} data-label={label} data-kind={kind}
        data-day={c.day || undefined} data-arc={c.arc_color || undefined} data-ship={c.ship ? String(c.ship).slice(0, 150) : undefined}
        aria-label={aria} />
    );
  });
  if (!months.length || months[0].col !== 2) months.unshift({ col: 2, label: fmtDate(H.start).split(' ')[0].toLowerCase() });
  return (
    <div className="wx-heat-grid" role="group" aria-label={`Sixteen weeks of entries, ${fmtDate(H.start)} to ${fmtDate(H.end)}. Arrow keys move by day and week.`}>
      {months.map((m) => <span key={m.label} className="wx-hm" style={{ gridColumn: m.col }}>{m.label}</span>)}
      {['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((w, i) => <span key={i} className="wx-hd" style={{ gridRow: i + 2 }}>{w}</span>)}
      {cells}
    </div>
  );
};

const Log = () => {
  const st = DH.stats || {};
  const e = DH.journey[0];
  const arcs = (st.arcs_30d || []).slice(0, 6);
  const mx = Math.max(1, ...arcs.map((a) => a.n));
  const rail = DH.journey.slice(0, 10);
  return (
    <section className="wx-log wx-sec mode-operator" id="log" aria-labelledby="wx-log-h">
      <header className="wx-sec-head wx-split">
        <p className="wx-eyebrow-op">the public log</p>
        <h2 className="wx-op-h wx-ink" id="wx-log-h">Every weekday, one entry. No skipping.</h2>
        <p className="wx-lead">{st.entries} entries since {fmtDate(st.first_entry)}. {st.entries_30d} in the last 30 days. The gaps are real and they stay visible.</p>
        <a className="wx-tlink" href="journey.html">the whole log →</a>
      </header>
      <div className="wx-log-grid">
        <figure className="wx-heat">
          <div className="wx-legend" aria-hidden="true">
            <span><i style={{ '--c': 'var(--build)' }} />building</span>
            <span><i style={{ '--c': 'var(--think)' }} />thinking</span>
            <span><i style={{ '--c': 'var(--win)' }} />a real outcome</span>
            <span><i style={{ '--c': 'transparent', boxShadow: 'inset 0 0 0 1px var(--line-2)' }} />no entry</span>
          </div>
          <div className="wx-heat-scroll"><Heat /></div>
          <figcaption className="wx-readout" aria-live="polite">
            <span><b>day {e.day}</b> · {fmtDate(e.date)} · {KIND[e.arc_color] || 'logged'}</span>
            <span>Hover, focus or tap any day. Every gap is a weekday I missed.</span>
          </figcaption>
        </figure>
        <aside className="wx-log-meta" aria-label="Log statistics">
          <p className="wx-kv"><b>{st.entries_30d}</b><span>entries in the<br />last 30 days</span></p>
          <p className="wx-kv"><b>{st.streak_weekdays}</b><span>weekday<br />streak</span></p>
          <div className="wx-arcs">
            <h3>what the last 30 days were about</h3>
            <ul>{arcs.map((a) => <li key={a.arc}><span style={{ '--w': `${Math.round((100 * a.n) / mx)}%` }}>{a.arc}</span><b>{a.n}</b></li>)}</ul>
          </div>
        </aside>
      </div>

      <div className="wx-rail-wrap">
        <div className="wx-rail-stick">
          <div className="wx-rail-head">
            <h3 className="wx-ink">The last ten entries.</h3>
            <p>scroll, swipe or tab through</p>
          </div>
          <ol className="wx-rail" aria-label="The last ten entries">
            {rail.map((d) => (
              <li key={d.day} className="wx-rc" data-arc={d.arc_color}>
                <p className="wx-rc-top"><span className="wx-rc-day">{d.day}</span><span className="wx-rc-kind">{KIND[d.arc_color] || 'logged'}</span></p>
                <p className="wx-rc-date">{dow(d.date)} · {fmtDate(d.date)} · <WxAge date={d.date} mode="plain" /></p>
                <p className="wx-rc-txt">{d.shipping_now}</p>
                <ul className="wx-chips">{(d.arcs || []).slice(0, 2).map((a) => <li key={a}>{a}</li>)}</ul>
                <a className="wx-tlink" href={`journey.html#day-${d.day}`}>day {d.day} in full →</a>
              </li>
            ))}
            <li style={{ display: 'contents' }}><a className="wx-rc-end" href="journey.html"><b>{st.entries}</b><span>the whole log →</span></a></li>
          </ol>
          <p className="wx-rail-ruler" aria-hidden="true"><span>day {rail[0].day} · {fmtDate(rail[0].date)}</span><i /><span>day {rail[rail.length - 1].day} · {fmtDate(rail[rail.length - 1].date)}</span></p>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 19:00 stack
// Featured first: things that are not rows in stack_now yet. Each one drops
// out of this list on its own once content.json carries it.
const FEATURED = [
  { name: 'Deep Scanner', url: null, tag: 'new', meta: 'in build, open source',
    what: 'Checks any folder before it reaches a cloud agent. First run: 8,357 files, 6 blocked, 392 flagged.' },
  { name: 'ChampBeam', url: 'https://champbeam.com', tag: 'live', meta: 'champbeam.com',
    what: 'Smart links, QR codes and file tracking in one product. Send it, know they saw it.' },
];
// ChampUTM lives inside ChampBeam now, so it does not get its own row.
const MERGED = new Set(['ChampUTM']);

const Stack = () => {
  const S = DH.stack_now || { items: [], counts: {} };
  const byName = new Map(S.items.map((i) => [i.name, i]));
  const featured = FEATURED.filter((f) => !byName.has(f.name));
  const scorer = byName.get('Lead Scorer');
  // Projects in active development (toolkit `status`) come first. A public
  // `site` wins over the repo link, so a live product opens as the product.
  const building = (i) => (i.status === 'building' || i.status === 'internal' ? 0 : 1);
  const rows = [
    ...featured,
    ...(scorer ? [{ name: 'Lead Scorer', url: 'lead-scorer.html', tag: 'live', meta: 'on this site', what: 'Upload a lead list. Jev ranks who to call first and writes the first line.' }] : []),
    ...S.items
      .filter((i) => i.kind === 'built' && (i.last_seen || i.status) && !MERGED.has(i.name))
      .sort((a, b) => building(a) - building(b) || String(b.last_seen || '').localeCompare(String(a.last_seen || '')))
      .slice(0, 5)
      .map((i) => ({
        name: i.name,
        url: i.site || i.url,
        tag: i.site ? 'live' : i.status === 'internal' ? 'internal' : '',
        meta: i.last_seen ? `log · ${fmtDate(i.last_seen)}` : (i.status === 'internal' ? 'runs in-house' : ''),
        what: i.what,
      })),
  ];
  const builtTotal = S.counts.built || 0;
  const shownBuilt = rows.filter((r) => byName.has(r.name) && byName.get(r.name).kind === 'built').length;
  const using = ['ChampOps', 'Obsidian + Celsus', 'Claude + Cowork', 'Cloudflare', 'Supabase', 'Jules'].map((n) => byName.get(n)).filter(Boolean);
  const list = (k) => S.items.filter((i) => i.kind === k).map((i) => i.name).join(', ') + '.';
  return (
    <section className="wx-stack wx-sec mode-operator" id="stack" aria-labelledby="wx-stack-h">
      <header className="wx-sec-head wx-split">
        <h2 className="wx-op-h wx-ink" id="wx-stack-h">What I build with.</h2>
        <p className="wx-lead">{S.items.length} tools. A tool only earns a date once it shows up in a day's entry.</p>
        <a className="wx-tlink" href="toolkit.html">the full stack →</a>
      </header>
      <div className="wx-stack-grid">
        <div className="wx-index-wrap">
          <div className="wx-index">
            {rows.map((r) => {
              const inner = (
                <React.Fragment>
                  <span className="wx-ix-name">{r.name}</span>
                  <span className="wx-ix-what">{r.what}</span>
                  <span className="wx-ix-meta">{r.tag && <span className={`wx-tag wx-tag-${r.tag}`}>{r.tag}</span>}{r.meta}</span>
                </React.Fragment>
              );
              if (!r.url) return <div key={r.name} className="wx-ix">{inner}</div>;
              const ext = /^https?:/.test(r.url);
              return <a key={r.name} className="wx-ix" href={r.url} {...(ext ? EXT : {})}>{inner}</a>;
            })}
          </div>
          <a className="wx-tlink wx-ix-more" href="toolkit.html">{Math.max(0, builtTotal - shownBuilt)} more repos in the toolkit →</a>
        </div>
        <aside className="wx-side" aria-label="Tools in use">
          <div><h3><span>in daily use</span><span>{S.counts.using || using.length}</span></h3>
            <ul>{using.map((t) => <li key={t.name}>{t.name}<span>{t.last_seen ? `log · ${fmtDate(t.last_seen)}` : ''}</span></li>)}</ul></div>
          <div><h3><span>trying</span><span>{S.counts.trying || 0}</span></h3><p className="wx-side-run">{list('trying')}</p></div>
          <div><h3><span>watching</span><span>{S.counts.watching || 0}</span></h3><p className="wx-side-run">{list('watching')}</p></div>
        </aside>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 21:00 pillars
const GO = { champ: 'open the product suite', 'infratech-lagoons': 'see the properties', lakeb2b: 'see the data companies', accelerator: 'meet the cohorts' };
const Pillars = () => {
  const used = new Set();
  return (
    <section className="wx-pillars wx-sec mode-editorial" id="ecosystem" aria-labelledby="wx-eco-h">
      <header className="wx-sec-head wx-split">
        <h2 className="wx-ed-h wx-ink" id="wx-eco-h">12 companies, 1 operator.</h2>
        <p className="wx-lead">Four doors into Champions Group. Each one shows the last day it made the public log.</p>
        <a className="wx-tlink" href="pillars.html">all four pillars →</a>
      </header>
      <div className="wx-pl-row">
        {(DH.pillars || []).map((p) => {
          // No two doors end on the same line: skip a recent entry another door already used.
          const rec = (p.recent || []).find((r) => !used.has(r.day)) || (p.recent || [])[0];
          if (rec) used.add(rec.day);
          const cos = (p.companies || []).length > 1 ? p.companies : (p.products || []).slice(0, 5).map((x) => x.name);
          return (
            <a key={p.slug} className="wx-pl" data-acc={p.accent} href={`pillars.html#${p.slug}`}>
              <h3 className="wx-pl-name">{p.name}</h3>
              <p className="wx-pl-blurb">{p.blurb}</p>
              <ul className="wx-pl-cos">{cos.map((c) => <li key={c}>{c}</li>)}</ul>
              <div className="wx-pl-foot">
                {p.last_ship
                  ? <p className="wx-pl-last"><span>last in the log</span><span><b>day {p.last_ship_day}</b> · <WxAge date={p.last_ship} mode={21} /></span></p>
                  : <p className="wx-pl-last"><span>{(p.counts || {}).products || 0} products</span></p>}
                {rec && <div className="wx-pl-more"><p><span>day {rec.day}: {rec.ship}</span></p></div>}
                <span className="wx-pl-go">{GO[p.slug] || 'open'} →</span>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 22:30 writing
const Writing = () => {
  const posts = (DH.posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [lead, ...rest] = posts;
  if (!lead) return null;
  const range = (lead.day_range || '').replace(/\s*[-\u2013\u2014]\s*/, ' to ');
  return (
    <section className="wx-writing wx-sec mode-editorial" id="writing" aria-labelledby="wx-w-h">
      <header className="wx-sec-head wx-split">
        <h2 className="wx-ed-h wx-ink" id="wx-w-h">The weekly narratives.</h2>
        <p className="wx-lead">One essay a week, written from the log, not from a content calendar. {posts.length} so far.</p>
        <a className="wx-tlink" href="writing.html">all essays →</a>
      </header>
      <div className="wx-w-grid">
        <a className="wx-w-feat" href={`post/${lead.slug}`}>
          <p className="wx-w-meta"><span className="wx-latest">latest</span>{lead.week && <span>week {lead.week}</span>}{range && <span>{range}</span>}<span>{lead.read}</span>{lead.arc && <span>{lead.arc}</span>}</p>
          <h3 className="wx-w-title wx-ink">{lead.title}</h3>
          {lead.deck && <p className="wx-w-deck">{lead.deck}</p>}
          <span className="wx-tlink">read {lead.week ? `week ${lead.week}` : 'it'} →</span>
        </a>
        <div className="wx-w-list">
          {rest.slice(0, 3).map((p) => (
            <a key={p.slug} className="wx-w-row" href={`post/${p.slug}`}>
              <p className="wx-w-meta">{p.week && <span>week {p.week}</span>}<span>{fmtDate(p.date)}</span><span>{p.read}</span></p>
              <h3>{p.title}</h3>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 00:30 off the clock
// Written from off_hours in content.json. Rewrite this line when those change.
const HUMAN_LINE = 'Sundays at sunrise, the gray mare at Bangalore Turf Club. Jiu-jitsu two mornings a week, purple belt, still terrible at takedowns. One more turn of Civ at 2 AM. 47 attempts at the perfect sambar, 0 finals. Caro, Iyer and Naipaul for the long flights.';
const Human = () => {
  const words = HUMAN_LINE.split(' ');
  const step = +(52 / words.length).toFixed(3);
  return (
    <section className="wx-human wx-sec mode-editorial" id="human" aria-labelledby="wx-human-k">
      <div className="wx-human-grid">
        <div className="wx-human-main">
          <p className="wx-eyebrow-ed" id="wx-human-k" style={{ marginBottom: 'var(--s5)' }}>off the clock</p>
          <p className="wx-human-big" style={{ '--step': `${step}%` }}>
            {words.map((w, i) => <React.Fragment key={i}><span className="wx-w" style={{ '--i': i }}>{w}</span>{' '}</React.Fragment>)}
          </p>
        </div>
        <div className="wx-human-side">
          <h3>dms I answer</h3>
          <ul>{(DH.rolodex || []).map((r) => <li key={r.who}><b>{r.who}</b><span>{r.how}</span></li>)}</ul>
        </div>
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 01:30 three doors
// The hero's pair in reverse: the command compiles first, then the headline inks.
const Doors = () => (
  <section className="wx-doors wx-sec mode-editorial" id="ways" aria-labelledby="wx-doors-h">
    <p className="wx-cmd-line" data-compile="">book --30min --no-deck</p>
    <h2 className="wx-doors-h wx-ink" id="wx-doors-h">Three doors. Same person behind each one.</h2>
    <div className="wx-doors-grid">
      <a className="wx-door wx-door-main" href={BOOK} {...EXT}>
        <span className="wx-door-k">founders</span>
        <span className="wx-door-t">Thirty minutes, no deck. Bring the thing you are stuck on, leave with a next move.</span>
        <span className="btn btn-gold">Book 30 minutes</span>
      </a>
      <div className="wx-door-side">
        <a className="wx-door" href="https://github.com/Champ-Deep" {...EXT}>
          <span className="wx-door-k">operators and builders</span>
          <span className="wx-door-t">Everything I ship is in the open. Read the log, fork the repos, tell me where I am wrong.</span>
          <span className="wx-door-go">github / Champ-Deep ↗</span>
        </a>
        <div className="wx-door">
          <span className="wx-door-k">recruiters, press, everyone else</span>
          <span className="wx-door-t">One inbox. Plain text wins. I answer the ones that read like a human wrote them.</span>
          <span className="wx-mailrow"><a className="wx-mail" href="mailto:deep@championsmail.com">deep@championsmail.com</a><button className="wx-copy" type="button" data-copy="deep@championsmail.com">copy</button></span>
        </div>
      </div>
    </div>
  </section>
);

// ---------------------------------------------------------------- 02:00 sign-off
const Signoff = () => (
  <div className="wx-signoff mode-operator">
    <p className="wx-foot-line" data-compile="">02:00 IST. The nightly agent rebuilds this page from the vault. The window opens again at 3 PM.</p>
    <p className="wx-wordmark" aria-label="deep">deep <span className="wx-gt">&gt;<span className="wx-us">_</span></span></p>
  </div>
);

const Boundary = () => <div className="wx-boundary" aria-hidden="true" />;

window.HomeSections = { Hero, Proof, Day, Log, Stack, Pillars, Writing, Human, Doors, Signoff, Boundary };
})();
