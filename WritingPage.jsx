// WritingPage.jsx — /writing index. Lists DH_DATA.posts, newest first.

const fmtPostDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
};

const WritingPage = () => {
  const D = window.DH_DATA;
  const posts = (D.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  return (
    <main className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> Writing</div>
        <h1 className="dh-page-title">Writing.</h1>
        <p className="dh-page-sub">Long-form. Weekly narratives and the occasional hot take. Written, not generated.</p>
        <div className="dh-page-meta">
          <span className="dh-mono">{posts.length} pieces</span>
          <span className="dh-dot-sep">·</span>
          <a className="dh-link" href="journey.html">The daily journey →</a>
        </div>
      </header>

      <div className="dh-narrow">
        <div className="dh-writing-list">
          {posts.map((p) => (
            <a key={p.slug} className="dh-writing-row" href={`post.html?slug=${encodeURIComponent(p.slug)}`}>
              <div>
                <span className="dh-writing-kind">{p.kind === 'weekly' ? `weekly · week ${p.week}` : 'essay'}</span>
                <h2 className="dh-writing-title">{p.title}</h2>
                <p className="dh-writing-deck">{p.deck}</p>
              </div>
              <div className="dh-writing-meta">
                {fmtPostDate(p.date)}<br />
                {p.read}
              </div>
            </a>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="bp-empty"><span className="dh-gt">&gt;_</span>nothing published yet. Soon.</div>
        )}
      </div>
    </main>
  );
};

window.WritingPage = WritingPage;
