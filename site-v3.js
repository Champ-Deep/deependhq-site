// Vanilla ports of 21st.dev 43022 (Bayer dissolve) and 18575 (text reveal).
// Source subjects and accessibility text remain prerendered, never on canvas.
(function () {
  var hero = document.querySelector('.v3-hero');
  if (!hero) return;
  var canvas = hero.querySelector('.v3-dither');
  var ctx = canvas.getContext('2d');
  var text = hero.querySelector('[data-v3-encrypted]');
  var message = text.textContent;
  var button = hero.querySelector('.v3-replay');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}';
  var bayer = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21];
  var frame = 0, start = 0, lastFlip = 0;
  function paint(progress) {
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    for (var y = 0; y < 64; y++) {
      var edge = Math.max(0, (y / 64 - 0.64) / 0.36);
      var coverage = Math.max(edge, 1 - progress * 1.35 + y / 64 * 0.25);
      for (var x = 0; x < 64; x++) {
        if ((bayer[(x & 7) | ((y & 7) << 3)] + 0.5) / 64 < coverage) ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  function settle() {
    cancelAnimationFrame(frame);
    frame = 0;
    text.textContent = message;
    hero.classList.remove('v3-playing');
    hero.dataset.phase = 'settled';
    paint(1);
    button.hidden = reduced.matches;
  }
  function tick(now) {
    var progress = Math.min(1, (now - start) / 1100);
    paint(progress);
    if (now - lastFlip >= 55) {
      text.textContent = message.split('').map(function (c, i) {
        return c === ' ' || i < Math.floor(progress * message.length) ? c : chars[Math.floor(Math.random() * chars.length)];
      }).join('');
      lastFlip = now;
    }
    if (progress < 1) frame = requestAnimationFrame(tick);
    else settle();
  }
  function play() {
    if (reduced.matches || document.hidden) return settle();
    cancelAnimationFrame(frame);
    hero.classList.remove('v3-playing');
    void hero.offsetWidth;
    hero.classList.add('v3-playing');
    hero.dataset.phase = 'playing';
    start = performance.now();
    lastFlip = 0;
    frame = requestAnimationFrame(tick);
  }
  button.addEventListener('click', play);
  reduced.addEventListener('change', settle);
  document.addEventListener('visibilitychange', function () { if (document.hidden) settle(); });
  settle();
  // One bounded introduction, never an always-running animation or preloader.
  play();
})();
