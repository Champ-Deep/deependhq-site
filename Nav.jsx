// Floating Dock, adapted from 21st.dev/manuarora700, demo 18014.
// Native disclosure keeps navigation usable before hydration and without JS.
const NAV_LINKS = [
  { id: 'journey', label: 'Mission Log', href: 'journey.html', icon: 'horseshoe' },
  { id: 'writing', label: 'Writing',     href: 'writing.html', icon: 'book' },
  { id: 'pillars', label: 'Pillars',     href: 'pillars.html', icon: 'crown' },
  { id: 'toolkit', label: 'Toolkit',     href: 'toolkit.html', icon: 'prompt' },
  { id: 'now',     label: 'Now',         href: 'now.html', icon: 'diya' },
];

const Nav = ({ active = 'home' }) => {
  const cur = (id) => (active === id ? 'page' : undefined);
  return (
    <React.Fragment>
      <a className="skip" href="#main">skip to content</a>
      <nav className="v3-dock" aria-label="Primary">
        <a className="v3-dock-home" href="index.html" aria-current={cur('home')} aria-label="Deep, home"><img src="brand/brandmark.svg" width="28" height="28" alt="" /><span>Deep</span></a>
        <span className="v3-dock-sep" aria-hidden="true" />
        <div className="v3-dock-links">
          {NAV_LINKS.map((l) => <a key={l.id} href={l.href} aria-current={cur(l.id)}><svg className="ico v3-dock-symbol" width="24" height="24" aria-hidden="true" focusable="false"><use href={`brand/icons.svg#i-${l.icon}`} /></svg><span>{l.label}</span></a>)}
        </div>
        <details className="v3-dock-mobile" onKeyDown={(e) => { if (e.key === 'Escape') { e.currentTarget.open = false; e.currentTarget.querySelector('summary').focus(); } }}>
          <summary>Explore <span aria-hidden="true">↑</span></summary>
          <div className="v3-dock-menu">
            {NAV_LINKS.map((l) => <a key={l.id} href={l.href} aria-label={l.label} aria-current={cur(l.id)}>{l.label}</a>)}
          </div>
        </details>
        <span className="v3-dock-sep" aria-hidden="true" />
        <div className="v3-dock-actions">
          <a href="https://toolkit.deependhq.com/sign-in" className="v3-dock-login">Login</a>
          <a href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noopener noreferrer" className="btn btn-gold">Book a Call</a>
        </div>
      </nav>
      {window.Sys && <window.Sys.StaleBanner />}
    </React.Fragment>
  );
};

window.Nav = Nav;
