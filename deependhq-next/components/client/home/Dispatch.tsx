"use client";
// Dispatch : newsletter signup with quirky header. Port of Dispatch.jsx.

import Link from "next/link";
import { useState } from "react";

export interface DispatchData {
  cadence: string;
  read_time: string;
  subs: number;
  sample: string[];
}

export function Dispatch({ d }: { d: DispatchData }) {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setDone(true);
    setTimeout(() => {
      setDone(false);
      setEmail("");
    }, 3000);
  };

  return (
    <section id="dispatch" data-screen-label="the-dispatch" className="dh-section dh-section-dispatch">
      <div className="dh-dispatch">
        <div className="dh-dispatch-left">
          <div className="dh-eyebrow">
            <span className="dh-eyebrow-dot dh-eyebrow-dot-blue" /> The dispatch
          </div>
          <h2 className="dh-dispatch-title">Worth about three minutes of your inbox.</h2>
          <p className="dh-dispatch-sub">
            One letter, every Sunday. The week stitched into a narrative. No tips, no listicles. Sometimes
            a horse photo.
          </p>
          <form className="dh-dispatch-form" onSubmit={onSubmit}>
            <span className="dh-dispatch-gt">&gt;_</span>
            <input
              className="dh-dispatch-input"
              type="email"
              placeholder="founder@yourcompany.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="dh-btn dh-btn-primary dh-dispatch-btn" type="submit">
              {done ? "sent" : "subscribe"}
            </button>
          </form>
          <div className="dh-dispatch-meta">
            <span className="dh-mono">{d.cadence}</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-mono">{d.read_time}</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-mono">{d.subs.toLocaleString("en-US")} reading</span>
            <span className="dh-dot-sep">·</span>
            <span className="dh-mono">unsubscribe in one click, always</span>
          </div>
        </div>
        <div className="dh-dispatch-right">
          <div className="dh-dispatch-stack-label">Recent issues</div>
          <ul className="dh-dispatch-issues">
            {d.sample.map((s, i) => (
              <li key={i} className="dh-dispatch-issue">
                <span className="dh-dispatch-issue-marker">·</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <Link className="dh-link dh-dispatch-archive" href="/writing">
            Browse the archive →
          </Link>
        </div>
      </div>
    </section>
  );
}
