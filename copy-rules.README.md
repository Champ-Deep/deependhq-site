# copy-rules.json

The live switch for the auto-apply copy engine. Read this before editing the file.

`copy-engine.js` holds the variants and the guardrails. `copy-rules.json` holds
the only question that matters: **is there evidence, and which fields may vary.**
Separate files, so a weekly report can never edit the rules, and the rules can
never be changed by accident while reading a report.

## The default is zero

```json
"supported": false
```

This is not a placeholder to be flipped optimistically. While it is false, every
visitor on every page gets the control rendering. Nothing personalizes. The site
is unchanged and fully functional.

It is currently false because **there is no traffic data yet.** The dataset
`deependhq_events` does not exist, so no variant has beaten anything.

## How it becomes true

Only through evidence, in this order:

1. At least `min_visitors` (30) distinct visitors in the treated segment.
2. That segment's cta rate beats the `explorer` control by at least
   `min_lift` (15 percent relative).
3. The numbers get written into `evidence`, so a later reader can check the claim
   instead of taking it on trust.

`scripts/digest.mjs` produces those numbers and prints them. It does not write
this file automatically, on purpose: the one thing that changes what a stranger
reads should be a line a human chose to write down.

## Why `explorer` is never disabled

`explorer` is the control group. It is the group that gets no personalization.
If it were ever removed, there would be nothing to compare against, the treated
arms could not be evaluated, and every future number on this site would be
uninterpretable. A personalization engine with no control is a machine for
generating confidence without evidence.

The digest names a missing control as the single most important line in the
report, and `scripts/selftest-digest.mjs` asserts that it does.

## What can never appear in this file

There is no key here that lets a variant invent text. The strings live in
`copy-engine.js`, chosen in advance, and this file can only enable a subset of
them. So no report, no digest, and no model can put new words on the homepage
through this path.

A variant string also cannot introduce a number the control does not already
have. That guard is what stops an "optimization" from quietly turning "day 334"
into "day 400". It is asserted in `scripts/selftest-copy.mjs`.