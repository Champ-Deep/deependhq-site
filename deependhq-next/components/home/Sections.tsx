// Sections : server-rendered home sections. Ports of ShippingNow, HowIThink,
// Ecosystem, Proof, TheStack, SecondCTA plus the v4 NextStep banner.

import Link from "next/link";
import { DH, type JourneyEntry as JourneyEntryType } from "@/lib/data";

// Legacy hrefs occasionally live in content.json (takes, narrative slugs).
const mapLegacyHref = (href?: string): string => {
  if (!href) return "/writing";
  if (href.startsWith("post.html?slug=")) return `/writing/${href.split("=")[1]}`;
  if (href === "writing.html") return "/writing";
  if (href.endsWith(".html")) return "/" + href.replace(/\.html$/, "").replace(/^index$/, "");
  return href;
};

const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
};

// ---------- journey entry card (shared with ShippingNow) ----------

export function JourneyEntryCard({ entry, dense = false }: { entry: JourneyEntryType; dense?: boolean }) {
  const thread = typeof entry.yesterday_thread === "string" ? entry.yesterday_thread : null;
  return (
    <article className={`dh-entry dh-arc-${entry.arc_color}`}>
      <div className="dh-entry-body">
        <div className="dh-entry-row-top">
          <span className={`dh-day dh-day-${entry.arc_color}`}>DAY {entry.day}</span>
          <span className="dh-entry-date">{formatDate(entry.date)}</span>
        </div>
        <div className="dh-entry-ship">
          <span className="dh-gt">&gt;_</span>
          {entry.shipping_now}
        </div>
        {!dense && thread && (
          <div className="dh-entry-thread">
            <em>{thread}</em>
          </div>
        )}
        {!dense && entry.raw_thought && <div className="dh-entry-thought">{entry.raw_thought}</div>}
        <div className="dh-entry-tags">
          {(entry.arcs || []).map((a) => {
            const link = (entry.company_links || []).find((l) => l.arc === a && l.slug);
            const cls = `dh-pill dh-pill-${entry.arc_color}`;
            return link && link.slug ? (
              <Link key={a} className={cls} href={`/company/${link.slug}`}>
                {a}
              </Link>
            ) : (
              <span key={a} className={cls}>
                {a}
              </span>
            );
          })}
        </div>
      </div>
      <div className="dh-entry-side">
        <span className="dh-mood" title="mood">
          {typeof entry.mood === "string" ? entry.mood : ""}
        </span>
      </div>
    </article>
  );
}

// ---------- shipping now ----------

export function ShippingNow() {
  const entries = DH.journey.slice(0, 3);
  return (
    <section id="now" data-screen-label="shipping-now" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow">
            <span className="dh-eyebrow-dot dh-eyebrow-dot-green" /> Shipping now
          </div>
          <h2 className="dh-section-title">What&apos;s on the build queue today.</h2>
        </div>
        <Link className="dh-section-link" href="/journey">
          Full journey
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div className="dh-feed">
        {entries.map((e) => (
          <JourneyEntryCard key={e.day} entry={e} />
        ))}
      </div>
    </section>
  );
}

// ---------- how i think ----------

interface Take {
  title: string;
  hook: string;
  tag: string;
  color: string;
  href?: string;
}

