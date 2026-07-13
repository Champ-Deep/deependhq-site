// /field-notes : the wiki page. Server port of FieldNotesPage.jsx. All six
// sections render on the server; the rail's scroll progress and scrollspy
// table of contents are client islands from components/client/Rail.tsx.

import type { Metadata } from "next";
import Link from "next/link";
import { DH } from "@/lib/data";
import { RailProgress, RailTocSpy } from "@/components/client/Rail";

// These collections are loosely typed (unknown[]) in DHData; local shapes
// verified against content.json, cast once below.
interface FieldTool {
  name: string;
  kind: string;
  what: string;
}

interface Plotline {
  title: string;
  status: string;
  since: number;
  desc: string;
}

interface LexiconEntry {
  term: string;
  def: string;
}

interface LocationEntry {
  name: string;
  where: string;
  what: string;
}

interface CallbackEntry {
  from: number;
  to: number;
  text: string;
  target: string;
}

const PLOT_STATUS: Record<string, { color: string; glyph: string }> = {
  "Rising Action": { color: "blue", glyph: "↗" },
  "Climax": { color: "gold", glyph: "★" },
  "Resolution": { color: "green", glyph: "✓" },
  "Dormant": { color: "muted", glyph: "⏸" },
};

const FN_SECTIONS = [
  { id: "tools", label: "Tools" },
  { id: "plotlines", label: "Plot lines" },
  { id: "themes", label: "Themes" },
  { id: "lexicon", label: "Lexicon" },
  { id: "locations", label: "Locations" },
  { id: "callbacks", label: "Callbacks" },
];

export const metadata: Metadata = {
  title: "Field Notes",
  description: "The tools, arcs, and themes of building 12 companies in public.",
};

