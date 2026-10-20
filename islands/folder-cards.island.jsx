// islands/folder-cards.island.jsx : the Glass Folder Cards ported from the
// pasted 21st.dev prompt, one folder per company for the "Group CMO across
// twelve companies" section (plan section 8).
//
// Interaction only: the section's real reading (four pillar doors, each with
// the last day it made the log) is in the prerendered fallback inside the
// mount, so a failed bundle leaves the page complete.
//
// Port notes (contract section 2):
//   - prefixed .gfc- in home.css, tokens only. The art recipes are built from
//     the pillar accent tokens, so the twelve panels follow both schemes;
//   - action is none everywhere: there is nothing honest to add, so the add
//     key and the menu are gone from the source component;
//   - generated art is painted once per recipe, seed and size by one shared
//     queue and cached; under 768px no art is painted at all and the back
//     panel is the flat brand colour;
//   - entrance staggers 60ms per folder and honours reduced motion in CSS.
// No em dashes.

import * as React from 'react';

// Resolve a colour token through a throwaway node: custom properties can hold
// an unresolved color-mix(), a real property always comes back resolved.
export function cssColor(name) {
  if (!name || typeof document === 'undefined') return null;
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.documentElement.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return toHex(value);
}

function toHex(str) {
  const s = String(str || '');
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return pack(+m[1], +m[2], +m[3]);
  m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s);
  if (m) return pack(+m[1] * 255, +m[2] * 255, +m[3] * 255);
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  return null;
}

const pack = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** `#rgb` or `#rrggbb` to a triple. Anything unreadable comes back mid-grey. */
export function hexToRgb(hex) {
  let h = String(hex || '')
    .trim()
    .replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = /^[0-9a-f]{6}$/i.test(h) ? parseInt(h, 16) : 0x808080;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A small, fast, seedable PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable small integer for a string, so a file's art follows its name. */
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < String(s).length; i++) h = Math.imul(h ^ String(s).charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Seeded gradient noise, summed into fractal octaves with a rotation each. */
function makeFbm(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const grad = new Float32Array(512);
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    grad[i * 2] = Math.cos(a);
    grad[i * 2 + 1] = Math.sin(a);
  }
  const noise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const h00 = perm[X + perm[Y]] * 2;
    const h10 = perm[X + 1 + perm[Y]] * 2;
    const h01 = perm[X + perm[Y + 1]] * 2;
    const h11 = perm[X + 1 + perm[Y + 1]] * 2;
    const d00 = grad[h00] * xf + grad[h00 + 1] * yf;
    const d10 = grad[h10] * (xf - 1) + grad[h10 + 1] * yf;
    const d01 = grad[h01] * xf + grad[h01 + 1] * (yf - 1);
    const d11 = grad[h11] * (xf - 1) + grad[h11 + 1] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    return d00 + u * (d10 - d00) + v * (d01 - d00 + u * (d11 - d01 - d10 + d00));
  };
  return (x, y, octaves) => {
    let sum = 0;
    let amp = 0.5;
    for (let i = 0; i < octaves; i++) {
      sum += amp * noise(x, y);
      const nx = 1.6 * x + 1.2 * y + 7.1;
      y = -1.2 * x + 1.6 * y + 3.3;
      x = nx;
      amp *= 0.5;
    }
    return sum;
  };
}

/**
 * The artwork as a job that can be spread over frames: the field is warped
 * twice, normalised by its own percentiles, then shaded as a liquid surface.
 */
