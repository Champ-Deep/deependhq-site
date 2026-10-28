-- Toolkit V4: per-user desktop files and the AI query log. Contract: docs/toolkit-v4-api.md sections 3 and 5.
-- Apply with: npx wrangler d1 migrations apply toolkit-db --remote

-- One row per file or folder. Bytes live in R2 (binding TOOLKIT_FILES) under r2_key, which is
-- random per file and never derived from the path, so a move or rename never touches R2.
-- path is the full normalised path ("/Leads/October/a.csv"), parent its folder ("/" for the root).
CREATE TABLE IF NOT EXISTS files (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,              -- file | folder
  path       TEXT NOT NULL,
  parent     TEXT NOT NULL,
  name       TEXT NOT NULL,
  size       INTEGER NOT NULL DEFAULT 0,
  mime       TEXT NOT NULL DEFAULT '',
  r2_key     TEXT,                       -- NULL for folders
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, path)
);
CREATE INDEX IF NOT EXISTS files_user_parent ON files (user_id, parent);

-- Every model call. Cell values are never stored: prompt and response carry [value] in their place.
-- Retention 180 days (daily cron purge); the Iceberg table default.toolkit_ai_log is the long-term copy.
CREATE TABLE IF NOT EXISTS ai_log (
  id           TEXT PRIMARY KEY,
  ts           TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  job_id       TEXT NOT NULL DEFAULT '',
  action       TEXT NOT NULL,
  op           TEXT NOT NULL DEFAULT '',
  engine       TEXT NOT NULL DEFAULT '',
  model        TEXT NOT NULL DEFAULT '',
  goal         TEXT NOT NULL DEFAULT '',
  headers_json TEXT NOT NULL DEFAULT '[]',
  prompt       TEXT NOT NULL DEFAULT '',
  response     TEXT NOT NULL DEFAULT '',
  tokens_in    INTEGER,
  tokens_out   INTEGER,
  cost_micro   INTEGER,
  outcome      TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ai_log_ts ON ai_log (ts);
CREATE INDEX IF NOT EXISTS ai_log_user_ts ON ai_log (user_id, ts);
