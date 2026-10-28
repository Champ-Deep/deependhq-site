// worker/toolkit-store.js : all SQL for the shared toolkit wallet.
//
// Rules this file exists to keep:
//   - Never read a balance and then write it. Reservation is ONE guarded
//     INSERT..SELECT statement; every cap, wallet and enabled check is a
//     WHERE clause inside that statement, so two concurrent runs across any
//     tool ids cannot both pass the same stale read.
//   - 0 means disabled everywhere (caps, welcome, paid allowance, pool).
//     Absent settings row reads as 0. The backend fails closed by default.
//   - Derived balances: available = SUM(events) - SUM(runs used + held).
//     Grants are idempotent inserts into toolkit_events, settlements are a
//     single status-guarded UPDATE on toolkit_runs.
//
// D1 API surface used (all documented): prepare().bind().run()/.first()/.all()
// and batch() which executes sequentially and rolls back the whole sequence
// if a statement errors. A WHERE guard matching 0 rows is NOT an error, so
// conditional work must live inside one statement, never as "update then
// check changes across statements".

export const APP_BATCH_MICRO_CEILING = 250000; // hard scope ceiling, micro per batch
export const CREDITS_PER_USD = 1000;          // 1 credit = 1000 USD microdollars

export const SETTING_KEYS = [
  'global_daily_cap_micro',
  'welcome_credits',
  'trial_pool_credits',
  'default_daily_credit_cap',
  'default_daily_row_cap',
  'paid_plan_id',
  'paid_allowance_credits',
];

export const num = (v) => {
  const n = typeof v === 'number' ? v : parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
};

export const ceilCredits = (micro) => Math.ceil(micro / 1000);

export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const utcDayStart = (d = new Date()) => utcDay(d) + 'T00:00:00.000Z';
export const nowIso = (d = new Date()) => d.toISOString();

// --- reads ------------------------------------------------------------------

export async function readSettings(db) {
  const rows = await db
    .prepare(`SELECT key, value FROM toolkit_settings WHERE key IN (${SETTING_KEYS.map((k) => ` '${k}'`).join(',')})`)
    .all();
  const out = {};
  for (const k of SETTING_KEYS) out[k] = 0;
  for (const r of rows.results ?? rows) out[r.key] = r.value;
  return {
    global_daily_cap_micro: num(out.global_daily_cap_micro),
    welcome_credits: num(out.welcome_credits),
    trial_pool_credits: num(out.trial_pool_credits),
    default_daily_credit_cap: num(out.default_daily_credit_cap),
    default_daily_row_cap: num(out.default_daily_row_cap),
    paid_plan_id: String(out.paid_plan_id || ''),
    paid_allowance_credits: num(out.paid_allowance_credits),
  };
}

// Aggregate read used by usage and admin_usage. One statement, no writes.
export function userAggregateSql() {
  return `SELECT
    a.user_id  AS uid,
    a.email    AS email,
    a.daily_credit_cap  AS daily_credit_cap,
    a.daily_row_cap     AS daily_row_cap,
    a.disabled          AS disabled,
    (SELECT COALESCE(SUM(e.credits),0) FROM toolkit_events e WHERE e.user_id=a.user_id)
      - (SELECT COALESCE(SUM(r.credits_used + r.credits_held),0) FROM toolkit_runs r WHERE r.user_id=a.user_id)
      AS credits_available,
    (SELECT COALESCE(SUM(r.credits_used),0) FROM toolkit_runs r WHERE r.user_id=a.user_id AND r.created_at>=?1) AS credits_used,
    (SELECT COALESCE(SUM(r.credits_held),0)  FROM toolkit_runs r WHERE r.user_id=a.user_id) AS credits_held,
    (SELECT COALESCE(SUM(r.spent_micro),0)   FROM toolkit_runs r WHERE r.user_id=a.user_id AND r.created_at>=?1) AS spent_micro,
    (SELECT COALESCE(SUM(r.held_micro),0)    FROM toolkit_runs r WHERE r.user_id=a.user_id) AS held_micro,
    (SELECT COALESCE(SUM(r.row_count),0)     FROM toolkit_runs r WHERE r.user_id=a.user_id AND r.created_at>=?1) AS rows
  FROM toolkit_accounts a`;
}

