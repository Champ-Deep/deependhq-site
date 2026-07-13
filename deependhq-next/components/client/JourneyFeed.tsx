"use client";
// JourneyFeed : the /journey feed v2, port of JourneyPage.jsx.
// Content-aware layout: sticky context rail (scroll progress, arc legend with
// live mix, stacked filters, month map, stats) plus expansive entries grouped
// by month and batched infinite scroll. Receives the journey as serializable
// props from the server page; never imports lib/data.

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

export interface JourneyCompanyLink {
  arc: string;
  company_name: string | null;
  slug: string | null;
}

export interface JourneyEntryData {
  day: number;
  date: string;
  mood?: string;
  shipping_now: string;
  yesterday_thread?: string;
  raw_thought?: string;
  arcs: string[];
  arc_color: string;
  company_links?: JourneyCompanyLink[];
}

const J_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const jFmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${J_MONTHS[parseInt(m, 10) - 1].slice(0, 3)} ${parseInt(d, 10)}, ${y}`;
};
const jMonthKey = (iso: string) => iso.slice(0, 7);
const jMonthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return `${J_MONTHS[parseInt(m, 10) - 1]} ${y}`;
};

const BATCH = 8;

const EntryV2 = ({ entry }: { entry: JourneyEntryData }) => (
  <article className={`dh-entry-v2 arc-${entry.arc_color}`} data-day={entry.day}>
    <div className="dh-entry-v2-head">
      <span className="dh-entry-v2-mood">{entry.mood}</span>
      <span className={`dh-day dh-day-${entry.arc_color}`}>DAY {entry.day}</span>
      <span className="dh-entry-v2-date">{jFmtDate(entry.date)}</span>
      <span className="dh-entry-v2-tags">
        {entry.arcs.map((a) => {
          const link = (entry.company_links || []).find((l) => l.arc === a && l.slug);
          const cls = `dh-pill dh-pill-${entry.arc_color}`;
          return link && link.slug
            ? <Link key={a} className={cls} href={`/company/${encodeURIComponent(link.slug)}`}>{a}</Link>
            : <span key={a} className={cls}>{a}</span>;
        })}
      </span>
    </div>
    <p className="dh-entry-v2-ship"><span className="dh-gt">&gt;_</span>{entry.shipping_now}</p>
    {entry.yesterday_thread && (
      <div className="dh-entry-v2-row">
        <span className="dh-entry-v2-label">thread</span>
        <p className="dh-entry-v2-text thread">{entry.yesterday_thread}</p>
      </div>
    )}
    {entry.raw_thought && (
      <div className="dh-entry-v2-row">
        <span className="dh-entry-v2-label">raw thought</span>
        <p className="dh-entry-v2-text">{entry.raw_thought}</p>
      </div>
    )}
  </article>
);

export function JourneyFeed({
  entries,
  weeklyNarrativesCount,
}: {
  entries: JourneyEntryData[];
  weeklyNarrativesCount: number;
}) {
  const all = entries;
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(BATCH);
  const [allArcsOpen, setAllArcsOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hereDay, setHereDay] = useState<number | string>(all[0]?.day || 0);
  const [activeMonth, setActiveMonth] = useState(jMonthKey(all[0]?.date || "2026-01"));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const allArcs = useMemo(() => {
    const arcs: string[] = [];
    for (const e of all) for (const a of e.arcs) if (!arcs.includes(a)) arcs.push(a);
    const n = (a: string) => all.filter((e) => e.arcs.includes(a)).length;
    return arcs.sort((a, b) => n(b) - n(a));
  }, [all]);

  const filtered = filter === "all" ? all : all.filter((e) => e.arcs.includes(filter));
  const visible = filtered.slice(0, shown);

  // group visible entries by month, newest first
  const groups = useMemo(() => {
    const g: { key: string; entries: JourneyEntryData[] }[] = [];
    for (const e of visible) {
      const key = jMonthKey(e.date);
      if (!g.length || g[g.length - 1].key !== key) g.push({ key, entries: [] });
      g[g.length - 1].entries.push(e);
    }
    return g;
  }, [visible]);

  // month map for the rail (from the FULL filtered set, with counts)
  const monthMap = useMemo(() => {
    const m: { key: string; count: number }[] = [];
    for (const e of filtered) {
      const key = jMonthKey(e.date);
      const hit = m.find((x) => x.key === key);
      if (hit) hit.count++;
      else m.push({ key, count: 1 });
    }
    return m;
  }, [filtered]);

  // arc-color mix across the filtered set
  const mix = useMemo(() => {
    const t: Record<string, number> = { green: 0, blue: 0, gold: 0 };
    for (const e of filtered) t[e.arc_color] = (t[e.arc_color] || 0) + 1;
    const n = filtered.length || 1;
    return { green: (t.green / n) * 100, blue: (t.blue / n) * 100, gold: (t.gold / n) * 100, counts: t };
  }, [filtered]);

  // reset paging when filter changes
  useEffect(() => {
    setShown(BATCH);
  }, [filter]);

  // infinite scroll: grow the window when the sentinel enters the viewport
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver((es) => {
      if (es[0].isIntersecting) setShown((s) => Math.min(s + BATCH, filtered.length));
    }, { rootMargin: "600px 0px" });
    io.observe(node);
    return () => io.disconnect();
  }, [filtered.length]);

  // scroll progress + "you are here" day + active month
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
      // find the entry closest to the top third of the viewport
      const probe = window.innerHeight * 0.33;
      let day: string | null = null;
      let month: string | null = null;
      const cards = feedRef.current ? feedRef.current.querySelectorAll<HTMLElement>(".dh-entry-v2") : [];
      for (const el of cards) {
        const r = el.getBoundingClientRect();
        if (r.top <= probe && r.bottom >= 0) { day = el.dataset.day ?? null; }
        if (r.top > probe) break;
      }
      if (day) {
        setHereDay(day);
        const e = all.find((x) => String(x.day) === String(day));
        if (e) month = jMonthKey(e.date);
      }
      if (month) setActiveMonth(month);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [all]);

  const jumpToMonth = (key: string) => {
    const el = document.getElementById(`m-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else {
      setShown(filtered.length);
      setTimeout(() => document.getElementById(`m-${key}`)?.scrollIntoView({ behavior: "smooth" }), 120);
    }
  };

  // simple streak: consecutive weekdays from latest entry backwards
  const streak = useMemo(() => {
    let s = 0;
    const days = new Set(all.map((e) => e.day));
    for (let d = all[0]?.day || 0; days.has(d); d--) s++;
    return s;
  }, [all]);

  return (
    <div className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> The journey</div>
        <h1 className="dh-page-title">The Journey.</h1>
        <p className="dh-page-sub">Day by day. Build by build. The receipts behind the hero line.</p>
        <div className="dh-page-meta">
          <span className="dh-mono">{all.length} entries</span>
          <span className="dh-dot-sep">·</span>
          <span className="dh-mono">latest: day {all[0].day}</span>
          <span className="dh-dot-sep">·</span>
          <span className="dh-mono">day 1 · Nov 1, 2025</span>
          <span className="dh-dot-sep">·</span>
          <Link className="dh-link" href="/field-notes">Field notes →</Link>
        </div>
      </header>

      {/* mobile: rail is hidden, keep the filter reachable */}
      <div className="dh-filter-bar dh-rail-mobile-only">
        <button className={`dh-filter-pill ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>All arcs</button>
        {allArcs.map((a) => (
          <button key={a} className={`dh-filter-pill ${filter === a ? "active" : ""}`} onClick={() => setFilter(a)}>{a}</button>
        ))}
      </div>

      <div className="dh-rail-layout">
        <div ref={feedRef}>
          <div className="dh-feed-v2">
            {groups.map((g) => (
              <Fragment key={g.key}>
                <div className="dh-month-head" id={`m-${g.key}`}>
                  <h2 className="dh-month-name">{jMonthLabel(g.key)}</h2>
                  <span className="dh-month-rule" />
                  <span className="dh-month-count">{monthMap.find((m) => m.key === g.key)?.count || g.entries.length} entries</span>
                </div>
                {g.entries.map((e) => <EntryV2 key={e.day} entry={e} />)}
              </Fragment>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="dh-empty"><span className="dh-gt">&gt;_</span><span>nothing on the {filter} arc yet.</span></div>
          )}

          <div ref={sentinelRef} className="dh-feed-sentinel" />
          {shown < filtered.length
            ? <div className="dh-feed-more"><span className="dh-gt">&gt;_</span>loading older days…</div>
            : filtered.length > 0 && <div className="dh-feed-end">&gt;_ end of the public log. it opens at day {filtered[filtered.length - 1].day}, when this site went live. days 1 to {filtered[filtered.length - 1].day - 1} live in the vault.</div>}
        </div>

        <aside className="dh-rail" aria-label="journey context">
          <div className="dh-rail-block">
            <p className="dh-rail-k">Reading position</p>
            <div className="dh-rail-progress">
              <span className="dh-rail-progress-track"><span className="dh-rail-progress-fill" style={{ width: `${progress}%` }} /></span>
              <span className="dh-rail-progress-pct">{Math.round(progress)}%</span>
            </div>
            <p className="dh-rail-here"><span className="dh-gt">&gt;_</span>day {hereDay} of {all[0].day}</p>
          </div>

          <div className="dh-rail-block">
            <p className="dh-rail-k">The mix</p>
            <div className="dh-rail-mix">
              <span className="mix-green" style={{ width: `${mix.green}%` }} />
              <span className="mix-blue" style={{ width: `${mix.blue}%` }} />
              <span className="mix-gold" style={{ width: `${mix.gold}%` }} />
            </div>
            <ul className="dh-rail-legend">
              <li><span className="dh-rail-swatch dh-rail-swatch-green" />building · {mix.counts.green}</li>
              <li><span className="dh-rail-swatch dh-rail-swatch-blue" />thinking · {mix.counts.blue}</li>
              <li><span className="dh-rail-swatch dh-rail-swatch-gold" />winning · {mix.counts.gold}</li>
            </ul>
          </div>

          <div className="dh-rail-block">
            <p className="dh-rail-k">Months</p>
            <ul className="dh-rail-nav">
              {monthMap.map((m) => (
                <li key={m.key}>
                  <button className={activeMonth === m.key ? "active" : ""} onClick={() => jumpToMonth(m.key)}>
                    {jMonthLabel(m.key)}
                    <span className="dh-rail-count">{m.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="dh-rail-block">
            <p className="dh-rail-k">Arcs</p>
            <div className="dh-rail-filters dh-rail-nav">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
                all arcs <span className="dh-rail-count">{all.length}</span>
              </button>
              {(allArcsOpen ? allArcs : allArcs.slice(0, 6)).map((a) => (
                <button key={a} className={filter === a ? "active" : ""} onClick={() => setFilter(a)}>
                  {a} <span className="dh-rail-count">{all.filter((e) => e.arcs.includes(a)).length}</span>
                </button>
              ))}
              {allArcs.length > 6 && (
                <button onClick={() => setAllArcsOpen(!allArcsOpen)} style={{ opacity: 0.7 }}>
                  {allArcsOpen ? "− fewer" : `+ ${allArcs.length - 6} more`}
                </button>
              )}
            </div>
          </div>

          <div className="dh-rail-block">
            <p className="dh-rail-k">Numbers</p>
            <div className="dh-rail-stats">
              <div className="dh-rail-stat"><span className="dh-rail-stat-num">{all[0].day}</span><span className="dh-rail-stat-lab">days public</span></div>
              <div className="dh-rail-stat"><span className="dh-rail-stat-num">{all.length}</span><span className="dh-rail-stat-lab">entries</span></div>
              <div className="dh-rail-stat"><span className="dh-rail-stat-num">{streak}</span><span className="dh-rail-stat-lab">day streak</span></div>
              <div className="dh-rail-stat"><span className="dh-rail-stat-num">{weeklyNarrativesCount}</span><span className="dh-rail-stat-lab">weeklies</span></div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
