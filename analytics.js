// analytics.js : first-party event tracking, no third-party script.
//
// WHY THIS FILE EXISTS
// PostHog's hosted snippet was the obvious choice and the wrong one here. It is
// a third-party script on a site whose footer says "no cookies, no trackers",
// it needs a wide CSP relaxation, and it cannot be verified from the vault. This
// file does the same job with no external dependency: it posts JSON to
// /api/collect, the Worker forwards it, and nothing about the visitor is stored
// on this machine.
//
// WHAT IT COLLECTS
//   page      path, referrer host, country, timezone, viewport, day/night
//   engage    scroll depth, dwell time, which section was read
//   outbound  every external link, labelled by destination
//   intent    the calls to action, which are the only thing that matters
//
// THE VISITOR ID, 2026-10-02
// This file previously carried no identity at all and said so. Deep chose full
// visitor profiles, so there is now a persistent first-party id (visitor-id.js)
// and every event carries it. That makes "visitors" mean visitors rather than
// visits. /privacy was rewritten in the same change. The two must never disagree.

// A page load gets one id so the engage events that follow can be tied to it.
// The per-load id is separate from the persistent visitor id on purpose: this one
// groups the events of a single visit, the other groups visits of a person.
const PAGE_ID = (crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36);

const started = Date.now();
let maxScroll = 0;
let lastPath = location.pathname;

// The Worker already stamps these on <html> from request.cf, so country and
// timezone cost no extra request and involve no client-side geo lookup.
// Named dhRoot, not root: this file is bundled into the prerender sandbox, which
// already has a module-scope `root` for the site directory, and a second
// declaration of `root` is a SyntaxError that kills the whole bundle.
const dhRoot = document.documentElement;
const country = (dhRoot && dhRoot.getAttribute('data-country')) || '';
const tz = (dhRoot && dhRoot.getAttribute('data-tz')) || '';
const refClass = (dhRoot && dhRoot.getAttribute('data-ref')) || '';
const serverSegment = (dhRoot && dhRoot.getAttribute('data-segment')) || '';

// Night or day, from the visitor's own clock. Deep works 15:00 to 02:00 IST, so
// the site has a genuinely different character after midnight and the hour is
// worth knowing about. This is a coarse flag, not a location: the hour comes from
// the browser clock and the timezone string comes from Cloudflare.
function night() {
  const h = new Date().getHours();
  return h >= 21 || h < 6 ? 'night' : 'day';
}

// visitor-id.js loads before this file. If it did not, we degrade to anonymous
// rather than throwing: analytics must never be the reason a page breaks.
const V = window.DHVisitor || null;
const visitorId = V ? V.getVisitorId() : '';

function baseProps() {
  const w = window.innerWidth || 0;
  return {
    path: location.pathname,
    // Only the host, never the full referring URL. A full referrer routinely
    // carries campaign parameters and search strings that are not ours.
    ref_host: refClass || safeRefHost(),
    country,
    tz,
    // Breakpoints, not exact widths. A width is close to a fingerprint when
    // combined with the rest; a bucket is not.
    vp: w < 640 ? 'sm' : w < 1024 ? 'md' : w < 1440 ? 'lg' : 'xl',
    hour: new Date().getHours(),
    page_id: PAGE_ID,
  };
}

function safeRefHost() {
  try {
    const r = document.referrer;
    if (!r) return '';
    const h = new URL(r).hostname.toLowerCase();
    if (!h || h === location.hostname) return '';
    if (h.includes('github')) return 'operator';
    if (h.includes('linkedin')) return 'narrative';
    return h.replace(/^www\./, '').split('.')[0];
  } catch (e) { return ''; }
}

