"use client";
// Hero : the Signal. Kinetic headline over the whole-screen globe canvas.
// Port of Hero.jsx with the v4 additions: operator id line, work-with-me CTA,
// terminal teaser tile pointing at /command.

import Link from "next/link";
import { useEffect, useState } from "react";

export function Hero({
  location,
  day,
  narratives,
  rotations,
}: {
  location: string;
  day: number;
  narratives: number;
  rotations: string[];
}) {
  const [rot, setRot] = useState(0);
  useEffect(() => {
    if (rotations.length < 2) return;
    const t = setInterval(() => setRot((r) => (r + 1) % rotations.length), 3400);
    return () => clearInterval(t);
  }, [rotations.length]);

  return (
    <section id="hero" data-screen-label="hero" className="dh-hero">
      <div className="dh-hero-inner">
        <div className="dh-hero-eyebrow">
          <span className="dh-dot" />
          Building in public · {location} · day {day}
        </div>
        <h1 className="dh-hero-title">
          Past the hype cycle.
          <br />
          <span className="dh-hero-emph">Into the infrastructure.</span>
          <span className="dh-cursor" aria-hidden="true" />
        </h1>
        <p className="dh-hero-sub">
          Group CMO running marketing and product across 12 companies. A public operating system from
          someone shipping code between meetings.
        </p>
        <p className="dh6-hero-id">group cmo · 12 companies · bangalore · operator hours 3pm to 2am ist</p>

        <div className="dh-hero-rot" aria-live="polite">
          <span className="dh-hero-rot-key">today</span>
          <span className="dh-hero-rot-gt">&gt;_</span>
          <span key={rot} className="dh-hero-rot-val">
            {rotations[rot]}
            <span className="dh-hero-rot-cursor" />
          </span>
        </div>

        <div className="dh-hero-cta">
          <a className="dh-btn dh-btn-primary" href="/cta?from=hero" target="_blank" rel="noopener">
            Work with me
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a
            className="dh-btn dh-btn-ghost"
            href="#now"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("now")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            See what&apos;s shipping
          </a>
        </div>

        <div className="dh6-term-tile">
          <span className="dh6-term-tile-key">deepkit</span>
          <span>
            try the interactive terminal on <Link href="/command">/command</Link>
          </span>
        </div>
      </div>
      <div className="dh-hero-bottom">
        <div className="dh-hero-stat">
          <span className="dh-stat-num">12</span>
          <span className="dh-stat-lab">companies in motion</span>
        </div>
        <div className="dh-hero-stat">
          <span className="dh-stat-num">{day}</span>
          <span className="dh-stat-lab">days building in public</span>
        </div>
        <div className="dh-hero-stat">
          <span className="dh-stat-num">{narratives}</span>
          <span className="dh-stat-lab">weekly narratives shipped</span>
        </div>
      </div>
    </section>
  );
}
