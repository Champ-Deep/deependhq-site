// Ecosystem.jsx — the 12 real companies.

const Ecosystem = () => {
  const companies = window.DH_DATA.companies;
  return (
    <section id="ecosystem" data-screen-label="ecosystem" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> The ecosystem</div>
          <h2 className="dh-section-title">Twelve companies. One operator.</h2>
          <p className="dh-section-sub">Scope, not bragging. Each one earns its place in the vault.</p>
        </div>
      </div>
      <div className="dh-companies">
        {companies.map((c) => (
          <a key={c.name} className="dh-company" href={c.url || '#'} target={c.url ? '_blank' : undefined} rel={c.url ? 'noreferrer' : undefined} onClick={(e) => { if (!c.url) e.preventDefault(); }}>
            <div className="dh-company-head">
              <h3 className="dh-company-name">{c.name}</h3>
              <span className="dh-company-arrow">↗</span>
            </div>
            <p className="dh-company-desc">{c.desc}</p>
            <div className="dh-company-foot">
              <span className="dh-pill dh-pill-gold">{c.tag}</span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};

window.Ecosystem = Ecosystem;
