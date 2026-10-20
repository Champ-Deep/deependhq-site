// scripts/toolkit-store-selftest.mjs : executable SQL tests for the wallet.
// Real SQLite (node:sqlite) through the exact D1 API surface the backend uses.
// Run: node scripts/toolkit-store-selftest.mjs

import { makeD1, setSetting, seedGrant, seedRun, check, finish } from './toolkit-testkit.mjs';
import * as store from '../worker/toolkit-store.js';

const now = () => new Date();
const yester = () => new Date(Date.now() - 86400000);

function mkP(uid, { rows = 1, micro = 10000, at = now() } = {}) {
  return {
    id: crypto.randomUUID(),
    uid,
    requestId: crypto.randomUUID(),
    toolId: 'lead-scorer',
    listName: 'list',
    payloadHash: 'hash',
    rowCount: rows,
    maxCredits: Math.ceil(micro / 1000),
    reserveMicro: micro,
    creditsHeld: Math.ceil(micro / 1000),
    createdAt: at.toISOString(),
    dayStart: store.utcDayStart(at),
  };
}

const reserve = (d1, p) => store.reserveStmt(d1, p).run();

// 1. migrations apply, schema present
{
  const d1 = makeD1();
  const tables = d1.query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'toolkit_%' ORDER BY name").results;
  check('migration creates 5 toolkit tables', tables.length === 5, JSON.stringify(tables));
  const s = await store.readSettings(d1);
  check('absent settings read as 0 (fail closed)', s.global_daily_cap_micro === 0 && s.welcome_credits === 0 && s.default_daily_credit_cap === 0 && s.paid_allowance_credits === 0);
}

// 2. unconfigured system rejects every reservation
{
  const d1 = makeD1();
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  const r = await reserve(d1, mkP('user_a'));
  check('no settings: reservation rejected', r.meta.changes === 0);
  const why = await store.diagnoseReserve(d1, mkP('user_a'));
  check('diagnosis names disabled global cap', why.error === 'global_cap_disabled', why.error);
}

// 3. happy path + arithmetic guard + wallet guard
{
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 1000000);
  setSetting(d1, 'default_daily_credit_cap', 1000);
  setSetting(d1, 'default_daily_row_cap', 1000);
  seedGrant(d1, 'user_a', 100);
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  const p = mkP('user_a', { micro: 40000 }); // holds 40 credits
  const r = await reserve(d1, p);
  check('reservation accepted within wallet', r.meta.changes === 1);
  const run = await store.getRunByIdempotency(d1, 'user_a', p.requestId);
  check('run persisted with hold', run && run.status === 'new' && run.credits_held === 40 && run.reserve_micro === 40000);

  // wrong credits_held vs ceil(reserve/1000) must be rejected by the guard
  const bad = mkP('user_a', { micro: 40000 });
  bad.creditsHeld = 10;
  check('inconsistent ceil guard rejects', (await reserve(d1, bad)).meta.changes === 0);

  // wallet exhausted: available = 100 - 0 - 40 = 60, try 61
  const over = mkP('user_a', { micro: 61000 });
  check('wallet overdraw rejected', (await reserve(d1, over)).meta.changes === 0);
  const why = await store.diagnoseReserve(d1, over);
  check('diagnosis: insufficient_credits', why.error === 'insufficient_credits', why.error);

  // exact boundary: available 60 -> 60 accepted
  const edge = mkP('user_a', { micro: 60000 });
  check('exact boundary accepted', (await reserve(d1, edge)).meta.changes === 1);

  // stale-read race (the doc's forbidden read-then-write): caller read
  // available=100 before either reserve, then both attempt 60+60.
  const stale1 = mkP('user_a', { micro: 60000 }); // will fail: wallet already 100 held
  check('stale second reserve rejected atomically', (await reserve(d1, stale1)).meta.changes === 0);
  const agg = await store.getUserAggregate(d1, 'user_a', store.utcDayStart());
  check('all 100 credits held, available is 0, nothing oversubscribed', agg.credits_held === 100 && agg.credits_available === 0, JSON.stringify(agg));
}

