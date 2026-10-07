// SignOff.jsx : the sitewide paper band, rendered above <Footer /> on the
// homepage and every React page. Identity kit v1, Oct 2026.
//
// It is the page's one paper band, so every page moves through the night and
// ends at sunrise. Marks and one line only, no prose block (density law). The
// wordmark is an SVG file, never live text, and the bare mare sits here
// because cream is the one ground her navy outline was drawn for. The tagline
// was retired on 7 Oct 2026 (Deep: it read as trying too hard). In the classic
// look the band goes dark, the wordmark is the old typed one and the mare is
// the sticker cut.
// 404.html, og.html and lead-scorer.html are static and do not get it.
// No em dashes.

const SignOff = () => (
  <section className="signoff band-paper mode-editorial" aria-label="Sign-off">
    <div className="signoff-in">
      <div className="signoff-marks">
        <img className="signoff-wm only-navy" src="brand/wordmark.svg" width="220" height="133" alt="Deep" loading="lazy" decoding="async" />
        <p className="signoff-wm-classic only-classic" aria-label="deep">deep<span className="gt" aria-hidden="true">&gt;_</span></p>
        <p className="signoff-line">That's the deep end.</p>
        <img className="signoff-mare only-navy" src="brand/mare.svg" width="124" height="140" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className="signoff-mare only-classic" src="brand/mare-sticker.svg" width="124" height="139" alt="" aria-hidden="true" loading="lazy" decoding="async" />
      </div>
      <div className="drops" aria-hidden="true" />
    </div>
    <div className="stripes" aria-hidden="true" />
  </section>
);

window.SignOff = SignOff;
