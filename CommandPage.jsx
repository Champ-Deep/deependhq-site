// CommandPage.jsx — /command : the public Command Center.
// One screen: live vitals, status board, the build (live/building/next),
// a contribution heatmap of the public log, an animated ecosystem
// constellation, live GitHub repo cards, and a playable terminal.
// Borrows the vitals aesthetic of the old internal command-center,
// reframed for the public. No em-dashes. Aliases suffixed C to avoid
// global-scope collisions with other babel files on the page.

const { useState: useStateC, useEffect: useEffectC, useRef: useRefC, useMemo: useMemoC } = React;

const DAY_ONE = '2025-11-01';
const C_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const istClock = () => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date()) + ' IST';
  } catch (e) { return ''; }
};

const cFmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${C_MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

const relTime = (iso) => {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return days + 'd ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago';
  return Math.floor(days / 365) + 'y ago';
};

const LANG_COLOR = {
  Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  HTML: '#e34c26', CSS: '#563d7c', Shell: '#89e051', Go: '#00ADD8', null: '#8A8A8A',
};

/* ---------- Generative hero backdrop (matrix rain) ---------- */
const HeroCanvas = () => {
  const ref = useRefC(null);
  useEffectC(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    let raf, w, h, cols, drops, last = 0;
    const chars = '01<>/_$#{}[]=+*?;:';
    const resize = () => {
      const r = cv.parentElement.getBoundingClientRect();
      w = cv.width = Math.max(1, r.width); h = cv.height = Math.max(1, r.height);
      cols = Math.floor(w / 14);
      drops = new Array(cols).fill(0).map(() => Math.random() * (h / 16));
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = (ts) => {
      raf = requestAnimationFrame(draw);
      if (ts - last < 70) return; last = ts;
      ctx.fillStyle = 'rgba(13,15,20,0.30)'; ctx.fillRect(0, 0, w, h);
      ctx.font = '12px monospace';
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * 14, y = drops[i] * 16;
        ctx.fillStyle = Math.random() > 0.975 ? '#E8E4DC' : 'rgba(48,224,96,0.6)';
        ctx.fillText(ch, x, y);
        if (y > h && Math.random() > 0.975) drops[i] = 0; else drops[i] += 1;
      }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="cc-hero-canvas" aria-hidden="true" />;
};

/* ---------- Contribution heatmap (the public log) ---------- */
const Heatmap = ({ journey }) => {
  const [tip, setTip] = useStateC(null);
  const cells = useMemoC(() => {
    if (!journey.length) return [];
    const byDate = {};
    journey.forEach((e) => { byDate[e.date] = e; });
    const dates = journey.map((e) => e.date).sort();
    const start = new Date(dates[0] + 'T00:00:00Z');
    const end = new Date((window.DH_DATA.brand && window.DH_DATA.brand.today_date ? window.DH_DATA.brand.today_date : dates[dates.length - 1]) + 'T00:00:00Z');
    const out = [];
    const pad = start.getUTCDay(); // leading blanks so first cell lands on its weekday row
    for (let i = 0; i < pad; i++) out.push({ blank: true, key: 'p' + i });
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      const d = new Date(t);
      const iso = d.toISOString().slice(0, 10);
      out.push({ iso, entry: byDate[iso] || null, key: iso });
    }
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
              : <span
                  key={c.key}
                  className={`cc-heat-cell ${c.entry ? 'lv-' + c.entry.arc_color : ''}`}
                  onMouseEnter={(e) => enter(e, c)}
                  onMouseMove={(e) => enter(e, c)}
                />
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

/* ---------- Ecosystem constellation ---------- */
const Constellation = ({ companies }) => {
  const [hover, setHover] = useStateC(null);
  const [tip, setTip] = useStateC(null);
  const VW = 800, VH = 460, cx = 400, cy = 230, rx = 320, ry = 168;
  const ACC = ['#30E060', '#4A7BF7', '#C9A84C'];
  const nodes = useMemoC(() => (companies || []).map((co, i) => {
    const n = Math.max(companies.length, 1);
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    return {
      ...co,
      x: cx + rx * Math.cos(ang),
      y: cy + ry * Math.sin(ang),
      color: ACC[i % 3],
      dur: (6 + (i % 5)).toFixed(1) + 's',
      delay: (-(i * 0.6)).toFixed(1) + 's',
    };
  }), [companies]);

  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">The ecosystem</h2>
        <span className="cc-sec-note">{(companies || []).length} companies, one operating system · hover a node</span>
      </div>
      <div className="cc-constellation" onMouseLeave={() => { setHover(null); setTip(null); }}>
        <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ecosystem of companies">
          {nodes.map((n, i) => (
            <line key={'e' + i} className="cc-edge" x1={cx} y1={cy} x2={n.x} y2={n.y}
              style={{ opacity: hover === null ? 0.3 : (hover === i ? 0.85 : 0.08) }} />
          ))}
          {/* hub */}
          <g>
            <circle className="cc-node-hub" cx={cx} cy={cy} r="34" />
            <text x={cx} y={cy - 2} className="cc-node-lab" style={{ fill: '#E8E4DC', fontSize: 13 }}>deep</text>
            <text x={cx} y={cy + 13} className="cc-node-lab" style={{ fill: '#30E060', fontSize: 13 }}>{'>_'}</text>
          </g>
          {nodes.map((n, i) => (
            <g key={i} className="cc-node-g cc-float" style={{ '--cc-dur': n.dur, animationDelay: n.delay }}
              onMouseEnter={(e) => { setHover(i); setTip({ x: e.clientX, y: e.clientY, n }); }}
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, n })}>
              <circle className="cc-node" cx={n.x} cy={n.y} r={hover === i ? 11 : 7}
                fill={n.color} style={{ filter: `drop-shadow(0 0 7px ${n.color})` }} />
              <text className="cc-node-lab" x={n.x} y={n.y + 24}>{n.name}</text>
            </g>
          ))}
        </svg>
        {tip && (
          <div className="cc-tip" style={{ left: tip.x, top: tip.y }}>
            <div className="cc-tip-day">{tip.n.tag || 'venture'}</div>
            <div className="cc-tip-text"><b style={{ color: '#E8E4DC' }}>{tip.n.name}</b><br />{tip.n.desc}</div>
          </div>
        )}
      </div>
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
    <div className="cc-repo-top">
      <span className="cc-repo-name">{name}</span>
      <span className="cc-repo-meta" aria-hidden="true">↗</span>
    </div>
    <div className="cc-repo-desc">{desc}</div>
    <div className="cc-repo-meta">
      <span><span className="cc-lang-dot" style={{ background: LANG_COLOR[lang] || '#8A8A8A' }} />{lang || 'code'}</span>
      {updated && <span>pushed {updated}</span>}
    </div>
  </a>
);

const LiveRepos = () => {
  const [repos, setRepos] = useStateC(null); // null=loading, []=fallback
  const [count, setCount] = useStateC(null);
  useEffectC(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    fetch('https://api.github.com/users/Champ-Deep/repos?per_page=100&sort=pushed', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !Array.isArray(data)) { setRepos([]); return; }
        setCount(data.length);
        const byName = {};
        data.forEach((r) => { byName[(r.name || '').toLowerCase()] = r; });
        const merged = REPO_SHOW.map((s) => {
          const r = byName[s.m];
          return r
            ? { name: s.n, desc: s.d || r.description, lang: r.language || s.lang, updated: relTime(r.pushed_at), url: r.html_url }
            : { name: s.n, desc: s.d, lang: s.lang, updated: null, url: 'https://github.com/Champ-Deep/' + (r ? r.name : '') };
        });
        setRepos(merged);
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
      <div className="cc-repos">
        {list === null
          ? [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="cc-repo-skel" />)
          : list.map((r) => <RepoCard key={r.name} {...r} />)}
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
  const BOOT = [
    { cls: 'out', segs: [seg('deepkit shell v1.0 · ', 'g'), seg('type ', null), seg('help', 'g'), seg(' to start. try ', null), seg('now', 'g'), seg(', ', null), seg('ship', 'g'), seg(', ', null), seg('stack', 'g'), seg('.', null)] },
  ];
  const [lines, setLines] = useStateC(BOOT);
  const [val, setVal] = useStateC('');
  const bodyRef = useRefC(null);
  const inRef = useRefC(null);

  useEffectC(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [lines]);

  const respond = (raw) => {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return [];
    if (cmd === 'clear') { setLines(BOOT); return null; }
    if (cmd === 'help') return [{ cls: 'out', segs: [seg('commands: ', null), seg('whoami now ship stack companies repos contact clear', 'g')] }];
    if (cmd === 'whoami') return [{ cls: 'out', segs: [seg('sreedeep surapaneni · group cmo, champions group. building an ai operating system across 12 companies. shipping code between meetings, day ' + (brand.today_day || '') + '.', null)] }];
    if (cmd === 'now') {
      const f = (D.now && D.now.focus) || [];
      return f.slice(0, 4).map((x) => ({ cls: 'out', segs: [seg((x.k || '').toLowerCase() + ' ', x.color === 'gold' ? 'gd' : (x.color === 'blue' ? 'bl' : 'g')), seg('· ' + x.text, null)] }));
    }
    if (cmd === 'ship') return [{ cls: 'out', segs: [seg('day ' + (j0.day || '') + ' · ', 'g'), seg(j0.shipping_now || 'shipping.', null)] }];
    if (cmd === 'stack') {
      const live = (lanes.live || []).map((x) => x.name).join(', ');
      const building = (lanes.building || []).map((x) => x.name).join(', ');
      return [
        { cls: 'out', segs: [seg('live: ', 'g'), seg(live || 'champmail, champdf, champvoice', null)] },
        { cls: 'out', segs: [seg('building: ', 'bl'), seg(building || 'champ iq, champset', null)] },
      ];
    }
    if (cmd === 'companies') return [{ cls: 'out', segs: [seg(companies.join(' · ') || '12 ventures', null)] }];
    if (cmd === 'repos') return [{ cls: 'out', segs: [seg('github.com/Champ-Deep', 'g'), seg(' · 37 public repos and counting.', null)] }];
    if (cmd === 'contact') return [{ cls: 'out', segs: [seg('book: ', null), seg('scheduler.zoom.us/sreedeep', 'g'), seg('  ·  ', null), seg('github.com/Champ-Deep', 'g')] }];
    return [{ cls: 'out', segs: [seg(`command not found: ${cmd}. try `, null), seg('help', 'g'), seg('.', null)] }];
  };

  const submit = (e) => {
    e.preventDefault();
    const echo = { cls: 'in', segs: [seg('deep@hq ', 'p'), seg('~ % ' + val, null)] };
    const out = respond(val);
    if (out === null) { setVal(''); return; } // clear handled
    setLines((prev) => [...prev, echo, ...out]);
    setVal('');
  };

  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Poke around</h2>
        <span className="cc-badge live">interactive</span>
        <span className="cc-sec-note">a real shell. type a command, hit enter</span>
      </div>
      <div className="cc-term" onClick={() => inRef.current && inRef.current.focus()}>
        <div className="cc-term-bar">
          <span className="cc-term-dot r" /><span className="cc-term-dot y" /><span className="cc-term-dot g" />
          <span className="cc-term-title">deepkit — shell</span>
        </div>
        <div className="cc-term-body" ref={bodyRef}>
          {lines.map((ln, i) => (
            <div key={i} className={`cc-term-line ${ln.cls}`}>
              {ln.segs.map((s, k) => <span key={k} className={s.c || ''}>{s.t}</span>)}
            </div>
          ))}
          <form onSubmit={submit} className="cc-term-input-row">
            <span className="p">deep@hq ~ %</span>
            <input ref={inRef} className="cc-term-input" value={val}
              onChange={(e) => setVal(e.target.value)} spellCheck="false" autoComplete="off"
              aria-label="terminal input" />
          </form>
        </div>
      </div>
      <p className="cc-term-hint">try <b>whoami</b>, <b>now</b>, <b>ship</b>, <b>stack</b>, <b>companies</b>, <b>contact</b></p>
    </div>
  );
};

/* ---------- Build lanes ---------- */
const Lane = ({ kind, label, items }) => (
  <div className="cc-card">
    <div className="cc-lane-head">
      <span className={`cc-lane-dot ${kind}`} />
      <span className="cc-lane-title">{label}</span>
      <span className="cc-lane-count">{items.length}</span>
    </div>
    {items.map((it) => {
      const Inner = (
        <React.Fragment>
          <span className="cc-prod-name">{it.name}{it.repo && <span className="cc-arrow">↗</span>}</span>
          <span className="cc-prod-what">{it.what}</span>
        </React.Fragment>
      );
      return it.repo
        ? <a key={it.name} className="cc-prod" href={it.repo} target="_blank" rel="noreferrer">{Inner}</a>
        : <div key={it.name} className="cc-prod">{Inner}</div>;
    })}
  </div>
);

/* ---------- Page ---------- */
const CommandPage = () => {
  const D = window.DH_DATA || {};
  const brand = D.brand || {};
  const journey = Array.isArray(D.journey) ? D.journey : [];
  const sb = D.status_board || { now: [], recently: [] };
  const lanes = D.build_lanes || { live: [], building: [], next: [], updated: '' };
  const companies = D.companies || [];
  const [clock, setClock] = useStateC(istClock());
  useEffectC(() => { const id = setInterval(() => setClock(istClock()), 1000); return () => clearInterval(id); }, []);

  return (
    <main className="cc-main">
      {/* HERO */}
      <section className="cc-hero">
        <HeroCanvas />
        <div className="cc-hero-inner">
          <span className="cc-eyebrow"><span className="cc-eyebrow-dot" /> command center · bangalore · {clock} · systems nominal</span>
          <h1 className="cc-hero-title">Everything I am building,<br />on one screen.<span className="cc-cursor">▊</span></h1>
          <p className="cc-hero-sub">The operator view of the whole operation. Live status, the build queue, the public log, the ecosystem, and the code. Updated daily by the machine that runs it.</p>
          <div className="cc-vitals">
            <div className="cc-vital"><span className="cc-vital-num green">{brand.today_day || '—'}</span><span className="cc-vital-lab">days in public</span></div>
            <div className="cc-vital"><span className="cc-vital-num">{journey.length}</span><span className="cc-vital-lab">entries logged</span></div>
            <div className="cc-vital"><span className="cc-vital-num blue">{companies.length || 12}</span><span className="cc-vital-lab">companies</span></div>
            <div className="cc-vital"><span className="cc-vital-num gold">{D.weekly_narratives_count || 0}</span><span className="cc-vital-lab">weeklies shipped</span></div>
          </div>
        </div>
      </section>

      {/* STATUS BOARD */}
      <section className="cc-section">
        <div className="cc-sec-head">
          <h2 className="cc-sec-title">Status board</h2>
          <span className="cc-badge live">now</span>
          <span className="cc-sec-note">what has my attention this week</span>
        </div>
        <div className="cc-grid-2">
          <div className="cc-card">
            <p className="cc-card-k"><span className="cc-lane-dot live" /> in motion</p>
            {(sb.now || []).map((r, i) => (
              <div key={i} className="cc-feed-row"><span className="cc-feed-tag">{r.tag}</span><p className="cc-feed-text">{r.text}</p></div>
            ))}
          </div>
          <div className="cc-card">
            <p className="cc-card-k"><span className="cc-lane-dot next" /> just shipped</p>
            {(sb.recently || []).slice(0, 5).map((r, i) => (
              <div key={i} className="cc-feed-row"><span className="cc-feed-tag">{r.tag}</span><p className="cc-feed-text">{r.text}</p></div>
            ))}
          </div>
        </div>
      </section>

      {/* THE BUILD */}
      <section className="cc-section">
        <div className="cc-sec-head">
          <h2 className="cc-sec-title">The build</h2>
          <span className="cc-sec-note">the champ suite · live, building, and next up</span>
        </div>
        <div className="cc-grid-3">
          <Lane kind="live" label="live now" items={lanes.live || []} />
          <Lane kind="building" label="building" items={lanes.building || []} />
          <Lane kind="next" label="next up" items={lanes.next || []} />
        </div>
      </section>

      <Heatmap journey={journey} />
      <Constellation companies={companies} />
      <LiveRepos />
      <Terminal />

      {/* CTA */}
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