export function HowIThink() {
  const takes = DH.takes as unknown as Take[];
  return (
    <section id="think" data-screen-label="how-i-think" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow">
            <span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> How I think
          </div>
          <h2 className="dh-section-title">Short takes. No five-tip listicles.</h2>
        </div>
        <Link className="dh-section-link" href="/writing">
          All essays
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <div className="dh-takes">
        {takes.map((t, i) => (
          <article key={i} className={`dh-take dh-take-${t.color}`}>
            <div className={`dh-take-tag dh-take-tag-${t.color}`}>{t.tag}</div>
            <h3 className="dh-take-title">{t.title}</h3>
            <p className="dh-take-body">{t.hook}</p>
            <Link className={`dh-take-link dh-take-link-${t.color}`} href={mapLegacyHref(t.href)}>
              Read the long form →
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

// ---------- ecosystem ----------

export function Ecosystem() {
  return (
    <section id="ecosystem" data-screen-label="ecosystem" className="dh-section">
      <div className="dh-section-head">
        <div>
          <div className="dh-eyebrow">
            <span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> The ecosystem
          </div>
          <h2 className="dh-section-title">Twelve companies. One operator.</h2>
          <p className="dh-section-sub">Scope, not bragging. Each one earns its place in the vault.</p>
        </div>
      </div>
      <div className="dh-companies">
        {DH.companies.map((c) => (
          <Link key={c.name} className="dh-company" href={`/company/${c.slug}`}>
            <div className="dh-company-head">
              <h3 className="dh-company-name">{c.name}</h3>
              <span className="dh-company-arrow">→</span>
            </div>
            <p className="dh-company-desc">{c.desc}</p>
            <div className="dh-company-foot">
              <span className="dh-pill dh-pill-gold">{c.tag}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ---------- proof ----------

export function Proof() {
  const lines = DH.proof as unknown as string[];
  return (
    <section id="proof" data-screen-label="proof" className="dh-section dh-section-proof">
      <div className="dh-eyebrow">
        <span className="dh-eyebrow-dot dh-eyebrow-dot-gold" /> Proof
      </div>
      <h2 className="dh-proof-title">Receipts, not testimonials.</h2>
      <ul className="dh-proof-list">
        {lines.map((line, i) => (
          <li key={i} className="dh-proof-line">
            <span className="dh-proof-mark">★</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- the stack (colophon) ----------

export function TheStack() {
  return (
    <section id="stack" data-screen-label="the-stack" className="dh-section dh-section-stack">
      <div className="dh-stack-frame">
        <div className="dh-stack-rail">
          <span className="dh-stack-rail-dot dh-stack-rail-dot-red" />
          <span className="dh-stack-rail-dot dh-stack-rail-dot-amber" />
          <span className="dh-stack-rail-dot dh-stack-rail-dot-green" />
          <span className="dh-stack-rail-title">~/deependhq/about-this-site.md</span>
        </div>
        <div className="dh-stack-body">
          <div className="dh-stack-intro">
            <div className="dh-eyebrow">
              <span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> The colophon
            </div>
            <h2 className="dh-stack-title">How this site is built.</h2>
            <p className="dh-stack-lede">
              No frameworks chosen for the resume. Every layer earns its place. The whole thing rebuilds
              on every push to main.
            </p>
          </div>
          <dl className="dh-stack-list">
            {DH.stack.map((row) => (
              <div key={row.layer} className="dh-stack-row">
                <dt className="dh-stack-layer">{row.layer}</dt>
                <dd className="dh-stack-what">{row.what}</dd>
              </div>
            ))}
          </dl>
          <div className="dh-stack-foot">
            <span className="dh-mono dh-muted">last build:</span>
            <span className="dh-mono">
              {new Date(DH.built).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {" · next build · the pipeline still ships nightly"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- second cta (weekly narrative + book) ----------

interface Narrative {
  title: string;
  body: string;
  date: string;
  read: string;
  day_range?: string;
  week?: number;
  slug?: string;
}

export function SecondCTA() {
  const n = DH.latest_narrative as unknown as Narrative | undefined;
  if (!n) return null;
  return (
    <section id="book" data-screen-label="second-cta" className="dh-section dh-section-pull">
      <div className="dh-pull-grid">
        <article className="dh-pull-narrative">
          <div className="dh-eyebrow">
            <span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> Latest weekly narrative
          </div>
          <h3 className="dh-pull-narr-title">{n.title}</h3>
          <p className="dh-pull-narr-body">{n.body}</p>
          <div className="dh-pull-narr-meta">
            <span>{n.date}</span>
            <span className="dh-dot-sep">·</span>
            <span>{n.read}</span>
            {n.day_range && (
              <>
                <span className="dh-dot-sep">·</span>
                <span>{n.day_range}</span>
              </>
            )}
            {n.week && (
              <>
                <span className="dh-dot-sep">·</span>
                <span>
                  week {n.week} of {DH.weekly_narratives_count}
                </span>
              </>
            )}
          </div>
          <Link className="dh-link" href={n.slug ? `/writing/${n.slug}` : "/writing"}>
            Read the narrative →
          </Link>
        </article>
        <aside className="dh-pull-cta">
          <h3 className="dh-pull-title">Want 30 minutes?</h3>
          <p className="dh-pull-sub">
            For founders and operators thinking past the hype cycle. No discovery calls. No sales decks. A
            real conversation.
          </p>
          <a className="dh-btn dh-btn-primary dh-btn-lg" href="/cta?from=pull" target="_blank" rel="noopener">
            Book a call
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <div className="dh-pull-cta-foot">
            <span className="dh-mono dh-muted">{DH.brand.booking_url}</span>
          </div>
        </aside>
      </div>
    </section>
  );
}

// ---------- next step banner ----------

export function NextStep() {
  return (
    <Link className="dh6-nextstep" href="/journey">
      <span className="dh6-nextstep-label">&gt;_ next step: start with what I shipped today</span>
      <span className="dh6-nextstep-arrow">→</span>
    </Link>
  );
}
