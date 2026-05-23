"use client";

import { motion } from "framer-motion";
import { CalendarClock, ArrowRight } from "lucide-react";
import { SCHEDULER_URL } from "@/lib/content";

export default function SecondCTA() {
  return (
    <section
      className="dhq-section"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="dhq-container">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          style={{ maxWidth: 760 }}
        >
          <h2
            className="font-display"
            style={{
              fontWeight: 800,
              fontSize: "var(--text-h1)",
              lineHeight: 1.15,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Building something? Let&apos;s get into the infrastructure.
          </h2>

          <div style={{ marginTop: 28 }}>
            <a
              href={SCHEDULER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <CalendarClock size={18} aria-hidden="true" />
              Book a call
            </a>
          </div>

          {/* Latest weekly narrative teaser */}
          <a
            href="/blog/#"
            className="dhq-card"
            style={{
              marginTop: 48,
              display: "block",
              maxWidth: 620,
            }}
          >
            <span className="dhq-pill dhq-pill-blue">Weekly narrative</span>
            <h3
              style={{
                marginTop: 14,
                marginBottom: 0,
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: "var(--text-h3)",
                lineHeight: 1.3,
                color: "var(--color-text-primary)",
              }}
            >
              Day 193: The site gets a home
            </h3>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                fontSize: 15,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
              }}
            >
              193 days of building in public, and today the public part gets a
              home.
            </p>
            <span
              style={{
                marginTop: 16,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: 14,
                color: "var(--color-accent-primary)",
              }}
            >
              Read more
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
