// sonar-core.js : Sonar, ask a file a question and get a picture back.
// Pure and shared: the browser imports it to profile the file, validate the
// model's plan and run it over the rows; the worker imports it to validate
// the same plan before it leaves the server. Every number the user sees comes
// from runPlan in the browser. The model only ever sees the profile below
// (headers, types, a few sample values) and only ever returns a plan.

export const VIEWS = {
  number: 'one headline number: a count, a sum or an average of the matching rows',
  rank: 'ranked horizontal bars, 3 to 12 groups: who leads and by how much',
  share: 'how a whole splits into parts, 2 to 8 groups, as one stacked share bar',
  trend: 'a value across an ordered or date column, bucketed by month or year',
  compare: 'two to four named groups side by side as stat tiles',
  list: 'the matching rows themselves, when the user wants to see or export records',
};
export const FILTER_OPS = ['eq', 'neq', 'contains', 'starts', 'gt', 'gte', 'lt', 'lte', 'empty', 'not_empty', 'in'];
export const MEASURES = ['count', 'distinct', 'sum', 'avg', 'min', 'max'];
export const BUCKETS = ['none', 'month', 'year'];
export const MAX_FILTERS = 6, MAX_LIMIT = 50, MAX_LIST_COLUMNS = 8, MAX_SAMPLES = 5, SAMPLE_CHARS = 60;
const BAD = new Set(['__proto__', 'prototype', 'constructor']);

