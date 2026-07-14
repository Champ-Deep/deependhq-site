"use client";
// components/client/r6/Hero6.tsx : round 6 hero.
// Round 5's four-tile hero doctrine kept; adds kinetic typography, where
// headline letters shift variable-font weight with cursor proximity.
// The 3D spatial layer from the legacy Hero6 is intentionally absent here:
// a separate full-screen spatial component owns that concern.

import Link from "next/link";
import { Fragment, useEffect, useRef } from "react";
import { Magnetic } from "./Effects";
import { GuestTerminal, type GuestTerminalProps } from "./GuestTerminal";
import { R6_MOTION_OK, R6_POINTER_FINE } from "./motion";

const R6_H1 = "Past the hype cycle. Into the infrastructure.";

/* ---------- kinetic headline --------------------------------- */

function KineticH1({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!enabled || !R6_MOTION_OK() || !R6_POINTER_FINE()) return;
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>(".k"));
    const onMove = (e: PointerEvent) => {
      for (const s of spans) {
        const r = s.getBoundingClientRect();
        const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
        const t = Math.max(0, 1 - d / 180); // 0..1 proximity
        const w = 800 + Math.round(t * 100); // 800 to 900
        const y = -(t * 3); // subtle lift
        s.style.setProperty("font-variation-settings", `'wght' ${w}`);
        s.style.transform = t > 0.01 ? `translateY(${y}px)` : "";
      }
    };
    const onLeave = () =>
      spans.forEach((s) => {
        s.style.setProperty("font-variation-settings", "'wght' 800");
        s.style.transform = "";
      });
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [enabled]);

  return (
    <h1 className="dh5-hero-h1 r6-kinetic" ref={ref}>
      {R6_H1.split(" ").map((word, wi) => (
        <Fragment key={wi}>
          {wi > 0 ? " " : null}
          <span style={{ display: "inline-block", whiteSpace: "nowrap" }}>
            {word.split("").map((ch, ci) => (
              <span className="k" key={ci}>
                {ch}
              </span>
            ))}
          </span>
        </Fragment>
      ))}
    </h1>
  );
}

/* ---------- hero ---------------------------------------------- */

export interface Hero6Entry {
  day: number;
  date: string;
  shipping_now: string;
  yesterday_thread?: string;
  mood?: string;
  arc_color?: string;
}

export interface Hero6Post {
  title: string;
  dek?: string;
  summary?: string;
  slug: string;
  date?: string;
  read?: string;
}

export interface Hero6Props {
  /** brand.today_day */
  day: number;
  /** latest journey entry */
  entry: Hero6Entry;
  /** status.vault_commits */
  vaultCommits: number;
  /** latest post, or null when none */
  post: Hero6Post | null;
  /** props for the embedded guest terminal */
  terminal: GuestTerminalProps;
  kinetic?: boolean;
}

const moodLabel: Record<string, string> = {
  "🔒": "locked in",
  "♟️": "strategic",
  "🤖": "automating",
  "🎯": "focused",
  "📡": "signal hunting",
  "🤝": "dealmaking",
  "🚀": "accelerating",
  "🌍": "global",
  "⚡": "fast",
  "🏔️": "climbing",
};

export function Hero6({ day, entry, vaultCommits, post, terminal, kinetic = true }: Hero6Props) {
  const t = entry;

  return (
    <section className="dh5-hero" data-screen-label="hero" aria-label="hero">
      <div className="dh-bento">
        <div className="dh-tile dh5-hero-statement b7">
          <KineticH1 enabled={kinetic} />
          <p className="dh5-hero-fact">
            I run marketing and product across 12 companies. And I ship something every day.
          </p>
          <p className="dh5-hero-id">
            group cmo · 12 companies · bangalore · <b>operator hours 3pm to 2am ist</b>
          </p>
          <span className="dh5-day">
            day <b>{day}</b> of building in public
          </span>
          <div className="dh5-cta-row">
            <Magnetic>
              <a className="dh5-cta" href="/cta?from=hero">
                work with me
              </a>
            </Magnetic>
            <span className="dh5-cta-alt">
              or <Link href="/journey">watch me build</Link>
            </span>
          </div>
        </div>

        <div className="dh-tile b5" data-win={t.arc_color === "gold" ? "true" : undefined}>
          <span className="dh-tile-key">shipping today · day {t.day}</span>
          <p className="dh5-ship-line">{t.shipping_now}</p>
          {t.yesterday_thread ? <p className="dh5-ship-thread">yesterday: {t.yesterday_thread}</p> : null}
          <div className="dh5-ship-meta">
            <span>{t.date}</span>
            <span>
              mood{" "}
              <span className="dh5-mood" role="img" aria-label={moodLabel[t.mood ?? ""] || "mood"}>
                {t.mood}
              </span>
            </span>
            <span>
              commits <span className="val">{vaultCommits} today</span>
            </span>
          </div>
        </div>

        <GuestTerminal {...terminal} />

        <div className="dh-tile b4 dh6r-essay-tile">
          <span className="dh-tile-key">latest essay</span>
          {post ? (
            <Fragment>
              <h2 className="dh5-essay-title dh6r-essay-title">{post.title}</h2>
              <p className="dh5-essay-dek dh6r-essay-dek">{post.dek || post.summary}</p>
              {post.date || post.read ? (
                <span className="dh6r-essay-meta">
                  {post.date ? <span>{post.date}</span> : null}
                  {post.read ? <span>{post.read}</span> : null}
                </span>
              ) : null}
              <Link className="dh6r-btn-ghost" href={`/writing/${post.slug}`}>
                read it →
              </Link>
            </Fragment>
          ) : (
            <p className="dh5-essay-dek">the weekly narrative lands sunday 06:00 ist.</p>
          )}
        </div>
      </div>
    </section>
  );
}