export default function FieldNotesPage() {
  const D = DH;
  const tools = (D.tools as unknown as FieldTool[]) || [];
  const plotlines = D.plotlines as unknown as Plotline[];
  const themes = D.themes as unknown as string[];
  const lexicon = D.lexicon as unknown as LexiconEntry[];
  const locations = D.locations as unknown as LocationEntry[];
  const callbacks = D.callbacks as unknown as CallbackEntry[];

  const counts: Record<string, number> = {
    tools: tools.length, plotlines: plotlines.length, themes: themes.length,
    lexicon: lexicon.length, locations: locations.length, callbacks: callbacks.length,
  };

  return (
    <div className="dh-page">
      <header className="dh-page-head">
        <div className="dh-eyebrow"><span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> Field notes</div>
        <h1 className="dh-page-title">Field Notes.</h1>
        <p className="dh-page-sub">The tools, arcs, and themes of building 12 companies in public.</p>
        <p className="dh-page-meta dh-mono">a wiki, not a blog · last revised day {D.brand.today_day}</p>
      </header>

      {/* mobile: keep the simple TOC */}
      <nav className="dh-toc dh-rail-mobile-only">
        {FN_SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
      </nav>

      <div className="dh-rail-layout">
      <div>
      {/* Tools, the systems and agents that run the operation. People stay in the vault, not on the public site. */}
      <section id="tools" className="dh-wiki-section">
        <h2 className="dh-wiki-title">Tools</h2>
        <p className="dh-wiki-lede">The systems and agents I use to operate. People stay in the vault. Tools go on the site.</p>
        <div className="dh-loc-grid">
          {tools.map((t) => (
            <article key={t.name} className="dh-loc">
              <div className="dh-loc-head">
                <h3 className="dh-loc-name">{t.name}</h3>
                <span className="dh-loc-where">{t.kind}</span>
              </div>
              <p className="dh-loc-what">{t.what}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Plot lines */}
      <section id="plotlines" className="dh-wiki-section">
        <h2 className="dh-wiki-title">Plot lines</h2>
        <p className="dh-wiki-lede">Active project arcs with narrative status.</p>
        <ul className="dh-plot-list">
          {plotlines.map((p) => {
            const s = PLOT_STATUS[p.status];
            return (
              <li key={p.title} className={`dh-plot dh-plot-${s.color}`}>
                <div className="dh-plot-left">
                  <span className={`dh-plot-glyph dh-plot-glyph-${s.color}`}>{s.glyph}</span>
                  <span className={`dh-plot-status dh-plot-status-${s.color}`}>{p.status}</span>
                </div>
                <div className="dh-plot-body">
                  <div className="dh-plot-row">
                    <h3 className="dh-plot-title">{p.title}</h3>
                    <span className="dh-plot-since">since <span className="dh-mono">day {p.since}</span></span>
                  </div>
                  <p className="dh-plot-desc">{p.desc}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Themes */}
      <section id="themes" className="dh-wiki-section">
        <h2 className="dh-wiki-title">Themes</h2>
        <p className="dh-wiki-lede">Recurring patterns across entries.</p>
        <ul className="dh-themes">
          {themes.map((t, i) => {
            const [head, ...rest] = t.split(".");
            return (
              <li key={i} className="dh-theme">
                <span className="dh-theme-num">{String(i + 1).padStart(2, "0")}</span>
                <div className="dh-theme-body">
                  <h3 className="dh-theme-head">{head}.</h3>
                  <p className="dh-theme-rest">{rest.join(".").trim()}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Lexicon */}
      <section id="lexicon" className="dh-wiki-section">
        <h2 className="dh-wiki-title">Lexicon</h2>
        <p className="dh-wiki-lede">A small dictionary, for new readers and future me.</p>
        <dl className="dh-lex">
          {lexicon.map((l) => (
            <div key={l.term} className="dh-lex-row">
              <dt className="dh-lex-term"><span className="dh-gt">&gt;_</span>{l.term}</dt>
              <dd className="dh-lex-def">{l.def}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Locations */}
      <section id="locations" className="dh-wiki-section">
        <h2 className="dh-wiki-title">Locations</h2>
        <p className="dh-wiki-lede">Places that keep showing up. Geography is character.</p>
        <div className="dh-loc-grid">
          {locations.map((p) => (
            <article key={p.name} className="dh-loc">
              <div className="dh-loc-head">
                <h3 className="dh-loc-name">{p.name}</h3>
                <span className="dh-loc-where">{p.where}</span>
              </div>
              <p className="dh-loc-what">{p.what}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Callbacks */}
      <section id="callbacks" className="dh-wiki-section">
        <h2 className="dh-wiki-title">Callbacks</h2>
        <p className="dh-wiki-lede">Cross-references connecting today&apos;s insight to past entries.</p>
        <ul className="dh-callbacks">
          {callbacks.map((cb, i) => (
            <li key={i} className="dh-callback">
              <div className="dh-cb-end">
                <span className="dh-day dh-day-green">DAY {cb.from}</span>
                <span className="dh-cb-text">{cb.text}</span>
              </div>
              <div className="dh-cb-link" aria-hidden="true">
                <span className="dh-cb-dots" />
                <span className="dh-cb-arrow">→</span>
                <span className="dh-cb-dots" />
              </div>
              <div className="dh-cb-end dh-cb-end-r">
                <span className="dh-day dh-day-blue">DAY {cb.to}</span>
                <span className="dh-cb-text">{cb.target}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      </div>

      <aside className="dh-rail" aria-label="field notes context">
        <RailProgress />
        <RailTocSpy items={FN_SECTIONS.map((s) => ({ ...s, count: counts[s.id] }))} />
        <div className="dh-rail-block">
          <p className="dh-rail-k">Plot status key</p>
          <ul className="dh-rail-legend">
            <li><span className="dh-rail-swatch dh-rail-swatch-blue" />↗ rising action</li>
            <li><span className="dh-rail-swatch dh-rail-swatch-gold" />★ climax</li>
            <li><span className="dh-rail-swatch dh-rail-swatch-green" />✓ resolution</li>
            <li><span className="dh-rail-swatch dh-rail-swatch-muted" />⏸ dormant</li>
          </ul>
        </div>
        <div className="dh-rail-block">
          <p className="dh-rail-k">Cross-links</p>
          <ul className="dh-rail-nav">
            <li><Link href="/journey">The journey →</Link></li>
            <li><Link href="/writing">The writing →</Link></li>
            <li><Link href="/toolkit">The toolkit →</Link></li>
          </ul>
        </div>
      </aside>
      </div>
    </div>
  );
}
