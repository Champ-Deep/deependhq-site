-- DeepBot threads. Contract: docs/toolkit-v4-api.md section 8.
-- Apply with: npx wrangler d1 migrations apply toolkit-db --remote
-- content_json never holds cell values: file samples are redacted to [value] before a turn is written.

CREATE TABLE IF NOT EXISTS deepbot_threads (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  title      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deepbot_threads_user ON deepbot_threads (user_id, created_at);

-- role is user or assistant. The last 20 rows (by seq) are the model's context.
CREATE TABLE IF NOT EXISTS deepbot_turns (
  thread_id    TEXT NOT NULL,
  seq          INTEGER NOT NULL,
  role         TEXT NOT NULL,
  content_json TEXT NOT NULL,
  cost_micro   INTEGER NOT NULL DEFAULT 0,
  ts           TEXT NOT NULL,
  PRIMARY KEY (thread_id, seq)
);