// Global day view: today's settlements plus ALL unresolved holds across days.
export function globalAggregateSql() {
  return `SELECT
    (SELECT COALESCE(SUM(r.spent_micro),0) FROM toolkit_runs r WHERE r.created_at>=?1) AS spent_micro,
    (SELECT COALESCE(SUM(r.held_micro),0)  FROM toolkit_runs r WHERE r.held_micro>0)   AS held_micro`;
}

export async function getUserAggregate(db, uid, dayStart) {
  const row = await db.prepare(userAggregateSql() + ' WHERE a.user_id=?2').bind(dayStart, uid).first();
  return row || null;
}

export async function listUsers(db, dayStart) {
  const res = await db.prepare(userAggregateSql() + ' ORDER BY a.created_at LIMIT 500').bind(dayStart).all();
  return res.results;
}

// One admin page. ORDER BY is total (created_at, user_id) so pages never overlap or skip.
export async function listUsersPage(db, dayStart, limit, offset) {
  const res = await db.prepare(userAggregateSql() + ' ORDER BY a.created_at, a.user_id LIMIT ?2 OFFSET ?3').bind(dayStart, limit, offset).all();
  return res.results;
}

export async function countUsers(db) {
  const r = await db.prepare(`SELECT COUNT(*) AS n FROM toolkit_accounts`).first();
  return num(r && r.n);
}

export async function getEvent(db, key) {
  return (await db.prepare(`SELECT key, user_id, type, credits FROM toolkit_events WHERE key=?1`).bind(key).first()) || null;
}

export async function getGlobalAggregate(db, dayStart) {
  return (await db.prepare(globalAggregateSql()).bind(dayStart).first()) || { spent_micro: 0, held_micro: 0 };
}

export async function listRuns(db, uid, dayStart, limit = 30) {
  const res = await db
    .prepare(
      `SELECT id, COALESCE(NULLIF(job_id,''), id) AS job_id, tool_id, list_name, status, created_at, row_count,
              credits_used, credits_held, spent_micro, held_micro
       FROM toolkit_runs WHERE user_id=?1 ORDER BY created_at DESC, id LIMIT ?2`
    )
    .bind(uid, limit)
    .all();
  return res.results;
}

export async function getRunForOwner(db, id, uid) {
  return (
    (await db
      .prepare(`SELECT * FROM toolkit_runs WHERE id=?1 AND user_id=?2`)
      .bind(id, uid)
      .first()) || null
  );
}

export async function getRunByIdempotency(db, uid, requestId) {
  return (
    (await db
      .prepare(`SELECT * FROM toolkit_runs WHERE user_id=?1 AND request_id=?2`)
      .bind(uid, requestId)
      .first()) || null
  );
}

export async function listOps(db, runId) {
  const res = await db
    .prepare(
      `SELECT seq, provider, endpoint, reserved_micro, cost_micro, status, call_id
       FROM toolkit_ops WHERE run_id=?1 ORDER BY seq`
    )
    .bind(runId)
    .all();
  return res.results;
}

// --- writes -----------------------------------------------------------------

// Provision the account row. INSERT OR IGNORE never fails conditionally, so
// it can share a batch with the guarded reservation (statement order holds).
export function ensureAccountStmt(db, uid, now) {
  return db
    .prepare(`INSERT INTO toolkit_accounts (user_id, email, created_at) VALUES (?1, '', ?2) ON CONFLICT(user_id) DO NOTHING`)
    .bind(uid, now);
}

export async function ensureAccount(db, uid, now) {
  const res = await ensureAccountStmt(db, uid, now).run();
  return res.meta.changes > 0;
}

export async function setEmail(db, uid, email) {
  if (!email) return;
  await db.prepare(`UPDATE toolkit_accounts SET email=?1 WHERE user_id=?2 AND email<>?1`).bind(email, uid).run();
}

