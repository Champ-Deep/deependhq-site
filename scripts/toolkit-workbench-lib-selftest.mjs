// scripts/toolkit-workbench-lib-selftest.mjs : pure helpers behind the V3 Data Workbench and Deep Scanner.
import assert from 'node:assert/strict';
import {money, validateFileTable, quoteSummary, resultRows, scanText} from '../toolkit-workbench-lib.js';

assert.throws(() => validateFileTable({rows: []}), /no data rows/);
assert.throws(() => validateFileTable({rows: [{__proto__x: 1, constructor: 'x'}]}), /reserved names/);
assert.deepEqual(validateFileTable({rows: [{A: '1'}, {B: '2'}]}).headers, ['A', 'B']);

const allowance = {credits_available: 50, remaining_daily_credits: 20, remaining_daily_rows: 10, disabled: 0};
const ok = quoteSummary([{max_cost_micro: 5000, max_credits: 5, row_count: 3, fits_batch_ceiling: true, allowance}]);
assert.equal(ok.micro, 5000);
assert.deepEqual(ok.reasons, []);
const capped = quoteSummary([{max_cost_micro: 30000, max_credits: 30, row_count: 3, fits_batch_ceiling: true, allowance}]);
assert.ok(capped.reasons.some(r => r.startsWith('Daily spending allowance')), 'over the daily allowance blocks the run');
const zero = quoteSummary([{max_cost_micro: 1000, max_credits: 1, row_count: 1, fits_batch_ceiling: true, allowance: {...allowance, credits_available: 0, remaining_daily_credits: 0, remaining_daily_rows: 0}}]);
assert.equal(zero.reasons.length, 3, 'zero balance, zero daily credits and zero rows each explain themselves');

const rows = [{Company: 'Acme'}, {Company: ''}];
const out = resultRows(rows, [{column: 'Company', op: 'classify'}], [{row_map: [0, -1], items: [{label: 'SaaS', confidence: .9, review: false}]}]);
assert.equal(out[0]['Result 1: Company / classify'], 'SaaS');
assert.equal(out[0]['Result 1: Company / classify / review'], 'No flag');
assert.equal(out[1]['Result 1: Company / classify'], 'skipped');
assert.equal(out[1]['Result 1: Company / classify / review'], 'Review needed', 'a row with no result is never silently clean');
const missing = resultRows(rows, [{column: 'Company', op: 'verify'}], []);
assert.equal(missing[0]['Result 1: Company / verify'], 'not_run');

const hits = scanText('ok\napi_key = ghp_abcdefghijklmnop\n-----BEGIN PRIVATE KEY-----');
assert.deepEqual(hits.map(h => h.line), [2, 2, 3]);
assert.ok(!JSON.stringify(hits).includes('abcdefghijklmnop'), 'findings never carry the matched value');
assert.deepEqual(scanText('nothing here'), []);

// Micro dollars. Costs and quotes round up to the cent, balances round down, never more than 2 decimals.
for (const [micro, up, down] of [
  [0, '$0.00', '$0.00'],
  [999, 'under $0.01', 'under $0.01'],
  [1000, 'under $0.01', 'under $0.01'],
  [9999, 'under $0.01', 'under $0.01'],
  [10000, '$0.01', '$0.01'],
  [10001, '$0.02', '$0.01'],
  [999000, '$1.00', '$0.99'],
  [1000000, '$1.00', '$1.00'],
  [1234567890, '$1,234.57', '$1,234.56'],
]) {
  assert.equal(money(micro), up, `cost ${micro}`);
  assert.equal(money(micro, 'down'), down, `balance ${micro}`);
  assert.ok(!/\.\d{3}/.test(money(micro)) && !/\.\d{3}/.test(money(micro, 'down')), `${micro} shows at most 2 decimals`);
}
console.log('PASS toolkit-workbench-lib selftest');
