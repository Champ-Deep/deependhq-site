// Nav.jsx — sticky top, blurred Gotham, Matrix-green active link
// Multi-page: links resolve to file paths (index.html, journey.html, etc.)

const Nav = ({ active = 'now' }) => {
  const links = [
    { id: 'command',    label: 'Command',     href: 'command.html' },
    { id: 'now',        label: 'Now',         href: 'index.html#now' },
    { id: 'journey',    label: 'Journey',     href: 'journey.html' },
    { id: 'field-notes',label: 'Field Notes', href: 'field-notes.html' },
    { id: 'toolkit',    label: 'Toolkit',     href: 'toolkit.html' },
  ];

  const [open, setOpen] = React.useState(false);

  const onLinkClick = (e, l) => {
    // If we are linking to a section on the current page (index.html#now),
    // smooth-scroll instead of navigating.
    if (l.href.startsWith('index.html#') && (location.pathname.endsWith('index.html') || location.pathname.endsWith('/website/') || location.pathname.endsWith('/'))) {
      const id = l.href.split('#')[1];
      const el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    }
  };

  return (
    <nav className="dh-nav">
      <a className="dh-logo" href="index.html">
        <span className="dh-logo-word">deep</span>
        <span className="dh-logo-gt">&gt;_</span>
      </a>
      <div className="dh-nav-links" data-open={open}>
        {links.map((l) => (
          <a
            key={l.id}
            href={l.href}
            className={`dh-nav-link ${active === l.id ? 'active' : ''}`}
            onClick={(e) => onLinkClick(e, l)}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div className="dh-nav-actions">
        <a href="#book" className="dh-btn dh-btn-primary dh-btn-sm"
           onClick={(e) => {
             e.preventDefault();
             window.open('https://scheduler.zoom.us/sreedeep', '_blank');
           }}>
          Book a call
        </a>
        <button className="dh-nav-burger" aria-label="menu" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </nav>
  );
};

window.Nav = Nav;
