// Palette.jsx : sitewide ⌘K command palette + theme accent persistence.
// Deliberately quiet: no banner, just a tiny footer hint. People discover it.
// Also exposes window.dhTheme so the terminal `theme` command can recolor live.
// Aliases suffixed K to avoid global-scope collisions with app.jsx / page.jsx.

const { useState: useStateK, useEffect: useEffectK, useRef: useRefK, useMemo: useMemoK } = React;

const DH_ACCENTS = { green: '#30E060', blue: '#4A7BF7', gold: '#F4A62A', cyan: '#22D3EE', magenta: '#E45FB0' };
window.dhTheme = {
  set(name) {
    if (name === 'reset') { document.documentElement.style.removeProperty('--color-accent-primary'); try { localStorage.removeItem('dh-accent'); } catch (e) {} return 'accent reset to matrix green.'; }
    const c = DH_ACCENTS[name]; if (!c) return null;
    document.documentElement.style.setProperty('--color-accent-primary', c);
    try { localStorage.setItem('dh-accent', name); } catch (e) {}
    return 'accent → ' + name + '.';
  },
  apply() { try { const n = localStorage.getItem('dh-accent'); if (n && DH_ACCENTS[n]) document.documentElement.style.setProperty('--color-accent-primary', DH_ACCENTS[n]); } catch (e) {} },
};
window.dhTheme.apply();

const dhkTok = (name, fb) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb; } catch (e) { return fb; } };
const dhkConfetti = (o) => { if (window.confetti && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) window.confetti(Object.assign({ particleCount: 90, spread: 72, origin: { y: 0.7 }, colors: [dhkTok('--build', '#30E060'), dhkTok('--win', '#F4A62A'), dhkTok('--text', '#F4EBD9'), dhkTok('--think', '#4A7BF7')] }, o || {})); };

