"use client";
// CommandTeaser : the "macbook scroll" moment, Gotham style. A terminal-framed
// live preview of /command that scales up as it enters the viewport.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function CommandTeaser() {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.82);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setScale(1);
      setLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLoad(true);
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 when the frame's top is at the bottom of the viewport, 1 when centered.
      const t = Math.min(Math.max((vh - rect.top) / (vh * 0.9), 0), 1);
      setScale(0.82 + t * 0.18);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <section id="command-teaser" data-screen-label="command" className="dh-section dh6-teaser">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow">
            <span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> Mission control
          </div>
          <h2 className="dh-section-title">The command center is public.</h2>
          <p className="dh-section-sub">Live repos, the log, the twelve, and a terminal that talks back.</p>
        </div>
        <Link className="dh-section-link" href="/command">
          Open /command
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div ref={ref} className="dh6-teaser-frame" style={{ transform: `scale(${scale.toFixed(3)})` }}>
        <div className="dh6-teaser-bar">
          <span className="dh6-teaser-dot r" />
          <span className="dh6-teaser-dot a" />
          <span className="dh6-teaser-dot g" />
          <span>~/deependhq/command · live</span>
        </div>
        <div className="dh6-teaser-screen">
          {load && <iframe src="/command" title="command center preview" loading="lazy" tabIndex={-1} />}
          <div className="dh6-teaser-veil">
            <Link className="dh-btn dh-btn-primary dh-btn-sm" href="/command">
              Enter the command center
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
