"use client";
// components/client/r6/GuestTerminal.tsx : the one place the game DNA lives.
// "deepkit · guest session" in the hero bento. Every command answers with
// something true about the operator. The legacy component read window.DH_DATA;
// this port receives the same facts as serializable props from a server parent.
// Keyboard accessible, screen-reader labeled.

import { useEffect, useRef, useState } from "react";

// ---------- props: the minimal slice of DH_DATA the terminal uses ----------

export interface TerminalJourneyEntry {
  day: number;
  shipping_now: string;
  arcs?: string[];
}

export interface TerminalCompany {
  name: string;
}

export interface TerminalOnRepeat {
  track: string;
  artist: string;
}

export interface GuestTerminalProps {
  /** brand.today_day */
  day: number;
  /** journey, newest first. [0] feeds the boot line, first 5 feed `ships`, arcs feed `companies`. */
  journey: TerminalJourneyEntry[];
  /** companies list, names only */
  companies: TerminalCompany[];
  /** stack labels, already flattened to strings by the server parent */
  stack: string[];
  /** status.on_repeat, or null when nothing is looping */
  onRepeat: TerminalOnRepeat | null;
  /** status.coffee cups today */
  coffee: number;
}

// ---------- theme + attribution helpers ------------------------------------

const GT_THEMES = ["green", "gold", "blue", "magenta"];

function gtApplyTheme(t: string | undefined): boolean {
  if (!t || !GT_THEMES.includes(t)) return false;
  if (t === "green") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("dh-theme", t);
  } catch {
    // storage unavailable: theme still applies for this page view
  }
  return true;
}

// attribution: same pattern as /cta?from=. we log which commands guests
// explore so the owner learns what strangers actually ask.
function gtLog(cmd: string) {
  try {
    const k = "dh-terminal-log";
    const log = JSON.parse(localStorage.getItem(k) || "{}") as Record<string, number>;
    log[cmd] = (log[cmd] || 0) + 1;
    localStorage.setItem(k, JSON.stringify(log));
  } catch {
    // storage unavailable: skip logging
  }
}

// ---------- commands --------------------------------------------------------

type TermLine = [kind: string, text: string];
type Command = ((arg?: string) => TermLine[]) | "CLEAR";

function gtCommands(props: GuestTerminalProps): Record<string, Command> {
  const { day, journey, companies, stack, onRepeat, coffee } = props;
  const j = journey;
  return {
    help: () => [
      ["dim", "commands:"],
      ["out", "  whoami      who runs this"],
      ["out", "  ships       last 5 things shipped"],
      ["out", "  companies   the 12, live"],
      ["out", "  stack       what everything runs on"],
      ["out", "  music       what is on repeat"],
      ["out", "  day         the count"],
      ["out", "  theme       green | gold | blue | magenta"],
      ["out", "  hire        work with me"],
      ["dim", "  also: coffee, sudo, clear. tab completes."],
    ],
    whoami: () => [
      ["out", "group cmo. 12 companies. bangalore."],
      ["out", "marketing and product across the group, shipping daily since day 1."],
      ["dim", "operator hours 3pm to 2am ist."],
    ],
    ships: () => [
      ["dim", "tail -5 /var/log/ships"],
      ...j.slice(0, 5).map((e): TermLine => ["acc", `day ${e.day} · ${e.shipping_now}`]),
    ],
    companies: () => {
      const active = new Set(j.flatMap((e) => e.arcs || []));
      return [
        ["dim", `${companies.length} companies in motion:`],
        ...companies.map((c): TermLine => {
          const hot = [...active].some((a) =>
            a.toLowerCase().includes(c.name.toLowerCase().split(" ")[0])
          );
          return [hot ? "acc" : "dim", `  ${c.name}  ${hot ? "· active this week" : ""}`];
        }),
      ];
    },
    stack: () => [
      ["dim", "the operating system:"],
      ...stack.slice(0, 6).map((s): TermLine => ["out", `  ${s}`]),
      ["dim", "one vault, twelve companies, zero slides."],
    ],
    music: () => {
      const r = onRepeat;
      return r
        ? [
            ["hum", `on repeat: ${r.track} · ${r.artist}`],
            ["dim", "the human layer runs on loops."],
          ]
        : [["dim", "nothing on repeat today. rare."]];
    },
    day: () => [
      ["out", `day ${day} of building in public.`],
      ["dim", "every day has a log entry. no gaps."],
    ],
    hire: () => {
      gtLog("hire");
      window.location.href = "/cta?from=terminal";
      return [["acc", "opening /cta ..."]];
    },
    theme: (arg?: string) =>
      gtApplyTheme(arg)
        ? [["acc", `accent set to ${arg}. persists, and follows you to /command.`]]
        : [["err", `usage: theme <${GT_THEMES.join("|")}>`]],
    coffee: () => [
      ["out", "/".repeat(coffee || 3) + ` (${coffee || 3} cups today)`],
      ["dim", "the real stack."],
    ],
    sudo: () => [
      ["err", "guest is not in the sudoers file. this incident will be reported to chief."],
    ],
    clear: "CLEAR",
    // easter eggs. discoverable, not documented in help.
    gg: () => [["win", "gg. but the run is not over: " + day + " days and counting."]],
    tail: () => [["dim", "try: ships"]],
    konami: () => [["win", "no cheat codes here. just the log."]],
    chief: () => [
      ["out", "chief says: move faster."],
      ["dim", "so we do."],
    ],
  };
}

