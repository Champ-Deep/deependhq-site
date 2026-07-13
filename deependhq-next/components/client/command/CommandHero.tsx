"use client";
// CommandHero : hero block of /command. Port of HeroCanvas, TypedLine, the
// live IST clock, the vitals row, and the konami confetti listener from
// CommandPage.jsx. VANTA.NET backdrop when the CDN global is present, matrix
// rain fallback otherwise, nothing when reduced motion is preferred.

import { useEffect, useRef, useState } from "react";
import { fireConfetti, istClock, prefersReduced, whenReady, type VantaEffect, type TypedInstance } from "./flair";

/* ---------- Hero backdrop: VANTA.NET, fallback to matrix rain ---------- */
const startMatrixRain = (host: HTMLElement): (() => void) => {
  const cv = document.createElement("canvas");
  cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
  host.appendChild(cv);
  const ctx = cv.getContext("2d");
  if (!ctx) {
    try {
      host.removeChild(cv);
    } catch {
      /* already detached */
    }
    return () => {};
  }
  let raf = 0;
  let w = 0;
  let h = 0;
  let cols = 0;
  let drops: number[] = [];
  let last = 0;
  const chars = "01<>/_$#{}[]=+*?;:";
  const resize = () => {
    const r = host.getBoundingClientRect();
    w = cv.width = Math.max(1, r.width);
    h = cv.height = Math.max(1, r.height);
    cols = Math.floor(w / 14);
    drops = new Array(cols).fill(0).map(() => Math.random() * (h / 16));
  };
  resize();
  window.addEventListener("resize", resize);
  const draw = (ts: number) => {
    raf = requestAnimationFrame(draw);
    if (ts - last < 70) return;
    last = ts;
    ctx.fillStyle = "rgba(13,15,20,0.30)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = "12px monospace";
    for (let i = 0; i < cols; i++) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      const x = i * 14;
      const y = drops[i] * 16;
      ctx.fillStyle = Math.random() > 0.975 ? "#E8E4DC" : "rgba(48,224,96,0.6)";
      ctx.fillText(ch, x, y);
      if (y > h && Math.random() > 0.975) drops[i] = 0;
      else drops[i] += 1;
    }
  };
  raf = requestAnimationFrame(draw);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    try {
      host.removeChild(cv);
    } catch {
      /* already detached */
    }
  };
};

const HeroCanvas = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vanta: VantaEffect | null = null;
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    if (!prefersReduced()) {
      whenReady(() => !!(window.VANTA && window.VANTA.NET && window.THREE)).then((ok) => {
        if (cancelled) return;
        if (ok && window.VANTA && window.VANTA.NET && window.THREE) {
          try {
            vanta = window.VANTA.NET({
              el,
              THREE: window.THREE,
              color: 0x30e060,
              backgroundColor: 0x0d0f14,
              backgroundAlpha: 0,
              points: 12,
              maxDistance: 22,
              spacing: 16,
              showDots: true,
              mouseControls: false,
              touchControls: false,
              gyroControls: false,
            });
          } catch {
            vanta = null;
          }
        }
        if (!vanta) {
          try {
            cleanup = startMatrixRain(el);
          } catch {
            /* backdrop stays empty */
          }
        }
      });
    }
    return () => {
      cancelled = true;
      if (vanta) {
        try {
          vanta.destroy();
        } catch {
          /* already gone */
        }
      }
      if (cleanup) cleanup();
    };
  }, []);
  return <div ref={ref} className="cc-backdrop" aria-hidden="true" />;
};

/* ---------- typed.js hero prompt (falls back to static text) ---------- */
const TypedLine = ({ day }: { day: number | string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const STR = [
      "shipping code between meetings.",
      "12 companies, one operating system.",
      "past the hype cycle, into the infrastructure.",
      `building in public, day ${day}.`,
    ];
    let t: TypedInstance | null = null;
    let cancelled = false;
    el.textContent = STR[0];
    if (prefersReduced()) return;
    whenReady(() => !!window.Typed).then((ok) => {
      if (cancelled || !ok || !window.Typed) return;
      el.textContent = "";
      try {
        t = new window.Typed(el, {
          strings: STR,
          typeSpeed: 38,
          backSpeed: 16,
          backDelay: 1900,
          startDelay: 400,
          loop: true,
          smartBackspace: true,
          showCursor: false,
        });
      } catch {
        el.textContent = STR[0];
      }
    });
    return () => {
      cancelled = true;
      if (t) {
        try {
          t.destroy();
        } catch {
          /* already gone */
        }
      }
    };
  }, [day]);
  return <span className="cc-typed" ref={ref} />;
};

export interface CommandHeroProps {
  todayDay: number;
  entriesLogged: number;
  companiesCount: number;
  weekliesShipped: number;
}

export function CommandHero({ todayDay, entriesLogged, companiesCount, weekliesShipped }: CommandHeroProps) {
  const [clock, setClock] = useState("");
  useEffect(() => {
    setClock(istClock());
    const id = setInterval(() => setClock(istClock()), 1000);
    return () => clearInterval(id);
  }, []);
  // konami easter egg
  useEffect(() => {
    const seq = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    let i = 0;
    const h = (e: KeyboardEvent) => {
      const k = e.keyCode || e.which;
      i = k === seq[i] ? i + 1 : k === seq[0] ? 1 : 0;
      if (i === seq.length) {
        fireConfetti({ particleCount: 180, spread: 120 });
        i = 0;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <>
      <HeroCanvas />
      <section className="cc-hero">
        <div className="cc-hero-inner">
          <span className="cc-eyebrow">
            <span className="cc-eyebrow-dot" /> command center · bangalore · {clock} · systems nominal
          </span>
          <h1 className="cc-hero-title">
            Everything I am building,
            <br />
            on one screen.
            <span className="cc-cursor" aria-hidden="true" />
          </h1>
          <p className="cc-hero-prompt">
            <span className="cc-gt">&gt;_</span> <TypedLine day={todayDay} />
          </p>
          <p className="cc-hero-sub">
            The operator view of the whole operation. Live status, the build queue, the public log, the ecosystem, and
            the code. Updated daily by the machine that runs it.
          </p>
          <div className="cc-vitals">
            <div className="cc-vital">
              <span className="cc-vital-num green">{todayDay || "·"}</span>
              <span className="cc-vital-lab">days in public</span>
            </div>
            <div className="cc-vital">
              <span className="cc-vital-num">{entriesLogged}</span>
              <span className="cc-vital-lab">entries logged</span>
            </div>
            <div className="cc-vital">
              <span className="cc-vital-num blue">{companiesCount || 12}</span>
              <span className="cc-vital-lab">companies</span>
            </div>
            <div className="cc-vital">
              <span className="cc-vital-num gold">{weekliesShipped || 0}</span>
              <span className="cc-vital-lab">weeklies shipped</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
