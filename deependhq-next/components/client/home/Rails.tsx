"use client";
// Rails : the two sticky side columns on the home page. Centered, spread out,
// and alive while you scroll.
// Left: day counter, section waypoints (scrollspy), live IST clock.
// Right: a traveling >_ glyph on a progress wire, plus a micro widget that
// swaps content as you move through the page.

import { useEffect, useMemo, useState } from "react";

export interface Waypoint {
  id: string;
  label: string;
}

export interface RailStatus {
  listening: string;
  reading: string;
  drinking: string;
  coffee: number;
  vault_commits: number;
  state: string;
}

// ---------- shared hooks ----------

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return p;
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0] || "");
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [ids]);
  return active;
}

const istClock = () => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
};

// ---------- left rail ----------

export function RailLeft({ day, waypoints }: { day: number; waypoints: Waypoint[] }) {
  const ids = useMemo(() => waypoints.map((wp) => wp.id), [waypoints]);
  const active = useScrollSpy(ids);
  const [clock, setClock] = useState("");
  useEffect(() => {
    setClock(istClock());
    const t = setInterval(() => setClock(istClock()), 30_000);
    return () => clearInterval(t);
  }, []);

  const onJump = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className="dh6-rail" aria-label="page waypoints">
      <div className="dh6-rail-day">
        <span className="dh6-rail-day-num">{day}</span>
        <span className="dh6-rail-day-lab">days public</span>
      </div>
      <nav className="dh6-waypoints">
        {waypoints.map((wp) => (
          <a
            key={wp.id}
            href={`#${wp.id}`}
            className={`dh6-waypoint ${active === wp.id ? "active" : ""}`}
            onClick={(e) => onJump(e, wp.id)}
          >
            <span className="dh6-waypoint-dot" />
            <span className="dh6-waypoint-label">{wp.label}</span>
          </a>
        ))}
      </nav>
      <div className="dh6-rail-clock">
        <span className="dh6-rail-clock-time" suppressHydrationWarning>{clock}</span>
        <span>bangalore ist</span>
      </div>
    </aside>
  );
}

// ---------- right rail ----------

interface Widget {
  key: string;
  val: string;
  sub?: string;
}

export function RailRight({
  status,
  lexicon,
  commits,
}: {
  status: RailStatus;
  lexicon: { term: string; def: string }[];
  commits: number[];
}) {
  const progress = useScrollProgress();

  const widgets = useMemo<Widget[]>(() => {
    const lex = lexicon[Math.floor(Math.random() * Math.max(lexicon.length, 1))];
    return [
      { key: "state", val: status.state, sub: `${status.vault_commits} commits today` },
      { key: "now playing", val: status.listening, sub: status.drinking },
      { key: "on the desk", val: status.reading, sub: "/".repeat(Math.min(status.coffee, 14)) + ` ${status.coffee} cups` },
      lex
        ? { key: `lexicon: ${lex.term}`, val: lex.def }
        : { key: "state", val: status.state },
    ];
  }, [status, lexicon]);

  const idx = Math.min(Math.floor(progress * widgets.length), widgets.length - 1);
  const ticks = [0.25, 0.5, 0.75];

  return (
    <aside className="dh6-rail dh6-railright" aria-hidden="true">
      <div className="dh6-wire">
        {ticks.map((t) => (
          <span
            key={t}
            className={`dh6-wire-tick ${progress >= t ? "passed" : ""}`}
            style={{ top: `${t * 100}%` }}
          />
        ))}
        <span className="dh6-wire-glyph" style={{ top: `${progress * 96}%` }}>
          &gt;_
        </span>
      </div>
      <div className="dh6-widget" key={idx}>
        <span className="dh6-widget-key">{widgets[idx].key}</span>
        <span className="dh6-widget-val">{widgets[idx].val}</span>
        {widgets[idx].sub && <span className="dh6-widget-sub">{widgets[idx].sub}</span>}
      </div>
      <Sparkline commits={commits} />
    </aside>
  );
}

function Sparkline({ commits }: { commits: number[] }) {
  if (!commits.length) return null;
  const max = Math.max(...commits, 1);
  const wpt = 160 / Math.max(commits.length - 1, 1);
  const pointsAttr = commits
    .map((c, i) => `${(i * wpt).toFixed(1)},${(32 - (c / max) * 28).toFixed(1)}`)
    .join(" ");
  return (
    <div className="dh6-widget">
      <span className="dh6-widget-key">commits, 14 days</span>
      <svg className="dh6-spark" viewBox="0 0 160 34" preserveAspectRatio="none">
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="var(--color-accent-primary)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          opacity="0.85"
        />
      </svg>
    </div>
  );
}
