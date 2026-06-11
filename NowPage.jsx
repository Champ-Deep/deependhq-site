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

      <div className="dh-narrow">
        {now.note && <p className="dh-now-note">{now.note}</p>}

        <div className="dh-now-grid">
          {now.focus.map((f, i) => (
            <article key={i} className={`dh-now-card dh-now-${f.color || 'muted'}`}>
              <p className="dh-now-k">{f.k}</p>
              <p className="dh-now-text">{f.text}</p>
            </article>
          ))}
        </div>

        {Array.isArray(D.off_hours) && D.off_hours.length > 0 && (
          <section>
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

        <dl className="dh-now-basics">
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
    </main>
  );
};

window.NowPage = NowPage;
