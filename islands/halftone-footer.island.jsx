// islands/halftone-footer.island.jsx : the Halftone Wordmark Footer, ported
// from the pasted 21st.dev prompt for the Oct 2026 refresh.
//
// Interaction only. Every link, the privacy sentence and the build-day line
// are already in the prerendered fallback inside the mount, so this file
// failing to load loses motion, not reading.
//
// Port notes (contract section 2):
//   - the four presets are gone. background, ink and warm are read from the
//     scheme tokens (--bg, --text, --win), so one component serves both looks
//     and follows a scheme change without a reload;
//   - the scoped <style> block moved to home.css under the .hwf- prefix;
//   - reduced motion draws one static halftone and never starts the loop;
//   - the loop sleeps whenever the footer is off screen.
// No em dashes.

import * as React from 'react';

// A custom property stores a token stream, so reading --a-color straight out
// of computed style can hand back an unresolved color-mix(). Assign it to a
// real property on a throwaway node: only then does the browser resolve it to
// something a canvas will paint.
export function hwfColor(name) {
  if (!name || typeof document === 'undefined') return null;
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  document.documentElement.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return hwfHex(value);
}

/** 'rgb(1, 2, 3)', 'rgba(...)' or 'color(srgb ...)' to '#rrggbb', else null. */
export function hwfHex(str) {
  const s = String(str || '');
  let m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s);
  if (m) return hwfToHex(+m[1], +m[2], +m[3]);
  m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s);
  if (m) return hwfToHex(Math.round(+m[1] * 255), Math.round(+m[2] * 255), Math.round(+m[3] * 255));
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  return null;
}

const hwfToHex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** '#rrggbb' to [r, g, b]. Anything unreadable comes back null. */
export function hwfRgb(hex) {
  const h = hwfHex(hex);
  if (!h) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/** Dot radius for a cell coverage in [0, 1]: area-true, so tone stays even. */
export function hwfRadius(coverage, gap) {
  const c = coverage < 0 ? 0 : coverage > 1 ? 1 : coverage;
  return Math.sqrt(c) * gap * 0.56;
}

/** One spring step for a dot home at (hx, hy) pushed by a pointer at (px, py). */
export function hwfStep(x, y, vx, vy, hx, hy, px, py, r) {
  const dx = x - px;
  const dy = y - py;
  const d2 = dx * dx + dy * dy;
  if (r > 0 && d2 < r * r) {
    const d = Math.sqrt(d2) + 0.001;
    const f = (1 - d / r) * 2.6;
    vx += (dx / d) * f;
    vy += (dy / d) * f;
  }
  vx = (vx + (hx - x) * 0.05) * 0.84;
  vy = (vy + (hy - y) * 0.05) * 0.84;
  return [x + vx, y + vy, vx, vy];
}

/** How warm a dot draws: 0 at home, 1 once it is `span` px or more away. */
export function hwfWarmth(x, y, hx, hy, span) {
  const d = Math.hypot(x - hx, y - hy);
  return span > 0 ? Math.min(1, d / span) : 0;
}

/** Font size that sets `measured` (width at 100px) to fill `width` exactly. */
export function hwfFitSize(measured, width) {
  return measured > 0 ? (width / measured) * 100 : 0;
}

// The build line and every age below are derived, never stored: the page may
// sit unrefreshed for days and the label has to keep telling the truth.
export const hwfDaysSince = (iso, now) => {
  const t = Date.parse(iso || '');
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor(((now || Date.now()) - t) / 86400000));
};

