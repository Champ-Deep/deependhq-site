// ToolkitPage.jsx : /toolkit, "the stack", v2 (Oct 2026).
// Full width. The header carries the stack's shape (built, in use, trying,
// watching, skills) as an instrument. "How this site runs" is a strip, not a
// sidebar. The six tools the log names most are spotlight cards with a 13-week
// mention strip derived at render time; everything else is one sortable
// hairline ledger with FLIP reorder, so 51 items read in one screen instead of
// 26 identical card rows beside an empty column. Repos stay at the foot.
// Hook aliases suffixed T. No em dashes.

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
const KIND_COLOR = { built: 'var(--build)', using: 'color-mix(in oklab, var(--build) 55%, var(--card))', trying: 'var(--think)', watching: 'var(--line-2)', skill: 'var(--win)' };
const KIND_WORD = { built: 'built here', using: 'in daily use', trying: 'trying', watching: 'watching', skill: 'skill' };
const SORTS = [
  { id: 'recent', label: 'last named' },
  { id: 'mentions', label: 'most named, 90d' },
  { id: 'name', label: 'a to z' },
];

const ToolkitPage = () => {
  const { Age, Chip, fmtDate } = window.Sys;
  const { Spot, useRevealF, useCountUpF, useFlipF, Bars, Stack, mentionsByWeek } = window.Fx;
  const D = window.DH_DATA;
  const S = D.stack_now || { items: [], counts: {} };
  const journey = D.journey || [];
  const [kind, setKind] = useStateT('all');
  const [q, setQ] = useStateT('');
  const [sort, setSort] = useStateT('recent');
  const root = useRevealF([kind, q]);

  // 13-week mention strips, derived once from the log text
  const strips = useMemoT(() => {
    const m = {};
    for (const it of S.items) m[it.name] = mentionsByWeek(journey, [it.name], 13);
    return m;
  }, [S.items, journey]);

  const featured = useMemoT(() => S.items
    .filter((i) => (i.mentions_90d || 0) > 0)
    .sort((a, b) => (b.mentions_90d || 0) - (a.mentions_90d || 0) || (b.last_seen || '').localeCompare(a.last_seen || ''))
    .slice(0, 6), [S.items]);

  const items = useMemoT(() => {
    let list = kind === 'all' ? S.items.slice() : S.items.filter((i) => i.kind === kind);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((i) => (i.name + ' ' + i.what + ' ' + (i.category || '')).toLowerCase().includes(needle));
    const by = {
      recent: (a, b) => (b.last_seen || '').localeCompare(a.last_seen || '') || (b.mentions_90d || 0) - (a.mentions_90d || 0) || a.name.localeCompare(b.name),
      mentions: (a, b) => (b.mentions_90d || 0) - (a.mentions_90d || 0) || (b.last_seen || '').localeCompare(a.last_seen || '') || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
    };
    return list.sort(by[sort] || by.recent);
  }, [kind, q, sort, S.items]);
  const flipRef = useFlipF(items.map((i) => i.name).join('|'));
  const ledgerMax = Math.max(1, ...S.items.map((i) => i.mentions_90d || 0));

  const dated = S.items.filter((i) => i.last_seen).length;
  const [bigActive, bigRef] = useCountUpF(S.active_30d || 0);
  const kinds = ['built', 'using', 'trying', 'watching', 'skill'].map((k) => ({ k: KIND_WORD[k], n: S.counts[k] || 0, color: KIND_COLOR[k] }));

  return (
    <main className="dh-page sys mode-operator v2" id="main" ref={root}>
      <div className="wrap">
        <header className="v2-head">
          <div className="v2-head-copy">
            <span className="eyebrow">the stack</span>
            <h1>What I build with, what I am trying, what I am watching.</h1>
            <p className="lead">{S.items.length} tools in one list: the ones I wrote, the ones I run every day, the ones on the bench, and the ones I am only reading about. The date on each row is the last day that tool was named in the public log, mined at build time. {dated} of {S.items.length} have one so far.</p>
            <div className="meta">
              <span>{S.counts.built || 0} built here</span>
              <span>{S.counts.using || 0} in daily use</span>
              <span>{S.counts.trying || 0} trying</span>
              <span>{S.counts.watching || 0} watching</span>
              <span>{S.counts.skill || 0} skills and resources</span>
            </div>
          </div>
          <aside className="v2-instrument card" aria-labelledby="shape-h">
            <div className="v2-instrument-top">
              <span className="k" id="shape-h">named in the log, 30 days</span>
              <span className="big" ref={bigRef}>{bigActive}<small> of {S.items.length}</small></span>
            </div>
            <Stack parts={kinds} />
          </aside>
        </header>

        {(D.stack || []).length > 0 && (
          <section className="runs" aria-label="how this site runs" data-reveal>
            {(D.stack || []).map((l) => (
              <div key={l.layer} className="runs-cell">
                <span className="k">{l.layer.toLowerCase()}</span>
                <span className="v">{l.what}</span>
              </div>
            ))}
          </section>
        )}

        {featured.length > 0 && (
          <section className="section" aria-labelledby="feat-h" style={{ paddingBottom: 0 }}>
            <div className="section-head">
              <div>
                <span className="eyebrow">most named</span>
                <h2 id="feat-h">The six the log keeps coming back to.</h2>
                <p className="lead">ranked by how often the last 90 days of entries name them. the strip is the last 13 weeks, one bar per week.</p>
              </div>
              <a className="section-link" href="journey.html">read the log →</a>
            </div>
            <div className="feat-grid">
              {featured.map((it, i) => {
                const tone = KIND_TONE[it.kind] || '';
                const accent = it.kind === 'trying' ? 'var(--think)' : it.kind === 'skill' ? 'var(--win)' : 'var(--build)';
                const Inner = (
                  <React.Fragment>
                    <div className="feat-top">
                      <b className="feat-name">{it.name}{it.url ? <span aria-hidden="true"> ↗</span> : null}</b>
                      <Chip tone={tone}>{KIND_WORD[it.kind] || it.kind}</Chip>
                    </div>
                    <p className="feat-what">{it.what}</p>
                    <div className="feat-pulse">
                      <Bars values={strips[it.name] || []} accent={accent} label={'mentions by week, last 13 weeks'} height={30} />
                      <div className="feat-nums">
                        <span><b>{it.mentions_90d}</b> {it.mentions_90d === 1 ? 'mention' : 'mentions'}, 90d</span>
                        <span>{it.last_seen ? <React.Fragment>in the log {fmtDate(it.last_seen)} · <Age date={it.last_seen} mode={30} /></React.Fragment> : 'no log mention yet'}</span>
                      </div>
                    </div>
                  </React.Fragment>
                );
                return it.url
                  ? <Spot as="a" key={it.name} href={it.url} target="_blank" rel="noreferrer" className="card feat" accent={accent} data-reveal style={{ '--i': i }}>{Inner}</Spot>
                  : <Spot as="div" key={it.name} className="card feat" accent={accent} data-reveal style={{ '--i': i }}>{Inner}</Spot>;
              })}
            </div>
          </section>
        )}

        <section className="section" aria-labelledby="all-h" style={{ paddingBottom: 0 }}>
          <div className="section-head">
            <div>
              <span className="eyebrow">the whole list</span>
              <h2 id="all-h">{items.length === S.items.length ? 'All ' + S.items.length + '.' : items.length + ' of ' + S.items.length + '.'}</h2>
            </div>
          </div>
          <div className="ledger-controls" data-reveal>
            <label className="sr" htmlFor="stack-q">search the stack</label>
            <input id="stack-q" className="ledger-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="search by name or what it does" />
            <div className="filters" role="group" aria-label="filter by kind">
              {KINDS.map((k) => <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}{k.id !== 'all' && <span className="n">{S.counts[k.id] || 0}</span>}</button>)}
            </div>
            <div className="filters sorts" role="group" aria-label="sort">
              <span className="k">sort</span>
              {SORTS.map((s) => <button key={s.id} type="button" aria-pressed={sort === s.id} onClick={() => setSort(s.id)}>{s.label}</button>)}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="empty">&gt;_ nothing matches "{q}" in {kind === 'all' ? 'the stack' : KINDS.find((k) => k.id === kind).label}. try fewer letters.</div>
          ) : (
            <div className="ledger-wrap">
              <table className="ledger stack-ledger" aria-label="every tool in the stack">
                <thead>
                  <tr>
                    <th scope="col">tool</th>
                    <th scope="col">kind</th>
                    <th scope="col">what it does</th>
                    <th scope="col" className="num">named, 90d</th>
                    <th scope="col">last named</th>
                  </tr>
                </thead>
                <tbody ref={flipRef}>
                  {items.map((it) => (
                    <tr key={it.name} data-flip={it.name}>
                      <td>
                        {it.url ? <a href={it.url} target="_blank" rel="noreferrer" className="ledger-name">{it.name} ↗</a> : <span className="ledger-name">{it.name}</span>}
                        <span className="ledger-tag">{it.category || 'tool'}{it.site ? ' · ' + it.site : ''}</span>
                      </td>
                      <td><Chip tone={KIND_TONE[it.kind] || ''}>{KIND_WORD[it.kind] || it.kind}</Chip></td>
                      <td className="desc">{it.what}</td>
                      <td className="num"><span className="ibar" style={{ '--v': ((it.mentions_90d || 0) / ledgerMax).toFixed(3) }} /><b>{it.mentions_90d || 0}</b></td>
                      <td>{it.last_seen ? <React.Fragment>{fmtDate(it.last_seen)} · <Age date={it.last_seen} mode={30} /></React.Fragment> : <span className="dim">no log mention yet</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="ledger-note">every build scans all {S.mined_from ? S.mined_from.entries : ''} log entries and {S.mined_from ? S.mined_from.essays : ''} essays for each tool's name. no hand-typed "last used" anywhere. if a tool has no date, the log has not named it yet, which is a fact about the log, not the tool.</p>
        </section>

        {window.LiveRepos && <window.LiveRepos />}
      </div>
    </main>
  );
};

window.ToolkitPage = ToolkitPage;