// THE reservation. One statement: all guards inline, all-or-nothing.
// params: 1 id, 2 uid, 3 request_id, 4 tool_id, 5 list_name, 6 payload_hash,
//         7 row_count, 8 max_credits, 9 reserve_micro, 10 credits_held,
//         11 created_at, 12 day_start
export const RESERVE_SQL = `INSERT INTO toolkit_runs
  (id, user_id, request_id, tool_id, list_name, payload_hash, status,
   row_count, max_credits, reserve_micro, credits_held, held_micro, pricing_version, created_at)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, 'new', ?7, ?8, ?9, ?10, ?9, 1, ?11
WHERE
  -- account exists and is enabled
  EXISTS (SELECT 1 FROM toolkit_accounts WHERE user_id=?2 AND disabled=0)
  -- request sanity and hard app scope ceiling
  AND ?9 > 0 AND ?9 <= ${APP_BATCH_MICRO_CEILING}
  -- creditsHeld must equal ceil(reserve_micro/1000). Division-free form so it
  -- holds whether the driver binds integers or reals (node:sqlite binds REAL).
  AND ?10 * 1000 >= ?9 AND (?10 - 1) * 1000 < ?9
  AND ?10 <= ?8
  -- wallet solvency: granted - used - held must cover this hold
  AND (SELECT COALESCE(SUM(e.credits),0) FROM toolkit_events e WHERE e.user_id=?2)
    - (SELECT COALESCE(SUM(r.credits_used + r.credits_held),0) FROM toolkit_runs r WHERE r.user_id=?2)
    - ?10 >= 0
  -- user daily credit cap (0 or unset = disabled): settlements today plus ALL
  -- outstanding holds count, mirroring the global rule. Cross-day holds bite.
  AND (SELECT COALESCE(
        (SELECT daily_credit_cap FROM toolkit_accounts WHERE user_id=?2),
        (SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='default_daily_credit_cap'), 0)) > 0
  AND (SELECT COALESCE(SUM(r.credits_used),0) FROM toolkit_runs r WHERE r.user_id=?2 AND r.created_at>=?12)
    + (SELECT COALESCE(SUM(r.credits_held),0) FROM toolkit_runs r WHERE r.user_id=?2 AND r.credits_held>0)
    + ?10
    <= (SELECT COALESCE(
         (SELECT daily_credit_cap FROM toolkit_accounts WHERE user_id=?2),
         (SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='default_daily_credit_cap'), 0))
  -- user daily row cap (0 or unset = disabled)
  AND (SELECT COALESCE(
        (SELECT daily_row_cap FROM toolkit_accounts WHERE user_id=?2),
        (SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='default_daily_row_cap'), 0)) > 0
  AND (SELECT COALESCE(SUM(r.row_count),0) FROM toolkit_runs r WHERE r.user_id=?2 AND r.created_at>=?12) + ?7
    <= (SELECT COALESCE(
         (SELECT daily_row_cap FROM toolkit_accounts WHERE user_id=?2),
         (SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='default_daily_row_cap'), 0))
  -- global daily micro cap: 0 or absent setting = disabled (fail closed).
  AND (SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='global_daily_cap_micro') > 0
  AND (SELECT COALESCE(SUM(r.spent_micro),0) FROM toolkit_runs r WHERE r.created_at>=?12)
    + (SELECT COALESCE(SUM(r.held_micro),0) FROM toolkit_runs r WHERE r.held_micro>0)
    + ?9
    <= (SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='global_daily_cap_micro')
`;

export function reserveStmt(db, p) {
  return db
    .prepare(RESERVE_SQL)
    .bind(
      p.id, p.uid, p.requestId, p.toolId, p.listName, p.payloadHash,
      p.rowCount, p.maxCredits, p.reserveMicro, p.creditsHeld,
      p.createdAt, p.dayStart
    );
}

// Read-only diagnosis after a rejected reservation, purely for the error code.
export async function diagnoseReserve(db, p) {
  const acct = await db
    .prepare(`SELECT disabled, daily_credit_cap, daily_row_cap FROM toolkit_accounts WHERE user_id=?1`)
    .bind(p.uid)
    .first();
  if (!acct) return { error: 'account_missing', status: 403 };
  if (acct.disabled) return { error: 'account_disabled', status: 403 };
  const s = await readSettings(db);
  if (s.global_daily_cap_micro <= 0) return { error: 'global_cap_disabled', status: 429 };
  const agg = await getUserAggregate(db, p.uid, p.dayStart);
  const g = await getGlobalAggregate(db, p.dayStart);
  const effCredit = acct.daily_credit_cap == null ? s.default_daily_credit_cap : num(acct.daily_credit_cap);
  const effRow = acct.daily_row_cap == null ? s.default_daily_row_cap : num(acct.daily_row_cap);
  if (effRow <= 0 || agg.rows + p.rowCount > effRow) return { error: 'daily_row_cap', status: 429 };
  if (effCredit <= 0) return { error: 'daily_credit_cap_disabled', status: 429 };
  const dayUsed = num(agg.credits_used);
  if (dayUsed + num(agg.credits_held) + p.creditsHeld > effCredit) return { error: 'daily_credit_cap', status: 429 };
  if (num(agg.credits_available) < p.creditsHeld) return { error: 'insufficient_credits', status: 403 };
  if (g.spent_micro + g.held_micro + p.reserveMicro > s.global_daily_cap_micro) return { error: 'global_cap', status: 429 };
  return { error: 'reservation_rejected', status: 429 };
}

