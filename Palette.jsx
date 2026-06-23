// Palette.jsx — sitewide ⌘K command palette + theme accent persistence.
// Deliberately quiet: no banner, just a tiny footer hint. People discover it.
// Also exposes window.dhTheme so the terminal `theme` command can recolor live.
// Aliases suffixed K to avoid global-scope collisions with app.jsx / page.jsx.

const { useState: useStateK, useEffect: useEffectK, useRef: useRefK, useMemo: useMemoK } = React;

const DH_ACCENTS = { green: '#30E060', blue: '#4A7BF7', gold: '#C9A84C', cyan: '#22D3EE', magenta: '#E45FB0' };
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

const dhkConfetti = (o) => { if (window.confetti && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) window.confetti(Object.assign({ particleCount: 90, spread: 72, origin: { y: 0.7 }, colors: ['#30E060', '#C9A84C', '#E8E4DC', '#4A7BF7'] }, o || {})); };

const CommandPalette = () => {
  const [open, setOpen] = useStateK(false);
  const [q, setQ] = useStateK('');
  const [sel, setSel] = useStateK(0);
  const [flash, setFlash] = useStateK(null);
  const inRef = useRefK(null);
  const day = (window.DH_DATA && window.DH_DATA.brand && window.DH_DATA.brand.today_day) || '';

  const items = useMemoK(() => [
    { grp: 'go', label: 'Command Center', hint: '/command', run: () => { location.href = 'command.html'; } },
    { grp: 'go', label: 'Now', hint: '/now', run: () => { location.href = 'now.html'; } },
    { grp: 'go', label: 'Journey', hint: '/journey', run: () => { location.href = 'journey.html'; } },
    { grp: 'go', label: 'Field Notes', hint: '/field-notes', run: () => { location.href = 'field-notes.html'; } },
    { grp: 'go', label: 'Toolkit', hint: '/toolkit', run: () => { location.href = 'toolkit.html'; } },
    { grp: 'go', label: 'Home', hint: '/', run: () => { location.href = 'index.html'; } },
    { grp: 'do', label: 'Book a call', hint: 'scheduler', run: () => { window.open('https://scheduler.zoom.us/sreedeep', '_blank'); } },
    { grp: 'do', label: 'Email deep', hint: 'mailto', run: () => { location.href = 'mailto:deep@championsmail.com'; } },
    { grp: 'do', label: 'GitHub', hint: 'github.com/Champ-Deep', run: () => { window.open('https://github.com/Champ-Deep', '_blank'); } },
    { grp: 'do', label: 'LinkedIn', hint: 'in/sreedeep-surapaneni', run: () => { window.open('https://www.linkedin.com/in/sreedeep-surapaneni', '_blank'); } },
    { grp: 'fun', label: 'Confetti', hint: 'just because', run: () => { dhkConfetti(); return 'wheee.'; } },
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
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffectK(() => { if (open) { setQ(''); setSel(0); setFlash(null); setTimeout(() => inRef.current && inRef.current.focus(), 30); } }, [open]);
  useEffectK(() => { setSel(0); }, [q]);

  const exec = (it) => { if (!it) return; const r = it.run(); if (typeof r === 'string') setFlash(r); else setOpen(false); };
  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(filtered[sel]); }
  };

  if (!open) return null;
  return (
    <div className="dhk-overlay" onMouseDown={(e) => { if (e.target.classList.contains('dhk-overlay')) setOpen(false); }}>
      <div className="dhk" role="dialog" aria-label="command palette">
        <div className="dhk-in-row">
          <span className="dhk-gt">&gt;_</span>
          <input ref={inRef} className="dhk-input" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey} placeholder="jump to a page, or try a command…" aria-label="command palette" spellCheck="false" autoComplete="off" />
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
      </div>
    </div>
  );
};
window.CommandPalette = CommandPalette;
