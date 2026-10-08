// segment.js : classify the visit, score booking intent, and nothing else.
//
// THE ONE RULE THIS FILE ENFORCES
// "explorer" is the control group. Personalization is only worth having if the
// treated segments beat the control, and that comparison is impossible without a
// group nobody treated. So every visitor lands in exactly one of three segments,
// one of which is deliberately left alone. If the treated segments do not win,
// the engine reports no effect, which is a real result and not a failure.
//
// CLASSIFICATION IS SERVER-SIDE AND STAMPED ON <html>
// The Worker decides from request facts alone (referrer host and first path),
// so a treated visitor and a control visitor get the same server-rendered HTML.
// The difference is applied by CSS and a small amount of client logic, which
// means the personalization cannot break the prerender and cannot change what a
// crawler or a no-JS reader sees. That is a feature: the treated and control
// arms have to be comparable, and different HTML would make them incomparable.
//
// INTENTION SCORE, 2026-10-02
// Computed from request and event facts only. No LLM, no profile lookup, no IP.
// The score is a number in the dataset, not a judgement rendered to a visitor.

(function () {
  const SEGMENTS = ['operator', 'narrative', 'explorer'];

  // Paths that are themselves a strong statement of intent. Visiting the stack
  // page unprompted is a stronger operator signal than arriving from github,
  // because it costs a click.
  const OPERATOR_PATHS = /^\/(toolkit|pillars)(\/|$)/;
  const NARRATIVE_PATHS = /^\/(writing|journey|now|post)(\/|$)/;

  // Client properties that suggest a visitor is doing operator work.
  // Matched against the actual host, not the product name: bluesky lives on
  // bsky.app, so a list containing "bluesky" never matches anything.
  const OPERATOR_OUTBOUND = ['github', 'gitlab'];
  const NARRATIVE_OUTBOUND = ['linkedin', 'bsky', 'bluesky', 'substack', 'medium'];

  function hostClass(refHost) {
    const h = String(refHost || '').toLowerCase();
    if (!h) return '';
    if (OPERATOR_OUTBOUND.some((k) => h.indexOf(k) !== -1)) return 'operator';
    if (NARRATIVE_OUTBOUND.some((k) => h.indexOf(k) !== -1)) return 'narrative';
    return '';
  }

  // Classify. Deliberately boring: one strong signal wins, otherwise control.
  function classify({ path, refHost, outboundHistory }) {
    const fromHost = hostClass(refHost);
    if (fromHost) return fromHost;
    if (OPERATOR_PATHS.test(String(path || ''))) return 'operator';
    if (NARRATIVE_PATHS.test(String(path || ''))) return 'narrative';
    // If this browser has a history of outbound operator links, weight it, but
    // only when nothing stronger said otherwise.
    if (outboundHistory && outboundHistory.operator > (outboundHistory.narrative || 0)) return 'operator';
    return 'explorer';
  }

  // Booking intent. Deliberately small and legible, so a human can read the
  // reason behind a band instead of trusting a model.
  const INTENT = {
    cta: 3,
    deep_read: 2,     // past 60% of a post
    company: 1,
    client_out: 1,
    returning: 1,
    bounce: -2,
  };

  function scoreIntent({ ctaClicked, maxScroll, path, outboundLabels, visits, dwellSecs }) {
    let s = 0;
    const why = [];
    if (ctaClicked) { s += INTENT.cta; why.push('clicked a cta'); }
    if (maxScroll >= 60) { s += INTENT.deep_read; why.push('read past 60%'); }
    if (/^\/company\//.test(String(path || ''))) { s += INTENT.company; why.push('visited a company page'); }
    const client = (outboundLabels || []).some((l) => /client_site|book_a_call/.test(l));
    if (client) { s += INTENT.client_out; why.push('went to a client site or the scheduler'); }
    if ((visits || 1) >= 2) { s += INTENT.returning; why.push('been here before'); }

    // The bounce penalty applies ONLY when nothing else fired. An earlier version
    // applied it unconditionally, so clicking "book a call" and then hitting
    // back within 5 seconds scored 1 instead of 3 and landed in cold, which is
    // precisely backwards: that is the highest-intent action on the site.
    const bounced = (dwellSecs || 0) < 5;
    if (bounced && s === 0) {
      s += INTENT.bounce;
      why.push('left in under 5s');
    } else if (bounced) {
      why.push('left fast, but after a real signal');
    }
    return { score: Math.max(0, s), why: why.join(', ') || 'nothing yet' };
  }

  function band(score) {
    if (score >= 6) return 'hot';
    if (score >= 3) return 'warm';
    return 'cold';
  }

  // Treatment. The cold band deliberately receives NOTHING. No modal, no nudge,
  // no urgency, no changed copy. Nudging someone who did not ask is how a site
  // becomes something people close immediately, and the resulting bounce would
  // show up as worse engagement, which is a self-inflicted wound.
  function treatment(b) {
    switch (b) {
      case 'hot':
        return { cta_above_fold: true, copy: 'outcome', ask: false, note: 'booking is the only conversion that matters' };
      case 'warm':
        return { cta_above_fold: false, copy: 'outcome', ask: false, note: 'tighten toward the outcome, do not push' };
      default:
        return { cta_above_fold: false, copy: 'default', ask: true, note: 'cold visitors get the control experience' };
    }
  }

  window.DHSegment = {
    SEGMENTS, classify, scoreIntent, band, treatment,
    // exposed so a test can assert the whole chain without a browser
    _intent: INTENT,
  };
})();
