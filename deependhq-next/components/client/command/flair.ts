"use client";
// flair.ts : shared client helpers for the command surface and the palette.
// Ports the utility layer of CommandPage.jsx and Palette.jsx: reduced-motion
// checks, confetti, IST clock, date formatting, theme accent persistence, and
// typed declarations for the optional CDN flair globals (VANTA, THREE,
// force-graph, typed.js, canvas-confetti). Every consumer degrades gracefully
// when a global is absent, exactly like the legacy page.

export interface VantaEffect {
  destroy(): void;
}

export interface TypedInstance {
  destroy(): void;
}

export interface FGNode {
  id: string;
  name: string;
  hub?: boolean;
  desc?: string;
  tag?: string;
  col?: string;
  x?: number;
  y?: number;
}

export interface FGLink {
  source: string;
  target: string;
}

export interface FGForce {
  strength?: (n: number) => unknown;
  distance?: (n: number) => unknown;
}

export interface ForceGraphInstance {
  graphData(d: { nodes: FGNode[]; links: FGLink[] }): ForceGraphInstance;
  backgroundColor(c: string): ForceGraphInstance;
  width(w: number): ForceGraphInstance;
  height(h: number): ForceGraphInstance;
  nodeRelSize(n: number): ForceGraphInstance;
  nodeVal(f: (n: FGNode) => number): ForceGraphInstance;
  nodeLabel(f: (n: FGNode) => string): ForceGraphInstance;
  linkColor(f: () => string): ForceGraphInstance;
  linkWidth(n: number): ForceGraphInstance;
  onNodeClick(f: (n: FGNode) => void): ForceGraphInstance;
  onBackgroundClick(f: () => void): ForceGraphInstance;
  nodeCanvasObjectMode(f: () => string): ForceGraphInstance;
  nodeCanvasObject(f: (n: FGNode, ctx: CanvasRenderingContext2D, scale: number) => void): ForceGraphInstance;
  onEngineStop(f: () => void): ForceGraphInstance;
  zoomToFit(ms: number, px: number): ForceGraphInstance;
  d3Force(name: string): FGForce | undefined;
  d3VelocityDecay(n: number): ForceGraphInstance;
  _destructor?: () => void;
}

export interface DhTheme {
  set(name: string): string | null;
  apply(): void;
}

declare global {
  interface Window {
    confetti?: (opts?: Record<string, unknown>) => void;
    dhTheme?: DhTheme;
    THREE?: unknown;
    VANTA?: { NET?: (opts: Record<string, unknown>) => VantaEffect };
    ForceGraph?: () => (el: HTMLElement) => ForceGraphInstance;
    Typed?: new (el: Element, opts: Record<string, unknown>) => TypedInstance;
  }
}

const C_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const ACCENTS = ["#30E060", "#4A7BF7", "#C9A84C"];

export const LANG_COLOR: Record<string, string> = {
  Python: "#3572A5",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Go: "#00ADD8",
};

export const langColor = (lang: string | null | undefined): string => (lang && LANG_COLOR[lang]) || "#8A8A8A";

export const prefersReduced = (): boolean =>
  typeof window !== "undefined" &&
  !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

export const fireConfetti = (opts?: Record<string, unknown>): void => {
  if (typeof window === "undefined" || !window.confetti || prefersReduced()) return;
  window.confetti({
    particleCount: 90,
    spread: 72,
    startVelocity: 38,
    ticks: 160,
    origin: { y: 0.72 },
    colors: ["#30E060", "#C9A84C", "#E8E4DC", "#4A7BF7"],
    ...(opts || {}),
  });
};

// Palette flavor of confetti, kept with its original defaults from Palette.jsx.
export const dhkConfetti = (opts?: Record<string, unknown>): void => {
  if (typeof window === "undefined" || !window.confetti || prefersReduced()) return;
  window.confetti({
    particleCount: 90,
    spread: 72,
    origin: { y: 0.7 },
    colors: ["#30E060", "#C9A84C", "#E8E4DC", "#4A7BF7"],
    ...(opts || {}),
  });
};

export const istClock = (): string => {
  try {
    return (
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date()) + " IST"
    );
  } catch {
    return "";
  }
};

export const cFmtDate = (iso?: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${C_MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

export const relTime = (iso?: string | null): string => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return days + "d ago";
  if (days < 30) return Math.floor(days / 7) + "w ago";
  if (days < 365) return Math.floor(days / 30) + "mo ago";
  return Math.floor(days / 365) + "y ago";
};

// Polls for an optional CDN global. The legacy page had all flair scripts
// loaded synchronously before React ran; with next/script they arrive after
// hydration, so components wait briefly, then fall back gracefully.
export const whenReady = (check: () => boolean, timeoutMs = 3500): Promise<boolean> =>
  new Promise((resolve) => {
    if (check()) {
      resolve(true);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => {
      if (check()) {
        clearInterval(id);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(id);
        resolve(false);
      }
    }, 120);
  });

// ---------- Theme accent persistence (port of window.dhTheme in Palette.jsx) ----------

export const DH_ACCENTS: Record<string, string> = {
  green: "#30E060",
  blue: "#4A7BF7",
  gold: "#C9A84C",
  cyan: "#22D3EE",
  magenta: "#E45FB0",
};

export function dhThemeSet(name: string): string | null {
  if (name === "reset") {
    document.documentElement.style.removeProperty("--color-accent-primary");
    try {
      localStorage.removeItem("dh-accent");
    } catch {
      /* storage unavailable */
    }
    return "accent reset to matrix green.";
  }
  const c = DH_ACCENTS[name];
  if (!c) return null;
  document.documentElement.style.setProperty("--color-accent-primary", c);
  try {
    localStorage.setItem("dh-accent", name);
  } catch {
    /* storage unavailable */
  }
  return "accent → " + name + ".";
}

export function dhThemeApply(): void {
  try {
    const n = localStorage.getItem("dh-accent");
    if (n && DH_ACCENTS[n]) document.documentElement.style.setProperty("--color-accent-primary", DH_ACCENTS[n]);
  } catch {
    /* storage unavailable */
  }
}
