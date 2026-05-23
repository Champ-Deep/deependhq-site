"use client";

import { motion } from "framer-motion";
import { shippingEntries } from "@/lib/content";

// NOTE: This section currently renders static mock data from lib/content.ts.
// In production it will fetch live from the EmDash API:
//   GET /api/entries?type=daily_entry&limit=3&sort=date:desc
// No network call is made at build time so the page stays fully static.

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ShippingNow() {
  return (
    <section className="dhq-section" style={{ backgroundColor: "var(--color-bg)" }}>
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
          Shipping Now
        </h2>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {shippingEntries.map((entry, index) => (
            <motion.article
              key={entry.date}
              className="dhq-card"
              initial={{ y: 24, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 0.5,
                delay: index * 0.12,
                ease: "easeOut",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span
                  className="font-code"
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  {formatDate(entry.date)}
                </span>
                <span className="dhq-pill dhq-pill-green">
                  Day {entry.day}
                </span>
              </div>

              <p
                className="font-code"
                style={{
                  marginTop: 16,
                  marginBottom: 0,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--color-text-primary)",
                }}
              >
                {/* >_ terminal prompt motif, Matrix green, signature of this section */}
                <span
                  style={{
                    color: "var(--color-accent-primary)",
                    fontWeight: 600,
                    marginRight: 8,
                  }}
                >
                  &gt;_
                </span>
                {entry.text}
              </p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
