// scripts/fixtures/lead-scorer-stub.mjs : TEST-ONLY stand-in for the
// parent-owned worker/lead-scorer.js. Never imported in production: the
// backend only loads this path when env.__TOOLKIT_TEST_PROVIDER is set, and
// deployment config never sets it. Production strictness: worker/toolkit.js
// otherwise does a literal import('./lead-scorer.js').
//
// Behavior is driven by globalThis.__leadStub so each scenario controls costs:
//   costs:       array of per-call actual micro (null = unknown/timeout)
//   callIds:     array of provider call ids to return as call_id
//   throwBefore: message thrown before any provider call (creds-style failure)
//   throwAfter:  message thrown after the calls complete
// It also records the options it was called with on globalThis.__leadStub.lastOpts
// and mimics the parent contract: sequential calls stop when cost is unknown
// or above the per-call reserve, partial results are retained.

export function validateLeadInput(body) {
  const rows = body && Array.isArray(body.rows) ? body.rows : null;
  if (!rows || rows.length < 1 || rows.length > 5) throw new Error('rows must be 1 to 5');
  const custom = body.custom == null ? [] : body.custom;
  if (!Array.isArray(custom) || custom.length > 3) throw new Error('custom max 3');
  return {
    rows,
    icp: String((body.icp && body.icp.slice(0, 2000)) || ''),
    enrich: !!body.enrich,
    verify_email: !!body.verify_email,
    custom,
  };
}

export function quoteLead(input) {
  const n = input.rows.length;
  const enrichment_micro = input.enrich ? n * 6000 : 0;
  const email_micro = input.verify_email ? n * 10000 : 0;
  const jev_micro = 10000;
  const max_cost_micro = enrichment_micro + email_micro + jev_micro;
  return {
    row_count: n,
    max_cost_micro,
    max_credits: Math.ceil(max_cost_micro / 1000),
    breakdown: { enrichment_micro, email_micro, jev_micro },
    warnings: [],
  };
}

export async function executeLead(input, opts) {
  const c = globalThis.__leadStub || {};
  c.lastOpts = { customerId: opts.customerId, runId: opts.runId, model: opts.model };
  if (c.throwBefore) throw new Error(c.throwBefore);
  const costs = c.costs || [];
  const callIds = c.callIds || [];
  const results = [];
  for (let i = 0; i < input.rows.length; i++) {
    if (c.stopAfterCalls != null && i >= c.stopAfterCalls) break;
    const actual = i < costs.length ? costs[i] : 3000;
    const r = await opts.call(
      { provider: 'treg', endpoint: 'enrich', reserve_micro: 6000 },
      async () => ({ data: { idx: i }, cost_micro: actual, ok: actual !== null, call_id: callIds[i] || `call_${i}` })
    );
    if (i === 0 && c.throwAfter) throw new Error(c.throwAfter);
    // parent contract: stop the sequential loop on unknown or over-reserve cost
    if (r.cost_micro === null || r.cost_micro > 6000 || !r.ok) {
      results.push({ input: input.rows[i], enrichment_status: actual === null ? 'unknown' : 'halted' });
      break;
    }
    results.push({ input: input.rows[i], enrichment_status: 'ok' });
  }
  if (c.throwAfter) throw new Error(c.throwAfter);
  return results;
}
