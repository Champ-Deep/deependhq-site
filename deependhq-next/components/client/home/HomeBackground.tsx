"use client";
// HomeBackground : the whole-screen canvas. A rotating network globe whose
// nodes carry "what I'm up to" labels, over a faint ordered-dither texture.
// Fades down as you scroll so content stays readable. Pure canvas, no deps.

import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;

export function HomeBackground({ labels }: { labels: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let raf = 0;
    let rotY = 0;
    let rotX = -0.35;
    let targetRX = -0.35;
    let targetRY = 0;
    let scrollFade = 1;

    // Fibonacci sphere: evenly spread nodes.
    const N = 150;
    const pts: { x: number; y: number; z: number; label?: string }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      pts.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
    }
    // Pin labels to well-spaced nodes.
    const step = Math.floor(N / Math.max(labels.length, 1));
    labels.slice(0, 10).forEach((label, i) => {
      pts[(i * step + 7) % N].label = label;
    });

    // Drifting far-field specks so the whole viewport feels alive.
    const specks = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() * 1.4 + 0.4,
      v: Math.random() * 0.00012 + 0.00003,
    }));

    // Static dither tile (4x4 Bayer), drawn once to an offscreen canvas.
    const tile = document.createElement("canvas");
    tile.width = tile.height = 4;
    const tctx = tile.getContext("2d")!;
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const img = tctx.createImageData(4, 4);
    for (let i = 0; i < 16; i++) {
      const v = bayer[i] < 4 ? 26 : 13;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v + 2;
      img.data[i * 4 + 2] = v + 6;
      img.data[i * 4 + 3] = bayer[i] < 4 ? 22 : 10;
    }
    tctx.putImageData(img, 0, 0);
    let pattern: CanvasPattern | null = null;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      pattern = ctx.createPattern(tile, "repeat");
    };

    const onMouse = (e: MouseEvent) => {
      targetRY = ((e.clientX / w) - 0.5) * 0.55;
      targetRX = -0.35 + ((e.clientY / h) - 0.5) * 0.3;
    };
    const onScroll = () => {
      const f = 1 - Math.min(window.scrollY / (h * 1.4), 1);
      scrollFade = 0.14 + f * 0.86;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);

      // dither texture
      if (pattern) {
        ctx.globalAlpha = 0.5 * scrollFade;
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      // far-field specks
      ctx.fillStyle = "rgba(138, 138, 138, 0.35)";
      for (const s of specks) {
        if (!reduced) s.y = (s.y + s.v) % 1;
        ctx.globalAlpha = 0.3 * scrollFade;
        ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
      }
      ctx.globalAlpha = 1;

      // globe
      const cx = w / 2;
      const cy = Math.min(h * 0.46, 520);
      const R = Math.min(w, h) * 0.36;
      if (!reduced) {
        rotY += 0.0016;
        rotX += (targetRX - rotX) * 0.03;
      }
      const ry = rotY + (reduced ? 0 : (targetRY - 0) * 0.4);

      const proj = pts.map((p) => {
        // rotate Y then X
        const x1 = p.x * Math.cos(ry) + p.z * Math.sin(ry);
        const z1 = -p.x * Math.sin(ry) + p.z * Math.cos(ry);
        const y2 = p.y * Math.cos(rotX) - z1 * Math.sin(rotX);
        const z2 = p.y * Math.sin(rotX) + z1 * Math.cos(rotX);
        const scale = 1 / (1.9 - z2 * 0.7);
        return {
          sx: cx + x1 * R * scale,
          sy: cy + y2 * R * scale,
          z: z2,
          label: p.label,
        };
      });

      // connections between near neighbors (front hemisphere brighter)
      for (let i = 0; i < proj.length; i++) {
        const a = proj[i];
        for (let j = i + 1; j < proj.length; j++) {
          const b = proj[j];
          const dx = a.sx - b.sx;
          const dy = a.sy - b.sy;
          const d2 = dx * dx + dy * dy;
          const maxD = R * 0.34;
          if (d2 < maxD * maxD) {
            const depth = (a.z + b.z) / 2;
            const alpha = Math.max(0, 0.16 + depth * 0.14) * scrollFade;
            if (alpha <= 0.01) continue;
            ctx.strokeStyle = `rgba(48, 224, 96, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.stroke();
          }
        }
      }

      // nodes + labels
      for (const p of proj) {
        const front = p.z > 0;
        const alpha = (0.25 + Math.max(0, p.z) * 0.75) * scrollFade;
        ctx.fillStyle = p.label
          ? `rgba(74, 123, 247, ${Math.min(alpha + 0.15, 1).toFixed(3)})`
          : `rgba(48, 224, 96, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.label ? 2.6 : 1.6, 0, TAU);
        ctx.fill();
        if (p.label && front) {
          const la = Math.max(0, p.z - 0.1) * 0.9 * scrollFade;
          if (la > 0.05) {
            ctx.font = "11px JetBrains Mono, monospace";
            ctx.fillStyle = `rgba(232, 228, 220, ${la.toFixed(3)})`;
            ctx.fillText(`>_ ${p.label}`, p.sx + 8, p.sy + 3);
          }
        }
      }

      if (!reduced) raf = requestAnimationFrame(draw);
    };

    resize();
    onScroll();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("scroll", onScroll, { passive: true });
    if (reduced) {
      draw(0);
    } else {
      raf = requestAnimationFrame(draw);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("scroll", onScroll);
    };
  }, [labels]);

  return <canvas ref={ref} className="dh6-bg" aria-hidden="true" />;
}
