// CommandPage.jsx — /command : the public Command Center.
// One screen: live vitals, status board, the build, the public log + real
// commit graph, an interactive ecosystem graph, live repos, a rotating
// shoutouts feed, and a playable terminal. Enhanced with VANTA (hero),
// force-graph (ecosystem), github-calendar (commits), typed.js (hero prompt),
// canvas-confetti, and rough-notation. Every library degrades gracefully:
// if a CDN global is missing, the page falls back and never blanks.
// Hook aliases suffixed C to avoid global-scope collisions on the page.

const { useState: useStateC, useEffect: useEffectC, useRef: useRefC, useMemo: useMemoC } = React;

const DAY_ONE = '2025-11-01';
const C_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ACCENTS = ['#30E060', '#4A7BF7', '#C9A84C'];
const LANG_COLOR = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Go: '#00ADD8', null: '#8A8A8A',
};

const prefersReduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const fireConfetti = (opts) => {
  if (!window.confetti || prefersReduced()) return;
  window.confetti(Object.assign({ particleCount: 90, spread: 72, startVelocity: 38, ticks: 160, origin: { y: 0.72 }, colors: ['#30E060', '#C9A84C', '#E8E4DC', '#4A7BF7'] }, opts || {}));
};
const istClock = () => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()) + ' IST'; }
  catch (e) { return ''; }
};
const cFmtDate = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${C_MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`; };
const relTime = (iso) => {
  if (!iso) return '';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today'; if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago'; if (days < 30) return Math.floor(days / 7) + 'w ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago'; return Math.floor(days / 365) + 'y ago';
};

/* ---------- Rough Notation: annotate a phrase when it scrolls into view ---------- */
const Annotate = ({ children, type = 'underline', color = '#30E060', className }) => {
  const ref = useRefC(null);
  useEffectC(() => {
    if (!window.RoughNotation || !ref.current) return;
    let a;
    try { a = window.RoughNotation.annotate(ref.current, { type, color, strokeWidth: 2, padding: type === 'circle' ? 6 : 2, animationDuration: prefersReduced() ? 0 : 700 }); }
    catch (e) { return; }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { try { a.show(); } catch (e) {} io.disconnect(); } }, { threshold: 0.9 });
    io.observe(ref.current);
    return () => { io.disconnect(); try { a.remove(); } catch (e) {} };
  }, []);
  return <span ref={ref} className={className}>{children}</span>;
};

/* ---------- typed.js hero prompt (falls back to static text) ---------- */
const TypedLine = () => {
  const ref = useRefC(null);
  const day = (window.DH_DATA && window.DH_DATA.brand && window.DH_DATA.brand.today_day) || '';
  const STR = ['shipping code between meetings.', '12 companies, one operating system.', 'past the hype cycle, into the infrastructure.', `building in public, day ${day}.`];
  useEffectC(() => {
    if (!window.Typed || !ref.current || prefersReduced()) { if (ref.current) ref.current.textContent = STR[0]; return; }
    const t = new window.Typed(ref.current, { strings: STR, typeSpeed: 38, backSpeed: 16, backDelay: 1900, startDelay: 400, loop: true, smartBackspace: true, showCursor: false });
    return () => { try { t.destroy(); } catch (e) {} };
  }, []);
  return <span className="cc-typed" ref={ref} />;
};

/* ---------- Hero backdrop: VANTA.NET, fallback to matrix rain ---------- */
const startMatrixRain = (host) => {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
  host.appendChild(cv);
  const ctx = cv.getContext('2d');
  let raf, w, h, cols, drops, last = 0;
  const chars = '01<>/_$#{}[]=+*?;:';
  const resize = () => { const r = host.getBoundingClientRect(); w = cv.width = Math.max(1, r.width); h = cv.height = Math.max(1, r.height); cols = Math.floor(w / 14); drops = new Array(cols).fill(0).map(() => Math.random() * (h / 16)); };
  resize(); window.addEventListener('resize', resize);
  const draw = (ts) => { raf = requestAnimationFrame(draw); if (ts - last < 70) return; last = ts; ctx.fillStyle = 'rgba(13,15,20,0.30)'; ctx.fillRect(0, 0, w, h); ctx.font = '12px monospace'; for (let i = 0; i < cols; i++) { const ch = chars[Math.floor(Math.random() * chars.length)]; const x = i * 14, y = drops[i] * 16; ctx.fillStyle = Math.random() > 0.975 ? '#E8E4DC' : 'rgba(48,224,96,0.6)'; ctx.fillText(ch, x, y); if (y > h && Math.random() > 0.975) drops[i] = 0; else drops[i] += 1; } };
  raf = requestAnimationFrame(draw);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); try { host.removeChild(cv); } catch (e) {} };
};
const HeroCanvas = () => {
  const ref = useRefC(null);
  useEffectC(() => {
    const el = ref.current; if (!el) return;
    let vanta = null, cleanup = null;
    if (!prefersReduced() && window.VANTA && window.VANTA.NET && window.THREE) {
      try { vanta = window.VANTA.NET({ el, THREE: window.THREE, color: 0x30E060, backgroundColor: 0x0d0f14, backgroundAlpha: 0, points: 10, maxDistance: 21, spacing: 17, showDots: true, mouseControls: true, touchControls: true, gyroControls: false }); }
      catch (e) { vanta = null; }
    }
    if (!vanta && !prefersReduced()) { try { cleanup = startMatrixRain(el); } catch (e) {} }
    return () => { if (vanta) { try { vanta.destroy(); } catch (e) {} } if (cleanup) cleanup(); };
  }, []);
  return <div ref={ref} className="cc-hero-canvas" aria-hidden="true" />;
};

/* ---------- Contribution heatmap (the public log) ---------- */
const Heatmap = ({ journey }) => {
  const [tip, setTip] = useStateC(null);
  const cells = useMemoC(() => {
    if (!journey.length) return [];
    const byDate = {}; journey.forEach((e) => { byDate[e.date] = e; });
    const dates = journey.map((e) => e.date).sort();
    const start = new Date(dates[0] + 'T00:00:00Z');
    const end = new Date(((window.DH_DATA.brand && window.DH_DATA.brand.today_date) || dates[dates.length - 1]) + 'T00:00:00Z');
    const out = []; const pad = start.getUTCDay();
    for (let i = 0; i < pad; i++) out.push({ blank: true, key: 'p' + i });
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) { const d = new Date(t); const iso = d.toISOString().slice(0, 10); out.push({ iso, entry: byDate[iso] || null, key: iso }); }
    return out;
  }, [journey]);
  const enter = (e, c) => {
    if (!c.entry) { setTip({ x: e.clientX, y: e.clientY, iso: c.iso, text: 'quiet day. no public entry.', day: null }); return; }
    setTip({ x: e.clientX, y: e.clientY, iso: c.iso, day: c.entry.day, text: (c.entry.shipping_now || '').slice(0, 120) + ((c.entry.shipping_now || '').length > 120 ? '…' : '') });
  };
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">The public log</h2>
        <span className="cc-badge live">tracking</span>
        <span className="cc-sec-note">{journey.length} entries logged · colored by what the day was about</span>
      </div>
      <div className="cc-heat-wrap">
        <div className="cc-heat" onMouseLeave={() => setTip(null)}>
          {cells.map((c) => (
            c.blank
              ? <span key={c.key} style={{ visibility: 'hidden', width: 13, height: 13 }} />
              : <span key={c.key} className={`cc-heat-cell ${c.entry ? 'lv-' + c.entry.arc_color : ''}`} onMouseEnter={(e) => enter(e, c)} onMouseMove={(e) => enter(e, c)} />
          ))}
        </div>
      </div>
      <div className="cc-heat-legend">
        <span className="cc-legend-item"><span className="cc-legend-sw empty" /> quiet</span>
        <span className="cc-legend-item"><span className="cc-legend-sw green" /> building</span>
        <span className="cc-legend-item"><span className="cc-legend-sw blue" /> thinking</span>
        <span className="cc-legend-item"><span className="cc-legend-sw gold" /> winning</span>
      </div>
      {tip && (
        <div className="cc-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="cc-tip-day">{tip.day ? `day ${tip.day} · ` : ''}{cFmtDate(tip.iso)}</div>
          <div className="cc-tip-text">{tip.text}</div>
        </div>
      )}
    </div>
  );
};

/* ---------- Real GitHub contribution graph (hides itself on failure) ---------- */
const GitHubCal = () => {
  const [ok, setOk] = useStateC(true);
  useEffectC(() => {
    if (!window.GitHubCalendar) { setOk(false); return; }
    try {
      const p = window.GitHubCalendar('#cc-ghcal', 'Champ-Deep', { responsive: true, tooltips: true, global_stats: true });
      if (p && p.catch) p.catch(() => setOk(false));
    } catch (e) { setOk(false); }
  }, []);
  if (!ok) return null;
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Commits, for real</h2>
        <span className="cc-badge live">github</span>
        <span className="cc-sec-note">live contribution graph · github.com/Champ-Deep</span>
      </div>
      <div className="cc-ghcal" id="cc-ghcal">Loading the graph…</div>
    </div>
  );
};

/* ---------- Ecosystem: force-graph (draggable), SVG fallback ---------- */
const ConstellationSVGInner = ({ companies }) => {
  const [hover, setHover] = useStateC(null);
  const [tip, setTip] = useStateC(null);
  const VW = 800, VH = 460, cx = 400, cy = 230, rx = 320, ry = 168;
  const nodes = useMemoC(() => (companies || []).map((co, i) => {
    const n = Math.max(companies.length, 1); const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { ...co, x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang), color: ACCENTS[i % 3], dur: (6 + (i % 5)).toFixed(1) + 's', delay: (-(i * 0.6)).toFixed(1) + 's' };
  }), [companies]);
  return (
    <div className="cc-constellation" onMouseLeave={() => { setHover(null); setTip(null); }}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ecosystem of companies">
        {nodes.map((n, i) => (<line key={'e' + i} className="cc-edge" x1={cx} y1={cy} x2={n.x} y2={n.y} style={{ opacity: hover === null ? 0.3 : (hover === i ? 0.85 : 0.08) }} />))}
        <g><circle className="cc-node-hub" cx={cx} cy={cy} r="34" /><text x={cx} y={cy - 2} className="cc-node-lab" style={{ fill: '#E8E4DC', fontSize: 13 }}>deep</text><text x={cx} y={cy + 13} className="cc-node-lab" style={{ fill: '#30E060', fontSize: 13 }}>{'>_'}</text></g>
        {nodes.map((n, i) => (
          <g key={i} className="cc-node-g cc-float" style={{ '--cc-dur': n.dur, animationDelay: n.delay }} onMouseEnter={(e) => { setHover(i); setTip({ x: e.clientX, y: e.clientY, n }); }} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, n })}>
            <circle className="cc-node" cx={n.x} cy={n.y} r={hover === i ? 11 : 7} fill={n.color} style={{ filter: `drop-shadow(0 0 7px ${n.color})` }} />
            <text className="cc-node-lab" x={n.x} y={n.y + 24}>{n.name}</text>
          </g>
        ))}
      </svg>
      {tip && (<div className="cc-tip" style={{ left: tip.x, top: tip.y }}><div className="cc-tip-day">{tip.n.tag || 'venture'}</div><div className="cc-tip-text"><b style={{ color: '#E8E4DC' }}>{tip.n.name}</b><br />{tip.n.desc}</div></div>)}
    </div>
  );
};
const Constellation = ({ companies }) => {
  const elRef = useRefC(null);
  const [useFG, setUseFG] = useStateC(true);
  useEffectC(() => {
    if (!window.ForceGraph || !elRef.current) { setUseFG(false); return; }
    const el = elRef.current;
    const nodes = [{ id: '__hub', name: 'deep >_', hub: true }, ...companies.map((c, i) => ({ id: c.name, name: c.name, desc: c.desc, tag: c.tag, col: ACCENTS[i % 3] }))];
    const links = companies.map((c) => ({ source: '__hub', target: c.name }));
    let g;
    try {
      g = window.ForceGraph()(el)
        .graphData({ nodes, links })
        .backgroundColor('rgba(0,0,0,0)')
        .width(el.clientWidth).height(440)
        .nodeRelSize(6)
        .nodeColor((n) => (n.hub ? '#E8E4DC' : n.col))
        .nodeLabel((n) => (n.hub ? '12 companies, one operating system' : `${n.name} — ${n.desc || ''}`))
        .linkColor(() => 'rgba(74,123,247,0.28)')
        .linkWidth(1)
        .nodeCanvasObjectMode(() => 'after')
        .nodeCanvasObject((n, ctx, scale) => {
          const label = n.hub ? 'deep >_' : n.name;
          const fs = Math.max(3.5, 11 / scale);
          ctx.font = `${fs}px 'JetBrains Mono', monospace`;
          ctx.fillStyle = n.hub ? '#E8E4DC' : '#8A8A8A';
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText(label, n.x, n.y + (n.hub ? 11 : 8));
        })
        .onEngineStop(() => { try { g.zoomToFit(400, 50); } catch (e) {} });
    } catch (e) { setUseFG(false); return; }
    const onResize = () => { try { g.width(el.clientWidth); } catch (e) {} };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); try { g._destructor && g._destructor(); el.innerHTML = ''; } catch (e) {} };
  }, [companies]);
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">The ecosystem</h2>
        <span className="cc-sec-note">{(companies || []).length} companies, one operating system · <Annotate type="underline" color="#4A7BF7">drag a node</Annotate></span>
      </div>
      {useFG ? <div ref={elRef} className="cc-forcegraph" /> : <ConstellationSVGInner companies={companies} />}
    </div>
  );
};

/* ---------- Live GitHub repo cards ---------- */
const REPO_SHOW = [
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
  { m: 'event-scout', n: 'Event Scout', d: 'mobile pwa for event contact capture plus ai chat.', lang: 'HTML' },
  { m: 'deependhq-site', n: 'deependhq-site', d: 'this site. no-build react on cloudflare, self-publishing daily.', lang: 'JavaScript' },
];
const RepoCard = ({ name, desc, lang, updated, url }) => (
  <a className="cc-repo" href={url || 'https://github.com/Champ-Deep'} target="_blank" rel="noreferrer">
    <div className="cc-repo-top"><span className="cc-repo-name">{name}</span><span className="cc-repo-meta" aria-hidden="true">↗</span></div>
    <div className="cc-repo-desc">{desc}</div>
    <div className="cc-repo-meta"><span><span className="cc-lang-dot" style={{ background: LANG_COLOR[lang] || '#8A8A8A' }} />{lang || 'code'}</span>{updated && <span>pushed {updated}</span>}</div>
  </a>
);
const LiveRepos = () => {
  const [repos, setRepos] = useStateC(null);
  const [count, setCount] = useStateC(null);
  useEffectC(() => {
    let alive = true; const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch('https://api.github.com/users/Champ-Deep/repos?per_page=100&sort=pushed', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !Array.isArray(data)) { setRepos([]); return; }
        setCount(data.length); const byName = {}; data.forEach((r) => { byName[(r.name || '').toLowerCase()] = r; });
        setRepos(REPO_SHOW.map((s) => { const r = byName[s.m]; return r ? { name: s.n, desc: s.d || r.description, lang: r.language || s.lang, updated: relTime(r.pushed_at), url: r.html_url } : { name: s.n, desc: s.d, lang: s.lang, updated: null, url: 'https://github.com/Champ-Deep' }; }));
      })
      .catch(() => { if (alive) setRepos([]); })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, []);
  const fallback = REPO_SHOW.map((s) => ({ name: s.n, desc: s.d, lang: s.lang, updated: null, url: 'https://github.com/Champ-Deep' }));
  const list = repos === null ? null : (repos.length ? repos : fallback);
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Live from the workshop</h2>
        <span className="cc-badge live">github</span>
        <span className="cc-sec-note">{count ? count + ' public repos' : 'pulled live from github.com/Champ-Deep'}</span>
      </div>
      <div className="cc-repos">{list === null ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="cc-repo-skel" />) : list.map((r) => <RepoCard key={r.name} {...r} />)}</div>
    </div>
  );
};

/* ---------- Shoutouts (rotating "on my radar" feed) ---------- */
const SHOUT_TAG = { using: 'using', trying: 'trying this week', watching: 'watching' };
const Shoutouts = () => {
  const D = window.DH_DATA || {};
  const all = (D.shoutouts && D.shoutouts.items) || [];
  const note = (D.shoutouts && D.shoutouts.note) || '';
  const reduced = prefersReduced();
  const [filter, setFilter] = useStateC('all');
  const [idx, setIdx] = useStateC(0);
  const [paused, setPaused] = useStateC(false);
  const list = filter === 'all' ? all : all.filter((s) => s.tag === filter);
  useEffectC(() => { setIdx(0); }, [filter]);
  useEffectC(() => {
    if (reduced || paused || list.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % list.length), 4800);
    return () => clearInterval(id);
  }, [paused, list.length, reduced, filter]);
  if (!list.length) return null;
  const cur = list[Math.min(idx, list.length - 1)];
  const pick = (i) => { setIdx(i); fireConfetti({ particleCount: 55, spread: 60, scalar: 0.8 }); };
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">On my radar</h2>
        <span className="cc-badge live">shoutouts</span>
        <span className="cc-sec-note">{note}</span>
      </div>
      <div className="cc-shout" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <a className="cc-shout-spot" href={cur.url} target="_blank" rel="noreferrer">
          {!reduced && <span key={cur.url + idx} className={`cc-shout-bar ${paused ? 'paused' : ''}`} />}
          <span className={`cc-shout-tag tag-${cur.tag}`}>{SHOUT_TAG[cur.tag] || cur.tag}</span>
          <span className="cc-shout-name">{cur.name} <span className="cc-shout-arrow">↗</span></span>
          <span className="cc-shout-repo">{cur.repo}</span>
          <span className="cc-shout-what">{cur.what}</span>
        </a>
        <div className="cc-shout-side">
          <div className="cc-shout-filters">
            {['all', 'using', 'trying', 'watching'].map((t) => (<button key={t} className={`cc-shout-fbtn ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{t}</button>))}
          </div>
          <div className="cc-shout-chips">
            {list.map((s, i) => (<button key={s.url} className={`cc-shout-chip ${i === idx ? 'active' : ''}`} onClick={() => pick(i)}><span className={`cc-shout-dot tag-${s.tag}`} />{s.name}</button>))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ---------- Playable terminal ---------- */
const seg = (t, c) => ({ t, c });
const Terminal = () => {
  const D = window.DH_DATA || {};
  const brand = D.brand || {};
  const j0 = (D.journey && D.journey[0]) || {};
  const companies = (D.companies || []).map((c) => c.name);
  const lanes = D.build_lanes || { live: [], building: [], next: [] };
  const BOOT = [{ cls: 'out', segs: [seg('deepkit shell v1.0 · ', 'g'), seg('type ', null), seg('help', 'g'), seg(' to start. hidden commands exist. try ', null), seg('matrix', 'g'), seg(', ', null), seg('coffee', 'g'), seg(', ', null), seg('sudo hire', 'g'), seg('.', null)] }];
  const [lines, setLines] = useStateC(BOOT);
  const [val, setVal] = useStateC('');
  const [coffee, setCoffee] = useStateC(3);
  const bodyRef = useRefC(null); const inRef = useRefC(null);
  useEffectC(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [lines]);
  const respond = (raw) => {
    const cmd = raw.trim(); const lc = cmd.toLowerCase();
    if (!lc) return [];
    if (lc === 'clear') { setLines(BOOT); return null; }
    if (lc === 'help') return [{ cls: 'out', segs: [seg('commands: ', null), seg('whoami now ship stack companies repos contact ls pwd date echo theme coffee matrix party sudo clear', 'g')] }];
    if (lc === 'whoami') return [{ cls: 'out', segs: [seg('sreedeep surapaneni · group cmo, champions group. building an ai operating system across 12 companies. shipping code between meetings, day ' + (brand.today_day || '') + '.', null)] }];
    if (lc === 'now') { const f = (D.now && D.now.focus) || []; return f.slice(0, 4).map((x) => ({ cls: 'out', segs: [seg((x.k || '').toLowerCase() + ' ', x.color === 'gold' ? 'gd' : (x.color === 'blue' ? 'bl' : 'g')), seg('· ' + x.text, null)] })); }
    if (lc === 'ship') { fireConfetti(); return [{ cls: 'out', segs: [seg('day ' + (j0.day || '') + ' · ', 'g'), seg(j0.shipping_now || 'shipping.', null)] }]; }
    if (lc === 'stack') { const live = (lanes.live || []).map((x) => x.name).join(', '); const building = (lanes.building || []).map((x) => x.name).join(', '); return [{ cls: 'out', segs: [seg('live: ', 'g'), seg(live || 'champmail, champdf, champvoice', null)] }, { cls: 'out', segs: [seg('building: ', 'bl'), seg(building || 'champ iq, champset', null)] }]; }
    if (lc === 'companies') return [{ cls: 'out', segs: [seg(companies.join(' · ') || '12 ventures', null)] }];
    if (lc === 'repos') return [{ cls: 'out', segs: [seg('github.com/Champ-Deep', 'g'), seg(' · 37 public repos and counting.', null)] }];
    if (lc === 'contact') return [{ cls: 'out', segs: [seg('book: ', null), seg('scheduler.zoom.us/sreedeep', 'g'), seg('  ·  ', null), seg('github.com/Champ-Deep', 'g')] }];
    if (lc === 'ls') return [{ cls: 'out', segs: [seg('status/  the-build/  public-log/  commits/  ecosystem/  repos/  on-my-radar/', 'g')] }];
    if (lc === 'pwd') return [{ cls: 'out', segs: [seg('/home/deep/command-center', null)] }];
    if (lc === 'date') return [{ cls: 'out', segs: [seg(new Date().toString(), null)] }];
    if (lc === 'theme') return [{ cls: 'out', segs: [seg('dark. always. this site lives at night.', null)] }];
    if (lc.startsWith('echo ')) return [{ cls: 'out', segs: [seg(cmd.slice(5), null)] }];
    if (lc === 'coffee') { const n = coffee + 1; setCoffee(n); return [{ cls: 'out', segs: [seg('  ( ( (\n   )_)_)\n  |____| ', 'gd'), seg(' cup #' + n + '. the build runs on it.', null)] }]; }
    if (lc === 'matrix') { fireConfetti({ particleCount: 140, spread: 100, colors: ['#30E060', '#E8E4DC'] }); return [{ cls: 'out', segs: [seg('wake up, neo... the vault has you.', 'g')] }]; }
    if (lc === 'party' || lc === 'confetti') { fireConfetti({ particleCount: 160, spread: 110 }); return [{ cls: 'out', segs: [seg('🎉 shipped.', 'gd')] }]; }
    if (lc === 'sudo hire' || lc === 'hire') return [{ cls: 'out', segs: [seg('smart move. ', null), seg('scheduler.zoom.us/sreedeep', 'g'), seg(' — let us build you one.', null)] }];
    if (lc.startsWith('sudo')) return [{ cls: 'out', segs: [seg('nice try. you are not root here. but ', null), seg('sudo hire', 'g'), seg(' works.', null)] }];
    if (lc === 'rm -rf /' || lc.startsWith('rm ')) return [{ cls: 'out', segs: [seg('ha. not today.', 'gd')] }];
    return [{ cls: 'out', segs: [seg(`command not found: ${lc}. try `, null), seg('help', 'g'), seg('.', null)] }];
  };
  const submit = (e) => { e.preventDefault(); const echo = { cls: 'in', segs: [seg('deep@hq ', 'p'), seg('~ % ' + val, null)] }; const out = respond(val); if (out === null) { setVal(''); return; } setLines((prev) => [...prev, echo, ...out]); setVal(''); };
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Poke around</h2>
        <span className="cc-badge live">interactive</span>
        <span className="cc-sec-note">a real shell. type a command, hit enter</span>
      </div>
      <div className="cc-term" onClick={() => inRef.current && inRef.current.focus()}>
        <div className="cc-term-bar"><span className="cc-term-dot r" /><span className="cc-term-dot y" /><span className="cc-term-dot g" /><span className="cc-term-title">deepkit — shell</span></div>
        <div className="cc-term-body" ref={bodyRef}>
          {lines.map((ln, i) => (<div key={i} className={`cc-term-line ${ln.cls}`}>{ln.segs.map((s, k) => <span key={k} className={s.c || ''}>{s.t}</span>)}</div>))}
          <form onSubmit={submit} className="cc-term-input-row">
            <span className="p">deep@hq ~ %</span>
            <input ref={inRef} className="cc-term-input" value={val} onChange={(e) => setVal(e.target.value)} spellCheck="false" autoComplete="off" aria-label="terminal input" />
          </form>
        </div>
      </div>
      <p className="cc-term-hint">try <b>whoami</b>, <b>now</b>, <b>ship</b>, <b>matrix</b>, <b>coffee</b>, <b>sudo hire</b></p>
    </div>
  );
};

