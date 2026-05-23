// ToolkitPage.jsx — /toolkit grid with category filter.

const { useState: useStateT } = React;

const CATEGORIES = [
  { id: 'all',      label: 'All',       color: null },
  { id: 'tool',     label: 'Tools',     color: 'green' },
  { id: 'repo',     label: 'Repos',     color: 'blue' },
  { id: 'skill',    label: 'Skills',    color: 'gold' },
  { id: 'resource', label: 'Resources', color: null },
];

const CAT_COLOR = { tool: 'green', repo: 'blue', skill: 'gold', resource: 'muted' };
const CAT_LABEL = { tool: 'Tool', repo: 'Repo', skill: 'Skill', resource: 'Resource' };

const ToolkitPage = () => {
  const [filter, setFilter] = useStateT('all');
  const [q, setQ] = useStateT('');
  const items = window.DH_DATA.toolkit;
  const byCat = filter === 'all' ? items : items.filter((i) => i.category === filter);
  const filtered = q.trim()
    ? byCat.filter((i) =>
        i.title.toLowerCase().includes(q.toLowerCase()) ||
        i.description.toLowerCase().includes(q.toLowerCase()))
    : byCat;

  const counts = items.reduce((a, i) => { a[i.category] = (a[i.category] || 0) + 1; return a; }, {});
  const dailyDrivers = items.filter((i) => i.featured).slice(0, 3);

  return (
    <main className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> The toolkit</div>
        <h1 className="dh-page-title">The Toolkit.</h1>
        <p className="dh-page-sub">Tools, repos, skills, and resources from the workshop. Some are mine, some are stolen, all are sharp.</p>
        <div className="dh-page-meta">
          <span className="dh-mono">{items.length} items in the drawer</span>
          <span className="dh-dot-sep">·</span>
          <span className="dh-mono">{items.filter((i) => i.featured).length} daily drivers</span>
          <span className="dh-dot-sep">·</span>
          <span className="dh-mono">{items.filter((i) => i.url.startsWith('http')).length} public · {items.filter((i) => i.url === '#').length} internal</span>
        </div>
      </header>

      {/* fake command palette */}
      <div className="dh-cmdk">
        <span className="dh-cmdk-gt">&gt;_</span>
        <input
          className="dh-cmdk-input"
          placeholder="search the workshop · type to filter"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="dh-cmdk-hint">
          <kbd>⌘</kbd><kbd>K</kbd>
        </span>
      </div>

      {/* Daily-driver featured callout */}
      <div className="dh-driver">
        <div className="dh-driver-head">
          <span className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> Daily driver</span>
          <span className="dh-mono dh-muted">what I actually open every morning</span>
        </div>
        <div className="dh-driver-row">
          {dailyDrivers.map((it) => (
            <div key={it.title} className={`dh-driver-card dh-tool-${CAT_COLOR[it.category]}`}>
              <span className={`dh-pill dh-pill-${CAT_COLOR[it.category]}`}>{CAT_LABEL[it.category]}</span>
              <span className="dh-driver-card-title">{it.title}</span>
              <span className="dh-driver-card-url">{it.url === '#' ? 'internal' : it.url.replace('https://', '')}</span>
            </div>
          ))}
        </div>
      </div>

      <nav className="dh-tab-bar">
        {CATEGORIES.map((c) => {
          const count = c.id === 'all' ? items.length : (counts[c.id] || 0);
          return (
            <button
              key={c.id}
              className={`dh-tab ${filter === c.id ? 'active' : ''}`}
              onClick={() => setFilter(c.id)}
            >
              {c.label}
              <span className="dh-tab-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <div className="dh-toolkit-grid">
        {filtered.map((item) => (
          <a
            key={item.title}
            className={`dh-tool dh-tool-${CAT_COLOR[item.category]}`}
            href={item.url}
            target={item.url.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            onClick={(e) => { if (item.url === '#') e.preventDefault(); }}
          >
            <div className="dh-tool-top">
              <span className={`dh-pill dh-pill-${CAT_COLOR[item.category]}`}>{CAT_LABEL[item.category]}</span>
              {item.featured && <span className="dh-tool-featured">★</span>}
            </div>
            <h3 className="dh-tool-title">{item.title}</h3>
            <p className="dh-tool-desc">{item.description}</p>
            <div className="dh-tool-bottom">
              <span className="dh-tool-url">{item.url === '#' ? 'internal' : item.url.replace('https://', '')}</span>
              <span className="dh-tool-arrow">↗</span>
            </div>
          </a>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="dh-empty">
          <span className="dh-gt">&gt;_</span>
          <span>nothing matched "{q || filter}". try another verb.</span>
        </div>
      )}
    </main>
  );
};

window.ToolkitPage = ToolkitPage;
