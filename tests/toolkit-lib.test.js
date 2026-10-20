// toolkit-lib.test.js : TDD suite for the pure Lead Scorer / toolkit helpers.
// Parsers, formula-safe export and money maths are the trust boundary, so they
// get real tests against real fixture files. Run with: node --test tests/

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parseCsv, toCsv, guessMapping, mapRows, sanitizeRow, chunk,
  creditsFromMicro, formatUsd, formatCredits, parseXlsx, MICRO_PER_CREDIT,
} from '../toolkit-lib.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => join(here, 'fixtures', name);

// ---------------------------------------------------------------- CSV parse

test('parseXlsx rejects oversized inflated parts even when the upload is small', async () => {
  const bytes = readFileSync(fixture('oversize.xlsx'));
  assert.ok(bytes.byteLength < 5 * 1024 * 1024);
  await assert.rejects(() => parseXlsx(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)), /Expanded spreadsheet/);
});

test('parseCsv reads quoted commas, escaped quotes and CRLF', () => {
  const text = 'Name,Note\r\n"Fixture Lead, One","He said ""hi"""\r\n';
  const { headers, rows } = parseCsv(text);
  assert.deepEqual(headers, ['Name', 'Note']);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].Name, 'Fixture Lead, One');
  assert.equal(rows[0].Note, 'He said "hi"');
});

test('parseCsv strips a BOM, skips blank lines and pads short rows', () => {
  const text = '\uFEFFa,b,c\n1,2,3\n\n4\n';
  const { rows } = parseCsv(text);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { a: '1', b: '2', c: '3' });
  assert.deepEqual(rows[1], { a: '4', b: '', c: '' });
});

test('parseCsv keeps a newline inside a quoted cell', () => {
  const { rows } = parseCsv('a\n"line one\nline two"\n');
  assert.equal(rows[0].a, 'line one\nline two');
});

test('parseCsv detects a semicolon file and suffixes duplicate headers', () => {
  const { headers, rows } = parseCsv('a;a\n1;2\n');
  assert.deepEqual(headers, ['a', 'a (2)']);
  assert.equal(rows[0]['a (2)'], '2');
  const dup = parseCsv('name,name\none,two\n');
  assert.deepEqual(dup.headers, ['name', 'name (2)']);
  assert.equal(dup.rows[0].name, 'one');
  assert.equal(dup.rows[0]['name (2)'], 'two');
});

test('parseCsv reads the shipped CSV fixture end to end', () => {
  const { headers, rows } = parseCsv(readFileSync(fixture('leads.csv'), 'utf8'));
  assert.deepEqual(headers, ['Full Name', 'Email', 'Title', 'Company', 'Domain', 'LinkedIn', 'Notes']);
  assert.equal(rows.length, 12);
  assert.equal(rows[0].Notes, 'Said "call after demo", =check notes');
  assert.equal(rows[1].Notes, '+follow up @billing');
  assert.equal(rows[2].Notes, '=HYPERLINK("http://evil.example","click")');
  assert.equal(rows[3].LinkedIn, '-');
});

// ------------------------------------------------------------- CSV export

test('toCsv prefixes formula starters so a spreadsheet cannot execute them', () => {
  const out = toCsv(['v'], [
    { v: '=1+1' }, { v: '+follow' }, { v: '-5' }, { v: '@handle' },
    { v: ' =evil' }, { v: '\t=tab' }, { v: 'plain' }, { v: -5 }, { v: 42 },
  ]);
  const vals = out.split('\n').slice(1);
  assert.ok(vals[0].startsWith("'=1+1"));
  assert.ok(vals[1].startsWith("'+follow"));
  assert.ok(vals[2].startsWith("'-5"));
  assert.ok(vals[3].startsWith("'@handle"));
  assert.ok(vals[4].startsWith("' =evil"));
  assert.ok(vals[5].startsWith("'\t=tab"));
  assert.equal(vals[6], 'plain');
  assert.equal(vals[7], '-5', 'real numbers are not text and must not be mangled');
  assert.equal(vals[8], '42');
});

test('toCsv quotes commas, quotes and newlines, and round-trips through parseCsv', () => {
  const headers = ['a', 'b', 'c'];
  const rows = [{ a: 'ok, plain', b: 'say "hi"', c: 'line one\nline two' }];
  const out = toCsv(headers, rows);
  assert.ok(out.includes('"ok, plain"'));
  assert.ok(out.includes('"say ""hi"""'));
  const back = parseCsv(out);
  assert.deepEqual(back.headers, headers);
  assert.deepEqual(back.rows, rows);
});

// ---------------------------------------------------------------- mapping

test('guessMapping claims headers by exact match first, then partial, once each', () => {
  const headers = ['FULL-NAME', 'Business Email', 'Job Title', 'Company Name',
    'Website', 'LinkedIn URL', 'First Name', 'Last Name'];
  const m = guessMapping(headers);
  assert.equal(m.name, 'FULL-NAME');
  assert.equal(m.email, 'Business Email');
  assert.equal(m.title, 'Job Title');
  assert.equal(m.company, 'Company Name');
  assert.equal(m.domain, 'Website');
  assert.equal(m.linkedin, 'LinkedIn URL');
  assert.equal(m.first, 'First Name');
  assert.equal(m.last, 'Last Name');
});

test('guessMapping does not claim an email column as the company', () => {
  const m = guessMapping(['Company Email', 'Org']);
  assert.equal(m.email, 'Company Email');
  assert.equal(m.company, 'Org');
  assert.equal(m.name, '');
});

