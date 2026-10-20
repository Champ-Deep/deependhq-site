// Single pre-paint scheme controller, inlined into every page by the build.
(function (d) {
  var mode = 'system';
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  try { var saved = localStorage.getItem('dh_scheme'); if (saved === 'light' || saved === 'dark') mode = saved; } catch (_) {}
  function label() {
    d.querySelectorAll('[data-dh-scheme-label]').forEach(function (el) { el.textContent = mode; });
    d.querySelectorAll('[data-dh-scheme]').forEach(function (el) { el.setAttribute('aria-label', 'Colour scheme: ' + mode + '. Change scheme'); });
  }
  function apply() {
    var scheme = mode === 'system' ? (media && media.matches ? 'light' : 'dark') : mode;
    d.documentElement.dataset.scheme = scheme;
    var meta = d.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = scheme === 'light' ? '#F6F5F2' : '#0E1A33';
    window.DH_SCHEME = { mode: mode, scheme: scheme };
    label();
    window.dispatchEvent(new CustomEvent('dh:scheme', { detail: window.DH_SCHEME }));
  }
  apply();
  d.addEventListener('DOMContentLoaded', label);
  if (media) media.addEventListener('change', apply);
  d.addEventListener('click', function (e) {
    if (!e.target.closest('[data-dh-scheme]')) return;
    mode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    try { if (mode === 'system') localStorage.removeItem('dh_scheme'); else localStorage.setItem('dh_scheme', mode); } catch (_) {}
    apply();
  });
  new MutationObserver(function () {
    var el = d.querySelector('[data-dh-scheme-label]');
    if (el && el.textContent !== mode) label();
  }).observe(d.documentElement, { childList: true, subtree: true });
})(document);
