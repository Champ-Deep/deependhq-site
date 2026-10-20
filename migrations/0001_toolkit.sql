-- Toolkit wallet + runs + billing idempotency for deependhq.com.
-- Apply with: npx wrangler d1 execute toolkit-db --remote --file=migrations/0001_toolkit.sql
-- Binding expected on env as TOOLKIT_DB (or toolkitDB). Optional binding, backend fails closed without it.
-- All balances are derived: available = SUM(events.credits) - SUM(runs.credits_used + runs.credits_held).
-- Every mutation is a single guarded statement or an all-or-nothing batch, never read-then-write.

CREATE TABLE IF NOT EXISTS toolkit_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- Operator-set commercial config lives here (welcome_credits, trial_pool_credits,
-- default_daily_credit_cap, default_daily_row_cap, global_daily_cap_micro,
-- paid_plan_id, paid_allowance_credits). Absent row means 0, and 0 means disabled.

CREATE TABLE IF NOT EXISTS toolkit_accounts (
  user_id           TEXT PRIMARY KEY,   -- Clerk subject string, user_xxx
  email             TEXT NOT NULL DEFAULT '',
  daily_credit_cap  INTEGER,            -- NULL = use toolkit_settings.default_daily_credit_cap
  daily_row_cap     INTEGER,            -- NULL = use toolkit_settings.default_daily_row_cap
  disabled          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS toolkit_events (
  key        TEXT PRIMARY KEY,          -- idempotency key: welcome:<uid> | paid:<uid>:<item>:<period> | evt:<svix-id>
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,             -- welcome | paid | receipt
  credits    INTEGER NOT NULL DEFAULT 0,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS toolkit_events_user ON toolkit_events (user_id);
CREATE INDEX IF NOT EXISTS toolkit_events_type  ON toolkit_events (type);

CREATE TABLE IF NOT EXISTS toolkit_runs (
  id              TEXT PRIMARY KEY,     -- server-generated run UUID
  user_id         TEXT NOT NULL,
  request_id      TEXT NOT NULL,        -- client idempotency UUID
  tool_id         TEXT NOT NULL,
  list_name       TEXT NOT NULL DEFAULT '',
  payload_hash    TEXT NOT NULL,        -- sha256 of canonical request payload
  status          TEXT NOT NULL,        -- new | completed | held | failed
  row_count       INTEGER NOT NULL,
  max_credits     INTEGER NOT NULL,
  reserve_micro   INTEGER NOT NULL,
  credits_held    INTEGER NOT NULL,     -- ceil(reserve_micro/1000) at reservation
  credits_used    INTEGER NOT NULL DEFAULT 0,
  held_micro      INTEGER NOT NULL DEFAULT 0,
  spent_micro     INTEGER NOT NULL DEFAULT 0,
  results         TEXT NOT NULL DEFAULT '',
  error           TEXT,
  pricing_version INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  settled_at      TEXT,
  UNIQUE (user_id, request_id)
);
CREATE INDEX IF NOT EXISTS toolkit_runs_user_created ON toolkit_runs (user_id, created_at);
-- Backdated rows are inserted by tests/reconciliation only; created_at is ISO-8601 UTC,
-- so lexicographic >= against 'YYYY-MM-DDT00:00:00.000Z' is a correct day boundary.

CREATE TABLE IF NOT EXISTS toolkit_ops (
  run_id        TEXT NOT NULL,
  seq           INTEGER NOT NULL,
  provider      TEXT NOT NULL,
  endpoint      TEXT NOT NULL,
  reserved_micro INTEGER NOT NULL,
  cost_micro    INTEGER,                -- NULL = unknown cost, full reserve stays held
  status        TEXT NOT NULL,          -- reserved | ok | error | unknown
  call_id       TEXT,                   -- provider call id when supplied
  created_at    TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
);
