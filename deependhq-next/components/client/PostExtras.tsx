"use client";
// PostExtras : the interactive slivers of the post page, split out so the
// article body itself stays a server component. Ports the ReadingBar and
// copy-link button from PostPage.jsx.

import { useEffect, useState } from "react";

export function ReadingBar() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <div className="bp-progress" style={{ width: pct + "%" }} aria-hidden="true" />;
}

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    const url = window.location.href;
    const done = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(done);
    } else {
      done();
    }
  };

  return (
    <button className="bp-share" onClick={copyLink}>
      {copied ? "link copied ✓" : "copy link"}
    </button>
  );
}
