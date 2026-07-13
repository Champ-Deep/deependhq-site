"use client";
// Heatmap : the public log contribution grid. Port of Heatmap from
// CommandPage.jsx. Journey entries and the brand today_date come in as
// serializable props instead of window.DH_DATA.

import { useMemo, useState } from "react";
import { cFmtDate } from "./flair";

export interface HeatJourneyEntry {
  date: string;
  day: number;
  shipping_now?: string;
  arc_color?: string;
}

interface BlankCell {
  blank: true;
  key: string;
}

interface DayCell {
  blank?: undefined;
  key: string;
  iso: string;
  entry: HeatJourneyEntry | null;
}

type Cell = BlankCell | DayCell;

interface Tip {
  x: number;
  y: number;
  iso: string;
  day: number | null;
  text: string;
}

export function Heatmap({ journey, todayDate }: { journey: HeatJourneyEntry[]; todayDate: string }) {
  const [tip, setTip] = useState<Tip | null>(null);
  const cells = useMemo<Cell[]>(() => {
    if (!journey.length) return [];
    const byDate: Record<string, HeatJourneyEntry> = {};
    journey.forEach((e) => {
      byDate[e.date] = e;
    });
    const dates = journey.map((e) => e.date).sort();
    const start = new Date(dates[0] + "T00:00:00Z");
    const end = new Date((todayDate || dates[dates.length - 1]) + "T00:00:00Z");
    const out: Cell[] = [];
    const pad = start.getUTCDay();
    for (let i = 0; i < pad; i++) out.push({ blank: true, key: "p" + i });
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      const d = new Date(t);
      const iso = d.toISOString().slice(0, 10);
      out.push({ iso, entry: byDate[iso] || null, key: iso });
    }
    return out;
  }, [journey, todayDate]);
  const enter = (e: React.MouseEvent, c: DayCell) => {
    if (!c.entry) {
      setTip({ x: e.clientX, y: e.clientY, iso: c.iso, text: "quiet day. no public entry.", day: null });
      return;
    }
    setTip({
      x: e.clientX,
      y: e.clientY,
      iso: c.iso,
      day: c.entry.day,
      text: (c.entry.shipping_now || "").slice(0, 120) + ((c.entry.shipping_now || "").length > 120 ? "…" : ""),
    });
  };
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">The public log</h2>
        <span className="cc-badge live">tracking</span>
        <span className="cc-sec-note">{journey.length} entries logged · colored by what the day was about</span>
      </div>
      <div className="cc-heat-wrap">
        <div className="cc-heat" onMouseLeave={() => setTip(null)}>
          {cells.map((c) =>
            c.blank ? (
              <span key={c.key} style={{ visibility: "hidden", width: 13, height: 13 }} />
            ) : (
              <span
                key={c.key}
                className={`cc-heat-cell ${c.entry ? "lv-" + c.entry.arc_color : ""}`}
                onMouseEnter={(e) => enter(e, c)}
                onMouseMove={(e) => enter(e, c)}
              />
            )
          )}
        </div>
      </div>
      <div className="cc-heat-legend">
        <span className="cc-legend-item">
          <span className="cc-legend-sw empty" /> quiet
        </span>
        <span className="cc-legend-item">
          <span className="cc-legend-sw green" /> building
        </span>
        <span className="cc-legend-item">
          <span className="cc-legend-sw blue" /> thinking
        </span>
        <span className="cc-legend-item">
          <span className="cc-legend-sw gold" /> winning
        </span>
      </div>
      {tip && (
        <div className="cc-tip" style={{ left: tip.x, top: tip.y }}>
          <div className="cc-tip-day">
            {tip.day ? `day ${tip.day} · ` : ""}
            {cFmtDate(tip.iso)}
          </div>
          <div className="cc-tip-text">{tip.text}</div>
        </div>
      )}
    </div>
  );
}
