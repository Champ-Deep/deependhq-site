// selftest-copy.mjs : prove the copy engine cannot do damage.
//
// This file rewrites what a visitor sees without Deep reading it first, so the
// rules that constrain it are asserted rather than trusted. The failure mode is
// quiet: an auto-applier that starts editing a number or a frozen claim does not
// throw, it just slowly makes the site wrong in a way nobody notices for weeks.
//
//   node scripts/selftest-copy.mjs
//
// Imports the real copy-engine.js, not a copy.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'copy-engine.js'), 'utf8');

// The engine now self-boots on DOMContentLoaded, so the sandbox needs a document
// with the handful of things boot() touches. fetch is stubbed to reject, which is
// the real-world failure path and lands on the control rendering.
const fakeEl = {
  _attrs: {},
  getAttribute(k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
  setAttribute(k, v) { this._attrs[k] = v; },
  hasAttribute() { return false; },
};
const box = {
  window: {},
  document: {
    readyState: 'complete',
    documentElement: fakeEl,
    querySelectorAll: () => [],
    addEventListener() {},
  },
  fetch: () => Promise.reject(new Error('offline in the selftest')),
  console,
};
box.window = box;
vm.createContext(box);
vm.runInContext(src, box, { filename: 'copy-engine.js' });
const C = box.window.DHCopy;

let pass = 0;
const fails = [];
const check = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) pass++;
  else fails.push(`${name}\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);
};

const sortedDigits = (x) => (String(x).match(/\d+/g) || []).sort();
const controlDigitsFor = (field) => sortedDigits(C.VARIANTS[field].control);

console.log('\ncopy engine selftest\n');

// ------------------------------------------- variants must match real markup
console.log('variants must match the markup they claim to edit');

// The engine compares a field's current text against VARIANTS[field].control. If
// they differ, it treats the page as bespoke and declines to touch it, which
// looks exactly like "the engine is running and doing nothing". The control for
// cta_label was shipped as 'Book a call' while the markup said 'book 30
// minutes', so the engine would have silently done nothing forever. This
// assertion is written against the real prerendered page, not a fixture.
const pagePath = join(dirname(fileURLToPath(import.meta.url)), '..');
let indexHtml = '';
try {
  indexHtml = readFileSync(join(pagePath, 'index.html'), 'utf8');
} catch (e) {
  fails.push('index.html not readable, cannot check variant alignment');
}

if (indexHtml) {
  const ctaMatch = indexHtml.match(/data-dh-cta="cta_label"[^>]*>([^<]+)</);
  check('the cta element is present in the prerendered page', !!ctaMatch, true);
  if (ctaMatch) {
    check('cta control matches the real markup exactly',
      ctaMatch[1].trim(), C.VARIANTS.cta_label.control);
  }

  const heroMatch = indexHtml.match(/data-dh-hero="hero_subline"[^>]*>([^<]+)</);
  check('the hero element is present in the prerendered page', !!heroMatch, true);
  if (heroMatch) {
    check('hero control matches the real markup exactly',
      heroMatch[1].trim(), C.VARIANTS.hero_subline.control);
  }

  // And the frozen notes must actually be frozen in the markup, not just
  // intended. The derived numbers are the thing most worth protecting.
  check('the day counter is frozen in the markup',
    /class="wx-hx-note wx-hx-n2" data-dh-frozen/.test(indexHtml), true);
  check('the company count is frozen in the markup',
    /class="wx-hx-note wx-hx-n4" data-dh-frozen/.test(indexHtml), true);

  // Every editable string must carry the SAME digits as its control, not zero
  // digits. The lede legitimately contains "2 AM", which is a fact about when
  // things go live and must survive personalization untouched. The property worth
  // asserting is that the editable set introduces no NEW numbers, because that is
  // exactly how an optimizer would quietly change a count or a time.
  const editable = indexHtml.match(/data-dh-(hero|cta)="[a-z_]+"[^>]*>[^<]*</g) || [];
  check('there are exactly two editable elements', editable.length, 2);
  for (const el of editable) {
    const text = el.replace(/^[^>]*>/, '').replace(/<$/, '');
    const field = el.match(/="([a-z_]+)"/)[1];
    const table = C.VARIANTS[field];
    check(`${field}: the markup carries the control's own digits`,
      JSON.stringify(sortedDigits(text)), JSON.stringify(sortedDigits(table.control)));
    // And every variant of that field must be digit-identical to its control.
    for (const [k, v] of Object.entries(table)) {
      if (k === 'control') continue;
      check(`${field}/${k}: introduces no new number`,
        JSON.stringify(sortedDigits(v)), JSON.stringify(controlDigitsFor(field)));
    }
  }
}

