// Dispatch.jsx — newsletter signup with quirky header.

const { useState: useStateD } = React;

const Dispatch = () => {
  const d = window.DH_DATA.dispatch;
  const [email, setEmail] = useStateD('');
  const [done, setDone] = useStateD(false);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
    setTimeout(() => { setDone(false); setEmail(''); }, 3000);
  };

  return (
    <section id="dispatch" data-screen-label="the-dispatch" className="dh-section dh-section-dispatch">
      <div className="dh-dispatch">
        <div className="dh-dispatch-left">
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> The dispatch</div>
          <h2 className="dh-dispatch-title">Worth about three minutes of your inbox.</h2>
          <p className="dh-dispatch-sub">
            One letter, every Sunday. The week stitched into a narrative. No tips, no listicles. Sometimes a horse photo.
          </p>
          <form className="dh-dispatch-form" onSubmit={onSubmit}>
            <span className="dh-dispatch-gt">&gt;_</span>
            <input
              className="dh-dispatch-input"
              type="email"
              placeholder="founder@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="dh-btn dh-btn-primary dh-dispatch-btn" type="submit">
              {done ? 'sent' : 'subscribe'}
            </button>
          </form>
          <div className="dh-dispatch-meta">
            <span className="dh-mono">{d.cadence}</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-mono">{d.read_time}</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-mono">{d.subs.toLocaleString()} reading</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-mono">unsubscribe in one click, always</span>
          </div>
        </div>
        <div className="dh-dispatch-right">
          <div className="dh-dispatch-stack-label">Recent issues</div>
          <ul className="dh-dispatch-issues">
            {d.sample.map((s, i) => (
              <li key={i} className="dh-dispatch-issue">
                <span className="dh-dispatch-issue-marker">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <a className="dh-link dh-dispatch-archive" href="writing.html">Browse the archive →</a>
        </div>
      </div>
    </section>
  );
};

window.Dispatch = Dispatch;
