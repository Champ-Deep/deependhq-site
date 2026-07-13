// /writing : the long-form index. Server port of WritingPage.jsx. Lists
// DH.posts, newest first, with the "reads into" company cross-links.

import type { Metadata } from "next";
import Link from "next/link";
import { DH } from "@/lib/data";

// Posts carry kind/week/deck beyond the base Post type; cast once below.
interface WritingPost {
  slug: string;
  title: string;
  date: string;
  read?: string;
  kind?: string;
  week?: number;
  deck?: string;
  related_companies?: { name: string; slug: string; tag: string }[];
}

export const metadata: Metadata = {
  title: "Writing",
  description: "Long-form writing by Sreedeep Surapaneni. Weekly narratives and hot takes on building 12 companies in public.",
};

const fmtPostDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

export default function WritingPage() {
  const posts = ((DH.posts as unknown as WritingPost[]) || [])
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> Writing</div>
        <h1 className="dh-page-title">Writing.</h1>
        <p className="dh-page-sub">Long-form. Weekly narratives and the occasional hot take. Written, not generated.</p>
        <div className="dh-page-meta">
          <span className="dh-mono">{posts.length} pieces</span>
          <span className="dh-dot-sep">·</span>
          <Link className="dh-link" href="/journey">The daily journey →</Link>
        </div>
      </header>

      <div className="dh-narrow">
        <div className="dh-writing-list">
          {posts.map((p) => (
            <div key={p.slug} className="dh-writing-item">
              <Link className="dh-writing-row" href={`/writing/${encodeURIComponent(p.slug)}`}>
                <div>
                  <span className="dh-writing-kind">{p.kind === "weekly" ? `weekly · week ${p.week}` : "essay"}</span>
                  <h2 className="dh-writing-title">{p.title}</h2>
                  <p className="dh-writing-deck">{p.deck}</p>
                </div>
                <div className="dh-writing-meta">
                  {fmtPostDate(p.date)}<br />
                  {p.read}
                </div>
              </Link>
              {(p.related_companies || []).length > 0 && (
                <div className="dh-writing-cos">
                  <span className="dh-writing-cos-k">reads into</span>
                  {(p.related_companies || []).map((rc) => (
                    <Link key={rc.slug} className="dh-pill dh-pill-gold" href={`/company/${encodeURIComponent(rc.slug)}`}>{rc.name}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="bp-empty"><span className="dh-gt">&gt;_</span>nothing published yet. Soon.</div>
        )}
      </div>
    </div>
  );
}
