"use client";
// components/client/r6/LoadingAnimation.tsx : deependhq hero opening.
// Agent port of the 21st.dev loading-animation component. The scroll-driven
// sequence is kept whole: the pixel figure disperses as you scroll, the
// statement assembles in design-tool selection frames, the CTA pulls the
// pixels back, the figure turns once, then onComplete navigates.
// Identity remap: pale tint field -> transparent over the nebula sky, lamp
// figure, think frames, paper head line. The built-in frames were sampled
// from a third-party video of a real person, so this port ships ORIGINAL
// procedural frames from scripts/generate-loading-figure.mjs instead.
// One dependency (react). Styles are scoped under .la and injected once.

import * as React from "react";
import { ORIGINAL_FRAMES } from "./loading-figure";

// <engine>
export type ChipRow = Array<[text: string, kind?: string]>;

export interface LoadingAnimationOptions {
  /** Name shown on the selection frame in the cursor layer. */
  name?: string;
  /** Role shown in the properties panel. */
  role?: string;
  /** Headline, one array per row. Each piece is [text, kind?]; kind "frame" wraps the text in a selection frame with handles. Spaces inside pieces are kept. */
  rows?: ChipRow[];
  /** Label on the call-to-action button. */
  cta?: string;
  /** Label above the progress bar while the figure turns. */
  loadingLabel?: string;
  /** Label shown when loading finishes (before `onComplete` takes the page elsewhere). */
  readyLabel?: string;
  replayLabel?: string;
  /** How much scrolling it takes to disperse the figure. Any CSS length. */
  scrollHeight?: string;
  /** Figure height as a fraction of the stage (0.2 to 1). Smaller means smaller pixels. */
  size?: number;
  /** How far the pixels travel when they disperse (0.2 to 2). */
  spread?: number;
  /** Show the design-tool layer under the cursor. */
  showReveal?: boolean;
  /** Play the whole sequence by itself, in a loop, with no scrolling. Use it for previews and embeds. */
  autoplay?: boolean;
  colors?: Partial<{ accent: string; blue: string; ink: string; tint: string; head: string }>;
  /** Base64-packed 66x53 1-bit frames of a full turn. Defaults to the generated figure. */
  frames?: string[];
  onGetStarted?: () => void;
  onComplete?: () => void;
}

const GW = 66;
const GH = 53;
const CELL_ASPECT = 14.65 / 10.8; // the source cells are slightly taller than wide
const FADE_ROWS = 9; // the bust is cut off at the bottom, so its last rows dissolve in a dither instead of a hard edge
/** Drops keys whose value is undefined, so a missing prop never overrides a default. */
const defined = <T extends object>(x: T): T => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined)) as T;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const hsh = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 1000 / 1000;
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" } as Record<string, string>)[c]);
const rgba = (hex: string, a: number) => {
  const h = hex.replace("#", ""), v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
};

const DEFAULT_ROWS: ChipRow[] = [
  [["Past the "], ["hype", "frame"], [" cycle."]],
  [["Into the "], ["infrastructure.", "frame"]],
];

