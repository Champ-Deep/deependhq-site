// Self-test for the /api/oracle/* proxy in worker/index.js, against a live champoracle-agent.
// Usage: ORACLE_URL=http://127.0.0.1:3117 ORACLE_KEY=<workspace key> node scripts/oracle-proxy-selftest.mjs
// Runs the Worker's fetch() in Node directly (no wrangler), so it checks the proxy logic, not the Cloudflare runtime.
import worker from '../worker/index.js';

const env = { ORACLE_URL: process.env.ORACLE_URL, ORACLE_KEY: process.env.ORACLE_KEY, ORACLE_PASSCODE: 'testpass', ASSETS: { fetch: async () => new Response('') } };
if (!env.ORACLE_URL || !env.ORACLE_KEY) throw new Error('set ORACLE_URL and ORACLE_KEY');
const call = (path, init = {}) => worker.fetch(new Request('https://deependhq.com' + path, init), env, { waitUntil() {} });
const assert = (ok, msg) => { if (!ok) throw new Error('FAIL: ' + msg); console.log('ok  ' + msg); };
const pass = { 'x-passcode': 'testpass', 'content-type': 'application/json' };

let r = await call('/api/oracle/reports', { method: 'POST', body: '{}' });
assert(r.status === 401, 'no passcode is 401');
r = await worker.fetch(new Request('https://deependhq.com/api/oracle/reports', { method: 'POST', body: '{}' }), { ...env, ORACLE_KEY: '' }, { waitUntil() {} });
assert(r.status === 503, 'missing env is 503');
r = await call('/api/oracle/reports/zzz', { headers: pass });
assert(r.status === 404, 'bad id shape is 404');
r = await call('/api/oracle/reports', { method: 'POST', headers: pass, body: JSON.stringify({ client: 'X' }) });
assert(r.status === 400 && (await r.json()).error, 'brief without copy is the upstream 400');

const brief = { client: 'Acme Grocer', icp: { description: 'quality-first grocery shoppers in Bengaluru', roles: ['quality-first shopper', 'store loyalist'], geos: ['Bengaluru'] },
  site: { headline: "Bengaluru's best stores, delivered", body: 'Curated specialty stores. Order in 2 hours.' },
  ads: [{ headline: 'Fresh from Raku', body: 'Flat Rs 29 delivery to HSR. Install today.' }], ads_channel: 'meta_ad', panel_size: 8,
  mix: { seniority: null, company_size: null, decision_role: null, inbox_load: null } };
r = await call('/api/oracle/reports', { method: 'POST', headers: pass, body: JSON.stringify(brief) });
let job = await r.json();
assert(r.status === 202 && /^rep_/.test(job.id), 'queued: ' + job.id);
for (let i = 0; i < 50 && job.status === 'running'; i++) { await new Promise((d) => setTimeout(d, 200)); job = await (await call('/api/oracle/reports/' + job.id, { headers: pass })).json(); }
assert(job.status === 'done' && job.share_url === env.ORACLE_URL.replace(/\/$/, '') + job.share_path, 'done with absolute share_url ' + job.share_url);
const page = await fetch(job.share_url);
assert(page.status === 200 && (await page.text()).includes('model simulation'), 'share page serves without a key and carries the disclaimer');
const data = await (await fetch(job.share_url + '.json')).json();
assert(data.client === 'Acme Grocer' && data.audience.personas.length === 8 && data.tests.length === 2, 'share json: 8 personas, 2 tests');
console.log('oracle proxy selftest passed');
