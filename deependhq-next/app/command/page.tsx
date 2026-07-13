// /command : the public Command Center. Server shell port of CommandPage.jsx
// plus command.html. Reads DH once, passes serializable slices to the client
// components. The static sections (status board, build lanes, CTA) render on
// the server. Flair CDN scripts load after hydration; every client component
// degrades gracefully while they arrive or if they never do.

import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { DH } from "@/lib/data";
import { CommandHero } from "@/components/client/command/CommandHero";
import { Heatmap, type HeatJourneyEntry } from "@/components/client/command/Heatmap";
import { GitHubCal } from "@/components/client/command/GitHubCal";
import { Constellation, type ConstellationCompany } from "@/components/client/command/Constellation";
import { LiveRepos } from "@/components/client/command/LiveRepos";
import { Shoutouts, type ShoutItem } from "@/components/client/command/Shoutouts";
import { Terminal } from "@/components/client/command/Terminal";

export const metadata: Metadata = {
  title: "Command",
  description:
    "The operator view: live status, the build queue, the public log, the ecosystem, and the code. Updated daily.",
};

// Local shapes for the DH slices that lib/data.ts types loosely.
interface StatusRow {
  text: string;
  tag: string;
}

interface StatusBoardData {
  now?: StatusRow[];
  recently?: StatusRow[];
}

interface LaneItem {
  name: string;
  what: string;
  repo?: string | null;
}

interface BuildLanesData {
  live?: LaneItem[];
  building?: LaneItem[];
  next?: LaneItem[];
}

interface ShoutoutsData {
  note?: string;
  items?: ShoutItem[];
}

interface FocusItem {
  k?: string;
  color?: string;
  text?: string;
}

interface NowData {
  focus?: FocusItem[];
}

/* ---------- Build lanes (static, server rendered) ---------- */
const Lane = ({ kind, label, items }: { kind: string; label: string; items: LaneItem[] }) => (
  <div className="cc-card">
    <div className="cc-lane-head">
      <span className={`cc-lane-dot ${kind}`} />
      <span className="cc-lane-title">{label}</span>
      <span className="cc-lane-count">{items.length}</span>
    </div>
    {items.map((it) => {
      const Inner = (
        <>
          <span className="cc-prod-name">
            {it.name}
            {it.repo && <span className="cc-arrow">↗</span>}
          </span>
          <span className="cc-prod-what">{it.what}</span>
        </>
      );
      return it.repo ? (
        <a key={it.name} className="cc-prod" href={it.repo} target="_blank" rel="noreferrer">
          {Inner}
        </a>
      ) : (
        <div key={it.name} className="cc-prod">
          {Inner}
        </div>
      );
    })}
  </div>
);

export default function CommandPage() {
  const brand = DH.brand;
  const journey = Array.isArray(DH.journey) ? DH.journey : [];
  const sb = (DH.status_board || {}) as unknown as StatusBoardData;
  const lanes = (DH.build_lanes || {}) as unknown as BuildLanesData;
  const shoutouts = (DH.shoutouts || {}) as unknown as ShoutoutsData;
  const nowData = (DH.now || {}) as unknown as NowData;
  const companies = Array.isArray(DH.companies) ? DH.companies : [];

  const heatJourney: HeatJourneyEntry[] = journey.map((e) => ({
    date: e.date,
    day: e.day,
    shipping_now: e.shipping_now,
    arc_color: e.arc_color,
  }));
  const constCompanies: ConstellationCompany[] = companies.map((c) => ({
    name: c.name,
    desc: c.desc,
    tag: c.tag,
    products: c.products,
  }));
  const j0 = journey[0] ? { day: journey[0].day, shipping_now: journey[0].shipping_now } : {};
  const termLanes = {
    live: (lanes.live || []).map((x) => ({ name: x.name })),
    building: (lanes.building || []).map((x) => ({ name: x.name })),
  };

  return (
    <div className="cc-main">
      <CommandHero
        todayDay={brand.today_day}
        entriesLogged={journey.length}
        companiesCount={companies.length}
        weekliesShipped={DH.weekly_narratives_count || 0}
      />

      <section className="cc-section">
        <div className="cc-sec-head">
          <h2 className="cc-sec-title">Status board</h2>
          <span className="cc-badge live">now</span>
          <span className="cc-sec-note">what has my attention this week</span>
        </div>
        <div className="cc-grid-2">
          <div className="cc-card">
            <p className="cc-card-k">
              <span className="cc-lane-dot live" /> in motion
            </p>
            {(sb.now || []).map((r, i) => (
              <div key={i} className="cc-feed-row">
                <span className="cc-feed-tag">{r.tag}</span>
                <p className="cc-feed-text">{r.text}</p>
              </div>
            ))}
          </div>
          <div className="cc-card">
            <p className="cc-card-k">
              <span className="cc-lane-dot next" /> just shipped
            </p>
            {(sb.recently || []).slice(0, 5).map((r, i) => (
              <div key={i} className="cc-feed-row">
                <span className="cc-feed-tag">{r.tag}</span>
                <p className="cc-feed-text">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cc-section">
        <div className="cc-sec-head">
          <h2 className="cc-sec-title">The build</h2>
          <span className="cc-sec-note">the champ suite · live, building, and next up</span>
        </div>
        <div className="cc-grid-3">
          <Lane kind="live" label="live now" items={lanes.live || []} />
          <Lane kind="building" label="building" items={lanes.building || []} />
          <Lane kind="next" label="next up" items={lanes.next || []} />
        </div>
      </section>

      <Heatmap journey={heatJourney} todayDate={brand.today_date} />
      <GitHubCal />
      <Constellation companies={constCompanies} />
      <LiveRepos />
      <Shoutouts items={shoutouts.items || []} note={shoutouts.note || ""} />
      <Terminal
        brandDay={brand.today_day}
        j0={j0}
        companies={companies.map((c) => c.name)}
        lanes={termLanes}
        nowFocus={nowData.focus || []}
      />

      <section className="cc-cta">
        <h2>Want the same operating system for your company?</h2>
        <p>This is what shipping in public looks like. If it is useful, let us build you one.</p>
        <div className="cc-cta-row">
          <a className="dh-btn dh-btn-primary" href="https://scheduler.zoom.us/sreedeep" target="_blank" rel="noreferrer">
            Book a call →
          </a>
          <Link className="dh-btn dh-btn-ghost" href="/toolkit">
            See the full toolkit
          </Link>
        </div>
      </section>

      {/* Flair libraries (CDN, optional). Same set command.html loaded, minus
          rough-notation, whose Annotate helper the legacy page never rendered.
          Each client component waits briefly for its global, then falls back. */}
      <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.net.min.js" strategy="afterInteractive" />
      <Script src="https://unpkg.com/force-graph@1.43.5/dist/force-graph.min.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/typed.js@2.1.0/dist/typed.umd.js" strategy="afterInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.4/dist/confetti.browser.min.js" strategy="afterInteractive" />
    </div>
  );
}
