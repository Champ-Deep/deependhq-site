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
// WHAT IT DOES NOT COLLECT
// No cookie, no localStorage identity, no IP-derived person ID, no fingerprint.
// A "session" is one page load. That is a real limitation and a deliberate one:
// see the honesty rule in the design system. A returning visitor is counted as
// a new visit, so treat "visitors" as "visits" and say so on any dashboard.

// A page load gets one id so the engage events that follow can be tied to it.
// It is not an identity: it lives in memory, dies with the tab, and is never
// written anywhere the next page load can read it.
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

// ---------------------------------------------------------------- page view

send('page', { title: document.title });

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
      send('scroll', { depth: m });
    }
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Dwell, on unload and on visibility change. A reader who stayed nine minutes
// is a different person from one who bounced, and pageviews alone cannot tell.
function reportDwell(reason) {
  const secs = Math.round((Date.now() - started) / 1000);
  if (secs < 2) return;
  send('engage', { secs, max_scroll: maxScroll, reason });
}
window.addEventListener('pagehide', () => reportDwell('pagehide'));
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
      send('outbound', { label: labelFor(href), host, text });
    }
    return;
  }

  // Internal navigation. The href itself is the intent; the label says which
  // kind of thing they reached for.
  const cls = a.className && typeof a.className === 'string' ? a.className : '';
  const isCta = /cta|btn-book|book|dh-cta/i.test(cls) || /book a call|get in touch/i.test(text);
  if (isCta) {
    send('cta', { label: text || 'book_a_call', href });
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
