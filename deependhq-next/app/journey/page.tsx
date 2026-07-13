// /journey : the daily build log. Thin server wrapper around the interactive
// JourneyFeed client component (filters, infinite scroll, live rail). The
// journey array is serializable JSON, passed down as props.

import type { Metadata } from "next";
import { DH } from "@/lib/data";
import { JourneyFeed, type JourneyEntryData } from "@/components/client/JourneyFeed";

export const metadata: Metadata = {
  title: "The Journey",
  description: "Day by day. Build by build. The receipts behind the hero line.",
};

export default function JourneyPage() {
  // Journey entries carry fields beyond the base JourneyEntry type
  // (yesterday_thread lives under the index signature), so cast once here.
  const entries = DH.journey as unknown as JourneyEntryData[];
  return <JourneyFeed entries={entries} weeklyNarrativesCount={DH.weekly_narratives_count} />;
}
