// /now : a snapshot of what has Sreedeep's attention right now. Server port
// of NowPage.jsx. Data-driven from DH.now (focus), DH.status (the basics),
// and DH.off_hours. Only the rail's live pieces are client components.

import type { Metadata } from "next";
import Link from "next/link";
import { DH } from "@/lib/data";
import { RailProgress, RailTocSpy } from "@/components/client/Rail";

interface NowFocus {
  k: string;
  text: string;
  color?: string;
}

interface NowData {
  updated?: string;
  note?: string;
  focus?: NowFocus[];
}

export const metadata: Metadata = {
  title: "Now",
  description: "What Sreedeep Surapaneni is working on right now. A snapshot, not a feed.",
};

export default function NowPage() {
  const D = DH;
  const now = (D.now as unknown as NowData) || { focus: [], note: "" };
  const focus = now.focus || [];
  const s = D.status || {};

  const rows: [string, string | undefined][] = [
    ["Location", s.location],
    ["Local time", s.time_ist],
    ["Reading", s.reading],
    ["Listening", s.listening],
    ["Drinking", s.drinking],
    ["Last ship", s.last_ship],
  ];
  const basics = rows.filter((row): row is [string, string] => Boolean(row[1]));

  const prettyUpdated = (() => {
    if (!now.updated) return null;
    const [y, m, d] = now.updated.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
  })();

  return (
    <div className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> Now</div>
        <h1 className="dh-page-title">What I&apos;m doing now.</h1>
        <p className="dh-page-sub">A snapshot, not a feed. The honest answer to &quot;what are you working on?&quot;</p>
      </header>

      <div className="dh-rail-layout">
      <div>
        {now.note && <p className="dh-now-note">{now.note}</p>}

        <div className="dh-now-grid" id="focus">
          {focus.map((f, i) => (
            <article key={i} className={`dh-now-card dh-now-${f.color || "muted"}`}>
              <p className="dh-now-k">{f.k}</p>
              <p className="dh-now-text">{f.text}</p>
            </article>
          ))}
        </div>

        {Array.isArray(D.off_hours) && D.off_hours.length > 0 && (
          <section id="offclock">
            <p className="dh-now-subhead">Off the clock</p>
            <div className="dh-now-grid">
              {D.off_hours.map((o, i) => (
                <article key={i} className="dh-now-card dh-now-muted">
                  <p className="dh-now-k">{o.what}</p>
                  <p className="dh-now-text">{o.detail}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <dl className="dh-now-basics" id="basics">
          {basics.map(([label, value]) => (
            <div key={label} className="dh-now-basic">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {prettyUpdated && (
          <p className="dh-now-updated"><span className="dh-gt">&gt;_</span>last updated {prettyUpdated} · this page is inspired by the /now movement</p>
        )}
      </div>

      <aside className="dh-rail" aria-label="now context">
        <RailProgress />
        <RailTocSpy
          items={[
            { id: "focus", label: "In focus", count: focus.length },
            { id: "offclock", label: "Off the clock", count: (D.off_hours || []).length },
            { id: "basics", label: "The basics" },
          ]}
        />
        <div className="dh-rail-block">
          <p className="dh-rail-k">Live strip</p>
          <ul className="dh-rail-legend">
            <li><span className="dh-rail-swatch dh-rail-swatch-green" />{s.state || "shipping"}</li>
            {s.last_ship && <li><span className="dh-rail-swatch dh-rail-swatch-gold" />{s.last_ship}</li>}
            {s.location && <li><span className="dh-rail-swatch dh-rail-swatch-blue" />{s.location}</li>}
          </ul>
        </div>
        <div className="dh-rail-block">
          <p className="dh-rail-k">Go deeper</p>
          <ul className="dh-rail-nav">
            <li><Link href="/journey">today&apos;s entry →</Link></li>
            <li><Link href="/writing">weekly narratives →</Link></li>
          </ul>
        </div>
      </aside>
      </div>
    </div>
  );
}
