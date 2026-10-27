// enrich-selftest.mjs : asserts the /enrich core with a fake DNS fetch. No network.
//   node scripts/enrich-selftest.mjs
import assert from 'node:assert/strict';
import { parseCSV, detectColumns, cleanDomain, splitName, candidates, enrichRows, csvEscape, toCSV, OUT_COLS } from '../enrich-core.js';

const rows = parseCSV('First Name,Last Name,Website,Email\r\nJosé,García-López,https://www.Acme.com/about,\nAda,Lovelace,nomx.test,\nBob,Ray,acme.com,bob@acme.com\nBad,Mail,acme.com,not-an-email\n,,acme.com,\n"Quoted, Name",X,acme.com,');
assert.equal(rows.length, 6);
assert.equal(rows[5]['First Name'], 'Quoted, Name');
assert.deepEqual(detectColumns(rows[0]), { first: 'First Name', last: 'Last Name', full: null, email: 'Email', domain: 'Website' });
assert.equal(cleanDomain('https://www.Acme.com/about'), 'acme.com');
assert.equal(cleanDomain('not a domain'), '');
assert.deepEqual(splitName('', '', 'Dr Jane Q. Public, PhD'), ['dr', 'public']); // shortcut: titles are not stripped
assert.deepEqual(candidates('jose', 'garcialopez', 'acme.com', 3), ['jose.garcialopez@acme.com', 'jose@acme.com', 'jgarcialopez@acme.com']);
assert.equal(csvEscape('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');

const fake = async (url) => {
  const name = new URL(url).searchParams.get('name');
  if (name === 'down.test') throw new Error('offline');
  const ok = name === 'acme.com';
  return { ok: true, json: async () => ({ Status: ok ? 0 : 3, Answer: ok ? [{ type: 15 }] : undefined }) };
};
const out = await enrichRows(rows, { fetchFn: fake });
assert.deepEqual([out[0].email, out[0].status], ['jose.garcialopez@acme.com', 'verified_domain']);
assert.equal(out[1].status, 'no_mx');
assert.deepEqual([out[2].email, out[2].status], ['bob@acme.com', 'verified_domain']); // supplied email kept
assert.equal(out[3].status, 'bad_syntax');
assert.equal(out[4].status, 'missing_input');
const failed = await enrichRows([{ first: 'A', last: 'B', domain: 'down.test' }], { fetchFn: fake });
assert.equal(failed[0].status, 'lookup_failed');
assert.equal(toCSV(out, [...Object.keys(rows[0]), ...OUT_COLS]).split('\n').length, 7);
console.log('enrich-selftest: ok');
