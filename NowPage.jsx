// NowPage.jsx — /now. A snapshot of what has Sreedeep's attention right now.
// Data-driven from DH_DATA.now (focus), DH_DATA.status (the basics), and
// DH_DATA.off_hours. The daily pipeline refreshes status; now.focus is curated.

const NowPage = () => {
  const D = window.DH_DATA;
  const now = D.now || { focus: [], note: '' };
  const s = D.status || {};

  const basics = [
    ['Location', s.location],
    ['Local time', s.time_ist],
    ['Reading', s.reading],
    ['Listening', s.listening],
    ['Drinking', s.drinking],
    ['Last ship', s.last_ship],
  ].filter((row) => row[1]);

  const prettyUpdated = (() => {
    if (!now.updated) return null;
    const [y, m, d] = now.updated.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
  })();

  return (
    <main className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> Now</div>
        <h1 className="dh-page-title">What I'm doing now.</h1>
        <p className="dh-page-sub">A snapshot, not a feed. The honest answer to "what are you working on?"</p>
      </header>

      <div className="dh-rail-layout">
      <div>
        {now.note && <p className="dh-now-note">{now.note}</p>}

        <div className="dh-now-grid" id="focus">
          {now.focus.map((f, i) => (
            <article key={i} className={`dh-now-card dh-now-${f.color || 'muted'}`}>
              <p className="dh-now-k">{f.k}</p>
              <p className="dh-now-text">{f.text}</p>
            </article>
          ))}
        </div>

        {Array.isArray(D.off_hours) && D.off_hours.length > 0 && (
          <section id="offclock">
            <p className="dh-now-subhead">Off the clock</p>
            <div className="dh-now-grid">
              {D.off_hours.map((o, i) => (
                <article key={i} className="dh-now-card dh-now-muted">
                  <p className="dh-now-k">{o.what}</p>
                  <p className="dh-now-text">{o.detail}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <dl className="dh-now-basics" id="basics">
          {basics.map(([label, value]) => (
            <div key={label} className="dh-now-basic">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {prettyUpdated && (
          <p className="dh-now-updated"><span className="dh-gt">&gt;_</span>last updated {prettyUpdated} · this page is inspired by the /now movement</p>
        )}
      </div>

      <aside className="dh-rail" aria-label="now context">
        <window.RailProgress />
        <window.RailToc
          items={[
            { id: 'focus', label: 'In focus', count: now.focus.length },
            { id: 'offclock', label: 'Off the clock', count: (D.off_hours || []).length },
            { id: 'basics', label: 'The basics' },
          ]}
          active={window.useScrollSpy(['focus', 'offclock', 'basics'])}
        />
        <div className="dh-rail-block">
          <p className="dh-rail-k">Live strip</p>
          <ul className="dh-rail-legend">
            <li><span className="dh-rail-swatch dh-rail-swatch-green" />{s.state || 'shipping'}</li>
            {s.last_ship && <li><span className="dh-rail-swatch dh-rail-swatch-gold" />{s.last_ship}</li>}
            {s.location && <li><span className="dh-rail-swatch dh-rail-swatch-blue" />{s.location}</li>}
          </ul>
        </div>
        <div className="dh-rail-block">
          <p className="dh-rail-k">Go deeper</p>
          <ul className="dh-rail-nav">
            <li><a href="journey.html">today's entry →</a></li>
            <li><a href="writing.html">weekly narratives →</a></li>
          </ul>
        </div>
      </aside>
      </div>
    </main>
  );
};

window.NowPage = NowPage;
