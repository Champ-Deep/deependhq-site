// CompanyPage.jsx — single company at company.html?slug=<slug>.
// Reads the slug from the query string, finds the company in DH_DATA.companies,
// and renders its journey cross-links, related writing, and products. The
// prominent external CTA is the deliberate "go see their real site" moment.

const fmtCoDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
};

// Compact journey card, styled off the homepage JourneyEntry visual language.
const CompanyJourneyCard = ({ entry }) => (
  <article className={`dh-entry dh-arc-${entry.arc_color || 'green'}`}>
    <div className="dh-entry-body">
      <div className="dh-entry-row-top">
        <span className={`dh-day dh-day-${entry.arc_color || 'green'}`}>DAY {entry.day}</span>
        <span className="dh-entry-date">{fmtCoDate(entry.date)}</span>
      </div>
      <div className="dh-entry-ship"><span className="dh-gt">&gt;_</span>{entry.shipping_now}</div>
    </div>
  </article>
);

const CompanyPage = () => {
  const D = window.DH_DATA;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const companies = D.companies || [];
  const company = companies.find((c) => c.slug === slug) || null;

  if (!company) {
    return (
      <main className="dh-page">
        <div className="bp-empty">
          <span className="dh-gt">&gt;_</span>company not found. <a className="dh-link" href="index.html#ecosystem">Back to the ecosystem →</a>
        </div>
      </main>
    );
  }

  document.title = `${company.name} · deep >_`;

  const journey = company.related_journey || [];
  const writing = company.related_writing || [];
  const products = company.products || [];

  return (
    <main className="dh-page">
      <article className="bp-page">
        <div className="bp-toprow">
          <a className="bp-back" href="index.html#ecosystem">&larr; the ecosystem</a>
        </div>

        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> In the ecosystem</div>
        <h1 className="bp-title">{company.name}</h1>
        <div className="bp-tags">
          <span className="dh-pill dh-pill-gold">{company.tag}</span>
        </div>
        {company.desc && <p className="bp-deck">{company.desc}</p>}

        {company.url && (
          <a className="dh-co-cta" href={company.url} target="_blank" rel="noreferrer">
            <span className="dh-co-cta-label">Check out {company.name}</span>
            <span className="dh-co-cta-arrow">↗</span>
          </a>
        )}

        {products.length > 0 && (
          <section className="dh-co-block">
            <h2 className="bp-h2">Products</h2>
            <div className="bp-tags">
              {products.map((p) => <span key={p} className="dh-pill dh-pill-muted">{p}</span>)}
            </div>
          </section>
        )}

        <section className="dh-co-block">
          <h2 className="bp-h2">In the journey</h2>
          {journey.length > 0 ? (
            <div className="dh-co-feed">
              {journey.map((e) => <CompanyJourneyCard key={e.day} entry={e} />)}
              <a className="dh-link dh-co-more" href="journey.html">All field notes →</a>
            </div>
          ) : (
            <div className="bp-empty"><span className="dh-gt">&gt;_</span>no field notes tagged to {company.name} yet.</div>
          )}
        </section>

        <section className="dh-co-block">
          <h2 className="bp-h2">Related writing</h2>
          {writing.length > 0 ? (
            <div className="dh-writing-list">
              {writing.map((w) => (
                <a key={w.slug} className="dh-writing-row" href={`post.html?slug=${encodeURIComponent(w.slug)}`}>
                  <div>
                    <h3 className="dh-writing-title">{w.title}</h3>
                  </div>
                  <div className="dh-writing-meta">
                    {fmtCoDate(w.date)}<br />
                    {w.read}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="bp-empty"><span className="dh-gt">&gt;_</span>no writing linked to {company.name} yet.</div>
          )}
        </section>
      </article>
    </main>
  );
};

window.CompanyPage = CompanyPage;
