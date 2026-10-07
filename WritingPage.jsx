// WritingPage.jsx : /writing, the weekly narratives. Oct 2026.
// Full width. The newest essay leads with a large strip of the week it was
// written from; every other essay is a card with a small strip, the listen
// time, and whether the studio reading exists yet. The strips come from
// post.viz (scripts/derive-posts.mjs): one bar per day, coloured by what the
// log says the day was, height by how much the essay talks about it.
// No em dashes.

const WL_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const wlDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${WL_MONTHS[+m - 1]} ${+d}, ${y}`; };
const wlClock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const WLStrip = ({ p }) => {
  const v = p.viz || { days: [], para_days: [] };
  const counts = v.days.map((d) => v.para_days.filter((ds) => ds.includes(d.date)).length);
  const mx = Math.max(1, ...counts);
  return (
    <span className="wl-strip" aria-hidden="true">
      {v.days.slice(0, 7).map((d, k) => (
        <i key={d.date} className={d.day ? `arc-${d.arc_color || 'none'}` : 'is-empty'} style={{ '--h': d.day ? `${Math.round(25 + 75 * (counts[k] / mx))}%` : '0' }} />
      ))}
    </span>
  );
};

const WLListen = ({ p }) => (
  <span className="wl-listen">
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7-4.5z" fill="currentColor" /></svg>
    {p.audio ? `listen ${wlClock(p.audio.duration)}` : `listen, about ${p.viz ? p.viz.listen_min : 1} min`}
  </span>
);

const WritingPage = () => {
  const D = window.DH_DATA;
  const posts = (D.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const voiced = posts.filter((p) => p.audio).length;
  return (
    <main className="dh-page wl-page" id="main">
      <header className="wl-head">
        <p className="ep-eyebrow">the weekly narratives</p>
        <h1 className="wl-title">Writing.</h1>
        <p className="wl-sub">One essay a week, written from the log. Every one has the week behind it, a listen button and Ask AI links on the page.</p>
        <p className="wl-meta"><span>{posts.length} essays</span><span>{voiced} read aloud by an AI voice</span><a className="dh-link" href="journey.html">the daily log →</a></p>
        <a className="ep-pref" href="https://www.google.com/preferences/source?q=deependhq.com" target="_blank" rel="noopener noreferrer">
          <span className="ep-pref-star" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5 3.8 13.8l1-4.6L1.3 6l4.7-.5z" fill="currentColor" /></svg></span>
          <span><b>Add deependhq.com</b> as a preferred source on Google</span>
        </a>
      </header>

      {posts.length === 0
        ? <div className="bp-empty"><span className="dh-gt">&gt;_</span>nothing published yet.</div>
        : (
          <div className="wl-grid">
            {posts.map((p, k) => (
              <a key={p.slug} className={`wl-card${k === 0 ? ' is-lead' : ''}`} href={`post/${p.slug}`}>
                <p className="wl-k">{k === 0 && <b>latest</b>}<span>{p.week ? `week ${p.week}` : 'essay'}</span><span>{wlDate(p.date)}</span>{p.arc && <span>{p.arc}</span>}</p>
                <h2 className="wl-t">{p.title}</h2>
                {k === 0 && p.deck && <p className="wl-d">{p.deck}</p>}
                <WLStrip p={p} />
                <p className="wl-k"><WLListen p={p} /><span>{p.read} read</span>{p.viz && <span>{p.viz.entries} log entries that week</span>}</p>
              </a>
            ))}
          </div>
        )}
    </main>
  );
};

window.WritingPage = WritingPage;