const CSS = `
.la{--la-accent:#F4A62A;--la-blue:#4A7BF7;--la-ink:#0E1A33;--la-tint:transparent;--la-head:#F4EBD9;--la-track:320vh;position:relative;display:block;width:100%;background:var(--la-tint);color:var(--la-head);font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-font-smoothing:antialiased;font-variant-ligatures:none}
.la *,.la *::before,.la *::after{box-sizing:border-box}
.la-track{position:relative;height:var(--la-track)}
.la-stage{position:sticky;top:0;height:100vh;height:100svh;overflow:hidden}
.la-grid{position:absolute;inset:0;opacity:0;pointer-events:none;background-image:linear-gradient(to right,var(--la-g2) 1px,transparent 1px),linear-gradient(to bottom,var(--la-g2) 1px,transparent 1px),linear-gradient(to right,var(--la-g1) 1px,transparent 1px),linear-gradient(to bottom,var(--la-g1) 1px,transparent 1px);background-size:120px 120px,120px 120px,24px 24px,24px 24px}
.la-fig,.la-ui{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}
.la-top{position:absolute;left:0;right:0;top:0;display:flex;justify-content:flex-end;align-items:center;padding:22px 32px;z-index:5}
.la-auto,.la-auto .la-track,.la-auto .la-stage{height:100%;min-height:100vh;min-height:100svh}
.la-auto .la-stage{position:relative}
.la-auto .la-top,.la-auto .la-cue,.la-auto .la-replay{display:none !important}
.la-skip,.la-replay{background:none;border:0;padding:0 4px;min-height:44px;display:inline-flex;align-items:center;font:700 12px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:.8px;color:rgba(244,235,217,.65);cursor:pointer}
.la-skip:hover,.la-replay:hover{color:var(--la-head)}
.la-msg{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:36px;padding:0 clamp(20px,6vw,96px);padding:0 clamp(20px,6cqw,96px);pointer-events:none;container-type:inline-size}
.la-h{margin:0;display:flex;flex-direction:column;align-items:flex-start;gap:1em;font:700 clamp(13px,calc((100vw - 2 * clamp(20px,6vw,96px)) / 14),84px)/1.05 "JetBrains Mono",monospace;font-size:clamp(13px,calc((100cqw - 2 * clamp(20px,6cqw,96px)) / 14),84px);letter-spacing:-.045em;color:var(--la-head)}
.la-row{display:block;white-space:nowrap}
.la-t{display:inline-block;white-space:pre;opacity:0}
.la-fr{position:relative;color:var(--la-blue);padding:.02em .16em .08em;margin:0 .12em;border:2px solid var(--la-blue);background:var(--la-bluet)}
.la-fr i{position:absolute;width:.17em;height:.17em;min-width:7px;min-height:7px;box-sizing:border-box;background:#fff;border:2px solid var(--la-blue);transform:translate(-50%,-50%)}
.la-cta{pointer-events:none;opacity:0;display:inline-flex;align-items:center;border:2px solid var(--la-ink);background:var(--la-accent);color:var(--la-ink);padding:14px 28px;font:700 17px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:1.2px;cursor:pointer;transition:transform .08s,filter .08s}
.la-cta:hover{filter:brightness(1.08)}
.la-cta:active{transform:translateY(1px);filter:brightness(.94)}
.la-cta:focus-visible,.la-skip:focus-visible,.la-replay:focus-visible{outline:3px solid var(--la-head);outline-offset:3px}
.la-cue{position:absolute;left:32px;bottom:26px;z-index:3;font:700 12px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:1.4px;color:var(--la-head)}
.la-cue span{display:block;width:3px;height:30px;background:var(--la-head);margin:10px 0 0 6px;animation:la-cue 1.4s steps(5) infinite}
@keyframes la-cue{0%{transform:scaleY(.2);transform-origin:top}60%{transform:scaleY(1);transform-origin:top}61%{transform-origin:bottom}100%{transform:scaleY(.1);transform-origin:bottom}}
.la-load{position:absolute;left:0;right:0;top:24px;z-index:6;text-align:center;display:none;color:var(--la-head)}
.la-load.on{display:block}
.la-load b{display:block;font:700 13px "JetBrains Mono",monospace;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px;color:var(--la-head)}
.la-bar{display:flex;gap:5px;justify-content:center}
.la-bar i{width:18px;height:14px;background:var(--la-accent);opacity:.18}
.la-bar i.on{opacity:1}
.la-replay{display:none;margin-top:14px}
.la-load.done .la-replay{display:inline-block}
@media (max-width:640px){.la-top{padding:16px}.la-cue{left:16px}}
@media (prefers-reduced-motion:reduce){.la-cue span{animation:none}.la-cta{transition:none}}
`;

function ensureAssets() {
  if (typeof document === "undefined") return;
  if (!document.getElementById("la-styles")) {
    const s = document.createElement("style"); s.id = "la-styles"; s.textContent = CSS; document.head.appendChild(s);
  }
}

const HANDLES: Array<[number, number]> = [[0, 0], [50, 0], [100, 0], [0, 50], [100, 50], [0, 100], [50, 100], [100, 100]];
const headRow = (items: ChipRow) =>
  `<span class="la-row" aria-hidden="true">${items.map(([t, k]) => k === "frame"
    ? `<span class="la-t la-fr">${esc(t)}${HANDLES.map(([x, y]) => `<i style="left:${x}%;top:${y}%"></i>`).join("")}</span>`
    : `<span class="la-t">${esc(t)}</span>`).join("")}</span>`;

type Phase = "scroll" | "assemble" | "load" | "done";

