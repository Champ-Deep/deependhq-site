// Source ports from 21st.dev/felipemenezes098/hero-05 and Kokonut UI WidgetGrid.
// Installed originals and adaptation notes: docs/verification/editorial-v5.
(() => {
  // Hero05's tagline / header / media composition, rendered at build time.
  const Hero05 = ({ tagline, title, description, actions, media }) => (
    <section className="v5-hero mode-editorial" id="top" aria-labelledby="wx-hero-h">
      <div className="v5-hero-copy">
        <div className="v5-hero-tagline">{tagline}</div>
        <div className="v5-hero-header"><h1 id="wx-hero-h">{title}</h1><div className="v5-hero-bottom">{description}{actions}</div></div>
      </div>
      {media && <div className="v5-hero-media">{media}</div>}
    </section>
  );
  // @dorianbaffier, Kokonut UI, MIT. Item/title/render API without the drag engine.
  const WidgetCard = ({ item, index }) => (
    <li className={`v5-widget v5-widget-${index}`}>
      <div className="v5-widget-title"><span>{item.title}</span><span aria-hidden="true">↗</span></div>
      <div className="v5-widget-body">{item.render(index < 2 ? 'm' : 's')}</div>
    </li>
  );
  window.V5Components = { Hero05, WidgetCard };
})();
