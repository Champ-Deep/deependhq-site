// Rail.jsx — shared context-rail utilities for the content-aware layout.
// Used by field-notes, toolkit, and now pages. Journey implements its own
// richer rail in JourneyPage.jsx.

const { useState: useStateR, useEffect: useEffectR } = React;

// scroll progress 0-100
window.useScrollProgress = () => {
  const [p, setP] = useStateR(0);
  useEffectR(() => {
    const f = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    window.addEventListener('scroll', f, { passive: true });
    f();
    return () => window.removeEventListener('scroll', f);
  }, []);
  return p;
};

// scrollspy over section ids -> active id
window.useScrollSpy = (ids) => {
  const [active, setActive] = useStateR(ids[0]);
  useEffectR(() => {
    const f = () => {
      const probe = window.innerHeight * 0.3;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener('scroll', f, { passive: true });
    f();
    return () => window.removeEventListener('scroll', f);
  }, [ids.join(',')]);
  return active;
};

window.RailProgress = ({ label }) => {
  const p = window.useScrollProgress();
  return (
    <div className="dh-rail-block">
      <p className="dh-rail-k">{label || 'Reading position'}</p>
      <div className="dh-rail-progress">
        <span className="dh-rail-progress-track"><span className="dh-rail-progress-fill" style={{ width: `${p}%` }} /></span>
        <span className="dh-rail-progress-pct">{Math.round(p)}%</span>
      </div>
    </div>
  );
};

window.RailToc = ({ items, active, onJump }) => (
  <div className="dh-rail-block">
    <p className="dh-rail-k">On this page</p>
    <ul className="dh-rail-nav">
      {items.map((it) => (
        <li key={it.id}>
          <a
            href={`#${it.id}`}
            className={active === it.id ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); (onJump || ((id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })))(it.id); }}
          >
            {it.label}
            {it.count != null && <span className="dh-rail-count">{it.count}</span>}
          </a>
        </li>
      ))}
    </ul>
  </div>
);
