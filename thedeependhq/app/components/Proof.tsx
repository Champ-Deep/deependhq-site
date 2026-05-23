"use client";

import { motion } from "framer-motion";
import { proofStatements } from "@/lib/content";

export default function Proof() {
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
          Proof
        </h2>

        <div
          style={{
            marginTop: 40,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          {proofStatements.map((statement, index) => (
            <motion.p
              key={statement}
              initial={{ y: 16, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.5 }}
              transition={{
                duration: 0.5,
                delay: index * 0.12,
                ease: "easeOut",
              }}
              style={{
                margin: 0,
                maxWidth: "65ch",
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
                fontWeight: 700,
                fontSize: "var(--text-h2)",
                lineHeight: 1.3,
                color: "var(--color-accent-tertiary)",
              }}
            >
              {statement}
            </motion.p>
          ))}
        </div>
      </div>
    </section>
  );
}
