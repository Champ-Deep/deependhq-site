// /cta : booking redirect, parity with the legacy Worker path.
// Keeps ?from= for lightweight source attribution in logs.

import { redirect } from "next/navigation";
import { DH } from "@/lib/data";

export function GET() {
  const url = DH.brand.booking_url.startsWith("http")
    ? DH.brand.booking_url
    : `https://${DH.brand.booking_url}`;
  redirect(url);
}
