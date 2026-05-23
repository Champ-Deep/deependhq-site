// Central content store for the deependhq.com homepage.
// All copy and structured data lives here so components stay presentational.

export const SCHEDULER_URL = "https://scheduler.zoom.us/sreedeep";

export type ArcColor = "green" | "blue" | "gold";

// ShippingNow entries.
// NOTE: In production these will be fetched live from the EmDash API via
//   GET /api/entries?type=daily_entry&limit=3&sort=date:desc
// For now the homepage renders this static mock data so the build stays
// fully static and dependency-free. No network call is made at build time.
export interface ShippingEntry {
  date: string;
  day: number;
  text: string;
  arc: ArcColor;
}

export const shippingEntries: ShippingEntry[] = [
  {
    date: "2026-05-13",
    day: 193,
    text: "Shipping the design system for deependhq.com. Gotham Workshop palette locked. DESIGN.md, handoff brief, and design notes complete.",
    arc: "green",
  },
  {
    date: "2026-05-12",
    day: 192,
    text: "Restructured sales teams across all 4 brands. Phoenix, Assassins, Synergies, Prodigies. Monday meeting alignment with all 4 leads.",
    arc: "blue",
  },
  {
    date: "2026-05-11",
    day: 191,
    text: "ChampOps triage engine running clean. Jules auto-fixed 3 UI issues overnight from widget feedback. Zero manual intervention.",
    arc: "green",
  },
];

// HowIThink point-of-view cards.
export interface PovCard {
  title: string;
  hook: string;
  arc: ArcColor;
  href: string;
}

export const povCards: PovCard[] = [
  {
    title: "The AI SDR is not a chatbot",
    hook: "Everyone's building AI that talks. We're building AI that sells. There's a difference.",
    arc: "blue",
    href: "/blog/#",
  },
  {
    title: "Why I run 12 companies from one vault",
    hook: "One Obsidian graph. 12 companies. Zero context-switching tax. Here's how.",
    arc: "green",
    href: "/blog/#",
  },
  {
    title: "Data is not a product. Growth is.",
    hook: "Lake B2B doesn't sell data. It sells pipeline. The data is just the engine.",
    arc: "gold",
    href: "/blog/#",
  },
];

// Ecosystem company cards.
export interface CompanyCard {
  name: string;
  oneLiner: string;
  tag: string;
}

export const companyCards: CompanyCard[] = [
  {
    name: "Champions Accelerator",
    oneLiner: "The holding center. 12 ventures, one operating system.",
    tag: "Accelerator",
  },
  {
    name: "Champions Infometrics",
    oneLiner: "Data intelligence for decisions that actually matter.",
    tag: "Data",
  },
  {
    name: "Champions Club",
    oneLiner: "Where founders meet, learn, and stop building alone.",
    tag: "Community",
  },
  {
    name: "Lake B2B",
    oneLiner: "The B2B growth stack. Data, demand, delivery.",
    tag: "Data & Services",
  },
  {
    name: "SPAN Global Services",
    oneLiner: "Enterprise data and demand generation at scale.",
    tag: "Data & Services",
  },
  {
    name: "Ampliz",
    oneLiner: "Healthcare data intelligence. Every hospital, every decision-maker.",
    tag: "Healthcare Data",
  },
  {
    name: "IP Momentum",
    oneLiner: "Intellectual property services for companies that build things.",
    tag: "IP Services",
  },
  {
    name: "Cirralogix",
    oneLiner: "Cloud infrastructure and DevOps. The pipes under the pipes.",
    tag: "Cloud & DevOps",
  },
  {
    name: "Recruit Champ",
    oneLiner: "AI-powered recruitment. Hire faster, hire smarter.",
    tag: "AI & Recruitment",
  },
  {
    name: "InfraTech",
    oneLiner: "Proptech. Resorts, experiences, real estate with a pulse.",
    tag: "PropTech",
  },
  {
    name: "Champ.fit",
    oneLiner: "Fitness platform. Your body, your data, your plan.",
    tag: "Health & Wellness",
  },
  {
    name: "Health.fit",
    oneLiner: "Health tracking and telemedicine for the next billion.",
    tag: "Health & Wellness",
  },
];

// Proof statements.
export const proofStatements: string[] = [
  "Built an AI SDR stack that books meetings while the sales team sleeps. 90-day experiment, live pipeline.",
  "Took Lake B2B from 'we sell data' to 'we are the B2B growth stack.' Category creation, not product marketing.",
];

// Nav links.
export interface NavLink {
  label: string;
  href: string;
}

export const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  { label: "Journey", href: "/journey" },
  { label: "Toolkit", href: "/toolkit" },
  { label: "Field Notes", href: "/journey/field-notes" },
];

// Footer social links.
export interface SocialLink {
  label: string;
  href: string;
}

export const socialLinks: SocialLink[] = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/sreedeep-surapaneni" },
  { label: "GitHub", href: "https://github.com/Champ-Deep" },
  { label: "Bluesky", href: "https://bsky.app/profile/sreedeep-sura.bsky.social" },
  { label: "X / Twitter", href: "https://x.com/sreedeepsura" },
];
