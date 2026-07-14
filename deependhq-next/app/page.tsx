// Home : deependhq.com v2. The round 6 v4 composition from the Gotham
// Workshop design system, plus the enhanced rails and the whole-screen
// spatial layer (icosahedron core wrapped in a labeled network shell).

import type { ComponentProps } from "react";
import { DH } from "@/lib/data";
import { HeroSpatial } from "@/components/client/r6/HeroSpatial";
import { RevealsManager, About6 } from "@/components/client/r6/Effects";
import { Hero6 } from "@/components/client/r6/Hero6";
import { Ticker5 } from "@/components/client/r6/Ticker5";
import { Macbook6 } from "@/components/client/r6/Macbook6";
import { StatStrip } from "@/components/client/r6/StatStrip";
import { Heatmap5, Constellation5, RepoCards5, Shoutouts5 } from "@/components/client/r6/Viz5";
import { LastFive, Companies5, Proof5, WaysIn, Newsletter5, NextStep } from "@/components/home/Sections5";
import { RailLeft, RailRight, type RailStatus } from "@/components/client/home/Rails";

const WAYPOINTS = [
  { id: "hero", label: "./top" },
  { id: "log", label: "./the-log" },
  { id: "twelve", label: "./the-twelve" },
  { id: "featured", label: "./featured" },
  { id: "about", label: "./about" },
  { id: "signals", label: "./signals" },
  { id: "ways", label: "./ways-in" },
];

// "What I'm up to" labels for the spatial shell: build lane names first,
// then arcs from the freshest journey entries. Short strings only.
function spatialLabels(): string[] {
  const lanes = DH.build_lanes as unknown as Record<string, unknown>;
  const names: string[] = [];
  for (const key of ["building", "live", "next"]) {
    const arr = lanes?.[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        const o = item as Record<string, unknown>;
        const name = o.name ?? o.title ?? o.label;
        if (typeof name === "string" && name.length < 26) names.push(name);
      }
    }
  }
  const arcs = DH.journey.slice(0, 10).flatMap((e) => e.arcs || []);
  const uniq = [...new Set([...names, ...arcs])].filter((s) => s.length < 26);
  return uniq.length ? uniq.slice(0, 9) : ["shipping nightly"];
}

type Repo5 = ComponentProps<typeof RepoCards5>["repos"][number];
type Shipped = NonNullable<ComponentProps<typeof Macbook6>["shipped"]>[number];

// "Shipped and live" strip under the featured build: the live lane first,
// then anything in building, generic key extraction so lane shape drift
// in content.json never breaks the page.
function shippedTools(): Shipped[] {
  const lanes = DH.build_lanes as unknown as Record<string, unknown>;
  const out: Shipped[] = [];
  for (const key of ["live", "building"]) {
    const arr = lanes?.[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      const o = item as Record<string, unknown>;
      const name = o.name ?? o.title ?? o.label;
      if (typeof name !== "string") continue;
      const noteRaw = o.note ?? o.desc ?? o.what ?? o.detail;
      const hrefRaw = o.url ?? o.href ?? o.link;
      out.push({
        name: key === "building" ? `${name} · in build` : name,
        note: typeof noteRaw === "string" ? noteRaw : undefined,
        href: typeof hrefRaw === "string" ? hrefRaw : undefined,
      });
    }
  }
  return out.slice(0, 8);
}

interface GitHubRepo {
  name?: string;
  html_url?: string;
  description?: string | null;
  language?: string | null;
  pushed_at?: string;
  fork?: boolean;
}

async function getRepos(): Promise<Repo5[]> {
  try {
    const r = await fetch("https://api.github.com/users/Champ-Deep/repos?sort=pushed&per_page=10", {
      next: { revalidate: 3600 },
    });
    if (!r.ok) return [];
    const list = (await r.json()) as GitHubRepo[];
    return list
      .filter((x) => !x.fork && x.name && x.html_url && x.pushed_at)
      .slice(0, 6)
      .map((x) => ({
        name: x.name as string,
        url: x.html_url as string,
        description: x.description || undefined,
        language: x.language || undefined,
        pushed_at: x.pushed_at as string,
      }));
  } catch {
    return [];
  }
}