// ------------------------------------------------------- the number guard
console.log('the number guard, which is the rule that stops it lying');

// Every control string, checked against every variant of the same field.
for (const [field, table] of Object.entries(C.VARIANTS)) {
  const control = table.control;
  for (const [key, text] of Object.entries(table)) {
    if (key === 'control') continue;
    check(`${field}/${key} keeps the control's numbers`,
      C._numbersAgree(control, text), true);
  }
}

// The guard must actually reject a number change, not just pass everything.
check('a new number is rejected', C._numbersAgree('day 334', 'day 335'), false);
check('a dropped number is rejected', C._numbersAgree('12 companies', 'companies'), false);
// Reordering is deliberately TOLERATED, not rejected: the guard compares sorted
// multisets, so "12 and 334" and "334 and 12" are the same claim. What it refuses
// is a different set of numbers, which is what would actually be a lie.
check('reordered numbers are the same claim', C._numbersAgree('12 and 334', '334 and 12'), true);
check('a changed number is rejected', C._numbersAgree('12 and 334', '12 and 335'), false);
check('identical text passes', C._numbersAgree('day 334', 'day 334'), true);
check('no numbers on either side passes', C._numbersAgree('plain words', 'other words'), true);

// ------------------------------------------------ regression: the silent ones
console.log('regressions for bugs that produced no error');

// These two shipped broken and neither threw. Both are now asserted, because the
// failure mode of each was "the numbers look plausible and nobody notices".

// 1. The booking CTA is an EXTERNAL link to the scheduler, so it returns from the
//    https branch of the click handler and never reaches the isCta branch. The
//    result was: clicking "book 30 minutes" recorded an outbound click but no cta
//    click, so the intent scorer saw no cta and the single highest-intent action
//    on the site scored lower than scrolling.
{
  const href = 'https://scheduler.zoom.us/sreedeep';
  const isExternal = /^https?:/i.test(href);
  check('the booking cta really is an external link', isExternal, true);

  const src = readFileSync(join(pagePath, 'analytics.js'), 'utf8');
  // The external branch must itself detect a cta, not just record outbound.
  const start = src.indexOf('if (/^https?:/i.test(href))');
  const end = src.indexOf('// Internal navigation', start);
  const extBranch = src.slice(start, end > start ? end : start + 2000);
  check('the external branch records a cta into the profile',
    /recordCta/.test(extBranch), true);
  check('and marks the outbound event as a cta',
    /cta: ctaish/.test(extBranch), true);
}