// navigator.sendBeacon survives the page unloading, which a fetch often does
// not. Queueing in sendBeacon and POSTing by hand is the difference between
// recording the click that sent someone to the scheduler and losing it.
function send(name, props) {
  const body = JSON.stringify({ name, props: Object.assign(baseProps(), props || {}) });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon('/api/collect', new Blob([body], { type: 'application/json' }))) return;
  } catch (e) { /* fall through to fetch */ }
  try {
    fetch('/api/collect', {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* analytics must never break the page */ }
}

// Exposed so ask.js and the copy engine can emit without reimplementing the
// transport. It is the same send(), so one queue, one blob, one beacon.
window.DHTrack = function (name, props) { send(name, props); };

// ---------------------------------------------------------------- page view

send('page', {
  title: document.title,
  vid: visitorId,
  path: location.pathname,
  segment: serverSegment,
  ref_host: document.referrer.replace(/^https?:\/\//, '').split('/')[0] || '',
  night: night(),
  hour: new Date().getHours(),
  viewport: (innerWidth < 640 ? 'm' : innerWidth < 1100 ? 't' : 'd'),
  language: navigator.language,
});

// Fold this load into the persistent profile, and score the booking intent on
// the way OUT rather than on the way in. Almost every intent signal (scroll depth,
// dwell, clicks) only exists by the end of the visit, so scoring at load time
// would put essentially everyone in cold, and a band that never moves is worse
// than no band at all.
if (V && window.DHSegment) {
  const S2 = window.DHSegment;
  const profileSeg = serverSegment || S2.classify({
    path: location.pathname,
    refHost: document.referrer.replace(/^https?:\/\//, '').split('/')[0],
  });
  V.recordPageView(location.pathname, profileSeg);

  addEventListener('pagehide', function () {
    const prof = V.getProfile();
    const dwell = (Date.now() - started) / 1000;
    const depth = prof.max_scroll[location.pathname] || maxScroll;
    const scored = S2.scoreIntent({
      ctaClicked: prof.ctas.length > 0,
      maxScroll: depth,
      path: location.pathname,
      outboundLabels: Object.keys(prof.outbound),
      visits: prof.visits,
      dwellSecs: dwell,
    });
    const b = S2.band(scored.score);
    send('engage', {
      secs: Math.round(dwell),
      max_scroll: depth,
      intent: scored.score,
      band: b,
      visits: prof.visits,
      why: scored.why,
    });
    // Publish the band so the page can apply its treatment, and so the digest
    // can attribute bookings to a band without guessing.
    const el = document.documentElement;
    el.setAttribute('data-intent', b);
    el.setAttribute('data-intent-why', scored.why);
  }, { once: true });
}

// SPA-ish navigation: the site is a handful of static pages, but the nav can
// move between them without a full load in some flows, so watch the path.
try {
  new MutationObserver(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    send('page', { title: document.title });
  }).observe(document.body, { childList: true, subtree: true });
} catch (e) { /* no observer, no nav events */ }

// ---------------------------------------------------------------- engagement

// Scroll depth, throttled to the quarter marks. Firing on every scroll event
// would be a hundred events a page and would tell us nothing extra.
const marks = new Set();
function onScroll() {
  const doc = document.documentElement;
  const max = (doc.scrollHeight - window.innerHeight) || 1;
  const pct = Math.min(100, Math.round((window.scrollY / max) * 100));
  if (pct > maxScroll) maxScroll = pct;
  for (const m of [25, 50, 75, 100]) {
    if (pct >= m && !marks.has(m)) {
      marks.add(m);
      if (V) V.recordScroll(lastPath, pct);
      send('scroll', { depth: m, segment: serverSegment });
    }
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Dwell, on visibility change only.
//
// This used to also fire on pagehide, which meant pagehide produced TWO engage
// events: this one and the intent-bearing one further up. The intent scorer runs
// on pagehide because most of its inputs only exist at the end of a visit, so the
// pagehide report is the authoritative one and reporting dwell from two places
// double-counted every session in the dataset.
//
// So pagehide emits exactly ONE engage: the intent-bearing one above, which
// already carries secs and max_scroll. This function therefore handles only the
// mid-visit case, where a reader tabs away and the page never unloads, so the
// intent report at line 137 never runs and the time would otherwise be lost.
let dwellReported = false;
function reportDwell(reason) {
  if (dwellReported) return;
  dwellReported = true;
  const secs = Math.round((Date.now() - started) / 1000);
  if (secs < 2) return;
  send('engage', { secs, max_scroll: maxScroll, reason });
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') reportDwell('hidden');
});
// ---------------------------------------------------------------- intent

// The only events worth a dashboard. Everything else is context for these.
const OUTBOUND_LABELS = [
  [/linkedin\.com/i, 'linkedin'],
  [/github\.com/i, 'github'],
  [/bluesky\.net/i, 'bluesky'],
  [/scheduler\.zoom\.us|cal\.com|calendly/i, 'book_a_call'],
  // the essay page's Ask AI links and the Google preferred source link
  [/chatgpt\.com\/\?q=|claude\.ai\/new\?q=|perplexity\.ai\/search|google\.com\/search\?udm=50/i, 'ask_ai'],
  [/google\.com\/preferences\/source/i, 'preferred_source'],
  [/\.pdf($|\?)/i, 'pdf'],
  [/(champ|lake|span|ampliz|cirralogix|recruit|infratech|health)\w*\.(com|fit|ai|io)/i, 'client_site'],
];

function labelFor(href) {
  for (const [re, label] of OUTBOUND_LABELS) if (re.test(href)) return label;
  return 'other';
}

// One delegated listener beats binding to every link, because the pages are
// prerendered and re-rendered by React, and a bound handler dies with the node.
document.addEventListener('click', function (e) {
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if (!a) return;
  const href = a.getAttribute('href') || '';
  const text = (a.textContent || '').trim().slice(0, 60);

  if (/^https?:/i.test(href)) {
    let host = '';
    try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (err) { host = 'external'; }
    if (host && host !== location.hostname) {
      const label = labelFor(href);
      // Same reason as the CTA: outbound history is an intent input, and the
      // score is computed on unload, so it has to reach the profile.
      if (V) V.recordOutbound(label);

      // THE BOOKING CTA IS AN EXTERNAL LINK. It points at the scheduler, so it
      // used to return here as a plain outbound and never reach the isCta branch
      // below, which meant clicking "book 30 minutes" recorded an outbound click
      // but NOT a cta click, and the intent scorer saw no cta at all. The single
      // highest-intent action on the site scored lower than scrolling. So a cta is
      // recorded here as well, on top of the outbound event, and never instead of
      // it: it genuinely is both a labelled outbound and the call to action.
      const clsEarly = a.className && typeof a.className === 'string' ? a.className : '';
      const ctaish = /cta|btn-book|book|dh-cta/i.test(clsEarly) || /book a call|get in touch/i.test(text);
      if (ctaish && V) V.recordCta(text || 'book_a_call');

      send('outbound', { label, host, text, segment: serverSegment, cta: ctaish ? 1 : 0 });
    }
    return;
  }

  // Internal navigation. The href itself is the intent; the label says which
  // kind of thing they reached for.
  const cls = a.className && typeof a.className === 'string' ? a.className : '';
  const isCta = /cta|btn-book|book|dh-cta/i.test(cls) || /book a call|get in touch/i.test(text);
  if (isCta) {
    const label = text || 'book_a_call';
    // Feed the profile too: the intent score is computed on unload, so a click
    // that is only ever an event would be invisible to it.
    if (V) V.recordCta(label);
    send('cta', { label, href, band: document.documentElement.getAttribute('data-intent') || '' });
  } else if (href && href !== '#') {
    send('nav', { href, text });
  }
}, { passive: true });

// Terminal easter egg and the command palette. Both are deliberate, and both
// mean the visitor went looking rather than just reading.
document.addEventListener('keydown', function (e) {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) send('easter_egg', { egg: 'command_palette' });
}, { passive: true });

// The Ask Deep widget is third party, so we only know it opened, not what was
// asked inside it. Reporting the open and not the contents is the honest
// boundary; the contents belong to Widgo's own policy.
window.addEventListener('message', function (e) {
  if (e && e.data && typeof e.data.type === 'string' && /widgo|chat.*open/i.test(e.data.type)) {
    send('widget', { widget: 'ask_deep', state: 'open' });
  }
}, { passive: true });
