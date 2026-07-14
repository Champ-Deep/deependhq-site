"use client";
// HeroSpatial : the whole-screen canvas moment. The round 6 icosahedron sits
// center-right, wrapped in a network shell whose nodes carry live "what I'm
// up to" labels. Continuous rotation, spring scale toward the cursor, and the
// round 6 focal-depth shift: scrolling away blurs and fades the whole layer.
// Dependency free. Reduced motion: one static frame, no blur choreography.

import { useEffect, useRef } from "react";
import { R6_MOTION_OK, R6_POINTER_FINE } from "@/components/client/r6/motion";

const TAU = Math.PI * 2;

// icosahedron vertices + edges (unit scale), from Hero6.jsx
const ICO = (() => {
  const p = (1 + Math.sqrt(5)) / 2;
  const v: number[][] = [
    [-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0],
    [0, -1, p], [0, 1, p], [0, -1, -p], [0, 1, -p],
    [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1],
  ].map((a) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]);
      if (d < 1.2) edges.push([i, j]);
    }
  return { v, edges };
})();

const cssColor = (variable: string, fallback: string) => {
  const probe = document.createElement("div");
  probe.style.color =
    getComputedStyle(document.documentElement).getPropertyValue(variable) || fallback;
  document.body.appendChild(probe);
  const c = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  return c;
};

