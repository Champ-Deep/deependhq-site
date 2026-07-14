"use client";
// Viz5 : home versions of the round 5 visualizations. Ports of Heatmap5,
// Constellation5, RepoCards5, Shoutouts5 from Viz5.jsx. Every viz gets a
// caption, an empty/error state, reduced-motion compliance. These are
// separate from the /command variants in components/client/command/.
// Adaptations: all data arrives as serializable props (client files never
// import @/lib/data). The reduced-motion check moved from render into an
// effect so server rendering never touches window. RepoCards5 stays
// baked-data driven like the legacy kit (it never fetched GitHub); the
// parent passes whatever repo list it has, and the empty state covers the
// current app where DH has no repos key.

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export interface VizJourneyEntry {
  day: number;
  date?: string;
  shipping_now?: string;
  arc_color?: string;
  arcs?: string[];
}

export interface VizCompany {
  name: string;
  slug: string;
}

export interface Repo5 {
  name: string;
  url: string;
  description?: string;
  language?: string;
  pushed_at: string;
}

export interface ShoutoutQuote {
  quote: string;
  who: string;
  role: string;
}

const VizEmpty = ({ children }: { children: ReactNode }) => (
  <div className="dh5-viz-empty">{children}</div>
);

// ---- constellation. node size = public journey coverage. -----------
// Every node is a button: hover grows and labels it, click opens the
// company page. Hover growth is CSS and gated behind reduced motion.
export function Constellation5({ companies, journey }: { companies: VizCompany[]; journey: VizJourneyEntry[] }) {
  if (!companies.length) return <VizEmpty>no companies to map yet.</VizEmpty>;
  const coverage = (name: string) => {
    const key = name.toLowerCase().split(" ")[0];
    return journey.filter((e) => (e.arcs || []).some((a) => a.toLowerCase().includes(key))).length;
  };
  // deterministic ring layout, no dependency on canvas or motion.
  const N = companies.length;
  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: "relative", height: 340 }} role="group"
        aria-label={"constellation of " + N + " companies. node size shows how often each appears in the public journey log. each node opens that company's page."}>
        {companies.map((c, i) => {
          const cov = coverage(c.name);
          const size = 34 + Math.min(cov, 6) * 8;
          const a = (i / N) * Math.PI * 2 - Math.PI / 2;
          const rx = 42 + (i % 3) * 3, ry = 40 + ((i * 7) % 3) * 3;
          return (
            <button key={c.slug} type="button" className="dh6r-node"
              data-active={cov ? "true" : undefined}
              title={c.name + (cov ? ` · ${cov} log entries` : "")}
              aria-label={"open the " + c.name + " company page"}
              onClick={() => window.location.assign(`/company/${c.slug}`)}
              style={{
                left: `calc(50% + ${Math.cos(a) * rx}% - ${size / 2}px)`,
                top: `calc(50% + ${Math.sin(a) * ry * 0.8}% - ${size / 2}px)`,
                width: size, height: size,
              }}>
              <span aria-hidden="true">{c.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
              <span className="dh6r-node-label" aria-hidden="true">{c.name}</span>
            </button>
          );
        })}
      </div>
      <figcaption className="dh5-viz-caption">
        the twelve. bigger node = more public journey entries.
        <span className="dh6r-viz-hint">click a node to open the company page</span>
      </figcaption>
    </figure>
  );
}

// ---- contribution heatmap. hover = that day's ship line, click = day.
export function Heatmap5({ journey, todayDay }: { journey: VizJourneyEntry[]; todayDay?: number }) {
  if (!journey.length) return <VizEmpty>the log starts soon.</VizEmpty>;
  const byDay: Record<number, VizJourneyEntry> = Object.fromEntries(journey.map((e) => [e.day, e]));
  const today = todayDay || journey[0].day;
  const days = Array.from({ length: 84 }, (_, i) => today - 83 + i).filter((d) => d > 0);
  return (
    <figure style={{ margin: 0 }}>
      <div className="dh5-heat" role="list" aria-label="last 12 weeks of shipping, one cell per day">
        {days.map((d) => {
          const e = byDay[d];
          const level = e ? (e.arc_color === "gold" ? 3 : 2) : 1;
          return (
            <Link key={d} role="listitem" href={`/journey#day-${d}`}
              data-level={e ? level : 0}
              title={e ? `day ${d}: ${e.shipping_now}` : `day ${d}`}
              aria-label={e ? `day ${d}: ${e.shipping_now}` : `day ${d}, no public entry`}></Link>
          );
        })}
      </div>
      <figcaption className="dh5-viz-caption">every cell is a day. hover for the ship line, click to read that day.</figcaption>
    </figure>
  );
}

// ---- github repo cards. active in last 60 days only, recency sorted.
export function RepoCards5({ repos }: { repos: Repo5[] }) {
  const active = repos
    .filter((r) => (Date.now() - new Date(r.pushed_at).getTime()) / 864e5 <= 60)
    .sort((a, b) => new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime());
  if (!active.length) return <VizEmpty>no public repos active in the last 60 days.</VizEmpty>;
  const ago = (d: string) => {
    const days = Math.round((Date.now() - new Date(d).getTime()) / 864e5);
    return days === 0 ? "today" : days === 1 ? "yesterday" : days + "d ago";
  };
  return (
    <figure style={{ margin: 0 }}>
      <div className="dh-bento">
        {active.slice(0, 6).map((r) => (
          <a key={r.name} className="dh-tile b4" href={r.url} style={{ color: "var(--text)" }}>
            <span className="dh-tile-key">{r.name}</span>
            <p className="dh5-co-ship">{r.description}</p>
            <span className="dh5-co-meta" suppressHydrationWarning>
              <span className="dh5-repo-lang">{r.language}</span> · last commit {ago(r.pushed_at)}
            </span>
          </a>
        ))}
      </div>
      <figcaption className="dh5-viz-caption">public repos with a commit in the last 60 days, newest first.</figcaption>
    </figure>
  );
}

// ---- shoutouts rotator. 8s, pause on hover, manual arrows. ----------
export function Shoutouts5({ items }: { items: ShoutoutQuote[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (paused || reduced || items.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), 8000);
    return () => clearInterval(id);
  }, [paused, items.length, reduced]);

  if (!items.length) return <VizEmpty>no shoutouts yet. the work speaks first.</VizEmpty>;
  const s = items[i % items.length];
  return (
    <figure style={{ margin: 0 }} className="dh5-shout"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <blockquote style={{ margin: 0 }} aria-live="polite">
        <p style={{ fontSize: "var(--text-lg)", color: "var(--text)" }}>&quot;{s.quote}&quot;</p>
        <footer className="muted" style={{ fontSize: "var(--text-sm)" }}>{s.who} · {s.role}</footer>
      </blockquote>
      <div className="dh5-shout-nav" style={{ marginTop: "var(--s3)" }}>
        <button aria-label="previous shoutout" onClick={() => setI((i - 1 + items.length) % items.length)}>←</button>
        <button aria-label="next shoutout" onClick={() => setI((i + 1) % items.length)}>→</button>
        <span className="muted" style={{ fontSize: "var(--text-xs)", alignSelf: "center" }}>{i + 1}/{items.length}</span>
      </div>
      <figcaption className="dh5-viz-caption">what people say. rotates every 8s, pauses on hover.</figcaption>
    </figure>
  );
}