// 4. two tool ids against one wallet, concurrent attempts
{
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 1000000);
  setSetting(d1, 'default_daily_credit_cap', 1000);
  setSetting(d1, 'default_daily_row_cap', 1000);
  seedGrant(d1, 'user_a', 25); // exactly 2.5 batches of 10 credits
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  const mkTool = (tool, micro) => {
    const p = mkP('user_a', { micro });
    p.toolId = tool;
    return p;
  };
  const results = await Promise.all([
    reserve(d1, mkTool('lead-scorer', 10000)),
    reserve(d1, mkTool('second-tool', 10000)),
    reserve(d1, mkTool('lead-scorer', 10000)),
    reserve(d1, mkTool('second-tool', 10000)),
  ]);
  const ok = results.filter((r) => r.meta.changes === 1).length;
  const agg = await store.getUserAggregate(d1, 'user_a', store.utcDayStart());
  check('across two tool ids: exactly 2 succeed on 25 credits for 10-credit holds', ok === 2, `ok=${ok}`);
  check('sum of holds <= granted', agg.credits_held <= 25 && agg.credits_held === 20, `held=${agg.credits_held}`);
}

// 5. user daily caps, with cross-day holds counting (symmetric to global rule)
{
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 100000000);
  setSetting(d1, 'default_daily_credit_cap', 100);
  setSetting(d1, 'default_daily_row_cap', 2);
  seedGrant(d1, 'user_a', 1000);
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  // unresolved hold from yesterday: 80 credits
  seedRun(d1, { uid: 'user_a', createdAt: yester().toISOString(), creditsHeld: 80, heldMicro: 80000, status: 'new' });

  const tight = mkP('user_a', { micro: 30000 }); // 80 held + 30 > 100
  check('cross-day hold counts against daily credit cap', (await reserve(d1, tight)).meta.changes === 0);
  check('diagnosis: daily_credit_cap', (await store.diagnoseReserve(d1, tight)).error === 'daily_credit_cap');

  const okP = mkP('user_a', { micro: 20000, rows: 2 });
  check('within daily cap accepted', (await reserve(d1, okP)).meta.changes === 1);

  const tooManyRows = mkP('user_a', { micro: 1000, rows: 1 });
  check('daily row cap rejects next row (2 today already)', (await reserve(d1, tooManyRows)).meta.changes === 0);
  check('diagnosis: daily_row_cap', (await store.diagnoseReserve(d1, tooManyRows)).error === 'daily_row_cap');
}

// 5b. per-user override beats default
{
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 100000000);
  setSetting(d1, 'default_daily_credit_cap', 5);
  setSetting(d1, 'default_daily_row_cap', 100);
  await store.ensureAccount(d1, 'user_low', store.nowIso());
  await store.ensureAccount(d1, 'user_hi', store.nowIso());
  await store.adminUpsertUser(d1, 'user_low', { daily_credit_cap: 5 }, store.nowIso());
  await store.adminUpsertUser(d1, 'user_hi', { daily_credit_cap: 500 }, store.nowIso());
  seedGrant(d1, 'user_low', 1000);
  seedGrant(d1, 'user_hi', 1000);
  const a = mkP('user_low', { micro: 10000 }); // needs 10 > 5
  const b = mkP('user_hi', { micro: 10000 });
  check('override 5 rejects a 10-credit hold', (await reserve(d1, a)).meta.changes === 0);
  check('override 500 accepts', (await reserve(d1, b)).meta.changes === 1);
}

// 5c. disabled account rejected
{
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 1000000);
  setSetting(d1, 'default_daily_credit_cap', 100);
  setSetting(d1, 'default_daily_row_cap', 100);
  seedGrant(d1, 'user_d', 100);
  await store.ensureAccount(d1, 'user_d', store.nowIso());
  await store.adminUpsertUser(d1, 'user_d', { disabled: 1 }, store.nowIso());
  const r = await reserve(d1, mkP('user_d'));
  check('disabled account rejected', r.meta.changes === 0);
  check('diagnosis: account_disabled', (await store.diagnoseReserve(d1, mkP('user_d'))).error === 'account_disabled');
}

