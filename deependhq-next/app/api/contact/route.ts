// POST /api/contact : serverless contact endpoint.
// Validates, then forwards to CONTACT_WEBHOOK_URL if configured (Vercel env
// var; point it at a Zapier hook, a Worker, or Champmail later). Without a
// webhook it accepts and logs, so the form never breaks.

import { NextResponse } from "next/server";

interface ContactBody {
  name?: string;
  email?: string;
  message?: string;
  from?: string;
}

export async function POST(req: Request) {
  let body: ContactBody;
  try {
    body = (await req.json()) as ContactBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const email = (body.email || "").trim();
  const message = (body.message || "").trim();
  if (!email || !/.+@.+\..+/.test(email) || !message) {
    return NextResponse.json({ ok: false, error: "email and message required" }, { status: 422 });
  }

  const webhook = process.env.CONTACT_WEBHOOK_URL;
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: (body.name || "").slice(0, 200),
          email: email.slice(0, 200),
          message: message.slice(0, 4000),
          from: (body.from || "site").slice(0, 60),
          at: new Date().toISOString(),
        }),
      });
      if (!r.ok) throw new Error(`webhook ${r.status}`);
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false, error: "delivery failed" }, { status: 502 });
    }
  }

  console.log("[contact] no CONTACT_WEBHOOK_URL, accepted:", email);
  return NextResponse.json({ ok: true, note: "accepted" }, { status: 202 });
}
