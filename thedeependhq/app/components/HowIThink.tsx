"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { povCards, type ArcColor } from "@/lib/content";

function pillClass(arc: ArcColor): string {
  if (arc === "blue") return "dhq-pill dhq-pill-blue";
  if (arc === "gold") return "dhq-pill dhq-pill-gold";
  return "dhq-pill dhq-pill-green";
}

function arcLabel(arc: ArcColor): string {
  if (arc === "blue") return "Idea";
  if (arc === "gold") return "Highlight";
  return "Shipping";
}

export default function HowIThink() {
  return (
    <section
      className="dhq-section"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="dhq-container">
        <h2
          className="font-display"
          style={{
            fontWeight: 700,
            fontSize: "var(--text-h1)",
            lineHeight: 1.2,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          How I Think
        </h2>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {povCards.map((card, index) => (
            <motion.a
              key={card.title}
              href={card.href}
              className="dhq-card"
              initial={{ y: 24, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.5,
                delay: index * 0.12,
                ease: "easeOut",
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: "var(--text-h3)",
                    lineHeight: 1.3,
                    color: "var(--color-text-primary)",
                    margin: 0,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span>{card.title}</span>
                  <ArrowUpRight
                    size={20}
                    aria-hidden="true"
                    style={{
                      flexShrink: 0,
                      color: "var(--color-text-secondary)",
                      marginTop: 2,
                    }}
                  />
                </h3>
                <p
                  style={{
                    marginTop: 12,
                    marginBottom: 0,
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {card.hook}
                </p>
              </div>
              <span className={pillClass(card.arc)}>{arcLabel(card.arc)}</span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
