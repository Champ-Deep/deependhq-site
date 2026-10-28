// scripts/toolkit-workbench-lib-selftest.mjs : pure helpers behind the V4 Data Workbench, Deep Enrich and the desktop.
import assert from 'node:assert/strict';
import {money, validateFileTable, quoteSummary, resultRows, guessFields, intakeFile, mergeMapping, planItem, planToSpecs, keptRows, toBase64, snapZone, zoneRect, fitRect, resizeRect, nearestFreeCell, groupRuns} from '../toolkit-workbench-lib.js';

assert.throws(() => validateFileTable({rows: []}), /no data rows/);
assert.throws(() => validateFileTable({rows: [{__proto__x: 1, constructor: 'x'}]}), /reserved names/);
assert.deepEqual(validateFileTable({rows: [{A: '1'}, {B: '2'}]}).headers, ['A', 'B']);

const allowance = {credits_available: 50, remaining_daily_credits: 20, remaining_daily_rows: 10, disabled: 0};
const ok = quoteSummary([{max_cost_micro: 5000, max_credits: 5, row_count: 3, fits_batch_ceiling: true, can_run: true, allowance}]);
assert.equal(ok.micro, 5000);
assert.deepEqual(ok.reasons, []);
const capped = quoteSummary([{max_cost_micro: 30000, max_credits: 30, row_count: 3, can_run: false, reason: 'daily_credit_cap', message: 'Your daily limit is $1.00 and $0.20 is left today.', allowance}]);
assert.deepEqual(capped.reasons, ['Your daily limit is $1.00 and $0.20 is left today.'], 'the server names the cap');
assert.equal(quoteSummary([{max_cost_micro: 0, max_credits: 0, row_count: 1, can_run: true, allowance}]).reasons.length, 1, 'nothing to price explains itself');

const rows = [{Company: 'Acme'}, {Company: ''}];
const out = resultRows(rows, [{column: 'Company', op: 'classify'}], [{row_map: [0, -1], items: [{label: 'SaaS', confidence: .9, review: false}]}]);
assert.equal(out[0]['Result 1: Company / classify'], 'SaaS');
assert.equal(out[0]['Result 1: Company / classify / review'], 'No flag');
assert.equal(out[1]['Result 1: Company / classify'], 'skipped');
assert.equal(out[1]['Result 1: Company / classify / review'], 'Review needed', 'a row with no result is never silently clean');
const missing = resultRows(rows, [{column: 'Company', op: 'verify'}], []);
assert.equal(missing[0]['Result 1: Company / verify'], 'not_run');

// Intake: header vocabulary, capped samples, merge only known fields.
const headers = ['Person Name', 'Company Name', 'Work Email', 'Job', 'Website', 'Notes'];
assert.deepEqual(guessFields(headers).map(m => m.field), ['person_name', 'company', 'email', 'title', 'domain', 'other']);
const file = intakeFile('leads.csv', headers, Array.from({length: 9}, (_, i) => ({'Person Name': 'P' + i, Notes: 'x'.repeat(300)})));
assert.equal(file.samples['Person Name'].length, 5);
assert.equal(file.samples.Notes[0].length, 200);
assert.deepEqual(file.samples.Job, []);
assert.equal(file.rows_total, 9);
const merged = mergeMapping(guessFields(headers), [{source: 'Notes', field: 'industry', keep: false}, {source: 'Job', field: 'not_a_field'}]);
assert.deepEqual(merged.find(m => m.source === 'Notes'), {source: 'Notes', field: 'industry', keep: false});
assert.equal(merged.find(m => m.source === 'Job').field, 'title', 'unknown fields from the model are ignored');

