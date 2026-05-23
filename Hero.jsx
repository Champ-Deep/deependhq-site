// Hero.jsx — the Signal. One line. One CTA.

const HERO_ROTATIONS = [
  'shipping the design system for deependhq.com',
  'onboarding 20 growth marketers across four brands',
  'red-lining the EU-India OCM partnership',
  'rewriting the AI SDR knowledge graph schema',
  'making a sambar that doesn\'t taste like soup',
];

const Hero = ({ onBook }) => {
  const D = window.DH_DATA;
  const [rot, setRot] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setRot((r) => (r + 1) % HERO_ROTATIONS.length), 3400);
    return () => clearInterval(t);
  }, []);
  return (
    <section id="hero" data-screen-label="hero" className="dh-hero">
      <div className="dh-hero-inner">
        <div className="dh-hero-eyebrow">
          <span className="dh-dot" />
          Building in public · {D.brand.location} · day {D.brand.today_day}
        </div>
        <h1 className="dh-hero-title">
          Past the hype cycle.<br/>
          <span className="dh-hero-emph">Into the infrastructure.</span>
          <span className="dh-cursor" aria-hidden="true" />
        </h1>
        <p className="dh-hero-sub">
          Group CMO running marketing and product across 12 companies. A public operating system from someone shipping code between meetings.
        </p>

        <div className="dh-hero-rot" aria-live="polite">
          <span className="dh-hero-rot-key">today</span>
          <span className="dh-hero-rot-gt">&gt;_</span>
          <span key={rot} className="dh-hero-rot-val">{HERO_ROTATIONS[rot]}<span className="dh-hero-rot-cursor" /></span>
        </div>

        <div className="dh-hero-cta">
          <button className="dh-btn dh-btn-primary" onClick={onBook}>
            Book a call
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <a className="dh-btn dh-btn-ghost" href="#now"
             onClick={(e) => { e.preventDefault(); document.getElementById('now')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            See what's shipping
          </a>
        </div>
      </div>
      <div className="dh-hero-bottom">
        <div className="dh-hero-stat">
          <span className="dh-stat-num">12</span>
          <span className="dh-stat-lab">companies in motion</span>
        </div>
        <div className="dh-hero-stat">
          <span className="dh-stat-num">{D.brand.today_day}</span>
          <span className="dh-stat-lab">days building in public</span>
        </div>
        <div className="dh-hero-stat">
          <span className="dh-stat-num">{D.weekly_narratives_count}</span>
          <span className="dh-stat-lab">weekly narratives shipped</span>
        </div>
      </div>
    </section>
  );
};

window.Hero = Hero;
