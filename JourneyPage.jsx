// JourneyPage.jsx — full /journey feed, filter by arc.

const { useState: useStateJ } = React;

// Mood-ring strip — a 28-day visual of arc colors, newest at right.
// Derives from real entries; fills missing days with quiet "no entry" cells.
const WeekStrip = ({ entries }) => {
  const today = entries[0]?.day || 0;
  const span = 28;
  const map = {};
  for (const e of entries) map[e.day] = e;
  const cells = [];
  for (let i = span - 1; i >= 0; i--) {
    const d = today - i;
    const e = map[d];
    cells.push({ day: d, entry: e });
  }
  return (
    <div className="dh-strip">
      <div className="dh-strip-head">
        <span className="dh-mono dh-muted">last 28 days · mood ring</span>
        <span className="dh-mono dh-muted">→ today</span>
      </div>
      <div className="dh-strip-cells">
        {cells.map((c) => (
          <div
            key={c.day}
            className={`dh-strip-cell ${c.entry ? `dh-strip-${c.entry.arc_color}` : 'dh-strip-empty'} ${c.day === today ? 'is-today' : ''}`}
            title={c.entry ? `day ${c.day} · ${c.entry.shipping_now}` : `day ${c.day} · nothing logged`}
          >
            {c.entry && <span className="dh-strip-mood">{c.entry.mood}</span>}
          </div>
        ))}
      </div>
      <div className="dh-strip-legend">
        <span><span className="dh-strip-key dh-strip-green" />building</span>
        <span><span className="dh-strip-key dh-strip-blue" />thinking</span>
        <span><span className="dh-strip-key dh-strip-gold" />winning</span>
        <span><span className="dh-strip-key dh-strip-empty" />silent</span>
      </div>
    </div>
  );
};

const JourneyPage = () => {
  const [filter, setFilter] = useStateJ('all');
  const entries = window.DH_DATA.journey;

  // Collect every unique story-arc tag in the data, preserving order of first appearance.
  const allArcs = [];
  for (const e of entries) for (const a of e.arcs) if (!allArcs.includes(a)) allArcs.push(a);

  const filtered = filter === 'all'
    ? entries
    : entries.filter((e) => e.arcs.includes(filter));

  return (
    <main className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> The journey</div>
        <h1 className="dh-page-title">The Journey.</h1>
        <p className="dh-page-sub">Day by day. Build by build. The receipts behind the hero line.</p>
        <div className="dh-page-meta">
          <span className="dh-mono">{entries.length} entries shown</span>
          <span className="dh-dot-sep">·</span>
          <span className="dh-mono">latest: day {entries[0].day}</span>
          <span className="dh-dot-sep">·</span>
          <span className="dh-mono">first entry: day 1 · Nov 1, 2025</span>
          <span className="dh-dot-sep">·</span>
          <a className="dh-link" href="field-notes.html">Field notes →</a>
        </div>
      </header>

      <WeekStrip entries={entries} />

      <div className="dh-filter-bar">
        <button
          className={`dh-filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >All arcs</button>
        {allArcs.map((a) => (
          <button
            key={a}
            className={`dh-filter-pill ${filter === a ? 'active' : ''}`}
            onClick={() => setFilter(a)}
          >{a}</button>
        ))}
      </div>

      <div className="dh-feed dh-feed-page">
        {filtered.map((e) => <JourneyEntry key={e.day} entry={e} />)}
      </div>

      {filtered.length === 0 && (
        <div className="dh-empty">
          <span className="dh-gt">&gt;_</span>
          <span>nothing on the {filter} arc yet.</span>
        </div>
      )}
    </main>
  );
};

window.JourneyPage = JourneyPage;
