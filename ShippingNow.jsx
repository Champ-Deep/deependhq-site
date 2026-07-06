// ShippingNow.jsx — homepage preview of the latest 3 journey entries.
// Reuses the JourneyEntry component (defined alongside).

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
};

const JourneyEntry = ({ entry, dense = false }) => (
  <article className={`dh-entry dh-arc-${entry.arc_color}`}>
    <div className="dh-entry-body">
      <div className="dh-entry-row-top">
        <span className={`dh-day dh-day-${entry.arc_color}`}>DAY {entry.day}</span>
        <span className="dh-entry-date">{formatDate(entry.date)}</span>
      </div>
      <div className="dh-entry-ship"><span className="dh-gt">&gt;_</span>{entry.shipping_now}</div>
      {!dense && entry.yesterday_thread && (
        <div className="dh-entry-thread"><em>{entry.yesterday_thread}</em></div>
      )}
      {!dense && entry.raw_thought && (
        <div className="dh-entry-thought">{entry.raw_thought}</div>
      )}
      <div className="dh-entry-tags">
        {entry.arcs.map((a) => {
          const link = (entry.company_links || []).find((l) => l.arc === a && l.slug);
          const cls = `dh-pill dh-pill-${entry.arc_color}`;
          return link
            ? <a key={a} className={cls} href={`company.html?slug=${encodeURIComponent(link.slug)}`}>{a}</a>
            : <span key={a} className={cls}>{a}</span>;
        })}
      </div>
    </div>
    <div className="dh-entry-side">
      <span className="dh-mood" title="mood">{entry.mood}</span>
    </div>
  </article>
);

window.JourneyEntry = JourneyEntry;

const ShippingNow = () => {
  const entries = window.DH_DATA.journey.slice(0, 3);
  return (
    <section id="now" data-screen-label="shipping-now" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> Shipping now</div>
          <h2 className="dh-section-title">What's on the build queue today.</h2>
        </div>
        <a className="dh-section-link" href="journey.html">
          Full journey
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
      </div>
      <div className="dh-feed">
        {entries.map((e) => <JourneyEntry key={e.day} entry={e} />)}
      </div>
    </section>
  );
};

window.ShippingNow = ShippingNow;
