"use client";
// CopyEmail : a real copy-to-clipboard button for the footer mailto row.

import { useState } from "react";

export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard
      .writeText(email)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };
  return (
    <button className="dh6-copy" type="button" data-copied={copied || undefined} onClick={onCopy}>
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}
