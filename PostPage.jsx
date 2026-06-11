// PostPage.jsx — single blog post at post.html?slug=<slug>.
// Reads the slug from the query string, finds the post in DH_DATA.posts, and
// renders its body blocks with the bp-* (blog) styles from pages.css.
// Extras: a reading-progress bar, copy-link, and prev/next navigation.

const { useState: useStatePP, useEffect: useEffectPP } = React;

const fmtPostDateP = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
};

const PostBlock = ({ block }) => {
  switch (block.type) {
    case 'lede':    return <p className="lede">{block.text}</p>;
    case 'h2':      return <h2 className="bp-h2">{block.text}</h2>;
    case 'pull':    return <div className="bp-pull">{block.text}</div>;
    case 'callout':
      return (
        <div className="bp-callout">
          {block.head && <div className="bp-callout-h">{block.head}</div>}
          <ul className="bp-callout-list">
            {(block.lines || []).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      );
    case 'p':
    default:        return <p>{block.text}</p>;
  }
};

const ReadingBar = () => {
  const [pct, setPct] = useStatePP(0);
  useEffectPP(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className="bp-progress" style={{ width: pct + '%' }} aria-hidden="true" />;
};

const PostPage = () => {
  const D = window.DH_DATA;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const posts = (D.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const idx = Math.max(0, posts.findIndex((p) => p.slug === slug));
  const post = posts.find((p) => p.slug === slug) || posts[0] || null;
  const [copied, setCopied] = useStatePP(false);

  if (!post) {
    return (
      <main className="dh-page">
        <div className="bp-empty"><span className="dh-gt">&gt;_</span>post not found. <a className="dh-link" href="writing.html">Back to writing →</a></div>
      </main>
    );
  }

  if (post.title) document.title = `${post.title} · deep >_`;

  const newer = idx > 0 ? posts[idx - 1] : null;       // more recent
  const older = idx < posts.length - 1 ? posts[idx + 1] : null;

  const copyLink = () => {
    const url = window.location.href;
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else { done(); }
  };

  return (
    <main className="dh-page">
      <ReadingBar />
      <article className="bp-page">
        <div className="bp-toprow">
          <a className="bp-back" href="writing.html">&larr; all writing</a>
          <button className="bp-share" onClick={copyLink}>{copied ? 'link copied ✓' : 'copy link'}</button>
        </div>

        {post.eyebrow && <div className="bp-eyebrow">{post.eyebrow}</div>}
        <h1 className="bp-title">{post.title}</h1>
        {post.deck && <p className="bp-deck">{post.deck}</p>}

        <div className="bp-byline">
          <span className="auth">sreedeep surapaneni</span>
          {post.read && <><span className="dh-dot-sep">·</span><span>{post.read}</span></>}
          {post.date && <><span className="dh-dot-sep">·</span><span>{fmtPostDateP(post.date)}</span></>}
          {post.day_range && <><span className="dh-dot-sep">·</span><span>{post.day_range}</span></>}
        </div>

        <div className="bp-prose">
          {(post.body || []).map((b, i) => <PostBlock key={i} block={b} />)}
        </div>

        <div className="bp-tags">
          {post.arc && <span className={`dh-pill dh-pill-${post.arc_color || 'blue'}`}>{post.arc}</span>}
          {(post.tags || []).map((t) => <span key={t} className="dh-pill dh-pill-muted">{t}</span>)}
        </div>

        {(newer || older) && (
          <nav className="bp-prevnext">
            {newer ? (
              <a className="bp-pn bp-pn-prev" href={`post.html?slug=${encodeURIComponent(newer.slug)}`}>
                <span className="bp-pn-k">&larr; newer</span>
                <span className="bp-pn-t">{newer.title}</span>
              </a>
            ) : <span />}
            {older ? (
              <a className="bp-pn bp-pn-next" href={`post.html?slug=${encodeURIComponent(older.slug)}`}>
                <span className="bp-pn-k">older &rarr;</span>
                <span className="bp-pn-t">{older.title}</span>
              </a>
            ) : <span />}
          </nav>
        )}
      </article>
    </main>
  );
};

window.PostPage = PostPage;
