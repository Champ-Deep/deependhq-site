import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export. `next build` writes a fully static site to `out/`,
  // which deploys to Cloudflare Pages with no adapter and no server runtime.
  output: "export",
  // Required for static export: skip the Image Optimization server.
  images: { unoptimized: true },
};

export default nextConfig;
