// SecondCTA.jsx — the Pull. Weekly narrative teaser + closing CTA.

const SecondCTA = ({ onBook }) => {
  const D = window.DH_DATA;
  const n = D.latest_narrative;
  return (
    <section id="book" data-screen-label="second-cta" className="dh-section dh-section-pull">
      <div className="dh-pull-grid">
        <article className="dh-pull-narrative">
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> Latest weekly narrative</div>
          <h3 className="dh-pull-narr-title">{n.title}</h3>
          <p className="dh-pull-narr-body">{n.body}</p>
          <div className="dh-pull-narr-meta">
            <span>{n.date}</span>
            <span className="dh-dot-sep">·</span>
            <span>{n.read}</span>
            <span className="dh-dot-sep">·</span>
            <span>{n.day_range}</span>
            <span className="dh-dot-sep">·</span>
            <span>week {n.week} of {D.weekly_narratives_count}</span>
          </div>
          <a className="dh-link" href="#">Read the narrative →</a>
        </article>
        <aside className="dh-pull-cta">
          <h3 className="dh-pull-title">Want 30 minutes?</h3>
          <p className="dh-pull-sub">
            For founders and operators thinking past the hype cycle. No discovery calls. No sales decks. A real conversation.
          </p>
          <button className="dh-btn dh-btn-primary dh-btn-lg" onClick={onBook}>
            Book a call
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="dh-pull-cta-foot">
            <span className="dh-mono dh-muted">{D.brand.booking_url}</span>
          </div>
        </aside>
      </div>
    </section>
  );
};

window.SecondCTA = SecondCTA;
