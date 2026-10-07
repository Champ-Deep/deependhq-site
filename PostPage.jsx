// PostPage.jsx : one essay, canonical URL /post/<slug>/. Oct 2026 rebuild.
//
// The essay sits on the left at reading measure. The right side carries the
// week the essay was written from, as visuals that follow the reading:
//   - the week strip: one cell per day in the window, coloured by what the
//     log says that day was (building, thinking, a real outcome)
//   - "now reading": the day the paragraph in view is about, with that day's
//     first line from the log
//   - what the week touched: a small graph of the arcs, companies and tools
//     the week's entries and the essay name. Pointing at a node marks the
//     paragraphs it shows up in
// Every one of those is derived at build time (scripts/derive-posts.mjs).
//
// At the top: a small audio player (the ElevenLabs reading when the file
// exists, the reader's own browser voice when it does not, labelled either
// way), Ask AI links that open the essay in ChatGPT, Claude, Perplexity or
// Google AI Mode with a plain prompt, and the Google preferred source link.
// While the audio plays, the paragraph being read is marked and the side
// panel follows it.
//
// Primary content renders without JavaScript. No em dashes.

const { useState: useStateEP, useEffect: useEffectEP, useRef: useRefEP, useMemo: useMemoEP, useCallback: useCallbackEP } = React;

