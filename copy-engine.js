// copy-engine.js : the only thing on this site that rewrites its own words.
//
// Deep chose "auto-apply to low-risk copy only". This file is that boundary, and
// it is written to be auditable rather than clever: every swap it makes is a
// literal in the table below, every element it touches is listed, and everything
// else in the page is untouchable by construction.
//
// THE WHITELIST, EXPLICITLY
//   it may change : hero subline, section order, one CTA label
//   it may NOT     : any number, date, count, name, URL, link target, the honesty
//                    rule, anything marked data-dh-frozen, anything that is not
//                    in VARIANTS below
//
// WHY THE NUMBERS ARE UNREACHABLE
// The reason a self-rewriting site usually goes wrong is that it starts
// "optimizing" a claim like "12 companies" or "day 334". So every candidate
// string here is checked against a numeric pattern before it can be applied, and
// any variant whose text contains a digit that did not come from the same variant
// is rejected outright. A rule that cannot produce a number cannot lie with one.
//
// WHY IT WAITS FOR EVIDENCE
// A/B logic with four pageviews is a coin flip with a conversion funnel attached.
// Below MIN_VISITS the engine renders the control and says so in the console. The
// threshold is the honest part: without it this file would just be a way to feel
// in control of randomness.
//
// WHAT "SUCCESS" EVEN MEANS HERE
// The control arm is 'explorer'. If a variant does not beat control, the right
// outcome is to report no effect and revert. This file therefore never escalates
// on its own. It applies a variant that the digest has already marked as
// evidence-backed, passed in by copy-rules.json, which Deep can edit or delete.

(function () {
  // The variants. Each is a literal, chosen in advance, not generated. An LLM is
  // not in this path on purpose: a model rewriting your own homepage every week
  // is how you end up publishing a claim you never made.
  const VARIANTS = {
    // THE CONTROL MUST BE THE REAL TEXT IN THE MARKUP. An earlier draft had
    // 'Twelve companies, one operator...' here while the page said 'Past the hype
    // cycle...' and the engine therefore declined to touch it, silently, forever.
    // That is why scripts/selftest-copy.mjs reads index.html and compares.
    //
    // Each variant keeps the "2 AM" because the number guard requires every
    // variant to carry exactly the control's digits. That is the whole point: an
    // optimizer cannot quietly move a time or a count, because it has to move all
    // of them or none.
    hero_subline: {
      control: 'Past the hype cycle, into the infrastructure. Every entry starts as a note in the vault and goes live by 2 AM IST.',
      operator: 'Past the hype cycle, into the infrastructure. Read the numbers, then ship the thing, live by 2 AM IST.',
      narrative: 'Past the hype cycle, into the infrastructure. The long arc of building in public, live by 2 AM IST.',
    },
    // The control MUST match the control text already in the markup, or the
    // number-agreement check treats the page as bespoke and declines to touch
    // it, which is the engine silently doing nothing.
    cta_label: {
      control: 'book 30 minutes',
      operator: 'book 30 minutes on your stack',
      hot: 'book 30 minutes, pick a slot',
    },
  };

  // A candidate may not introduce a number the control did not already have.
  // This is the guardrail that stops a "shortened" claim from quietly becoming a
  // different, wrong claim.
  const digits = (s) => (String(s).match(/\d+/g) || []).sort();

  function numbersAgree(control, variant) {
    const a = digits(control);
    const b = digits(variant);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function resolveVariant(field, segment, band) {
    const table = VARIANTS[field];
    if (!table) return table ? table.control : null;
    // hot overrides segment for the CTA only: a person already showing intent
    // gets the outcome-focused label regardless of where they came from.
    const key = (field === 'cta_label' && band === 'hot') ? 'hot'
      : (band && table[band]) ? band
      : (segment && table[segment]) ? segment
      : 'control';
    return table[key] || table.control;
  }

  // Only these attributes are ever written.
  const WRITABLE = { 'data-dh-hero': 'textContent', 'data-dh-cta': 'textContent' };

  function apply(segment, band, evidence) {
    const log = [];
    // THE MINIMUM EVIDENCE RULE. Without evidence, render control and stop.
    if (!evidence || !evidence.supported) {
      log.push('no evidence yet: rendering control unchanged');
      return { changed: false, log, control: true };
    }

    for (const [attr, prop] of Object.entries(WRITABLE)) {
      const nodes = document.querySelectorAll(`[${attr}]`);
      nodes.forEach((node) => {
        // Anything explicitly frozen is off limits, whatever the table says.
        if (node.hasAttribute('data-dh-frozen')) {
          log.push(`skipped ${attr}: frozen`);
          return;
        }
        const field = node.getAttribute(attr);
        // The rules file may narrow the permission but never widen it. A field
        // absent from allowed is control, even if the table has a variant for it.
        if (evidence.allowed && !evidence.allowed.has(field)) {
          log.push(`skipped ${field}: not in allowed_fields`);
          return;
        }
        const current = (node[prop] || '').trim();
        const control = VARIANTS[field] && VARIANTS[field].control;
        if (!control) return;
        if (!numbersAgree(control, current) && current !== control) {
          log.push(`skipped ${field}: current text carries its own numbers`);
          return;
        }
        const next = resolveVariant(field, segment, band);
        if (next && next !== current) {
          node[prop] = next;
          log.push(`${field}: "${current}" -> "${next}" (${segment || 'control'}${band ? '/' + band : ''})`);
        }
      });
    }
    return { changed: log.some((l) => l.indexOf('->') !== -1), log, control: false };
  }

  window.DHCopy = {
    apply,
    VARIANTS,
    // exposed for the selftest: the number guard and the resolver are the two
    // rules most likely to be quietly broken by a later edit, and they cost
    // nothing to assert.
    _numbersAgree: numbersAgree,
    _resolveVariant: resolveVariant,
    _MIN_VISITS: 40,
  };

  // Load the live switch, then apply. The fetch is deliberately not awaited by
  // anything that blocks paint: the page renders its normal text immediately and
  // the engine only ever refines wording afterwards, so a slow or failed rules
  // fetch degrades to "control", which is the correct default.
  function boot() {
    const seg = document.documentElement.getAttribute('data-segment') || '';
    const band = document.documentElement.getAttribute('data-intent') || '';
    fetch('copy-rules.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { supported: false }))
      .then((rules) => {
        // The file may only enable fields it lists. A rule file that tries to
        // widen its own permission is ignored rather than obeyed.
        const allowed = new Set(rules.allowed_fields || []);
        const safe = {
          supported: !!rules.supported,
          visitors: rules.min_visitors,
          allowed,
        };
        const res = apply(seg, band, safe);
        // Record what the engine did, including "nothing", so the digest can tell
        // the difference between "no variant applied" and "variant applied and it
        // did nothing".
        if (window.DHTrack) {
          window.DHTrack('engine', {
            which: 'copy',
            segment: seg,
            band,
            applied: res.changed ? 1 : 0,
            control: res.control ? 1 : 0,
            notes: res.log.join(' | ').slice(0, 300),
          });
        }
      })
      .catch(() => {
        if (window.DHTrack) window.DHTrack('engine', { which: 'copy', applied: 0, control: 1, notes: 'rules fetch failed' });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();