export function createArtJob(width, height, recipe, seed) {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const colors = recipe.colors.length >= 2 ? recipe.colors : ['#111111', '#eeeeee'];
  const stops = colors.map((c, i) => ({ t: i / (colors.length - 1), c: hexToRgb(c) }));
  const scale = recipe.scale == null ? 0.7 : recipe.scale;
  const warp = recipe.warp == null ? 3 : recipe.warp;
  const gloss = recipe.gloss == null ? 0.4 : recipe.gloss;
  const veins = recipe.veins == null ? 0 : recipe.veins;
  const streak = recipe.style === 'streak';
  const fbm = makeFbm(seed * 977 + 13);
  const r = rng(seed + 1);
  const ox = r() * 50;
  const oy = r() * 50;
  const angle = (recipe.angle || 0) + (r() - 0.5) * 0.5;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const m = Math.min(w, h);
  const gw = Math.ceil(w / 2) + 3;
  const gh = Math.ceil(h / 2) + 3;
  const G = new Float32Array(gw * gh);
  const GQ = new Float32Array(gw * gh);
  const F = new Float32Array(w * h);
  const Q = new Float32Array(w * h);
  const pixels = new Uint8ClampedArray(w * h * 4);
  let row = 0;

  const field = (gy) => {
    for (let gx = 0; gx < gw; gx++) {
      const u = ((gx - 1) * 2 - w / 2) / m;
      const v = ((gy - 1) * 2 - h / 2) / m;
      let px = (u * ca - v * sa) * scale;
      let py = (u * sa + v * ca) * scale;
      if (streak) {
        px *= 0.14;
        py *= 2.2;
      }
      px += ox;
      py += oy;
      const qx = fbm(px, py, 3);
      const qy = fbm(px + 5.2, py + 1.3, 3);
      const rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2, 3);
      const ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8, 3);
      G[gy * gw + gx] = fbm(px + warp * rx, py + warp * ry, 4);
      GQ[gy * gw + gx] = Math.sqrt(qx * qx + qy * qy);
    }
  };

  const upsample = () => {
    const cr = (a, b, c, d) => (-a + 9 * b + 9 * c - d) / 16;
    const T = new Float32Array(w * gh);
    for (let gy = 0; gy < gh; gy++) {
      const r0 = gy * gw;
      for (let x = 0; x < w; x++) {
        const c = (x >> 1) + 1;
        T[gy * w + x] = x & 1 ? cr(G[r0 + c - 1], G[r0 + c], G[r0 + c + 1], G[r0 + c + 2]) : G[r0 + c];
      }
    }
    for (let y = 0; y < h; y++) {
      const c = (y >> 1) + 1;
      for (let x = 0; x < w; x++) {
        F[y * w + x] =
          y & 1 ? cr(T[(c - 1) * w + x], T[c * w + x], T[(c + 1) * w + x], T[(c + 2) * w + x]) : T[c * w + x];
        const gx = (x >> 1) + 1;
        const q0 = GQ[c * gw + gx];
        const qx = x & 1 ? (q0 + GQ[c * gw + gx + 1]) / 2 : q0;
        const q1 =
          y & 1
            ? (x & 1
                ? (GQ[(c + 1) * gw + gx] + GQ[(c + 1) * gw + gx + 1]) / 2
                : GQ[(c + 1) * gw + gx])
            : qx;
        Q[y * w + x] = (qx + q1) / 2;
      }
    }
  };

  const colorize = () => {
    const sample = [];
    const stride = Math.max(1, Math.floor(F.length / 4096));
    for (let i = 0; i < F.length; i += stride) sample.push(F[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.02)];
    const hi = sample[Math.floor(sample.length * 0.98)];
    const k = 1 / (hi - lo || 1);
    const lx = -0.55;
    const ly = -0.65;
    const lz = 0.52;
    const slope = k * m * 0.012;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let t = (F[i] - lo) * k;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        let j = 1;
        while (j < stops.length - 1 && stops[j].t < t) j++;
        const a = stops[j - 1];
        const b = stops[j];
        let f = (t - a.t) / (b.t - a.t || 1);
        f = f < 0 ? 0 : f > 1 ? 1 : f;
        f = f * f * (3 - 2 * f);
        const gx = (F[x < w - 1 ? i + 1 : i] - F[x > 0 ? i - 1 : i]) * slope;
        const gy = (F[y < h - 1 ? i + w : i] - F[y > 0 ? i - w : i]) * slope;
        const nd = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1);
        const spec = Math.pow(nd > 0 ? nd : 0, 24) * gloss * 255;
        const silk = 1 + 0.035 * Math.sin(t * 150 + Q[i] * 24);
        const vein = veins * Math.max(0, 1 - Math.abs(Q[i] - 0.42) * 14) * 0.6;
        const lit = (0.82 + 0.28 * nd) * silk * (1 - vein);
        pixels[i * 4] = (a.c[0] + (b.c[0] - a.c[0]) * f) * lit + spec;
        pixels[i * 4 + 1] = (a.c[1] + (b.c[1] - a.c[1]) * f) * lit + spec;
        pixels[i * 4 + 2] = (a.c[2] + (b.c[2] - a.c[2]) * f) * lit + spec;
        pixels[i * 4 + 3] = 255;
      }
    }
  };

  const step = (rows) => {
    if (row >= gh) return true;
    const end = Math.min(gh, row + Math.max(1, rows));
    while (row < end) field(row++);
    if (row < gh) return false;
    upsample();
    colorize();
    return true;
  };

  return { width: w, height: h, pixels, step };
}

