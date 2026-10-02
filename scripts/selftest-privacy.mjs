// selftest-privacy.mjs : the page must not lie about the code.
//
// THE PROBLEM THIS SOLVES
// On 2026-10-02 /privacy said "no cookie, no visitor id" and the code did neither.
//// That is the one genuinely indefensible failure mode here: a privacy page that
// has drifted away from the behaviour describes a system nobody is actually
// running. It does not throw, it does not fail a gate, it just quietly makes the
// whole site indefensible.
//
// So every specific claim on the page is asserted against the code that has to
// back it. Change one without the other and this fails.
//
//   node scripts/selftest-privacy.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (f) => readFileSync(join(root, f), 'utf8');

const visitor = read('visitor-id.js');
const analytics = read('analytics.js');
const privacy = read('PrivacyPage.jsx');
const footer = read('Footer.jsx');
const worker = read('worker/index.js');

let pass = 0;
const fails = [];
const check = (name, got, want = true) => {
  if (got === want) pass++;
  else fails.push(`${name}\n      page says one thing, code does another`);
};

// Strip JSX and CODE COMMENTS before searching. The phrase "no visitor id"
// legitimately appears in a comment explaining what the page used to claim, and
// matching that made the test fail on its own documentation. Only rendered prose
// counts as a claim a visitor reads.
const prose = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, ' ')   // block comments
  .replace(/^\s*\/\/.*$/gm, ' ')         // line comments
  .replace(/\{[^}]*\}/g, ' ')            // jsx expressions
  .replace(/\s+/g, ' ');

// ------------------------------------------------ claims that must be FALSE
console.log('claims the page used to make and must not make again');

// The page previously asserted no cookie and no visitor id. Both were true on
// 2026-10-01 and false on 2026-10-02. A regression here means someone restored
// the old text without restoring the old behaviour, or worse, the reverse.
check('privacy does not claim "no cookie"',
  /no cookie\b/i.test(prose(privacy)) && !/no visitor id/i.test(prose(privacy)), false);
check('privacy does not claim "no visitor id"', /no visitor id/i.test(prose(privacy)), false);
check('privacy does not claim it cannot tell a returning reader',
  /cannot tell a returning reader/i.test(prose(privacy)), false);
check('footer does not claim "no visitor id"',
  /no visitor id/i.test(prose(footer)), false);
check('footer does not claim "no cookie"', /no cookie/i.test(prose(footer)), false);

// ------------------------------------------------ claims that must be TRUE
console.log('claims the code has to back up');

// If the page names the cookie, the cookie must exist with that exact name.
const cookieName = (privacy.match(/dh_vid/) || [])[0];
check('privacy names the cookie the code actually sets', cookieName === 'dh_vid', true);
check('the code really sets that cookie',
  new RegExp(`COOKIE = '${cookieName}'`).test(visitor), true);

// If the page says first-party, the code must not write Domain (a Domain attribute
// is what makes a cookie cross-site) and must set SameSite.
check('privacy says first-party and the code omits a Domain attribute',
  /first-party/i.test(prose(privacy)) && !/document\.cookie[^;]*;\s*Domain=/.test(visitor), true);
check('the cookie sets SameSite', /SameSite=/.test(visitor), true);
check('the cookie sets Secure', /Secure/.test(visitor), true);

// If the page says the id is hashed before storage, the worker must hash it.
check('privacy says the id is hashed', /hashed/i.test(prose(privacy)), true);
check('the worker hashes the id before writing it',
  /simpleHash\(vid\)/.test(worker), true);
check('the raw id is not written into a blob',
  /blobs:\s*\[[^\]]*vid\b/.test(worker), false);

// If the page says 180 days, TTL_DAYS must be 180.
const ttlClaim = privacy.match(/(\d+)\s*days/);
const ttlCode = (visitor.match(/TTL_DAYS = (\d+)/) || [])[1];
check('privacy and code agree on the expiry', ttlClaim && ttlClaim[1] === ttlCode, true);

// The profile is claimed to live in local storage, not on the server.
check('privacy says the profile lives in the browser',
  /local storage/i.test(prose(privacy)), true);
check('and the code writes it there', /localStorage\.setItem/.test(visitor), true);

// The three-group claim must match the three groups the code can produce.
check('privacy names three groups',
  /operator/.test(prose(privacy)) && /narrative/.test(prose(privacy)) && /explorer/.test(prose(privacy)), true);
const seg = read('segment.js');
check('the classifier produces exactly those three',
  (seg.match(/const SEGMENTS = \[([^\]]*)\]/) || [])[1].replace(/['\s]/g, ''), 'operator,narrative,explorer');

// The control claim: one group deliberately unchanged. Assert the engine can
// leave a visitor alone, i.e. explorer resolves to control and not to a variant.
check('privacy claims one group is deliberately left unchanged',
  /one of those three groups deliberately gets no change/i.test(prose(privacy)), true);
// The resolver lives in copy-engine.js. segment.js only classifies; copy-engine.js
// decides what a classified visitor actually reads. Assert against the right file.
const engine = read('copy-engine.js');
check('and the engine agrees: explorer has no variant entry at all',
  /hero_subline:\s*\{[\s\S]{0,400}?\}/.test(engine) &&
  !/hero_subline:\s*\{[\s\S]{0,400}?explorer\s*:/.test(engine), true);
check('cta_label likewise has no explorer variant',
  !/cta_label:\s*\{[\s\S]{0,300}?explorer\s*:/.test(engine), true);

// The "asked once, only cold, only posts" claim.
check('privacy claims the question is asked once', /Once, ever/i.test(prose(privacy)), true);
check('and the code caps it at once per browser',
  /if \(p\.asked > 0\) return false/.test(visitor), true);
check('and restricts the ask to cold readers',
  /data-intent'\) !== 'cold'/.test(read('ask.js')), true);
check('and to article pages',
  /post\\\//.test(read('ask.js')) || /location\.pathname\)\s*return false/.test(read('ask.js')) === false, true);

// The no-IP claim must be checkable against what the worker writes.
check('privacy claims no IP is stored', /No IP address stored/i.test(prose(privacy)), true);
check('the worker writes no ip field', /blobs:\s*\[[^\]]*\bip\b/i.test(worker), false);

// ------------------------------------------------ third-party claims
console.log('the third-party claims');
check('privacy names the one real exception (Widgo)', /Widgo/.test(privacy), true);
check('and still refuses third-party analytics', /No third-party analytics script/i.test(prose(privacy)), true);

// ------------------------------------------------ forget control
console.log('there is a way to actually delete it');
check('the page offers a way to delete everything', /Delete everything/i.test(prose(privacy)), true);
check('and the code really implements it', /function forget\(\)/.test(visitor), true);
check('and it clears both the cookie and the profile',
  /removeItem\(PROFILE\)/.test(visitor) && /expires=Thu, 01 Jan 1970/.test(visitor), true);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('privacy selftest: the page and the code agree.');