-- One staged-items table for DeepBot, a user's own agent and connector acts. Contract: docs/toolkit-v4-api.md section 10.
-- Replaces 0005's connector_staged (one approval table, not two): its rows are copied over, then it is dropped.
-- Apply with: npx wrangler d1 migrations apply toolkit-db --remote

CREATE TABLE IF NOT EXISTS toolkit_staged (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- run | files_move | connector_act | agent_call (slice 2)
  source       TEXT NOT NULL,          -- 'deepbot', 'key:<key id>', or 'user' (the user's own session)
  title        TEXT NOT NULL,          -- written by the server from kind and payload, never by the agent
  payload_json TEXT NOT NULL,          -- run: {file_id, plan, quote: {row_count, max_credits, can_run}}
  note         TEXT NOT NULL DEFAULT '', -- agent's reason, 280 chars, shown as text
  status       TEXT NOT NULL,          -- pending | approved | rejected; approving and failed for items the server executes. expired is computed
  result_json  TEXT,
  created_at   TEXT NOT NULL,
  decided_at   TEXT,
  expires_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS toolkit_staged_user ON toolkit_staged (user_id, status, created_at);

INSERT OR IGNORE INTO toolkit_staged (id, user_id, kind, source, title, payload_json, note, status, result_json, created_at, decided_at, expires_at)
  SELECT id, user_id, 'connector_act', 'user', provider || ' ' || op,
         json_object('provider', provider, 'op', op, 'args', json(args_json), 'preview', json(preview_json)), '',
         CASE status WHEN 'staged' THEN 'pending' ELSE status END, result_json, created_at,
         CASE WHEN status IN ('approved', 'failed') THEN created_at END, expires_at
  FROM connector_staged;
DROP TABLE IF EXISTS connector_staged;
