// Home.jsx : the homepage sections, Sep 2026 system.
// Editorial shell (identity, essays, ways in) around an operator core (today,
// the log strip, the stack, the twelve). Every number is derived in data.js.

(() => {
const { Age, Chip, fmtDate, arcTone } = window.Sys;
const DH = window.DH_DATA;

// ---------------------------------------------------------------- hero
const HeroBento = () => {
  const e = DH.journey[0];
  const st = DH.stats || {};
  const link = (arc) => ((e.company_links || []).find((l) => l.arc === arc && l.slug) || {}).slug;
  return (
    <header className="hero sys" id="top">
      <div className="wrap hero-grid">
        <div className="hero-rail mode-operator" aria-label="log numbers">
          <div className="card stat"><b className="build">{st.days_public}</b><span>days in public</span></div>
          <div className="card stat"><b>{st.entries_this_month}</b><span>entries this month</span></div>
          <div className="card stat"><b>{st.streak_weekdays}</b><span>weekday streak</span></div>
        </div>

        <div className="hero-main">
          <div className="card hero-id mode-editorial">
            <span className="who">Sreedeep Surapaneni · Bangalore</span>
            <h1>Past the hype cycle. <em>Into the infrastructure.</em></h1>
            <p className="line">group cmo, champions group. 12 companies, one vault. i ship something every weekday and write it down here, 3 pm to 2 am ist.</p>
            <div className="ctas">
              <a className="btn btn-gold" href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noopener noreferrer">Book a call</a>
              <a className="alt" href={`journey.html#day-${e.day}`}>or start with <b>what shipped today →</b></a>
            </div>
            <div className="desk">
              <span className="k">on my desk, last 30 days</span>
              <span className="chips">{(st.arcs_30d || []).map((a) => <Chip key={a.arc} tone="win">{a.arc} <b style={{ color: 'var(--text)', fontWeight: 600 }}>{a.n}</b></Chip>)}</span>
            </div>
          </div>

          <div className="card hero-today mode-operator">
            <span className="eyebrow">live from the log <Age date={e.date} mode="log" /></span>
            <div className="today-head">
              <span className="day">day {e.day}</span>
              <span className="date">{fmtDate(e.date, true)}</span>
              <span className="mood" aria-label="mood">{e.mood}</span>
            </div>
            <p className="ship">{e.shipping_now}</p>
            {e.yesterday_thread && <p className="thread">{e.yesterday_thread}</p>}
            <div className="chips">
              {(e.arcs || []).slice(0, 3).map((a) => <Chip key={a} tone={arcTone(e.arc_color)} href={link(a) ? `company.html?slug=${encodeURIComponent(link(a))}` : undefined}>{a}</Chip>)}
            </div>
            <div className="today-foot">
              <a href={`journey.html#day-${e.day}`}>read the full entry →</a>
              {DH.journey[1] && <a href={`journey.html#day-${DH.journey[1].day}`} className="dim">yesterday: day {DH.journey[1].day}</a>}
            </div>
          </div>
        </div>

        <div className="hero-rail mode-operator" aria-label="site numbers">
          <div className="card stat"><b>{st.companies}</b><span>companies</span></div>
          <div className="card stat"><b className="win">{st.essays}</b><span>essays</span></div>
          <div className="card stat"><b>{st.entries}</b><span>public entries</span></div>
        </div>
      </div>
    </header>
  );
};

// ------------------------------------------------------------ log strip
const Heatmap = () => {
  const H = DH.heatmap;
  const cols = [];
  for (let i = 0; i < H.weeks; i++) cols.push(H.cells.slice(i * 7, i * 7 + 7));
  const logged = H.cells.filter((c) => c.day).length;
  return (
    <div>
      <div className="heat" role="img" aria-label={`${logged} logged days in the last ${H.weeks} weeks, ${fmtDate(H.start, true)} to ${fmtDate(H.end, true)}`}>
        {cols.map((col, i) => (
          <div className="col" key={i}>
            {col.map((c) => c.day
              ? <a key={c.date} className={`cell ${c.arc_color}`} href={`journey.html#day-${c.day}`} title={`day ${c.day} · ${fmtDate(c.date)} · ${c.ship}`} aria-label={`day ${c.day}, ${fmtDate(c.date)}`} />
              : <span key={c.date} className={`cell${c.weekend ? ' weekend' : ''}${c.future ? ' future' : ''}`} aria-hidden="true" />)}
          </div>
        ))}
      </div>
      <div className="heat-legend">
        <span><i className="dot green" /> building</span>
        <span><i className="dot blue" /> thinking</span>
        <span><i className="dot gold" /> a real outcome</span>
        <span><i className="dot" style={{ background: 'var(--card-2)' }} /> no entry</span>
        <span className="dim">{fmtDate(H.start)} to {fmtDate(H.end)} · hover or focus a cell, click to open the day</span>
      </div>
    </div>
  );
};

const LogStrip = () => {
  const st = DH.stats || {};
  const days = (DH.recent || []).slice(0, 10);
  return (
    <section className="section sys mode-operator" id="log" aria-labelledby="log-h">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">the public log</span>
            <h2 id="log-h">Every weekday, one entry. No skipping.</h2>
            <p className="lead">{st.entries} entries since {fmtDate(st.first_entry, true)}. {st.entries_30d} in the last 30 days. the gaps are real and they stay visible.</p>
          </div>
          <a className="section-link" href="journey.html">the whole log →</a>
        </div>
        <div className="heat-wrap">
          <div className="card"><Heatmap /></div>
          <div className="heat-side">
            <div className="card stat"><b className="build">{st.entries_30d}</b><span>last 30 days</span></div>
            <div className="card stat"><b>{st.streak_weekdays}</b><span>weekday streak</span></div>
            <div className="card stat"><b className="win">{st.companies_active_90d}</b><span>companies in the log, 90d</span></div>
            <div className="card stat"><b>{(st.arcs_30d && st.arcs_30d[0]) ? st.arcs_30d[0].n : 0}</b><span>{(st.arcs_30d && st.arcs_30d[0]) ? `${st.arcs_30d[0].arc} entries, 30d` : 'busiest arc'}</span></div>
          </div>
        </div>
        <div className="days">
          {days.map((d) => (
            <a key={d.day} className={`card link day-card ${d.arc_color}`} href={`journey.html#day-${d.day}`}>
              <span className="k"><b>day {d.day}</b><span>{fmtDate(d.date)} · <Age date={d.date} mode={7} /></span></span>
              <span className="t">{d.ship}</span>
              <span className="chips">{d.arcs.map((a) => <Chip key={a} tone={arcTone(d.arc_color)}>{a}</Chip>)}<span className="chip">{d.mood}</span></span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------ stack now
const KIND_LABEL = { built: 'built here', using: 'in daily use', trying: 'trying', watching: 'watching', skill: 'skills and resources' };
const StackNow = () => {
  const S = DH.stack_now || { items: [], counts: {} };
  const st = DH.stats || {};
  const groups = ['built', 'using', 'trying', 'watching', 'skill'].map((k) => ({ k, items: S.items.filter((i) => i.kind === k).slice(0, 6), total: S.counts[k] || 0 })).filter((g) => g.items.length);
  const seen = (it) => it.last_seen ? <span className={`m${it.days_since <= 30 ? ' on' : ''}`} title={`last in the log ${it.last_seen}`}>log · {fmtDate(it.last_seen)}</span> : <span className="m" aria-hidden="true">·</span>;
  return (
    <section className="section sys mode-operator" id="stack" aria-labelledby="stack-h">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">the stack</span>
            <h2 id="stack-h">What I build with, what I am trying, what I am watching.</h2>
            <p className="lead">{S.items.length} tools. dates are mined from the log itself, so a tool only earns a date once it shows up in a day's entry.</p>
          </div>
          <a className="section-link" href="toolkit.html">the full stack →</a>
        </div>
        <div className="stack-groups">
          {groups.map((g) => (
            <div className="card stack-group" key={g.k}>
              <h3><span>{KIND_LABEL[g.k]}</span><b>{g.total}</b></h3>
              <div>
                {g.items.map((it) => (
                  it.url
                    ? <a key={it.name} className="tool" href={it.url} target="_blank" rel="noreferrer"><span className="n">{it.name} ↗</span>{seen(it)}<span className="w">{it.what}</span></a>
                    : <div key={it.name} className="tool"><span className="n">{it.name}</span>{seen(it)}<span className="w">{it.what}</span></div>
                ))}
              </div>
            </div>
          ))}
          <div className="card stack-side">
            <h3><span>how this site runs</span><b>{S.active_30d} tools in the log, 30d</b></h3>
            <dl className="kv">
              {(DH.stack || []).slice(0, 7).map((l) => <React.Fragment key={l.layer}><dt>{l.layer.toLowerCase()}</dt><dd>{l.what}</dd></React.Fragment>)}
            </dl>
            <p className="dim" style={{ fontSize: 'var(--text-xs)' }}>a tool earns a date the day it is named in an entry. most of the log talks about outcomes, not tools, so the dates are sparse on purpose.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------ companies
const Companies = () => {
  const cos = DH.companies || [];
  return (
    <section className="section sys mode-operator" id="ecosystem" aria-labelledby="co-h">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="eyebrow">the twelve</span>
            <h2 id="co-h">Twelve companies. One operating system.</h2>
            <p className="lead">what each one does, what it ships, and the last day it made the public log.</p>
          </div>
          <a className="section-link" href="command.html">the command view →</a>
        </div>
        <div className="co-grid">
          {cos.map((c) => {
            const last = (c.related_journey || [])[0];
            return (
              <a key={c.slug} className="card link co-card" href={`company.html?slug=${encodeURIComponent(c.slug)}`}>
                <span className="h"><b>{c.name}</b><span>{c.tag}</span></span>
                <span className="d">{c.desc}</span>
                <span className="chips">{((c.products || []).length ? c.products.slice(0, 3) : [c.tag]).map((p) => <Chip key={p}>{p}</Chip>)}</span>
                <span className="last">{last
                  ? <React.Fragment><i className={`dot ${last.arc_color}`} /><b>day {last.day}</b> · {fmtDate(last.date)} · <Age date={last.date} mode={30} /></React.Fragment>
                  : <React.Fragment><i className="dot" /><b>{(c.url || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') || c.tag}</b> · company page →</React.Fragment>}</span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------ writing
const Writing = () => {
  const posts = (DH.posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [lead, ...rest] = posts;
  if (!lead) return null;
  return (
    <section className="section sys mode-editorial" id="writing" aria-labelledby="wr-h">
      <div className="wrap">
        <div className="section-head">
          <div>
            <h2 id="wr-h">The weekly narratives.</h2>
            <p className="lead">one essay a week, written from the log, not from a content calendar. {posts.length} so far.</p>
          </div>
          <a className="section-link" href="writing.html">all essays →</a>
        </div>
        <div className="essays">
          <a className="card link essay" href={`post.html?slug=${encodeURIComponent(lead.slug)}`}>
            <span className="k"><span className="chip win">latest</span><span>{fmtDate(lead.date, true)}</span><span>{lead.read}</span>{lead.arc && <span>{lead.arc}</span>}</span>
            <h3>{lead.title}</h3>
            <p className="deck">{lead.deck}</p>
            {(() => { const l = (lead.body || []).find((b) => b && b.type === 'lede'); return l ? <p className="deck" style={{ color: 'var(--text)' }}>{l.text}</p> : null; })()}
            <span className="chips">{(lead.tags || []).map((t) => <Chip key={t}>{t}</Chip>)}{lead.day_range && <Chip tone="win">{lead.day_range}</Chip>}</span>
            <span className="mono" style={{ color: 'var(--win)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>read it →</span>
          </a>
          <div className="essay-list">
            {rest.slice(0, 3).map((p) => (
              <a key={p.slug} className="card link essay small" href={`post.html?slug=${encodeURIComponent(p.slug)}`}>
                <span className="k"><span>{fmtDate(p.date, true)}</span><span>{p.read}</span></span>
                <h3>{p.title}</h3>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ------------------------------------------------------------ ways in
const WaysIn = () => (
  <section className="section sys mode-editorial" id="ways" aria-labelledby="ways-h">
    <div className="wrap">
      <div className="section-head">
        <div>
          <h2 id="ways-h">Three doors. Same person behind each one.</h2>
          <p className="lead">no funnel, no form. a call, a repo, or one inbox.</p>
        </div>
      </div>
      <div className="ways">
        <div className="card way">
          <h3>Founders</h3>
          <p>Thirty minutes, no deck. Bring the thing you are stuck on, leave with a next move.</p>
          <a className="btn btn-gold" href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noopener noreferrer">Book 30 minutes</a>
        </div>
        <div className="card way">
          <h3>Operators and builders</h3>
          <p>Everything I ship is in the open. Read the log, fork the repos, tell me where I am wrong.</p>
          <a className="btn btn-ghost" href="https://github.com/Champ-Deep" target="_blank" rel="noreferrer">github / Champ-Deep ↗</a>
        </div>
        <div className="card way">
          <h3>Recruiters, press, everyone else</h3>
          <p>One inbox. Plain text wins. I answer the ones that read like a human wrote them.</p>
          <a className="btn btn-ghost" href="mailto:deep@championsmail.com">deep@championsmail.com</a>
        </div>
      </div>
    </div>
  </section>
);

window.HomeSections = { HeroBento, LogStrip, StackNow, Companies, Writing, WaysIn, Heatmap };
})();
