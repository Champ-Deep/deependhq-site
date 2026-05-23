"use client";

import { motion } from "framer-motion";
import { companyCards } from "@/lib/content";

export default function Ecosystem() {
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
          The Ecosystem
        </h2>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {companyCards.map((company, index) => (
            <motion.article
              key={company.name}
              className="dhq-card dhq-card-company"
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.45,
                delay: (index % 3) * 0.08,
                ease: "easeOut",
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
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
                  }}
                >
                  {company.name}
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
                  {company.oneLiner}
                </p>
              </div>
              <span className="dhq-pill dhq-pill-gold">{company.tag}</span>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
