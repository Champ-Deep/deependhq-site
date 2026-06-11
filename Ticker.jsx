// Ticker.jsx — the live "output strip" under the hero. Reads like a system monitor.
// The clock ticks client-side (no server needed). Other live fields come from an
// optional Cloudflare Worker at /api/status; if it is missing or slow, the strip
// falls back to the static values baked into DH_DATA.status. See WORKERS.md.

const { useState: useStateT, useEffect: useEffectT } = React;

const istClockNow = () => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date()) + ' IST';
  } catch (e) {
    return (window.DH_DATA.status && window.DH_DATA.status.time_ist) || '';
  }
};

const Ticker = () => {
  const base = window.DH_DATA.status || {};
  const [live, setLive] = useStateT(base);
  const [clock, setClock] = useStateT(istClockNow());

  // Live clock, ticks every second. Pure client-side.
  useEffectT(() => {
    const id = setInterval(() => setClock(istClockNow()), 1000);
    return () => clearInterval(id);
  }, []);

  // Optional live data from the Worker. Times out fast and degrades gracefully.
  useEffectT(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    fetch('/api/status', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setLive((prev) => ({
          ...prev,
          state:         d.state         ?? prev.state,
          weather:       d.weather       ?? prev.weather,
          vault_commits: d.commits_today ?? prev.vault_commits,
          listening:     d.now_playing   ?? prev.listening,
          reading:       d.reading       ?? prev.reading,
          last_ship:     d.last_ship     ?? prev.last_ship,
          uptime_d:      d.uptime_days   ?? prev.uptime_d,
        }));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, []);

  const s = live;
  const rows = [
    { k: 'state',       v: s.state,                          cls: 'tick-green pulse' },
    { k: 'loc',         v: s.location,                       cls: '' },
    { k: 'clock',       v: clock,                            cls: '' },
    { k: 'wx',          v: s.weather,                        cls: '' },
    { k: 'last_ship',   v: s.last_ship,                      cls: 'tick-green' },
    { k: 'commits',     v: `${s.vault_commits} today`,       cls: '' },
    { k: 'now_playing', v: s.listening,                      cls: 'tick-blue' },
    { k: 'reading',     v: s.reading,                        cls: 'tick-gold' },
    { k: 'coffee',      v: '/'.repeat(s.coffee || 0) + ' (' + (s.coffee || 0) + ' cups)', cls: '' },
  ];

  return (
    <section className="dh-ticker" aria-label="live system status">
      <div className="dh-ticker-rail">
        <span className="dh-ticker-prompt">$&nbsp;tail&nbsp;-f&nbsp;/var/log/deep</span>
        <span className="dh-ticker-sep">·</span>
        {rows.map((r, i) => (
          <span key={i} className="dh-ticker-cell">
            <span className="dh-ticker-key">{r.k}</span>
            <span className="dh-ticker-eq">=</span>
            <span className={`dh-ticker-val ${r.cls}`}>{r.v}</span>
            {i < rows.length - 1 && <span className="dh-ticker-sep">·</span>}
          </span>
        ))}
        <span className="dh-ticker-sep">·</span>
        <span className="dh-ticker-cell">
          <span className="dh-ticker-key">uptime</span>
          <span className="dh-ticker-eq">=</span>
          <span className="dh-ticker-val">{s.uptime_d}d online</span>
        </span>
      </div>
    </section>
  );
};

window.Ticker = Ticker;
