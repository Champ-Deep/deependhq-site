// HowIThink.jsx — punchy POV takes (3 real ones from data.js)

const HowIThink = () => {
  const takes = window.DH_DATA.takes;
  return (
    <section id="think" data-screen-label="how-i-think" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> How I think</div>
          <h2 className="dh-section-title">Short takes. No five-tip listicles.</h2>
        </div>
        <a className="dh-section-link" href="#essays">
          All essays
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
      </div>
      <div className="dh-takes">
        {takes.map((t, i) => (
          <article key={i} className={`dh-take dh-take-${t.color}`}>
            <div className={`dh-take-tag dh-take-tag-${t.color}`}>{t.tag}</div>
            <h3 className="dh-take-title">{t.title}</h3>
            <p className="dh-take-body">{t.hook}</p>
            <a className={`dh-take-link dh-take-link-${t.color}`} href="#">Read the long form →</a>
          </article>
        ))}
      </div>
    </section>
  );
};

window.HowIThink = HowIThink;