// 6. global micro cap: today's settlements + ALL unresolved holds, 0 disabled
{
  const d1 = makeD1();
  setSetting(d1, 'default_daily_credit_cap', 1000000);
  setSetting(d1, 'default_daily_row_cap', 1000000);
  seedGrant(d1, 'user_a', 1000000);
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  setSetting(d1, 'global_daily_cap_micro', 10000);
  seedRun(d1, { uid: 'user_a', createdAt: yester().toISOString(), creditsHeld: 0, heldMicro: 8000, status: 'held' });
  seedRun(d1, { uid: 'user_a', createdAt: store.nowIso(), spentMicro: 1000, creditsUsed: 1, status: 'completed' });
  const g = await store.getGlobalAggregate(d1, store.utcDayStart());
  check('global aggregate: 1000 today spent + 8000 cross-day held', g.spent_micro === 1000 && g.held_micro === 8000, JSON.stringify(g));
  const r1 = await reserve(d1, mkP('user_a', { micro: 1000 }));
  check('reserve exactly to global ceiling accepted', r1.meta.changes === 1);
  const r2 = await reserve(d1, mkP('user_a', { micro: 1 }));
  check('one micro past global ceiling rejected', r2.meta.changes === 0);
  check('diagnosis: global_cap', (await store.diagnoseReserve(d1, mkP('user_a', { micro: 1 }))).error === 'global_cap');
  setSetting(d1, 'global_daily_cap_micro', 0);
  check('global cap 0 disables all reservation', (await reserve(d1, mkP('user_a', { micro: 1000 }))).meta.changes === 0);

  // hard app ceiling holds even with a huge configured cap
  setSetting(d1, 'global_daily_cap_micro', 1000000000000);
  check('app ceiling 250000 micro enforced in SQL', (await reserve(d1, mkP('user_a', { micro: 250001 }))).meta.changes === 0);
  check('250000 micro accepted', (await reserve(d1, mkP('user_a', { micro: 250000 }))).meta.changes === 1);
}

// 7. settlement primitives: op log order, cost recording, status guard
{
  const d1 = makeD1();
  setSetting(d1, 'global_daily_cap_micro', 1000000000);
  setSetting(d1, 'default_daily_credit_cap', 100000);
  setSetting(d1, 'default_daily_row_cap', 100000);
  seedGrant(d1, 'user_a', 1000);
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  const p = mkP('user_a', { micro: 90000 });
  await reserve(d1, p);

  // reservation logged BEFORE perform, result recorded after
  await store.logOp(d1, p.id, 1, 'treg', 'enrich', 60000, store.nowIso());
  let ops = await store.listOps(d1, p.id);
  check('op reserved before result exists', ops.length === 1 && ops[0].status === 'reserved' && ops[0].cost_micro === null);
  await store.recordOpResult(d1, p.id, 1, { costMicro: 61000, status: 'ok', callId: 'call_1' });
  await store.logOp(d1, p.id, 2, 'treg', 'verify', 30000, store.nowIso());
  await store.recordOpResult(d1, p.id, 2, { costMicro: null, status: 'unknown', callId: null });
  ops = await store.listOps(d1, p.id);
  check('actual above per-call reserve kept unclamped', ops[0].cost_micro === 61000, String(ops[0].cost_micro));
  check('call_id stored', ops[0].call_id === 'call_1');

  // settle: known 61000 spent, unknown op keeps 30000 held
  const settled = await store.settleRun(d1, {
    status: 'held', creditsUsed: 61, creditsHeld: 30, spentMicro: 61000, heldMicro: 30000,
    results: '[]', error: null, settledAt: store.nowIso(), id: p.id, uid: 'user_a',
  });
  check('first settle applies', settled === true);
  const again = await store.settleRun(d1, {
    status: 'completed', creditsUsed: 0, creditsHeld: 0, spentMicro: 0, heldMicro: 0,
    results: '[]', error: null, settledAt: store.nowIso(), id: p.id, uid: 'user_a',
  });
  check('second settle is a guarded no-op (status new only)', again === false);
  const agg = await store.getUserAggregate(d1, 'user_a', store.utcDayStart());
  check('post-settle wallet: 1000 - 61 used - 30 held', agg.credits_available === 909 && agg.credits_used === 61 && agg.credits_held === 30, JSON.stringify(agg));
}

