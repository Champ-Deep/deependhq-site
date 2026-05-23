// Ticker.jsx — the "top" output strip under the hero.
// Reads like a live system monitor. Mono-only. No emoji.

const Ticker = () => {
  const s = window.DH_DATA.status;
  // The row reads as paired key/value pills, mono, separated by dots.
  const rows = [
    { k: 'state',     v: s.state,         cls: 'tick-green pulse' },
    { k: 'loc',       v: s.location,      cls: '' },
    { k: 'clock',     v: s.time_ist,      cls: '' },
    { k: 'wx',        v: s.weather,       cls: '' },
    { k: 'last_ship', v: s.last_ship,     cls: 'tick-green' },
    { k: 'commits',   v: `${s.vault_commits} today`, cls: '' },
    { k: 'now_playing', v: s.listening,   cls: 'tick-blue' },
    { k: 'reading',   v: s.reading,       cls: 'tick-gold' },
    { k: 'coffee',    v: '/'.repeat(s.coffee) + ' (' + s.coffee + ' cups)', cls: '' },
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
          <span className="dh-ticker-val">{window.DH_DATA.status.uptime_d}d online</span>
        </span>
      </div>
    </section>
  );
};

window.Ticker = Ticker;
