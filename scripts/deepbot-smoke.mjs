// scripts/deepbot-smoke.mjs : one full DeepBot turn through `wrangler dev` (real workerd, local D1 and R2).
// The model is scripts/deepbot-smoke/fixture.js, so nothing is spent. Run: node scripts/deepbot-smoke.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sessionToken, PK, SK, JWT_PUBLIC_PEM } from './toolkit-testkit.mjs';

const PORT = 8799, BASE = `http://127.0.0.1:${PORT}`;
const cfg = new URL('./deepbot-smoke/wrangler.jsonc', import.meta.url).pathname;
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'deepbot-smoke-'));
const wr = (...a) => execFileSync('npx', ['wrangler', ...a, '-c', cfg, '--local', '--persist-to', dir], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

wr('d1', 'migrations', 'apply', 'toolkit-local');
const now = new Date().toISOString();
writeFileSync(join(dir, 'seed.sql'), `INSERT INTO toolkit_settings (key, value) VALUES ('global_daily_cap_micro','25000000'),('default_daily_credit_cap','1000'),('default_daily_row_cap','5000');
INSERT INTO toolkit_accounts (user_id, email, created_at) VALUES ('user_smoke','','${now}');
INSERT INTO toolkit_events (key, user_id, type, credits, detail, created_at) VALUES ('smoke:grant','user_smoke','welcome',5000,'','${now}');`);
wr('d1', 'execute', 'toolkit-local', '--file', join(dir, 'seed.sql'));

const vars = { CLERK_PUBLISHABLE_KEY: PK, CLERK_SECRET_KEY: SK, CLERK_JWT_KEY: JWT_PUBLIC_PEM, OPENROUTER_API_KEY: 'fixture' };
const dev = spawn('npx', ['wrangler', 'dev', '-c', cfg, '--local', '--persist-to', dir, '--port', String(PORT), ...Object.entries(vars).flatMap(([k, v]) => ['--var', `${k}:${v}`])], { stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
dev.stdout.on('data', (d) => { log += d; });
dev.stderr.on('data', (d) => { log += d; });
const stop = () => dev.kill('SIGTERM');
process.on('exit', stop);
try {
  for (let i = 0; i < 120 && !/Ready on/.test(log); i++) await new Promise((r) => setTimeout(r, 500));
  if (!/Ready on/.test(log)) throw new Error('wrangler dev did not start:\n' + log.slice(-800));
  const token = sessionToken({ sub: 'user_smoke', azp: BASE });
  const post = async (body) => { const r = await fetch(BASE + '/api/toolkit', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  const put = await post({ action: 'files_put', folder: '/', name: 'leads.csv', mime: 'text/csv', content_base64: Buffer.from('Name,Job\nJane,VP\n').toString('base64') });
  const turn = await post({ action: 'deepbot', message: 'what files do I have?', context: { stage: 'file', window: 'workbench', targets: [] } });
  console.log(JSON.stringify(turn, null, 2));
  const ok = put.status === 200 && turn.status === 200 && /leads\.csv/.test(turn.body.reply) && turn.body.cost_micro === 1000 && turn.body.thread_id;
  const again = await post({ action: 'deepbot', thread_id: turn.body.thread_id, message: 'and now?' });
  const ok2 = again.status === 200 && again.body.thread_id === turn.body.thread_id;
  const usage = await post({ action: 'usage' });
  console.log('usage.spent_micro =', usage.body.usage?.spent_micro);
  if (!ok || !ok2 || usage.body.usage?.spent_micro !== 2000) throw new Error('smoke failed: ' + JSON.stringify({ put, turn, again }).slice(0, 600));
  console.log('deepbot-smoke: ok (two turns in one thread through wrangler dev, 2 x 2 fixture model calls, 2000 micro settled)');
} finally { stop(); }
