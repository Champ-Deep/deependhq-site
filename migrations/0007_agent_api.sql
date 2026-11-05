-- API keys for a user's own agent, and one row per authenticated key call. Contract: docs/toolkit-v4-api.md section 11.
-- The key itself is never stored: key_hash is sha256 hex of it, prefix is its first 16 characters for display.
-- toolkit_api_calls holds the tool name and outcome only, never arguments or results.
-- Apply with: npx wrangler d1 migrations apply toolkit-db --remote

CREATE TABLE IF NOT EXISTS toolkit_api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  label        TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  scopes       TEXT NOT NULL,          -- JSON array of scope names
  created_at   TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS toolkit_api_keys_user ON toolkit_api_keys (user_id, revoked_at);

CREATE TABLE IF NOT EXISTS toolkit_api_calls (
  id         INTEGER PRIMARY KEY,
  key_id     TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  tool       TEXT NOT NULL,            -- an exposed tool name, 'unknown', or the endpoint (mcp:tools/list, v1/tools, v1/files)
  status     TEXT NOT NULL,            -- ok | error
  cost_micro INTEGER NOT NULL DEFAULT 0,
  ts         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS toolkit_api_calls_key_ts ON toolkit_api_calls (key_id, ts);
