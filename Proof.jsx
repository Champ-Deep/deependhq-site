// Proof.jsx — one-line wins. Not a logo wall.

const Proof = () => {
  const lines = window.DH_DATA.proof;
  return (
    <section id="proof" data-screen-label="proof" className="dh-section dh-section-proof">
      <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> Proof</div>
      <h2 className="dh-proof-title">Receipts, not testimonials.</h2>
      <ul className="dh-proof-list">
        {lines.map((line, i) => (
          <li key={i} className="dh-proof-line">
            <span className="dh-proof-mark">★</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

window.Proof = Proof;
