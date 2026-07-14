"use client";
// NewsletterForm : the stateful part of the round 5 Newsletter5 tile.
// Single field, inline success. POSTs to /api/newsletter (same endpoint as
// the legacy kit; the route handler may still need wiring server-side).

import { useState, type FormEvent } from "react";

type NewsState = "idle" | "submitting" | "invalid" | "error" | "already" | "success";
type MsgState = "invalid" | "error" | "already" | "success";

const MSG: Record<MsgState, [string, string]> = {
  invalid: ["error", "that does not parse as an email."],
  error: ["error", "send failed. try again, or just keep reading."],
  already: ["success", "already on the list. see you sunday."],
  success: ["success", "confirm link sent. check your inbox."],
};

export function NewsletterForm() {
  const [state, setState] = useState<NewsState>("idle");
  const [email, setEmail] = useState("");

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setState("invalid"); return; }
    setState("submitting");
    try {
      const r = await fetch("/api/newsletter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (r.ok) setState("success");
      else if (r.status === 409) setState("already");
      else setState("error");
    } catch { setState("error"); }
  };

  return (
    <>
      {state === "success" || state === "already" ? (
        <p className="dh5-news-msg" data-state="success" role="status">{MSG[state][1]}</p>
      ) : (
        <form className="dh5-news-form" onSubmit={submit}>
          <input type="email" required value={email} placeholder="you@work.com"
            aria-label="email address"
            onChange={(e) => setEmail(e.target.value)} />
          <button className="dh5-cta" type="submit" disabled={state === "submitting"}>
            {state === "submitting" ? "sending…" : "subscribe"}
          </button>
        </form>
      )}
      {(state === "invalid" || state === "error") &&
        <p className="dh5-news-msg" data-state="error" role="alert">{MSG[state][1]}</p>}
    </>
  );
}
