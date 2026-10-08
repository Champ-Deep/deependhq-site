// Workshop.jsx : the two live blocks that used to sit on /command and now live
// where a reader would look for them. LiveRepos renders on the Stack page
// (toolkit.html) and Shoutouts on the Now page (now.html). Both are shared
// modules so the prerender can bundle them and so any page may mount them.
// Each exposes one global and is guarded at the call site, so a page that
// does not load this file still renders. Hook aliases suffixed W. No em dashes.

const { useState: useStateW, useEffect: useEffectW } = React;

const wReduced = () => !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const wTok = (name, fb) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (e) { return fb; } };
const wConfetti = (opts) => {
  if (typeof window === 'undefined' || !window.confetti || wReduced()) return;
  window.confetti(Object.assign({ particleCount: 55, spread: 60, scalar: 0.8, origin: { y: 0.72 }, colors: [wTok('--build', '#30E060'), wTok('--win', '#F4A62A'), wTok('--text', '#F4EBD9')] }, opts || {}));
};
const wRelTime = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  return Math.floor(days / 30) + 'mo ago';
};

/* ---------- Live repos (the Stack page) ---------- */
const W_LANG_COLOR = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Go: '#00ADD8',
};
// The repos worth a card, in display order. m = github name, n = display name.
// The fetch fills in language, pushed date and url; without it the card still reads.
const W_REPO_SHOW = [
  { m: 'champmail', n: 'ChampMail', d: 'email outreach automation. human-cadence sending, self-hosted smtp.', lang: 'Python' },
  { m: 'champdf', n: 'ChamPDF', d: 'pdf extraction and processing for the presales floor.', lang: 'JavaScript' },
  { m: 'champiq', n: 'Champ IQ', d: 'the ai sdr orchestration layer. graph-driven prospecting.', lang: 'Python' },
  { m: 'champlens', n: 'ChampLens', d: 'qr-to-video ar business cards. scan a card, meet a person.', lang: 'TypeScript' },
  { m: 'champcms', n: 'ChampCMS', d: 'full-stack astro cms on cloudflare. d1, r2, passkeys, tiptap.', lang: 'TypeScript' },
  { m: 'graphiti-knowledge-graph', n: 'ChampGraph', d: 'knowledge graph per prospect. the brain behind the ai sdr.', lang: 'Python' },
  { m: 'lakestream', n: 'LakeStream', d: 'template-based web scraper for b2b enrichment.', lang: 'Python' },
  { m: 'b2b-pulse', n: 'B2B Pulse', d: 'linkedin + meta engagement automator. runs the daily social triage.', lang: 'Python' },
  { m: 'champvideo', n: 'ChampVideo', d: 'automated avatar video studio for the group brands.', lang: 'TypeScript' },
  { m: 'champquest', n: 'ChampQuest', d: 'task tracking, reborn as a ranch scavenger rpg.', lang: 'JavaScript' },
];

const RepoCard = ({ name, desc, lang, updated, url }) => (
  <a className="ws-repo" href={url || 'https://github.com/Champ-Deep'} target="_blank" rel="noreferrer">
    <div className="ws-repo-top"><span className="ws-repo-name">{name}</span><span className="ws-repo-meta" aria-hidden="true">↗</span></div>
    <div className="ws-repo-desc">{desc}</div>
    <div className="ws-repo-meta"><span><span className="ws-lang-dot" style={{ background: W_LANG_COLOR[lang] || 'var(--dim)' }} />{lang || 'code'}</span>{updated && <span>pushed {updated}</span>}</div>
  </a>
);

