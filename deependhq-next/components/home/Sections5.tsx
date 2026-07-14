// Sections5 : server ports of the round 5 home sections used by the Home v4
// composition. Ports of LastFive, Companies5, Proof5, WaysIn, Newsletter5
// from Sections5.jsx plus the NextStep helper from Nav5.jsx.
// Data adaptation: railStats() in the legacy kit read D.posts.items for the
// essay count fallback. In this app DH.posts is a flat array, so we use
// DH.posts.length directly.

import Link from "next/link";
import type { ReactNode } from "react";
import { DH } from "@/lib/data";
import { NewsletterForm } from "@/components/client/r6/NewsletterForm";

// Countable facts from DH only. Port of railStats() from Rails.jsx.
function railStats() {
  const j = DH.journey;
  const month = ((j[0] && j[0].date) || "").slice(0, 7);
  const ships = j.filter((e) => e.date && e.date.slice(0, 7) === month).length;
  return {
    days: (DH.brand && DH.brand.today_day) || 0,
    ships,
    companies: DH.companies.length,
    // Legacy: D.weekly_narratives_count || ((D.posts && D.posts.items) || []).length
    essays: DH.weekly_narratives_count || DH.posts.length,
  };
}

// ---- last five days, follows the marquee -------------------------
export function LastFive() {
  const j = DH.journey.slice(0, 5);
  return (
    <section className="dh5-section" data-screen-label="last-five" aria-label="last five days">
      <div className="dh5-section-head">
        <h2>last five days</h2>
        <Link className="muted" href="/journey">full log →</Link>
      </div>
      <div className="dh5-lastfive">
        {j.map((e) => (
          <Link key={e.day} className="dh5-day-card" data-color={e.arc_color} href={`/journey#day-${e.day}`}>
            <span className="d"><b>day {e.day}</b><span>{e.date.slice(5)}</span></span>
            <span className="s">{e.shipping_now}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---- companies grid. compact visual cards: name, tag, product pills,
// activity meter, one-line meta. Every card links to the company page.
export function Companies5() {
  return (
    <section className="dh5-section" data-screen-label="companies" aria-label="the twelve companies">
      <div className="dh5-section-head">
        <h2>12 companies, one operating system</h2>
      </div>
      <div className="dh6r-co-grid">
        {DH.companies.map((c) => {
          const last = c.related_journey[0];
          const filled = Math.min(c.related_journey.length, 8);
          const pills = (c.products || []).slice(0, 4);
          return (
            <Link
              key={c.slug}
              className="dh6r-co-card"
              href={`/company/${c.slug}`}
              data-win={last && last.arc_color === "gold" ? "true" : undefined}
            >
              <div className="dh6r-co-top">
                <h3 className="dh6r-co-name">{c.name}</h3>
                <span className="dh6r-co-tag">{c.tag}</span>
              </div>
              {pills.length > 0 && (
                <div className="dh6r-co-pills">
                  {pills.map((p) => (
                    <span key={p} className="dh6r-pill">{p}</span>
                  ))}
                </div>
              )}
              <div className="dh6r-co-foot">
                <span
                  className="dh6r-meter"
                  role="img"
                  aria-label={`${filled} of 8 recent public log entries`}
                >
                  {Array.from({ length: 8 }, (_, k) => (
                    <i key={k} className={k < filled ? "dh6r-meter-on" : undefined}></i>
                  ))}
                </span>
                <span className="dh6r-co-meta">
                  {last ? `last ship: day ${last.day} · ${last.date}` : c.desc}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

// ---- proof. countable facts from DH only. numbers, no adjectives.
export function Proof5() {
  const s = railStats();
  const facts = [
    { n: s.days, l: "days building in public" },
    { n: s.ships, l: "ships this month" },
    { n: s.companies, l: "companies in motion" },
    { n: s.essays, l: "essays written" },
  ];
  return (
    <section className="dh5-section" data-screen-label="proof" aria-label="proof">
      <div className="dh5-section-head"><h2>proof</h2></div>
      <div className="dh-bento">
        {facts.map((f) => (
          <div key={f.l} className="dh-tile b3">
            <span className="dh5-rail-num"><b>{f.n}</b><span>{f.l}</span></span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- ways in. three cards, one sentence + one CTA each. ----------
interface Way {
  key: string;
  copy: string;
  from: string;
  label: string;
  href?: string;
}

export function WaysIn() {
  const ways: Way[] = [
    { key: "work with the group", copy: "twelve companies covering data, demand, cloud, health, and ip. one intro call finds the right one.", from: "ways-group", label: "book a call" },
    { key: "work with me", copy: "marketing and product leadership, advisory, or a hard problem worth 90 minutes.", from: "ways-me", label: "book a call" },
    { key: "just watch", copy: "the daily log and the weekly narrative. free, no signup wall.", from: "ways-watch", label: "read the journey", href: "/journey" },
  ];
  return (
    <section className="dh5-section dh5-ways" data-screen-label="ways-in" aria-label="ways in">
      <div className="dh5-section-head"><h2>ways in</h2></div>
      <div className="dh-bento">
        {ways.map((w) => (
          <div key={w.key} className="dh-tile b4">
            <span className="dh-tile-key">{w.key}</span>
            <p>{w.copy}</p>
            {w.href ? (
              <Link className="dh5-cta" href={w.href}>{w.label}</Link>
            ) : (
              <a className="dh5-cta" href={"/cta?from=" + w.from}>{w.label}</a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ---- newsletter. single field, inline success. --------------------
// The tile shell stays server rendered; the stateful form lives in the
// NewsletterForm client child.
export function Newsletter5() {
  return (
    <section className="dh5-section" data-screen-label="newsletter" aria-label="newsletter">
      <div className="dh-bento">
        <div className="dh-tile b12">
          <span className="dh-tile-key">the weekly narrative in your inbox</span>
          <p className="muted" style={{ margin: 0 }}>one email, sunday 06:00 ist. what shipped, what broke, what it means.</p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}

// ---- next step. one contextual next-step link at the end of every page.
export function NextStep({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="dh5-next">
      <span className="muted">next: </span>
      <Link href={href}>{children}</Link>
    </div>
  );
}
