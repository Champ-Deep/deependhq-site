-- Connections, staged connector actions, invite requests. Contract: docs/toolkit-v4-api.md section 9.
-- Apply with: npx wrangler d1 migrations apply toolkit-db --remote
-- Needs the Worker secret CONNECTIONS_SECRET (openssl rand -base64 32) before a key can be saved.

-- key_ciphertext is AES-GCM under CONNECTIONS_SECRET, bound to user_id:provider. key_hint is the masked form shown on read.
CREATE TABLE IF NOT EXISTS toolkit_connections (
  user_id        TEXT NOT NULL,
  provider       TEXT NOT NULL,
  key_ciphertext TEXT NOT NULL,
  key_hint       TEXT NOT NULL,
  label          TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL,
  PRIMARY KEY (user_id, provider)
);

-- An act only writes a row here. status: staged -> approving -> approved | failed. Only the connector_approve action (a human click) executes it.
CREATE TABLE IF NOT EXISTS connector_staged (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  provider     TEXT NOT NULL,
  op           TEXT NOT NULL,
  args_json    TEXT NOT NULL,
  preview_json TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'staged',
  result_json  TEXT,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS connector_staged_user ON connector_staged (user_id, created_at);

-- Harbinger invite requests. The email to Deep is a draft stored on the row (no outbox exists); nothing is sent.
CREATE TABLE IF NOT EXISTS invite_requests (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  email       TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',   -- open | invited | declined
  draft_to    TEXT NOT NULL DEFAULT '',
  draft_subject TEXT NOT NULL DEFAULT '',
  draft_body  TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS invite_requests_one_open ON invite_requests (user_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS invite_requests_created ON invite_requests (created_at);
