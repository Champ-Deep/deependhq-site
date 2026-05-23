"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarClock } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SCHEDULER_URL } from "@/lib/content";

// Headline split into lines for staggered word/line entrance.
const HEADLINE_LINES = [
  "Past the hype cycle.",
  "Into the infrastructure.",
];

export default function Hero() {
  const headlineRef = useRef<HTMLHeadingElement>(null);

  // GSAP ScrollTrigger: subtle parallax on the headline as the user scrolls.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect reduced-motion preference.
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    const el = headlineRef.current;
    if (!el) return;

    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      gsap.to(el, {
        yPercent: 18,
        opacity: 0.55,
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom top",
          scrub: true,
        },
      });
    });

    return () => {
      ctx.revert();
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <section
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--color-bg)",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div className="dhq-container">
        <div style={{ maxWidth: 900 }}>
          <h1
            ref={headlineRef}
            className="font-display"
            style={{
              fontWeight: 800,
              fontSize: "var(--text-hero)",
              lineHeight: 1.1,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            {HEADLINE_LINES.map((line, lineIndex) => (
              <span
                key={line}
                style={{ display: "block", overflow: "hidden" }}
              >
                <motion.span
                  style={{ display: "inline-block" }}
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  transition={{
                    duration: 0.7,
                    delay: 0.15 + lineIndex * 0.18,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
            style={{
              marginTop: 24,
              maxWidth: "65ch",
              fontSize: 18,
              lineHeight: 1.6,
              color: "var(--color-text-secondary)",
            }}
          >
            A living transmission from someone building 12 companies in public.
          </motion.p>

          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.55, delay: 0.85, ease: "easeOut" }}
            style={{ marginTop: 36 }}
          >
            <a
              href={SCHEDULER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <CalendarClock size={18} aria-hidden="true" />
              Book a call
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
