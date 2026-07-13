import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "mdx"],
  // Parity note: legacy site served extensionless .html paths on Cloudflare.
  // App Router routes are extensionless natively; legacy .html URLs redirect.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/now.html", destination: "/now", permanent: true },
      { source: "/journey.html", destination: "/journey", permanent: true },
      { source: "/writing.html", destination: "/writing", permanent: true },
      { source: "/field-notes.html", destination: "/field-notes", permanent: true },
      { source: "/toolkit.html", destination: "/toolkit", permanent: true },
      { source: "/command.html", destination: "/command", permanent: true },
    ];
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
