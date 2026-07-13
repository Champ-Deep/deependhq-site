"use client";
// Terminal : the playable deepkit shell. Port of Terminal from
// CommandPage.jsx. All vault data (brand day, latest journey entry, company
// names, build lanes, now focus) arrives as serializable props. The theme
// command still goes through window.dhTheme, which the sitewide palette
// registers on mount.

import { useEffect, useRef, useState } from "react";
import { fireConfetti } from "./flair";

interface Seg {
  t: string;
  c: string | null;
}

interface TermLine {
  cls: string;
  segs: Seg[];
}

export interface TerminalLaneItem {
  name: string;
}

export interface TerminalFocusItem {
  k?: string;
  color?: string;
  text?: string;
}

export interface TerminalProps {
  brandDay: number;
  j0: { day?: number; shipping_now?: string };
  companies: string[];
  lanes: { live: TerminalLaneItem[]; building: TerminalLaneItem[] };
  nowFocus: TerminalFocusItem[];
}

const seg = (t: string, c: string | null = null): Seg => ({ t, c });

const BOOT: TermLine[] = [
  {
    cls: "out",
    segs: [
      seg("deepkit shell v1.0 · ", "g"),
      seg("type ", null),
      seg("help", "g"),
      seg(" to start. hidden commands exist. try ", null),
      seg("matrix", "g"),
      seg(", ", null),
      seg("coffee", "g"),
      seg(", ", null),
      seg("sudo hire", "g"),
      seg(".", null),
    ],
  },
];

