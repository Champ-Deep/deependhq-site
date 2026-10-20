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

const ToolkitLauncher = ({ data }) => {
  const [query, setQuery] = useStateT('');
  const [filter, setFilter] = useStateT('external');
  const catalog = globalThis.deepToolkitCatalog(data.toolkit || []);
  const products = catalog.filter(p=>p.title !== 'Lead Scorer' && (filter === 'all' || p.mode === filter) && (p.title+' '+p.description).toLowerCase().includes(query.toLowerCase()));
  const labels = {external:'Separate product',source:'Source available',preview:'Preview only',shared:'Shared credits'};
  return (
    <section className="tk-launcher" aria-labelledby="tk-title">
      <div className="tk-account-strip">
        <span className="tk-small">DEEP END / TOOLKIT</span>
        <a className="tk-account-link" href="/account">Your credits &amp; account <span aria-hidden="true">↗</span></a>
      </div>
      <header className="tk-intro">
        <div><h1 id="tk-title">The right tool.<br/>For your <span>next move.</span></h1></div>
        <div className="tk-intro-copy"><p>Tools I build for the work I actually do. Research a list, clean a document, track what happens next.</p><p className="tk-muted">One account and shared credits for tools integrated here. Separate products are clearly marked.</p><a href="#tk-products">Explore the collection <span aria-hidden="true">↓</span></a></div>
      </header>
      <div className="tk-feature-grid">
        <article className="tk-feature">
          <div className="tk-feature-meta"><span>01 / DATA &amp; RESEARCH</span><span>Shared-credit workflow</span></div>
          <h2>Lead Scorer</h2><p className="tk-feature-desc">Find the fit.<br/>Before the first outreach.</p>
          <div className="tk-flow" aria-label="Lead Scorer workflow">
            <div><span>01</span><strong>Your list</strong><small>CSV or Excel</small></div>
            <div><span>02</span><strong>Find the facts</strong><small>Treg enrichment</small></div>
            <div><span>03</span><strong>Check &amp; judge</strong><small>Email + Jev fit</small></div>
            <div><span>04</span><strong>Make your move</strong><small>Evidence + export</small></div>
          </div>
          <div className="tk-feature-bottom"><a className="tk-primary" href="/lead-scorer">Open Lead Scorer <span aria-hidden="true">↗</span></a><span>See the maximum cost before you run.</span></div>
        </article>
        <aside className="tk-wallet" aria-labelledby="tk-wallet-title">
          <span className="tk-eyebrow">One account. One balance.</span><h2 id="tk-wallet-title">Your credits<br/>go with you.</h2>
          <ol className="tk-wallet-steps"><li><span>01</span><div><strong>Sign in once</strong><p>Your account, private runs and history.</p></div></li><li><span>02</span><div><strong>Know the cost</strong><p>Credits are reserved before work starts.</p></div></li><li><span>03</span><div><strong>Stay in control</strong><p>Unused reservations return to your balance.</p></div></li></ol>
          <a className="tk-secondary" href="/account">Account, usage &amp; plans</a><p className="tk-disclosure">Welcome credits and paid plans appear when enabled. No automatic overage charges.</p>
        </aside>
      </div>
      <section className="tk-collection" id="tk-products" aria-labelledby="tk-collection-title">
        <div className="tk-collection-head"><div><span className="tk-eyebrow">The collection</span><h2 id="tk-collection-title">Pick the job. Find your tool.</h2></div><label className="tk-search-label">Find a tool<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by name or job"/></label></div>
        <div className="tk-filters" role="group" aria-label="Filter toolkit products">{[['all','All products'],['external','Product sites'],['source','Source available'],['preview','Previews']].map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
        <div className="tk-products">{products.map((p,i)=><article className="tk-product" key={p.title}><div className="tk-product-meta"><span>{String(i+2).padStart(2,'0')}</span><span>{labels[p.mode]}</span></div><h3>{p.title}</h3><p>{p.description}</p><div className="tk-product-bottom">{p.href ? <a href={p.href} target="_blank" rel="noopener noreferrer">{p.mode==='external'?`Open ${p.title}`:p.mode==='preview'?`Preview ${p.title}`:`${p.title} source`} <span aria-hidden="true">↗</span></a> : <span>Not publicly available yet</span>}{p.mode==='external' && <small>{p.free?'Free browser tools. No toolkit credits.':'Separate account and pricing'}</small>}{p.mode==='preview' && p.href && <small>Preview deployment. Not integrated with credits.</small>}</div></article>)}</div>
        {!products.length && <p className="tk-empty" role="status">No tools match this search. Try another name or clear the filter.</p>}
        <p className="tk-disclosure">ChampUTM is part of ChampBeam. Deep Scanner is an internal file-safety scanner, not a prospecting tool. Source listings are not hosted apps.</p>
      </section>
      <div className="tk-stack-divider"><span>Behind the tools</span><a href="#tk-stack">The stack, experiments &amp; build log <span aria-hidden="true">↓</span></a></div>
    </section>
  );
};

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
    <main className="dh-page sys mode-operator v2 tk-toolkit-page" id="main" ref={root}>
      <div className="wrap">
        <ToolkitLauncher data={D} />
        <details className="tk-stack-details"><summary id="tk-stack">Explore the build stack and experiments</summary>
        <header className="v2-head">
          <div className="v2-head-copy">
            <span className="eyebrow">the stack</span>
            <h2>What I build with, what I am trying, what I am watching.</h2>
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
        </details>
      </div>
    </main>
  );
};

window.ToolkitPage = ToolkitPage;
