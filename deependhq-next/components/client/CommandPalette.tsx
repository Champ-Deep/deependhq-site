"use client";
// CommandPalette : sitewide cmd-k palette + theme accent persistence.
// Port of Palette.jsx. Deliberately quiet: no banner, just the tiny footer
// hint. Internal navigation goes through the Next router; external links and
// mailto keep their legacy behavior. Registers window.dhTheme on mount so the
// command page terminal can recolor live, and applies any persisted accent.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dhkConfetti, dhThemeApply, dhThemeSet } from "@/components/client/command/flair";

interface PaletteItem {
  grp: string;
  label: string;
  hint?: string;
  run: () => string | null | void;
}

export function CommandPalette({ day = "" }: { day?: number | string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const inRef = useRef<HTMLInputElement>(null);

  // Theme accent persistence, exposed for the terminal `theme` command.
  // Also applies the persisted round 6 palette (operator/ember/dopamine).
  useEffect(() => {
    window.dhTheme = { set: dhThemeSet, apply: dhThemeApply };
    window.dhTheme.apply();
    const pal = localStorage.getItem("dh-r6-palette");
    if (pal) document.documentElement.setAttribute("data-r6-palette", pal);
  }, []);

  const setPalette = (p: string): string => {
    if (p === "operator") {
      document.documentElement.removeAttribute("data-r6-palette");
      localStorage.removeItem("dh-r6-palette");
    } else {
      document.documentElement.setAttribute("data-r6-palette", p);
      localStorage.setItem("dh-r6-palette", p);
    }
    return "palette: " + p;
  };

  const items = useMemo<PaletteItem[]>(
    () => [
      { grp: "go", label: "Command Center", hint: "/command", run: () => { router.push("/command"); } },
      { grp: "go", label: "Now", hint: "/now", run: () => { router.push("/now"); } },
      { grp: "go", label: "Journey", hint: "/journey", run: () => { router.push("/journey"); } },
      { grp: "go", label: "Field Notes", hint: "/field-notes", run: () => { router.push("/field-notes"); } },
      { grp: "go", label: "Toolkit", hint: "/toolkit", run: () => { router.push("/toolkit"); } },
      { grp: "go", label: "Home", hint: "/", run: () => { router.push("/"); } },
      { grp: "do", label: "Book a call", hint: "scheduler", run: () => { window.open("https://scheduler.zoom.us/sreedeep", "_blank"); } },
      { grp: "do", label: "Email deep", hint: "mailto", run: () => { location.href = "mailto:deep@championsmail.com"; } },
      { grp: "do", label: "GitHub", hint: "github.com/Champ-Deep", run: () => { window.open("https://github.com/Champ-Deep", "_blank"); } },
      { grp: "do", label: "LinkedIn", hint: "in/sreedeep-surapaneni", run: () => { window.open("https://www.linkedin.com/in/sreedeep-surapaneni", "_blank"); } },
      { grp: "fun", label: "Confetti", hint: "just because", run: () => { dhkConfetti(); return "wheee."; } },
      { grp: "fun", label: "whoami", hint: "who is this", run: () => "sreedeep · group cmo, building an ai operating system across 12 companies. day " + day + "." },
      { grp: "fun", label: "theme green", hint: "matrix", run: () => dhThemeSet("green") },
      { grp: "fun", label: "theme blue", hint: "arc", run: () => dhThemeSet("blue") },
      { grp: "fun", label: "theme gold", hint: "win", run: () => dhThemeSet("gold") },
      { grp: "fun", label: "theme cyan", hint: "cold", run: () => dhThemeSet("cyan") },
      { grp: "fun", label: "theme magenta", hint: "loud", run: () => dhThemeSet("magenta") },
      { grp: "fun", label: "theme reset", hint: "back to green", run: () => dhThemeSet("reset") },
      { grp: "fun", label: "palette operator", hint: "gotham green", run: () => setPalette("operator") },
      { grp: "fun", label: "palette ember", hint: "green plus orange", run: () => setPalette("ember") },
      { grp: "fun", label: "palette dopamine", hint: "electric blue on black", run: () => setPalette("dopamine") },
    ],
    [day, router]
  );

  const filtered = useMemo<PaletteItem[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(
      (it) => it.label.toLowerCase().includes(s) || (it.hint || "").toLowerCase().includes(s) || it.grp.includes(s)
    );
  }, [q, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setFlash(null);
      setTimeout(() => inRef.current && inRef.current.focus(), 30);
    }
  }, [open]);
  useEffect(() => {
    setSel(0);
  }, [q]);

  const exec = (it?: PaletteItem) => {
    if (!it) return;
    const r = it.run();
    if (typeof r === "string") setFlash(r);
    else setOpen(false);
  };
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(filtered[sel]);
    }
  };

  if (!open) return null;
  return (
    <div
      className="dhk-overlay"
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).classList.contains("dhk-overlay")) setOpen(false);
      }}
    >
      <div className="dhk" role="dialog" aria-label="command palette">
        <div className="dhk-in-row">
          <span className="dhk-gt">&gt;_</span>
          <input
            ref={inRef}
            className="dhk-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="jump to a page, or try a command…"
            aria-label="command palette"
            spellCheck="false"
            autoComplete="off"
          />
          <span className="dhk-esc">esc</span>
        </div>
        {flash && (
          <div className="dhk-flash">
            <span className="dhk-gt">&gt;_</span>
            {flash}
          </div>
        )}
        <div className="dhk-list">
          {filtered.length === 0 && (
            <div className="dhk-empty">&gt;_ nothing matches &quot;{q}&quot;. try a page name.</div>
          )}
          {filtered.map((it, i) => (
            <button
              key={it.label}
              className={`dhk-item ${i === sel ? "active" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => exec(it)}
            >
              <span className={`dhk-grp grp-${it.grp}`}>{it.grp}</span>
              <span className="dhk-label">{it.label}</span>
              <span className="dhk-hint">{it.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