// ---------------------------------------------------------------------------
// Profile: what the model is allowed to know about the file.
// ---------------------------------------------------------------------------
const NUM_RE = /^\s*[-+]?[$€£₹]?\s*\d[\d,]*(\.\d+)?\s*%?\s*$/;
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').trim();
  if (!s || !NUM_RE.test(s)) return null;
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
const DATE_RE = /^\d{4}-\d{2}(-\d{2})?([T ].*)?$|^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^[A-Za-z]{3,9} \d{1,2},? \d{4}$/;
export function toDate(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const s = String(v ?? '').trim();
  if (!s || !DATE_RE.test(s)) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function profileColumns(headers, rows) {
  return headers.map((name) => {
    const values = rows.map((r) => r[name]).filter((v) => v != null && String(v).trim() !== '');
    const nums = values.map(toNumber).filter((n) => n !== null);
    const dates = nums.length ? [] : values.map(toDate).filter(Boolean);
    // 80 percent: real lists carry stray n/a and TBD cells in number columns
    const type = values.length && nums.length >= values.length * 0.8 ? 'number' : values.length && dates.length >= values.length * 0.8 ? 'date' : 'text';
    const distinct = new Set(values.map((v) => String(v).trim())).size;
    const col = { name, type, filled: values.length, distinct, samples: [] };
    if (type === 'number') { col.min = Math.min(...nums); col.max = Math.max(...nums); }
    else if (type === 'date') { col.min = new Date(Math.min(...dates)).toISOString().slice(0, 10); col.max = new Date(Math.max(...dates)).toISOString().slice(0, 10); }
    if (type === 'text') {
      const counts = new Map(); // keyed case-insensitively, like the executor groups; the first spelling seen is shown
      for (const v of values) { const shown = String(v).trim().slice(0, SAMPLE_CHARS); const k = shown.toLowerCase(); const c = counts.get(k); counts.set(k, c ? [c[0], c[1] + 1] : [shown, 1]); }
      col.samples = [...counts.values()].sort((a, b) => b[1] - a[1]).slice(0, MAX_SAMPLES).map(([shown]) => shown);
    }
    return col;
  });
}

export function validateProfile(profile, headers) {
  if (!Array.isArray(profile) || profile.length !== headers.length) return 'profile must have one entry per header.';
  for (let i = 0; i < profile.length; i++) {
    const c = profile[i];
    if (!c || typeof c !== 'object' || c.name !== headers[i]) return 'profile entries must follow headers in order.';
    if (!['number', 'date', 'text'].includes(c.type)) return 'profile type is number, date or text.';
    if (!Number.isSafeInteger(c.filled) || c.filled < 0 || !Number.isSafeInteger(c.distinct) || c.distinct < 0) return 'profile filled and distinct are whole numbers.';
    if (!Array.isArray(c.samples) || c.samples.length > MAX_SAMPLES || c.samples.some((s) => typeof s !== 'string' || s.length > SAMPLE_CHARS)) return `profile samples: at most ${MAX_SAMPLES} strings of ${SAMPLE_CHARS} characters.`;
    for (const k of ['min', 'max']) if (c[k] !== undefined && !(typeof c[k] === 'number' ? Number.isFinite(c[k]) : typeof c[k] === 'string' && c[k].length <= 32)) return `profile ${k} is a number or a short string.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan: the only thing the model may return about the data.
// ---------------------------------------------------------------------------
export function validatePlan(plan, headers) {
  const col = (c) => typeof c === 'string' && headers.includes(c) && !BAD.has(c);
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return 'plan must be an object.';
  if (!(plan.view in VIEWS)) return `view is one of ${Object.keys(VIEWS).join(', ')}.`;
  const filters = plan.filters ?? [];
  if (!Array.isArray(filters) || filters.length > MAX_FILTERS) return `filters: at most ${MAX_FILTERS}.`;
  for (const f of filters) {
    if (!f || !col(f.column) || !FILTER_OPS.includes(f.op)) return 'each filter needs a known column and op.';
    if (['empty', 'not_empty'].includes(f.op)) continue;
    if (f.op === 'in') { if (!Array.isArray(f.value) || f.value.length < 1 || f.value.length > 20 || f.value.some((v) => typeof v !== 'string' || v.length > 200)) return 'in takes 1 to 20 short strings.'; continue; }
    if (!(typeof f.value === 'string' && f.value.length <= 200) && !(typeof f.value === 'number' && Number.isFinite(f.value))) return 'filter value is a short string or a number.';
  }
  if (plan.group_by != null && !col(plan.group_by)) return 'group_by must be a header.';
  if (plan.bucket != null && !BUCKETS.includes(plan.bucket)) return `bucket is one of ${BUCKETS.join(', ')}.`;
  const m = plan.measure ?? { fn: 'count' };
  if (!m || !MEASURES.includes(m.fn)) return `measure.fn is one of ${MEASURES.join(', ')}.`;
  if (m.fn !== 'count' && !col(m.column)) return `measure ${m.fn} needs a column.`;
  if (plan.sort != null && !['desc', 'asc', 'group'].includes(plan.sort)) return 'sort is desc, asc or group.';
  if (plan.limit != null && !(Number.isSafeInteger(plan.limit) && plan.limit >= 1 && plan.limit <= MAX_LIMIT)) return `limit is 1 to ${MAX_LIMIT}.`;
  if (plan.columns != null && (!Array.isArray(plan.columns) || plan.columns.length > MAX_LIST_COLUMNS || plan.columns.some((c) => !col(c)))) return `columns: at most ${MAX_LIST_COLUMNS} headers.`;
  if (['rank', 'share', 'trend', 'compare'].includes(plan.view) && plan.group_by == null) return `${plan.view} needs group_by.`;
  return null;
}

// A headline may carry placeholders, never digits: the browser fills the
// numbers in after runPlan, so a wrong number can only come from the data.
export const PLACEHOLDERS = ['value', 'matched', 'total', 'top', 'top_value', 'groups'];
export function cleanHeadline(text) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\s*[\u2014\u2013]\s*/g, ', ').trim().slice(0, 160);
  const noPlaceholders = t.replace(/\{[a-z_]+\}/g, '');
  if (!t || /\d/.test(noPlaceholders)) return null;
  if ([...t.matchAll(/\{([a-z_]+)\}/g)].some((m) => !PLACEHOLDERS.includes(m[1]))) return null;
  return t;
}

// ---------------------------------------------------------------------------
// Executor: runs in the browser over the parsed rows.
// ---------------------------------------------------------------------------
const norm = (v) => String(v ?? '').trim().toLowerCase();
function keep(row, f) {
  const raw = row[f.column];
  const s = norm(raw);
  switch (f.op) {
    case 'empty': return s === '';
    case 'not_empty': return s !== '';
    case 'eq': return s === norm(f.value);
    case 'neq': return s !== norm(f.value);
    case 'contains': return s.includes(norm(f.value));
    case 'starts': return s.startsWith(norm(f.value));
    case 'in': return f.value.some((v) => norm(v) === s);
    default: {
      const a = toNumber(raw) ?? toDate(raw)?.getTime() ?? null;
      const b = toNumber(f.value) ?? toDate(f.value)?.getTime() ?? null;
      if (a === null || b === null) return false;
      return f.op === 'gt' ? a > b : f.op === 'gte' ? a >= b : f.op === 'lt' ? a < b : a <= b;
    }
  }
}
function bucketKey(v, bucket) {
  if (bucket === 'none' || bucket == null) { const s = String(v ?? '').trim(); return s === '' ? '(blank)' : s; }
  const d = toDate(v);
  if (!d) return '(no date)';
  return bucket === 'year' ? String(d.getUTCFullYear()) : d.toISOString().slice(0, 7);
}
function measureOf(rows, m) {
  if (m.fn === 'count') return rows.length;
  const vals = rows.map((r) => r[m.column]);
  if (m.fn === 'distinct') return new Set(vals.map(norm).filter(Boolean)).size;
  const nums = vals.map(toNumber).filter((n) => n !== null);
  if (!nums.length) return null;
  if (m.fn === 'sum') return nums.reduce((a, b) => a + b, 0);
  if (m.fn === 'avg') return nums.reduce((a, b) => a + b, 0) / nums.length;
  return m.fn === 'min' ? Math.min(...nums) : Math.max(...nums);
}

export function runPlan(rows, plan) {
  const matched = rows.filter((r) => (plan.filters ?? []).every((f) => keep(r, f)));
  const m = plan.measure ?? { fn: 'count' };
  const limit = plan.limit ?? (plan.view === 'list' ? 20 : plan.view === 'share' ? 8 : plan.view === 'compare' ? 4 : 12);
  const out = { view: plan.view, total: rows.length, matched: matched.length, measure: m, groups: [], rows: [], columns: [] };
  if (plan.view === 'list') {
    out.columns = plan.columns?.length ? plan.columns : Object.keys(rows[0] ?? {}).slice(0, MAX_LIST_COLUMNS);
    out.rows = matched.slice(0, limit).map((r) => Object.fromEntries(out.columns.map((c) => [c, r[c] ?? ''])));
    return out;
  }
  if (plan.group_by == null) { out.value = measureOf(matched, m); return out; }
  const by = new Map(); // grouped case-insensitively, like filters; the first spelling seen is shown
  for (const r of matched) { const shown = bucketKey(r[plan.group_by], plan.bucket); const k = shown.toLowerCase(); if (!by.has(k)) by.set(k, [shown, []]); by.get(k)[1].push(r); }
  let groups = [...by.values()].map(([key, rs]) => ({ key, value: measureOf(rs, m), count: rs.length }));
  const sort = plan.sort ?? (plan.view === 'trend' ? 'group' : 'desc');
  if (sort === 'group') groups.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  else groups.sort((a, b) => ((b.value ?? -Infinity) - (a.value ?? -Infinity)) * (sort === 'asc' ? -1 : 1));
  if (groups.length > limit) {
    const rest = groups.slice(limit);
    groups = groups.slice(0, limit);
    // shortcut: "other" only sums counts and sums; avg, min, max and distinct of the tail are not combinable, so other is omitted for them
    if (plan.view === 'share' && ['count', 'sum'].includes(m.fn)) groups.push({ key: 'Other', value: rest.reduce((a, g) => a + (g.value ?? 0), 0), count: rest.reduce((a, g) => a + g.count, 0), other: rest.length });
  }
  out.groups = groups;
  out.value = measureOf(matched, m);
  return out;
}

// The browser fills the headline from the result; digits never come from the model.
export const fmt = (n) => (n == null ? 'n/a' : Number.isInteger(n) ? n.toLocaleString('en-US') : Number(n.toFixed(2)).toLocaleString('en-US'));
export function fillHeadline(template, result) {
  const top = result.groups[0];
  const vars = { value: fmt(result.value), matched: fmt(result.matched), total: fmt(result.total), top: top ? top.key : 'n/a', top_value: top ? fmt(top.value) : 'n/a', groups: fmt(result.groups.length) };
  return template.replace(/\{([a-z_]+)\}/g, (_, k) => vars[k] ?? '');
}
export function describePlan(plan, result) {
  const m = plan.measure ?? { fn: 'count' };
  const what = m.fn === 'count' ? 'rows' : `${m.fn} of ${m.column}`;
  const where = (plan.filters ?? []).length ? ` where ${plan.filters.map((f) => `${f.column} ${f.op}${'value' in f ? ' ' + (Array.isArray(f.value) ? f.value.join(', ') : f.value) : ''}`).join(' and ')}` : '';
  if (plan.view === 'list') return `${fmt(result.matched)} of ${fmt(result.total)} rows${where}`;
  if (plan.group_by == null) return `${what}${where}: ${fmt(result.value)}`;
  return `${what} by ${plan.group_by}${where}: ${fmt(result.groups.length)} groups, ${fmt(result.matched)} rows`;
}
