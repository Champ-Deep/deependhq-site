// GET /api/status : live-status endpoint the ticker polls. Returns an empty
// object for now, so the ticker keeps its baked values without console noise.
// Wire real signals here later (weather, now playing, commits today).

import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({});
}