// Plan to specs: every op validated, skipped columns refused, enrich picks up mapped identity columns.
const plan = [
  planItem({column: 'Job', op: 'normalize_title', engine: 'jev'}, headers),
  planItem({column: 'Company Name', op: 'classify', instruction: 'Is this SaaS?', categories: ['SaaS', 'Not SaaS']}, headers),
  planItem({column: 'Company Name', op: 'research', engine: 'jev', instruction: 'How many staff?', output_columns: 'Headcount', web: true}, headers),
  planItem({column: 'Work Email', op: 'enrich', engine: 'treg', fields: ['title']}, headers),
];
assert.equal(plan[2].engine, 'deepseek', 'research only runs on DeepSeek');
const specs = planToSpecs(plan, merged, headers);
assert.deepEqual(specs[0], {column: 'Job', op: 'normalize_title', engine: 'jev'});
assert.deepEqual(specs[1].categories, ['SaaS', 'Not SaaS']);
assert.deepEqual(specs[2], {column: 'Company Name', op: 'research', engine: 'deepseek', instruction: 'How many staff?', output_columns: ['Headcount'], web: true});
assert.deepEqual(specs[3], {column: 'Work Email', op: 'enrich', engine: 'treg', fields: ['title'], name_column: 'Person Name', domain_column: 'Website'});
assert.throws(() => planToSpecs([planItem({column: 'Notes', op: 'classify', instruction: 'x', categories: 'a,b'}, headers)], merged, headers), /set to skip/);
assert.throws(() => planToSpecs([{...plan[1], categories: 'Only one'}], merged, headers), /2 to 30/);
assert.throws(() => planToSpecs([{...plan[2], output_columns: 'a,b,c,d'}], merged, headers), /1 to 3 output/);
assert.throws(() => planToSpecs([{...plan[0], engine: 'treg'}], merged, headers), /cannot/);
assert.throws(() => planToSpecs([], merged, headers), /at least one/);
assert.deepEqual(Object.keys(keptRows([{'Person Name': 'A', Notes: 'secret'}], merged)[0]).includes('Notes'), false, 'skipped columns never leave the browser');
assert.equal(toBase64(new TextEncoder().encode('a,b\n1,2')), Buffer.from('a,b\n1,2').toString('base64'));

// Normalized titles and research answers land in their own columns.
const nt = resultRows([{Job: 'vp sales'}], [{column: 'Job', op: 'normalize_title'}], [{row_map: [0], items: [{title_normalized: 'VP of Sales', seniority: 'VP', function: 'Sales'}]}]);
assert.equal(nt[0]['Result 1: Job / normalize_title'], 'VP of Sales');
assert.equal(nt[0]['Result 1: Job / normalize_title / seniority'], 'VP');

// Desktop geometry: snap zones, rects, resize floor and the icon grid.
const a = {x: 0, y: 56, w: 1440, h: 800};
assert.equal(snapZone(5, 400, a), 'left');
assert.equal(snapZone(1438, 400, a), 'right');
assert.equal(snapZone(700, 60, a), 'max');
assert.equal(snapZone(4, 70, a), 'top-left');
assert.equal(snapZone(1436, 850, a), 'bottom-right');
assert.equal(snapZone(700, 400, a), null);
assert.deepEqual(zoneRect('left', a), {x: 0, y: 56, w: 720, h: 800});
assert.deepEqual(zoneRect('bottom-right', a), {x: 720, y: 456, w: 720, h: 400});
assert.deepEqual(fitRect({x: -50, y: 0, w: 100, h: 5000}, a), {x: 0, y: 56, w: 360, h: 800});
assert.deepEqual(resizeRect({x: 100, y: 100, w: 500, h: 400}, 'nw', 300, 300, a), {x: 240, y: 260, w: 360, h: 240}, 'never below 360x240');
assert.deepEqual(resizeRect({x: 100, y: 100, w: 500, h: 400}, 'se', 5000, 5000, a), {x: 100, y: 100, w: 1340, h: 756}, 'never off the desktop');
assert.deepEqual(nearestFreeCell([0, 0], 3, 3, new Set(['0,0'])), [0, 1]);
assert.deepEqual(nearestFreeCell([9, 9], 3, 3, new Set()), [2, 2], 'off-grid wishes clamp into the grid');
assert.equal(nearestFreeCell([0, 0], 1, 1, new Set(['0,0'])), null);

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
// The worker hands back validated categories as objects; the editor shows their names.
assert.equal(planItem({column: 'Company', op: 'classify', engine: 'jev', instruction: 'SaaS?', categories: [{name: 'SaaS', description: null}, {name: 'Not SaaS'}]}).categories, 'SaaS, Not SaaS');
const grouped = groupRuns([
  {id: 'r1', job_id: 'j1', status: 'completed', row_count: 100, spent_micro: 2000, created_at: '2026-10-28T10:00:00Z'},
  {id: 'r2', job_id: 'j1', status: 'failed', row_count: 50, spent_micro: 1000, created_at: '2026-10-28T10:01:00Z'},
  {id: 'r3', job_id: 'r3', status: 'completed', row_count: 3, spent_micro: 10, created_at: '2026-10-28T09:00:00Z'},
  {id: 'r4', status: 'completed', row_count: 1, spent_micro: 1, created_at: '2026-10-28T08:00:00Z'}]);
assert.equal(grouped.length, 3, 'two chunks of j1 become one line; a missing job_id stands alone');
assert.deepEqual([grouped[0].row_count, grouped[0].spent_micro, grouped[0].status, grouped[0].created_at], [150, 3000, 'partly done', '2026-10-28T10:01:00Z']);
console.log('PASS toolkit-workbench-lib selftest');
