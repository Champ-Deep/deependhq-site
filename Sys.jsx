// Sys.jsx : shared helpers for every page. Loaded before Nav.jsx.
// Age math is done client-side on purpose: a static page can sit unbuilt for
// days, and the whole claim of this site is that it tells the truth about that.

(function () {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const toUTC = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const istToday = () => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  const isWeekend = (iso) => { const w = new Date(toUTC(iso)).getUTCDay(); return w === 0 || w === 6; };
  const addDays = (iso, n) => new Date(toUTC(iso) + n * 86400000).toISOString().slice(0, 10);
  const daysBetween = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
  const weekdaysAfter = (from, to) => { if (!from || !to || to <= from) return 0; let n = 0; for (let d = addDays(from, 1); d <= to; d = addDays(d, 1)) if (!isWeekend(d)) n++; return n; };

  const fmtDate = (iso, withYear) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}${withYear ? ', ' + y : ''}`;
  };

  // Human age of a date, and a state for colour: fresh, warn, stale.
  // `mode` = 'log' (weekday-aware, 2 weekday threshold) or a number of days.
  const ageOf = (iso, mode) => {
    if (!iso) return { label: 'no date', state: 'stale', days: null };
    const today = istToday();
    const days = daysBetween(iso, today);
    const label = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? `${days}d ago` : days < 60 ? `${Math.round(days / 7)}w ago` : `${Math.round(days / 30)}mo ago`;
    if (mode === 'log') {
      const wd = weekdaysAfter(iso, today);
      return { label, days, weekdays: wd, state: wd === 0 ? 'fresh' : wd <= 2 ? 'warn' : 'stale' };
    }
    const limit = typeof mode === 'number' ? mode : 21;
    return { label, days, state: days <= Math.floor(limit / 2) ? 'fresh' : days <= limit ? 'warn' : 'stale' };
  };

  const Age = ({ date, mode, prefix }) => {
    const a = ageOf(date, mode);
    return <span className="age" data-state={a.state} title={date || ''}>{prefix ? prefix + ' ' : ''}{a.label}</span>;
  };

  const Chip = ({ tone, children, href, title }) => {
    const cls = `chip${tone ? ' ' + tone : ''}`;
    return href ? <a className={cls} href={href} title={title}>{children}</a> : <span className={cls} title={title}>{children}</span>;
  };

  const arcTone = (c) => (c === 'green' ? 'build' : c === 'blue' ? 'think' : c === 'gold' ? 'win' : '');

  // Stale banner, only when the newest entry is more than 2 weekdays old.
  const StaleBanner = () => {
    const D = window.DH_DATA || {};
    const newest = D.journey && D.journey[0];
    if (!newest) return null;
    const a = ageOf(newest.date, 'log');
    if (a.state !== 'stale') return null;
    return (
      <div className="sys-banner" role="status">
        <div className="wrap">
          <span><b>the log is {a.weekdays} weekdays behind.</b> last entry was day {newest.day}, {fmtDate(newest.date)}. building in public means publishing the misses too.</span>
          <a href="journey.html#day-{newest.day}">read the last one →</a>
        </div>
      </div>
    );
  };

  window.Sys = { MONTHS, istToday, fmtDate, ageOf, Age, Chip, arcTone, StaleBanner, daysBetween, addDays, isWeekend };
})();
