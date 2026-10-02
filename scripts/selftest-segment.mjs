// selftest-segment.mjs : prove the classifier and the intent scorer behave.
//
// WHY THIS IS A FILE AND NOT A COMMENT
// The control group is the whole basis on which the personalization claim rests.
// If "explorer" silently stops existing, or if cold visitors start getting
// nudged, the engine stops being falsifiable and Deep would never know. Those are
// exactly the kind of bugs that do not throw, they just quietly make the numbers
// flattering. So they get asserted.
//
//   node scripts/selftest-segment.mjs
//
// Imports the real segment.js, not a copy, so the test cannot drift from the
// thing it is testing.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const src = readFileSync(join(root, 'segment.js'), 'utf8');

// segment.js is an IIFE that attaches to window, so give it one.
const box = { window: {} };
box.window = box;
vm.createContext(box);
vm.runInContext(src, box, { filename: 'segment.js' });
const S = box.window.DHSegment;

let pass = 0;
const fails = [];

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++;
  else fails.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
}

console.log('\nsegment selftest\n');

// ---------------------------------------------------------------- classification
console.log('classification');

check('github referrer is operator',
  S.classify({ path: '/', refHost: 'github.com' }), 'operator');

check('linkedin referrer is narrative',
  S.classify({ path: '/', refHost: 'www.linkedin.com' }), 'narrative');

check('bluesky referrer is narrative',
  S.classify({ path: '/', refHost: 'bsky.app' }), 'narrative');

check('direct visit is the control',
  S.classify({ path: '/', refHost: '' }), 'explorer');

check('unknown referrer is the control',
  S.classify({ path: '/', refHost: 'news.ycombinator.com' }), 'explorer');

check('visiting the stack unprompted is operator',
  S.classify({ path: '/toolkit', refHost: '' }), 'operator');

check('a post is narrative',
  S.classify({ path: '/post/week-45-the-wall-we-named/', refHost: '' }), 'narrative');

check('a referrer beats the path',
  S.classify({ path: '/post/week-45-the-wall-we-named/', refHost: 'github.com' }), 'operator');

// The control must be reachable from every starting point. If it is not, the
// comparison that justifies the whole system is impossible.
const control = S.classify({ path: '/', refHost: '' }) === 'explorer';
if (!control) fails.push('the explorer control group is unreachable');
else pass++;

// Every landing page must classify to something valid.
const PAGES = ['/', '/writing', '/journey', '/now', '/toolkit', '/command',
  '/pillars', '/privacy', '/post/x/', '/company/x/', '/nonsense/deep/path'];
for (const p of PAGES) {
  const got = S.classify({ path: p, refHost: '' });
  if (S.SEGMENTS.indexOf(got) === -1) fails.push(`${p} classified to invalid segment "${got}"`);
  else pass++;
}

// ---------------------------------------------------------------- intent
console.log('intent scoring');

check('a bounce scores zero, not negative',
  S.scoreIntent({ dwellSecs: 2 }).score, 0);

check('clicking book a call is worth 3',
  S.scoreIntent({ ctaClicked: true }).score, 3);

check('a deep read plus a cta is 5, which is warm',
  S.scoreIntent({ ctaClicked: true, maxScroll: 80 }).score, 5);

// Hot needs 6. The cheapest honest route there is a cta (3) plus a company page
// (1) plus being a return visit (1) plus a client outbound (1).
check('cta + company + client outbound + returning is hot',
  S.band(S.scoreIntent({
    ctaClicked: true, path: '/company/lake-b2b/',
    outboundLabels: ['client_site'], visits: 2,
  }).score), 'hot');

check('a single cta click is warm, not hot',
  S.band(S.scoreIntent({ ctaClicked: true }).score), 'warm');

check('a cold visitor is cold',
  S.band(S.scoreIntent({}).score), 'cold');

check('a company page visit is worth 1',
  S.scoreIntent({ path: '/company/lake-b2b/' }).score, 1);

// The bounce penalty is suppressed once a real signal fired. Clicking book a
// call and hitting back in 4s is still the strongest intent the site records, so
// it scores 3 and the "why" says so out loud.
check('a fast exit after a real signal does not cancel it',
  S.scoreIntent({ ctaClicked: true, dwellSecs: 3 }).score, 3);

check('and the reason explains why it was not penalised',
  /after a real signal/.test(S.scoreIntent({ ctaClicked: true, dwellSecs: 3 }).why), true);

// A genuine bounce, nothing else, stays at zero.
check('a pure bounce is still zero',
  S.scoreIntent({ dwellSecs: 2 }).score, 0);

// The score must never go below zero, because a negative score would put a
// genuinely interested visitor into the cold band because they loaded fast.
check('score floors at zero',
  S.scoreIntent({ dwellSecs: 0, maxScroll: 0 }).score, 0);

// ---------------------------------------------------------------- treatment
console.log('treatment, and the no-touch rule');

// THE rule. Cold means nothing happens. If this ever changes, the site starts
// nudging people who did not ask, and the bounce shows up as worse engagement.
check('cold gets nothing',
  S.treatment('cold'),
  { cta_above_fold: false, copy: 'default', ask: true, note: 'cold visitors get the control experience' });

check('warm tightens but does not push',
  S.treatment('warm').cta_above_fold, false);

check('hot lifts the cta',
  S.treatment('hot').cta_above_fold, true);

// Nobody but cold is asked the question, so the answer is not contaminated by
// people who already converted.
check('hot is not asked', S.treatment('hot').ask, false);
check('warm is not asked', S.treatment('warm').ask, false);

// ---------------------------------------------------------------- the ask
console.log('the one-question ask');

check('the ask is available to cold only',
  S.treatment('cold').ask && !S.treatment('warm').ask && !S.treatment('hot').ask, true);

// ---------------------------------------------------------------- report
console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('segment selftest: all assertions hold.');