/* ---------- Build lanes ---------- */
const Lane = ({ kind, label, items }) => (
  <div className="cc-card">
    <div className="cc-lane-head"><span className={`cc-lane-dot ${kind}`} /><span className="cc-lane-title">{label}</span><span className="cc-lane-count">{items.length}</span></div>
    {items.map((it) => {
      const Inner = (<React.Fragment><span className="cc-prod-name">{it.name}{it.repo && <span className="cc-arrow">↗</span>}</span><span className="cc-prod-what">{it.what}</span></React.Fragment>);
      return it.repo ? <a key={it.name} className="cc-prod" href={it.repo} target="_blank" rel="noreferrer">{Inner}</a> : <div key={it.name} className="cc-prod">{Inner}</div>;
    })}
  </div>
);

/* ---------- Page ---------- */
const CommandPage = () => {
  const D = window.DH_DATA || {};
  const brand = D.brand || {};
  const journey = Array.isArray(D.journey) ? D.journey : [];
  const sb = D.status_board || { now: [], recently: [] };
  const lanes = D.build_lanes || { live: [], building: [], next: [] };
  const companies = D.companies || [];
  const [clock, setClock] = useStateC(istClock());
  useEffectC(() => { const id = setInterval(() => setClock(istClock()), 1000); return () => clearInterval(id); }, []);
  // konami easter egg
  useEffectC(() => {
    const seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]; let i = 0;
    const h = (e) => { const k = e.keyCode || e.which; i = (k === seq[i]) ? i + 1 : (k === seq[0] ? 1 : 0); if (i === seq.length) { fireConfetti({ particleCount: 180, spread: 120 }); i = 0; } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  return (
    <main className="cc-main">
      <section className="cc-hero">
        <HeroCanvas />
        <div className="cc-hero-inner">
          <span className="cc-eyebrow"><span className="cc-eyebrow-dot" /> command center · bangalore · {clock} · systems nominal</span>
          <h1 className="cc-hero-title">Everything I am building,<br />on one screen.<span className="cc-cursor" aria-hidden="true" /></h1>
          <p className="cc-hero-prompt"><span className="cc-gt">&gt;_</span> <TypedLine /></p>
          <p className="cc-hero-sub">The operator view of the whole operation. Live status, the build queue, the public log, the ecosystem, and the code. Updated daily by <Annotate type="circle" color="#C9A84C">the machine that runs it</Annotate>.</p>
          <div className="cc-vitals">
            <div className="cc-vital"><span className="cc-vital-num green">{brand.today_day || '—'}</span><span className="cc-vital-lab">days in public</span></div>
            <div className="cc-vital"><span className="cc-vital-num">{journey.length}</span><span className="cc-vital-lab">entries logged</span></div>
            <div className="cc-vital"><span className="cc-vital-num blue">{companies.length || 12}</span><span className="cc-vital-lab">companies</span></div>
            <div className="cc-vital"><span className="cc-vital-num gold">{D.weekly_narratives_count || 0}</span><span className="cc-vital-lab">weeklies shipped</span></div>
          </div>
        </div>
      </section>

      <section className="cc-section">
        <div className="cc-sec-head"><h2 className="cc-sec-title">Status board</h2><span className="cc-badge live">now</span><span className="cc-sec-note">what has my attention this week</span></div>
        <div className="cc-grid-2">
          <div className="cc-card"><p className="cc-card-k"><span className="cc-lane-dot live" /> in motion</p>{(sb.now || []).map((r, i) => (<div key={i} className="cc-feed-row"><span className="cc-feed-tag">{r.tag}</span><p className="cc-feed-text">{r.text}</p></div>))}</div>
          <div className="cc-card"><p className="cc-card-k"><span className="cc-lane-dot next" /> just shipped</p>{(sb.recently || []).slice(0, 5).map((r, i) => (<div key={i} className="cc-feed-row"><span className="cc-feed-tag">{r.tag}</span><p className="cc-feed-text">{r.text}</p></div>))}</div>
        </div>
      </section>

      <section className="cc-section">
        <div className="cc-sec-head"><h2 className="cc-sec-title">The build</h2><span className="cc-sec-note">the champ suite · live, building, and next up</span></div>
        <div className="cc-grid-3">
          <Lane kind="live" label="live now" items={lanes.live || []} />
          <Lane kind="building" label="building" items={lanes.building || []} />
          <Lane kind="next" label="next up" items={lanes.next || []} />
        </div>
      </section>

      <Heatmap journey={journey} />
      <GitHubCal />
      <Constellation companies={companies} />
      <LiveRepos />
      <Shoutouts />
      <Terminal />

      <section className="cc-cta">
        <h2>Want the same operating system for your company?</h2>
        <p>This is what shipping in public looks like. If it is useful, let us build you one.</p>
        <div className="cc-cta-row">
          <a className="dh-btn dh-btn-primary" href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noreferrer">Book a call →</a>
          <a className="dh-btn dh-btn-ghost" href="toolkit.html">See the full toolkit</a>
        </div>
      </section>
    </main>
  );
};

window.CommandPage = CommandPage;
