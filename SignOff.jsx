// SignOff.jsx : the sitewide paper band, rendered above <Footer /> on the
// homepage and every React page. Identity kit v1, Oct 2026.
//
// It is the page's one paper band, so every page moves through the night and
// ends at sunrise. Marks and one line only, no prose block (density law). The
// wordmark is an SVG file, never live text, and the bare mare sits here
// because cream is the one ground her navy outline was drawn for. The tagline
// was retired on 7 Oct 2026 (Deep: it read as trying too hard). In the classic
// look the band goes dark, the brandmark and the wordmark SVG sign it off and
// the mare is the sticker cut.
// 404.html, og.html and lead-scorer.html are static and do not get it.
// No em dashes.

const SignOff = () => (
  <section className="signoff band-paper mode-editorial" aria-label="Sign-off">
    <div className="signoff-in">
      <div className="signoff-marks">
        <p className="signoff-wm-classic"><img src="brand/brandmark.svg" width="56" height="56" alt="" /><img className="signoff-wordmark" src="brand/wordmark.svg" width="119" height="72" alt="Deep" /></p>
        <p className="signoff-line">That's the deep end.</p>
        <img className="signoff-mare" src="brand/mare-sticker.svg" width="124" height="139" alt="" aria-hidden="true" loading="lazy" decoding="async" />
      </div>
      <div className="drops" aria-hidden="true" />
    </div>
    <div className="stripes" aria-hidden="true" />
  </section>
);

window.SignOff = SignOff;
