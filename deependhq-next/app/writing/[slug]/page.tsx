// /writing/[slug] : a single long-form piece. Server port of PostPage.jsx,
// replacing post.html?slug=X. The article body renders on the server; the
// reading-progress bar and copy-link button are small client islands.
// Unknown slug -> notFound() (the legacy fallback to the newest post is
// intentionally dropped in favor of a proper 404).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DH } from "@/lib/data";
import { ReadingBar, CopyLinkButton } from "@/components/client/PostExtras";

// Posts carry eyebrow/deck/day_range/arc_color and typed body blocks beyond
// the base Post type; cast once below.
interface PostBodyBlock {
  type?: string;
  text?: string;
  head?: string;
  lines?: string[];
}

interface FullPost {
  slug: string;
  title: string;
  date?: string;
  read?: string;
  kind?: string;
  week?: number;
  eyebrow?: string;
  deck?: string;
  day_range?: string;
  arc?: string;
  arc_color?: string;
  tags?: string[];
  body?: PostBodyBlock[];
  related_companies?: { name: string; slug: string; tag: string }[];
}

const allPosts = () =>
  ((DH.posts as unknown as FullPost[]) || [])
    .slice()
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

const fmtPostDateP = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

const PostBlock = ({ block }: { block: PostBodyBlock }) => {
  switch (block.type) {
    case "lede": return <p className="lede">{block.text}</p>;
    case "h2": return <h2 className="bp-h2">{block.text}</h2>;
    case "pull": return <div className="bp-pull">{block.text}</div>;
    case "callout":
      return (
        <div className="bp-callout">
          {block.head && <div className="bp-callout-h">{block.head}</div>}
          <ul className="bp-callout-list">
            {(block.lines || []).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      );
    case "p":
    default: return <p>{block.text}</p>;
  }
};

export function generateStaticParams() {
  return DH.posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = allPosts().find((p) => p.slug === slug);
  if (!post) return { title: "Writing" };
  return {
    title: post.title,
    description: post.deck || "A piece of long-form writing by Sreedeep Surapaneni.",
    openGraph: {
      type: "article",
      title: post.title,
      description: post.deck || "A piece of long-form writing by Sreedeep Surapaneni.",
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const posts = allPosts();
  const idx = posts.findIndex((p) => p.slug === slug);
  if (idx === -1) notFound();
  const post = posts[idx];

  const newer = idx > 0 ? posts[idx - 1] : null; // more recent
  const older = idx < posts.length - 1 ? posts[idx + 1] : null;

  return (
    <div className="dh-page">
      <ReadingBar />
      <article className="bp-page">
        <div className="bp-toprow">
          <Link className="bp-back" href="/writing">&larr; all writing</Link>
          <CopyLinkButton />
        </div>

        {post.eyebrow && <div className="bp-eyebrow">{post.eyebrow}</div>}
        <h1 className="bp-title">{post.title}</h1>
        {post.deck && <p className="bp-deck">{post.deck}</p>}

        <div className="bp-byline">
          <span className="auth">sreedeep surapaneni</span>
          {post.read && <><span className="dh-dot-sep">·</span><span>{post.read}</span></>}
          {post.date && <><span className="dh-dot-sep">·</span><span>{fmtPostDateP(post.date)}</span></>}
          {post.day_range && <><span className="dh-dot-sep">·</span><span>{post.day_range}</span></>}
        </div>

        <div className="bp-prose">
          {(post.body || []).map((b, i) => <PostBlock key={i} block={b} />)}
        </div>

        <div className="bp-tags">
          {post.arc && <span className={`dh-pill dh-pill-${post.arc_color || "blue"}`}>{post.arc}</span>}
          {(post.tags || []).map((t) => <span key={t} className="dh-pill dh-pill-muted">{t}</span>)}
        </div>

        {(post.related_companies || []).length > 0 && (
          <div className="bp-related">
            <span className="bp-related-k"><span className="dh-gt">&gt;_</span>reads into</span>
            <div className="bp-related-pills">
              {(post.related_companies || []).map((rc) => (
                <Link key={rc.slug} className="dh-pill dh-pill-gold" href={`/company/${encodeURIComponent(rc.slug)}`}>{rc.name} →</Link>
              ))}
            </div>
          </div>
        )}

        {(newer || older) && (
          <nav className="bp-prevnext">
            {newer ? (
              <Link className="bp-pn bp-pn-prev" href={`/writing/${encodeURIComponent(newer.slug)}`}>
                <span className="bp-pn-k">&larr; newer</span>
                <span className="bp-pn-t">{newer.title}</span>
              </Link>
            ) : <span />}
            {older ? (
              <Link className="bp-pn bp-pn-next" href={`/writing/${encodeURIComponent(older.slug)}`}>
                <span className="bp-pn-k">older &rarr;</span>
                <span className="bp-pn-t">{older.title}</span>
              </Link>
            ) : <span />}
          </nav>
        )}
      </article>
    </div>
  );
}
