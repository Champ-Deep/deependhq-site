/* home.js : the homepage island for "The Window". Oct 2026.
   The page is static HTML from scripts/prerender.mjs. This file only adds what
   the markup and CSS cannot do on their own:
     ages          every date recomputes its age in the visitor's browser (IST)
     stale banner  shown when the newest entry is more than two weekdays old
     COMPILE       mono text resolves from glyphs behind a green cursor, once
     pinned day    stage switching by sentinels crossing the viewport middle
     heatmap       readout on hover, focus or tap; arrow keys move by day and week
     hero mare     the braille gallop in the hero, once on load and on hover
     nav drawer    the burger, since React does not run on this page
     cmd+K         loads React, Babel and Palette.jsx on first use only
     eggs          the logo in the console, and the gray mare (type d e e p)
   No scroll listeners. Scroll-linked motion lives in home.css (animation-timeline).
   Everything degrades: without this file the page is complete and still.
   No em dashes. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var RM = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var sup = function (q) { try { return !!(window.CSS && CSS.supports(q)); } catch (e) { return false; } };
  if (sup('animation-timeline: view()') && sup('width: mod(5px, 3px)') && sup('width: round(down, 5px, 2px)')) root.classList.add('wx-cssclock');

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- ages: same rules as Sys.ageOf, computed in IST ---------- */
  function istToday() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }
  function toUTC(iso) { var p = String(iso).split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
  function addDays(iso, n) { return new Date(toUTC(iso) + n * 864e5).toISOString().slice(0, 10); }
  function isWeekend(iso) { var w = new Date(toUTC(iso)).getUTCDay(); return w === 0 || w === 6; }
  function weekdaysAfter(from, to) { if (!from || !to || to <= from) return 0; var n = 0; for (var x = addDays(from, 1); x <= to; x = addDays(x, 1)) if (!isWeekend(x)) n++; return n; }
  var TODAY = istToday();
  function ageOf(iso, mode) {
    var days = Math.round((toUTC(TODAY) - toUTC(iso)) / 864e5);
    var label = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 14 ? days + 'd ago' : days < 60 ? Math.round(days / 7) + 'w ago' : Math.round(days / 30) + 'mo ago';
    if (mode === 'log') { var wd = weekdaysAfter(iso, TODAY); return { label: label, weekdays: wd, state: wd === 0 ? 'fresh' : wd <= 2 ? 'warn' : 'stale' }; }
    var limit = Number(mode) || 21;
    return { label: label, state: days <= Math.floor(limit / 2) ? 'fresh' : days <= limit ? 'warn' : 'stale' };
  }
  d.querySelectorAll('.home-wx time[data-age]').forEach(function (t) {
    var mode = t.getAttribute('data-age'), a = ageOf(t.getAttribute('datetime'), mode === 'plain' ? 99999 : mode);
    t.textContent = a.label;
    if (mode !== 'plain') t.setAttribute('data-state', a.state);
  });

  /* ---------- stale banner, in Deep's voice ---------- */
  var live = d.querySelector('.wx-live[data-newest]');
  if (live) {
    var nd = live.getAttribute('data-newest'), lag = ageOf(nd, 'log'), have = d.querySelector('.sys-banner');
    if (lag.state === 'stale' && !have) {
      var bar = d.createElement('div');
      bar.className = 'sys-banner'; bar.setAttribute('role', 'status');
      bar.innerHTML = '<div class="wrap"><span><b>the log is ' + lag.weekdays + ' weekdays behind.</b> last entry was day ' + esc(live.getAttribute('data-day')) + '. building in public means publishing the misses too.</span><a href="journey.html#day-' + esc(live.getAttribute('data-day')) + '">read the last one →</a></div>';
      var nav = d.querySelector('.sys-nav');
      if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    } else if (lag.state !== 'stale' && have) {
      have.parentNode.removeChild(have);
    }
  }

  /* ---------- COMPILE ---------- */
  var GL = '<>/\\[]{}=+*#01_-:;';
  function compile(el) {
    if (RM || el.__c) return;
    el.__c = 1;
    var html = el.innerHTML, fin = el.textContent, len = fin.length;
    if (!len) return;
    var dur = Math.min(400, 140 + len * 3), t0 = 0;
    var sr = d.createElement('span'); sr.className = 'sr'; sr.textContent = fin;
    var vis = d.createElement('span'); vis.setAttribute('aria-hidden', 'true');
    el.textContent = ''; el.appendChild(sr); el.appendChild(vis); el.classList.add('wx-compiling');
    function frame(t) {
      if (!t0) t0 = t;
      var p = Math.min(1, (t - t0) / dur), k = Math.floor(p * len);
      if (p >= 1) { el.innerHTML = html; el.classList.remove('wx-compiling'); return; }
      var tail = '';
      for (var i = k + 1; i < len; i++) { var c = fin[i]; tail += (c === ' ' || c === '\n') ? c : GL[(Math.random() * GL.length) | 0]; }
      vis.innerHTML = esc(fin.slice(0, k)) + '<span class="wx-cc">█</span><span style="color:var(--dim)">' + esc(tail) + '</span>';
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window && !RM) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { compile(e.target); cio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.2 });
    d.querySelectorAll('.home-wx [data-compile]').forEach(function (el) { if (!el.closest('.wx-hero')) cio.observe(el); });
    setTimeout(function () { d.querySelectorAll('.wx-hero [data-compile]').forEach(compile); }, 520);
  }

  /* ---------- the pinned day ---------- */
  var anat = d.querySelector('.wx-anat');
  if (anat && window.matchMedia) {
    var mq = matchMedia('(min-width: 64rem)');
    var stages = [].slice.call(anat.querySelectorAll('.wx-stage'));
    var term = anat.querySelector('.wx-anat-right .wx-term-body');
    var rail = [].slice.call(anat.querySelectorAll('.wx-anat-rail li'));
    var clockV = anat.querySelector('.wx-anat-clock .wx-v');
    var cur = 0, sio = null;
    if (term && !term.children.length) {
      stages.forEach(function (s, i) {
        s.querySelectorAll('.wx-tl').forEach(function (l) {
          var c = l.cloneNode(true); c.setAttribute('data-s', i + 1); c.removeAttribute('data-compile'); term.appendChild(c);
        });
      });
    }
    var lines = term ? [].slice.call(term.querySelectorAll('.wx-tl')) : [];
    var setStage = function (n) {
      if (n === cur) return;
      cur = n;
      stages.forEach(function (s, i) { s.classList.toggle('wx-active', i + 1 === n); });
      rail.forEach(function (li, i) { if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      if (clockV && stages[n - 1]) clockV.textContent = stages[n - 1].getAttribute('data-hour');
      lines.forEach(function (l) {
        var s = +l.getAttribute('data-s'), on = s <= n, was = l.classList.contains('wx-on');
        l.classList.toggle('wx-on', on); l.classList.toggle('wx-past', s < n);
        if (on && !was && s === n) { l.__c = 0; compile(l); }
      });
    };
    var pin = function () {
      var ok = mq.matches && !RM && 'IntersectionObserver' in window;
      anat.classList.toggle('wx-is-pinned', ok);
      if (sio) { sio.disconnect(); sio = null; }
      if (ok) {
        sio = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) setStage(+e.target.getAttribute('data-s')); });
        }, { rootMargin: '-50% 0px -49.5% 0px', threshold: 0 });
        anat.querySelectorAll('.wx-anat-sent').forEach(function (x) { sio.observe(x); });
        if (!cur) setStage(1);
      }
    };
    pin();
    if (mq.addEventListener) mq.addEventListener('change', pin); else if (mq.addListener) mq.addListener(pin);
  }

  /* ---------- heatmap readout ---------- */
  var heat = d.querySelector('.wx-heat-grid'), out = d.querySelector('.wx-readout');
  if (heat && out) {
    var hs = heat.parentNode;
    if (hs && hs.scrollWidth > hs.clientWidth) hs.scrollLeft = hs.scrollWidth; /* newest weeks first on phones */
    var cells = [].slice.call(heat.querySelectorAll('.wx-cell'));
    cells.forEach(function (c) {
      if (c.getAttribute('data-date') === TODAY && !c.getAttribute('data-day')) {
        c.classList.remove('wx-gap'); c.classList.add('wx-today'); c.setAttribute('data-kind', 'today, not written yet');
        c.setAttribute('aria-label', c.getAttribute('data-label') + ', today, not written yet');
      }
    });
    var show = function (c) {
      var day = c.getAttribute('data-day'), label = c.getAttribute('data-label'), kind = c.getAttribute('data-kind');
      out.innerHTML = day
        ? '<span><b>day ' + esc(day) + '</b> · ' + esc(label) + ' · ' + esc(kind) + '</span><span>' + esc(c.getAttribute('data-ship') || '') + '…</span><a class="wx-tlink" href="journey.html#day-' + esc(day) + '">open day ' + esc(day) + ' →</a>'
        : '<span><b>' + esc(label) + '</b> · ' + esc(kind) + '</span>';
    };
    cells.forEach(function (c) {
      c.addEventListener('mouseenter', function () { show(c); });
      c.addEventListener('focus', function () { show(c); });
      c.addEventListener('click', function () { show(c); });
    });
    heat.addEventListener('keydown', function (e) {
      var i = cells.indexOf(d.activeElement), m = { ArrowRight: 7, ArrowLeft: -7, ArrowDown: 1, ArrowUp: -1 }[e.key];
      if (i < 0 || !m) return;
      e.preventDefault();
      var j = Math.max(0, Math.min(cells.length - 1, i + m));
      cells[i].tabIndex = -1; cells[j].tabIndex = 0; cells[j].focus();
    });
  }

  /* ---------- hero mare: identity kit v1 ----------
     The vector mare is a <button> in the prerendered hero. Her trot-in, the
     blaze flicker and the smear stretch are pure CSS (home.css). Click, Enter
     or Space sends the braille gallop egg along the bottom of the screen. */
  var hm = d.querySelector('.wx-hx-mare');
  if (hm) hm.addEventListener('click', function () { window.dispatchEvent(new CustomEvent('dh:mare')); });

  /* ---------- weekly narratives: inline listen ----------
     The latest essay's audio plays right here. The <audio> element is made on
     the first click, so the homepage downloads nothing until someone asks. */
  var wp = d.querySelector('.wx-wplay[data-src]');
  if (wp) {
    var wbtn = wp.querySelector('.wx-wplay-btn'), wbar = wp.querySelector('.wx-wplay-bar i'), wt = wp.querySelector('.wx-wplay-t');
    var wdur = parseFloat(wp.getAttribute('data-dur')) || 0, wa = null;
    var wclock = function (x) { x = Math.max(0, Math.round(x)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
    wbtn.addEventListener('click', function () {
      if (!wa) {
        wa = new Audio(wp.getAttribute('data-src'));
        wa.preload = 'auto';
        wa.addEventListener('play', function () { wp.classList.add('is-playing'); wbtn.setAttribute('aria-label', 'Pause'); });
        wa.addEventListener('pause', function () { wp.classList.remove('is-playing'); wbtn.setAttribute('aria-label', 'Play'); });
        wa.addEventListener('ended', function () { wp.classList.remove('is-playing'); });
        wa.addEventListener('timeupdate', function () {
          var dur = wa.duration && isFinite(wa.duration) ? wa.duration : wdur;
          if (wbar && dur) wbar.style.setProperty('--p', (100 * wa.currentTime / dur).toFixed(1) + '%');
          if (wt) wt.textContent = wclock(wa.currentTime) + ' / ' + wclock(dur);
        });
      }
      if (wa.paused) wa.play().catch(function () {}); else wa.pause();
    });
  }

  /* ---------- easter eggs: the logo in the console, and the gray mare ----------
     Type d e e p anywhere on the page (or the Konami code), click the hero
     mare or the cursor, or run "mare" from cmd+K. She gallops in from the left on
     Eadweard Muybridge's 1878 frames (15 of them, drawn in braille, fetched from
     /mare.json on first use), slows, and stops just left of the Ask Deep widget,
     whichever state it is in, so she never hides under it. Her legs advance with
     the distance she covers, so they slow as she does, and the last frame lands
     on the still pose. The art lives in scripts/art.mjs. */
  var LOGO = ["     █████                                ███","    ░░███                                ░░░███","  ███████   ██████   ██████  ████████      ░░░███"," ███░░███  ███░░███ ███░░███░░███░░███       ░░░███","░███ ░███ ░███████ ░███████  ░███ ░███        ███░","░███ ░███ ░███░░░  ░███░░░   ░███ ░███      ███░","░░████████░░██████ ░░██████  ░███████     ███░      █████████"," ░░░░░░░░  ░░░░░░   ░░░░░░   ░███░░░     ░░░       ░░░░░░░░░","                             ░███","                             █████","                            ░░░░░"];
  var LOGO_SPLIT = 38;
  var STILL = "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣾⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⠟⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⣿⣿⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⣠⣴⣶⣶⣶⣶⣄⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀\n⠀⠀⠀⠀⢀⣀⣀⣀⡀⠀⠀⠀⢀⣠⣤⣤⣄⣀⣠⣤⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀\n⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠈⢿⣿⣿⡇\n⠀⠀⠀⠀⠻⠟⠁⠀⠀⠀⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡏⠀⠀⠀⠀⠀⢹⣿⡿\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⡟⠉⠉⠛⠛⠿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣤⣄⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⡿⠛⢻⣿⡿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠙⢿⣿⣿⡿⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⣰⣿⠟⠋⠀⠀⣾⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⣿⡇⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⣰⡟⠃⠀⠀⠀⢸⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣄⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⣰⡟⠀⠀⠀⠀⠀⠀⢻⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⠁⠹⣧⣀⠀⠀⠀\n⠀⠀⠀⠀⠀⢿⠀⠀⠀⠀⠀⠀⠀⠀⢻⣆⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⠒⠀⠀";
  try {
    // Console styles cannot read custom properties, so read the tokens once.
    var cs = getComputedStyle(d.documentElement);
    var tk = function (n, f) { return (cs.getPropertyValue(n) || '').trim() || f; };
    var cText = tk('--text', '#F4EBD9'), cWin = tk('--win', '#F4A62A'), cMuted = tk('--muted', '#A9ABA6'), cDim = tk('--dim', '#9098AA');
    var fmt = '', st = [];
    LOGO.forEach(function (l) {
      fmt += '%c' + l.slice(0, LOGO_SPLIT) + '%c' + l.slice(LOGO_SPLIT) + '\n';
      st.push('color:' + cText + ';font-family:monospace;line-height:1.05', 'color:' + cWin + ';font-family:monospace;line-height:1.05');
    });
    fmt += '\n%c' + STILL + '\n%c' + "after Eadweard Muybridge, The Horse in Motion, 1878. public domain." + '\n\n%c' +
      'hello, console reader.\nthis page is prerendered html plus one small script. no framework.\n' +
      'for machines: /llms.txt and /agents.txt. for humans: /humans.txt\n' +
      'type d e e p on the page, or press cmd+K and try "mare".\n' +
      'book 30 minutes: https://scheduler.zoom.us/sreedeep';
    st.push('color:' + cMuted + ';line-height:1', 'color:' + cDim + ';font-family:monospace;font-size:10px', 'color:' + cText + ';font-family:monospace;font-size:12px;line-height:1.5');
    console.log.apply(console, [fmt].concat(st));
  } catch (e) {}

  var mareData = null, mareLoading = null;
  var loadMare = function () {
    if (mareData) return Promise.resolve(mareData);
    if (!mareLoading) {
      mareLoading = fetch('mare.json').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { if (j && j.frames && j.frames.length) mareData = j; return mareData; })
        .catch(function () { return null; })
        .then(function (j) { mareLoading = null; return j; });
    }
    return mareLoading;
  };
  var DUST = '\u2801\u2802\u2804\u2840\u2808\u2810\u2820\u2880';
  var mareBusy = false;
  var gallop = function (j) {
    var frames = j ? j.frames.map(function (f) { return f.join('\n'); }) : [STILL];
    var still = j ? frames[j.still || 0] : STILL, n = frames.length, si = j ? (j.still || 0) : 0;
    var el = d.createElement('div'); el.className = 'wx-mare'; el.setAttribute('aria-hidden', 'true');
    var say = d.createElement('p'); say.className = 'wx-mare-say'; say.textContent = 'sundays at sunrise.';
    var pre = d.createElement('pre'); pre.textContent = still;
    var dust = d.createElement('span'); dust.className = 'wx-mare-dust';
    var cap = d.createElement('small'); cap.textContent = 'after muybridge, 1878'; say.appendChild(cap);
    el.appendChild(say); el.appendChild(dust); el.appendChild(pre); d.body.appendChild(el);
    var W = window.innerWidth;
    /* Braille comes from whichever system font has it, and its advance runs from
       about 0.55em to 0.75em. Measure it, then size the sprite to a fixed width and
       set the line height so the dots keep the pitch the frames were drawn for. */
    var cols = (frames[0].split('\n')[0] || '').length || 40, cs = getComputedStyle(pre);
    var fs0 = parseFloat(cs.fontSize) || 12;
    var inner = pre.getBoundingClientRect().width - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    var ratio = inner > 0 ? inner / cols / fs0 : 0.6;
    var target = W <= 768 ? Math.min(210, W * 0.56) : 300;
    var fs = Math.max(6, Math.min(16, target / (cols * ratio)));
    pre.style.fontSize = dust.style.fontSize = fs.toFixed(2) + 'px';
    pre.style.lineHeight = dust.style.lineHeight = (fs * ratio * 5 / 3).toFixed(2) + 'px';
    var w = el.offsetWidth;
    /* park left of whatever the Ask Deep widget covers right now (bubble, card or
       panel), measured by widgo-gate.js as --ask-w. Never closer than the phone launcher. */
    if (window.__askZone) try { window.__askZone(); } catch (e) {}
    var askW = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--ask-w')) || 0;
    var stop = Math.max(8, W - w - Math.max(askW, 72) - 24);
    var done = function () { if (el.parentNode) el.parentNode.removeChild(el); mareBusy = false; };
    var talk = function () {
      el.classList.add('wx-mare-talk');
      setTimeout(function () {
        if (RM || !el.animate) return done();
        el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).onfinish = done;
      }, 2800);
    };
    if (RM || n < 2) { el.style.transform = 'translateX(' + stop + 'px)'; talk(); return; }
    var from = -w - 40, dist = stop - from;
    var T = Math.max(2400, dist * 3.2);               /* ms; ease-out, so she arrives slowing */
    var per = w / 9;                                  /* px of ground per frame: one stride is about 1.7 body lengths */
    var laps = Math.max(1, Math.round(dist / per / n));
    per = dist / (laps * n);                          /* land exactly on the still frame */
    var t0 = 0, last = -1, raf = 0;
    var tick = function (t) {
      if (!t0) t0 = t;
      var u = Math.min(1, (t - t0) / T), p = 1 - (1 - u) * (1 - u), x = from + dist * p;
      el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
      var fi = (si + Math.floor((x - from) / per)) % n;
      if (fi !== last) {
        last = fi; pre.textContent = frames[fi];
        var s = '', v = 1 - u;
        for (var k = 0; k < 5; k++) s += Math.random() < v * 0.8 ? DUST.charAt((Math.random() * 8) | 0) : '\u2800';
        dust.textContent = s; dust.style.opacity = v.toFixed(2);
      }
      if (u < 1) raf = requestAnimationFrame(tick);
      else { pre.textContent = still; dust.textContent = ''; talk(); }
    };
    raf = requestAnimationFrame(tick);
  };
  var mare = function () {
    if (mareBusy) return;
    mareBusy = true;
    loadMare().then(gallop, function () { gallop(null); });
  };
  window.addEventListener('dh:mare', mare);
  var cursorEl = d.querySelector('.wx-hero .wx-cursor');
  if (cursorEl) cursorEl.addEventListener('click', mare);
  var typed = '', KONAMI = 'ArrowUp,ArrowUp,ArrowDown,ArrowDown,ArrowLeft,ArrowRight,ArrowLeft,ArrowRight,b,a', keys = [];
  d.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName;
    if (e.metaKey || e.ctrlKey || e.altKey || tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    keys.push(e.key); if (keys.length > 10) keys.shift();
    if (keys.join(',') === KONAMI) { keys = []; mare(); return; }
    if (e.key && e.key.length === 1) { typed = (typed + e.key.toLowerCase()).slice(-4); if (typed === 'deep') { typed = ''; mare(); } }
  });

  /* ---------- nav drawer (React does not run on this page) ---------- */
  var burger = d.querySelector('.nav-burger'), drawer = d.getElementById('nav-drawer');
  if (burger && drawer) {
    var setOpen = function (o) {
      drawer.setAttribute('data-open', String(o));
      burger.setAttribute('aria-expanded', String(o));
      burger.setAttribute('aria-label', o ? 'close menu' : 'open menu');
    };
    burger.addEventListener('click', function () { setOpen(drawer.getAttribute('data-open') !== 'true'); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer.getAttribute('data-open') === 'true') { setOpen(false); burger.focus(); } });
  }

  /* ---------- copy the email ---------- */
  d.querySelectorAll('.home-wx [data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = b.getAttribute('data-copy');
      var done = function () { b.textContent = 'copied'; setTimeout(function () { b.textContent = 'copy'; }, 1600); };
      var selectIt = function () { var m = d.querySelector('.wx-mail'), r = d.createRange(); r.selectNodeContents(m); var s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = 'selected'; };
      try { navigator.clipboard.writeText(v).then(done, selectIt); } catch (e) { selectIt(); }
    });
  });

  /* ---------- cmd+K: load the palette on first use ----------
     The other pages load React and Babel up front. The homepage does not, so
     the palette pulls them in only when someone asks for it. Compiled code is
     injected as an inline script, which the Worker CSP allows (no eval). */
  var CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  var LIBS = [
    [CDN + 'react/18.3.1/umd/react.production.min.js', 'sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z'],
    [CDN + 'react-dom/18.3.1/umd/react-dom.production.min.js', 'sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1'],
    [CDN + 'babel-standalone/7.29.0/babel.min.js', 'sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y'],
  ];
  var palState = 0; /* 0 idle, 1 loading, 2 ready */
  var loadScript = function (src, sri) {
    return new Promise(function (res, rej) {
      var s = d.createElement('script'); s.src = src; s.async = false;
      if (sri) { s.integrity = sri; s.crossOrigin = 'anonymous'; }
      s.onload = res; s.onerror = rej; d.head.appendChild(s);
    });
  };
  var openPalette = function () {
    palState = 1;
    var chain = window.DH_DATA ? Promise.resolve() : loadScript('data.js');
    LIBS.forEach(function (l) { chain = chain.then(function () { return loadScript(l[0], l[1]); }); });
    chain
      .then(function () { return fetch('Palette.jsx', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('palette'); return r.text(); }); })
      .then(function (code) {
        var js = window.Babel.transform(code, { presets: ['react'] }).code;
        var s = d.createElement('script'); s.textContent = js; d.head.appendChild(s);
        var host = d.createElement('div'); host.id = 'dhk-root'; d.body.appendChild(host);
        window.ReactDOM.createRoot(host).render(window.React.createElement(window.CommandPalette));
        palState = 2;
        setTimeout(function () { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true, bubbles: true })); }, 150);
      })
      .catch(function () { palState = 0; location.href = 'journey.html'; });
  };
  window.addEventListener('keydown', function (e) {
    if (palState === 2) return;
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (palState === 0) openPalette(); }
  });
})();
