// Classic is the public site's only look. No saved preference or switch.
(function () {
  document.documentElement.dataset.scheme = 'dark';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#0D0F14';
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var menu = document.querySelector('.v3-dock-mobile[open]');
    if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
  });
  // The fixed dock retreats while the footer is in view, so it never covers the wordmark. Nodes are queried
  // per frame because the React pages re-render the footer and the dock after this script runs.
  var queued = false;
  function place() {
    queued = false;
    var foot = document.querySelector('.sys-footer');
    var away = !!foot && foot.getBoundingClientRect().top < innerHeight;
    if (away) document.documentElement.setAttribute('data-dock-away', '');
    else document.documentElement.removeAttribute('data-dock-away');
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  addEventListener('load', queue);
})();
