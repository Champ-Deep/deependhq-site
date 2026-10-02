// visitor-id.js : a persistent, first-party visitor identifier.
//
// WHY THIS FILE EXISTS
// Deep decided on 2026-10-02 to run full visitor profiles. That needs an id that
// survives page loads, which is the exact thing the site promised it would never
// do in /privacy. The promise has been rewritten to match. This file is the
// rewrite's implementation.
//
// WHAT IT IS
// A random 128-bit id in a first-party cookie, plus a coarse behavioural profile
// kept in localStorage so we do not need a server round trip to know what this
// browser has already done. No IP is stored. No fingerprint. No cross-site
// tracking: the cookie is first-party and this file never reads or writes
// anything on another origin.
//
// WHAT IT DELIBERATELY IS NOT
// - Not an account. There is no login and there will not be one.
// - Not a fingerprint. No canvas, no fonts, no hardware, no audio stack.
// - Not reversible to a person. The id is random; nothing links it to an identity.
// - Not permanent. It expires in 180 days and is deleted on request.
//
// The cookie name is prefixed dh_ so it is obvious in a browser's storage panel
// whose it is. A visitor who wants it gone can delete it in two clicks, and
// clearing it degrades to anonymous rather than breaking the site.

const COOKIE = 'dh_vid';
const PROFILE = 'dh_profile';
const TTL_DAYS = 180;

// Segments are coarse and behavioural. They are the only classification the
// personalization layer is allowed to act on.
const SEGMENTS = ['operator', 'narrative', 'explorer'];

// The profile shape, with the cap that stops it growing without bound. A profile
// that records everything eventually records something it should not.
const MAX_VISITS = 40;
const MAX_PATH_HISTORY = 20;

function randomId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  (window.crypto || {}).getRandomValues
    ? crypto.getRandomValues(b)
    : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name, value, days) {
  const exp = new Date(Date.now() + days * 864e5).toUTCString();
  // Secure is set because this site is https only. SameSite=Lax keeps the cookie
  // off cross-site requests, which is most of what "not tracking" means in
  // practice. No Domain attribute, so it stays on this host only.
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax; Secure`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    // Private browsing or a blocked storage partition. Not an error worth
    // breaking the page over: fall back to no profile.
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* no storage, no profile */ }
}

function getVisitorId() {
  let id = readCookie(COOKIE);
  if (!id) {
    id = randomId();
    writeCookie(COOKIE, id, TTL_DAYS);
  }
  return id;
}

// The profile is a summary, not a transcript. It answers the only questions the
// personalization layer actually asks: what is this person interested in, how
// deep do they read, have they tried to book, how many times have they been here.
function getProfile() {
  return readJson(PROFILE, {
    v: 1,
    first_seen: Date.now(),
    last_seen: Date.now(),
    visits: 0,
    paths: [],
    max_scroll: {},
    segments: {},
    ctas: [],
    outbound: {},
    asked: 0,          // how many times we have put the one-question ask in front of them
    asked_answer: null,
  });
}

// Fold one page load into the profile. Called once per navigation.
function recordPageView(path, segment) {
  const p = getProfile();
  p.visits += 1;
  p.last_seen = Date.now();

  if (p.paths.indexOf(path) === -1) p.paths.unshift(path);
  p.paths = p.paths.slice(0, MAX_PATH_HISTORY);

  if (segment && SEGMENTS.indexOf(segment) !== -1) {
    p.segments[segment] = (p.segments[segment] || 0) + 1;
  }

  writeJson(PROFILE, p);
  return p;
}

function recordScroll(path, depth) {
  const p = getProfile();
  const prev = p.max_scroll[path] || 0;
  if (depth > prev) {
    p.max_scroll[path] = depth;
    writeJson(PROFILE, p);
  }
  return p;
}

function recordCta(label) {
  const p = getProfile();
  if (p.ctas.indexOf(label) === -1) {
    p.ctas.unshift(label);
    p.ctas = p.ctas.slice(0, MAX_PATH_HISTORY);
    writeJson(PROFILE, p);
  }
  return p;
}

function recordOutbound(label) {
  const p = getProfile();
  p.outbound[label] = (p.outbound[label] || 0) + 1;
  writeJson(PROFILE, p);
  return p;
}

// Ask only once, ever, per browser. The ask is cheap to ignore and expensive to
// ask twice, so the cap is one rather than one per session.
function claimAsk() {
  const p = getProfile();
  if (p.asked > 0) return false;
  p.asked = 1;
  writeJson(PROFILE, p);
  return true;
}

function setAskAnswer(answer) {
  const p = getProfile();
  p.asked_answer = String(answer || '').slice(0, 200);
  writeJson(PROFILE, p);
  return p;
}

// Forget everything. Bound to a visible control so it is not a promise in a
// privacy policy that nobody can act on.
function forget() {
  try { localStorage.removeItem(PROFILE); } catch (e) {}
  document.cookie = `${COOKIE}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax; Secure`;
  return true;
}

window.DHVisitor = {
  getVisitorId,
  getProfile,
  recordPageView,
  recordScroll,
  recordCta,
  recordOutbound,
  claimAsk,
  setAskAnswer,
  forget,
  SEGMENTS,
};
