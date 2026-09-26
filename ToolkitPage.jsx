// ToolkitPage.jsx : /toolkit, "the stack". Sep 2026 system.
// One list (data.stack_now), grouped by kind, with the last day each tool was
// named in the public log. Filters and search are client-side over that list.

const { useState: useStateT, useMemo: useMemoT } = React;

const KINDS = [
  { id: 'all', label: 'everything' },
  { id: 'built', label: 'built here' },
  { id: 'using', label: 'in daily use' },
  { id: 'trying', label: 'trying' },
  { id: 'watching', label: 'watching' },
  { id: 'skill', label: 'skills and resources' },
];
const KIND_TONE = { built: 'build', using: 'build', trying: 'think', watching: '', skill: 'win' };

const ToolkitPage = () => {
  const { Age, Chip, fmtDate } = window.Sys;
  const D = window.DH_DATA;
  const S = D.stack_now || { items: [], counts: {} };
  const [kind, setKind] = useStateT('all');
  const [q, setQ] = useStateT('');

  const items = useMemoT(() => {
    let list = kind === 'all' ? S.items : S.items.filter((i) => i.kind === kind);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((i) => (i.name + ' ' + i.what + ' ' + (i.category || '')).toLowerCase().includes(needle));
    return list;
  }, [kind, q, S.items]);

  const dated = S.items.filter((i) => i.last_seen).length;

  return (
    <main className="dh-page sys mode-operator" id="main">
      <div className="wrap">
        <header className="page-head">
          <span className="eyebrow">the stack</span>
          <h1>What I build with, what I am trying, what I am watching.</h1>
          <p className="lead">{S.items.length} tools in one list: the ones I wrote, the ones I run every day, the ones on the bench, and the ones I am only reading about. The date on a card is the last day that tool was named in the public log, mined at build time. {dated} of {S.items.length} have one so far.</p>
          <div className="meta">
            <span>{S.counts.built || 0} built here</span>
            <span>{S.counts.using || 0} in daily use</span>
            <span>{S.counts.trying || 0} trying</span>
            <span>{S.counts.watching || 0} watching</span>
            <span>{S.counts.skill || 0} skills and resources</span>
            <span>{S.active_30d} named in the log, last 30 days</span>
          </div>
        </header>

        <div className="two">
          <div>
            <div className="card" style={{ display: 'grid', gap: 'var(--s3)', marginBottom: 'var(--bento-gap)' }}>
              <label className="sr" htmlFor="stack-q">search the stack</label>
              <input id="stack-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="search by name or what it does" style={{ width: '100%', minHeight: 44, padding: '0 var(--s3)', background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', font: '400 var(--text-md) var(--font-mono)' }} />
              <div className="filters" role="group" aria-label="filter by kind">
                {KINDS.map((k) => <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}{k.id !== 'all' && <span className="dim"> {S.counts[k.id] || 0}</span>}</button>)}
              </div>
            </div>

            {items.length === 0 && <div className="empty">&gt;_ nothing matches "{q}" in {kind === 'all' ? 'the stack' : KINDS.find((k) => k.id === kind).label}. try fewer letters.</div>}
            <div className="tool-grid">
              {items.map((it) => {
                const Inner = (
                  <React.Fragment>
                    <span className="h"><b>{it.name}{it.url ? ' ↗' : ''}</b><Chip tone={KIND_TONE[it.kind]}>{KINDS.find((k) => k.id === it.kind)?.label || it.kind}</Chip></span>
                    <span className="w">{it.what}</span>
                    <span className="f">
                      <span>{it.category && it.category !== 'external' ? it.category : (it.repo || (it.url ? it.url.replace(/^https?:\/\/(www\.)?/, '').split('/').slice(0, 2).join('/') : 'internal'))}</span>
                      {it.last_seen ? <span>in the log <b style={{ color: 'var(--text)' }}>{fmtDate(it.last_seen)}</b> · <Age date={it.last_seen} mode={60} /></span> : <span className="dim">no log mention yet</span>}
                    </span>
                  </React.Fragment>
                );
                return it.url
                  ? <a key={it.name} className="card link tool-card" href={it.url} target="_blank" rel="noreferrer">{Inner}</a>
                  : <div key={it.name} className="card tool-card">{Inner}</div>;
              })}
            </div>
          </div>

          <aside className="stack-side" aria-label="how this site runs">
            <div className="card" style={{ display: 'grid', gap: 'var(--s3)' }}>
              <h3 style={{ font: '700 var(--text-xs) var(--font-mono)', letterSpacing: 'var(--track-caps)', textTransform: 'uppercase', color: 'var(--muted)' }}>how this site runs</h3>
              <dl className="kv">
                {(D.stack || []).map((l) => <React.Fragment key={l.layer}><dt>{l.layer.toLowerCase()}</dt><dd>{l.what}</dd></React.Fragment>)}
              </dl>
            </div>
            <div className="card" style={{ display: 'grid', gap: 'var(--s2)' }}>
              <h3 style={{ font: '700 var(--text-xs) var(--font-mono)', letterSpacing: 'var(--track-caps)', textTransform: 'uppercase', color: 'var(--muted)' }}>how the dates work</h3>
              <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>every build scans all {S.mined_from ? S.mined_from.entries : ''} log entries and {S.mined_from ? S.mined_from.essays : ''} essays for each tool's name. no hand-typed "last used" anywhere. if a tool has no date, the log has not named it yet, which is a fact about the log, not the tool.</p>
              <a href="journey.html" className="section-link">read the log →</a>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

window.ToolkitPage = ToolkitPage;