// Per-provider operation log. INSERT happens BEFORE perform() is invoked
// (adapter contract), UPDATE records the actual cost after.
export async function logOp(db, runId, seq, provider, endpoint, reservedMicro, now) {
  await db
    .prepare(
      `INSERT INTO toolkit_ops (run_id, seq, provider, endpoint, reserved_micro, status, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'reserved', ?6)`
    )
    .bind(runId, seq, provider, endpoint, reservedMicro, now)
    .run();
}

export async function recordOpResult(db, runId, seq, { costMicro, status, callId }) {
  await db
    .prepare(`UPDATE toolkit_ops SET cost_micro=?1, status=?2, call_id=?3 WHERE run_id=?4 AND seq=?5`)
    .bind(costMicro, status, callId || null, runId, seq)
    .run();
}

// Settlement. Single status-guarded UPDATE: a second settle is a no-op.
export async function settleRun(db, p) {
  const res = await db
    .prepare(
      `UPDATE toolkit_runs SET status=?1, credits_used=?2, credits_held=?3,
         spent_micro=?4, held_micro=?5, results=?6, error=?7, settled_at=?8
       WHERE id=?9 AND user_id=?10 AND status='new'`
    )
    .bind(
      p.status, p.creditsUsed, p.creditsHeld, p.spentMicro, p.heldMicro,
      p.results, p.error, p.settledAt, p.id, p.uid
    )
    .run();
  return res.meta.changes > 0;
}

// Idempotent credit mint / receipt. ON CONFLICT DO NOTHING on the key makes
// duplicate webhook deliveries and repeated welcome attempts no-ops.
export function eventStmt(db, { key, uid, type, credits, detail, now }) {
  return db
    .prepare(
      `INSERT INTO toolkit_events (key, user_id, type, credits, detail, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(key) DO NOTHING`
    )
    .bind(key, uid, type, credits, detail, now);
}

// Welcome grant: one statement, guarded by config (both values > 0 and equal
// to what was read), aggregate trial pool, and once-per-account presence.
// params: key, uid, welcome credits read, now
export function welcomeGrantStmt(db, key, uid, credits, now) {
  return db
    .prepare(
      `INSERT INTO toolkit_events (key, user_id, type, credits, detail, created_at)
       SELECT ?1, ?2, 'welcome', ?3, '', ?4
       WHERE ?3 > 0
         AND ?3 = COALESCE((SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='welcome_credits'), -1)
         AND COALESCE((SELECT CAST(value AS INTEGER) FROM toolkit_settings WHERE key='trial_pool_credits'), -1)
             >= ?3 + (SELECT COALESCE(SUM(credits),0) FROM toolkit_events WHERE type='welcome')
         AND NOT EXISTS (SELECT 1 FROM toolkit_events WHERE type='welcome' AND user_id=?2)
       ON CONFLICT(key) DO NOTHING`
    )
    .bind(key, uid, credits, now);
}

export async function adminUpsertSetting(db, key, value) {
  await db
    .prepare(`INSERT INTO toolkit_settings (key, value) VALUES (?1, ?2)
              ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind(key, String(value))
    .run();
}

export async function adminUpsertUser(db, uid, fields, now) {
  await ensureAccount(db, uid, now);
  const sets = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k}=?${i}`);
    params.push(v);
    i++;
  }
  await db.prepare(`UPDATE toolkit_accounts SET ${sets.join(', ')} WHERE user_id=?${i}`).bind(...params, uid).run();
  return db.prepare(`SELECT user_id, email, daily_credit_cap, daily_row_cap, disabled FROM toolkit_accounts WHERE user_id=?1`).bind(uid).first();
}
