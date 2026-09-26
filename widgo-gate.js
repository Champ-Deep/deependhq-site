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
})();
