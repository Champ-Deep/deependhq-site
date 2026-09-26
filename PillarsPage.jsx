// PillarsPage.jsx : /pillars. Four doors instead of a wall of twelve cards.
// Sep 2026 system.
//
// Every number on this page is derived in scripts/derive.mjs: the last-ship date
// per pillar, the entry count over 30 days, the company and product tallies. A
// pillar with no recent log activity says so in words rather than borrowing a
// date. The three-line card cap is a design rule, so a card leads with chips and
// ends with one line of prose, never a paragraph.

const PillarsPage = () => {
  const { Age, Chip, fmtDate } = window.Sys;
  const D = window.DH_DATA;
  const pillars = D.pillars || [];
  const doors = D.doors || { segments: {} };
  const st = D.stats || {};
  const cos = D.companies || [];
  const [seg, setSeg] = React.useState('');

  const order = (doors.order || pillars.map((p) => p.slug)).filter((s) => pillars.some((p) => p.slug === s));
  const shown = seg && doors.segments && doors.segments[seg] ? order.filter((s) => doors.segments[seg].indexOf(s) !== -1) : order;
  const segs = Object.keys(doors.segments || {});

  if (!pillars.length) {
    return (
      <main className="dh-page sys mode-operator" id="main">
        <div className="wrap"><p className="lead">No pillars defined yet.</p></div>
      </main>
    );
  }

  return (
    <main className="dh-page sys mode-operator" id="main">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">four doors</span>
          <h1>Twelve companies. Four doors.</h1>
          <p className="lead">Pick the door that matches what you are trying to do. Every card shows when that part last made the public log, so an idle quarter looks idle.</p>
          <div className="meta">
            <span>{pillars.length} pillars</span>
            <span>{st.companies} companies</span>
            <span>log: day {st.days_public}</span>
          </div>
        </header>

        {segs.length > 0 && (
          <div className="filter-pills" role="group" aria-label="filter by who you are">
            <button type="button" className={`pill${seg === '' ? ' on' : ''}`} onClick={() => setSeg('')}>everyone</button>
            {segs.map((s) => (
              <button key={s} type="button" className={`pill${seg === s ? ' on' : ''}`} onClick={() => setSeg(seg === s ? '' : s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="pillar-grid">
          {shown.map((slug) => {
            const p = pillars.find((x) => x.slug === slug);
            if (!p) return null;
            const quiet = !p.last_ship || (p.days_since != null && p.days_since > 45);
            const members = (p.companies || []).map((n) => cos.find((c) => c.name === n)).filter(Boolean);
            return (
              <article key={p.slug} className={`card pillar-card accent-${p.accent}`} id={p.slug}>
                <header className="h">
                  <h2>{p.name}</h2>
                  <span className="counts">
                    {p.counts.companies} {p.counts.companies === 1 ? 'company' : 'companies'}
                    {' · '}
                    {p.counts.products} {p.counts.products === 1 ? 'product' : 'products'}
                  </span>
                </header>
                <p className="blurb">{p.blurb}</p>

                <div className="last">
                  {p.last_ship ? (
                    <React.Fragment>
                      <i className={`dot${quiet ? '' : ' on'}`} />
                      <b>day {p.last_ship_day}</b> · {fmtDate(p.last_ship, true)} · <Age date={p.last_ship} mode={45} />
                      <span className="dim"> · {p.entries_30d} {p.entries_30d === 1 ? 'entry' : 'entries'}, 30d</span>
                    </React.Fragment>
                  ) : (
                    <span className="dim">nothing in the log under this name yet</span>
                  )}
                </div>

                {members.length > 0 && (
                  <div className="members">
                    {members.map((c) => (
                      <a key={c.slug} href={`company.html?slug=${encodeURIComponent(c.slug)}`} className="member">
                        <b>{c.name}</b>
                        <span>{c.tag}</span>
                      </a>
                    ))}
                  </div>
                )}

                <div className="chips">
                  {(p.products || []).map((pr) => (
                    pr.url
                      ? <a key={pr.name} href={pr.url} target="_blank" rel="noreferrer"><Chip tone="win">{pr.name} ↗</Chip></a>
                      : <Chip key={pr.name}>{pr.name}</Chip>
                  ))}
                </div>

                {quiet && (
                  <p className="dim note">this one has been quiet in the log. that is the honest number, not a placeholder.</p>
                )}

                {p.recent && p.recent.length > 0 && (
                  <div className="recent">
                    <span className="k">last from here</span>
                    {p.recent.slice(0, 2).map((r) => (
                      <a key={r.day} href={`journey.html#day-${r.day}`} className="r">
                        <b>day {r.day}</b> {r.ship}
                      </a>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {seg && (
          <p className="empty" style={{ marginTop: 'var(--bento-gap)' }}>
            &gt;_ showing the doors that fit <b style={{ color: 'var(--text)' }}>{seg}</b>. {shown.length} of {pillars.length}.
            <button type="button" className="alt" onClick={() => setSeg('')} style={{ background: 'none', border: 0, color: 'var(--build)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>show all four</button>
          </p>
        )}

        <section className="section sys" style={{ marginTop: 'var(--s10)' }} aria-labelledby="cm-h">
          <div className="section-head">
            <div>
              <h2 id="cm-h">All twelve, flat.</h2>
              <p className="lead">the same companies without the doors, in the order they were founded.</p>
            </div>
            <a className="section-link" href="index.html#ecosystem">homepage →</a>
          </div>
          <div className="co-grid">
            {cos.map((c) => {
              const p = pillars.find((x) => x.slug === c.pillar);
              return (
                <a key={c.slug} className="card link co-card" href={`company.html?slug=${encodeURIComponent(c.slug)}`}>
                  <span className="h"><b>{c.name}</b><span>{c.tag}</span></span>
                  <span className="d">{c.desc}</span>
                  <span className="chips">
                    {p && <Chip tone={p.accent === 'win' ? 'win' : p.accent === 'think' ? 'think' : p.accent === 'human' ? 'human' : 'build'}>{p.name}</Chip>}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};

window.PillarsPage = PillarsPage;
