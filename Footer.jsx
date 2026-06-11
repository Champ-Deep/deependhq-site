// Footer.jsx — the big quirky footer with personality.
// Multiple sections, each with its own terminal-style header. The signoff is the show.

const FooterHeader = ({ slug, label }) => (
  <div className="dh-fh-head">
    <span className="dh-fh-gt">&gt;_</span>
    <span className="dh-fh-slug">{slug}</span>
    {label && <span className="dh-fh-label">{label}</span>}
  </div>
);

// Tiny inline ASCII art for the giant `>_` signoff at the bottom.
const SignoffArt = () => (
<pre className="dh-foot-art" aria-hidden="true">{
`     _                          
  __| | ___  ___ _ __       __    
 / _\` |/ _ \\/ _ \\ '_ \\    /  \\   
| (_| |  __/  __/ |_) |  >    <   
 \\__,_|\\___|\\___| .__/    \\__/   
                |_|`
}</pre>
);

const Footer = () => {
  const D = window.DH_DATA;
  const s = D.status;

  return (
    <footer className="dh-footer-x" aria-label="footer">

      {/* Big opening line. The "if you made it this far" energy. */}
      <div className="dh-foot-lede">
        <FooterHeader slug="// if you scrolled this far" label="01" />
        <h2 className="dh-foot-lede-line">
          You're either a founder, a friend, or a recruiter.<br/>
          <span className="dh-foot-lede-emph">All three get the same email address.</span>
        </h2>
        <a className="dh-foot-mailto" href="mailto:deep@championsmail.com">
          <span className="dh-gt">&gt;_</span>
          <span className="dh-foot-mail">deep@championsmail.com</span>
          <span className="dh-foot-mail-copy">copy ⌘</span>
        </a>
      </div>

      {/* Four-column quirky grid. */}
      <div className="dh-foot-grid">

        {/* /now */}
        <section className="dh-foot-col">
          <FooterHeader slug="./now" label="02" />
          <ul className="dh-foot-kv">
            <li><span className="dh-foot-k">where</span><span className="dh-foot-v">{s.location}</span></li>
            <li><span className="dh-foot-k">clock</span><span className="dh-foot-v dh-mono">{s.time_ist}</span></li>
            <li><span className="dh-foot-k">last shipped</span><span className="dh-foot-v">{s.last_ship}</span></li>
            <li><span className="dh-foot-k">listening</span><span className="dh-foot-v">{s.listening}</span></li>
            <li><span className="dh-foot-k">reading</span><span className="dh-foot-v">{s.reading}</span></li>
            <li><span className="dh-foot-k">drinking</span><span className="dh-foot-v">{s.drinking}</span></li>
            <li className="dh-foot-kv-status">
              <span className="dh-foot-k">state</span>
              <span className="dh-foot-v dh-foot-v-green"><span className="dh-foot-pulse" />{s.state}</span>
            </li>
          </ul>
        </section>

        {/* /off-hours */}
        <section className="dh-foot-col">
          <FooterHeader slug="./off-hours" label="03" />
          <p className="dh-foot-cap">When the laptop closes.</p>
          <ul className="dh-foot-stack">
            {D.off_hours.map((o) => (
              <li key={o.what} className="dh-foot-off">
                <span className="dh-foot-off-what">{o.what}</span>
                <span className="dh-foot-off-detail">{o.detail}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* /the-rolodex */}
        <section className="dh-foot-col">
          <FooterHeader slug="./the-rolodex" label="04" />
          <p className="dh-foot-cap">DMs I will actually answer.</p>
          <ul className="dh-foot-stack">
            {D.rolodex.map((r) => (
              <li key={r.who} className="dh-foot-rolo">
                <span className="dh-foot-rolo-who">{r.who}</span>
                <span className="dh-foot-rolo-arrow">→</span>
                <span className="dh-foot-rolo-how">{r.how}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* /sitemap */}
        <section className="dh-foot-col">
          <FooterHeader slug="./sitemap" label="05" />
          <p className="dh-foot-cap">The actual links, for completeness.</p>
          <div className="dh-foot-sitemap">
            <div className="dh-foot-smcol">
              <span className="dh-foot-sm-h">site</span>
              <a href="index.html">Home</a>
              <a href="now.html">Now</a>
              <a href="journey.html">Journey</a>
              <a href="writing.html">Writing</a>
              <a href="field-notes.html">Field notes</a>
              <a href="toolkit.html">Toolkit</a>
              <a href="#dispatch">The dispatch</a>
            </div>
            <div className="dh-foot-smcol">
              <span className="dh-foot-sm-h">elsewhere</span>
              <a href="https://github.com/Champ-Deep" target="_blank" rel="noreferrer">github.com/Champ-Deep ↗</a>
              <a href="https://www.linkedin.com/in/sreedeep-surapaneni" target="_blank" rel="noreferrer">linkedin/sreedeep-surapaneni ↗</a>
              <a href="https://bsky.app/profile/sreedeep-sura.bsky.social" target="_blank" rel="noreferrer">bsky/sreedeep-sura ↗</a>
              <a href="https://calendly.com/deep-championsmail" target="_blank" rel="noreferrer">calendly/deep ↗</a>
              <a href="#">RSS · /feed.xml</a>
            </div>
            <div className="dh-foot-smcol">
              <span className="dh-foot-sm-h">in the ecosystem</span>
              <a href="#">Lake B2B ↗</a>
              <a href="#">Champions Accelerator ↗</a>
              <a href="#">Ampliz ↗</a>
              <a href="#">+9 more ↗</a>
            </div>
          </div>
        </section>
      </div>

      {/* Colophon strip — one-liner of the tech */}
      <div className="dh-foot-colophon">
        <FooterHeader slug="./colophon" label="06" />
        <p className="dh-foot-colophon-line">
          Built with <span className="dh-foot-tag">no-build React</span>
          <span className="dh-foot-plus">+</span>
          <span className="dh-foot-tag">Cloudflare</span>
          <span className="dh-foot-plus">+</span>
          <span className="dh-foot-tag">an AI that ships nightly</span>
          <span className="dh-foot-plus">+</span>
          <span className="dh-foot-tag">Anthropic</span>
          <span className="dh-foot-plus">+</span>
          <span className="dh-foot-tag">Obsidian</span>
          <span className="dh-foot-plus">+</span>
          <span className="dh-foot-tag">a lot of coffee</span>
          <span className="dh-foot-plus">·</span>
          <span className="dh-mono dh-muted">no cookies, no trackers, no AI gradients</span>
        </p>
      </div>

      {/* The big ASCII signoff */}
      <div className="dh-foot-signoff">
        <SignoffArt />
        <div className="dh-foot-signoff-meta">
          <div className="dh-foot-tags">
            <span className="dh-pill dh-pill-muted">v0.7.3</span>
            <span className="dh-pill dh-pill-green">build #1947</span>
            <span className="dh-pill dh-pill-blue">47 days online</span>
            <span className="dh-pill dh-pill-gold">day {D.brand.today_day} of building in public</span>
          </div>
          <div className="dh-foot-quote">
            <span className="dh-mono dh-muted">// no em-dashes were harmed in the making of this site.</span>
          </div>
        </div>
      </div>

      {/* Bottom rule */}
      <div className="dh-foot-bottom">
        <span className="dh-mono dh-muted">© 2026 · Gotham Workshop · Champions Group</span>
        <span className="dh-mono dh-muted">made in Bangalore, between meetings</span>
        <span className="dh-mono dh-muted">EOF.</span>
      </div>

    </footer>
  );
};

window.Footer = Footer;
