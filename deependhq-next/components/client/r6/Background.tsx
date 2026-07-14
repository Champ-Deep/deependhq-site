"use client";
// components/client/r6/Background.tsx : global dither / animated dot-noise layer.
// A fixed low-res canvas (rendered at 1/4 scale, pixelated upscale) drawing
// a Bayer-thresholded dot field that drifts slowly. Reduced motion: one
// static frame. Color comes from computed --text so it follows the palette.

import { useEffect, useRef } from "react";

export interface BackgroundProps {
  enabled?: boolean;
}

export function Background({ enabled = true }: BackgroundProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SCALE = 4; // render at quarter resolution
    const BAYER = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    let raf = 0;
    let running = true;

    const size = () => {
      canvas.width = Math.ceil(window.innerWidth / SCALE);
      canvas.height = Math.ceil(window.innerHeight / SCALE);
    };
    size();

    const dotColor = (): string => {
      const probe = document.createElement("div");
      probe.style.color =
        getComputedStyle(document.documentElement).getPropertyValue("--text") || "#E8E4DC";
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      document.body.removeChild(probe);
      return c;
    };

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dotColor();
      ctx.globalAlpha = 0.05;
      const drift = t * 0.00004;
      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          // cheap smooth noise: two sine fields + bayer threshold
          const n =
            Math.sin(x * 0.045 + drift * 9 + Math.sin(y * 0.03)) * 0.5 +
            Math.sin(y * 0.05 - drift * 6 + Math.sin(x * 0.02 + drift * 4)) * 0.5;
          const v = (n + 1) * 8; // 0..16
          if (v > BAYER[y % 4][x % 4]) ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    };

    if (reduced) {
      draw(0);
    } else {
      let last = 0;
      const loop = (t: number) => {
        if (!running) return;
        // ~14fps is plenty for a texture; keeps main thread cool
        if (t - last > 70) {
          draw(t);
          last = t;
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    const onResize = () => {
      size();
      if (reduced) draw(0);
    };
    window.addEventListener("resize", onResize);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas className="r6-bg" ref={ref} aria-hidden="true"></canvas>;
}