const EP_SITE = 'https://deependhq.com';
const EP_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const epDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${EP_MONTHS[+m - 1]} ${+d}, ${y}`; };
const epShort = (iso) => { const [, m, d] = iso.split('-'); return `${EP_MONTHS[+m - 1]} ${+d}`; };
const epClock = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const EP_KIND = { green: 'building', blue: 'thinking', gold: 'a real outcome' };
const EP_DOW = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };

const epBlockText = (b) => (typeof b === 'string' ? b : [b && b.head, b && b.text, ...((b && b.lines) || [])].filter(Boolean).join(' '));

const EPBlock = ({ block, i, state, onPlayFrom, canPlay }) => {
  const cls = `ep-b${state.active === i ? ' is-active' : ''}${state.touched.has(i) ? ' is-touched' : ''}`;
  const from = canPlay ? (
    <button type="button" className="ep-from" onClick={() => onPlayFrom(i)} aria-label="Listen from this paragraph">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7-4.5z" fill="currentColor" /></svg>
    </button>
  ) : null;
  switch (block.type) {
    case 'lede': return <div className={cls} data-i={i}>{from}<p className="ep-lede">{block.text}</p></div>;
    case 'h2': return <div className={cls} data-i={i}><h2 className="ep-h2">{block.text}</h2></div>;
    case 'pull': return <div className={cls} data-i={i}>{from}<blockquote className="ep-pull"><p>{block.text}</p></blockquote></div>;
    case 'callout':
      return (
        <div className={cls} data-i={i}>{from}
          <div className="ep-callout">
            {block.head && <p className="ep-callout-h">{block.head}</p>}
            <ul>{(block.lines || []).map((l, k) => <li key={k}>{l}</li>)}</ul>
          </div>
        </div>
      );
    default: return <div className={cls} data-i={i}>{from}<p>{typeof block === 'string' ? block : block.text}</p></div>;
  }
};

// ------------------------------------------------------------------ the player
// One component, two engines. With an MP3 it is a plain <audio> element. With
// none it reads block by block through speechSynthesis, which every modern
// browser ships. The label says which one is talking.
const EPPlayer = ({ post, onBlock, seekRef }) => {
  const A = post.audio;
  const audioRef = useRefEP(null);
  const [ready, setReady] = useStateEP(false);
  const [playing, setPlaying] = useStateEP(false);
  const [t, setT] = useStateEP(0);
  const [rate, setRate] = useStateEP(1);
  const [voiceOk, setVoiceOk] = useStateEP(true);
  const speech = useRefEP({ i: -1, stop: false });
  const blocks = useMemoEP(() => {
    const list = [{ i: -1, text: `${post.title}. ${post.deck || ''}` }];
    (post.body || []).forEach((b, i) => { const x = epBlockText(b); if (x) list.push({ i, text: x }); });
    return list;
  }, [post.slug]);
  const total = A ? A.duration : (post.viz ? post.viz.listen_min * 60 : 0);

  useEffectEP(() => {
    setReady(true);
    if (!A && !(window.speechSynthesis && window.SpeechSynthesisUtterance)) setVoiceOk(false);
    return () => { try { if (!A && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} };
  }, []);

  const blockAt = (time) => {
    if (!A || !A.starts) return null;
    let cur = null;
    for (const s of A.starts) if (s.t <= time + 0.15) cur = s.i;
    return cur;
  };

  // speechSynthesis: one utterance per block, so the page can follow along
  const speakFrom = (k) => {
    const ss = window.speechSynthesis;
    ss.cancel();
    speech.current = { i: k, stop: false };
    const next = (idx) => {
      if (speech.current.stop || idx >= blocks.length) { setPlaying(false); onBlock(null); return; }
      const u = new SpeechSynthesisUtterance(blocks[idx].text);
      u.rate = rate; u.lang = 'en-IN';
      u.onstart = () => { speech.current.i = idx; onBlock(blocks[idx].i); };
      u.onend = () => { if (!speech.current.stop) next(idx + 1); };
      ss.speak(u);
    };
    next(k);
    setPlaying(true);
  };

  const toggle = () => {
    if (A) {
      const el = audioRef.current; if (!el) return;
      if (el.paused) { el.playbackRate = rate; el.play().catch(() => {}); } else el.pause();
      return;
    }
    const ss = window.speechSynthesis; if (!ss) return;
    if (playing) { speech.current.stop = true; ss.cancel(); setPlaying(false); return; }
    speakFrom(Math.max(0, speech.current.i));
  };

  // "listen from this paragraph", wired from the prose
  seekRef.current = (bi) => {
    if (A) {
      const el = audioRef.current; const s = (A.starts || []).find((x) => x.i === bi);
      if (el && s) { el.currentTime = s.t; el.playbackRate = rate; el.play().catch(() => {}); }
      return;
    }
    if (!window.speechSynthesis) return;
    const k = blocks.findIndex((b) => b.i === bi);
    if (k >= 0) speakFrom(k);
  };

  const cycleRate = () => {
    const order = [1, 1.25, 1.5, 2, 0.85];
    const r = order[(order.indexOf(rate) + 1) % order.length];
    setRate(r);
    if (A && audioRef.current) audioRef.current.playbackRate = r;
  };

  useEffectEP(() => {
    if (!('mediaSession' in navigator) || !playing) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title: post.title, artist: 'Sreedeep Surapaneni', album: 'deependhq.com, the weekly narratives', artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] });
    } catch (e) {}
  }, [playing]);

  if (!voiceOk) return <div className="ep-player is-off"><span className="ep-pl-k">audio for this essay is on its way</span></div>;

  const pct = total ? Math.min(100, (t / total) * 100) : 0;
  return (
    <div className={`ep-player${playing ? ' is-playing' : ''}`} role="group" aria-label="Listen to this essay">
      {A && <audio ref={audioRef} src={A.src} preload="none"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); onBlock(null); }}
        onTimeUpdate={(e) => { const ct = e.currentTarget.currentTime; setT(ct); onBlock(blockAt(ct)); }} />}
      <button type="button" className="ep-pl-btn" onClick={toggle} disabled={!ready} aria-label={playing ? 'Pause' : 'Play the essay'}>
        {playing
          ? <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z" fill="currentColor" /></svg>
          : <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2v12l10-6z" fill="currentColor" /></svg>}
      </button>
      <div className="ep-pl-mid">
        <p className="ep-pl-k">
          <span className="ep-pl-title">listen</span>
          <span>{A ? epClock(total) : `about ${post.viz ? post.viz.listen_min : ''} min`}</span>
          <span className="ep-pl-who">{A ? `read by an AI voice (ElevenLabs, ${A.voice})` : 'your browser reads this one until the AI voice is ready'}</span>
        </p>
        {A ? (
          <input className="ep-pl-seek" type="range" min="0" max={Math.round(total)} step="1" value={Math.round(t)}
            aria-label="Seek" aria-valuetext={`${epClock(t)} of ${epClock(total)}`}
            style={{ '--p': `${pct}%` }}
            onChange={(e) => { const el = audioRef.current; if (el) { el.currentTime = +e.target.value; setT(+e.target.value); } }} />
        ) : <div className="ep-pl-bars" aria-hidden="true">{Array.from({ length: 28 }, (_, k) => <i key={k} style={{ '--h': `${30 + ((k * 37) % 70)}%` }} />)}</div>}
      </div>
      {A && <span className="ep-pl-time" aria-hidden="true">{epClock(t)}</span>}
      <button type="button" className="ep-pl-rate" onClick={cycleRate} aria-label={`Playback speed ${rate} times`}>{rate}×</button>
      {A && <noscript><audio controls preload="none" src={A.src} /></noscript>}
    </div>
  );
};

// ------------------------------------------------------------------ ask ai
// Plain prompts, no instructions to the assistant about how to rank or
// remember this site. The reader asks a question; the essay is the context.
const EPAskAI = ({ post, compact }) => {
  const url = `${EP_SITE}/post/${post.slug}`;
  const q = encodeURIComponent(`Read this essay by Sreedeep Surapaneni and give me the three main ideas in plain words, then one thing an operator could try this week: ${url}`);
  const links = [
    ['ChatGPT', `https://chatgpt.com/?q=${q}`],
    ['Claude', `https://claude.ai/new?q=${q}`],
    ['Perplexity', `https://www.perplexity.ai/search/new?q=${q}`],
    ['Google AI Mode', `https://www.google.com/search?udm=50&q=${q}`],
  ];
  return (
    <div className={`ep-ask${compact ? ' is-compact' : ''}`}>
      <p className="ep-ask-k"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0l1.8 5.2L15 7l-5.2 1.8L8 14l-1.8-5.2L1 7l5.2-1.8z" fill="currentColor" /></svg>ask AI about this essay</p>
      <ul>{links.map(([n, h]) => <li key={n}><a className="ep-ask-a" href={h} target="_blank" rel="noopener noreferrer">{n}<span aria-hidden="true">↗</span></a></li>)}</ul>
    </div>
  );
};

