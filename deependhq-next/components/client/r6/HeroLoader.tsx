"use client";
// components/client/r6/HeroLoader.tsx : the hero-opening scroll sequence.
// Owns the loader's config and navigation so no handler crosses the
// server/client boundary; the loader's CTA completes into the log.

import LoadingAnimation from "./LoadingAnimation";

export function HeroLoader() {
  return (
    <LoadingAnimation
      rows={[
        [["Past the "], ["hype", "frame"], [" cycle."]],
        [["Into the "], ["infrastructure.", "frame"]],
      ]}
      cta="work with me"
      loadingLabel="opening the window"
      readyLabel="window open"
      scrollHeight="340vh"
      showReveal
      onComplete={() => {
        document.getElementById("log")?.scrollIntoView({ behavior: "smooth" });
      }}
    />
  );
}

export default HeroLoader;