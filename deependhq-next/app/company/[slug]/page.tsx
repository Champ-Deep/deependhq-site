// /company/[slug] : one company in the ecosystem. Server port of
// CompanyPage.jsx, replacing company.html?slug=X. Renders the journey
// cross-links, related writing, and products. The prominent external CTA is
// the deliberate "go see their real site" moment. Unknown slug -> notFound().

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DH, type Company, type RelatedJourney } from "@/lib/data";

// The company url field lives under the index signature; cast once below.
type CompanyWithUrl = Company & { url?: string };

const fmtCoDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

// Compact journey card, styled off the homepage JourneyEntry visual language.
const CompanyJourneyCard = ({ entry }: { entry: RelatedJourney }) => (
  <article className={`dh-entry dh-arc-${entry.arc_color || "green"}`}>
    <div className="dh-entry-body">
      <div className="dh-entry-row-top">
        <span className={`dh-day dh-day-${entry.arc_color || "green"}`}>DAY {entry.day}</span>
        <span className="dh-entry-date">{fmtCoDate(entry.date)}</span>
      </div>
      <div className="dh-entry-ship"><span className="dh-gt">&gt;_</span>{entry.shipping_now}</div>
    </div>
  </article>
);

export function generateStaticParams() {
  return DH.companies.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const company = DH.companies.find((c) => c.slug === slug);
  if (!company) return { title: "Company" };
  return {
    title: company.name,
    description: company.desc || "One of the twelve companies in Sreedeep Surapaneni's ecosystem.",
  };
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const companies = (DH.companies as unknown as CompanyWithUrl[]) || [];
  const company = companies.find((c) => c.slug === slug);
  if (!company) notFound();

  const journey = company.related_journey || [];
  const writing = company.related_writing || [];
  const products = company.products || [];

  return (
    <div className="dh-page">
      <article className="bp-page">
        <div className="bp-toprow">
          <Link className="bp-back" href="/#ecosystem">&larr; the ecosystem</Link>
        </div>

        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> In the ecosystem</div>
        <h1 className="bp-title">{company.name}</h1>
        <div className="bp-tags">
          <span className="dh-pill dh-pill-gold">{company.tag}</span>
        </div>
        {company.desc && <p className="bp-deck">{company.desc}</p>}

        {company.url && (
          <a className="dh-co-cta" href={company.url} target="_blank" rel="noreferrer">
            <span className="dh-co-cta-label">Check out {company.name}</span>
            <span className="dh-co-cta-arrow">↗</span>
          </a>
        )}

        {products.length > 0 && (
          <section className="dh-co-block">
            <h2 className="bp-h2">Products</h2>
            <div className="bp-tags">
              {products.map((p) => <span key={p} className="dh-pill dh-pill-muted">{p}</span>)}
            </div>
          </section>
        )}

        <section className="dh-co-block">
          <h2 className="bp-h2">In the journey</h2>
          {journey.length > 0 ? (
            <div className="dh-co-feed">
              {journey.map((e) => <CompanyJourneyCard key={e.day} entry={e} />)}
              <Link className="dh-link dh-co-more" href="/journey">All field notes →</Link>
            </div>
          ) : (
            <div className="bp-empty"><span className="dh-gt">&gt;_</span>no field notes tagged to {company.name} yet.</div>
          )}
        </section>

        <section className="dh-co-block">
          <h2 className="bp-h2">Related writing</h2>
          {writing.length > 0 ? (
            <div className="dh-writing-list">
              {writing.map((w) => (
                <Link key={w.slug} className="dh-writing-row" href={`/writing/${encodeURIComponent(w.slug)}`}>
                  <div>
                    <h3 className="dh-writing-title">{w.title}</h3>
                  </div>
                  <div className="dh-writing-meta">
                    {fmtCoDate(w.date)}<br />
                    {w.read}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bp-empty"><span className="dh-gt">&gt;_</span>no writing linked to {company.name} yet.</div>
          )}
        </section>
      </article>
    </div>
  );
}