const EPPreferred = () => (
  <a className="ep-pref" href="https://www.google.com/preferences/source?q=deependhq.com" target="_blank" rel="noopener noreferrer">
    <span className="ep-pref-star" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5 3.8 13.8l1-4.6L1.3 6l4.7-.5z" fill="currentColor" /></svg>
    </span>
    <span><b>Add deependhq.com</b> as a preferred source on Google</span>
  </a>
);

// ------------------------------------------------------------------ the week
const EPWeek = ({ viz, activeDates, focusDate, setFocusDate, compact }) => (
  <ol className={`ep-week${compact ? ' is-compact' : ''}`} aria-label="The days this essay covers">
    {viz.days.map((d) => {
      const on = activeDates.includes(d.date);
      const body = (
        <React.Fragment>
          <span className="ep-wk-dow">{d.dow}</span>
          <span className="ep-wk-n">{d.day ? d.day : ''}</span>
          <span className="ep-wk-k">{d.day ? (EP_KIND[d.arc_color] || 'logged') : 'no entry'}</span>
        </React.Fragment>
      );
      const props = {
        className: `ep-wk${d.day ? ` arc-${d.arc_color || 'none'}` : ' is-empty'}${on ? ' is-on' : ''}${focusDate === d.date ? ' is-focus' : ''}`,
        onMouseEnter: () => setFocusDate(d.date), onFocus: () => setFocusDate(d.date),
        onMouseLeave: () => setFocusDate(null), onBlur: () => setFocusDate(null),
      };
      return <li key={d.date}>{d.day
        ? <a {...props} href={`journey.html#day-${d.day}`} aria-label={`${EP_DOW[d.dow] || d.dow} ${epShort(d.date)}, day ${d.day}, ${EP_KIND[d.arc_color] || 'logged'}. Open in the Mission Log`}>{body}</a>
        : <span {...props} tabIndex={0} aria-label={`${EP_DOW[d.dow] || d.dow} ${epShort(d.date)}, no entry`}>{body}</span>}</li>;
    })}
  </ol>
);

// A small radial graph, laid out at build-time-stable positions so the
// prerendered SVG and the live one are identical.
const EPGraph = ({ post, hot, setHot }) => {
  const nodes = (post.viz && post.viz.nodes) || [];
  if (!nodes.length) return null;
  const W = 360, H = 266, cx = W / 2, cy = 120, R = 86;
  const maxN = Math.max(1, ...nodes.map((n) => n.paras.length));
  // Nodes sit on an ellipse; every label is centred under its node and cut at
  // 15 characters, so nothing can run off the edge at any width.
  const placed = nodes.map((n, k) => {
    const a = (-Math.PI / 2) + (k * 2 * Math.PI) / nodes.length;
    const r = 7 + 9 * (n.paras.length / maxN);
    const x = cx + Math.cos(a) * R * 1.45, y = cy + Math.sin(a) * R;
    const label = n.name.length > 15 ? `${n.name.slice(0, 14)}…` : n.name;
    return { ...n, x, y, r, label, lx: x, ly: y + r + 14 };
  });
  return (
    <figure className="ep-graph">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`What the week touched: ${nodes.map((n) => n.name).join(', ')}`}>
        {placed.map((n) => <line key={`l-${n.name}`} x1={cx} y1={cy} x2={n.x} y2={n.y} className={`ep-g-edge${hot === n.name ? ' is-hot' : ''}`} />)}
        <circle cx={cx} cy={cy} r="20" className="ep-g-core" />
        <text x={cx} y={cy + 4} textAnchor="middle" className="ep-g-core-t">{post.week ? `wk ${post.week}` : 'essay'}</text>
        {placed.map((n) => (
          <a key={n.name} href={n.href} className={`ep-g-node kind-${n.kind}${hot === n.name ? ' is-hot' : ''}`}
            onMouseEnter={() => setHot(n.name)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(n.name)} onBlur={() => setHot(null)}
            aria-label={`${n.name}, ${n.kind}, in ${n.paras.length} paragraph${n.paras.length === 1 ? '' : 's'} of this essay`}>
            <title>{n.name}</title>
            <rect className="ep-g-hit" x={n.x - 34} y={n.y - n.r - 6} width="68" height={Math.max(50, 2 * n.r + 26)} />
            <circle cx={n.x} cy={n.y} r={n.r} />
            <text x={n.lx} y={n.ly} textAnchor="middle">{n.label}</text>
          </a>
        ))}
      </svg>
      <figcaption>
        <span><i className="kind-arc" />arc</span><span><i className="kind-company" />company</span><span><i className="kind-tool" />tool</span>
        <span className="ep-g-hint">point at one to mark where it shows up</span>
      </figcaption>
    </figure>
  );
};

