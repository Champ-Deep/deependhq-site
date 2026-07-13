// /toolkit : the workshop drawer. Thin server wrapper around the interactive
// ToolkitBrowser client component (category filter, search, live rail).

import type { Metadata } from "next";
import { DH } from "@/lib/data";
import { ToolkitBrowser, type ToolkitItem } from "@/components/client/ToolkitBrowser";

export const metadata: Metadata = {
  title: "The Toolkit",
  description: "Tools, repos, skills, and resources Sreedeep builds and uses.",
};

export default function ToolkitPage() {
  // DHData types toolkit loosely; content.json holds a flat item array.
  const items = DH.toolkit as unknown as ToolkitItem[];
  return <ToolkitBrowser items={items} />;
}
