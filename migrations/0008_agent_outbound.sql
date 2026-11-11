-- The toolkit calls the user's own agent: their MCP server as a DeepBot tool, and signed webhooks.
-- Contract: docs/toolkit-v4-api.md section 12. Apply with: npx wrangler d1 migrations apply toolkit-db --remote
--
-- Both live in toolkit_connections (0005) as providers agent_mcp and agent_webhook, one row each per user, with the
-- MCP Bearer token or the webhook signing secret in key_ciphertext (AES-GCM under CONNECTIONS_SECRET, bound to
-- user_id:provider). meta_json holds the non-secret fields:
--   agent_mcp      {id, url, status: pending|active|changed, seen_hash, approved_hash, modes: {tool: off|read|ask}, tools: [...]}
--   agent_webhook  {id, url, events: [...]}
ALTER TABLE toolkit_connections ADD COLUMN meta_json TEXT NOT NULL DEFAULT '{}';

-- One row per webhook attempt, the last 50 per user. body_json is the event exactly as sent (ids, counts, status and
-- credits only, never a cell value, file name or note), kept so Resend sends the same event. Never the secret,
-- the signature or the receiver's answer.
CREATE TABLE IF NOT EXISTS toolkit_deliveries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  event       TEXT NOT NULL,
  body_json   TEXT NOT NULL,
  status_code INTEGER,                -- null when no HTTP answer came back
  error       TEXT,                   -- a fixed code from worker/outbound-guard.js, or null
  ms          INTEGER NOT NULL,
  ts          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS toolkit_deliveries_user_ts ON toolkit_deliveries (user_id, ts);
