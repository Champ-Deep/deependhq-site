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

// Brand illustration from the identity sprite (brand/icons.svg). Always beside a
// text label, so it stays out of the accessibility tree. Never a UI control.
const Ico = ({ id, size = 48 }) => (
  <svg className="ico" width={size} height={size} aria-hidden="true" focusable="false"><use href={`brand/icons.svg#i-${id}`} /></svg>
);


// Personal cover first. The same real-log terrain now lives in the log.
const Hero = () => {
  const e = DH.journey[0];
  return (
    <section className="wx-hero mode-editorial ev3-cover" id="top" aria-labelledby="wx-hero-h">
      <div className="ev3-cover-inner">
        <div className="ev3-masthead"><p className="wx-eyebrow-ed">The Deep End</p><p>A working life, in public.</p></div>
        <h1 id="wx-hero-h" className="ev3-name">Deep<span className="ev3-period">.</span><span className="ev3-fullname">Sreedeep Surapaneni</span></h1>
        <div className="ev3-intro">
          <div className="ev3-story">
            <h2>Marketer first.<br />Builder by instinct.</h2>
            <p className="ev3-roles" data-dh-frozen="">Group CMO, Champions Group.<br />CEO, Champions Accelerator.</p>
            <p className="ev3-lede">I work across twelve companies. Here, I keep a public record of the work: the builds, the decisions, and what actually shipped.</p>
            <div className="ev3-actions"><a className="ev3-book" href={BOOK} {...EXT}><span data-dh-cta="cta_label">Talk to Deep</span>
              {/* 21st.dev/nextjsshop Arrow Dots Button: source dot geometry, static label. */}
              <span className="ev3-arrow" aria-hidden="true">{[3, 2, 1, 0].map(parent => <span className="ev3-arrow-icon" key={parent} style={{ '--i': parent }}>{[2, 1, 0, 1, 2].map((value, i) => <i key={i} style={{ '--dot': value }} />)}</span>)}</span>
              <small data-dh-frozen="">30 minutes</small></a><a className="ev3-tools" href="#stack">Explore the tools <span aria-hidden="true">→</span></a></div>
          </div>
          <nav className="v4-index" aria-label="Inside this field guide">
            <p className="wx-eyebrow-op">AI in the operating system.<br />Judgment still human.</p>
            <a href="#stack"><span>01</span> Put a tool to work <b>↗</b></a>
            <a href="#log"><span>02</span> Read the latest dispatch <b>↗</b></a>
            <a href="#day"><span>03</span> Look under the hood <b>↗</b></a>
            <p>Built with agents. Tested in the work.</p>
          </nav>
        </div>
      </div>
    </section>
  );
};

