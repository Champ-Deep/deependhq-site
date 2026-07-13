// Home : the v4-direction surface. Whole-screen globe canvas fed by what is
// actually being built, rails on both sides, kinetic hero, live ticker, and
// the signals bento reusing the command-center widgets.

import type { ComponentProps } from "react";
import { DH } from "@/lib/data";
import { HomeBackground } from "@/components/client/home/HomeBackground";
import { RailLeft, RailRight, type RailStatus } from "@/components/client/home/Rails";
import { Hero } from "@/components/client/home/Hero";
import { Ticker, type TickerStatus } from "@/components/client/home/Ticker";
import { CommandTeaser } from "@/components/client/home/CommandTeaser";
import { Dispatch, type DispatchData } from "@/components/client/home/Dispatch";
import {
  ShippingNow,
  HowIThink,
  Ecosystem,
  Proof,
  TheStack,
  SecondCTA,
  NextStep,
} from "@/components/home/Sections";
import { Heatmap } from "@/components/client/command/Heatmap";
import { Constellation } from "@/components/client/command/Constellation";
import { LiveRepos } from "@/components/client/command/LiveRepos";
import { Shoutouts } from "@/components/client/command/Shoutouts";

const WAYPOINTS = [
  { id: "hero", label: "./top" },
  { id: "now", label: "./shipping" },
  { id: "think", label: "./takes" },
  { id: "ecosystem", label: "./the-twelve" },
  { id: "command-teaser", label: "./command" },
  { id: "signals", label: "./signals" },
  { id: "book", label: "./book" },
];

// "What I'm up to" labels for the globe: build lane names first, then the
// arcs from the most recent journey entries. Short strings only.
function globeLabels(): string[] {
  const lanes = DH.build_lanes as unknown as Record<string, unknown>;
  const laneNames: string[] = [];
  for (const key of ["building", "live", "next"]) {
    const arr = lanes?.[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const o = item as Record<string, unknown>;
        const name = o.name ?? o.title ?? o.label;
        if (typeof name === "string" && name.length < 26) laneNames.push(name);
      }
    }
  }
  const arcs = DH.journey.slice(0, 10).flatMap((e) => e.arcs || []);
  const uniq = [...new Set([...laneNames, ...arcs])].filter((s) => s.length < 26);
  return uniq.length ? uniq.slice(0, 9) : ["shipping nightly"];
}

// Hero rotation lines: the freshest shipping_now snippets.
function heroRotations(): string[] {
  return DH.journey.slice(0, 5).map((e) => e.shipping_now.toLowerCase());
}

export default function Home() {
  const status = DH.status as unknown as TickerStatus & RailStatus;
  const lexicon = DH.lexicon as unknown as { term: string; def: string }[];
  const commits = DH.journey
    .slice(0, 14)
    .map((e) => (typeof e.github_commits === "number" ? e.github_commits : 0))
    .reverse();
  const shouts = DH.shoutouts as unknown as {
    note: string;
    items: ComponentProps<typeof Shoutouts>["items"];
  };

  return (
    <>
      <HomeBackground labels={globeLabels()} />
      <div className="dh6-shell">
        <RailLeft day={DH.brand.today_day} waypoints={WAYPOINTS} />
        <div className="dh6-main">
          <Hero
            location={DH.brand.location}
            day={DH.brand.today_day}
            narratives={DH.weekly_narratives_count}
            rotations={heroRotations()}
          />
          <Ticker status={status} day={DH.brand.today_day} />
          <ShippingNow />
          <HowIThink />
          <Ecosystem />
          <CommandTeaser />

          <section id="signals" data-screen-label="signals" className="dh-section" aria-label="signals">
            <div className="dh-section-head">
              <div>
                <div className="dh-eyebrow">
                  <span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> Signals
                </div>
                <h2 className="dh-section-title">The instruments, not the highlight reel.</h2>
              </div>
            </div>
            <div className="dh-bento">
              <div className="dh-tile b7">
                <span className="dh-tile-key">the log, 12 weeks</span>
                <Heatmap
                  journey={DH.journey as unknown as ComponentProps<typeof Heatmap>["journey"]}
                  todayDate={DH.brand.today_date}
                />
              </div>
              <div className="dh-tile b5">
                <span className="dh-tile-key">the twelve</span>
                <Constellation
                  companies={DH.companies as unknown as ComponentProps<typeof Constellation>["companies"]}
                />
              </div>
              <div className="dh-tile b7" style={{ background: "transparent", border: 0, padding: 0, backdropFilter: "none" }}>
                <LiveRepos />
              </div>
              <div className="dh-tile b5">
                <span className="dh-tile-key">heard around</span>
                <Shoutouts items={shouts.items} note={shouts.note} />
              </div>
            </div>
          </section>

          <Proof />
          <TheStack />
          <Dispatch d={DH.dispatch as unknown as DispatchData} />
          <SecondCTA />
          <NextStep />
        </div>
        <RailRight status={status} lexicon={lexicon} commits={commits} />
      </div>
    </>
  );
}