export const hwfAgo = (days) => {
  if (days == null) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

export default function HalftoneFooter(props) {
  const {
    wordmark = 'deep_',
    label = 'Sreedeep Surapaneni',
    meta = 'Champions Group · Bangalore',
    columns = [],
    privacy = [],
    day = null,
    builtLabel = '',
    builtIso = null,
    backToTop = true,
    grain = 0.35,
  } = props;

  const rootRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const faceRef = React.useRef(null);

  // Live age: recomputed in the visitor's browser, so a prerendered page that
  // has been sitting around still says how old its build is.
  const [age, setAge] = React.useState(() => hwfAgo(hwfDaysSince(builtIso)));
  const stale = (() => {
    const d = hwfDaysSince(builtIso);
    return d != null && d > 21;
  })();

  // The scheme can change without a reload; the canvas has to be repainted in
  // the new tokens or the dots keep the old palette.
  const [scheme, setScheme] = React.useState(() =>
    typeof document === 'undefined' ? 'dark' : document.documentElement.getAttribute('data-scheme') || 'dark'
  );
  React.useEffect(() => {
    setAge(hwfAgo(hwfDaysSince(builtIso)));
    const de = document.documentElement;
    const mo = new MutationObserver(() => setScheme(de.getAttribute('data-scheme') || 'dark'));
    mo.observe(de, { attributes: true, attributeFilter: ['data-scheme'] });
    return () => mo.disconnect();
  }, [builtIso]);

  React.useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = {
      background: hwfColor('--bg'),
      ink: hwfColor('--text'),
      warm: hwfColor('--win'),
    };
    // No tokens means the stylesheet did not load. The text fallback is the
    // content, so the canvas simply stays blank instead of painting garbage.
    if (!colors.background || !colors.ink) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const face = faceRef.current ? getComputedStyle(faceRef.current).fontFamily : '';
    const ink = hwfRgb(colors.ink) || [244, 235, 217];
    const warm = hwfRgb(colors.warm) || [244, 166, 42];

    let w = 0;
    let h = 0;
    let dpr = 1;
    let px = -1e5;
    let py = -1e5;
    let raf = 0;
    let visible = true;
    let awake = false;
    let ring = { x: 0, y: 0, t: -1 };
    let dots = new Float32Array(0);
    let count = 0;
    let grainTile = null;

    const opt = (name, fallback) => {
      const v = getComputedStyle(root).getPropertyValue(name).trim();
      return v === '' ? fallback : v;
    };

    const layout = () => {
      const rect = root.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      const m = mask.getContext('2d', { willReadFrequently: true });
      if (!m) return;
      const weight = 800;
      const stack = face || 'system-ui, sans-serif';
      m.font = `${weight} 100px ${stack}`;
      const word = wordmark || ' ';
      const fit = hwfFitSize(m.measureText(word).width, w * 1.02);
      m.font = `${weight} ${fit}px ${stack}`;
      const box = m.measureText(word);
      const cap = box.actualBoundingBoxAscent || fit * 0.72;
      // The crop lives in CSS (--hwf-crop) because it is a layout decision the
      // media query already owns; clamped to the source component's 0 to 0.6.
      const raw = parseFloat(opt('--hwf-crop', '0.3'));
      const c = Math.max(0, Math.min(0.6, Number.isFinite(raw) ? raw : 0.3));
      m.fillStyle = '#000';
      m.textBaseline = 'alphabetic';
      m.fillText(word, (w - box.width) / 2, h + cap * c);
      const img = m.getImageData(0, 0, w, h).data;

      const gap = Math.max(3, parseFloat(opt('--hwf-gap', '6')) || 6);
      const cols = Math.ceil(w / gap);
      const rows = Math.ceil(h / gap);
      const tmp = [];
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          let sum = 0;
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const x = Math.min(w - 1, Math.floor(gx * gap + ((sx + 0.5) * gap) / 3));
              const y = Math.min(h - 1, Math.floor(gy * gap + ((sy + 0.5) * gap) / 3));
              sum += img[(y * w + x) * 4 + 3];
            }
          }
          const cov = sum / (9 * 255);
          if (cov < 0.06) continue;
          const hx = gx * gap + gap / 2;
          const hy = gy * gap + gap / 2;
          tmp.push(hx, hy, 0, 0, hx, hy, hwfRadius(cov, gap));
        }
      }
      dots = new Float32Array(tmp);
      count = tmp.length / 7;

      // One tile of print grain, drawn once, laid over every frame.
      if (!grainTile) {
        grainTile = document.createElement('canvas');
        grainTile.width = 256;
        grainTile.height = 256;
        const g = grainTile.getContext('2d');
        if (g) {
          const id = g.createImageData(256, 256);
          for (let i = 0; i < id.data.length; i += 4) {
            const v = Math.random() * 255;
            id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
            id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
          }
          g.putImageData(id, 0, 0);
        }
      }
      awake = true;
    };

    const draw = (now) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, w, h);

      const r = reduced ? 0 : 80;
      const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
      const ringR = ringAge * 0.9;
      let moving = false;
      for (let i = 0; i < count; i++) {
        const j = i * 7;
        let x = dots[j];
        let y = dots[j + 1];
        let vx = dots[j + 2];
        let vy = dots[j + 3];
        const hx = dots[j + 4];
        const hy = dots[j + 5];
        if (!reduced) {
          if (ringAge < 900) {
            const dx = hx - ring.x;
            const dy = hy - ring.y;
            const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
            const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
            if (band > 0) {
              const f = band * 3.2 * (1 - ringAge / 900);
              vx += (dx / d) * f;
              vy += (dy / d) * f;
            }
          }
          const s = hwfStep(x, y, vx, vy, hx, hy, px, py, r);
          x = s[0];
          y = s[1];
          vx = s[2];
          vy = s[3];
          if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) {
            moving = true;
          } else {
            x = hx;
            y = hy;
            vx = 0;
            vy = 0;
          }
          dots[j] = x;
          dots[j + 1] = y;
          dots[j + 2] = vx;
          dots[j + 3] = vy;
        }
        const k = hwfWarmth(x, y, hx, hy, 28);
        ctx.fillStyle =
          k > 0.02
            ? `rgb(${Math.round(ink[0] + (warm[0] - ink[0]) * k)},${Math.round(
                ink[1] + (warm[1] - ink[1]) * k
              )},${Math.round(ink[2] + (warm[2] - ink[2]) * k)})`
            : colors.ink;
        ctx.beginPath();
        ctx.arc(x, y, dots[j + 6], 0, 6.2832);
        ctx.fill();
      }

      const amount = Number(grain);
      if (grainTile && amount > 0) {
        ctx.globalAlpha = Math.min(1, amount) * 0.09;
        ctx.globalCompositeOperation = 'overlay';
        const pattern = ctx.createPattern(grainTile, 'repeat');
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // Sleep once every dot is home and nothing is pushing.
      awake = !reduced && (moving || ringAge < 900 || px > -1e4);
    };

    const frame = (now) => {
      raf = 0;
      if (!visible) return;
      draw(now);
      if (awake) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (reduced) return;
      awake = true;
      if (!raf && visible) raf = requestAnimationFrame(frame);
    };

    const toLocal = (e) => {
      const b = canvas.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };
    const onMove = (e) => {
      const p = toLocal(e);
      px = p[0];
      py = p[1];
      wake();
    };
    const onLeave = () => {
      px = -1e5;
      py = -1e5;
      wake();
    };
    const onDown = (e) => {
      if (reduced) return;
      if (e.target && e.target.closest && e.target.closest('a,button')) return;
      const p = toLocal(e);
      ring = { x: p[0], y: p[1], t: performance.now() };
      wake();
    };

    layout();
    draw(performance.now());
    wake();

    if (!reduced) {
      root.addEventListener('pointermove', onMove);
      root.addEventListener('pointerleave', onLeave);
      root.addEventListener('pointerdown', onDown);
    }
    const ro = new ResizeObserver(() => {
      layout();
      draw(performance.now());
      wake();
    });
    ro.observe(root);
    // Off screen means no frames: the tab keeps a canvas that draws nothing.
    const io = new IntersectionObserver((entries) => {
      visible = entries[0] ? entries[0].isIntersecting : true;
      if (visible) {
        draw(performance.now());
        wake();
      }
    });
    io.observe(root);
    let alive = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!alive) return;
        layout();
        draw(performance.now());
        wake();
      });
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('pointerdown', onDown);
    };
    // scheme repaints the field in the new tokens
  }, [scheme, wordmark, grain]);

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const dayLine = `${day ? `day ${day} of building in public · ` : ''}built ${builtLabel}${
    age ? ` (${age})` : ''
  }`;

  return (
    <div ref={rootRef} className="hwf-root" data-scheme={scheme}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <span ref={faceRef} className="hwf-sr hwf-face">
        {wordmark}
      </span>
      <div className="hwf-top">
        <div className="hwf-brand">
          <strong>{label}</strong>
          <span>{meta}</span>
        </div>
        {columns.map((col) => (
          <nav className="hwf-col" key={col.title} aria-label={col.title}>
            <h3>{col.title}</h3>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href || '#'} {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="hwf-rule">
        <div className="hwf-rule-a">
          {backToTop ? (
            <button type="button" className="hwf-up" onClick={toTop}>
              back to top ↑
            </button>
          ) : null}
        </div>
        <div className="hwf-rule-b">
          <p className="hwf-day" data-state={stale ? 'stale' : 'fresh'}>
            {dayLine}
          </p>
          <p className="hwf-priv">
            {privacy.map((s, i) =>
              s.href ? (
                <a key={i} href={s.href}>
                  {s.t}
                </a>
              ) : (
                <React.Fragment key={i}>{s.t}</React.Fragment>
              )
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