/* ---------- the deepkit shell, now behind cmd+K ---------- */
// Moved here from the retired /command page (Oct 2026). Pick "Terminal" in the
// palette, or type > as the first character, and the palette becomes a shell.
// Escape goes back to the palette. The commands read the same data.js the
// pages do, so nothing here can go stale on its own.
const dhkSeg = (t, c) => ({ t, c });
const DhkTerminal = ({ onExit }) => {
  const D = window.DH_DATA || {};
  const j0 = (D.journey && D.journey[0]) || {};
  const companies = (D.companies || []).map((c) => c.name);
  const lanes = D.build_lanes || { live: [], building: [], next: [] };
  const BOOT = [{ cls: 'out', segs: [dhkSeg('deepkit shell v1.1 · ', 'g'), dhkSeg('type ', null), dhkSeg('help', 'g'), dhkSeg(' to start. hidden commands exist. try ', null), dhkSeg('matrix', 'g'), dhkSeg(', ', null), dhkSeg('coffee', 'g'), dhkSeg(' or ', null), dhkSeg('sudo hire', 'g'), dhkSeg('. esc goes back.', null)] }];
  const [lines, setLines] = useStateK(BOOT);
  const [val, setVal] = useStateK('');
  const [coffee, setCoffee] = useStateK(3);
  const bodyRef = useRefK(null); const inRef = useRefK(null);
  useEffectK(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [lines]);
  useEffectK(() => { setTimeout(() => inRef.current && inRef.current.focus(), 30); }, []);
  const go = (href) => { setTimeout(() => { location.href = href; }, 350); };
  const respond = (raw) => {
    const cmd = raw.trim(); const lc = cmd.toLowerCase();
    if (!lc) return [];
    if (lc === 'clear') { setLines(BOOT); return null; }
    if (lc === 'exit' || lc === 'q' || lc === 'quit') { onExit(); return null; }
    if (lc === 'help') return [{ cls: 'out', segs: [dhkSeg('commands: ', null), dhkSeg('whoami now ship stack companies repos commits contact ls cd pwd date echo theme coffee matrix party sudo clear exit', 'g')] }];
    if (lc === 'whoami') return [{ cls: 'out', segs: [dhkSeg('sreedeep surapaneni · group cmo, champions group. building an ai operating system across 12 companies. shipping code between meetings, day ' + ((D.brand && D.brand.today_day) || '') + ' in public.', null)] }];
    if (lc === 'now') { const f = (D.now && D.now.focus) || []; return f.slice(0, 4).map((x) => ({ cls: 'out', segs: [dhkSeg((x.k || '').toLowerCase() + ' ', x.color === 'gold' ? 'gd' : (x.color === 'blue' ? 'bl' : 'g')), dhkSeg(x.text || '', null)] })); }
    if (lc === 'ship') { dhkConfetti(); return [{ cls: 'out', segs: [dhkSeg('day ' + (j0.day || '') + ' · ', 'g'), dhkSeg(j0.shipping_now || 'shipping.', null)] }]; }
    if (lc === 'stack') { const live = (lanes.live || []).map((x) => x.name).join(', '); const building = (lanes.building || []).map((x) => x.name).join(', '); return [{ cls: 'out', segs: [dhkSeg('live: ', 'g'), dhkSeg(live || 'see /toolkit', null)] }, { cls: 'out', segs: [dhkSeg('building: ', 'bl'), dhkSeg(building || 'see /now', null)] }]; }
    if (lc === 'companies') return [{ cls: 'out', segs: [dhkSeg(companies.join(' · ') || '12 ventures', null)] }];
    if (lc === 'repos') { go('toolkit.html#repos'); return [{ cls: 'out', segs: [dhkSeg('github.com/Champ-Deep', 'g'), dhkSeg(' · opening the workshop on /toolkit.', null)] }]; }
    if (lc === 'commits') { go('journey.html#commits'); return [{ cls: 'out', segs: [dhkSeg('opening the commit skyline on /journey.', 'g')] }]; }
    if (lc === 'contact') return [{ cls: 'out', segs: [dhkSeg('book: ', null), dhkSeg('scheduler.zoom.us/sreedeep', 'g'), dhkSeg('  ·  ', null), dhkSeg('github.com/Champ-Deep', 'g')] }];
    if (lc === 'ls') return [{ cls: 'out', segs: [dhkSeg('journey/  writing/  pillars/  toolkit/  now/', 'g')] }];
    if (lc.startsWith('cd ')) { const p = lc.slice(3).replace(/^\/|\/$/g, ''); const ok = ['journey', 'writing', 'pillars', 'toolkit', 'now', 'home']; if (ok.includes(p)) { go(p === 'home' ? 'index.html' : p + '.html'); return [{ cls: 'out', segs: [dhkSeg('cd /' + p, 'g')] }]; } return [{ cls: 'out', segs: [dhkSeg('no such directory. try ', null), dhkSeg('ls', 'g'), dhkSeg('.', null)] }]; }
    if (lc === 'pwd') return [{ cls: 'out', segs: [dhkSeg('/home/deep/' + (location.pathname.replace(/^\/|\.html$/g, '') || 'home'), null)] }];
    if (lc === 'date') return [{ cls: 'out', segs: [dhkSeg(new Date().toString(), null)] }];
    if (lc === 'theme' || lc.startsWith('theme ')) {
      const arg = lc.split(/\s+/)[1];
      if (!arg) return [{ cls: 'out', segs: [dhkSeg('usage: ', null), dhkSeg('theme green|blue|gold|cyan|magenta|reset', 'g')] }];
      const r = window.dhTheme ? window.dhTheme.set(arg) : null;
      return [{ cls: 'out', segs: r ? [dhkSeg(r, 'g')] : [dhkSeg('unknown theme. try green, blue, gold, cyan, magenta, reset.', null)] }];
    }
    if (lc.startsWith('echo ')) return [{ cls: 'out', segs: [dhkSeg(cmd.slice(5), null)] }];
    if (lc === 'coffee') { const n = coffee + 1; setCoffee(n); return [{ cls: 'out', segs: [dhkSeg('  ( ( (\n   )_)_)\n  |____| ', 'gd'), dhkSeg(' cup #' + n + '. the build runs on it.', null)] }]; }
    if (lc === 'matrix') { dhkConfetti({ particleCount: 140, spread: 100, colors: [dhkTok('--build', '#30E060'), dhkTok('--text', '#F4EBD9')] }); return [{ cls: 'out', segs: [dhkSeg('wake up, neo... the vault has you.', 'g')] }]; }
    if (lc === 'party' || lc === 'confetti') { dhkConfetti({ particleCount: 160, spread: 110 }); return [{ cls: 'out', segs: [dhkSeg('🎉 shipped.', 'gd')] }]; }
    if (lc === 'sudo hire' || lc === 'hire') return [{ cls: 'out', segs: [dhkSeg('smart move. ', null), dhkSeg('scheduler.zoom.us/sreedeep', 'g'), dhkSeg('. let us build you one.', null)] }];
    if (lc.startsWith('sudo')) return [{ cls: 'out', segs: [dhkSeg('nice try. you are not root here. but ', null), dhkSeg('sudo hire', 'g'), dhkSeg(' works.', null)] }];
    if (lc === 'rm -rf /' || lc.startsWith('rm ')) return [{ cls: 'out', segs: [dhkSeg('ha. not today.', 'gd')] }];
    return [{ cls: 'out', segs: [dhkSeg('command not found: ' + lc + '. try ', null), dhkSeg('help', 'g'), dhkSeg('.', null)] }];
  };
  const submit = (e) => {
    e.preventDefault();
    const echo = { cls: 'in', segs: [dhkSeg('deep@hq ', 'p'), dhkSeg('~ % ' + val, null)] };
    const out = respond(val);
    if (out === null) { setVal(''); return; }
    setLines((l) => l.concat([echo], out));
    setVal('');
  };
  return (
    <div className="dhk-term" onClick={() => inRef.current && inRef.current.focus()}>
      <div className="dhk-term-body" ref={bodyRef}>
        {lines.map((ln, i) => (<div key={i} className={'dhk-term-line ' + ln.cls}>{ln.segs.map((s, k) => <span key={k} className={s.c || ''}>{s.t}</span>)}</div>))}
        <form onSubmit={submit} className="dhk-term-row">
          <span className="p">deep@hq ~ %</span>
          <input ref={inRef} className="dhk-term-input" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onExit(); } }} spellCheck="false" autoComplete="off" aria-label="terminal input" />
        </form>
      </div>
      <p className="dhk-term-hint">try <b>whoami</b>, <b>now</b>, <b>ship</b>, <b>commits</b>, <b>matrix</b>, <b>coffee</b>, <b>sudo hire</b> · esc to go back</p>
    </div>
  );
};

