"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { Menu, X, CalendarClock } from "lucide-react";
import { navLinks, SCHEDULER_URL } from "@/lib/content";

/**
 * "/" is a Next route (this homepage). Content paths like /journey and
 * /toolkit are served by the Astro content site in the merged Cloudflare
 * Pages deployment, so they must be plain anchors that trigger a full
 * navigation. Next client-side routing would 404 them.
 */
function NavItem({
  href,
  label,
  style,
  className,
  onClick,
}: {
  href: string;
  label: string;
  style: CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  if (href === "/") {
    return (
      <Link href={href} style={style} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  }
  return (
    <a href={href} style={style} className={className} onClick={onClick}>
      {label}
    </a>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: 64,
        backgroundColor: "rgba(13, 15, 20, 0.8)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div
        className="dhq-container"
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Wordmark */}
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: 18,
            color: "var(--color-text-primary)",
          }}
        >
          deependhq
        </Link>

        {/* Desktop links */}
        <div className="dhq-nav-desktop" style={{ alignItems: "center", gap: 28 }}>
          {navLinks.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              className="dhq-nav-link"
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: link.href === "/" ? 600 : 500,
                fontSize: 14,
                color:
                  link.href === "/"
                    ? "var(--color-accent-primary)"
                    : "var(--color-text-secondary)",
              }}
            />
          ))}
          <a
            href={SCHEDULER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ padding: "8px 16px", minHeight: 40 }}
          >
            <CalendarClock size={16} aria-hidden="true" />
            Book a call
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="dhq-nav-toggle"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-text-primary)",
            cursor: "pointer",
            width: 44,
            height: 44,
            display: "none",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div
          className="dhq-nav-mobile"
          style={{
            backgroundColor: "var(--color-bg)",
            borderBottom: "1px solid var(--color-border)",
            padding: "16px 20px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {navLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                onClick={() => setOpen(false)}
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: link.href === "/" ? 600 : 500,
                  fontSize: 16,
                  color:
                    link.href === "/"
                      ? "var(--color-accent-primary)"
                      : "var(--color-text-primary)",
                  padding: "12px 0",
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                }}
              />
            ))}
            <a
              href={SCHEDULER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ marginTop: 12 }}
              onClick={() => setOpen(false)}
            >
              <CalendarClock size={16} aria-hidden="true" />
              Book a call
            </a>
          </div>
        </div>
      )}

      <style>{`
        .dhq-nav-desktop { display: flex; }
        .dhq-nav-mobile { display: none; }
        .dhq-nav-link:hover { color: var(--color-text-primary) !important; }
        @media (max-width: 768px) {
          .dhq-nav-desktop { display: none; }
          .dhq-nav-toggle { display: flex !important; }
          .dhq-nav-mobile { display: block; }
        }
      `}</style>
    </nav>
  );
}
