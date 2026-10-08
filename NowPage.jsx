// NowPage.jsx : /now, v2 (Oct 2026).
// Two layers, clearly labelled, full width. The derived layer (this week from
// the log, where the attention went, the 30-day rhythm) is always current. The
// curated layer (focus notes, build lanes) shows its own age and turns red past
// 21 days; it never pretends. No card has a fixed height, no column is empty.
// Hook aliases suffixed N. No em dashes.

const { useMemo: useMemoN } = React;

const N_ARC = { green: 'var(--build)', blue: 'var(--think)', gold: 'var(--win)' };
const N_FOCUS = { green: 'var(--build)', blue: 'var(--think)', gold: 'var(--win)', magenta: 'var(--human)' };
const N_FOCUS_TEXT = { green: 'var(--build)', blue: 'var(--think-text)', gold: 'var(--win)', magenta: 'var(--human-text)' };

const NowPage = () => {
  const { Age, Chip, fmtDate, arcTone, ageOf } = window.Sys;
  const { Spot, useRevealF, useCountUpF } = window.Fx;
  const D = window.DH_DATA;
  const st = D.stats || {};
  const journey = D.journey || [];
  const week = journey.slice(0, 5);
  const now = D.now || { focus: [] };
  const lanes = D.build_lanes || {};
  const nowAge = ageOf(now.updated, 21);
  const laneAge = ageOf(lanes.updated, 21);
  const root = useRevealF([]);
  const [big30, bigRef] = useCountUpF(st.entries_30d || 0);
  const [bigStreak, streakRef] = useCountUpF(st.streak_weekdays || 0);

  // the last 30 days as a strip of weekdays: colour is the arc, height is the length of the entry
  const rhythm = useMemoN(() => {
    const out = [];
    const today = (journey[0] && journey[0].date) || null;
    if (!today) return out;
    const end = Date.parse(today + 'T00:00:00Z');
    const byDate = {}; journey.forEach((e) => { byDate[e.date] = e; });
    for (let i = 29; i >= 0; i--) {
      const d = new Date(end - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const dow = d.getUTCDay();
      const e = byDate[iso];
      out.push({ iso, weekend: dow === 0 || dow === 6, e, len: e ? Math.min(1, ((e.shipping_now || '').length + (e.yesterday_thread || '').length) / 600) : 0 });
    }
    return out;
  }, [journey]);
  const arcs = (st.arcs_30d || []).slice(0, 8);
  const arcMax = Math.max(1, ...arcs.map((a) => a.n));
  const laneTotal = ['live', 'building', 'next'].reduce((a, k) => a + ((lanes[k] || []).length), 0);

  return (
    <main className="dh-page sys mode-operator v2" id="main" ref={root}>
      <div className="wrap">
        <header className="v2-head">
          <div className="v2-head-copy">
            <span className="eyebrow">now</span>
            <h1>What has my attention this week.</h1>
            <p className="lead">the top half is derived from the log on every build and cannot go stale without the whole site going stale. the bottom half is written by hand and says how old it is.</p>
            <div className="meta">
              <span>log: day {st.days_public}</span>
              <span>{st.entries_30d} entries, last 30 days</span>
              <span>streak {st.streak_weekdays} weekdays</span>
            </div>
          </div>
          <aside className="v2-instrument card" aria-labelledby="rhythm-h">
            <div className="v2-instrument-top">
              <span className="k" id="rhythm-h">the last 30 days, one bar a day</span>
              <span className="big" ref={bigRef}>{big30}<small> entries</small></span>
            </div>
            <div className="rhythm" role="img" aria-label={'thirty days of the log. ' + (st.entries_30d || 0) + ' entries. weekends are hollow.'}>
              {rhythm.map((d) => (
                d.e
                  ? <a key={d.iso} href={'journey.html#day-' + d.e.day} className="rhythm-d on" style={{ '--h': (0.35 + d.len * 0.65).toFixed(2), background: N_ARC[d.e.arc_color] || 'var(--build)' }} title={'day ' + d.e.day + ' · ' + fmtDate(d.iso)} aria-label={'day ' + d.e.day + ', ' + fmtDate(d.iso)} />
                  : <i key={d.iso} className={'rhythm-d' + (d.weekend ? ' we' : '')} title={fmtDate(d.iso) + (d.weekend ? ' · weekend' : ' · no entry')} />
              ))}
            </div>
            <div className="rhythm-foot">
              <span><i style={{ background: 'var(--build)' }} />building</span>
              <span><i style={{ background: 'var(--think)' }} />thinking</span>
              <span><i style={{ background: 'var(--win)' }} />winning</span>
              <span className="streak"><b ref={streakRef}>{bigStreak}</b> weekday streak</span>
            </div>
          </aside>
        </header>

        <section aria-labelledby="wk-h" className="section" style={{ paddingTop: 0 }}>
          <div className="section-head" style={{ marginBottom: 'var(--s4)' }}>
            <div><span className="eyebrow">from the log</span><h2 id="wk-h">The last five entries.</h2></div>
            <a className="section-link" href="journey.html">the whole log →</a>
          </div>
          <div className="five">
            {week.map((e, i) => (
              <Spot as="a" key={e.day} href={'journey.html#day-' + e.day} className="card five-card" accent={N_ARC[e.arc_color] || 'var(--build)'} data-reveal style={{ '--i': i }}>
                <span className="k"><i className="dot on" style={{ background: N_ARC[e.arc_color] || 'var(--build)' }} /><b>day {e.day}</b><span>{fmtDate(e.date)} · <Age date={e.date} mode={7} /></span></span>
                <span className="t">{e.shipping_now}</span>
                <span className="chips">{(e.arcs || []).slice(0, 2).map((a) => <Chip key={a} tone={arcTone(e.arc_color)}>{a}</Chip>)}<span className="chip">{e.mood}</span></span>
              </Spot>
            ))}
          </div>
        </section>

        <section aria-labelledby="att-h" className="section" style={{ paddingTop: 0 }}>
          <div className="attention">
            <div className="attention-copy">
              <span className="eyebrow">where it went</span>
              <h2 id="att-h">On my desk, 30 days.</h2>
              <p className="lead">every entry carries one or two arcs. count them and the month explains itself.</p>
              <dl className="attention-stats">
                <div><dt>arcs touched</dt><dd>{(st.arcs_30d || []).length}</dd></div>
                <div><dt>top arc share</dt><dd>{arcs.length && st.entries_30d ? Math.round((arcs[0].n / st.entries_30d) * 100) + '%' : '0%'}</dd></div>
                <div><dt>companies named, 90d</dt><dd>{st.companies_active_90d || 0}</dd></div>
              </dl>
            </div>
            <ol className="arcbars" aria-label="entries by arc, last 30 days">
              {arcs.map((a, i) => (
                <li key={a.arc} data-reveal style={{ '--i': i }}>
                  <span className="arc-name">{a.arc}</span>
                  <span className="arc-track"><i style={{ '--v': (a.n / arcMax).toFixed(3) }} /></span>
                  <b className="arc-n">{a.n}</b>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="hand-h" className="section">
          <div className="section-head" style={{ marginBottom: 'var(--s4)' }}>
            <div><span className="eyebrow">by hand <Age date={now.updated} mode={21} prefix="written" /></span><h2 id="hand-h">Focus notes and build lanes.</h2></div>
          </div>
          {(nowAge.state === 'stale' || laneAge.state === 'stale') && (
            <div className="empty stale-note">
              &gt;_ <b style={{ color: 'var(--danger-text)' }}>this half is old.</b> focus notes were written {fmtDate(now.updated, true)}, build lanes {fmtDate(lanes.updated, true)}. the log above is the current truth; this is the last time I wrote the plan down by hand.
            </div>
          )}
          <div className="hand">
            <div className="focus-grid">
              {(now.focus || []).map((f, i) => (
                <Spot as="div" key={i} className="card focus" accent={N_FOCUS[f.color] || 'var(--build)'} data-reveal style={{ '--i': i }}>
                  <span className="k" style={{ color: N_FOCUS_TEXT[f.color] || 'var(--build)' }}><i className="dot on" style={{ background: N_FOCUS[f.color] || 'var(--build)' }} />{f.k}</span>
                  <span className="t">{f.text}</span>
                </Spot>
              ))}
            </div>
            <div className="lanes">
              {['live', 'building', 'next'].map((k) => (
                <div key={k} className="card lane" data-reveal>
                  <h3><span>{k}</span><b>{(lanes[k] || []).length}</b></h3>
                  <span className="lane-meter" aria-hidden="true"><i style={{ '--v': laneTotal ? ((lanes[k] || []).length / laneTotal).toFixed(3) : 0, background: k === 'live' ? 'var(--build)' : k === 'building' ? 'var(--think)' : 'var(--line-2)' }} /></span>
                  {(lanes[k] || []).map((it) => (
                    <div className="it" key={it.name}><b>{it.name}</b><span>{it.what}</span>{it.repo && <a href={it.repo} target="_blank" rel="noreferrer">{it.repo.replace('https://', '')} ↗</a>}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {window.Shoutouts && <window.Shoutouts />}
      </div>
    </main>
  );
};

window.NowPage = NowPage;