// 2. Two engage emitters on pagehide double-counted every session. Only one may
//    fire, and it must be the one carrying the intent score.
{
  const src = readFileSync(join(pagePath, 'analytics.js'), 'utf8');
  // Count real listeners, not the word: the word also appears in four comments
  // explaining why there is only one, which is exactly the kind of thing a string
  // count gets wrong.
  const hideListeners = (src.match(/addEventListener\(\s*'pagehide'/g) || []).length;
  check('exactly one pagehide listener exists', hideListeners, 1);
  check('dwell is not reported on pagehide any more',
    !/addEventListener\('pagehide', \(\) => reportDwell/.test(src), true);
  check('dwell reporting is guarded against a second emit',
    /if \(dwellReported\) return;/.test(src), true);
  // And the intent-bearing engage must exist, or the whole scorer is dead code.
  check('an intent-bearing engage is emitted',
    /send\('engage', \{[\s\S]{0,200}intent:/.test(src), true);
}

// 3. night() was called but never defined, which threw on every page load and
//    killed the entire page event. Every function analytics.js calls must exist.
{
  const src = readFileSync(join(pagePath, 'analytics.js'), 'utf8');
  check('night is defined', /function night\(\)/.test(src), true);
  // Crude but effective: list the helpers the file calls and assert each is
  // defined either here or in the files loaded alongside it.
  // clip() is deliberately absent: it lives in worker/index.js and is not called
  // from the browser bundle. Listing it here would assert something untrue.
  const helpers = ['labelFor', 'reportDwell', 'night'];
  const siblings = ['segment.js', 'visitor-id.js', 'copy-engine.js']
    .map((f) => { try { return readFileSync(join(pagePath, f), 'utf8'); } catch (e) { return ''; } })
    .join('\n');
  for (const h of helpers) {
    const defined = new RegExp(`(function ${h}\\b|const ${h}\\s*=|let ${h}\\s*=|${h}\\s*[:=]\\s*function)`)
      .test(src + '\n' + siblings);
    check(`${h} is defined somewhere it is called from`, defined, true);
  }
}

// ------------------------------------------------ variant resolution
console.log('variant resolution');

check('no segment means control',
  C._resolveVariant('hero_subline', '', ''),
  C.VARIANTS.hero_subline.control);

check('an operator gets the operator subline',
  C._resolveVariant('hero_subline', 'operator', ''),
  C.VARIANTS.hero_subline.operator);

check('a narrative visitor gets the narrative subline',
  C._resolveVariant('hero_subline', 'narrative', ''),
  C.VARIANTS.hero_subline.narrative);

// explorer is the control and must resolve to control. If it ever does not, the
// whole basis for telling whether personalization works disappears.
check('the control segment resolves to control',
  C._resolveVariant('hero_subline', 'explorer', ''),
  C.VARIANTS.hero_subline.control);

// hot overrides segment for the CTA, because intent beats origin.
check('hot wins over segment on the cta',
  C._resolveVariant('cta_label', 'narrative', 'hot'),
  C.VARIANTS.cta_label.hot);

// ------------------------------------------------------- the evidence rule
console.log('the evidence rule');

const fakeDoc = { querySelectorAll: () => [] };
const doc = { documentElement: {} };

function applyWith(evidence, nodes) {
  box.document = {
    querySelectorAll: (sel) => (nodes && nodes[sel]) || [],
  };
  return C.apply('operator', 'cold', evidence);
}

// No evidence at all: must render control and change nothing, even for a segment
// that would otherwise be treated.
const noEvidence = applyWith(undefined, {
  '[data-dh-hero]': [{
    getAttribute: (a) => (a === 'data-dh-hero' ? 'hero_subline' : null),
    hasAttribute: () => false,
    textContent: C.VARIANTS.hero_subline.control,
  }],
});
check('without evidence nothing is changed', noEvidence.changed, false);
check('without evidence it declares control', noEvidence.control, true);
check('without evidence it explains itself',
  /no evidence yet/.test(noEvidence.log.join(' ')), true);

// Unsupported evidence: same outcome. "Supported" is a word the digest has to
// earn, not something the engine assumes.
const unsupported = applyWith({ supported: false, visits: 3 }, null);
check('unsupported evidence changes nothing', unsupported.changed, false);

// ------------------------------------------------------- frozen content
console.log('frozen content is untouchable');

const frozenNode = {
  getAttribute: (a) => (a === 'data-dh-hero' ? 'hero_subline' : null),
  hasAttribute: (a) => a === 'data-dh-frozen',
  textContent: C.VARIANTS.hero_subline.control,
};
const frozen = applyWith({ supported: true, visits: 1000 }, { '[data-dh-hero]': [frozenNode] });
check('a frozen node keeps its text',
  frozenNode.textContent, C.VARIANTS.hero_subline.control);
check('and it is reported', /frozen/.test(frozen.log.join(' ')), true);

// Content that carries its own numbers is left alone even with strong evidence,
// because the engine cannot prove it is not a claim like "day 334".
const bespokeNode = {
  getAttribute: (a) => (a === 'data-dh-hero' ? 'hero_subline' : null),
  hasAttribute: () => false,
  textContent: 'Twelve companies, one operator. Running since day 334.',
};
applyWith({ supported: true, visits: 1000 }, { '[data-dh-hero]': [bespokeNode] });
check('bespoke numeric text is not overwritten',
  bespokeNode.textContent, 'Twelve companies, one operator. Running since day 334.');

// ------------------------------------------------------- report
console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('copy engine selftest: all assertions hold.');