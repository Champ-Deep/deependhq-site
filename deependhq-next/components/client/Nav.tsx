"use client";
// Nav : sticky top, frosted Gotham, Matrix-green active link.
// Port of Nav.jsx. Routes replace .html paths; active state from usePathname.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { id: "command", label: "Command", href: "/command" },
  { id: "now", label: "Now", href: "/now" },
  { id: "journey", label: "Journey", href: "/journey" },
  { id: "writing", label: "Writing", href: "/writing" },
  { id: "field-notes", label: "Field Notes", href: "/field-notes" },
  { id: "toolkit", label: "Toolkit", href: "/toolkit" },
];

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const activeId =
    pathname === "/"
      ? "home"
      : pathname.startsWith("/writing")
        ? "writing"
        : LINKS.find((l) => pathname.startsWith(l.href))?.id ?? "";

  return (
    <nav className="dh-nav">
      <Link className="dh-logo" href="/">
        <span className="dh-logo-word">deep</span>
        <span className="dh-logo-gt">&gt;_</span>
      </Link>
      <div className="dh-nav-links" data-open={open}>
        {LINKS.map((l) => (
          <Link
            key={l.id}
            href={l.href}
            className={`dh-nav-link ${activeId === l.id ? "active" : ""}`}
            onClick={() => setOpen(false)}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="dh-nav-actions">
        <a
          href="/cta?from=nav"
          target="_blank"
          rel="noopener"
          className="dh-btn dh-btn-primary dh-btn-sm"
        >
          Book a call
        </a>
        <button className="dh-nav-burger" aria-label="menu" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
