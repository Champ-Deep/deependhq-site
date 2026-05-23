// TheStack.jsx — colophon-style "what powers this site"

const TheStack = () => {
  const stack = window.DH_DATA.stack;
  return (
    <section id="stack" data-screen-label="the-stack" className="dh-section dh-section-stack">
      <div className="dh-stack-frame">
        <div className="dh-stack-rail">
          <span className="dh-stack-rail-dot dh-stack-rail-dot-red" />
          <span className="dh-stack-rail-dot dh-stack-rail-dot-amber" />
          <span className="dh-stack-rail-dot dh-stack-rail-dot-green" />
          <span className="dh-stack-rail-title">~/deependhq/about-this-site.md</span>
        </div>
        <div className="dh-stack-body">
          <div className="dh-stack-intro">
            <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> The colophon</div>
            <h2 className="dh-stack-title">How this site is built.</h2>
            <p className="dh-stack-lede">No frameworks chosen for the resume. Every layer earns its place. The whole thing rebuilds in 11 seconds on the edge.</p>
          </div>
          <dl className="dh-stack-list">
            {stack.map((row) => (
              <div key={row.layer} className="dh-stack-row">
                <dt className="dh-stack-layer">{row.layer}</dt>
                <dd className="dh-stack-what">{row.what}</dd>
              </div>
            ))}
          </dl>
          <div className="dh-stack-foot">
            <span className="dh-mono dh-muted">last deploy:</span>
            <span className="dh-mono">2 hours ago · commit 7af9c2e · "ticker: add coffee counter"</span>
          </div>
        </div>
      </div>
    </section>
  );
};

window.TheStack = TheStack;
