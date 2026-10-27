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
})();
