// Footer.jsx : compact operator footer. Every number here is derived at build
// time (data.built, journey) or is real personal content (off hours, rolodex).
// The old footer carried a hand-typed version pill, a build number and a
// "47 days online" that never changed. None of that survives.

const Footer = () => {
  const D = window.DH_DATA;
  const S = window.Sys;
  const newest = D.journey && D.journey[0];
  const built = D.built ? new Date(D.built) : null;
  const builtLabel = built ? built.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : null;
  return (
    <footer className="sys-footer sys mode-operator" aria-label="footer">
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-col">
            <h4>site</h4>
            <a href="index.html">Home</a>
            <a href="journey.html">Mission Log</a>
            <a href="writing.html">Writing</a>
            <a href="index.html#ecosystem">Pillars</a>
            <a href="toolkit.html">Stack</a>
            <a href="command.html">Command</a>
            <a href="now.html">Now</a>
            <a href="feed.xml">RSS</a>
          </div>
          <div className="foot-col">
            <h4>elsewhere</h4>
            <a href="https://github.com/Champ-Deep" target="_blank" rel="noreferrer">github / Champ-Deep ↗</a>
            <a href="https://www.linkedin.com/in/sreedeep-surapaneni" target="_blank" rel="noreferrer">linkedin ↗</a>
            <a href="https://bsky.app/profile/sreedeep-sura.bsky.social" target="_blank" rel="noreferrer">bluesky ↗</a>
            <a href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noopener noreferrer">book 30 minutes ↗</a>
            <a className="foot-mail" href="mailto:deep@championsmail.com">deep@championsmail.com</a>
          </div>
          <div className="foot-col">
            <h4>off the clock</h4>
            {(D.off_hours || []).map((o) => <span key={o.what} className="i"><b>{o.what}.</b> {o.detail}</span>)}
          </div>
          <div className="foot-col">
            <h4>DMs I answer</h4>
            {(D.rolodex || []).map((r) => <span key={r.who} className="i"><b>{r.who}</b> · {r.how}</span>)}
          </div>
          <div className="foot-col">
            <h4>the twelve</h4>
            {(D.companies || []).map((c) => <a key={c.slug} href={`company.html?slug=${encodeURIComponent(c.slug)}`}>{c.name}</a>)}
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Sreedeep Surapaneni · Champions Group · no cookies, no trackers</span>
          <span>{newest ? `day ${newest.day} of building in public` : ''}{builtLabel ? ` · built ${builtLabel}` : ''}</span>
          <span>no-build React · Cloudflare Workers · publishes itself nightly · press ⌘K</span>
        </div>
      </div>
    </footer>
  );
};

window.Footer = Footer;