export function mountLoadingAnimation(root: HTMLElement, opts: LoadingAnimationOptions = {}): { destroy: () => void; replay: () => void } {
  ensureAssets();
  opts = defined(opts);
  const col = { accent: "#F4A62A", blue: "#4A7BF7", ink: "#0E1A33", tint: "transparent", head: "#F4EBD9", ...defined(opts.colors || {}) };
  const rows = opts.rows && opts.rows.length ? opts.rows : DEFAULT_ROWS;
  const o = { name: "Sreedeep", role: "group cmo", cta: "work with me", loadingLabel: "opening the window", readyLabel: "window open", replayLabel: "replay", scrollHeight: "320vh", size: 0.5, spread: 1, showReveal: true, autoplay: false, ...opts };
  const size = clamp(o.size, 0.2, 1), spread = clamp(o.spread, 0.2, 2);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  root.classList.add("la");
  if (o.autoplay) root.classList.add("la-auto");
  root.style.setProperty("--la-accent", col.accent); root.style.setProperty("--la-blue", col.blue);
  root.style.setProperty("--la-ink", col.ink); root.style.setProperty("--la-tint", col.tint); root.style.setProperty("--la-head", col.head); root.style.setProperty("--la-bluet", rgba(col.blue, 0.08)); root.style.setProperty("--la-g1", rgba(col.accent, 0.09)); root.style.setProperty("--la-g2", rgba(col.accent, 0.2));
  root.style.setProperty("--la-track", o.scrollHeight);
  root.innerHTML = `<div class="la-track"><div class="la-stage">
      <div class="la-grid" aria-hidden="true"></div>
      <canvas class="la-fig" aria-hidden="true"></canvas><canvas class="la-ui" aria-hidden="true"></canvas>
      <div class="la-top"><button class="la-skip" type="button">Skip ↓</button></div>
      <div class="la-cue">Scroll<span></span></div>
      <div class="la-msg"><h1 class="la-h" aria-label="${esc(rows.map((r) => r.map((c) => c[0]).join("")).join(" ").replace(/\s+/g, " ").trim())}">${rows.map(headRow).join("")}</h1>
        <button class="la-cta" type="button" tabindex="-1">${esc(o.cta)}</button></div>
      <div class="la-load" role="status"><b>${esc(o.loadingLabel)}</b><div class="la-bar">${"<i></i>".repeat(16)}</div><button class="la-replay" type="button">${esc(o.replayLabel)}</button></div>
    </div></div>`;

  const q = <T extends Element>(s: string) => root.querySelector(s) as T;
  const track = q<HTMLElement>(".la-track"), stage = q<HTMLElement>(".la-stage");
  const fig = q<HTMLCanvasElement>(".la-fig"), ui = q<HTMLCanvasElement>(".la-ui");
  const grid = q<HTMLElement>(".la-grid");
  const chips = [...root.querySelectorAll<HTMLElement>(".la-t")];
  const cta = q<HTMLButtonElement>(".la-cta"), cue = q<HTMLElement>(".la-cue"), load = q<HTMLElement>(".la-load");
  const loadLabel = q<HTMLElement>(".la-load b"), barBlocks = [...root.querySelectorAll<HTMLElement>(".la-bar i")];

  /* decode the packed frames (1 bit per cell), and find the box the figure ever occupies */
  const packed = opts.frames && opts.frames.length ? opts.frames : ORIGINAL_FRAMES;
  const box = { x0: GW, y0: GH, x1: 0, y1: 0 };
  const frames: Uint8Array[] = packed.map((b64) => {
    const bin = atob(b64), bits = new Uint8Array(GW * GH);
    for (let i = 0; i < bits.length; i++) {
      const on = (bin.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1; bits[i] = on;
      if (on) { const x = i % GW, y = (i / GW) | 0; if (x < box.x0) box.x0 = x; if (x > box.x1) box.x1 = x; if (y < box.y0) box.y0 = y; if (y > box.y1) box.y1 = y; }
    }
    return bits;
  });
  const n = frames.length;
  const colsC = box.x1 - box.x0 + 1, rowsC = box.y1 - box.y0 + 1;

  const st = { phase: "scroll" as Phase, p: 0, target: 0, loadStart: 0, f0: 0, raf: 0, alive: true, d: 1, frame: 0, autoStart: 0, doneAt: 0, last: 0 };
  const ptr = { mx: -999, my: -999, x: -999, y: -999, r: 0, tr: 0 };
  let uiCache: HTMLCanvasElement | null = null, uiScratch: HTMLCanvasElement | null = null;
  let lay = { W: 0, H: 0, cw: 0, ch: 0, ox: 0, oy: 0, fx0: 0, fx1: 0, fy0: 0, fy1: 0 };

  /* the figure sits at the centre of the stage; `size` is its height as a share of the stage */
  const geo = (W: number, H: number) => {
    let ch = (size * H) / rowsC, cw = ch / CELL_ASPECT;
    if (colsC * cw > W * 0.7) { cw = (W * 0.7) / colsC; ch = cw * CELL_ASPECT; }
    return { cw, ch, ox: W / 2 - ((box.x0 + box.x1 + 1) / 2) * cw, oy: H / 2 - ((box.y0 + box.y1 + 1) / 2) * ch };
  };

  /* Figma-style rulers along the top and left edge */
  function rulers(x: CanvasRenderingContext2D, W: number, H: number) {
    const G = (a: number) => rgba(col.ink, a);
    const line = (x1: number, y1: number, x2: number, y2: number, stroke: string) => { x.strokeStyle = stroke; x.lineWidth = 1; x.beginPath(); x.moveTo(x1 + 0.5, y1 + 0.5); x.lineTo(x2 + 0.5, y2 + 0.5); x.stroke(); };
    const R = 18;
    x.fillStyle = "rgba(255,255,255,.82)"; x.fillRect(0, 0, W, R); x.fillRect(0, 0, R, H);
    line(0, R, W, R, G(0.35)); line(R, 0, R, H, G(0.35));
    x.fillStyle = G(0.7); x.font = '700 8px "JetBrains Mono", monospace'; x.textBaseline = "top";
    for (let t = 0; t <= W; t += 10) { const len = t % 100 === 0 ? 12 : t % 50 === 0 ? 8 : 4; line(t, R - len, t, R, G(0.5)); if (t % 100 === 0 && t) x.fillText(String(t), t + 3, 2); }
    for (let t = 0; t <= H; t += 10) { const len = t % 100 === 0 ? 12 : t % 50 === 0 ? 8 : 4; line(R - len, t, R, t, G(0.5)); if (t % 100 === 0 && t) { x.save(); x.translate(2, t + 3); x.rotate(-Math.PI / 2); x.fillText(String(t), -x.measureText(String(t)).width, 0); x.restore(); } }
  }

  function buildUiCache() {
    const W = stage.clientWidth, H = stage.clientHeight, d = st.d, c = document.createElement("canvas");
    c.width = Math.round(W * d); c.height = Math.round(H * d);
    const x = c.getContext("2d")!; x.scale(d, d); x.lineWidth = 1;
    const O = (a: number) => rgba(col.accent, a), B = (a: number) => rgba(col.blue, a);
    const line = (x1: number, y1: number, x2: number, y2: number, stroke: string) => { x.strokeStyle = stroke; x.beginPath(); x.moveTo(x1 + 0.5, y1 + 0.5); x.lineTo(x2 + 0.5, y2 + 0.5); x.stroke(); };
    for (let gx = 0; gx <= W; gx += 24) line(gx, 0, gx, H, gx % 120 === 0 ? O(0.2) : O(0.09));
    for (let gy = 0; gy <= H; gy += 24) line(0, gy, W, gy, gy % 120 === 0 ? O(0.2) : O(0.09));
    rulers(x, W, H);
    const g = geo(W, H), pad = 10;
    const fx0 = g.ox + box.x0 * g.cw - pad, fx1 = g.ox + (box.x1 + 1) * g.cw + pad, fy0 = g.oy + box.y0 * g.ch - pad, fy1 = g.oy + (box.y1 + 1) * g.ch + pad;
    lay = { W, H, ...g, fx0, fx1, fy0, fy1 };
    line(fx0, 0, fx0, H, B(0.3)); line(fx1, 0, fx1, H, B(0.3)); line(0, fy0, W, fy0, B(0.3)); line(0, fy1, W, fy1, B(0.3)); line(W / 2, 0, W / 2, H, O(0.35));
    x.strokeStyle = B(0.9); x.strokeRect(fx0 + 0.5, fy0 + 0.5, fx1 - fx0, fy1 - fy0);
    const hs = 6;
    ([[fx0, fy0], [(fx0 + fx1) / 2, fy0], [fx1, fy0], [fx0, (fy0 + fy1) / 2], [fx1, (fy0 + fy1) / 2], [fx0, fy1], [(fx0 + fx1) / 2, fy1], [fx1, fy1]] as Array<[number, number]>).forEach(([hx, hy]) => {
      x.fillStyle = "#fff"; x.strokeStyle = B(1); x.fillRect(hx - hs / 2 + 0.5, hy - hs / 2 + 0.5, hs, hs); x.strokeRect(hx - hs / 2 + 0.5, hy - hs / 2 + 0.5, hs, hs);
    });
    const pill = (txt: string, px: number, py: number, bg: string, fg: string) => {
      x.font = '700 9px "JetBrains Mono", monospace'; const w = x.measureText(txt).width + 12;
      x.fillStyle = bg; x.fillRect(px, py, w, 15); x.fillStyle = fg; x.textBaseline = "middle"; x.fillText(txt, px + 6, py + 8); x.textBaseline = "top"; return w;
    };
    pill(o.name, fx0, fy0 - 20, B(1), "#fff");                                   // the frame is named after the person
    pill(`${Math.round(fx1 - fx0)} × ${Math.round(fy1 - fy0)}`, (fx0 + fx1) / 2 - 30, fy1 + 7, B(1), "#fff");
    uiCache = c; uiScratch = document.createElement("canvas"); uiScratch.width = c.width; uiScratch.height = c.height;
  }

  function fit() {
    const d = window.devicePixelRatio || 1; st.d = d;
    fig.width = ui.width = Math.round(stage.clientWidth * d); fig.height = ui.height = Math.round(stage.clientHeight * d);
    buildUiCache();
  }

  function drawFigure(frame: number) {
    const ctx = fig.getContext("2d")!, W = fig.width, H = fig.height;
    ctx.clearRect(0, 0, W, H);
    const { cw, ch, ox, oy } = geo(W, H);
    const k = frame % n, a = frames[k], b = frames[(k + 1) % n], mix = k >= n - 4 ? (k - (n - 4) + 1) / 4 : 0; // dissolve the last frames into the first so the turn loops cleanly
    const p = st.p, mn = Math.min(W, H);
    ctx.fillStyle = col.accent;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i = y * GW + x;
      if (!(mix && hsh(x, y) < mix ? b[i] : a[i])) continue;
      if (y > box.y1 - FADE_ROWS && hsh(x * 7 + 3, y * 11 + 5) > (box.y1 - y + 1) / (FADE_ROWS + 1)) continue; // dithered fade at the cut-off edge
      let lp = 0;
      if (p > 0) { lp = clamp(p * 1.5 - hsh(x * 3 + 1, y * 5 + 2) * 0.5); lp = lp * lp * (3 - 2 * lp); }
      if (lp >= 0.995) continue;
      if (lp === 0) {
        const x0 = Math.round(ox + x * cw), y0 = Math.round(oy + y * ch);
        ctx.globalAlpha = 1; ctx.fillRect(x0, y0, Math.round(ox + (x + 1) * cw) - x0, Math.round(oy + (y + 1) * ch) - y0);
        continue;
      }
      const ang = hsh(x, y) * 6.2832, dist = lp * (0.04 + hsh(y + 7, x + 3) * 0.46) * mn * spread, sz = 1 - lp * 0.6;
      ctx.globalAlpha = 1 - lp * 0.92;
      ctx.fillRect(ox + x * cw + Math.cos(ang) * dist + lp * W * 0.02, oy + y * ch + Math.sin(ang) * dist - lp * lp * H * 0.1, cw * sz, ch * sz);
    }
    ctx.globalAlpha = 1;
  }

  /* everything below the cursor layer's base: panels and marks that fade in as you scroll further */
  function annotations(sx: CanvasRenderingContext2D, frame: number) {
    const { W, H, cw, ch, ox, oy, fx0, fx1, fy0, fy1 } = lay, R = 18;
    const O = (a: number) => rgba(col.accent, a), B = (a: number) => rgba(col.blue, a), G = (a: number) => rgba(col.ink, a);
    const at = (t: number) => (reduced ? 0 : smooth((st.p - t) / 0.12));
    const ln = (x1: number, y1: number, x2: number, y2: number, stroke: string) => { sx.strokeStyle = stroke; sx.lineWidth = 1; sx.beginPath(); sx.moveTo(x1 + 0.5, y1 + 0.5); sx.lineTo(x2 + 0.5, y2 + 0.5); sx.stroke(); };
    const pill = (txt: string, px: number, py: number, bg: string, fg: string) => {
      sx.font = '700 9px "JetBrains Mono", monospace'; const w = sx.measureText(txt).width + 12;
      sx.fillStyle = bg; sx.fillRect(px, py, w, 15); sx.fillStyle = fg; sx.textBaseline = "middle"; sx.fillText(txt, px + 6, py + 8); return w;
    };
    const panel = (px: number, py: number, w: number, title: string, items: Array<[string, string]>) => {
      px = Math.max(R + 6, Math.min(W - w - 6, px));
      const h = 20 + items.length * 15 + 6;
      sx.fillStyle = "rgba(255,255,255,.93)"; sx.fillRect(px, py, w, h); sx.strokeStyle = G(0.7); sx.lineWidth = 1; sx.strokeRect(px + 0.5, py + 0.5, w, h);
      sx.textBaseline = "middle"; sx.fillStyle = G(1); sx.font = '700 8px "JetBrains Mono", monospace'; sx.fillText(title.toUpperCase(), px + 8, py + 10);
      ln(px, py + 19, px + w, py + 19, G(0.25));
      items.forEach(([k, v], i) => {
        const yy = py + 20 + i * 15 + 8; sx.font = '400 9px "JetBrains Mono", monospace'; sx.fillStyle = G(0.55); sx.fillText(k, px + 8, yy);
        sx.font = '700 9px "JetBrains Mono", monospace'; sx.fillStyle = G(1); sx.textAlign = "right"; sx.fillText(v, px + w - 8, yy); sx.textAlign = "left";
      });
    };
    const when = (t: number, fn: () => void) => { const k = at(t); if (k <= 0.01) return; sx.save(); sx.globalAlpha = k; fn(); sx.restore(); };
    const k = frame % n, rot = Math.round((k / n) * 360);
    /* 0.10  layers */
    when(0.1, () => panel(fx1 + 14, fy0, 138, "Layers", [["◉ Figure", ""], ["◉ Pixels", String(GW * GH)], ["◉ Background", ""]]));
    /* 0.25  properties, with a live rotation readout */
    when(0.25, () => panel(fx0 - 14 - 142, fy0, 142, "Properties", [["Role", o.role.length > 14 ? o.role.slice(0, 13) + "…" : o.role], ["X", `${Math.round(fx0)}`], ["Y", `${Math.round(fy0)}`], ["W × H", `${Math.round(fx1 - fx0)}×${Math.round(fy1 - fy0)}`], ["Rotate", `${rot}°`], ["Pixel", `${cw.toFixed(1)}×${ch.toFixed(1)}`], ["Frame", `${k + 1}/${n}`], ["Colour", "1-bit"]]));
    /* 0.40  measurements */
    when(0.4, () => {
      const my = (fy0 + fy1) / 2, mx = (fx0 + fx1) / 2;
      ln(R, my, fx0, my, O(0.9)); ln(R, my - 4, R, my + 4, O(0.9)); ln(fx0, my - 4, fx0, my + 4, O(0.9)); pill(String(Math.round(fx0 - R)), (R + fx0) / 2 - 12, my - 20, O(1), col.ink);
      ln(mx, R, mx, fy0, O(0.9)); ln(mx - 4, R, mx + 4, R, O(0.9)); ln(mx - 4, fy0, mx + 4, fy0, O(0.9)); pill(String(Math.round(fy0 - R)), mx + 8, (R + fy0) / 2 - 8, O(1), col.ink);
    });
    /* 0.55  pen path with anchors and handles, around the head */
    when(0.55, () => {
      const Wc = colsC * cw, Hc = rowsC * ch, hx = ox + ((box.x0 + box.x1 + 1) / 2) * cw, hy = oy + box.y0 * ch;
      const pts: Array<[number, number]> = [[hx - 0.22 * Wc, hy + 0.3 * Hc], [hx - 0.13 * Wc, hy + 0.04 * Hc], [hx + 0.13 * Wc, hy + 0.04 * Hc], [hx + 0.22 * Wc, hy + 0.3 * Hc]];
      const hd = 0.07 * Wc, hv = 0.1 * Hc;
      sx.strokeStyle = B(0.9); sx.lineWidth = 1; sx.beginPath(); sx.moveTo(pts[0][0] + 0.5, pts[0][1] + 0.5);
      sx.bezierCurveTo(pts[1][0] - hd, pts[1][1] - hv, pts[2][0] + hd, pts[2][1] - hv, pts[3][0] + 0.5, pts[3][1] + 0.5); sx.stroke();
      pts.forEach(([px, py], i) => {
        const dx = i % 2 ? hd : -hd; ln(px, py, px + dx, py - hv, B(0.5));
        sx.fillStyle = "#fff"; sx.strokeStyle = B(0.7); sx.beginPath(); sx.arc(px + dx + 0.5, py - hv + 0.5, 2.5, 0, 6.283); sx.fill(); sx.stroke();
        sx.strokeStyle = B(1); sx.fillRect(px - 2.5, py - 2.5, 6, 6); sx.strokeRect(px - 2.5, py - 2.5, 6, 6);
      });
    });
    /* 0.70  tags */
    when(0.7, () => {
      pill("Layer 1 · 66 × 53", fx1 + 14, fy1 - 80, "#fff", G(1)); pill("Pixel mask", fx1 + 14, fy1 - 58, "#fff", G(1)); pill("Opacity 100%", fx0 - 96, fy1 - 80, "#fff", G(1));
      pill(`Fill  ${col.accent.replace("#", "").toUpperCase()}`, fx0 - 108, fy1 - 58, "#fff", G(1)); sx.fillStyle = col.accent; sx.fillRect(fx0 - 106, fy1 - 55, 9, 9);
    });
    /* 0.85  swatches + export */
    when(0.85, () => {
      const sy = fy1 + 28 < H - 24 ? fy1 + 28 : fy0 - 44;
      sx.fillStyle = col.accent; sx.fillRect(fx0, sy, 14, 14); sx.strokeStyle = G(0.8); sx.strokeRect(fx0 + 0.5, sy + 0.5, 14, 14);
      sx.fillStyle = "#fff"; sx.fillRect(fx0 + 20, sy, 14, 14); sx.strokeRect(fx0 + 20.5, sy + 0.5, 14, 14); ln(fx0 + 20, sy + 14, fx0 + 34, sy, G(0.8));
      pill("on #" + col.accent.replace("#", "").toUpperCase() + "  off none", fx0 + 42, sy - 1, "#fff", G(1)); pill("Export 1x", fx1 - 56, sy - 1, B(1), "#fff");
    });
  }

  /* the headline page: rulers, guides, name / size / position tags and spacing marks around the framed words */
  function drawHeadlineGuides(ctx: CanvasRenderingContext2D, hv: number) {
    const d = st.d, W = stage.clientWidth, H = stage.clientHeight, R = 18;
    ctx.setTransform(d, 0, 0, d, 0, 0); ctx.globalAlpha = hv; ctx.lineWidth = 1;
    const O = (a: number) => rgba(col.accent, a), B = (a: number) => rgba(col.blue, a);
    const ln = (x1: number, y1: number, x2: number, y2: number, stroke: string) => { ctx.strokeStyle = stroke; ctx.beginPath(); ctx.moveTo(x1 + 0.5, y1 + 0.5); ctx.lineTo(x2 + 0.5, y2 + 0.5); ctx.stroke(); };
    const pill = (txt: string, px: number, py: number, bg: string, fg: string) => {
      ctx.font = '700 9px "JetBrains Mono", monospace'; const w = ctx.measureText(txt).width + 12;
      ctx.fillStyle = bg; ctx.fillRect(px, py, w, 15); ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(txt, px + 6, py + 8); return w;
    };
    const small = W < 640;
    const fr = [...root.querySelectorAll<HTMLElement>(".la-fr")].map((e) => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }));
    rulers(ctx, W, H); // the same ruler bars as the cursor layer
    ctx.textBaseline = "top";
    fr.forEach((f, i) => {
      const x0 = f.x, x1 = f.x + f.w, y0 = f.y, y1 = f.y + f.h;
      ln(x0, R, x0, H, B(0.28)); ln(x1, R, x1, H, B(0.28)); ln(R, y0, W, y0, B(0.28)); ln(R, y1, W, y1, B(0.28));
      ctx.fillStyle = B(0.3); ctx.fillRect(x0 + 1, 0, f.w, R - 1); ctx.fillRect(0, y0 + 1, R - 1, f.h); // selection range lit up on both rulers
      ctx.fillStyle = B(1); ctx.font = '700 8px "JetBrains Mono", monospace'; ctx.textBaseline = "top"; ctx.fillText(String(Math.round(x0)), x0 + 3, 2);
      if (small) return;
      pill(`Text ${i + 1}`, x0, y0 - 21, B(1), "#fff");
      const pos = `x ${Math.round(x0)}  y ${Math.round(y0)}`;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      pill(pos, x1 - ctx.measureText(pos).width - 12, y0 - 21, col.ink, "#fff");
      pill(`${Math.round(f.w)} × ${Math.round(f.h)}`, (x0 + x1) / 2 - 30, y1 + 7, B(1), "#fff");
    });
    /* spacing marks in the accent colour, like measurements in a design tool */
    const h1 = q<HTMLElement>(".la-h");
    const gap = Math.round(cta.offsetTop - (h1.offsetTop + h1.offsetHeight)), cx = cta.offsetLeft + 16;
    if (gap > 6) {
      const ya = h1.offsetTop + h1.offsetHeight, yb = cta.offsetTop;
      ln(cx, ya, cx, yb, O(0.95)); ln(cx - 4, ya, cx + 4, ya, O(0.95)); ln(cx - 4, yb, cx + 4, yb, O(0.95));
      if (!small) pill(String(gap), cx + 8, (ya + yb) / 2 - 8, O(1), col.ink);
    }
    const lx = h1.offsetLeft, ym = h1.offsetTop - 18;
    if (!small && lx - R > 26) { ln(R, ym, lx, ym, O(0.95)); ln(R, ym - 4, R, ym + 4, O(0.95)); ln(lx, ym - 4, lx, ym + 4, O(0.95)); pill(String(Math.round(lx - R)), (R + lx) / 2 - 10, ym - 20, O(1), col.ink); }
    if (!small) { ctx.fillStyle = rgba(col.ink, 0.55); ctx.font = '700 9px "JetBrains Mono", monospace'; ctx.textBaseline = "top"; ctx.fillText(`Landing  ${Math.round(W)} × ${Math.round(H)}`, R + 8, R + 8); }
    ctx.globalAlpha = 1;
  }

  function drawReveal(frame: number) {
    const ctx = ui.getContext("2d")!, d = st.d;
    ptr.x += (ptr.mx - ptr.x) * 0.35; ptr.y += (ptr.my - ptr.y) * 0.35; ptr.r += (ptr.tr - ptr.r) * 0.16;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, ui.width, ui.height);
    const hv = reduced ? 1 : smooth((st.p - 0.4) / 0.15), vis = 1 - hv; // the cursor layer steps aside while the headline is up, and returns with the pixels
    if (o.showReveal && hv > 0.01) drawHeadlineGuides(ctx, hv);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!o.showReveal || !uiCache || !uiScratch || ptr.r < 2 || vis < 0.01) return;
    const sx = uiScratch.getContext("2d")!, W = ui.width, H = ui.height;
    sx.setTransform(1, 0, 0, 1, 0, 0); sx.globalCompositeOperation = "source-over"; sx.clearRect(0, 0, W, H); sx.drawImage(uiCache, 0, 0);
    sx.setTransform(d, 0, 0, d, 0, 0); // from here on, CSS pixels
    annotations(sx, frame);
    const x = ptr.x, y = ptr.y, r = ptr.r * (1 + st.p * 0.9); // the circle widens as you scroll, so more of the layer shows
    sx.strokeStyle = rgba(col.blue, 0.7); sx.lineWidth = 1;
    sx.beginPath(); sx.moveTo(x, 0); sx.lineTo(x, H / d); sx.moveTo(0, y); sx.lineTo(W / d, y); sx.stroke();
    const label = `x ${Math.round(ptr.x)}   y ${Math.round(ptr.y)}`; sx.font = '700 9px "JetBrains Mono", monospace'; sx.textBaseline = "middle";
    const lw = sx.measureText(label).width + 12; sx.fillStyle = col.ink; sx.fillRect(x + 12, y + 12, lw, 15); sx.fillStyle = "#fff"; sx.fillText(label, x + 18, y + 20);
    sx.fillStyle = col.blue; sx.fillRect(x - 3, 0, 6, 18); sx.fillRect(0, y - 3, 18, 6);
    sx.globalCompositeOperation = "destination-in"; // reveal only under the cursor
    const gr = sx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(0,0,0,.85)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = gr; sx.fillRect(0, 0, W / d, H / d);
    ctx.globalAlpha = vis; ctx.drawImage(uiScratch, 0, 0); ctx.globalAlpha = 1;
  }

  function updateDom() {
    const p = st.p, b = reduced ? 1 : smooth((p - 0.9) / 0.08);
    chips.forEach((el, i) => { const t = reduced ? 1 : smooth((p - 0.4 - i * 0.022) / 0.2); el.style.opacity = String(t); el.style.transform = `translateY(${(1 - t) * 22}px) scale(${0.82 + 0.18 * t})`; });
    grid.style.opacity = o.showReveal ? String(reduced ? 1 : smooth((p - 0.4) / 0.15)) : "0"; // the grid lives on the headline page; on the figure it only shows under the cursor
    const live = st.phase === "scroll" && b > 0.5;
    cta.style.opacity = String(st.phase === "scroll" ? b : 0); cta.style.pointerEvents = live ? "auto" : "none"; cta.tabIndex = live ? 0 : -1;
    cue.style.opacity = st.phase === "scroll" ? String(1 - smooth(p / 0.12)) : "0";
  }

  function complete() {
    document.body.style.overflow = "";
    st.phase = "done"; st.p = 0; st.target = 0;
    loadLabel.textContent = o.readyLabel; barBlocks.forEach((i) => i.classList.add("on")); load.classList.add("on", "done");
    opts.onComplete?.();
    root.dispatchEvent(new CustomEvent("loadinganimation:complete", { bubbles: true }));
  }
  function begin() {
    if (st.phase !== "scroll") return;
    opts.onGetStarted?.();
    if (reduced) { complete(); return; }
    st.phase = "assemble"; st.target = 0; if (!o.autoplay) document.body.style.overflow = "hidden";
  }
  function resetUi() {
    load.classList.remove("on", "done"); loadLabel.textContent = o.loadingLabel; barBlocks.forEach((i) => i.classList.remove("on"));
  }
  function replay() {
    st.phase = "scroll"; st.p = 0; st.target = 0; st.autoStart = 0; document.body.style.overflow = "";
    resetUi();
    if (!o.autoplay) track.scrollIntoView({ behavior: "auto", block: "start" });
  }

  function loop(ts: number) {
    st.raf = 0;
    if (!st.alive) return;
    const rect = track.getBoundingClientRect();
    const onScreen = rect.bottom > 0 && rect.top < window.innerHeight;
    if (onScreen) {
      if (o.autoplay && st.phase === "scroll") { // a timeline stands in for the scroll: hold, disperse, show the headline, press the button
        if (!st.autoStart) st.autoStart = ts;
        const e = (ts - st.autoStart) / 1000;
        st.target = reduced ? 0 : e < 1.2 ? 0 : e < 4.4 ? smooth((e - 1.2) / 3.2) : 1;
        if (e > 6.6) begin();
      } else if (st.phase === "scroll") {
        const max = Math.max(1, track.offsetHeight - stage.clientHeight);
        st.target = reduced ? 0 : clamp(-rect.top / max);
      }
      if (o.autoplay && st.phase === "done") { // hold on "ready" for a moment, then go round again
        if (!st.doneAt) st.doneAt = ts;
        if (ts - st.doneAt > 1600) { st.phase = "scroll"; st.p = 0; st.target = 0; st.autoStart = ts; st.doneAt = 0; resetUi(); }
      }
      // Delta-time easing: the sequence must feel the same at any frame rate.
      const dt = Math.min(Math.max(st.last ? (ts - st.last) / 1000 : 0.016, 0), 0.1);
      st.last = ts;
      st.p += (st.target - st.p) * (1 - Math.exp(-dt * (st.phase === "assemble" ? 5.3 : 10.5)));
      if (Math.abs(st.target - st.p) < 0.002) st.p = st.target;
      let frame = reduced ? Math.floor(n * 0.38) : Math.floor((ts / 1000) * 12) % n;
      if (st.phase === "assemble" && st.p < 0.02) { // reassembled: now turn once, as the loading animation
        st.phase = "load"; st.loadStart = ts; st.f0 = frame; st.p = 0; load.classList.add("on");
      }
      if (st.phase === "load") {
        const f = Math.floor(((ts - st.loadStart) / 1000) * 24);
        if (f >= n) complete();
        else { frame = (st.f0 + f) % n; barBlocks.forEach((i, k) => i.classList.toggle("on", k < Math.round((f / n) * 16))); }
      }
      st.frame = frame;
      drawFigure(frame); drawReveal(frame); updateDom();
    }
    st.raf = requestAnimationFrame(loop);
  }

  const onMove = (e: PointerEvent) => { const r = stage.getBoundingClientRect(); ptr.mx = e.clientX - r.left; ptr.my = e.clientY - r.top; if (ptr.r < 2) { ptr.x = ptr.mx; ptr.y = ptr.my; } ptr.tr = 240; };
  const onLeave = () => { ptr.tr = 0; };
  stage.addEventListener("pointermove", onMove); stage.addEventListener("pointerleave", onLeave);
  cta.addEventListener("click", begin);
  q<HTMLElement>(".la-skip").addEventListener("click", () => window.scrollTo({ top: track.getBoundingClientRect().top + window.scrollY + Math.max(0, track.offsetHeight - stage.clientHeight), behavior: reduced ? "auto" : "smooth" }));
  q<HTMLElement>(".la-replay").addEventListener("click", replay);
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => fit()) : null;
  ro?.observe(stage);
  fit();
  st.raf = requestAnimationFrame(loop);

  return {
    replay,
    destroy() {
      st.alive = false; cancelAnimationFrame(st.raf); ro?.disconnect();
      stage.removeEventListener("pointermove", onMove); stage.removeEventListener("pointerleave", onLeave);
      document.body.style.overflow = ""; root.innerHTML = ""; root.classList.remove("la");
    },
  };
}
// </engine>

export interface LoadingAnimationProps extends LoadingAnimationOptions {
  className?: string;
  style?: React.CSSProperties;
}

/** React wrapper. Renders a full-width block; give it a scrolling page to live in. */
export function LoadingAnimation({ className, style, onComplete, onGetStarted, ...rest }: LoadingAnimationProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const cb = React.useRef({ onComplete, onGetStarted });
  cb.current = { onComplete, onGetStarted };
  const key = JSON.stringify([rest.name, rest.role, rest.cta, rest.loadingLabel, rest.readyLabel, rest.replayLabel, rest.scrollHeight, rest.size, rest.spread, rest.showReveal, rest.autoplay, rest.rows, rest.colors, rest.frames ? rest.frames.length : 0]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = mountLoadingAnimation(el, { ...rest, onComplete: () => cb.current.onComplete?.(), onGetStarted: () => cb.current.onGetStarted?.() });
    return () => h.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div ref={ref} className={className} style={style} />;
}

export default LoadingAnimation;