// lib/data.ts
// The typed content layer. Ports scripts/build-data.mjs from the legacy site
// 1:1 so the data shape here is IDENTICAL to what window.DH_DATA used to be.
// Source of truth: repo-root content.json, synced to ./content.gen.json by
// scripts/sync-content.mjs (predev/prebuild). Never edit content.gen.json.

import raw from "@/content.gen.json";

// ---------- Types (pragmatic: strong where components consume, loose elsewhere) ----------

export interface Brand {
  today_day: number;
  today_date: string;
  location: string;
  booking_url: string;
}

export interface CompanyLink {
  arc: string;
  company_name: string | null;
  slug: string | null;
}

export interface JourneyEntry {
  day: number;
  date: string;
  shipping_now: string;
  raw_thought?: string;
  arcs?: string[];
  arc_color?: string;
  github_commits?: number;
  mood?: string;
  lines?: string[];
  company_links?: CompanyLink[];
  [k: string]: unknown;
}

export interface RelatedJourney {
  day: number;
  date: string;
  shipping_now: string;
  arc_color?: string;
}

export interface RelatedWriting {
  slug: string;
  title: string;
  date: string;
  read?: string;
}

export interface Company {
  name: string;
  desc: string;
  tag: string;
  products?: string[];
  slug: string;
  related_journey: RelatedJourney[];
  related_writing: RelatedWriting[];
  [k: string]: unknown;
}

export interface Post {
  slug: string;
  title: string;
  date: string;
  read?: string;
  arc?: string;
  tags?: string[];
  summary?: string;
  excerpt?: string;
  subtitle?: string;
  body?: unknown;
  related_companies?: { name: string; slug: string; tag: string }[];
  [k: string]: unknown;
}

export interface DHData {
  brand: Brand;
  companies: Company[];
  arc_map: Record<string, string | null>;
  journey: JourneyEntry[];
  now: Record<string, unknown>;
  takes: unknown[];
  proof: Record<string, unknown> | unknown[];
  weekly_narratives_count: number;
  latest_narrative?: Record<string, unknown>;
  status: Record<string, string>;
  status_board: unknown[];
  stack: { layer: string; what: string }[];
  off_hours: { what: string; detail: string }[];
  rolodex: { who: string; how: string }[];
  dispatch: Record<string, unknown>;
  lexicon: unknown[];
  locations: unknown[];
  toolkit: Record<string, unknown> | unknown[];
  tools: unknown[];
  plotlines: unknown[];
  themes: unknown[];
  callbacks: unknown[];
  posts: Post[];
  build_lanes: Record<string, unknown> | unknown[];
  shoutouts: unknown[];
  built: string;
  [k: string]: unknown;
}

// ---------- Transform (verbatim port of build-data.mjs) ----------

const deDash = (s: string) => s.replace(/\s*[—–]\s*/g, ", ").replace(/[—–]/g, ", ");

function scrub<T>(o: T): T {
  if (Array.isArray(o)) return o.map(scrub) as T;
  if (o && typeof o === "object")
    return Object.fromEntries(Object.entries(o as Record<string, unknown>).map(([k, v]) => [k, scrub(v)])) as T;
  return (typeof o === "string" ? deDash(o) : o) as T;
}

const kebab = (s: unknown) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\./g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const truncate = (s: unknown, n: number) => {
  const str = String(s || "");
  if (str.length <= n) return str;
  return str.slice(0, n).replace(/\s+\S*$/, "") + "…";
};

function build(): DHData {
  // _meta is editor-only context. Never ship it.
  const { _meta, ...rest } = raw as Record<string, unknown>;
  const data = scrub(rest) as unknown as DHData;

  // Journey newest-first; keep brand pointer aligned to newest entry.
  if (Array.isArray(data.journey)) {
    data.journey.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    if (data.journey[0] && data.brand) {
      data.brand.today_date = data.journey[0].date;
      data.brand.today_day = data.journey[0].day;
    }
  }

  // Content relationship engine (cross-links), same semantics as build-data.mjs.
  const companies = Array.isArray(data.companies) ? data.companies : [];
  const journey = Array.isArray(data.journey) ? data.journey : [];
  const posts = Array.isArray(data.posts) ? data.posts : [];
  const arcMap = data.arc_map && typeof data.arc_map === "object" ? data.arc_map : {};

  const byName = new Map(companies.map((c) => [c.name, c]));
  const slugByName = new Map<string, string>();
  for (const c of companies) {
    c.slug = kebab(c.name);
    slugByName.set(c.name, c.slug);
  }

  // Product-name resolution: an arc like "ChampMail" or "Lake Stream" maps to
  // the company whose products list carries it. This is what keeps every
  // company's page and card alive even when arc_map has no explicit entry.
  const productByName = new Map<string, string>();
  for (const c of companies) {
    const prods = Array.isArray(c.products) ? c.products : [];
    for (const p of prods) {
      const key = p.toLowerCase();
      if (!productByName.has(key)) productByName.set(key, c.name);
    }
  }

  const resolveArc = (label: string | null | undefined): string | null => {
    if (label == null) return null;
    if (Object.prototype.hasOwnProperty.call(arcMap, label)) return arcMap[label];
    if (byName.has(label)) return label;
    const viaProduct = productByName.get(label.toLowerCase());
    if (viaProduct) return viaProduct;
    return null;
  };

  for (const c of companies) {
    c.related_journey = [];
    c.related_writing = [];
  }

  for (const e of journey) {
    const arcs = Array.isArray(e.arcs) ? e.arcs : [];
    const links: CompanyLink[] = [];
    const hitCompanies = new Set<string>();
    for (const arc of arcs) {
      const name = resolveArc(arc);
      const slug = name ? slugByName.get(name) || null : null;
      links.push({ arc, company_name: name || null, slug });
      if (name && slugByName.has(name)) hitCompanies.add(name);
    }
    e.company_links = links;
    for (const name of hitCompanies) {
      const c = byName.get(name);
      if (c && c.related_journey.length < 12) {
        c.related_journey.push({
          day: e.day,
          date: e.date,
          shipping_now: truncate(e.shipping_now, 130),
          arc_color: e.arc_color,
        });
      }
    }
  }

  for (const p of posts) {
    const labels = [p.arc, ...(Array.isArray(p.tags) ? p.tags : [])];
    const seen = new Set<string>();
    const rel: { name: string; slug: string; tag: string }[] = [];
    for (const label of labels) {
      const name = resolveArc(label as string | undefined);
      if (!name || !slugByName.has(name) || seen.has(name)) continue;
      seen.add(name);
      const c = byName.get(name)!;
      rel.push({ name, slug: c.slug, tag: c.tag });
      c.related_writing.push({ slug: p.slug, title: p.title, date: p.date, read: p.read });
    }
    p.related_companies = rel;
  }
  for (const c of companies) {
    c.related_writing.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }

  data.built = new Date().toISOString();
  return data;
}

// Computed once per server process / build. Pages are statically generated,
// so this runs at build time, exactly like the old nightly data.js generation.
export const DH: DHData = build();

export const SITE_URL = "https://deependhq.com";