const ReadingBar = () => {
  const [pct, setPct] = useStateEP(0);
  useEffectEP(() => {
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
  // The slug lives in the path on the canonical /post/<slug>/ URLs and in the
  // query string on the old /post.html?slug= ones.
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug') || (window.location.pathname.match(/\/post\/([^/]+)\/?$/) || [])[1] || null;
  const posts = (D.posts || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const idx = Math.max(0, posts.findIndex((p) => p.slug === slug));
  const post = posts.find((p) => p.slug === slug) || posts[0] || null;
  const [copied, setCopied] = useStateEP(false);
  const [readBlock, setReadBlock] = useStateEP(0);     // in view
  const [audioBlock, setAudioBlock] = useStateEP(null); // being read aloud
  const [hot, setHot] = useStateEP(null);              // graph node pointed at
  const [focusDate, setFocusDate] = useStateEP(null);  // week cell pointed at
  const seekRef = useRefEP(() => {});

  useEffectEP(() => {
    if (!post || !('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll('.ep-prose [data-i]'));
    const vis = new Map();
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) vis.set(+e.target.getAttribute('data-i'), e.isIntersecting ? e.boundingClientRect.top : null);
      const live = [...vis.entries()].filter(([, v]) => v != null).sort((a, b) => Math.abs(a[1] - 140) - Math.abs(b[1] - 140));
      if (live.length) setReadBlock(live[0][0]);
    }, { rootMargin: '-25% 0px -45% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [post && post.slug]);

  if (!post) {
    return (
      <main className="dh-page" id="main">
        <div className="bp-empty"><span className="dh-gt">&gt;_</span>post not found. <a className="dh-link" href="writing.html">Back to writing →</a></div>
      </main>
    );
  }
  if (post.title && typeof document !== 'undefined' && document.title !== undefined) document.title = `${post.title} · deep >_`;

  const viz = post.viz || { days: [], para_days: [], nodes: [], entries: 0, words: 0, listen_min: 1 };
  const active = audioBlock != null ? audioBlock : readBlock;
  const touchedNode = hot ? viz.nodes.find((n) => n.name === hot) : null;
  const touched = new Set(touchedNode ? touchedNode.paras : focusDate ? viz.para_days.map((ds, i) => (ds.includes(focusDate) ? i : -1)).filter((i) => i >= 0) : []);
  const activeDates = (active != null && viz.para_days[active]) || [];
  const shownDate = focusDate || activeDates[activeDates.length - 1] || null;
  const shownDay = shownDate ? viz.days.find((d) => d.date === shownDate) : null;
  const arcs = [...new Set(viz.days.flatMap((d) => d.arcs))];
  const newer = idx > 0 ? posts[idx - 1] : null;
  const older = idx < posts.length - 1 ? posts[idx + 1] : null;
  const range = String(post.day_range || '').replace(/\s*[-\u2013\u2014]\s*/, ' to ');

  const copyLink = () => {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(window.location.href).then(done).catch(done); else done();
  };

  const nowCard = (
    <div className="ep-now" aria-live="polite">
      <p className="ep-now-k">{audioBlock != null ? 'now playing' : 'now reading'}</p>
      {shownDay ? (
        <React.Fragment>
          <p className="ep-now-d"><b>{EP_DOW[shownDay.dow] || shownDay.dow}</b> {epShort(shownDay.date)}{shownDay.day ? <span> · day {shownDay.day}</span> : null}</p>
          <p className="ep-now-t">{shownDay.ship || 'no entry in the log that day'}</p>
          {shownDay.day && <a className="ep-now-a" href={`journey.html#day-${shownDay.day}`}>day {shownDay.day} in the Mission Log →</a>}
        </React.Fragment>
      ) : <p className="ep-now-t">The week this essay was written from. Days light up as the paragraphs reach them.</p>}
    </div>
  );

  return (
    <main className="dh-page ep-page" id="main">
      <ReadingBar />
      <article className="ep">
        <header className="ep-head">
          <div className="ep-toprow">
            <a className="ep-back" href="writing.html">&larr; all writing</a>
            <button type="button" className="ep-share" onClick={copyLink}>{copied ? 'link copied' : 'copy link'}</button>
          </div>
          <p className="ep-eyebrow">{post.week ? `week ${post.week}` : 'essay'}{range ? ` · ${range}` : ''}{post.arc ? ` · ${post.arc}` : ''}</p>
          <h1 className="ep-title">{post.title}</h1>
          {post.deck && <p className="ep-deck">{post.deck}</p>}
          <p className="ep-byline"><span className="auth">Sreedeep Surapaneni</span><span>{epDate(post.date)}</span>{post.read && <span>{post.read} read</span>}<span>{viz.words} words</span></p>
          <div className="ep-tools">
            <EPPlayer post={post} onBlock={setAudioBlock} seekRef={seekRef} />
            <div className="ep-tools-side">
              <EPAskAI post={post} />
              <EPPreferred />
            </div>
          </div>
        </header>

        <div className="ep-mweek" aria-hidden="true">
          <EPWeek viz={viz} activeDates={activeDates} focusDate={focusDate} setFocusDate={setFocusDate} compact />
        </div>

        <div className="ep-body">
          <div className="ep-prose">
            {(post.body || []).map((b, i) => (
              <EPBlock key={i} block={b} i={i} state={{ active, touched }} onPlayFrom={(bi) => seekRef.current(bi)} canPlay={b.type !== 'h2'} />
            ))}
            <div className="ep-end">
              <div className="ep-tags">
                {post.arc && <span className={`dh-pill dh-pill-${post.arc_color || 'blue'}`}>{post.arc}</span>}
                {(post.tags || []).map((t) => <span key={t} className="dh-pill dh-pill-muted">{t}</span>)}
              </div>
              {(post.related_companies || []).length > 0 && (
                <p className="ep-related"><span>reads into</span>{post.related_companies.map((rc) => <a key={rc.slug} className="dh-pill dh-pill-gold" href={`company/${rc.slug}`}>{rc.name} →</a>)}</p>
              )}
              <div className="ep-end-tools"><EPAskAI post={post} compact /><EPPreferred /></div>
            </div>
          </div>

          <aside className="ep-side" aria-label="The week behind this essay">
            <div className="ep-side-in">
              <section className="ep-card">
                <h2 className="ep-card-h">the week behind it<span>{viz.window ? `${epShort(viz.window.start)} to ${epShort(viz.window.end)}` : ''}</span></h2>
                <EPWeek viz={viz} activeDates={activeDates} focusDate={focusDate} setFocusDate={setFocusDate} />
                {nowCard}
              </section>
              <section className="ep-card">
                <h2 className="ep-card-h">what the week touched<span>{viz.nodes.length} threads</span></h2>
                <EPGraph post={post} hot={hot} setHot={setHot} />
              </section>
              <dl className="ep-stats">
                <div><dt>entries that week</dt><dd>{viz.entries}</dd></div>
                <div><dt>arcs</dt><dd>{arcs.length}</dd></div>
                <div><dt>listen</dt><dd>{post.audio ? epClock(post.audio.duration) : `${viz.listen_min} min`}</dd></div>
              </dl>
            </div>
          </aside>
        </div>

        {(newer || older) && (
          <nav className="ep-prevnext" aria-label="More essays">
            {newer ? <a className="ep-pn" href={`post/${newer.slug}`}><span className="ep-pn-k">&larr; newer · week {newer.week}</span><span className="ep-pn-t">{newer.title}</span></a> : <span />}
            {older ? <a className="ep-pn ep-pn-next" href={`post/${older.slug}`}><span className="ep-pn-k">older · week {older.week} &rarr;</span><span className="ep-pn-t">{older.title}</span></a> : <span />}
          </nav>
        )}
      </article>
    </main>
  );
};

window.PostPage = PostPage;
