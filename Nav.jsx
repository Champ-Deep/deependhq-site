// Nav.jsx : sticky top bar, shared by every page. Sep 2026 system.
// Order is the reading order of the site: the log first, then what it is
// built with, then the essays, then the operator view.

// Five items, one line at 1024. "Pillars" points at the homepage ecosystem
// section until /pillars ships in sprint 2, then it becomes pillars.html.
const NAV_LINKS = [
  { id: 'journey', label: 'Mission Log', href: 'journey.html' },
  { id: 'writing', label: 'Writing',     href: 'writing.html' },
  { id: 'pillars', label: 'Pillars',     href: 'index.html#ecosystem' },
  { id: 'toolkit', label: 'Stack',       href: 'toolkit.html' },
  { id: 'now',     label: 'Now',         href: 'now.html' },
];

const Nav = ({ active = 'home' }) => {
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const cur = (id) => (active === id ? 'page' : undefined);
  return (
    <React.Fragment>
      <a className="skip" href="#main">skip to content</a>
      <nav className="sys-nav sys" aria-label="primary">
        <div className="wrap">
          <a className="brand" href="index.html" aria-current={cur('home')} aria-label="deep, home">
            <span>deep</span><span className="gt">&gt;_</span>
          </a>
          <div className="nav-links">
            {NAV_LINKS.map((l) => <a key={l.id} href={l.href} aria-current={cur(l.id)}>{l.label}</a>)}
          </div>
          <div className="nav-right">
            <a href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ minHeight: 40, padding: '0 16px', fontSize: 'var(--text-sm)' }}>Book a call</a>
            <button className="nav-burger" aria-label={open ? 'close menu' : 'open menu'} aria-expanded={open} aria-controls="nav-drawer" onClick={() => setOpen(!open)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round"/>}
              </svg>
            </button>
          </div>
        </div>
        <div id="nav-drawer" className="nav-drawer" data-open={open}>
          <a href="index.html" aria-current={cur('home')}>Home</a>
          {NAV_LINKS.map((l) => <a key={l.id} href={l.href} aria-current={cur(l.id)}>{l.label}</a>)}
        </div>
      </nav>
      {window.Sys && <window.Sys.StaleBanner />}
    </React.Fragment>
  );
};

window.Nav = Nav;
