// PillarsPage.jsx : /pillars. Four doors, v2 (Oct 2026).
// Full width. The header row carries an instrument (share of the log by door,
// last 30 days) so no column is empty. Each door is a spotlight card with a
// 16-week activity strip derived from the public log at render time, the
// member companies, the products, and the last two entries. The twelve
// companies sit in one hairline ledger with a derived "last in the log" column
// instead of twelve identical cards. Every number is derived, nothing stored.
// Hook aliases suffixed P. No em dashes.

const { useState: useStatePl, useMemo: useMemoPl } = React;

const P_ACCENT = { build: 'var(--build)', win: 'var(--win)', think: 'var(--think)', human: 'var(--human)' };
const P_TEXT = { build: 'var(--build)', win: 'var(--win)', think: 'var(--think-text)', human: 'var(--human-text)' };

const PillarsPage = () => {
  const { Age, Chip, fmtDate } = window.Sys;
  const { Spot, useRevealF, useCountUpF, Bars, Stack, mentionsByWeek, lastMention } = window.Fx;
  const D = window.DH_DATA;
  const pillars = D.pillars || [];
  const doors = D.doors || { segments: {} };
  const st = D.stats || {};
  const cos = D.companies || [];
  const journey = D.journey || [];
  const [seg, setSeg] = useStatePl('');
  const root = useRevealF([seg]);

  const order = (doors.order || pillars.map((p) => p.slug)).filter((s) => pillars.some((p) => p.slug === s));
  const shown = seg && doors.segments && doors.segments[seg] ? order.filter((s) => doors.segments[seg].indexOf(s) !== -1) : order;
  const segs = Object.keys(doors.segments || {});

  // 16 weeks of activity per door, from the log, by the door's arcs and names
  const weeksByDoor = useMemoPl(() => {
    const m = {};
    for (const p of pillars) m[p.slug] = mentionsByWeek(journey, [p.name].concat(p.arcs || [], p.companies || [], (p.products || []).map((x) => x.name)), 16);
    return m;
  }, [pillars, journey]);
  const total30 = pillars.reduce((a, p) => a + (p.entries_30d || 0), 0);
  const [bigTotal, bigRef] = useCountUpF(total30);

  // the ledger: last time each company was named in the log, derived live
  const ledger = useMemoPl(() => cos.map((c) => {
    const p = pillars.find((x) => x.slug === c.pillar);
    const e = lastMention(journey, [c.name].concat(c.products || []));
    const w = mentionsByWeek(journey, [c.name].concat(c.products || []), 13);
    return { c, p, last: e, n90: w.reduce((a, b) => a + b, 0), weeks: w };
  }), [cos, pillars, journey]);
  const ledgerMax = Math.max(1, ...ledger.map((r) => r.n90));

  if (!pillars.length) {
    return (
      <main className="dh-page sys mode-operator v2" id="main">
        <div className="wrap"><p className="lead">No pillars defined yet.</p></div>
      </main>
    );
  }

  return (
    <main className="dh-page sys mode-operator v2" id="main" ref={root}>
      <div className="wrap">
        <header className="v2-head">
          <div className="v2-head-copy">
            <span className="eyebrow">four doors</span>
            <h1>Twelve companies. Four doors.</h1>
            <p className="lead">Pick the door that matches what you are trying to do. Every door shows when it last made the public log and how much of the last 30 days it took, so an idle quarter looks idle.</p>
            <div className="meta">
              <span>{pillars.length} pillars</span>
              <span>{st.companies} companies</span>
              <span>log: day {st.days_public}</span>
              <span>{st.companies_active_90d} companies named in 90 days</span>
            </div>
          </div>
          <aside className="v2-instrument card" aria-labelledby="share-h">
            <div className="v2-instrument-top">
              <span className="k" id="share-h">share of the log, 30 days</span>
              <span className="big" ref={bigRef}>{bigTotal}<small> entries</small></span>
            </div>
            <Stack parts={pillars.map((p) => ({ k: p.name, n: p.entries_30d || 0, color: P_ACCENT[p.accent] || 'var(--build)' }))} total={Math.max(1, total30)} />
          </aside>
        </header>

        {segs.length > 0 && (
          <div className="filter-pills" role="group" aria-label="filter by who you are">
            <button type="button" className={'pill' + (seg === '' ? ' on' : '')} onClick={() => setSeg('')}>everyone</button>
            {segs.map((s) => (
              <button key={s} type="button" className={'pill' + (seg === s ? ' on' : '')} onClick={() => setSeg(seg === s ? '' : s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="doors">
          {shown.map((slug, i) => {
            const p = pillars.find((x) => x.slug === slug);
            if (!p) return null;
            const quiet = !p.last_ship || (p.days_since != null && p.days_since > 45);
            const members = (p.companies || []).map((n) => cos.find((c) => c.name === n)).filter(Boolean);
            const accent = P_ACCENT[p.accent] || 'var(--build)';
            const text = P_TEXT[p.accent] || 'var(--build)';
            const weeks = weeksByDoor[p.slug] || [];
            return (
              <Spot as="article" key={p.slug} className={'card door accent-' + p.accent} accent={accent} id={p.slug} data-reveal style={{ '--i': i }}>
                <header className="door-h">
                  <div>
                    <h2>{p.name}</h2>
                    <p className="blurb">{p.blurb}</p>
                  </div>
                  <span className="door-counts" style={{ color: text }}>
                    {p.counts.companies} {p.counts.companies === 1 ? 'company' : 'companies'} · {p.counts.products} {p.counts.products === 1 ? 'product' : 'products'}
                  </span>
                </header>

                <div className="door-pulse">
                  <div className="door-num">
                    <b style={{ color: text }}>{p.entries_30d || 0}</b>
                    <span>{p.entries_30d === 1 ? 'entry' : 'entries'}, 30 days</span>
                  </div>
                  <div className="door-strip">
                    <Bars values={weeks} accent={accent} label={'activity by week, last 16 weeks: ' + weeks.join(', ')} height={34} />
                    <span className="door-strip-k">16 weeks of the log</span>
                  </div>
                  <div className="door-last">
                    {p.last_ship ? (
                      <React.Fragment>
                        <i className={'dot' + (quiet ? '' : ' on')} style={{ background: quiet ? undefined : accent }} />
                        <b>day {p.last_ship_day}</b> · {fmtDate(p.last_ship, true)} · <Age date={p.last_ship} mode={45} />
                      </React.Fragment>
                    ) : <span className="dim">nothing in the log under this name yet</span>}
                  </div>
                </div>

                <div className="door-body">
                  {members.length > 0 && (
                    <div className="members">
                      {members.map((c) => (
                        <a key={c.slug} href={'company/' + c.slug} className="member">
                          <b>{c.name}</b>
                          <span>{c.tag}</span>
                          <em aria-hidden="true">→</em>
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="chips">
                    {(p.products || []).map((pr) => (
                      pr.url
                        ? <a key={pr.name} href={pr.url} target="_blank" rel="noreferrer"><Chip tone={p.accent === 'think' ? 'think' : p.accent === 'human' ? 'human' : p.accent === 'win' ? 'win' : 'build'}>{pr.name} ↗</Chip></a>
                        : <Chip key={pr.name}>{pr.name}</Chip>
                    ))}
                  </div>
                </div>

                {p.recent && p.recent.length > 0 && (
                  <div className="recent">
                    <span className="k">last from here</span>
                    {p.recent.slice(0, 2).map((r) => (
                      <a key={r.day} href={'journey.html#day-' + r.day} className="r">
                        <b style={{ color: text }}>day {r.day}</b> {r.ship}
                      </a>
                    ))}
                  </div>
                )}
              </Spot>
            );
          })}
        </div>

        {seg && (
          <p className="empty" style={{ marginTop: 'var(--bento-gap)' }}>
            &gt;_ showing the doors that fit <b style={{ color: 'var(--text)' }}>{seg}</b>. {shown.length} of {pillars.length}.{' '}
            <button type="button" className="linkish" onClick={() => setSeg('')}>show all four</button>
          </p>
        )}

        <section className="section sys" aria-labelledby="cm-h" style={{ paddingBottom: 0 }}>
          <div className="section-head">
            <div>
              <span className="eyebrow">the ledger</span>
              <h2 id="cm-h">All twelve, flat.</h2>
              <p className="lead">the same companies without the doors, in the order they were founded. the last two columns are read off the public log when this page renders.</p>
            </div>
            <a className="section-link" href="index.html#ecosystem">homepage →</a>
          </div>
          <div className="ledger-wrap" data-reveal>
            <table className="ledger" aria-label="the twelve companies">
              <thead>
                <tr>
                  <th scope="col" className="n">#</th>
                  <th scope="col">company</th>
                  <th scope="col">what it is</th>
                  <th scope="col">door</th>
                  <th scope="col">products</th>
                  <th scope="col" className="num">named, 90d</th>
                  <th scope="col">last in the log</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row, i) => (
                  <tr key={row.c.slug}>
                    <td className="n">{String(i + 1).padStart(2, '0')}</td>
                    <td><a href={'company/' + row.c.slug} className="ledger-name">{row.c.name}</a><span className="ledger-tag">{row.c.tag}</span></td>
                    <td className="desc">{row.c.desc}</td>
                    <td>{row.p && <Chip tone={row.p.accent === 'think' ? 'think' : row.p.accent === 'human' ? 'human' : row.p.accent === 'win' ? 'win' : 'build'}>{row.p.name}</Chip>}</td>
                    <td className="prods">{(row.c.products || []).length ? (row.c.products || []).slice(0, 3).join(', ') + ((row.c.products || []).length > 3 ? ' +' + ((row.c.products || []).length - 3) : '') : <span className="dim">none listed</span>}</td>
                    <td className="num"><span className="ibar" style={{ '--v': (row.n90 / ledgerMax).toFixed(3) }} /><b>{row.n90}</b></td>
                    <td>{row.last ? <a href={'journey.html#day-' + row.last.day}>day {row.last.day} · <Age date={row.last.date} mode={45} /></a> : <span className="dim">not yet named</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
};

window.PillarsPage = PillarsPage;