// 8. welcome grant: idempotent, pool bounded, 0 disabled
{
  const d1 = makeD1();
  setSetting(d1, 'welcome_credits', 60);
  setSetting(d1, 'trial_pool_credits', 100);
  await store.ensureAccount(d1, 'user_1', store.nowIso());
  await store.ensureAccount(d1, 'user_2', store.nowIso());
  const g1 = await store.welcomeGrantStmt(d1, 'welcome:user_1', 'user_1', 60, store.nowIso()).run();
  check('first welcome grant applies', g1.meta.changes === 1);
  const g1b = await store.welcomeGrantStmt(d1, 'welcome:user_1', 'user_1', 60, store.nowIso()).run();
  check('duplicate welcome is a no-op', g1b.meta.changes === 0);
  const g2 = await store.welcomeGrantStmt(d1, 'welcome:user_2', 'user_2', 60, store.nowIso()).run();
  check('trial pool 100 rejects second 60-credit grant', g2.meta.changes === 0);
  setSetting(d1, 'trial_pool_credits', 200);
  const g2b = await store.welcomeGrantStmt(d1, 'welcome:user_2', 'user_2', 60, store.nowIso()).run();
  check('raised pool lets the pending grant through', g2b.meta.changes === 1);
  const total = d1.query(`SELECT COALESCE(SUM(credits),0) AS t FROM toolkit_events WHERE type='welcome'`).results[0].t;
  check('aggregate welcome <= pool', total === 120 && total <= 200, String(total));

  setSetting(d1, 'welcome_credits', 0);
  await store.ensureAccount(d1, 'user_3', store.nowIso());
  const g3 = await store.welcomeGrantStmt(d1, 'welcome:user_3', 'user_3', 0, store.nowIso()).run();
  check('welcome 0 grants nothing', g3.meta.changes === 0);
}

// 9. paid grant idempotency: per user + subscription item + period
{
  const d1 = makeD1();
  await store.ensureAccount(d1, 'user_p', store.nowIso());
  const key = 'paid:user_p:si_1:1760000000000';
  const a = await store.eventStmt(d1, { key, uid: 'user_p', type: 'paid', credits: 500, detail: '{}', now: store.nowIso() }).run();
  const b = await store.eventStmt(d1, { key, uid: 'user_p', type: 'paid', credits: 500, detail: '{}', now: store.nowIso() }).run();
  check('paid grant applies once per period', a.meta.changes === 1 && b.meta.changes === 0);
  const next = await store.eventStmt(d1, { key: 'paid:user_p:si_1:1762592000000', uid: 'user_p', type: 'paid', credits: 500, detail: '{}', now: store.nowIso() }).run();
  check('next paid period grants a fresh allowance', next.meta.changes === 1);
  const paid = d1.query(`SELECT COALESCE(SUM(credits),0) AS t FROM toolkit_events WHERE type='paid'`).results[0].t;
  check('total paid credits = 2 periods', paid === 1000, String(paid));
}

// 10. day boundary: yesterday's spend does not count as today
{
  const d1 = makeD1();
  await store.ensureAccount(d1, 'user_a', store.nowIso());
  seedRun(d1, { uid: 'user_a', createdAt: yester().toISOString(), spentMicro: 5000, creditsUsed: 5, rows: 1, status: 'completed' });
  const agg = await store.getUserAggregate(d1, 'user_a', store.utcDayStart());
  check('cross-day spend excluded from today aggregates', agg.spent_micro === 0 && agg.credits_used === 0 && agg.rows === 0, JSON.stringify(agg));
}

finish('toolkit-store-selftest');