export function HeroSpatial({ labels }: { labels: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = !R6_MOTION_OK();
    const fine = R6_POINTER_FINE();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;
    let ry = 0.6;
    let rx = 0.38;
    // cursor spring (scale) + parallax target
    let scale = 1;
    let scaleV = 0;
    let target = 1;
    let parX = 0;
    let parY = 0;
    let accent = "rgb(48, 224, 96)";
    let think = "rgb(74, 123, 247)";
    let text = "rgb(232, 228, 220)";

    // network shell: fibonacci sphere around the ico, labels pinned
    const N = 120;
    const shell: { x: number; y: number; z: number; label?: string }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      shell.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }
    const step = Math.floor(N / Math.max(labels.length, 1));
    labels.slice(0, 10).forEach((label, i) => {
      shell[(i * step + 5) % N].label = label;
    });

    const size = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      accent = cssColor("--accent", "#30E060");
      think = cssColor("--think", "#4A7BF7");
      text = cssColor("--text", "#E8E4DC");
    };

    const rgba = (rgb: string, a: number) =>
      rgb.startsWith("rgb(") ? rgb.replace("rgb(", "rgba(").replace(")", `, ${a.toFixed(3)})`) : rgb;

    const onMove = (e: PointerEvent) => {
      const cx = w >= 900 ? w * 0.3 : w * 0.5;
      const cy = Math.min(h * 0.46, 500);
      const d = Math.hypot(e.clientX - cx, e.clientY - cy);
      target = d < Math.min(w, h) * 0.32 ? 1.14 : 1;
      parX = (e.clientX / w - 0.5) * 0.4;
      parY = (e.clientY / h - 0.5) * 0.25;
    };

    // focal depth: blur + fade the layer as the user scrolls past the hero
    const onScroll = () => {
      const p = Math.min(1, window.scrollY / (window.innerHeight * 0.75));
      canvas.style.opacity = String((1 - p) + 0.08);
      canvas.style.filter = p > 0.02 ? `blur(${(p * 9).toFixed(1)}px)` : "";
    };

    const rot = (p: { x: number; y: number; z: number }, ryv: number, rxv: number) => {
      const x1 = p.x * Math.cos(ryv) + p.z * Math.sin(ryv);
      const z1 = -p.x * Math.sin(ryv) + p.z * Math.cos(ryv);
      const y2 = p.y * Math.cos(rxv) - z1 * Math.sin(rxv);
      const z2 = p.y * Math.sin(rxv) + z1 * Math.cos(rxv);
      return { x: x1, y: y2, z: z2 };
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // Left-of-center: the hero statement tile is transparent glass, so the
      // globe lives BEHIND the headline where it stays visible, not under the
      // opaque cards on the right.
      const cx = w >= 900 ? w * 0.3 : w * 0.5;
      const cy = Math.min(h * 0.46, 500);
      const Ri = Math.min(w, h) * 0.2 * scale; // ico core
      const Rs = Math.min(w, h) * 0.42 * scale; // network shell
      const ryv = ry + parX;
      const rxv = rx + parY;

      // shell nodes
      const proj = shell.map((p) => {
        const q = rot(p, ryv * 0.6, rxv);
        const persp = 1 / (1.9 - q.z * 0.7);
        return { sx: cx + q.x * Rs * persp, sy: cy + q.y * Rs * persp, z: q.z, label: p.label };
      });

      // shell connections
      const maxD = Rs * 0.36;
      for (let i = 0; i < proj.length; i++) {
        for (let j = i + 1; j < proj.length; j++) {
          const dx = proj[i].sx - proj[j].sx;
          const dy = proj[i].sy - proj[j].sy;
          if (dx * dx + dy * dy < maxD * maxD) {
            const depth = (proj[i].z + proj[j].z) / 2;
            const a = Math.max(0, 0.13 + depth * 0.12);
            if (a <= 0.012) continue;
            ctx.strokeStyle = rgba(accent, a);
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(proj[i].sx, proj[i].sy);
            ctx.lineTo(proj[j].sx, proj[j].sy);
            ctx.stroke();
          }
        }
      }

      // shell nodes + labels
      for (const p of proj) {
        const a = 0.22 + Math.max(0, p.z) * 0.7;
        ctx.fillStyle = p.label ? rgba(think, Math.min(a + 0.18, 1)) : rgba(accent, a);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.label ? 2.6 : 1.5, 0, TAU);
        ctx.fill();
        if (p.label && p.z > 0.05) {
          const la = Math.max(0, p.z - 0.08) * 0.95;
          ctx.font = "11px 'JetBrains Mono', monospace";
          ctx.fillStyle = rgba(text, la);
          ctx.fillText(`>_ ${p.label}`, p.sx + 8, p.sy + 3);
        }
      }

      // ico core (round 6 object, verbatim math)
      const cosX = Math.cos(rxv * 1.2);
      const sinX = Math.sin(rxv * 1.2);
      const cosY = Math.cos(ryv);
      const sinY = Math.sin(ryv);
      const iproj = ICO.v.map(([x, y, z]) => {
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;
        const persp = 2.8 / (2.8 + z2);
        return [cx + x2 * Ri * persp, cy + y1 * Ri * persp, z2] as const;
      });
      ctx.lineWidth = 1.2;
      for (const [a, b] of ICO.edges) {
        const depth = (iproj[a][2] + iproj[b][2]) / 2;
        ctx.strokeStyle = rgba(accent, Math.max(0.06, 0.7 - depth * 0.42));
        ctx.beginPath();
        ctx.moveTo(iproj[a][0], iproj[a][1]);
        ctx.lineTo(iproj[b][0], iproj[b][1]);
        ctx.stroke();
      }
      ctx.fillStyle = accent;
      for (const [x, y, z] of iproj) {
        ctx.globalAlpha = Math.max(0.15, 0.85 - z * 0.4);
        ctx.beginPath();
        ctx.arc(x, y, (2.2 - z) * 0.9, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = () => {
      if (!running) return;
      ry += 0.004;
      rx += 0.0017;
      const k = 0.06;
      const damp = 0.82;
      scaleV = (scaleV + (target - scale) * k) * damp;
      scale += scaleV;
      draw();
      raf = requestAnimationFrame(loop);
    };

    size();
    onScroll();
    window.addEventListener("resize", size);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (fine && !reduced) document.addEventListener("pointermove", onMove, { passive: true });
    if (reduced) draw();
    else raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointermove", onMove);
    };
  }, [labels]);

  return <canvas ref={ref} className="r6-spatial" aria-hidden="true" />;
}
