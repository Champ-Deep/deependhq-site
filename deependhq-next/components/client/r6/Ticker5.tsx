"use client";
// Ticker5 : port of the round 5 ticker v2. Keeps the tail -f framing,
// becomes a true marquee. New on_repeat cell (magenta, 3-bar equalizer),
// deduped cells capped at 12, the whole strip is one link to /now.
// The moving strip is aria-hidden; a visually hidden static list carries
// the same facts for screen readers. Hover pauses (css). /api/status
// overlay kept, 1.2s abort, refreshed every 60s. Reduced motion: strip
// does not move (css).
// Adaptations: baked status arrives as props (client files never import
// @/lib/data). The clock starts from the baked time_ist and switches to the
// live IST clock after mount, which keeps hydration clean. The /api/status
// merge accepts both the round 5 key names (vault_commits, listening,
// uptime_d) and this app's worker names (commits_today, now_playing,
// uptime_days), and on_repeat as either a {track, artist} object or a
// "track · artist" string.

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import type { OnRepeat } from "./StatStrip";

export interface Ticker5Status {
  state?: string;
  location?: string;
  weather?: string;
  last_ship?: string;
  vault_commits?: number | null;
  listening?: string;
  reading?: string;
  coffee?: number | null;
  uptime_d?: number;
  time_ist?: string;
  on_repeat?: OnRepeat | null;
}

interface CellDraft {
  k: string;
  v: string | null | undefined;
  acc?: string;
  eq?: boolean;
}

interface Cell extends CellDraft {
  v: string;
}

const asStr = (v: unknown): string | undefined =>
  typeof v === "string" && v !== "" ? v : undefined;

const asNum = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

const asRepeat = (v: unknown): OnRepeat | undefined => {
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.track === "string" && typeof o.artist === "string") {
      return { track: o.track, artist: o.artist };
    }
  }
  if (typeof v === "string" && v.includes(" · ")) {
    const [track, ...rest] = v.split(" · ");
    return { track, artist: rest.join(" · ") };
  }
  return undefined;
};

// Same LIVE overlay as the legacy kit: only non-empty live values win.
function mergeLive(prev: Ticker5Status, d: Record<string, unknown>): Ticker5Status {
  return {
    ...prev,
    state: asStr(d.state) ?? prev.state,
    weather: asStr(d.weather) ?? prev.weather,
    last_ship: asStr(d.last_ship) ?? prev.last_ship,
    vault_commits: asNum(d.vault_commits) ?? asNum(d.commits_today) ?? prev.vault_commits,
    listening: asStr(d.listening) ?? asStr(d.now_playing) ?? prev.listening,
    uptime_d: asNum(d.uptime_d) ?? asNum(d.uptime_days) ?? prev.uptime_d,
    on_repeat: asRepeat(d.on_repeat) ?? prev.on_repeat,
  };
}

function istClock5(fallback: string) {
  try {
    return (
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false,
      }).format(new Date()) + " ist"
    );
  } catch {
    return fallback;
  }
}

export function Ticker5({ status, day }: { status: Ticker5Status; day: number }) {
  const [s, setS] = useState<Ticker5Status>(status);

  useEffect(() => {
    const tick = () => setS((p) => ({ ...p, time_ist: istClock5(status.time_ist || "") }));
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [status.time_ist]);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1200);
      try {
        const r = await fetch("/api/status", { signal: ctrl.signal, headers: { accept: "application/json" } });
        if (!r.ok) return;
        const live: unknown = await r.json();
        if (!alive || !live || typeof live !== "object") return;
        setS((prev) => mergeLive(prev, live as Record<string, unknown>));
      } catch {
        /* keep static fallback */
      } finally {
        clearTimeout(t);
      }
    };
    void pull();
    const id = setInterval(() => { void pull(); }, 60000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // build cells, dedupe the overlapping trio (state vs uptime vs day):
  // day carries the count, state carries the verb, uptime is dropped.
  const cells = ([
    { k: "day", v: `${day} building in public`, acc: "build" },
    { k: "state", v: s.state, acc: "build" },
    { k: "loc", v: s.location },
    { k: "clock", v: s.time_ist },
    { k: "wx", v: s.weather },
    { k: "last_ship", v: s.last_ship, acc: "build" },
    { k: "commits", v: s.vault_commits != null ? `${s.vault_commits} today` : null },
    s.on_repeat ? { k: "on_repeat", v: `${s.on_repeat.track} · ${s.on_repeat.artist}`, acc: "human", eq: true } : null,
    { k: "reading", v: s.reading, acc: "win" },
    { k: "coffee", v: s.coffee != null ? "/".repeat(s.coffee) + ` (${s.coffee})` : null },
  ] as (CellDraft | null)[])
    .filter((c): c is Cell => !!c && c.v != null && c.v !== "")
    .filter((c, i, a) => a.findIndex((x) => x.k === c.k) === i)
    .slice(0, 12);

  const Cells = () => (
    <Fragment>
      <span className="dh5-tick-prompt">$ tail -f /var/log/deep</span>
      {cells.map((c, i) => (
        <span key={i} className="dh5-tick-cell">
          {c.eq && <span className="dh5-eq"><i></i><i></i><i></i></span>}
          <span className="k">{c.k}=</span>
          <span className={"v" + (c.acc ? " acc-" + c.acc : "")}>{c.v}</span>
        </span>
      ))}
    </Fragment>
  );

  return (
    <Link className="dh5-ticker" href="/now" aria-label="current status. opens the now page.">
      <div className="dh5-ticker-track" aria-hidden="true">
        <Cells /><Cells />
      </div>
      <ul className="visually-hidden">
        {cells.map((c, i) => (<li key={i}>{c.k}: {c.v}</li>))}
      </ul>
    </Link>
  );
}
