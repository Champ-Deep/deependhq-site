// SignOff.jsx : the sitewide paper band, rendered above <Footer /> on the
// homepage and every React page. Identity kit v1, Oct 2026.
//
// It is the page's one paper band, so every page moves through the night and
// ends at sunrise. Marks and one line only, no prose block (density law). The
// wordmark and the tagline are SVG files, never live text, and the bare mare
// sits here because cream is the one ground her navy outline was drawn for.
// 404.html, og.html and lead-scorer.html are static and do not get it.
// No em dashes.

const SignOff = () => (
  <section className="signoff band-paper mode-editorial" aria-label="Sign-off">
    <div className="signoff-in">
      <div className="signoff-marks">
        <img className="signoff-wm" src="brand/wordmark.svg" width="220" height="133" alt="Deep" loading="lazy" decoding="async" />
        <img className="signoff-tag" src="brand/tagline.svg" width="280" height="154" alt="Go deep. Stay lit." loading="lazy" decoding="async" />
        <img className="signoff-mare" src="brand/mare.svg" width="124" height="140" alt="" aria-hidden="true" loading="lazy" decoding="async" />
      </div>
      <div className="signoff-row">
        <div className="drops" aria-hidden="true" />
        <p className="signoff-line">That's the deep end.</p>
      </div>
    </div>
    <div className="stripes" aria-hidden="true" />
  </section>
);

window.SignOff = SignOff;
