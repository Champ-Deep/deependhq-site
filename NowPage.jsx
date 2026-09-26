// NowPage.jsx : /now. Sep 2026 system.
// Two layers, clearly labelled. The derived layer (this week from the log,
// what is on the desk) is always current. The curated layer (focus notes,
// build lanes) shows its own age and turns red when it is past 21 days.

const NowPage = () => {
  const { Age, Chip, fmtDate, arcTone, ageOf } = window.Sys;
  const D = window.DH_DATA;
  const st = D.stats || {};
  const week = (D.journey || []).slice(0, 5);
  const now = D.now || { focus: [] };
  const lanes = D.build_lanes || {};
  const nowAge = ageOf(now.updated, 21);
  const laneAge = ageOf(lanes.updated, 21);

  return (
    <main className="dh-page sys mode-operator" id="main">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">now</span>
          <h1>What has my attention this week.</h1>
          <p className="lead">the top half is derived from the log on every build and cannot go stale without the whole site going stale. the bottom half is written by hand and says how old it is.</p>
          <div className="meta">
            <span>log: day {st.days_public}</span>
            <span>{st.entries_30d} entries, last 30 days</span>
            <span>streak {st.streak_weekdays} weekdays</span>
          </div>
        </header>

        <section aria-labelledby="wk-h" style={{ marginBottom: 'var(--s10)' }}>
          <div className="section-head" style={{ marginBottom: 'var(--s4)' }}>
            <div><span className="eyebrow">from the log</span><h2 id="wk-h">The last five entries.</h2></div>
            <a className="section-link" href="journey.html">the whole log →</a>
          </div>
          <div className="now-grid">
            {week.map((e) => (
              <a key={e.day} className={`card link day-card ${e.arc_color}`} href={`journey.html#day-${e.day}`} style={{ display: 'grid' }}>
                <span className="k"><b>day {e.day}</b><span>{fmtDate(e.date)} · <Age date={e.date} mode={7} /></span></span>
                <span className="t" style={{ WebkitLineClamp: 5 }}>{e.shipping_now}</span>
                <span className="chips">{(e.arcs || []).slice(0, 3).map((a) => <Chip key={a} tone={arcTone(e.arc_color)}>{a}</Chip>)}<span className="chip">{e.mood}</span></span>
              </a>
            ))}
            <div className="card lane">
              <h3><span>on my desk, 30 days</span><b>{st.entries_30d} entries</b></h3>
              {(st.arcs_30d || []).map((a) => (
                <div className="it" key={a.arc}><b>{a.arc}</b><span>{a.n} {a.n === 1 ? 'entry' : 'entries'} in the last 30 days</span></div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="hand-h">
          <div className="section-head" style={{ marginBottom: 'var(--s4)' }}>
            <div><span className="eyebrow">by hand <Age date={now.updated} mode={21} prefix="written" /></span><h2 id="hand-h">Focus notes and build lanes.</h2></div>
          </div>
          {(nowAge.state === 'stale' || laneAge.state === 'stale') && (
            <div className="empty" style={{ marginBottom: 'var(--bento-gap)', borderColor: 'var(--danger)', color: 'var(--text)' }}>
              &gt;_ <b style={{ color: 'var(--danger-text)' }}>this half is old.</b> focus notes were written {fmtDate(now.updated, true)}, build lanes {fmtDate(lanes.updated, true)}. the log above is current; treat this as the last time I sat down to write it out, not as today.
            </div>
          )}
          <div className="now-grid">
            {(now.focus || []).map((f, i) => (
              <div key={i} className={`card day-card ${f.color || ''}`} style={{ display: 'grid' }}>
                <span className="k"><b>{f.k}</b></span>
                <span className="t" style={{ WebkitLineClamp: 6 }}>{f.text}</span>
              </div>
            ))}
            {['live', 'building', 'next'].map((k) => (
              <div key={k} className="card lane">
                <h3><span>{k}</span><b>{(lanes[k] || []).length}</b></h3>
                {(lanes[k] || []).map((it) => (
                  <div className="it" key={it.name}><b>{it.name}</b><span>{it.what}</span>{it.repo && <a href={it.repo} target="_blank" rel="noreferrer">{it.repo.replace(/^https?:\/\/(www\.)?/, '')} ↗</a>}</div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

window.NowPage = NowPage;
