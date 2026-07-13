// GET /feed.xml : RSS 2.0, same content as the legacy pipeline's feed.xml but
// with the new /writing/[slug] permalinks.

import { DH, SITE_URL } from "@/lib/data";

const esc = (s: unknown) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const rfc822 = (d: string) => {
  const dt = new Date(`${d}T09:00:00+05:30`);
  return isNaN(dt.getTime()) ? new Date().toUTCString() : dt.toUTCString();
};

export function GET() {
  const posts = DH.posts
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 30);

  const items = posts
    .map((p) =>
      [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${SITE_URL}/writing/${esc(p.slug)}</link>`,
        `      <guid isPermaLink="true">${SITE_URL}/writing/${esc(p.slug)}</guid>`,
        `      <pubDate>${rfc822(p.date)}</pubDate>`,
        `      <description>${esc(p.summary || p.excerpt || p.subtitle || p.title)}</description>`,
        "    </item>",
      ].join("\n")
    )
    .join("\n");

  const rss = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "  <channel>",
    "    <title>deep &gt;_ · building in public</title>",
    `    <link>${SITE_URL}</link>`,
    "    <description>Essays and weekly narratives from the operator of 12 companies. Past the hype cycle, into the infrastructure.</description>",
    "    <language>en</language>",
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(rss, {
    headers: { "content-type": "application/rss+xml; charset=utf-8" },
  });
}
