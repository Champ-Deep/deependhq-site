"use client";
// Rail : shared context-rail utilities for the content-aware layout.
// Port of Rail.jsx. Used by the now, field-notes, and toolkit surfaces. The
// journey page implements its own richer rail in JourneyFeed.tsx.
// RailTocSpy pairs RailToc with the scrollspy hook so server pages can drop
// in a live table of contents without becoming client components themselves.

import { useEffect, useState } from "react";

export interface RailTocItem {
  id: string;
  label: string;
  count?: number;
}

// scroll progress 0-100
export function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const f = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setP(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    window.addEventListener("scroll", f, { passive: true });
    f();
    return () => window.removeEventListener("scroll", f);
  }, []);
  return p;
}

// scrollspy over section ids -> active id
export function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const f = () => {
      const probe = window.innerHeight * 0.3;
      let cur = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= probe) cur = id;
      }
      setActive(cur);
    };
    window.addEventListener("scroll", f, { passive: true });
    f();
    return () => window.removeEventListener("scroll", f);
    // legacy dependency semantics: re-bind only when the id list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);
  return active;
}

export function RailProgress({ label }: { label?: string }) {
  const p = useScrollProgress();
  return (
    <div className="dh-rail-block">
      <p className="dh-rail-k">{label || "Reading position"}</p>
      <div className="dh-rail-progress">
        <span className="dh-rail-progress-track"><span className="dh-rail-progress-fill" style={{ width: `${p}%` }} /></span>
        <span className="dh-rail-progress-pct">{Math.round(p)}%</span>
      </div>
    </div>
  );
}

export function RailToc({
  items,
  active,
  onJump,
}: {
  items: RailTocItem[];
  active: string;
  onJump?: (id: string) => void;
}) {
  return (
    <div className="dh-rail-block">
      <p className="dh-rail-k">On this page</p>
      <ul className="dh-rail-nav">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              className={active === it.id ? "active" : ""}
              onClick={(e) => {
                e.preventDefault();
                (onJump || ((id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })))(it.id);
              }}
            >
              {it.label}
              {it.count != null && <span className="dh-rail-count">{it.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// RailToc with the scrollspy wired in. Same DOM as the legacy pattern of
// passing active={window.useScrollSpy(ids)} from the page component.
export function RailTocSpy({ items, onJump }: { items: RailTocItem[]; onJump?: (id: string) => void }) {
  const active = useScrollSpy(items.map((it) => it.id));
  return <RailToc items={items} active={active} onJump={onJump} />;
}
