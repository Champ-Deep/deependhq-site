"use client";
// GitHubCal : the real GitHub contribution graph, self-fetched and themed.
// Port of GitHubCal from CommandPage.jsx. Same endpoint, same 7 second abort,
// same graceful hide when the fetch fails.

import { useEffect, useState } from "react";
import { cFmtDate } from "./flair";

interface Contribution {
  date: string;
  count: number;
  level: number;
}

interface ContributionsResponse {
  contributions?: Contribution[];
}

interface BlankCell {
  blank: true;
  key: string;
}

interface ContribCell extends Contribution {
  blank?: undefined;
  key: string;
}

type Cell = BlankCell | ContribCell;

interface Tip {
  x: number;
  y: number;
  c: Contribution;
}

const ghCellBg = (lv: number): string => (lv ? `rgba(48,224,96,${0.2 + lv * 0.2})` : "#161A22");

export function GitHubCal() {
  const [days, setDays] = useState<Contribution[] | null>(null); // null = loading, [] = failed (hide)
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    fetch("https://github-contributions-api.jogruber.de/v4/Champ-Deep?y=last", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ContributionsResponse>) : null))
      .then((d) => {
        if (!alive) return;
        if (!d || !Array.isArray(d.contributions)) {
          setDays([]);
          return;
        }
        setDays(d.contributions);
      })
      .catch(() => {
        if (alive) setDays([]);
      })
      .finally(() => clearTimeout(t));
    return () => {
      alive = false;
      ctrl.abort();
      clearTimeout(t);
    };
  }, []);
  if (days === null)
    return (
      <div className="cc-section">
        <div className="cc-sec-head">
          <h2 className="cc-sec-title">Commits, for real</h2>
          <span className="cc-badge live">github</span>
          <span className="cc-sec-note">loading from github.com/Champ-Deep …</span>
        </div>
      </div>
    );
  if (!days.length) return null; // graceful hide on failure
  const total = days.reduce((a, c) => a + (c.count || 0), 0);
  const pad = new Date(days[0].date + "T00:00:00Z").getUTCDay();
  const cells: Cell[] = [];
  for (let i = 0; i < pad; i++) cells.push({ blank: true, key: "p" + i });
  days.forEach((c) => cells.push({ key: c.date, ...c }));
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Commits, for real</h2>
        <span className="cc-badge live">github</span>
        <span className="cc-sec-note">
          {total.toLocaleString()} contributions in the last year · github.com/Champ-Deep
        </span>
      </div>
      <div className="cc-heat-wrap">
        <div className="cc-heat" onMouseLeave={() => setTip(null)}>
          {cells.map((c) =>
            c.blank ? (
              <span key={c.key} style={{ visibility: "hidden", width: 13, height: 13 }} />
            ) : (
              <span
                key={c.key}
                className="cc-heat-cell"
                style={{ background: ghCellBg(c.level) }}
                onMouseEnter={(e) => setTip({ x: e.clientX, y: e.clientY, c })}
                onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, c })}
              />
            )
          )}
        </div>
      </div>
      <div className="cc-heat-legend">
        <span className="cc-legend-item">less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            className="cc-legend-sw"
            style={{ background: ghCellBg(l), border: l ? "none" : "1px solid var(--color-border)" }}
          />
        ))}
        <span className="cc-legend-item">more</span>
      </div>
      {tip && (
        <div className="cc-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="cc-tip-day">{cFmtDate(tip.c.date)}</div>
          <div className="cc-tip-text">
            {tip.c.count} contribution{tip.c.count === 1 ? "" : "s"}
          </div>
        </div>
      )}
    </div>
  );
}
