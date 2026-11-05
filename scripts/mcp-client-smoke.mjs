// scripts/mcp-client-smoke.mjs : a real MCP client against `wrangler dev --local` (docs/toolkit-v4-api.md section 11).
// Builds a throwaway local D1 (migrations applied with --local only, never remote), seeds one API key as its sha256
// hash, starts wrangler dev, then connects with @modelcontextprotocol/client in versionNegotiation mode auto and mode
// legacy and calls files_list in each. The key is generated here and never printed.
// Run: node scripts/mcp-client-smoke.mjs        (exit 0 = both modes passed)

import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const PORT = Number(process.env.SMOKE_PORT || 8799);
const URL_MCP = `http://127.0.0.1:${PORT}/api/toolkit/mcp`;
const dir = mkdtempSync(join(tmpdir(), 'dh-mcp-smoke-'));
const wrangler = (...args) => execFileSync('npx', ['wrangler', ...args, '--local', '--persist-to', dir], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } }).toString();

const key = 'dhk_live_' + randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(key).digest('hex');
const now = new Date().toISOString();
wrangler('d1', 'migrations', 'apply', 'toolkit-db');
wrangler('d1', 'execute', 'toolkit-db', '--command',
  `INSERT INTO toolkit_api_keys (id, user_id, label, prefix, key_hash, scopes, created_at) VALUES ('${randomUUID()}', 'user_smoke', 'smoke', '${key.slice(0, 16)}', '${hash}', '["files:read","jobs:read"]', '${now}');
   INSERT INTO toolkit_settings (key, value) VALUES ('api_daily_calls_per_key', '2000') ON CONFLICT(key) DO UPDATE SET value=excluded.value;`);
console.log(`local D1 ready in ${dir} (migrations applied --local, one key seeded as its hash)`);

const dev = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', dir], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, CI: '1' } });
let devLog = '';
dev.stdout.on('data', (d) => { devLog += d; });
dev.stderr.on('data', (d) => { devLog += d; });
const stop = () => { dev.kill('SIGTERM'); rmSync(dir, { recursive: true, force: true }); };

let ok = true;
try {
  // Ready when the key answers on the OpenAI tools endpoint.
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/toolkit/v1/tools`, { headers: { authorization: `Bearer ${key}` } });
      if (r.status === 200) break;
    } catch { /* not up yet */ }
    if (Date.now() - t0 > 90000) throw new Error('wrangler dev did not come up:\n' + devLog.slice(-2000));
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const mode of ['auto', 'legacy']) {
    const client = new Client({ name: 'dh-mcp-smoke', version: '1.0.0' }, { versionNegotiation: { mode } });
    const transport = new StreamableHTTPClientTransport(new URL(URL_MCP), { requestInit: { headers: { Authorization: `Bearer ${key}` } } });
    try {
      await client.connect(transport);
      const tools = (await client.listTools()).tools.map((t) => t.name);
      const r = await client.callTool({ name: 'files_list', arguments: { folder: '/' } });
      const pass = !r.isError && Array.isArray(r.structuredContent?.entries) && tools.length === 9;
      ok &&= pass;
      console.log(`mode=${mode} era=${client.getProtocolEra()} server=${client.getServerVersion()?.name} tools=${tools.length} [${tools.join(', ')}]`);
      console.log(`mode=${mode} files_list isError=${!!r.isError} structuredContent=${JSON.stringify(r.structuredContent)} ${pass ? 'PASS' : 'FAIL'}`);
    } catch (e) {
      ok = false;
      console.log(`mode=${mode} FAIL ${e && e.message}`);
    } finally {
      await client.close().catch(() => {});
    }
  }
} catch (e) {
  ok = false;
  console.log('FAIL ' + (e && e.message));
} finally {
  stop();
}
console.log(ok ? 'mcp-client-smoke: both modes passed' : 'mcp-client-smoke: FAILED');
process.exit(ok ? 0 : 1);
