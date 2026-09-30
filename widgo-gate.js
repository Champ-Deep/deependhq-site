// widgo-gate.js : viewport gate for the Widgo widget.
//
// WHY THIS FILE EXISTS
// Widgo's own bundle has a broken mobile guard. Its auto-open effect reads:
//
//     w.autoOpen && g && !o.current && (typeof window > "u" || window.innerWidth > 768)
//
// The minifier emitted `typeof window > "u"` as a STRING comparison. "object" > "u"
// is true, so the left half of the || is always true and the innerWidth check never
// runs. The widget therefore auto-opens at 375 as well as at 1280, and the panel
// covers the hero on the first paint. The code lives in a closed shadow root
// (attachShadow({mode:"closed"})), so no stylesheet or DOM patch on this site can
// reach inside it and no amount of CSS here will stop it.
//
// THE FIX
// We do not load the bundle on a phone at all. On <= 768px we render our own
// 56px launcher instead, and the real widget loads only when a visitor taps it.
// The launcher is a real button with a real label, 56px square, bottom right,
// inside the safe area. Zero third-party bytes on the mobile first paint.
//
// WIDGET COPY (greeting, suggested questions, launcher label) is set in the Widgo
// dashboard, not here. This file cannot override the fetched config.
//
// No em dashes. Plain ES2018, no build step, no dependencies.

(function () {
  var MOBILE_MAX = 768;
  var ORG_ID = 'org_35e92c34c3fb4f43';
  var AI_URL = 'https://ai.widgo.ai';
  var LAUNCH_SIZE = 56;

  var isMobile = function () { return window.innerWidth <= MOBILE_MAX; };
  var loaded = false;

  function mount() {
    if (loaded) return;
    loaded = true;
    window.widgoConfig = { orgId: ORG_ID, aiUrl: AI_URL };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://cdn.widgo.ai/widgo.js';
    s.setAttribute('data-gated', 'user');
    document.body.appendChild(s);
    var btn = document.getElementById('widgo-gate-btn');
    if (btn) btn.remove();
  }

  function buildLauncher() {
    if (document.getElementById('widgo-gate-btn')) return;
    var b = document.createElement('button');
    b.id = 'widgo-gate-btn';
    b.type = 'button';
    b.setAttribute('aria-label', 'Ask the site assistant');
    b.title = 'Ask';
    b.textContent = 'ask';
    b.style.cssText = [
      'position:fixed',
      'right:max(16px, env(safe-area-inset-right))',
      'bottom:max(16px, env(safe-area-inset-bottom))',
      'width:' + LAUNCH_SIZE + 'px',
      'height:' + LAUNCH_SIZE + 'px',
      'border-radius:50%',
      'z-index:2147483000',
      'border:1px solid rgba(0,0,0,.18)',
      'background:#111',
      'color:#f5f2ea',
      'font:500 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.02em',
      'cursor:pointer',
      'box-shadow:0 2px 10px rgba(0,0,0,.22)',
      '-webkit-tap-highlight-color:transparent'
    ].join(';');
    b.addEventListener('click', mount);
    document.body.appendChild(b);
  }

  function apply() {
    if (isMobile()) {
      // Small screen: our launcher only, no third-party script on the page.
      buildLauncher();
    } else {
      var btn = document.getElementById('widgo-gate-btn');
      if (btn) btn.remove();
      mount();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }

  // A phone that rotates to landscape, or a desktop window narrowed by hand,
  // must not leave a dead widget or a stranded launcher behind.
  var last = isMobile();
  window.addEventListener('resize', function () {
    var now = isMobile();
    if (now === last) return;
    last = now;
    apply();
  });

  // THE ASK ZONE
  // The widget has three states: the Ask Deep bubble, a small welcome card, and
  // the full chat panel, all bottom right. Its DOM sits in a closed shadow root,
  // so we cannot read its size. We can hit-test it: elementFromPoint returns the
  // shadow host for anything inside it. Two short scans (one row, one column)
  // measure how much of the corner it covers right now, and publish that as
  // --ask-w / --ask-h on <html> plus data-ask="none|bubble|card|panel".
  // The footer pads itself by --ask-h and the homepage mare parks left of --ask-w,
  // so nothing the site cares about ends up underneath the widget.
  var html = document.documentElement;
  var isWidget = function (el) {
    if (!el || el === html || el === document.body) return false;
    var root = document.getElementById('root');
    if (root && root.contains(el)) return false;
    return !(el.closest && el.closest('.dhk-overlay, .wx-mare, script, style'));
  };
  var measure = function () {
    var W = window.innerWidth, H = window.innerHeight, x, y, minX = W, minY = H, miss = 0;
    for (x = W - 6; x > W - 560 && x > 0; x -= 8) {
      if (isWidget(document.elementFromPoint(x, H - 28))) { minX = x; miss = 0; } else if (minX < W && (miss += 8) > 32) break;
    }
    miss = 0;
    for (y = H - 6; y > H * 0.1; y -= 8) {
      if (isWidget(document.elementFromPoint(W - 44, y))) { minY = y; miss = 0; } else if (minY < H && (miss += 8) > 32) break;
    }
    var w = minX < W ? W - minX : 0, h = minY < H ? H - minY : 0;
    var state = !w || !h ? 'none' : h < 110 ? 'bubble' : h < 420 ? 'card' : 'panel';
    html.style.setProperty('--ask-w', w + 'px');
    html.style.setProperty('--ask-h', h + 'px');
    if (html.getAttribute('data-ask') !== state) html.setAttribute('data-ask', state);
  };
  var soon = function () { setTimeout(measure, 350); setTimeout(measure, 1100); };
  window.__askZone = measure;
  // The widget loads late and opens itself on a timer, so check a few times early,
  // then every few seconds while the tab is visible. Each check is under 200 hit tests.
  [1200, 3000, 6000, 10000].forEach(function (t) { setTimeout(measure, t); });
  setInterval(function () { if (!document.hidden) measure(); }, 3000);
  window.addEventListener('resize', soon);
  // Clicks inside the widget reach the page retargeted to its host: re-measure after it animates.
  document.addEventListener('click', function (e) { if (isWidget(e.target)) soon(); }, true);
})();