// ---------- component -------------------------------------------------------

export function GuestTerminal(props: GuestTerminalProps) {
  const { day, journey } = props;
  const [lines, setLines] = useState<TermLine[]>([
    ["dim", "deepkit v5 · guest session · type help"],
    ["out", `day ${day}. shipping: ${(journey[0] || { shipping_now: "" }).shipping_now || ""}`],
  ]);
  const [val, setVal] = useState("");
  const [hist, setHist] = useState<string[]>([]);
  const [hi, setHi] = useState(-1);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // restore persisted theme (shared with /command)
    try {
      const t = localStorage.getItem("dh-theme");
      if (t) gtApplyTheme(t);
    } catch {
      // storage unavailable: default theme stands
    }
  }, []);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);

  const run = (raw: string) => {
    const input = raw.trim();
    if (!input) return;
    const [cmd = "", ...rest] = input.toLowerCase().split(/\s+/);
    const cmds = gtCommands(props);
    gtLog(cmd);
    setHist((h) => [input, ...h].slice(0, 30));
    setHi(-1);
    const entry = cmds[cmd];
    if (entry === "CLEAR") {
      setLines([]);
      return;
    }
    const echo: TermLine = ["echo", `guest@deependhq:~$ ${input}`];
    const out: TermLine[] = entry ? entry(rest[0]) : [["err", `${cmd}: not found. type help.`]];
    setLines((L) => [...L, echo, ...out]);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      run(val);
      setVal("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.min(hi + 1, hist.length - 1);
      if (hist[n]) {
        setHi(n);
        setVal(hist[n]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = hi - 1;
      setHi(n);
      setVal(n >= 0 ? hist[n] || "" : "");
    } else if (e.key === "Tab") {
      e.preventDefault();
      const names = Object.keys(gtCommands(props));
      const match = names.find((n) => n.startsWith(val.toLowerCase()) && val);
      if (match) setVal(match);
    }
  };

  const cls: Record<string, string> = {
    echo: "t-out t-dim",
    out: "t-out",
    dim: "t-out t-dim",
    acc: "t-out t-acc",
    win: "t-out t-win",
    hum: "t-out t-hum",
    err: "t-out t-err",
  };

  return (
    <div className="dh-tile dh5-term b8" role="region" aria-label="deepkit guest terminal">
      <div className="dh5-term-bar">
        <span>deepkit · guest session</span>
        <span aria-hidden="true">tty1</span>
      </div>
      <div
        className="dh5-term-body"
        ref={bodyRef}
        aria-live="polite"
        aria-atomic="false"
        onClick={() => inputRef.current && inputRef.current.focus()}
      >
        {lines.map((l, i) => (
          <p key={i} className={cls[l[0]] || "t-out"}>
            {l[1]}
          </p>
        ))}
      </div>
      <div className="dh5-term-in">
        <span className="dh5-term-prompt" aria-hidden="true">
          guest@deependhq:~$
        </span>
        <input
          ref={inputRef}
          className="dh5-term-input"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={onKey}
          aria-label="terminal command input. type help and press enter."
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>
      <div className="dh5-term-hint">
        try <b>ships</b> or <b>theme gold</b> · <kbd>tab</kbd> completes · <kbd>↑</kbd> history
      </div>
    </div>
  );
}