/** Where a file sits in the fan: -1 to 1 across the visible stack. */
export function fanSlot(index, count) {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
}

// ---------------------------------------------------------------------------
// One shared painter: every folder queues its art here and the queue spends a
// few milliseconds a frame, so twelve folders never jank the section.

const artCache = new Map();
const queue = [];
let pumping = false;

function pump() {
  if (pumping) return;
  pumping = true;
  const tick = () => {
    const until = performance.now() + 7;
    while (queue.length && performance.now() < until) {
      const head = queue[0];
      if (head.job.step(4)) {
        queue.shift();
        const c = document.createElement('canvas');
        c.width = head.job.width;
        c.height = head.job.height;
        c.getContext('2d').putImageData(new ImageData(head.job.pixels, c.width, c.height), 0, 0);
        head.done(c);
      }
    }
    if (queue.length) requestAnimationFrame(tick);
    else pumping = false;
  };
  requestAnimationFrame(tick);
}

/** Painted once per recipe, seed and size: twelve folders, twelve pictures. */
function paint(recipe, seed, w, h, priority) {
  const key = JSON.stringify([recipe, seed, w, h]);
  let p = artCache.get(key);
  if (!p) {
    p = new Promise((done) => {
      let at = queue.length;
      while (at > 1 && queue[at - 1].priority > priority) at--;
      queue.splice(at, 0, { job: createArtJob(w, h, recipe, seed), priority, done });
      pump();
    });
    artCache.set(key, p);
  }
  return p;
}

