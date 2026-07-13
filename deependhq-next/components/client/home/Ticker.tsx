"use client";
// Ticker : the live output strip under the hero. Port of Ticker.jsx.
// Clock ticks client-side; optional /api/status worker enriches, with fast
// timeout and graceful fallback to the baked values.

import { useEffect, useState } from "react";

export interface TickerStatus {
  state: string;
  location: string;
  weather: string;
  last_ship: string;
  vault_commits: number;
  listening: string;
  on_repeat?: string;
  reading: string;
  drinking: string;
  uptime_d: number;
  coffee: number;
  time_ist: string;
}

const istClockNow = (fallback: string) => {
  try {
    return (
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date()) + " IST"
    );
  } catch {
    return fallback;
  }
};

export function Ticker({ status, day }: { status: TickerStatus; day: number }) {
  const [live, setLive] = useState(status);
  const [clock, setClock] = useState("");

  useEffect(() => {
    setClock(istClockNow(status.time_ist));
    const id = setInterval(() => setClock(istClockNow(status.time_ist)), 1000);
    return () => clearInterval(id);
  }, [status.time_ist]);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1200);
    fetch("/api/status", { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setLive((prev) => ({
          ...prev,
          state: d.state ?? prev.state,
          weather: d.weather ?? prev.weather,
          vault_commits: d.commits_today ?? prev.vault_commits,
          listening: d.now_playing ?? prev.listening,
          on_repeat: d.on_repeat ?? prev.on_repeat,
          reading: d.reading ?? prev.reading,
          last_ship: d.last_ship ?? prev.last_ship,
          uptime_d: d.uptime_days ?? prev.uptime_d,
        }));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(timer);
    };
  }, []);

  const s = live;
  const allRows = [
    { k: "state", v: s.state, cls: "tick-green pulse" },
    { k: "loc", v: s.location, cls: "" },
    { k: "clock", v: clock, cls: "" },
    { k: "wx", v: s.weather, cls: "" },
    { k: "last_ship", v: s.last_ship, cls: "tick-green" },
    { k: "commits", v: `${s.vault_commits} today`, cls: "" },
    { k: "now_playing", v: s.listening, cls: "tick-blue" },
    { k: "on_repeat", v: s.on_repeat, cls: "tick-mag" },
    { k: "reading", v: s.reading, cls: "tick-gold" },
    { k: "coffee", v: "/".repeat(s.coffee || 0) + " (" + (s.coffee || 0) + " cups)", cls: "" },
    { k: "uptime", v: `${s.uptime_d}d online`, cls: "" },
    { k: "day", v: `${day} of building in public`, cls: "tick-gold" },
    { k: "drinking", v: s.drinking, cls: "" },
    { k: "pipeline", v: "vault → claude → git → vercel · self-publishing", cls: "tick-blue" },
    { k: "companies", v: "12 in motion", cls: "" },
  ].filter((r) => r.v);

  const Track = ({ ariaHidden }: { ariaHidden?: boolean }) => (
    <span className="dh-marquee-track" aria-hidden={ariaHidden || undefined}>
      <span className="dh-ticker-prompt">$&nbsp;tail&nbsp;-f&nbsp;/var/log/deep</span>
      <span className="dh-ticker-sep">·</span>
      {allRows.map((r, i) => (
        <span key={i} className="dh-ticker-cell">
          <span className="dh-ticker-key">{r.k}</span>
          <span className="dh-ticker-eq">=</span>
          <span className={`dh-ticker-val ${r.cls}`}>{r.v}</span>
          <span className="dh-ticker-sep">·</span>
        </span>
      ))}
    </span>
  );

  return (
    <section className="dh-ticker" aria-label="live system status">
      <div className="dh-ticker-rail dh-marquee">
        <Track />
        <Track ariaHidden />
      </div>
    </section>
  );
}
