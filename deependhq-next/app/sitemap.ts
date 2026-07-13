import type { MetadataRoute } from "next";
import { DH, SITE_URL } from "@/lib/data";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = ["", "/command", "/now", "/journey", "/writing", "/field-notes", "/toolkit"];
  return [
    ...staticPages.map((p) => ({ url: `${SITE_URL}${p}` })),
    ...DH.companies.map((c) => ({ url: `${SITE_URL}/company/${c.slug}` })),
    ...DH.posts.map((p) => ({ url: `${SITE_URL}/writing/${p.slug}` })),
  ];
}
