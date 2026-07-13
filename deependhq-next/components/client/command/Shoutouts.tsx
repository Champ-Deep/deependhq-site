"use client";
// Shoutouts : the rotating "on my radar" feed. Port of Shoutouts from
// CommandPage.jsx. Items and the section note arrive as serializable props.
// Reduced motion is detected after mount so server and client markup agree.

import { useEffect, useState } from "react";
import { fireConfetti, prefersReduced } from "./flair";

export interface ShoutItem {
  name: string;
  repo: string;
  url: string;
  what: string;
  tag: string;
}

const SHOUT_TAG: Record<string, string> = { using: "using", trying: "trying this week", watching: "watching" };

export function Shoutouts({ items, note }: { items: ShoutItem[]; note: string }) {
  const all = items || [];
  const [reduced, setReduced] = useState(false);
  const [filter, setFilter] = useState("all");
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = filter === "all" ? all : all.filter((s) => s.tag === filter);
  useEffect(() => {
    setReduced(prefersReduced());
  }, []);
  useEffect(() => {
    setIdx(0);
  }, [filter]);
  useEffect(() => {
    if (reduced || paused || list.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % list.length), 4800);
    return () => clearInterval(id);
  }, [paused, list.length, reduced, filter]);
  if (!list.length) return null;
  const cur = list[Math.min(idx, list.length - 1)];
  const pick = (i: number) => {
    setIdx(i);
    fireConfetti({ particleCount: 55, spread: 60, scalar: 0.8 });
  };
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">On my radar</h2>
        <span className="cc-badge live">shoutouts</span>
        <span className="cc-sec-note">{note}</span>
      </div>
      <div className="cc-shout" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <a className="cc-shout-spot" href={cur.url} target="_blank" rel="noreferrer">
          {!reduced && <span key={cur.url + idx} className={`cc-shout-bar ${paused ? "paused" : ""}`} />}
          <span className={`cc-shout-tag tag-${cur.tag}`}>{SHOUT_TAG[cur.tag] || cur.tag}</span>
          <span className="cc-shout-name">
            {cur.name} <span className="cc-shout-arrow">↗</span>
          </span>
          <span className="cc-shout-repo">{cur.repo}</span>
          <span className="cc-shout-what">{cur.what}</span>
        </a>
        <div className="cc-shout-side">
          <div className="cc-shout-filters">
            {["all", "using", "trying", "watching"].map((t) => (
              <button key={t} className={`cc-shout-fbtn ${filter === t ? "active" : ""}`} onClick={() => setFilter(t)}>
                {t}
              </button>
            ))}
          </div>
          <div className="cc-shout-chips">
            {list.map((s, i) => (
              <button key={s.url} className={`cc-shout-chip ${i === idx ? "active" : ""}`} onClick={() => pick(i)}>
                <span className={`cc-shout-dot tag-${s.tag}`} />
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
