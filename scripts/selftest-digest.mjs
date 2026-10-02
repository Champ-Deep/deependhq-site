// selftest-digest.mjs : assert the weekly report tells the truth.
//
// WHY THIS FILE IS THE POINT
// The digest's failure mode is not a crash, it is confidence. A weekly report
// full of causal claims built on nine visitors reads well, gets acted on, and is
// worse than no report at all. So the wording is the product, and the wording is
// what gets tested here: that it says inconclusive at small n, that it names the
// control group, that it reports a LOSING arm instead of burying it, and that it
// never uses causal language without a sample size attached.
//
// It calls the real render() from digest-render.mjs with fixtures, rather than
// shelling out to digest.mjs. A function that calls process.exit cannot be fed a
// fixture, which is exactly why rendering was split out from collection.
//
//   node scripts/selftest-digest.mjs

import { render, MIN_N } from './digest-render.mjs';

let pass = 0;
const fails = [];
const check = (name, got, want) => {
  if (got === want) pass++;
  else fails.push(`${name}\n      got  ${got}\n      want ${want}`);
};
const has = (name, text, needle) => check(name, text.includes(needle), true);
const hasNot = (name, text, needle) => check(name, text.includes(needle), false);

console.log('\ndigest selftest\n');

// ---------------------------------------------------------------- scenarios

// 1. No data at all. The most important case, because it is the one we are in
//    right now, and the easiest to fake convincingly.
{
  const t = render({ totals: [], segRows: [] }, { days: 7 });
  console.log('empty dataset');
  has('empty: says nothing was recorded', t, 'Nothing recorded');
  has('empty: names the likely cause', t, 'dataset did not exist');
  has('empty: admits it cannot recover', t, 'gone and cannot be recovered');
  has('empty: refuses to go further', t, 'honestly');
  hasNot('empty: does not claim a winner', t, 'Beating control');
  hasNot('empty: does not emit a recommendation', t, '## Recommendation');
}

// 2. Every visitor treated, nobody in control. The personalization becomes
//    unfalsifiable, and that has to be the loudest thing in the report.
{
  const t = render({
    totals: [{ views: 40 }, { views: 30 }],
    segRows: [
      { segment: 'operator', views: 40, visitors: 12, ctas: 3 },
      { segment: 'narrative', views: 30, visitors: 9, ctas: 2 },
    ],
  }, { days: 7 });
  console.log('control group missing');
  has('no control: says the control is missing', t, 'control group is missing');
  has('no control: says why that matters', t, 'cannot be evaluated');
  hasNot('no control: claims a winner', t, 'Beating control');
}

// 3. Treated arms below the sample floor. Must not conclude anything.
{
  const t = render({
    totals: [{ views: 81 }, { views: 200 }],
    segRows: [
      { segment: 'operator', views: 12, visitors: 5, ctas: 2 },
      { segment: 'narrative', views: 9, visitors: 3, ctas: 1 },
      { segment: 'explorer', views: 60, visitors: 40, ctas: 4 },
    ],
  }, { days: 7 });
  console.log('thin samples');
  has('thin: labels rows inconclusive', t, 'inconclusive');
  // The sentence wraps across lines, so assert on a phrase that does not.
  has('thin: states no change is warranted', t, 'warranted, and none has been made');
  has('thin: says the engine is on control', t, 'running control');
  hasNot('thin: claims a winner', t, 'Beating control');
  hasNot('thin: claims a loser', t, 'Losing to control');
}

// 4. A genuine loss. This is the scenario a flattering report would hide.
{
  const t = render({
    totals: [{ views: 750 }, { views: 950 }],
    segRows: [
      { segment: 'operator', views: 200, visitors: 80, ctas: 2 },
      { segment: 'explorer', views: 400, visitors: 200, ctas: 40 },
    ],
    bandRows: [{ band: 'cold', visits: 200, intent: 0 }],
  }, { days: 7 });
  console.log('treatment losing to control');
  has('loss: is reported', t, 'Losing to control');
  has('loss: recommends control instead', t, 'serve these the control');
  has('loss: explains the harm', t, 'worse than no treatment');
  hasNot('loss: does not spin it as a win', t, 'Beating control');
}

// 5. A real win, with its sample size attached.
{
  const t = render({
    totals: [{ views: 800 }, { views: 700 }],
    segRows: [
      { segment: 'operator', views: 220, visitors: 90, ctas: 40 },
      { segment: 'explorer', views: 420, visitors: 210, ctas: 42 },
    ],
    bandRows: [{ band: 'hot', visits: 40, intent: 260 }],
  }, { days: 7 });
  console.log('treatment beating control');
  has('win: is reported', t, 'Beating control');
  has('win: carries the sample size', t, 'n=90');
}

// 6. Visitors dismissing the ask. A high dismiss rate is a signal to loosen it,
//    not to ignore.
{
  const t = render({
    totals: [{ views: 400 }, { views: 380 }],
    segRows: [
      { segment: 'operator', views: 100, visitors: 40, ctas: 8 },
      { segment: 'explorer', views: 300, visitors: 150, ctas: 30 },
    ],
    askRows: [
      { answer: 'skip', question: 'found_you', n: 38 },
      { answer: 'no', question: 'found_you', n: 6 },
      { answer: 'yes', question: 'found_you', n: 2 },
    ],
  }, { days: 7 });
  console.log('ask being dismissed');
  has('ask: reports the split with dismissals counted', t, '38 dismissed');
  has('ask: reads a high dismiss rate as too aggressive', t, 'too aggressive');
}

// ---------------------------------------------------------------- always
console.log('every scenario');
for (const [name, data] of [
  ['thin', { totals: [{ views: 5 }], segRows: [{ segment: 'operator', views: 5, visitors: 2, ctas: 0 }, { segment: 'explorer', views: 3, visitors: 2, ctas: 0 }] }],
  ['rich', { totals: [{ views: 5000 }], segRows: [{ segment: 'operator', views: 2000, visitors: 900, ctas: 300 }, { segment: 'explorer', views: 3000, visitors: 1500, ctas: 200 }] }],
]) {
  const t = render(data, { days: 7 });
  // Causal language is only ever allowed alongside a number. These words with no
  // sample attached are how a report starts lying.
  const bare = t.match(/\b(therefore|proves|clearly better|more engaging|conclusively)\b/gi);
  check(`${name}: no unquantified causal language`, bare === null, true);
  has(`${name}: states the sample floor it uses`, t, `n=${MIN_N}`);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('digest selftest: every scenario reported honestly.');