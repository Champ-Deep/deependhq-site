// scripts/sonar-selftest.mjs : the pure half of Sonar (sonar-core.js), shared by the browser and the worker.
import assert from 'node:assert/strict';
import { profileColumns, validateProfile, validatePlan, runPlan, cleanHeadline, fillHeadline, describePlan, toNumber, toDate, VIEWS } from '../sonar-core.js';

const headers = ['Company', 'Country', 'Employees', 'Signed', 'Revenue'];
const rows = [
  { Company: 'Acme', Country: 'India', Employees: '120', Signed: '2026-01-14', Revenue: '$1,200' },
  { Company: 'Beta', Country: 'india ', Employees: '80', Signed: '2026-01-30', Revenue: '$800' },
  { Company: 'Gamma', Country: 'USA', Employees: '1,000', Signed: '2026-03-02', Revenue: '' },
  { Company: 'Delta', Country: 'USA', Employees: 'n/a', Signed: '2025-11-20', Revenue: '$300' },
  { Company: 'Eps', Country: '', Employees: '40', Signed: '', Revenue: '$50' },
];

// parsing
assert.equal(toNumber('$1,200'), 1200); assert.equal(toNumber('n/a'), null); assert.equal(toNumber('12%'), 12); assert.equal(toNumber(''), null);
assert.ok(toDate('2026-01-14')); assert.equal(toDate('Acme'), null);

// profile: types, counts, samples capped and short, numbers and dates carry min/max
const prof = profileColumns(headers, rows);
assert.equal(validateProfile(prof, headers), null);
assert.deepEqual(prof.map((c) => c.type), ['text', 'text', 'number', 'date', 'number']);
assert.equal(prof[0].distinct, 5); assert.equal(prof[1].filled, 4);
assert.deepEqual(prof[1].samples.slice(0, 1), ['India'], 'most frequent first (case kept, trimmed)');
assert.equal(prof[2].min, 40); assert.equal(prof[2].max, 1000); assert.equal(prof[3].min, '2025-11-20');
assert.equal(prof[2].samples.length, 0, 'number columns carry no sample values');
assert.match(validateProfile([{ ...prof[0], name: 'Ghost' }, ...prof.slice(1)], headers), /follow headers/);
assert.match(validateProfile(prof.map((c) => ({ ...c, samples: ['x'.repeat(61)] })), headers), /60 characters/);

// plan validation: allow-list only
assert.equal(validatePlan({ view: 'number' }, headers), null);
assert.match(validatePlan({ view: 'pie' }, headers), /view is one of/);
assert.match(validatePlan({ view: 'rank' }, headers), /needs group_by/);
assert.match(validatePlan({ view: 'rank', group_by: 'Ghost' }, headers), /group_by/);
assert.match(validatePlan({ view: 'number', filters: [{ column: 'Country', op: 'like', value: 'x' }] }, headers), /known column and op/);
assert.match(validatePlan({ view: 'number', measure: { fn: 'sum' } }, headers), /needs a column/);
assert.match(validatePlan({ view: 'number', measure: { fn: 'median', column: 'Employees' } }, headers), /measure.fn/);
assert.match(validatePlan({ view: 'list', columns: ['__proto__'] }, headers), /columns/);
assert.match(validatePlan({ view: 'number', limit: 51 }, headers), /limit/);
assert.match(validatePlan({ view: 'number', filters: Array(7).fill({ column: 'Country', op: 'empty' }) }, headers), /at most 6/);
assert.equal(validatePlan({ view: 'trend', group_by: 'Signed', bucket: 'month', measure: { fn: 'sum', column: 'Revenue' } }, headers), null);

// executor: numbers come from the rows, filters are case-insensitive and trimmed
const india = runPlan(rows, { view: 'number', filters: [{ column: 'Country', op: 'eq', value: 'India' }] });
assert.equal(india.matched, 2); assert.equal(india.value, 2); assert.equal(india.total, 5);
const avg = runPlan(rows, { view: 'number', measure: { fn: 'avg', column: 'Employees' } });
assert.equal(avg.value, 310, 'n/a is skipped, 1,000 is parsed');
const sum = runPlan(rows, { view: 'number', filters: [{ column: 'Employees', op: 'gte', value: 100 }], measure: { fn: 'sum', column: 'Revenue' } });
assert.equal(sum.matched, 2); assert.equal(sum.value, 1200, 'blank revenue counts as nothing, not zero');
const rank = runPlan(rows, { view: 'rank', group_by: 'Country' });
assert.deepEqual(rank.groups.map((g) => g.value), [2, 2, 1]);
assert.deepEqual(new Set(rank.groups.map((g) => g.key)), new Set(['India', 'USA', '(blank)']));
assert.equal(rank.groups[0].value, 2); assert.equal(rank.groups.at(-1).key, '(blank)');
assert.equal(rank.groups.find((g) => g.key === 'India').count, 2, 'india and India are one group');
const share = runPlan(rows, { view: 'share', group_by: 'Company', limit: 2 });
assert.equal(share.groups.length, 3); assert.equal(share.groups[2].key, 'Other'); assert.equal(share.groups[2].value, 3);
const trend = runPlan(rows, { view: 'trend', group_by: 'Signed', bucket: 'month', measure: { fn: 'sum', column: 'Revenue' } });
assert.deepEqual(trend.groups.map((g) => g.key), ['(no date)', '2025-11', '2026-01', '2026-03'], 'trend sorts by group key');
assert.equal(trend.groups.find((g) => g.key === '2026-01').value, 2000);
const list = runPlan(rows, { view: 'list', filters: [{ column: 'Country', op: 'starts', value: 'us' }], columns: ['Company'], limit: 1 });
assert.deepEqual(list.rows, [{ Company: 'Gamma' }]); assert.equal(list.matched, 2);
const inOp = runPlan(rows, { view: 'number', filters: [{ column: 'Company', op: 'in', value: ['acme', 'EPS'] }] });
assert.equal(inOp.matched, 2);
assert.equal(runPlan(rows, { view: 'number', filters: [{ column: 'Signed', op: 'gt', value: '2026-02-01' }] }).matched, 1);
assert.equal(runPlan(rows, { view: 'number', filters: [{ column: 'Revenue', op: 'empty' }] }).matched, 1);

// headline: digits only ever come from the result
assert.equal(cleanHeadline('{matched} of {total} companies are in India'), '{matched} of {total} companies are in India');
assert.equal(cleanHeadline('About 1,204 companies are in India'), null, 'a digit in the headline is a fabricated number');
assert.equal(cleanHeadline('{rows} companies'), null, 'unknown placeholder');
assert.equal(cleanHeadline('India leads \u2014 by far'), 'India leads, by far');
assert.equal(fillHeadline('{matched} of {total} companies are in India', india), '2 of 5 companies are in India');
assert.equal(fillHeadline('{top} leads with {top_value} across {groups} countries', rank), `${rank.groups[0].key} leads with 2 across 3 countries`);
assert.equal(describePlan({ view: 'number', filters: [{ column: 'Country', op: 'eq', value: 'India' }] }, india), 'rows where Country eq India: 2');
assert.equal(describePlan({ view: 'list', filters: [{ column: 'Country', op: 'starts', value: 'us' }] }, list), '2 of 5 rows where Country starts us');
assert.equal(Object.keys(VIEWS).length, 6);

console.log('sonar-selftest: ok');
