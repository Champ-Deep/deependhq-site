// StatusBoard.jsx — Now / Recently / Soon. The disciplined kanban.

const StatusColumn = ({ title, slug, items, color, glyph }) => (
  <div className={`dh-sb-col dh-sb-${color}`}>
    <div className="dh-sb-head">
      <span className={`dh-sb-glyph dh-sb-glyph-${color}`}>{glyph}</span>
      <span className="dh-sb-slug">{slug}</span>
      <span className="dh-sb-count">{items.length}</span>
    </div>
    <div className="dh-sb-title">{title}</div>
    <ul className="dh-sb-list">
      {items.map((it, i) => (
        <li key={i} className="dh-sb-item">
          <span className="dh-sb-bullet" />
          <div className="dh-sb-item-body">
            <p className="dh-sb-item-text">{it.text}</p>
            <span className={`dh-sb-item-tag dh-sb-item-tag-${color}`}>{it.tag}</span>
          </div>
        </li>
      ))}
    </ul>
  </div>
);

const StatusBoard = () => {
  const d = window.DH_DATA.status_board;
  return (
    <section id="board" data-screen-label="status-board" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> The board</div>
          <h2 className="dh-section-title">Now. Recently. Soon.</h2>
          <p className="dh-section-sub">The honest version of a roadmap. Three columns, no slides.</p>
        </div>
        <span className="dh-mono dh-muted dh-sb-stamp">printed: day {window.DH_DATA.brand.today_day} · 02:14 IST</span>
      </div>
      <div className="dh-sb-grid">
        <StatusColumn title="Now"      slug="./now"      items={d.now}      color="green" glyph="●" />
        <StatusColumn title="Recently" slug="./recently" items={d.recently} color="gold"  glyph="★" />
        <StatusColumn title="Soon"     slug="./soon"     items={d.soon}     color="blue"  glyph="↗" />
      </div>
    </section>
  );
};

window.StatusBoard = StatusBoard;
