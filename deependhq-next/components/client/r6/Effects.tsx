"use client";
// components/client/r6/Effects.tsx : round 6 interaction primitives.
// Magnetic (spring-back hover CTAs), RevealsManager (cascading scroll
// entrances with blur focal shift), SplitFlap (about bio), About6 section.
// Every effect: base state = end state; motion gated on media queries.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { R6_MOTION_OK, R6_POINTER_FINE } from "./motion";

/* ---------- magnetic hover ---------------------------------- */

export interface MagneticProps {
  children: ReactNode;
  radius?: number;
  pull?: number;
}

export function Magnetic({ children, radius = 90, pull = 0.28 }: MagneticProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!R6_MOTION_OK() || !R6_POINTER_FINE()) return;
    const el = ref.current;
    if (!el) return;
    let inside = false;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      const reach = radius + Math.max(r.width, r.height) / 2;
      if (d < reach) {
        if (!inside) {
          inside = true;
          setLive(true);
        }
        el.style.transform = `translate(${dx * pull}px, ${dy * pull}px)`;
      } else if (inside) {
        inside = false;
        setLive(false);
        el.style.transform = "";
      }
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, [radius, pull]);

  return (
    <span className="r6-mag" data-live={live || undefined} ref={ref}>
      {children}
    </span>
  );
}

/* ---------- cascading reveals -------------------------------- */
// Mount once per page. Finds [data-r6-reveal], hides them (motion path
// only), reveals on intersection. No-JS / reduced motion: never hidden.

export function RevealsManager() {
  useEffect(() => {
    if (!R6_MOTION_OK() || !("IntersectionObserver" in window)) return;
    const els = Array.from(document.querySelectorAll("[data-r6-reveal]"));
    const vh = window.innerHeight;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("r6-in");
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => {
      // never hide what's already on screen at load
      if (el.getBoundingClientRect().top < vh * 0.9) return;
      el.classList.add("r6-pre");
      io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return null;
}

/* ---------- split-flap text ---------------------------------- */

const FLAP_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789·/>_ ";

export interface SplitFlapProps {
  text: string;
}

export function SplitFlap({ text }: SplitFlapProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  // Base state = end state: server render and no-JS show the full text.
  // A mount effect arms the animation only when motion is allowed, which
  // matches the legacy behavior of starting scrambled on capable clients.
  const [done, setDone] = useState(true);

  useEffect(() => {
    if (R6_MOTION_OK()) setDone(false);
  }, []);

  useEffect(() => {
    if (done) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setDone(true);
      return;
    }
    let raf = 0;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started) return;
        started = true;
        io.disconnect();
        const spans = Array.from(el.querySelectorAll<HTMLSpanElement>(".f"));
        const t0 = performance.now();
        const settle = (i: number) => 260 + i * 26; // per-char settle time
        const tick = (t: number) => {
          let pending = false;
          spans.forEach((s, i) => {
            const target = s.dataset.ch ?? "";
            if (target === " ") {
              s.textContent = " ";
              return;
            }
            if (t - t0 >= settle(i)) {
              s.textContent = target;
              s.removeAttribute("data-live");
            } else {
              pending = true;
              s.setAttribute("data-live", "true");
              s.textContent = FLAP_CHARS[(Math.random() * FLAP_CHARS.length) | 0];
            }
          });
          if (pending) raf = requestAnimationFrame(tick);
          else setDone(true);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [done]);

  return (
    <p className="r6-flap" ref={ref} aria-label={text}>
      <span aria-hidden="true">
        {text.split("").map((ch, i) => (
          <span className="f" data-ch={ch} key={i}>
            {done ? (ch === " " ? " " : ch) : " "}
          </span>
        ))}
      </span>
      <span className="r6-about-cursor" aria-hidden="true"></span>
    </p>
  );
}

/* ---------- about section ------------------------------------ */

const R6_BIO =
  "twelve companies. one operating rhythm. i run marketing and product " +
  "from bangalore, 3pm to 2am ist, and ship something every day. " +
  "the log is public. the receipts are on this page.";

export function About6() {
  return (
    <section className="dh5-section" data-screen-label="about" aria-label="about" data-r6-reveal="">
      <div className="dh5-section-head">
        <h2>the operator</h2>
        <span className="r6-chip">live feed</span>
      </div>
      <div className="dh-tile b12">
        <span className="dh-tile-key">whoami</span>
        <SplitFlap text={R6_BIO} />
      </div>
    </section>
  );
}