const LiveRepos = () => {
  const [repos, setRepos] = useStateW(null); // null = loading, [] = fetch failed (fallback cards)
  const [count, setCount] = useStateW(null);
  useEffectW(() => {
    let alive = true; const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch('https://api.github.com/users/Champ-Deep/repos?per_page=100&sort=pushed', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        if (!Array.isArray(data)) { setRepos([]); return; }
        setCount(data.length);
        const byName = {}; data.forEach((r) => { byName[(r.name || '').toLowerCase()] = r; });
        setRepos(W_REPO_SHOW.map((s) => {
          const r = byName[s.m];
          return r
            ? { name: s.n, desc: s.d || r.description, lang: r.language || s.lang, updated: wRelTime(r.pushed_at), url: r.html_url }
            : { name: s.n, desc: s.d, lang: s.lang, updated: null, url: 'https://github.com/Champ-Deep' };
        }));
      })
      .catch(() => { if (alive) setRepos([]); })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, []);
  const fallback = W_REPO_SHOW.map((s) => ({ name: s.n, desc: s.d, lang: s.lang, updated: null, url: 'https://github.com/Champ-Deep' }));
  const list = repos === null ? null : (repos.length ? repos : fallback);
  return (
    <section aria-labelledby="repos-h" id="repos" style={{ marginTop: 'var(--s10)' }}>
      <div className="section-head" style={{ marginBottom: 'var(--s4)' }}>
        <div>
          <span className="eyebrow">live from the workshop</span>
          <h2 id="repos-h">The code, as it is right now.</h2>
          <p className="lead">{count ? count + ' public repos on github.com/Champ-Deep, the ten below are the ones that matter.' : 'pulled live from github.com/Champ-Deep. ten repos that matter, with the last push on each.'}</p>
        </div>
        <a className="section-link" href="https://github.com/Champ-Deep" target="_blank" rel="noreferrer">all repos ↗</a>
      </div>
      <div className="ws-repos">
        {list === null
          ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="ws-repo-skel" />)
          : list.map((r) => <RepoCard key={r.name} {...r} />)}
      </div>
    </section>
  );
};

/* ---------- On my radar (the Now page) ---------- */
const W_SHOUT_TAG = { using: 'using', trying: 'trying this week', watching: 'watching' };

const Shoutouts = () => {
  const D = (typeof window !== 'undefined' && window.DH_DATA) || {};
  const all = (D.shoutouts && D.shoutouts.items) || [];
  const note = (D.shoutouts && D.shoutouts.note) || '';
  const reduced = wReduced();
  const [filter, setFilter] = useStateW('all');
  const [idx, setIdx] = useStateW(0);
  const [paused, setPaused] = useStateW(false);
  const list = filter === 'all' ? all : all.filter((s) => s.tag === filter);
  useEffectW(() => { setIdx(0); }, [filter]);
  useEffectW(() => {
    if (reduced || paused || list.length < 2) return undefined;
    const id = setInterval(() => setIdx((i) => (i + 1) % list.length), 4800);
    return () => clearInterval(id);
  }, [paused, list.length, reduced, filter]);
  if (!list.length) return null;
  const cur = list[Math.min(idx, list.length - 1)];
  const pick = (i) => { setIdx(i); wConfetti(); };
  return (
    <section aria-labelledby="radar-h" id="radar" style={{ marginTop: 'var(--s10)' }}>
      <div className="section-head" style={{ marginBottom: 'var(--s4)' }}>
        <div>
          <span className="eyebrow">on my radar</span>
          <h2 id="radar-h">Tools I am using, trying, and watching.</h2>
          {note && <p className="lead">{note}</p>}
        </div>
      </div>
      <div className="ws-shout" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <a className="ws-shout-spot" href={cur.url} target="_blank" rel="noreferrer">
          {!reduced && <span key={cur.url + idx} className={'ws-shout-bar' + (paused ? ' paused' : '')} />}
          <span className={'ws-shout-tag tag-' + cur.tag}>{W_SHOUT_TAG[cur.tag] || cur.tag}</span>
          <span className="ws-shout-name">{cur.name} <span className="ws-shout-arrow">↗</span></span>
          <span className="ws-shout-repo">{cur.repo}</span>
          <span className="ws-shout-what">{cur.what}</span>
        </a>
        <div className="ws-shout-side">
          <div className="ws-shout-filters" role="group" aria-label="filter the radar">
            {['all', 'using', 'trying', 'watching'].map((t) => (
              <button key={t} type="button" aria-pressed={filter === t} className={'ws-shout-fbtn' + (filter === t ? ' active' : '')} onClick={() => setFilter(t)}>{t}</button>
            ))}
          </div>
          <div className="ws-shout-chips">
            {list.map((s, i) => (
              <button key={s.url} type="button" className={'ws-shout-chip' + (i === idx ? ' active' : '')} onClick={() => pick(i)}><span className={'ws-shout-dot tag-' + s.tag} />{s.name}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

window.LiveRepos = LiveRepos;
window.Shoutouts = Shoutouts;