export default async function Home() {
  const status = DH.status as unknown as RailStatus & Record<string, unknown>;
  const lexicon = DH.lexicon as unknown as { term: string; def: string }[];
  const month = DH.brand.today_date.slice(0, 7);
  const ships = DH.journey.filter((e) => (e.date || "").slice(0, 7) === month).length;
  const essays = DH.weekly_narratives_count || DH.posts.length;
  const commits = DH.journey
    .slice(0, 14)
    .map((e) => (typeof e.github_commits === "number" ? e.github_commits : 0))
    .reverse();

  const shoutItems = (
    DH.shoutouts as unknown as { items: { name: string; repo: string; what: string; tag: string }[] }
  ).items.map((s) => ({ quote: s.what, who: s.name, role: s.tag }));

  const entry = DH.journey[0];
  const firstPost = DH.posts[0];
  const terminal: ComponentProps<typeof Hero6>["terminal"] = {
    day: DH.brand.today_day,
    journey: DH.journey.slice(0, 8).map((e) => ({ day: e.day, shipping_now: e.shipping_now, arcs: e.arcs })),
    companies: DH.companies.map((c) => ({ name: c.name })),
    stack: DH.stack.map((r) => `${r.layer} · ${r.what}`),
    onRepeat: null,
    coffee: typeof status.coffee === "number" ? status.coffee : 0,
  };

  const repos = await getRepos();

  return (
    <>
      <HeroSpatial labels={spatialLabels()} />
      <RevealsManager />
      <StatStrip
        days={DH.brand.today_day}
        ships={ships}
        companies={DH.companies.length}
        essays={essays}
        onRepeat={null}
      />
      <div className="dh5-shell">
        <RailLeft day={DH.brand.today_day} ships={ships} waypoints={WAYPOINTS} />
        <main className="dh5-main" id="main">
          <div id="hero">
            <Hero6
              day={DH.brand.today_day}
              entry={entry as unknown as ComponentProps<typeof Hero6>["entry"]}
              vaultCommits={typeof status.vault_commits === "number" ? status.vault_commits : 0}
              post={
                firstPost
                  ? {
                      title: firstPost.title,
                      summary: firstPost.summary || firstPost.subtitle,
                      slug: firstPost.slug,
                      date: firstPost.date,
                      read: firstPost.read,
                    }
                  : null
              }
              terminal={terminal}
            />
          </div>
          <Ticker5
            status={DH.status as unknown as ComponentProps<typeof Ticker5>["status"]}
            day={DH.brand.today_day}
          />
          <div id="log" data-r6-reveal="">
            <LastFive />
          </div>
          <div id="twelve" data-r6-reveal="">
            <Companies5 />
          </div>
          <div id="featured">
            <Macbook6 shipped={shippedTools()} />
          </div>
          <div id="about">
            <About6 />
          </div>
          <section className="dh5-section" id="signals" data-screen-label="signals" aria-label="signals" data-r6-reveal="">
            <div className="dh5-section-head">
              <h2>signals</h2>
              <span className="r6-chip">live instruments</span>
            </div>
            <div className="dh-bento">
              <div className="dh-tile b7">
                <span className="dh-tile-key">the log, 12 weeks</span>
                <Heatmap5
                  journey={DH.journey as unknown as ComponentProps<typeof Heatmap5>["journey"]}
                  todayDay={DH.brand.today_day}
                />
              </div>
              <div className="dh-tile b5">
                <span className="dh-tile-key">the twelve</span>
                <Constellation5
                  companies={DH.companies.map((c) => ({ name: c.name, slug: c.slug }))}
                  journey={DH.journey as unknown as ComponentProps<typeof Constellation5>["journey"]}
                />
              </div>
              <div className="dh-tile b7" style={{ background: "transparent", border: 0, padding: 0, backdropFilter: "none" }}>
                <RepoCards5 repos={repos} />
              </div>
              <div className="dh-tile b5">
                <span className="dh-tile-key">heard around</span>
                <Shoutouts5 items={shoutItems} />
              </div>
            </div>
          </section>
          <div data-r6-reveal="">
            <Proof5 />
          </div>
          <div id="ways" data-r6-reveal="">
            <WaysIn />
          </div>
          <div data-r6-reveal="">
            <Newsletter5 />
          </div>
          <NextStep href="/journey">start with what I shipped today</NextStep>
        </main>
        <RailRight
          status={status}
          lexicon={lexicon}
          commits={commits}
          companiesCount={DH.companies.length}
          essays={essays}
        />
      </div>
    </>
  );
}