export function Terminal({ brandDay, j0, companies, lanes, nowFocus }: TerminalProps) {
  const [lines, setLines] = useState<TermLine[]>(BOOT);
  const [val, setVal] = useState("");
  const [coffee, setCoffee] = useState(3);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [lines]);
  const respond = (raw: string): TermLine[] | null => {
    const cmd = raw.trim();
    const lc = cmd.toLowerCase();
    if (!lc) return [];
    if (lc === "clear") {
      setLines(BOOT);
      return null;
    }
    if (lc === "help")
      return [
        {
          cls: "out",
          segs: [
            seg("commands: ", null),
            seg("whoami now ship stack companies repos contact ls pwd date echo theme coffee matrix party sudo clear", "g"),
          ],
        },
      ];
    if (lc === "whoami")
      return [
        {
          cls: "out",
          segs: [
            seg(
              "sreedeep surapaneni · group cmo, champions group. building an ai operating system across 12 companies. shipping code between meetings, day " +
                (brandDay || "") +
                ".",
              null
            ),
          ],
        },
      ];
    if (lc === "now") {
      const f = nowFocus || [];
      return f.slice(0, 4).map((x) => ({
        cls: "out",
        segs: [
          seg((x.k || "").toLowerCase() + " ", x.color === "gold" ? "gd" : x.color === "blue" ? "bl" : "g"),
          seg("· " + (x.text ?? ""), null),
        ],
      }));
    }
    if (lc === "ship") {
      fireConfetti();
      return [{ cls: "out", segs: [seg("day " + (j0.day || "") + " · ", "g"), seg(j0.shipping_now || "shipping.", null)] }];
    }
    if (lc === "stack") {
      const live = (lanes.live || []).map((x) => x.name).join(", ");
      const building = (lanes.building || []).map((x) => x.name).join(", ");
      return [
        { cls: "out", segs: [seg("live: ", "g"), seg(live || "champmail, champdf, champvoice", null)] },
        { cls: "out", segs: [seg("building: ", "bl"), seg(building || "champ iq, champset", null)] },
      ];
    }
    if (lc === "companies") return [{ cls: "out", segs: [seg(companies.join(" · ") || "12 ventures", null)] }];
    if (lc === "repos")
      return [{ cls: "out", segs: [seg("github.com/Champ-Deep", "g"), seg(" · 37 public repos and counting.", null)] }];
    if (lc === "contact")
      return [
        {
          cls: "out",
          segs: [seg("book: ", null), seg("scheduler.zoom.us/sreedeep", "g"), seg("  ·  ", null), seg("github.com/Champ-Deep", "g")],
        },
      ];
    if (lc === "ls")
      return [{ cls: "out", segs: [seg("status/  the-build/  public-log/  commits/  ecosystem/  repos/  on-my-radar/", "g")] }];
    if (lc === "pwd") return [{ cls: "out", segs: [seg("/home/deep/command-center", null)] }];
    if (lc === "date") return [{ cls: "out", segs: [seg(new Date().toString(), null)] }];
    if (lc === "theme" || lc.startsWith("theme ")) {
      const arg = lc.split(/\s+/)[1];
      if (!arg) return [{ cls: "out", segs: [seg("usage: ", null), seg("theme green|blue|gold|cyan|magenta|reset", "g")] }];
      const r = window.dhTheme ? window.dhTheme.set(arg) : null;
      return [
        { cls: "out", segs: r ? [seg(r, "g")] : [seg("unknown theme. try green, blue, gold, cyan, magenta, reset.", null)] },
      ];
    }
    if (lc.startsWith("echo ")) return [{ cls: "out", segs: [seg(cmd.slice(5), null)] }];
    if (lc === "coffee") {
      const n = coffee + 1;
      setCoffee(n);
      return [
        { cls: "out", segs: [seg("  ( ( (\n   )_)_)\n  |____| ", "gd"), seg(" cup #" + n + ". the build runs on it.", null)] },
      ];
    }
    if (lc === "matrix") {
      fireConfetti({ particleCount: 140, spread: 100, colors: ["#30E060", "#E8E4DC"] });
      return [{ cls: "out", segs: [seg("wake up, neo... the vault has you.", "g")] }];
    }
    if (lc === "party" || lc === "confetti") {
      fireConfetti({ particleCount: 160, spread: 110 });
      return [{ cls: "out", segs: [seg("🎉 shipped.", "gd")] }];
    }
    if (lc === "sudo hire" || lc === "hire")
      return [
        { cls: "out", segs: [seg("smart move. ", null), seg("scheduler.zoom.us/sreedeep", "g"), seg(". let us build you one.", null)] },
      ];
    if (lc.startsWith("sudo"))
      return [
        { cls: "out", segs: [seg("nice try. you are not root here. but ", null), seg("sudo hire", "g"), seg(" works.", null)] },
      ];
    if (lc === "rm -rf /" || lc.startsWith("rm ")) return [{ cls: "out", segs: [seg("ha. not today.", "gd")] }];
    return [{ cls: "out", segs: [seg(`command not found: ${lc}. try `, null), seg("help", "g"), seg(".", null)] }];
  };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const echo: TermLine = { cls: "in", segs: [seg("deep@hq ", "p"), seg("~ % " + val, null)] };
    const out = respond(val);
    if (out === null) {
      setVal("");
      return;
    }
    setLines((prev) => [...prev, echo, ...out]);
    setVal("");
  };
  return (
    <div className="cc-section">
      <div className="cc-sec-head">
        <h2 className="cc-sec-title">Poke around</h2>
        <span className="cc-badge live">interactive</span>
        <span className="cc-sec-note">a real shell. type a command, hit enter</span>
      </div>
      <div className="cc-term" onClick={() => inRef.current && inRef.current.focus()}>
        <div className="cc-term-bar">
          <span className="cc-term-dot r" />
          <span className="cc-term-dot y" />
          <span className="cc-term-dot g" />
          <span className="cc-term-title">deepkit · shell</span>
        </div>
        <div className="cc-term-body" ref={bodyRef}>
          {lines.map((ln, i) => (
            <div key={i} className={`cc-term-line ${ln.cls}`}>
              {ln.segs.map((s, k) => (
                <span key={k} className={s.c || ""}>
                  {s.t}
                </span>
              ))}
            </div>
          ))}
          <form onSubmit={submit} className="cc-term-input-row">
            <span className="p">deep@hq ~ %</span>
            <input
              ref={inRef}
              className="cc-term-input"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              spellCheck="false"
              autoComplete="off"
              aria-label="terminal input"
            />
          </form>
        </div>
      </div>
      <p className="cc-term-hint">
        try <b>whoami</b>, <b>now</b>, <b>ship</b>, <b>matrix</b>, <b>coffee</b>, <b>sudo hire</b>
      </p>
    </div>
  );
}
