// Footer.jsx : the halftone wordmark footer mount plus its static fallback.
// Refresh plan section 10: Site / Elsewhere / the twelve (a link plus the
// three most recently shipped companies), the privacy sentence and the
// build-day line in the rule row with a live age.
//
// The <div data-island> below carries the complete reading in plain markup.
// islands/halftone-footer.island.jsx replaces it only when the bundle loads,
// so JS off, a failed bundle and every inner page all keep the same links and
// the same sentences. Every number is derived from data.js at build time.
// compact is accepted because app.jsx still passes it; the footer now has one
// shape on every page. No em dashes.

const SITE_LINKS = [
  { label: 'Home', href: 'index.html' },
  { label: 'Mission Log', href: 'journey.html' },
  { label: 'Writing', href: 'writing.html' },
  { label: 'Pillars', href: 'pillars.html' },
  { label: 'Stack', href: 'toolkit.html' },
  { label: 'Now', href: 'now.html' },
  { label: 'RSS', href: 'feed.xml' },
];

const ELSEWHERE_LINKS = [
  { label: 'github / Champ-Deep', href: 'https://github.com/Champ-Deep', external: true },
  { label: 'linkedin', href: 'https://www.linkedin.com/in/sreedeep-surapaneni', external: true },
  { label: 'bluesky', href: 'https://bsky.app/profile/sreedeep-sura.bsky.social', external: true },
  { label: 'book 30 minutes', href: 'https://scheduler.zoom.us/sreedeep', external: true },
  { label: 'deep@championsmail.com', href: 'mailto:deep@championsmail.com' },
];

// One short line, split only where the link sits, so the island can rebuild
// exactly what the fallback prints. The full account (what the site and the
// Ask Deep chat record, the dh_vid cookie, retention) lives on /privacy.
const PRIVACY = [
  { t: '© 2026 Sreedeep Surapaneni · no ad networks, no third-party analytics. What this site and Ask Deep record, and for how long: ' },
  { t: '/privacy', href: '/privacy' },
];

// Build age: derived from the build stamp, never typed, and recomputed in the
// visitor's browser by the island. Past 21 days the page is stale and says so.
const ago = (iso) => {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return '';
  const d = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
};

const isStale = (iso) => {
  const t = Date.parse(iso || '');
  return !Number.isNaN(t) && Date.now() - t > 21 * 86400000;
};

const ext = (l) => (l.external ? { target: '_blank', rel: 'noreferrer' } : {});

const Footer = () => {
  const D = window.DH_DATA;
  const newest = D.journey && D.journey[0];
  const builtIso = D.built || null;
  const builtLabel = builtIso
    ? new Date(builtIso).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      })
    : '';
  const day = newest ? newest.day : null;
  const stale = isStale(builtIso);

  // the twelve: one link to the doors, plus the three companies whose newest
  // log entry is the freshest. Derived from related_journey, never typed.
  const shipped = (D.companies || [])
    .map((c) => ({ label: c.label || c.name, href: `company/${c.slug}`, day: (c.related_journey || [])[0]?.day || 0 }))
    .filter((c) => c.day)
    .sort((a, b) => b.day - a.day)
    .slice(0, 3);

  const twelve = [
    { label: 'the twelve →', href: 'pillars.html#ecosystem' },
    ...shipped.map((c) => ({ label: c.label, href: c.href })),
  ];

  const columns = [
    { title: 'Site', links: SITE_LINKS },
    { title: 'Elsewhere', links: ELSEWHERE_LINKS },
    { title: 'The twelve', links: twelve },
  ];

  const dayLine = `${day ? `day ${day} of building in public · ` : ''}built ${builtLabel}${
    builtLabel ? ` (${ago(builtIso)})` : ''
  }`;

  const islandProps = {
    wordmark: 'deep_',
    label: 'Sreedeep Surapaneni',
    meta: 'Champions Group · Bangalore',
    columns,
    privacy: PRIVACY,
    day,
    builtLabel,
    builtIso,
    grain: 0.35,
  };

  return (
    <footer className="sys-footer sys mode-operator" aria-label="footer">
      <div data-island="halftone-footer" data-props={JSON.stringify(islandProps)}>
        <div className="wrap">
          <div className="foot-grid">
            {columns.map((col) => (
              <div className="foot-col" key={col.title}>
                <h4>{col.title}</h4>
                {col.links.map((l) => (
                  <a key={l.label} href={l.href} {...ext(l)}>
                    {l.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
          <div className="foot-bottom">
            <img src="favicon.svg" width="32" height="32" alt="Deep's scouter mark" />
            <span className="foot-id">
              {PRIVACY.map((s, i) =>
                s.href ? (
                  <a className="foot-inline" key={i} href={s.href}>
                    {s.t}
                  </a>
                ) : (
                  <React.Fragment key={i}>{s.t}</React.Fragment>
                )
              )}
            </span>
            <span className="foot-day" data-state={stale ? 'stale' : 'fresh'}>
              {dayLine}
            </span>
          </div>

        </div>
      </div>
    </footer>
  );
};

window.Footer = Footer;
