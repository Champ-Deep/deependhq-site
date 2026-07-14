"use client";
// components/client/r6/Macbook6.tsx : scroll-scrubbed laptop reveal.
// Port of the round 6 Macbook6, with one change: the screen shows a live
// iframe of /command (same pattern as CommandTeaser) instead of the
// legacy image-slot element. The iframe lazy-mounts as the stage nears
// the viewport; the lid-open scrub runs only when motion is allowed.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { R6_MOTION_OK } from "./motion";

export interface Macbook6Ship {
  name: string;
  note?: string;
  href?: string;
}

export interface Macbook6Props {
  /** completed tools shown in the shipped-and-live strip under the stage */
  shipped?: Macbook6Ship[];
}

function ShipTile({ item }: { item: Macbook6Ship }) {
  const body = (
    <>
      <span className="dh6r-ship-row">
        <span className="dh6r-ship-dot" aria-hidden="true"></span>
        <span className="dh6r-ship-name">{item.name}</span>
      </span>
      {item.note ? <span className="dh6r-ship-note">{item.note}</span> : null}
    </>
  );
  if (!item.href) return <div className="dh6r-ship-tile">{body}</div>;
  if (item.href.startsWith("/")) {
    return (
      <Link className="dh6r-ship-tile" href={item.href}>
        {body}
      </Link>
    );
  }
  return (
    <a className="dh6r-ship-tile" href={item.href} target="_blank" rel="noreferrer">
      {body}
    </a>
  );
}

export function Macbook6({ shipped }: Macbook6Props = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [load, setLoad] = useState(false);

  // lazy-mount the live /command preview
  useEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    if (!("IntersectionObserver" in window)) {
      setLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(stage);
    return () => io.disconnect();
  }, []);

  // progress 0 to 1 as the stage travels from entering to 35% up the viewport
  useEffect(() => {
    if (!R6_MOTION_OK()) return;
    const stage = ref.current;
    if (!stage) return;
    const screen = stage.querySelector<HTMLElement>(".r6-mac-screen");
    if (!screen) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = stage.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.65)));
      const ease = 1 - Math.pow(1 - p, 3);
      screen.style.transform = `rotateX(${(1 - ease) * 62}deg) scale(${0.86 + ease * 0.14})`;
      screen.style.opacity = String(0.35 + ease * 0.65);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section className="dh5-section" data-screen-label="featured build" aria-label="featured build">
      <div className="dh5-section-head" data-r6-reveal="">
        <h2>featured build</h2>
        <span className="r6-chip">scroll to open</span>
      </div>
      <div className="r6-mac-stage" ref={ref}>
        <div className="r6-mac">
          <div className="r6-mac-screen">
            <div className="r6-mac-cam"></div>
            <div className="r6-mac-view">
              {load && (
                <iframe src="/command" title="command center preview" loading="lazy" tabIndex={-1} />
              )}
            </div>
          </div>
          <div className="r6-mac-deck"></div>
        </div>
        <p className="r6-mac-caption">
          <b>the command center, live.</b> the same instruments a visitor gets, one scroll away.
        </p>
      </div>
      {shipped && shipped.length > 0 ? (
        <div className="dh6r-ship-strip" aria-label="shipped and live tools">
          <span className="dh6r-ship-head">shipped and live</span>
          <div className="dh6r-ship-grid">
            {shipped.map((s) => (
              <ShipTile key={s.name} item={s} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