function ArtCanvas({ recipe, seed, w, h, density, priority, className }) {
  const ref = React.useRef(null);
  const [ready, setReady] = React.useState(false);
  const key = JSON.stringify(recipe);
  const pw = Math.round(w * density);
  const ph = Math.round(h * density);

  React.useEffect(() => {
    let live = true;
    setReady(false);
    paint(JSON.parse(key), seed, pw, ph, priority).then((src) => {
      const c = ref.current;
      if (!live || !c) return;
      c.width = src.width;
      c.height = src.height;
      c.getContext('2d').drawImage(src, 0, 0);
      setReady(true);
    });
    return () => {
      live = false;
    };
  }, [key, seed, pw, ph, priority]);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className={className}
      data-ready={ready || undefined}
      style={{ width: w, height: h, maxWidth: 'none' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Geometry, in the folder's own units. The stage is drawn at 340 x 272 and
// scaled to `width`, so the shapes stay fixed paths.

const W = 340;
const H = 272;
const HEADROOM = 54;
const FRONT_TOP = 74;
const FRONT_H = H - FRONT_TOP;
const SHEET_W = 272;
const SHEET_H = 184;
const MAX_VISIBLE = 4;

const BACK_PATH =
  'M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z';
const FRONT_PATH =
  'M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 ' +
  (FRONT_H - 22) +
  'A22 22 0 0 1 318 ' +
  FRONT_H +
  'L22 ' +
  FRONT_H +
  'A22 22 0 0 1 0 ' +
  (FRONT_H - 22) +
  'Z';

function GlassFolder({ label, meta, metaState, art, brand, seed, files = [], width = 340, appear = true, appearDelay = 0 }) {
  const rootRef = React.useRef(null);
  const filesRef = React.useRef(null);
  const hitRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [entered, setEntered] = React.useState(!appear);

  const k = width / W;
  const density =
    Math.min(1.5, Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1)) * k;

  // ---- entrance: assemble the first time the folder is on screen ----------
  React.useEffect(() => {
    if (!appear) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setEntered(true);
      return;
    }
    let t = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        t = window.setTimeout(() => setEntered(true), appearDelay);
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(t);
    };
  }, [appear, appearDelay]);

  // ---- pointer: light and parallax follow the cursor, no re-renders ------
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const write = () => {
      raf = 0;
      el.style.setProperty('--gfc-px', px.toFixed(3));
      el.style.setProperty('--gfc-py', py.toFixed(3));
    };
    const move = (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      px = ((e.clientX - r.left) / r.width) * 2 - 1;
      py = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (!raf) raf = requestAnimationFrame(write);
    };
    const leave = () => {
      px = 0;
      py = 0;
      if (!raf) raf = requestAnimationFrame(write);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ---- closed files are out of the tab order -----------------------------
  React.useEffect(() => {
    if (filesRef.current) filesRef.current.toggleAttribute('inert', !open);
  }, [open]);

  // ---- Escape and a press outside close an open folder -------------------
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      if (hitRef.current) hitRef.current.focus();
    };
    const onDown = (e) => {
      const t = e.target;
      if (rootRef.current && !rootRef.current.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const visible = files.slice(Math.max(0, files.length - MAX_VISIBLE));
  const start = Math.max(0, files.length - MAX_VISIBLE);
  const count = files.length;

  return (
    <div
      ref={rootRef}
      className="gfc-root"
      data-open={open || undefined}
      data-entered={entered || undefined}
      data-place="bottom-left"
      style={{
        width,
        height: (H + HEADROOM) * k,
        '--gfc-brand': brand ? `var(${brand})` : null,
      }}
    >
      <div className="gfc-stage" style={{ transform: `translateY(${HEADROOM * k}px) scale(${k})` }}>
        <div className="gfc-tilt">
          <div className="gfc-shadow" aria-hidden="true" />

          {/* back panel: the flat brand colour, with generated art over it */}
          <div className="gfc-back" style={{ clipPath: `path('${BACK_PATH}')` }} aria-hidden="true">
            {art ? (
              <ArtCanvas
                className="gfc-art"
                recipe={art}
                seed={seed}
                w={W + 24}
                h={H + 24}
                density={density}
                priority={0}
              />
            ) : null}
          </div>
          <svg className="gfc-rim gfc-back-rim" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <path d={BACK_PATH} />
          </svg>

          {/* the frosted front panel, hinged on its bottom edge */}
          <div className="gfc-front" style={{ clipPath: `path('${FRONT_PATH}')` }}>
            <div className="gfc-tint" aria-hidden="true" />
            <svg className="gfc-rim gfc-front-rim" viewBox={`0 0 ${W} ${FRONT_H}`} aria-hidden="true">
              <path d={FRONT_PATH} />
            </svg>
            <button
              ref={hitRef}
              type="button"
              className="gfc-hit"
              aria-expanded={open}
              aria-label={`${open ? 'Close' : 'Open'} ${label}, ${count} ${count === 1 ? 'item' : 'items'}`}
              onClick={() => setOpen(!open)}
            />
            <div className="gfc-label">
              <span className="gfc-title">{label}</span>
              <span className="gfc-meta" key={meta} data-state={metaState || undefined}>
                {meta}
              </span>
            </div>
          </div>

          {/* the contents: after the glass in tab order, beneath it on screen */}
          <div ref={filesRef} className="gfc-files" role="list" aria-label={`${label} contents`} inert={!open}>
            {visible.map((file, v) => {
              const slot = fanSlot(v, visible.length);
              const jitter = rng(hashString(file.name));
              const inner = (
                <>
                  {/* product art paints on open, not while the folder sits
                      closed: twelve folders times four sheets is the whole
                      queue budget for nothing anyone can see */}
                  {file.recipe && open ? (
                    <ArtCanvas
                      className="gfc-sheet-art"
                      recipe={file.recipe}
                      seed={hashString(file.name) % 997}
                      w={SHEET_W}
                      h={SHEET_H}
                      density={Math.min(density, 1.25)}
                      priority={1}
                    />
                  ) : (
                    <span className="gfc-lines" aria-hidden="true">
                      <i style={{ width: '86%' }} />
                      <i style={{ width: '92%' }} />
                      <i style={{ width: '64%' }} />
                      <i style={{ width: '88%' }} />
                      <i style={{ width: '42%' }} />
                    </span>
                  )}
                  <span className="gfc-sheet-head">
                    <span className="gfc-sheet-name">{file.name}</span>
                    {file.meta ? <span className="gfc-sheet-meta">{file.meta}</span> : null}
                  </span>
                </>
              );
              // the fan custom properties belong on the slot: the CSS reads
              // them from .gfc-sheet-slot, and custom properties do not
              // inherit upward from the anchor
              return (
                <div
                  key={start + v}
                  role="listitem"
                  className="gfc-sheet-slot"
                  style={{
                    '--gfc-slot': slot,
                    '--gfc-depth': visible.length - 1 - v,
                    '--gfc-jx': `${((jitter() - 0.5) * 10).toFixed(2)}px`,
                    '--gfc-jr': `${((jitter() - 0.5) * 3.2).toFixed(2)}deg`,
                    zIndex: v + 1,
                  }}
                >
                  <a
                    className={'gfc-sheet' + (file.recipe ? ' gfc-sheet--art' : '')}
                    href={file.href}
                  >
                    {inner}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Age chips live in the browser, never in the prerendered copy: the fallback
// shows the pillar doors and this island recomputes every age at mount.
export function daysSince(iso, now) {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor(((now || Date.now()) - t) / 86400000));
}

const shortAgo = (d) => (d == null ? '' : d <= 0 ? 'today' : d === 1 ? '1d' : `${d}d`);

export default function FolderCards({ companies = [] }) {
  const gridRef = React.useRef(null);
  const [scheme, setScheme] = React.useState(() =>
    typeof document === 'undefined' ? 'dark' : document.documentElement.getAttribute('data-scheme') || 'dark'
  );
  const [now, setNow] = React.useState(() => Date.now());

  // 4 x 3 at 1280, 2 x 6 at 768, one column of 300 at 375. Under 768 there is
  // no art at all: the back panel stays the flat brand colour, which is the
  // density law's phone answer (plan section 8).
  const measure = () => {
    const w = window.innerWidth;
    const cols = w >= 1120 ? 4 : w >= 640 ? 2 : 1;
    const grid = gridRef.current;
    const pad = w >= 1024 ? 48 : w >= 640 ? 32 : 20;
    const avail = grid && grid.clientWidth ? grid.clientWidth : w - 2 * pad;
    const cw = Math.floor((avail - 24 * (cols - 1)) / cols);
    return {
      cols,
      narrow: w < 768,
      width: Math.max(200, Math.min(360, cols === 1 ? Math.min(300, cw) : cw)),
    };
  };
  const [fit, setFit] = React.useState(() => (typeof window === 'undefined' ? { cols: 4, narrow: false, width: 300 } : measure()));

  React.useEffect(() => {
    setNow(Date.now());
    const de = document.documentElement;
    const mo = new MutationObserver(() => setScheme(de.getAttribute('data-scheme') || 'dark'));
    mo.observe(de, { attributes: true, attributeFilter: ['data-scheme'] });
    return () => mo.disconnect();
  }, []);

  React.useEffect(() => {
    const calc = () => setFit(measure());
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
    // measure only reads the window and the grid ref
  }, []);

  const recipes = React.useMemo(() => {
    const out = {};
    for (const c of companies) {
      const stops = ['--bg', '--card', `--${c.accent}-dim`, `--${c.accent}`, '--text']
        .map(cssColor)
        .filter(Boolean);
      out[c.slug] =
        stops.length >= 2
          ? {
              style: 'marble',
              colors: stops,
              scale: 0.7,
              warp: 3.2,
              angle: (hashString(c.slug) % 628) / 100,
              gloss: 0.45,
              veins: 0.4,
            }
          : null;
    }
    return out;
    // repainted when the scheme changes so the ramp follows the tokens
  }, [companies, scheme]);

  const tone = scheme === 'light' ? 'light' : 'dark';

  return (
    <div className="gfc-grid" ref={gridRef} data-tone={tone} data-narrow={fit.narrow || undefined} style={{ '--gfc-cols': fit.cols }}>
      {companies.map((c, i) => {
        const last = (c.entries || [])[0];
        const days = last ? daysSince(last.date, now) : null;
        const meta = last
          ? `last shipped day ${last.day} · ${shortAgo(days)}`
          : (c.products || []).length
            ? `${c.products.length} ${c.products.length === 1 ? 'product' : 'products'}`
            : c.tag || 'in the group';
        const metaState = days != null && days > 21 ? 'stale' : undefined;

        // newest first: the two freshest log entries, then product sheets
        const sheets = [];
        for (const e of (c.entries || []).slice(0, 2)) {
          sheets.push({
            name: String(e.text || '').slice(0, 34) || `day ${e.day}`,
            meta: `day ${e.day}`,
            href: `journey.html#day-${e.day}`,
          });
        }
        for (const p of (c.products || []).slice(0, 4)) {
          sheets.push({ name: p.name, meta: 'product', href: p.href, recipe: fit.narrow ? null : recipes[c.slug] });
        }
        // density law: a company with no entry and no product still shows one
        // sheet, the tag, opening the company page.
        if (!sheets.length) {
          sheets.push({ name: c.tag || c.name, meta: 'the company', href: `company/${c.slug}` });
        }

        return (
          <GlassFolder
            key={c.slug}
            label={c.name}
            meta={meta}
            metaState={metaState}
            tone={tone}
            brand={c.accent ? `--${c.accent}` : null}
            seed={hashString(c.slug) % 997}
            art={fit.narrow ? null : recipes[c.slug]}
            files={sheets.slice(0, MAX_VISIBLE)}
            width={fit.width}
            appearDelay={i * 60}
          />
        );
      })}
    </div>
  );
}
