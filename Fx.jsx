// Fx.jsx : the interaction kit shared by the v2 pages (pillars, toolkit, now).
// Patterns ported by hand from 21st.dev and MicroKit to the site's no-build
// React: pointer spotlight and glow border (21st.dev spotlight-card by
// berkcangumusisik, glowing-effect-card by manuarora700), stagger reveal on
// scroll (21st.dev bento-grid by lucasbassetti), count-up numbers (number
// ticker), FLIP row reorder on sortable tables (MicroKit sortable table).
// Everything respects prefers-reduced-motion and renders fine without JS,
// because the prerender ships the final state. Hook aliases suffixed F. No em dashes.

(function () {
  const { useState: useStateF, useEffect: useEffectF, useRef: useRefF, useLayoutEffect: useLayoutEffectF } = React;
  const reduced = () => !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ---------- Spot: a card whose border and surface light up under the pointer ---------- */
  // Usage: <Spot as="article" className="card" accent="var(--build)">...</Spot>
  const Spot = ({ as = 'div', className = '', accent, style, children, ...rest }) => {
    const ref = useRefF(null);
    const onMove = (e) => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (e.clientX - r.left).toFixed(1) + 'px');
      el.style.setProperty('--my', (e.clientY - r.top).toFixed(1) + 'px');
      el.setAttribute('data-hot', '1');
    };
    const onLeave = () => { const el = ref.current; if (el) el.removeAttribute('data-hot'); };
    const Tag = as;
    const st = Object.assign({}, style || {}, accent ? { '--spot': accent } : {});
    return (
      <Tag ref={ref} className={'spot ' + className} style={st} onPointerMove={onMove} onPointerLeave={onLeave} {...rest}>
        {children}
      </Tag>
    );
  };

  /* ---------- reveal: children marked data-reveal fade and rise in as they scroll into view ---------- */
  // Usage: const root = useRevealF(); <div ref={root}>...<div data-reveal style={{'--i': 2}}>
  const useRevealF = (deps) => {
    const ref = useRefF(null);
    useEffectF(() => {
      const root = ref.current; if (!root) return undefined;
      const els = Array.from(root.querySelectorAll('[data-reveal]'));
      if (!els.length) return undefined;
      if (reduced() || !('IntersectionObserver' in window)) { els.forEach((el) => el.setAttribute('data-in', '1')); return undefined; }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((en) => { if (en.isIntersecting) { en.target.setAttribute('data-in', '1'); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
      els.forEach((el) => { if (!el.hasAttribute('data-in')) io.observe(el); });
      return () => io.disconnect();
    }, deps || []);
    return ref;
  };

  /* ---------- count-up: a number that runs to its value once, when first seen ---------- */
  const useCountUpF = (value, ms = 900) => {
    const [n, setN] = useStateF(value);
    const ref = useRefF(null);
    const done = useRefF(false);
    useEffectF(() => {
      const el = ref.current;
      if (!el || done.current || reduced() || !('IntersectionObserver' in window) || !Number.isFinite(value) || value <= 0) { setN(value); return undefined; }
      let raf = 0;
      const io = new IntersectionObserver((entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect(); done.current = true;
        const t0 = performance.now();
        const tick = (t) => {
          const k = Math.min(1, (t - t0) / ms);
          const e = 1 - Math.pow(1 - k, 3);
          setN(Math.round(value * e));
          if (k < 1) raf = requestAnimationFrame(tick);
        };
        setN(0); raf = requestAnimationFrame(tick);
      }, { threshold: 0.4 });
      io.observe(el);
      return () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); };
    }, [value, ms]);
    return [n, ref];
  };

  /* ---------- FLIP: rows keep their identity and slide to their new place when a list reorders ---------- */
  // Usage: const listRef = useFlipF(order.join()); rows carry data-flip="<key>"
  const useFlipF = (signature) => {
    const ref = useRefF(null);
    const prev = useRefF(new Map());
    const snap = () => {
      const root = ref.current; const m = new Map();
      if (root) root.querySelectorAll('[data-flip]').forEach((el) => m.set(el.getAttribute('data-flip'), el.getBoundingClientRect().top));
      return m;
    };
    useLayoutEffectF(() => {
      const root = ref.current; if (!root) return;
      const before = prev.current;
      const after = snap();
      if (before.size && !reduced()) {
        root.querySelectorAll('[data-flip]').forEach((el) => {
          const k = el.getAttribute('data-flip');
          if (!before.has(k) || !after.has(k)) return;
          const dy = before.get(k) - after.get(k);
          if (Math.abs(dy) < 1) return;
          el.style.transition = 'none';
          el.style.transform = 'translateY(' + dy + 'px)';
          requestAnimationFrame(() => {
            el.style.transition = 'transform 420ms cubic-bezier(.16,1,.3,1)';
            el.style.transform = '';
            setTimeout(() => { el.style.transition = ''; }, 460);
          });
        });
      }
      prev.current = after;
    }, [signature]);
    return ref;
  };

  /* ---------- Bars: a tiny bar sparkline, one bar per bucket, values 0..max ---------- */
  const Bars = ({ values, accent, label, height = 28 }) => {
    const max = Math.max(1, ...values);
    return (
      <span className="fx-bars" style={{ height, '--bar': accent || 'var(--build)' }} role="img" aria-label={label || values.join(', ')}>
        {values.map((v, i) => <i key={i} style={{ height: Math.max(2, Math.round((v / max) * 100)) + '%' }} data-v={v} className={v ? 'on' : ''} />)}
      </span>
    );
  };

  /* ---------- Stack: a horizontal stacked bar with a legend ---------- */
  const Stack = ({ parts, total }) => {
    const sum = total || parts.reduce((a, p) => a + (p.n || 0), 0) || 1;
    return (
      <div className="fx-stack">
        <div className="fx-stack-bar" aria-hidden="true">
          {parts.map((p) => <i key={p.k} style={{ width: ((p.n / sum) * 100).toFixed(2) + '%', background: p.color }} title={p.k + ' ' + p.n} />)}
        </div>
        <ul className="fx-stack-key">
          {parts.map((p) => (
            <li key={p.k}><i style={{ background: p.color }} /><span>{p.k}</span><b>{p.n}</b><em>{Math.round((p.n / sum) * 100)}%</em></li>
          ))}
        </ul>
      </div>
    );
  };

  /* ---------- derived series from the public log ---------- */
  // weekly counts (oldest first) of entries whose text or arcs mention any of the names
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const mentionsByWeek = (journey, names, weeks = 13, endIso) => {
    const keys = (names || []).map(norm).filter((k) => k.length > 2);
    const out = new Array(weeks).fill(0);
    if (!keys.length) return out;
    const end = endIso ? Date.parse(endIso + 'T00:00:00Z') : Date.now();
    for (const e of journey || []) {
      const t = Date.parse(e.date + 'T00:00:00Z');
      const w = Math.floor((end - t) / (7 * 86400000));
      if (w < 0 || w >= weeks) continue;
      const hay = norm([e.shipping_now, e.yesterday_thread, e.raw_thought, (e.arcs || []).join(' ')].join(' '));
      if (keys.some((k) => hay.includes(k))) out[weeks - 1 - w] += 1;
    }
    return out;
  };
  // the newest entry naming any of the names, or null
  const lastMention = (journey, names) => {
    const keys = (names || []).map(norm).filter((k) => k.length > 2);
    if (!keys.length) return null;
    for (const e of journey || []) {
      const hay = norm([e.shipping_now, e.yesterday_thread, e.raw_thought, (e.arcs || []).join(' ')].join(' '));
      if (keys.some((k) => hay.includes(k))) return e;
    }
    return null;
  };

  window.Fx = { Spot, useRevealF, useCountUpF, useFlipF, Bars, Stack, mentionsByWeek, lastMention, reduced };
})();
