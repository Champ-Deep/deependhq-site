// Pipeline.jsx — "this site builds itself" section. The honest flex:
// an animated trace of the nightly autopublish loop, terminal style.

const PIPE_STEPS = [
  { t: '01:39 IST', cmd: 'read  Calendar/Daily Notes/' + new Date().getFullYear() + '/…', out: 'mining the day for the one line that mattered' },
  { t: '01:40 IST', cmd: 'claude --voice=deep --author journey-entry', out: 'mood chosen. names scrubbed. no em-dashes survived.' },
  { t: '01:41 IST', cmd: 'node scripts/ingest-entry.mjs && build-data.mjs', out: 'content.json updated · data.js regenerated' },
  { t: '01:42 IST', cmd: 'git push origin main  # ssh deploy key', out: 'cloudflare picks it up. the edge rebuilds.' },
  { t: '01:44 IST', cmd: 'curl deependhq.com/data.js | verify today', out: '✓ live. nobody was awake for any of this.' },
];

const Pipeline = () => {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % (PIPE_STEPS.length + 1)), 1800);
    return () => clearInterval(id);
  }, []);
  return (
    <section id="pipeline" data-screen-label="pipeline" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> The loop</div>
          <h2 className="dh-section-title">This site writes itself while I sleep.</h2>
        </div>
        <a className="dh-section-link" href="https://github.com/Champ-Deep/deependhq-site" target="_blank" rel="noreferrer">Read the source ↗</a>
      </div>
      <p className="dh-pipe-lede">
        Every night an AI reads my day from the vault, writes the journey entry in my voice,
        pushes over SSH, and verifies the live site. The journal you scrolled past was not typed into a CMS.
        It was assembled by the loop below, at 1 AM, unattended.
      </p>
      <div className="dh-pipe">
        {PIPE_STEPS.map((p, i) => (
          <div key={i} className={`dh-pipe-row ${i < step ? 'done' : ''} ${i === step ? 'live' : ''}`}>
            <span className="dh-pipe-time">{p.t}</span>
            <span className="dh-pipe-node" />
            <span className="dh-pipe-body">
              <span className="dh-pipe-cmd"><span className="dh-gt">&gt;_</span>{p.cmd}</span>
              <span className="dh-pipe-out">{p.out}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

window.Pipeline = Pipeline;