const CommandPalette = () => {
  const [open, setOpen] = useStateK(false);
  const [q, setQ] = useStateK('');
  const [sel, setSel] = useStateK(0);
  const [flash, setFlash] = useStateK(null);
  const [mode, setMode] = useStateK('palette'); // 'palette' | 'term'
  const inRef = useRefK(null);
  const day = (window.DH_DATA && window.DH_DATA.brand && window.DH_DATA.brand.today_day) || '';

  const items = useMemoK(() => [
    { grp: 'go', label: 'Mission Log', hint: '/journey', run: () => { location.href = 'journey.html'; } },
    { grp: 'go', label: 'Writing', hint: '/writing', run: () => { location.href = 'writing.html'; } },
    { grp: 'go', label: 'Pillars', hint: '/pillars', run: () => { location.href = 'pillars.html'; } },
    { grp: 'go', label: 'Stack', hint: '/toolkit', run: () => { location.href = 'toolkit.html'; } },
    { grp: 'go', label: 'Now', hint: '/now', run: () => { location.href = 'now.html'; } },
    { grp: 'go', label: 'Home', hint: '/', run: () => { location.href = 'index.html'; } },
    { grp: 'go', label: 'Commit skyline', hint: '/journey#commits', run: () => { location.href = 'journey.html#commits'; } },
    { grp: 'go', label: 'Live repos', hint: '/toolkit#repos', run: () => { location.href = 'toolkit.html#repos'; } },
    { grp: 'do', label: 'Book a call', hint: 'scheduler', run: () => { window.open('https://scheduler.zoom.us/sreedeep', '_blank'); } },
    { grp: 'do', label: 'Email deep', hint: 'mailto', run: () => { location.href = 'mailto:deep@championsmail.com'; } },
    { grp: 'do', label: 'GitHub', hint: 'github.com/Champ-Deep', run: () => { window.open('https://github.com/Champ-Deep', '_blank'); } },
    { grp: 'do', label: 'LinkedIn', hint: 'in/sreedeep-surapaneni', run: () => { window.open('https://www.linkedin.com/in/sreedeep-surapaneni', '_blank'); } },
    { grp: 'fun', label: 'Terminal', hint: 'deepkit shell, or type >', run: () => { setMode('term'); return true; } },
    { grp: 'fun', label: 'Confetti', hint: 'just because', run: () => { dhkConfetti(); return 'wheee.'; } },
    { grp: 'fun', label: 'mare', hint: 'sundays at sunrise', run: () => { if (document.querySelector('.home-wx')) { window.dispatchEvent(new CustomEvent('dh:mare')); return undefined; } return 'the gray mare lives on the homepage. type d e e p there.'; } },
    { grp: 'fun', label: 'whoami', hint: 'who is this', run: () => 'sreedeep · group cmo, building an ai operating system across 12 companies. day ' + day + '.' },
    { grp: 'fun', label: 'theme green', hint: 'matrix', run: () => window.dhTheme.set('green') },
    { grp: 'fun', label: 'theme blue', hint: 'arc', run: () => window.dhTheme.set('blue') },
    { grp: 'fun', label: 'theme gold', hint: 'win', run: () => window.dhTheme.set('gold') },
    { grp: 'fun', label: 'theme cyan', hint: 'cold', run: () => window.dhTheme.set('cyan') },
    { grp: 'fun', label: 'theme magenta', hint: 'loud', run: () => window.dhTheme.set('magenta') },
    { grp: 'fun', label: 'theme reset', hint: 'back to green', run: () => window.dhTheme.set('reset') },
  ], [day]);

  const filtered = useMemoK(() => { const s = q.trim().toLowerCase(); if (!s) return items; return items.filter((it) => it.label.toLowerCase().includes(s) || (it.hint || '').toLowerCase().includes(s) || it.grp.includes(s)); }, [q, items]);

  useEffectK(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setOpen((o) => !o); }
      else if (e.key === 'Escape') setOpen(false); // the shell swallows its own escape and drops back to the palette
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffectK(() => { if (open) { setQ(''); setSel(0); setFlash(null); setMode('palette'); setTimeout(() => inRef.current && inRef.current.focus(), 30); } }, [open]);
  useEffectK(() => { setSel(0); }, [q]);

  const exec = (it) => { if (!it) return; const r = it.run(); if (r === true) return; if (typeof r === 'string') setFlash(r); else setOpen(false); };
  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(filtered[sel]); }
  };

  if (!open) return null;
  return (
    <div className="dhk-overlay" onMouseDown={(e) => { if (e.target.classList.contains('dhk-overlay')) setOpen(false); }}>
      <div className="dhk" role="dialog" aria-label="command palette">
        {mode === 'term' ? (
          <React.Fragment>
            <div className="dhk-in-row"><span className="dhk-gt">&gt;_</span><span className="dhk-label" style={{ fontFamily: 'var(--font-mono)' }}>deepkit · shell</span><span className="dhk-esc">esc</span></div>
            <DhkTerminal onExit={() => setMode('palette')} />
          </React.Fragment>
        ) : (
          <React.Fragment>
        <div className="dhk-in-row">
          <span className="dhk-gt">&gt;_</span>
          <input ref={inRef} className="dhk-input" value={q} onChange={(e) => { const v = e.target.value; if (v.startsWith('>')) { setQ(''); setMode('term'); } else setQ(v); }} onKeyDown={onInputKey} placeholder="jump to a page, try a command, or > for the shell" aria-label="command palette" spellCheck="false" autoComplete="off" />
          <span className="dhk-esc">esc</span>
        </div>
        {flash && <div className="dhk-flash"><span className="dhk-gt">&gt;_</span>{flash}</div>}
        <div className="dhk-list">
          {filtered.length === 0 && <div className="dhk-empty">&gt;_ nothing matches "{q}". try a page name.</div>}
          {filtered.map((it, i) => (
            <button key={it.label} className={`dhk-item ${i === sel ? 'active' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => exec(it)}>
              <span className={`dhk-grp grp-${it.grp}`}>{it.grp}</span>
              <span className="dhk-label">{it.label}</span>
              <span className="dhk-hint">{it.hint}</span>
            </button>
          ))}
        </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
};
window.CommandPalette = CommandPalette;