test('mapRows joins first and last into name and cleans the domain', () => {
  const headers = ['First Name', 'Last Name', 'Business Email', 'Company Name', 'Website', 'Extra'];
  const source = [{
    'First Name': 'Fixture', 'Last Name': 'Lead One',
    'Business Email': 'a@Sub.Example.com', 'Company Name': 'Fixture Labs',
    'Website': 'https://www.FixtureLabs.example/team/', 'Extra': 'keep me',
  }];
  const out = mapRows(source, guessMapping(headers));
  assert.equal(out[0].name, 'Fixture Lead One');
  assert.equal(out[0].domain, 'fixturelabs.example');
  assert.equal(out[0].email, 'a@Sub.Example.com');
  assert.equal(out[0].company, 'Fixture Labs');
  assert.equal(out[0].Extra, 'keep me');
});

test('mapRows falls back to the email domain and renames a colliding extra column', () => {
  const headers = ['name', 'email', 'name_'];
  const source = [{ name: 'Fixture Lead', email: 'x@B.Example.com', name_: 'secondary' }];
  // name maps to the first column, so the unused "name_" column stays as is.
  let out = mapRows(source, guessMapping(headers));
  assert.equal(out[0].name, 'Fixture Lead');
  assert.equal(out[0].name_, 'secondary');

  // If an unused column is literally called "name" it must not erase the canonical value.
  const m2 = { name: 'Full Name', email: 'email' };
  out = mapRows([{ 'Full Name': 'Canonical', name: 'raw extra' }], m2);
  assert.equal(out[0].name, 'Canonical');
  assert.ok(out[0].name_2 === 'raw extra' || out[0].name_3 === 'raw extra');
});

test('mapRows derives the domain from the email when no domain column maps', () => {
  const out = mapRows([{ Email: 'z@Push.Example.com' }], { email: 'Email' });
  assert.equal(out[0].domain, 'push.example.com');
});

// ------------------------------------------------------------ row sanitation

test('sanitizeRow enforces 1000 chars a value, 30 columns and a 6000 char row', () => {
  const row = { name: 'x'.repeat(1200) };
  for (let i = 0; i < 40; i++) row['c' + i] = 'y';
  const s = sanitizeRow(row);
  const keys = Object.keys(s);
  assert.ok(keys.length <= 30, 'column cap');
  assert.ok(keys.every((k) => String(s[k]).length <= 1000), 'value cap');

  const wide = {};
  for (let i = 0; i < 10; i++) wide['k' + i] = 'z'.repeat(800);
  const s2 = sanitizeRow(wide);
  const total = Object.values(s2).reduce((n, v) => n + String(v).length, 0);
  assert.ok(total <= 6000, 'row total cap, got ' + total);
});

// ------------------------------------------------------------------ batching

test('chunk splits a list into batches of five with no empty tail', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12]]);
  assert.deepEqual(chunk([1], 5), [[1]]);
  assert.deepEqual(chunk([], 5), []);
  assert.deepEqual(chunk([1, 2], 2), [[1, 2]]);
});

// -------------------------------------------------------------------- money

test('creditsFromMicro always rounds up to a whole credit and never goes negative', () => {
  assert.equal(MICRO_PER_CREDIT, 1000);
  assert.equal(creditsFromMicro(0), 0);
  assert.equal(creditsFromMicro(1), 1);
  assert.equal(creditsFromMicro(1000), 1);
  assert.equal(creditsFromMicro(1001), 2);
  assert.equal(creditsFromMicro(250000), 250);
  assert.equal(creditsFromMicro(-10), 0);
});

test('formatUsd shows cents when exact and microdollars when not', () => {
  assert.equal(formatUsd(0), '$0.00');
  assert.equal(formatUsd(2500000), '$2.50');
  assert.equal(formatUsd(90000), '$0.09');
  assert.equal(formatUsd(6000), '$0.0060');
  assert.equal(formatUsd(1000), '$0.0010');
});

test('formatCredits groups thousands for display', () => {
  assert.equal(formatCredits(0), '0');
  assert.equal(formatCredits(999), '999');
  assert.equal(formatCredits(1000), '1,000');
  assert.equal(formatCredits(1234567), '1,234,567');
});

// --------------------------------------------------------------------- XLSX

async function readXlsx(name) {
  return parseXlsx(readFileSync(fixture(name)));
}

test('parseXlsx reads shared strings, entities, sparse cells and numbers', async () => {
  const { headers, rows } = await readXlsx('leads-deflate.xlsx');
  assert.deepEqual(headers, ['Full Name', 'Email', 'Title', 'Company', 'Domain', 'Score', 'Notes']);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].Notes, 'Said: "call" & =check <now>');
  assert.equal(rows[0].Company, 'Fixture Labs');
  assert.equal(rows[1].Company, '', 'a skipped cell reference reads as empty');
  assert.equal(rows[1].Score, '91');
  assert.equal(rows[2].Email, '', 'a self closing cell reads as empty');
  assert.equal(rows[2].Score, '88');
  assert.equal(rows[2].Notes, '=HYPERLINK("http://evil.example","click")');
});

test('parseXlsx also reads an uncompressed (stored) zip', async () => {
  const { rows } = await readXlsx('leads-stored.xlsx');
  assert.equal(rows.length, 3);
  assert.equal(rows[0]['Full Name'], 'Fixture Lead One');
  assert.equal(rows[2].Company, 'Example Co');
});

test('parseXlsx rejects a file that is not a zip with a safe message', async () => {
  await assert.rejects(() => parseXlsx(Buffer.from('not a zip, just text')), /not a readable xlsx/i);
});