const Terrain = () => {
  const e = DH.journey[0];
  // One column per day since the first entry: height is github_commits where
  // the log recorded it, else 1 for an entry, 0 for a gap. kinds[] runs
  // parallel to data and colours the column by that entry's arc, rows carries
  // the day and first line the readout and click need.
  const startISO = DH.journey.map((x) => x.date).sort()[0];
  const endISO = DH.brand.today_date || e.date;
  const byDate = new Map(DH.journey.map((x) => [x.date, x]));
  const data = [], kinds = [], rows = [];
  for (let t = Date.parse(startISO); t <= Date.parse(endISO); t += 864e5) {
    const iso = new Date(t).toISOString().slice(0, 10);
    const en = byDate.get(iso);
    data.push(en ? (en.github_commits != null ? en.github_commits : 1) : 0);
    kinds.push(en ? en.arc_color : '');
    rows.push(en ? [en.day, String(en.shipping_now || en.raw_thought || '').slice(0, 140)] : null);
  }
  const peak = `day ${e.day}, ${ageOf(e.date, 'log').label}`;
  const isle = JSON.stringify({ d: data, k: kinds, start: startISO, end: endISO, peak, rows });
  return (
        <div className="ev3-terrain" data-island="terrain" data-props={isle}>
          {/* server-rendered fallback: the same days as a plain heat strip */}
          <div className="trn-fb">
            <p className="trn-fb-k">{data.length} days, one column a day, since {fmtDate(startISO)} · newest <b>{peak}</b></p>
            <div className="trn-fb-strip" aria-hidden="true">
              {data.map((h, i) => <i key={i} className={kinds[i] ? `trn-fb-k-${kinds[i]}` : (h ? 'trn-fb-k-log' : 'trn-fb-k-gap')} />)}
            </div>
            <p className="trn-fb-note">building · thinking · a real outcome · gaps have zero height</p>
            <a className="wx-tlink" href={`journey.html#day-${e.day}`}>read day {e.day} →</a>
            <a className="wx-tlink" href="journey.html">the whole log →</a>
          </div>
        </div>

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
// Seven lanes (plan section 4), driven by lanes[] in content.json: label,
// clock, snippet. The pinned clock keys which lane is lit: home.js already
// switches stages as sentinels cross the viewport middle and prints
// data-hour, so it gains nothing and needs no lane index of its own. Mobile
// keeps the list and drops the pin (the existing 64rem gate does that).
// Last-lane dates are omitted: a keyword match cannot prove a lane occurred.
// No em dashes.

// Stage boundaries as fractions of the pinned range. They only have to be
// monotonic: the JS clock in home.js prints data-hour per active stage, and
// the old winclock CSS keyframes (five stages) are no longer opted into.
const BOUNDS = [0, 0.13, 0.26, 0.38, 0.55, 0.75, 0.88, 1];
const TRACK = 420; // svh, keep in step with .wx-anat-track height in home.css

const Day = () => {
  const stages = DH.lanes || [];
  const sent = stages.map((_, i) => {
    const top = i === 0 ? 0 : BOUNDS[i] * (TRACK - 100) + 50;
    const end = i === stages.length - 1 ? TRACK : BOUNDS[i + 1] * (TRACK - 100) + 50;
    return { top: +top.toFixed(2), h: +(end - top).toFixed(2) };
  });
  return (
    <section className="wx-anat wx-sec mode-operator" id="day" aria-labelledby="wx-day-h">
      <header className="wx-sec-head">
        <p className="wx-eyebrow-op">how this site runs</p>
        <h2 className="wx-op-h wx-ink" id="wx-day-h">How a day becomes an entry.</h2>
        <p className="wx-lead">The window runs 3 PM to 2 AM IST. Seven lanes, then a new entry. Commands below are illustrative, not live terminal output.</p>
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
                <li key={s.clock} className="wx-stage" data-hour={s.clock}>
                  <p className="wx-stage-clock">{s.clock}</p>
                  <h3 className="wx-stage-t">{s.label}</h3>
                  <p className="p4-example">Illustrative command, not live output</p>
                  <div className="wx-term" aria-label={`Illustrative ${s.label} commands`}>
                    <div className="wx-term-body">
                      {s.snippet.map(([k, t], i) => <p key={i} className={`wx-tl wx-${k}`} data-compile="">{t}</p>)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <ol className="wx-anat-rail" aria-label="The seven lanes">
              {stages.map((s) => <li key={s.clock}><b>{s.clock}</b>{s.label}</li>)}
            </ol>
          </div>
          <div className="wx-anat-right" aria-hidden="true">
            <div className="wx-term">
              <div className="wx-term-bar"><span className="wx-term-title">Illustrative commands · not a live terminal</span></div>
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

const Machine = () => {
  const st = DH.stats || {};
  const e = DH.journey[0];
  const arcs = (st.arcs_30d || []).slice(0, 6);
  const rail = DH.journey.slice(0, 10).map((d) => ({ ...d, id: String(d.day), label: `Day ${d.day}, ${KIND[d.arc_color] || 'logged'}`, dateLabel: `${dow(d.date)} · ${fmtDate(d.date)}`, ageLabel: ageOf(d.date, 99999).label }));
  const metrics = [
    ['days in public', st.days_public], ['weekday streak', st.streak_weekdays],
    ['log entries', st.entries], ['companies, 1 operator', st.companies],
  ];
  return (
    <section className="wx-log wx-metric-log wx-sec mode-operator" id="machine" aria-labelledby="wx-machine-h">
      <header className="wx-sec-head wx-split">
        <p className="wx-eyebrow-op">under the hood</p>
        <h2 className="wx-op-h wx-ink" id="wx-machine-h">The machine logs.</h2>
        <p className="wx-lead">{st.entries} entries since {fmtDate(st.first_entry)}. {st.entries_30d} in the last 30 days. The gaps are real and they stay visible.</p>
        <a className="wx-tlink" href="journey.html">the whole log →</a>
      </header>
      <dl className="wx-metric-row" data-dh-frozen="" aria-label={`Log metrics as of ${DH.built.slice(0, 10)}`}>
        {metrics.map(([label, value]) => <div className="wx-metric-card" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="wx-log-grid wg-log-overview ev3-log-grid">
        <Terrain />
        <aside className="wx-log-meta" aria-label="Log statistics">
          <div className="wx-metric-arcs">
            <h3>what the last 30 days were about</h3>
            <p>Entries per arc, out of {st.entries_30d}. An entry can carry more than one arc.</p>
            <ul>{arcs.map((a) => <li key={a.arc}><span>{a.arc}</span><b>{a.n}</b><span className="wx-metric-track" aria-hidden="true"><i style={{ width: `${100 * a.n / Math.max(1, st.entries_30d)}%` }} /></span></li>)}</ul>
          </div>
        </aside>
      </div>

    </section>
  );
};

const Log = () => {
  const e = DH.journey[0];
  return <section className="wx-sec mode-editorial v4-dispatch" id="log" aria-labelledby="wx-log-h">
    <header className="wx-sec-head wx-split">
      <p className="wx-eyebrow-ed">the public log / latest dispatch</p>
      <h2 className="wx-ed-h" id="wx-log-h">The work, not the highlight reel.</h2>
      <a className="wx-tlink" href="journey.html">The whole log →</a>
    </header>
    <article className="v4-latest wx-live" data-newest={e.date} data-day={e.day} data-dh-frozen="">
      <div className="v4-day"><span>DAY</span><b>{e.day}</b><time dateTime={e.date}>{fmtDate(e.date, true)}</time><WxAge date={e.date} mode="log" /></div>
      <div className="v4-dispatch-copy"><p className="wx-eyebrow-op">{KIND[e.arc_color] || 'logged'}</p><h3>{e.shipping_now}</h3><a className="wx-tlink" href={`journey.html#day-${e.day}`}>Read day {e.day} in full →</a></div>
    </article>
    <nav className="v4-previous" aria-label="Three previous dispatches"><span>Previously</span>{DH.journey.slice(1, 4).map(d => <a key={d.day} href={`journey.html#day-${d.day}`}><b>Day {d.day}</b><time dateTime={d.date}>{fmtDate(d.date)}</time><span>↗</span></a>)}</nav>
  </section>;
};

// ---------------------------------------------------------------- 19:00 stack
// Featured first, always: the two newest builds lead the index whether or not
// content.json carries them yet, and they are skipped further down so they
// never show twice. Deep Scanner has no public repo yet, so it has no link.
const FEATURED = [
  { name: 'Deep Scanner', url: null, tag: 'internal', meta: 'public release not verified',
    what: 'Checks local text files for secrets and sensitive information before cloud sync. A Pass is not a guarantee of safety.' },
  { name: 'ChampBeam', url: 'https://champbeam.com/?utm_source=deependhq&utm_medium=stack', tag: 'live', meta: 'champbeam.com',
    what: 'Smart links, QR codes and file tracking in one product. Send it, know they saw it.' },
];
const MERGED = new Set(['ChampUTM']);
const Stack = () => {
  const S = DH.stack_now || { items: [], counts: {} };
  const T = DH.things_to_try || [];
  const byName = new Map(S.items.map((i) => [i.name, i]));
  const featured = FEATURED;
  const pinned = new Set(FEATURED.map((f) => f.name));
  const scorer = byName.get('Lead Scorer');
  // Projects in active development (toolkit `status`) come first. A public
  // `site` wins over the repo link, so a live product opens as the product.
  const building = (i) => (i.status === 'building' || i.status === 'internal' ? 0 : 1);
  const rows = [
    ...featured,
    ...(scorer ? [{ name: 'Lead Scorer', url: 'lead-scorer.html', tag: 'tool', meta: 'sign-in and credits', what: 'Enrich contacts, check email deliverability and judge fit against your criteria.' }] : []),
    ...S.items
      .filter((i) => i.kind === 'built' && (i.last_seen || i.status) && !MERGED.has(i.name) && !pinned.has(i.name))
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
        <h2 className="wx-op-h wx-ink" id="wx-stack-h">Things to try.</h2>
        <p className="wx-lead">Tools for the work in front of you. Start with a job, leave with something useful.</p>
        <a className="wx-tlink" href="toolkit.html">open the toolkit →</a>
      </header>
      <ul className="otc-try v4-tools" aria-label="Things to try">
        {[
          { name: 'Lead Scorer', result: 'Which leads deserve a closer look?', href: '/lead-scorer', cta: 'Check your list', label: 'Sign-in + credits' },
          { name: 'Harbinger', result: 'Which accounts have a reason to buy now?', href: (DH.toolkit || []).find(t => t.title === 'ChampHarbinger')?.site, cta: 'Research buying signals', label: 'Separate product' },
          { name: 'ChamPDF', result: 'Get a PDF job off your desk.', href: 'https://champdf.com', cta: 'Open the PDF tools', label: 'Free browser tools' },
          { name: 'ChampBeam', result: 'Share a link. See what happens.', href: (DH.toolkit || []).find(t => t.title === 'ChampBeam')?.site, cta: 'Explore smart links', label: 'Separate product' },
          { name: 'Ask Deep', result: 'Ask a question about the work on this site.', href: 'https://assistant.deependhq.com', cta: 'Ask the site', label: 'Site-grounded assistant', open_launcher: true },
        ].filter(t => t.href).map((t, i) => {
          const ext = /^https?:/.test(t.href || '');
          return (
            <li key={t.name} className="otc-try-card">
              <span className="v4-tool-no" aria-hidden="true">0{i + 1}</span>
              <div><h3 className="otc-try-name">{t.name}</h3><p className="otc-try-result">{t.result}</p><small>{t.label}</small></div>
              <a className="otc-try-go" href={t.href} {...(ext ? EXT : {})} {...(t.open_launcher ? { 'data-otc-ask': '' } : {})}>{t.cta} →</a>
            </li>
          );
        })}
      </ul>
      {/* The launcher opener lives here, not in home.js: this lane does not own
          that file. Every one of these anchors keeps a real href, so with JS off
          the card still goes somewhere honest instead of doing nothing. */}
      <script dangerouslySetInnerHTML={{ __html: `(function(){document.addEventListener('click',function(e){var a=e.target.closest('[data-otc-ask],[data-otc-play]');if(!a)return;if(a.hasAttribute('data-otc-ask')){if(!window.deepAssistant)return;e.preventDefault();window.deepAssistant.open();return;}e.preventDefault();var li=a.parentNode,f=document.createElement('iframe');f.className='otc-sp-frame';f.title='Spotify playlist embed';f.loading='lazy';f.src='https://open.spotify.com/embed/playlist/'+a.getAttribute('data-otc-play')+'?theme=0';f.setAttribute('allow','encrypted-media');li.classList.add('is-playing');li.replaceChild(f,a);});})();` }} />

      <details className="otc-fs">
        <summary><b>the full stack</b><span>{S.items.length} tools. A tool only earns a date once it shows up in a day's entry.</span></summary>
        <div className="wx-stack-grid">
        <div className="wx-index-wrap">
          <div className="wx-index">
            {rows.map((r) => {
              const inner = (
                <React.Fragment>
                  <span className="wx-ix-name">{r.name}</span>
                  <span className="wx-ix-what">{r.what}</span>
                  <span className="wx-ix-meta">{r.tag && <span className={`wx-tag wx-tag-${r.tag.split(' ')[0]}`}>{r.tag}</span>}{r.meta}</span>
                </React.Fragment>
              );
              if (!r.url) return <div key={r.name} className="wx-ix">{inner}</div>;
              const ext = /^https?:/.test(r.url);
              return <a key={r.name} className="wx-ix" href={r.url} aria-label={r.name} {...(ext ? EXT : {})}>{inner}</a>;
            })}
          </div>
          <a className="wx-tlink wx-ix-more" href="toolkit.html" aria-label="More repos in the toolkit">{Math.max(0, builtTotal - shownBuilt)} more repos in the toolkit →</a>
        </div>
        <aside className="wx-side" aria-label="Tools in use">
          <div><h3><span>in daily use</span><span>{S.counts.using || using.length}</span></h3>
            <ul>{using.map((t) => <li key={t.name}>{t.name}<span>{t.last_seen ? `log · ${fmtDate(t.last_seen)}` : ''}</span></li>)}</ul></div>
          <div><h3><span>trying</span><span>{S.counts.trying || 0}</span></h3><p className="wx-side-run">{list('trying')}</p></div>
          <div><h3><span>watching</span><span>{S.counts.watching || 0}</span></h3><p className="wx-side-run">{list('watching')}</p></div>
        </aside>
        </div>
      </details>
    </section>
  );
};

const ToolkitChooser = () => {
  const items = DH.toolkit || [];
  const harbinger = items.find(t => t.title === 'ChampHarbinger');
  const beam = items.find(t => t.title === 'ChampBeam');
  const pdf = items.find(t => t.title === 'ChamPDF');
  return (
    <div className="tk-home" aria-labelledby="tk-chooser-h">
      <header className="tk-home-head">
        <div><h3 id="tk-chooser-h">Tools for the work<br/>in front of you.</h3><p>Start with the job, not the product name.</p></div>
        <a className="tk-home-all" href="/toolkit">Explore the full toolkit <span aria-hidden="true">↗</span></a>
      </header>
      <div className="tk-home-features">
        <article className="tk-home-feature">
          <div className="tk-home-product"><span>Lead Scorer</span><span>On this site</span></div>
          <h3>Which leads<br/>are worth a closer look?</h3>
          <p>Bring your list. Enrich contacts, check email deliverability and judge fit against your criteria.</p>
          <dl className="tk-home-io"><div><dt>You bring</dt><dd>A CSV or Excel list</dd></div><div><dt>You get</dt><dd>Fit, email status and evidence</dd></div></dl>
          <div className="tk-home-flow" aria-label="Lead Scorer workflow"><span>Upload</span><span>Check</span><span>Score</span><span>Export</span></div>
          <a className="tk-home-action tk-home-action-primary" href="/lead-scorer">Open Lead Scorer <span aria-hidden="true">↗</span></a>
          <small>Sign-in and credits. Review the maximum cost before running.</small>
        </article>
        <article className="tk-home-feature">
          <div className="tk-home-product"><span>Harbinger</span><span>Separate product</span></div>
          <h3>Which accounts<br/>have a reason to buy now?</h3>
          <p>Research buying signals, then investigate the companies and people behind them.</p>
          <dl className="tk-home-io"><div><dt>You bring</dt><dd>An account or market to research</dd></div><div><dt>You get</dt><dd>Signals and account context</dd></div></dl>
          <div className="tk-home-signals" aria-label="Harbinger signal types"><span>Hiring</span><span>Funding</span><span>Company news</span></div>
          {harbinger?.site && <a className="tk-home-action" href={harbinger.site} {...EXT}>Explore Harbinger <span aria-hidden="true">↗</span></a>}
          <small>Opens its own site. Shared toolkit credits are not connected.</small>
        </article>
      </div>
      <div className="tk-home-secondary">
        <div className="tk-home-utilities">
          <a href={beam?.site} {...EXT}><div><h3>Share a link. See what happens.</h3><p>ChampBeam: smart links, QR codes and file tracking.</p></div><span>Open ChampBeam <span aria-hidden="true">↗</span></span><small>Separate product site and account.</small></a>
          <a href={pdf?.site} {...EXT}><div><h3>Get a PDF job off your desk.</h3><p>ChamPDF: merge, split, compress and convert.</p></div><span>Open ChamPDF <span aria-hidden="true">↗</span></span><small>Free browser tools. No toolkit credits.</small></a>
        </div>
        <details className="tk-home-scanner">
          <summary>And what is Deep Scanner?</summary>
          <div><h3>File safety, not sales research.</h3><p>It scans local text files for secrets and sensitive information before cloud sync. Results are marked Block, Review or Pass.</p><p>Not a lead finder or a lead-scoring tool.</p><strong>Internal Python scanner. Public release not verified.</strong><p>Regex checks have limits. A Pass is not a guarantee that a file is safe to share.</p></div>
        </details>
        <p className="tk-home-footnote">Looking for the tools I use, experiments or source code? <a href="/toolkit#tk-stack">Open the build stack</a>.</p>
      </div>
    </div>
  );
};

const GO = { champ: 'open the product suite', 'infratech-lagoons': 'see the properties', lakeb2b: 'see the data companies', accelerator: 'meet the cohorts' };
// What the folder island reads, derived from content.json through data.js at
// build time and trimmed to the fields the island touches, so data-props in
// the prerendered HTML stays small (plan section 8).
const folderProps = () => {
  const byPillar = Object.fromEntries((DH.pillars || []).map((p) => [p.slug, p]));
  return (DH.companies || []).map((c) => {
    const p = byPillar[c.pillar] || {};
    const urls = {};
    (p.products || []).forEach((x) => { if (x.url) urls[x.name] = x.url; });
    return {
      slug: c.slug,
      name: c.name,
      tag: c.tag,
      accent: p.accent || 'win',
      entries: (c.related_journey || []).slice(0, 2).map((e) => ({
        day: e.day,
        date: e.date,
        text: String(e.shipping_now || '').slice(0, 60),
      })),
      // a product links to its own site when it has one, else to the company page
      products: (c.products || []).map((n) => ({ name: n, href: urls[n] || `company/${c.slug}` })),
    };
  });
};

const Pillars = () => {
  const used = new Set();
  return (
    <section className="wx-pillars wx-sec mode-editorial" id="ecosystem" aria-labelledby="wx-eco-h">
      <header className="wx-sec-head wx-split">
        <h2 className="wx-ed-h wx-ink" id="wx-eco-h">Group CMO across twelve companies</h2>
        <p className="wx-lead">One operator, twelve businesses. Open a company for its products and the work behind them.</p>
        <a className="wx-tlink" href="pillars.html">all four pillars →</a>
      </header>
      {/* 21st.dev/a11ypros Accessible Accordion: native reading survives JS off. */}
      <div className="v4-directory">
        {folderProps().map((c, i) => <details className="v4-company accordion-item" id={`company-${c.slug}`} key={c.slug}>
          <summary className="accordion-item__summary"><span className="v4-company-no">{String(i + 1).padStart(2, '0')}</span><span><b>{c.name}</b><small>{c.tag || 'Champions Group'}</small></span><svg className="accordion-item__icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></summary>
          <div className="accordion-item__content"><a aria-label={`Explore ${c.name}`} href={`company/${c.slug}`}>Explore {c.name} ↗</a>{c.products.map(p => <a key={p.name} aria-label={`${p.name}, ${c.name}`} href={p.href}>{p.name} ↗</a>)}{c.entries.slice(0, 1).map(d => <a key={d.day} aria-label={`Read day ${d.day}, ${c.name}`} href={`journey.html#day-${d.day}`}>Last in the log: day {d.day} · <WxAge date={d.date} mode="plain" /></a>)}</div>
        </details>)}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------- 22:30 writing
// The newest essay leads on the left with an inline listen button (home.js
// plays the MP3 when it exists, otherwise the button opens the essay, which
// offers the browser voice) and the Ask AI links. The right side carries the
// week it was written from, the same strip the essay page pins beside the text.
// The next three essays sit underneath as cards with their own small strips.
const W_KIND = { green: 'building', blue: 'thinking', gold: 'a real outcome' };
const wClock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const askLinks = (slug) => {
  const q = encodeURIComponent(`Read this essay by Sreedeep Surapaneni and give me the three main ideas in plain words, then one thing an operator could try this week: https://deependhq.com/post/${slug}`);
  return [['ChatGPT', `https://chatgpt.com/?q=${q}`], ['Claude', `https://claude.ai/new?q=${q}`], ['Perplexity', `https://www.perplexity.ai/search/new?q=${q}`], ['Google AI Mode', `https://www.google.com/search?udm=50&q=${q}`]];
};
const MiniStrip = ({ p, big }) => {
  const v = p.viz || { days: [], para_days: [] };
  const counts = v.days.map((d) => v.para_days.filter((ds) => ds.includes(d.date)).length);
  const mx = Math.max(1, ...counts);
  return (
    <span className={`wx-ws${big ? ' wx-ws-big' : ''}`} aria-hidden="true">
      {v.days.slice(0, 7).map((d, k) => <i key={d.date} className={d.day ? `arc-${d.arc_color || 'none'}` : 'is-empty'} style={{ '--h': d.day ? `${Math.round(25 + 75 * (counts[k] / mx))}%` : '0' }} />)}
    </span>
  );
};
const Writing = () => {
  const posts = (DH.posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [lead, ...rest] = posts;
  if (!lead) return null;
  const range = (lead.day_range || '').replace(/\s*[-\u2013\u2014]\s*/, ' to ');
  const v = lead.viz || { days: [], nodes: [], entries: 0, listen_min: 1 };
  const A = lead.audio;
  const arcWords = (v.nodes || []).filter((n) => n.kind === 'arc').map((n) => ({
    ...n, words: n.paras.reduce((total, i) => {
      const b = (lead.body || [])[i];
      const text = typeof b === 'string' ? b : b ? [b.head, b.text, ...(b.lines || [])].filter(Boolean).join(' ') : '';
      return total + text.split(/\s+/).filter(Boolean).length;
    }, 0),
  }));
  return (
    <section className="wx-writing wx-metric-writing wx-sec mode-editorial" id="writing" aria-labelledby="wx-w-h">
      <header className="wx-sec-head wx-split">
        <h2 className="wx-ed-h wx-ink" id="wx-w-h">A week, distilled.</h2>
        <p className="wx-lead">The decisions underneath the daily log. {posts.length} weekly essays, with the source days attached.</p>
        <a className="wx-tlink" href="writing.html">all essays →</a>
      </header>
      <div className="wx-w-grid v4-edition">
        <div className="v4-edition-stamp"><span>THE WEEKLY</span><b>{lead.week}</b><span>{range}</span><span>{lead.read} read</span></div>
        <div className="wx-w-feat">
          <p className="wx-w-meta"><span className="wx-latest">latest</span>{lead.week && <span>week {lead.week}</span>}{range && <span>{range}</span>}<span>{lead.read} read</span>{lead.arc && <span>{lead.arc}</span>}</p>
          <h3 className="wx-w-title wx-ink"><a href={`post/${lead.slug}`}>{lead.title}</a></h3>
          {lead.deck && <p className="wx-w-deck">{lead.deck}</p>}
          <div className={`wx-wplay${A ? '' : ' is-link'}`} data-src={A ? A.src : undefined} data-dur={A ? A.duration : undefined}>
            {A
              ? <button type="button" className="wx-wplay-btn" aria-label={`Play week ${lead.week}, ${wClock(A.duration)}`}><svg className="i-play" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z" fill="currentColor" /></svg><svg className="i-pause" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z" fill="currentColor" /></svg></button>
              : <a className="wx-wplay-btn" href={`post/${lead.slug}`} aria-label={`Listen to week ${lead.week} on the essay page`}><svg className="i-play" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z" fill="currentColor" /></svg></a>}
            <span className="wx-wplay-mid">
              <span className="wx-wplay-k"><b>listen</b><span className="wx-wplay-t">{A ? wClock(A.duration) : `about ${v.listen_min} min`}</span><span>{A ? `AI voice, ElevenLabs ${A.voice}` : 'browser voice on the essay page'}</span></span>
              <span className="wx-wplay-bar" aria-hidden="true"><i /></span>
            </span>
          </div>
          <details className="v4-ai"><summary>Discuss this essay with AI</summary><div className="wx-wask">{askLinks(lead.slug).map(([n, h]) => <a key={n} aria-label={`Discuss this essay with ${n}`} href={h} target="_blank" rel="noopener noreferrer">{n} ↗</a>)}</div></details>
          <a className="wx-tlink" href={`post/${lead.slug}`}>read week {lead.week} →</a>
        </div>
        <aside className="wx-w-week" aria-label={`The week behind week ${lead.week}`}>
          <p className="wx-w-week-k">the week behind it<span>{v.entries} log entries</span></p>
          <ol className="wx-wk-row wx-metric-week">
            {v.days.slice(0, 7).map((d) => (
              <li key={d.date}>{d.day
                ? <a className={`wx-wk arc-${d.arc_color || 'none'}`} href={`journey.html#day-${d.day}`}><span>{d.dow}</span><b>day {d.day}</b><em>{W_KIND[d.arc_color] || 'logged'}</em><small>{Number.isFinite(DH.journey.find((e) => e.day === d.day)?.github_commits) ? `${DH.journey.find((e) => e.day === d.day).github_commits} commits` : (d.arcs || [])[0] || 'no arc recorded'}</small></a>
                : <span className="wx-wk is-empty"><span>{d.dow}</span><b>&nbsp;</b><em>no entry</em></span>}</li>
            ))}
          </ol>

        </aside>
        <div className="wx-w-more">
          {rest.slice(0, 3).map((p) => (
            <a key={p.slug} className="wx-w-card" href={`post/${p.slug}`}>
              <p className="wx-w-meta">{p.week && <span>week {p.week}</span>}<span>{fmtDate(p.date)}</span><span>{p.audio ? `listen ${wClock(p.audio.duration)}` : `listen, ${p.viz ? p.viz.listen_min : 1} min`}</span></p>
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
const HUMAN_LINE = 'Sundays at sunrise, the gray mare at Bangalore Turf Club. Jiu-jitsu two mornings a week, purple belt, still terrible at takedowns. One more turn of Civ at 2 AM. Caro, Iyer and Naipaul for the long flights.';
// Six tiles: one per thing in the line above, the listening card fed by
// off_the_clock.spotify_playlist, and the current game slot. Both off_the_clock
// keys are empty placeholders today, and an empty key renders the honest empty
// state ("playlist coming", "current game: to be named") rather than a fake.
const OTC = DH.off_the_clock || {};
const plId = String(OTC.spotify_playlist || '').trim().replace(/^.*playlist\//, '').replace(/[?#].*$/, '').replace(/\/+$/, '').trim();
const game = String(OTC.current_game || '').trim();
const HUMAN_TILES = [
  { id: 'horseshoe', label: 'sunday rides' },
  { id: 'gi', label: 'jiu-jitsu' },
  { id: 'gamepad', label: 'civilization and crusader kings', note: 'one more turn at 2 AM' },
  { id: 'music', label: 'listening', spotify: true },
  { id: 'book', label: 'long-flight reading' },
];
const Human = () => <section className="wx-human wx-sec mode-editorial" id="human" aria-labelledby="wx-human-k">
  <header className="wx-sec-head"><p className="wx-eyebrow-ed">off the clock</p><h2 className="wx-ed-h" id="wx-human-k">Not everything needs to scale.</h2></header>
  <div className="v4-offhours">
    <article className="v4-listening"><Ico id="music" size={56} /><div><p className="v4-service">LISTENING / SPOTIFY</p><h3>{plId ? 'The rotation.' : 'Between tracks.'}</h3><p>{plId ? 'An on-demand playlist. Nothing loads until you press play.' : 'No public playlist connected. No invented now-playing status.'}</p>{plId && <a data-otc-play={plId} href={`https://open.spotify.com/playlist/${plId}`} className="otc-sp-cover">Load the playlist ↗</a>}</div></article>
    <article className="v4-playing"><Ico id="gamepad" size={56} /><div><p className="v4-service">CURRENT GAME / AFTER HOURS</p><h3>{game || 'One more turn.'}</h3><p>{game ? 'From the off-hours note, not a live presence feed.' : 'Civilization. Crusader Kings. Anything 4X.'}</p><small>No PlayStation account connected.</small></div></article>
  </div>
  <ul className="v4-human-notes">{(DH.off_hours || []).filter(h => h.what !== 'Gaming').map((h, i) => <li key={h.what}><Ico id={['horseshoe', 'gi', 'book'][i]} size={40} /><div><h3>{h.what}</h3><p>{h.detail}</p></div></li>)}</ul>
</section>;

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
// The compile line closes the night. The marks come right after it, in the
// sitewide paper band (SignOff.jsx): the wordmark is always the SVG, never
// live text, so the old typed "deep >_" wordmark is gone from here.
const Signoff = () => (
  <div className="wx-signoff mode-operator">
    <p className="wx-foot-line" data-compile="">02:00 IST. The nightly agent rebuilds this page from the vault. The window opens again at 3 PM.</p>
  </div>
);

const Boundary = () => <div className="wx-boundary" aria-hidden="true" />;

window.HomeSections = { Hero, Proof, Day, Log, Machine, Stack, Pillars, Writing, Human, Doors, Signoff, Boundary };
})();
