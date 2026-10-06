// ask.js : one question, one time, to the people least likely to be biased.
//
// THE PRECONDITIONS ARE THE POINT
// This is the only thing on the site that talks to a visitor unprompted, so the
// conditions are deliberately strict. Every one of them exists to stop the ask
// from contaminating the signal it is meant to collect:
//
//   1. cold band only. Someone who already booked, or clicked book a call, or is
//      clearly a peer has nothing useful to tell us about what is missing.
//   2. a post page only. On the homepage the visitor has no context yet, so
//      they cannot judge whether the site found them.
//   3. past 60% scroll. They have read enough to have an opinion.
//   4. once per browser, ever. Not once per session. A second ask is an
//      interruption, and interrupted people answer badly or lie to get rid of it.
//   5. it must be dismissible with one click, and "no" is a recorded answer of
//      equal weight to "yes". A skip is a data point, not a non-event.
//
// WHY IT IS NOT A MODAL
// A modal on a site that says "no cookies, no trackers" is a contradiction the
// visitor can feel even if they cannot name it. This is a quiet inline strip at
// the end of the article, in the site's own voice, that can be dismissed and
// never comes back.
//
// WHAT THE ANSWER IS FOR
// It is a qualitative signal to sit beside the quantitative one. A visitor who
// says "I could not tell what you do" is reporting a real defect that no scroll
// depth would ever reveal, because a person who bounces at 20% looks identical
// to a person who got what they came for.

(function () {
  const KEY = 'dh_ask_v1';

  // One question, answerable in one tap. Deliberately about the site, not about
  // the visitor, and never a satisfaction rating, which is the one form of
  // feedback that reliably does not change anything anyone does.
  const QUESTIONS = [
    { id: 'found_you', text: 'Did this page tell you what I actually do?', yes: 'yes, clearly', no: 'no' },
    { id: 'missing', text: 'What were you looking for and did not find?', yes: 'it was here', no: 'it was missing' },
  ];

  function isEligible() {
    if (!window.DHVisitor || !window.DHSegment) return false;
    if (!/^\/post\//.test(location.pathname)) return false;   // post pages only
    const el = document.documentElement;
    if (el.getAttribute('data-segment') === 'operator') return false; // peers
    if (el.getAttribute('data-intent') !== 'cold') return false;      // converted
    if (sessionStorage.getItem(KEY)) return false;                    // asked already
    if (!window.DHVisitor.claimAsk()) return false;                   // browser cap
    sessionStorage.setItem(KEY, '1');
    return true;
  }

  // Only after a real read, not on load.
  function onScroll() {
    const doc = document.documentElement;
    const max = (doc.scrollHeight - window.innerHeight) || 1;
    if (window.scrollY / max >= 0.6) {
      removeEventListener('scroll', onScroll, { passive: true });
      show();
    }
  }

  function show() {
    const q = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
    const host = document.createElement('div');
    host.setAttribute('data-dh-ask', '');
    host.style.cssText = [
      'max-width:640px', 'margin:32px auto 8px', 'padding:16px 18px',
      'border:1px solid var(--line)', 'border-radius:4px',
      'font:400 15px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace',
      'color:var(--text)', 'background:var(--card)',
    ].join(';');

    host.innerHTML =
      '<p style="margin:0 0 10px">' + q.text + '</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" data-dh-ask-yes style="cursor:pointer;padding:6px 12px;border-radius:3px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit">' + q.yes + '</button>' +
      '<button type="button" data-dh-ask-no style="cursor:pointer;padding:6px 12px;border-radius:3px;border:1px solid var(--line);background:transparent;color:var(--muted);font:inherit">' + q.no + '</button>' +
      '<button type="button" data-dh-ask-skip style="cursor:pointer;padding:6px 12px;border:0;background:transparent;color:var(--muted);font:inherit;text-decoration:underline">no thanks</button>' +
      '</div>';

    // Append to the article if there is one, otherwise to the page.
    const anchor = document.querySelector('article') || document.querySelector('main') || document.body;
    anchor.appendChild(host);

    function answer(kind, text) {
      // "no thanks" and "no" are BOTH recorded. A dismissal that vanishes into
      // the analytics would tell me the ask is too aggressive without telling me
      // so, which is the failure mode that quietly kills these.
      window.DHVisitor.setAskAnswer(text);
      if (window.DHTrack) {
        window.DHTrack('ask', {
          q: q.id,
          a: kind,
          text: String(text || '').slice(0, 200),
          path: location.pathname,
          segment: document.documentElement.getAttribute('data-segment') || '',
        });
      }
      host.remove();
    }

    host.querySelector('[data-dh-ask-yes]').addEventListener('click', function () { answer('yes', q.yes); });
    host.querySelector('[data-dh-ask-no]').addEventListener('click', function () { answer('no', q.no); });
    host.querySelector('[data-dh-ask-skip]').addEventListener('click', function () { answer('skip', 'no thanks'); });
  }

  if (isEligible()) addEventListener('scroll', onScroll, { passive: true });
})();