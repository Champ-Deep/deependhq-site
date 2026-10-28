// scripts/toolkit-api-selftest.mjs : auth, IDOR, admin, replay, origin and
// end-to-end reserve/settle accounting over handleToolkit().
// Run: node scripts/toolkit-api-selftest.mjs

import {
  makeD1, setSetting, seedGrant, installFetchRouter, resetClerkFixtures, clerkFixtures,
  userJson, apiRequest, sessionToken, PK, SK, CLERK_JS_URL, JWT_PUBLIC_PEM, WEBHOOK_SECRET,
  check, finish, ORIGIN,
} from './toolkit-testkit.mjs';

// The SDK captures globalThis.fetch at module load: router first, import second.
installFetchRouter();
const { handleToolkit } = await import('../worker/toolkit.js');

const STUB = new URL('./fixtures/lead-scorer-stub.mjs', import.meta.url).href;
globalThis.__leadStub = {};

function baseEnv(d1, over = {}) {
  return {
    TOOLKIT_DB: d1,
    CLERK_PUBLISHABLE_KEY: PK,
    CLERK_SECRET_KEY: SK,
    CLERK_JWT_KEY: JWT_PUBLIC_PEM,
    CLERK_JS_URL,
    CLERK_ADMIN_IDS: 'user_admin',
    CLERK_WEBHOOK_SIGNING_SECRET: WEBHOOK_SECRET,
    TREG_API_KEY: 'treg-key',
    JEV_API_KEY: 'jev-key',
    __TOOLKIT_TEST_PROVIDER: STUB,
    ...over,
  };
}

function caps(d1, { g = 1000000, cc = 10000, rc = 10000 } = {}) {
  setSetting(d1, 'global_daily_cap_micro', g);
  setSetting(d1, 'default_daily_credit_cap', cc);
  setSetting(d1, 'default_daily_row_cap', rc);
}

async function post(env, body, opts = {}) {
  const res = await handleToolkit(apiRequest(body, opts), env);
  let j = null;
  try { j = await res.json(); } catch { /* no body */ }
  return { status: res.status, body: j, headers: res.headers };
}

async function getConfig(env) {
  const res = await handleToolkit(new Request(ORIGIN + '/api/toolkit/config'), env);
  return { status: res.status, body: await res.json(), headers: res.headers };
}

const uuid = () => crypto.randomUUID();
const runBody = (over = {}) => ({
  action: 'run',
  tool_id: 'lead-scorer',
  request_id: uuid(),
  list_name: 'my list',
  rows: [{ name: 'a' }, { name: 'b' }],
  icp: 'b2b saas',
  enrich: true,
  verify_email: true,
  custom: ['fit'],
  max_credits: 42, // stub quote: 2*6000 + 2*10000 + 10000 = 42000 micro = 42 credits
  ...over,
});

// --- config ----------------------------------------------------------------
{
  resetClerkFixtures();
  const empty = await getConfig({});
  check('config unconfigured: configured false', empty.body.configured === false, JSON.stringify(empty.body));
  check('config unconfigured: no invented script url', empty.body.clerk_script_url === null && empty.body.clerk_publishable_key === null);
  check('config: credits_per_usd 1000 + providers false + billing false',
    empty.body.credits_per_usd === 1000 && empty.body.providers.treg === false && empty.body.providers.jev === false && empty.body.billing_enabled === false,
    JSON.stringify(empty.body));
  check('config: no CORS header', empty.headers.get('access-control-allow-origin') === null);
  check('config: cache-control no-store', empty.headers.get('cache-control') === 'no-store');

  const d1 = makeD1();
  const full = await getConfig(baseEnv(d1));
  check('config configured when keys + script url + d1 present', full.body.configured === true && full.body.providers.treg === true && full.body.providers.jev === true, JSON.stringify(full.body));
  check('config billing false without paid plan config', full.body.billing_enabled === false);
  setSetting(d1, 'paid_plan_id', 'plan_pro');
  setSetting(d1, 'paid_allowance_credits', 500);
  const bill = await getConfig(baseEnv(d1));
  check('config billing true once plan + allowance + secrets configured', bill.body.billing_enabled === true, JSON.stringify(bill.body));

  const d1less = await getConfig(baseEnv(undefined, { TOOLKIT_DB: undefined }));
  check('config without d1 binding: configured false (fail closed)', d1less.body.configured === false);

  const res405 = await handleToolkit(new Request(ORIGIN + '/api/toolkit/config', { method: 'POST' }), {});
  check('POST config -> 405', res405.status === 405);
}

// --- auth ------------------------------------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  caps(d1);
  const env = baseEnv(d1);

  const noTok = await post(env, { action: 'usage' }, { token: null });
  check('no bearer token -> 401', noTok.status === 401 && noTok.body.error === 'unauthorized', JSON.stringify(noTok.body));

  // A large unauthenticated body is refused on auth, never buffered (15 MB is for signed-in callers only).
  const big = await post(env, { action: 'usage', pad: 'x'.repeat(200000) }, { token: null });
  check('large unauthenticated body -> 401 before buffering', big.status === 401 && big.body.error === 'unauthorized', JSON.stringify(big.body));
  const bigHook = await handleToolkit(new Request(ORIGIN + '/api/toolkit/nope', { method: 'POST', body: 'x'.repeat(70000) }), env);
  check('non-action POST over 64 KB -> 413', bigHook.status === 413, String(bigHook.status));

  const bad = await post(env, { action: 'usage' }, { token: 'not.a.jwt' });
  check('garbage token -> 401', bad.status === 401);

  const wrongAzp = await post(env, { action: 'usage' }, { token: sessionToken({ sub: 'user_a', azp: 'https://evil.example' }) });
  check('wrong-audience token (azp) -> 401', wrongAzp.status === 401, JSON.stringify(wrongAzp.body));

  const expired = await post(env, { action: 'usage' }, { token: sessionToken({ sub: 'user_a', expired: true }) });
  check('expired token -> 401', expired.status === 401);

  const cross = await post(env, { action: 'usage' }, { origin: 'https://evil.example' });
  check('cross-origin POST -> 403 forbidden_origin', cross.status === 403 && cross.body.error === 'forbidden_origin', JSON.stringify(cross.body));

  const ok = await post(env, { action: 'usage' });
  check('valid token -> 200 usage', ok.status === 200 && ok.body.user.id === 'user_a', JSON.stringify(ok.body).slice(0, 200));
  check('usage response carries no CORS header', ok.headers.get('access-control-allow-origin') === null);

  const noDb = await post(baseEnv(undefined, { TOOLKIT_DB: undefined }), { action: 'usage' });
  check('missing TOOLKIT_DB -> 503 fail closed', noDb.status === 503 && noDb.body.error === 'toolkit_db_not_configured', JSON.stringify(noDb.body));

  const noClerk = await post(baseEnv(d1, { CLERK_SECRET_KEY: undefined }), { action: 'usage' });
  check('missing clerk secret -> 503 clerk_not_configured', noClerk.status === 503 && noClerk.body.error === 'clerk_not_configured', JSON.stringify(noClerk.body));

  const badJson = await handleToolkit(new Request(ORIGIN + '/api/toolkit', {
    method: 'POST', headers: { authorization: 'Bearer ' + sessionToken(), 'content-type': 'application/json' }, body: '{nope',
  }), env);
  check('malformed json -> 400', badJson.status === 400);

  const unknown = await post(env, { action: 'frobnicate' });
  check('unknown action -> 400', unknown.status === 400 && unknown.body.error === 'unknown_action');

  const get = await handleToolkit(new Request(ORIGIN + '/api/toolkit'), env);
  check('GET /api/toolkit -> 405', get.status === 405);

  const wrongPath = await handleToolkit(new Request(ORIGIN + '/api/toolkit/nope'), env);
  check('unknown toolkit path -> 404', wrongPath.status === 404);
}

// --- usage shape, email, admin flag, welcome grant -------------------------
{
  resetClerkFixtures();
  clerkFixtures.users['user_a'] = userJson('user_a', 'a@example.com');
  const d1 = makeD1();
  caps(d1);
  setSetting(d1, 'welcome_credits', 50);
  setSetting(d1, 'trial_pool_credits', 100);
  const env = baseEnv(d1);

  const u1 = await post(env, { action: 'usage' });
  const keys = Object.keys(u1.body.usage).sort().join(',');
  check('usage.user + usage.usage shape per contract',
    u1.body.user.email === 'a@example.com' && u1.body.user.is_admin === false &&
    keys === 'credits_available,credits_held,credits_used,daily_credit_cap,daily_row_cap,day,disabled,held_micro,rows,spent_micro',
    keys);
  check('usage.providers and runs array present', u1.body.providers.treg === true && Array.isArray(u1.body.runs) && u1.body.runs.length === 0);
  check('welcome grant applied once on first usage', u1.body.usage.credits_available === 50, String(u1.body.usage.credits_available));

  const u2 = await post(env, { action: 'usage' });
  check('second usage: welcome not double granted', u2.body.usage.credits_available === 50, String(u2.body.usage.credits_available));

  const admin = await post(env, { action: 'usage' }, { token: sessionToken({ sub: 'user_admin' }) });
  check('CLERK_ADMIN_IDS member flagged is_admin', admin.body.user.is_admin === true && admin.body.user.id === 'user_admin');

  const notConfigured = await post(baseEnv(d1, { TREG_API_KEY: '', JEV_API_KEY: '' }), { action: 'usage' });
  check('providers booleans reflect missing keys', notConfigured.body.providers.treg === false && notConfigured.body.providers.jev === false);
}

// --- quote -----------------------------------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  caps(d1);
  const env = baseEnv(d1);

  const anon = await post(env, { action: 'quote', rows: [{ a: 1 }], icp: 'x', enrich: true, verify_email: true, custom: [] }, { token: null });
  check('quote requires signin (throttling by attribution)', anon.status === 401);

  const q = await post(env, { action: 'quote', rows: [{ a: 1 }, { a: 2 }], icp: 'x', enrich: true, verify_email: true, custom: ['fit'] });
  check('quote shape', q.status === 200 &&
    q.body.row_count === 2 && q.body.max_cost_micro === 42000 && q.body.max_credits === 42 &&
    q.body.breakdown.enrichment_micro === 12000 && q.body.breakdown.email_micro === 20000 && q.body.breakdown.jev_micro === 10000 &&
    Array.isArray(q.body.warnings), JSON.stringify(q.body));
  const runRows = d1.query('SELECT COUNT(*) AS c FROM toolkit_runs').results[0].c;
  check('quote never creates a run (no spending)', runRows === 0, String(runRows));

  const bad = await post(env, { action: 'quote', rows: Array(6).fill({}), icp: '', enrich: false, verify_email: false, custom: [] });
  check('quote validates input (max 5 rows) -> 400', bad.status === 400 && bad.body.error === 'rows must be 1 to 5', JSON.stringify(bad.body));

  const noProvider = await post(baseEnv(d1, { __TOOLKIT_TEST_PROVIDER: new URL('./fixtures/does-not-exist.mjs', import.meta.url).href }), { action: 'quote', rows: [{}], icp: '', enrich: false, verify_email: false, custom: [] });
  check('missing provider module -> 503 provider_unavailable', noProvider.status === 503 && noProvider.body.error === 'provider_unavailable');
}

// --- run: happy path, idempotent replay, conflict, X-Treg-Meta passthrough --
{
  resetClerkFixtures();
  const d1 = makeD1();
  caps(d1);
  seedGrant(d1, 'user_a', 1000);
  const env = baseEnv(d1);
  globalThis.__leadStub = { costs: [3000, 3000], callIds: ['call_x1', 'call_x2'] };

  const body = runBody();
  const r1 = await post(env, body);
  check('run completes', r1.status === 200 && r1.body.status === 'completed', JSON.stringify(r1.body).slice(0, 300));
  check('run settlement: spent 6000 micro -> 6 credits, hold released',
    r1.body.spent_micro === 6000 && r1.body.credits_used === 6 && r1.body.credits_held === 0 && r1.body.held_micro === 0,
    JSON.stringify({ s: r1.body.spent_micro, u: r1.body.credits_used, h: r1.body.credits_held }));
  check('run ledger has both ops with actual cost + call_id',
    r1.body.ledger.length === 2 && r1.body.ledger[0].cost_micro === 3000 && r1.body.ledger[0].call_id === 'call_x1' && r1.body.ledger[0].status === 'ok',
    JSON.stringify(r1.body.ledger));
  check('executeLead received customerId + runId (X-Treg-Meta)',
    globalThis.__leadStub.lastOpts.customerId === 'user_a' && globalThis.__leadStub.lastOpts.runId === r1.body.id,
    JSON.stringify(globalThis.__leadStub.lastOpts));
  check('run results stored', Array.isArray(r1.body.results) && r1.body.results.length === 2);

  const usage1 = await post(env, { action: 'usage' });
  check('wallet charged once after run', usage1.body.usage.credits_available === 994, String(usage1.body.usage.credits_available));
  check('usage history lists the run', usage1.body.runs.length === 1 && usage1.body.runs[0].id === r1.body.id && usage1.body.runs[0].status === 'completed');
  check('usage history row excludes results payload', usage1.body.runs[0].results === undefined);

  // exact replay: same request_id + same payload
  const r2 = await post(env, body);
  check('replay same UUID+payload returns same run', r2.status === 200 && r2.body.id === r1.body.id && r2.body.status === 'completed', JSON.stringify(r2.body).slice(0, 200));
  const usage2 = await post(env, { action: 'usage' });
  check('replay does not double charge', usage2.body.usage.credits_available === 994, String(usage2.body.usage.credits_available));
  check('replay does not create a second run', d1.query('SELECT COUNT(*) AS c FROM toolkit_runs').results[0].c === 1);

  // same UUID, different payload
  const r3 = await post(env, runBody({ request_id: body.request_id, rows: [{ name: 'changed' }] }));
  check('same UUID different payload -> 409', r3.status === 409 && r3.body.error === 'request_conflict', JSON.stringify(r3.body));

  // concurrent duplicates (single-charge under race)
  const conc = runBody();
  const [c1, c2] = await Promise.all([post(env, conc), post(env, conc)]);
  check('concurrent same UUID: both answered, one run row, same id',
    c1.body.id === c2.body.id && d1.query('SELECT COUNT(*) AS c FROM toolkit_runs').results[0].c === 2,
    JSON.stringify([c1.status, c2.status, c1.body.id, c2.body.id]));
  const usage3 = await post(env, { action: 'usage' });
  const after = usage3.body.usage.credits_available;
  check('concurrent duplicate charged exactly once', after === 988, String(after));
}

// --- run: rejections before reservation ------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  caps(d1);
  seedGrant(d1, 'user_a', 1000);
  const env = baseEnv(d1);
  globalThis.__leadStub = { costs: [3000, 3000] };

  const noCreds = await post(baseEnv(d1, { TREG_API_KEY: '' }), runBody());
  check('missing provider creds -> 503 before any reservation', noCreds.status === 503 && noCreds.body.error === 'provider_not_configured');
  check('no run row written for the uncredentialed attempt', d1.query('SELECT COUNT(*) AS c FROM toolkit_runs').results[0].c === 0);

  const badTool = await post(env, runBody({ tool_id: 'second-tool' }));
  check('unknown tool id -> 400', badTool.status === 400 && badTool.body.error === 'unknown_tool');

  const badReq = await post(env, runBody({ request_id: 'not-a-uuid' }));
  check('non-uuid request_id -> 400', badReq.status === 400 && badReq.body.error === 'bad_request_id');

  const lowMax = await post(env, runBody({ max_credits: 5 }));
  check('max_credits below quote -> 400 (cannot under-reserve)', lowMax.status === 400 && lowMax.body.error === 'max_credits_below_quote', JSON.stringify(lowMax.body));

  const badInput = await post(env, runBody({ rows: Array(6).fill({}) }));
  check('input validation surfaces provider message -> 400', badInput.status === 400 && badInput.body.error === 'rows must be 1 to 5');
  check('still no run rows after all rejections', d1.query('SELECT COUNT(*) AS c FROM toolkit_runs').results[0].c === 0);
}

// --- run: cap rejections (diagnosed, atomic) -------------------------------
{
  resetClerkFixtures();
  {
    const d1 = makeD1();
    caps(d1, { cc: 10 }); // daily credit cap 10 < 42 needed
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [3000] };
    const r = await post(env, runBody());
    check('daily credit cap rejects -> 429 daily_credit_cap', r.status === 429 && r.body.error === 'daily_credit_cap', JSON.stringify(r.body));
  }
  {
    const d1 = makeD1();
    caps(d1);
    seedGrant(d1, 'user_a', 20); // wallet only 20 < 42
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [3000] };
    const r = await post(env, runBody());
    check('insufficient wallet -> 403 insufficient_credits', r.status === 403 && r.body.error === 'insufficient_credits', JSON.stringify(r.body));
  }
  {
    const d1 = makeD1();
    caps(d1, { rc: 1 }); // row cap 1 < 2 rows
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [3000] };
    const r = await post(env, runBody());
    check('daily row cap rejects -> 429 daily_row_cap', r.status === 429 && r.body.error === 'daily_row_cap', JSON.stringify(r.body));
  }
  {
    const d1 = makeD1();
    caps(d1, { g: 0 }); // global cap 0 = disabled
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [3000] };
    const r = await post(env, runBody());
    check('global cap 0 fails closed -> 429', r.status === 429 && r.body.error === 'global_cap_disabled', JSON.stringify(r.body));
  }
}

// --- run: unknown cost holds, overrun charges actual, provider throw -------
{
  resetClerkFixtures();
  // timeout: cost unknown -> hold retained, never free
  {
    const d1 = makeD1();
    caps(d1);
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [null] };
    const r = await post(env, runBody());
    check('provider timeout -> status held with retained hold',
      r.status === 200 && r.body.status === 'held' && r.body.credits_held === 6 && r.body.held_micro === 6000 && r.body.credits_used === 0 && r.body.spent_micro === 0,
      JSON.stringify({ s: r.body.status, h: r.body.credits_held, hm: r.body.held_micro }));
    check('timeout op recorded as unknown in ledger', r.body.ledger[0].status === 'unknown' && r.body.ledger[0].cost_micro === null);
    const u = await post(env, { action: 'usage' });
    check('hold reduces available (timeout never free)', u.body.usage.credits_available === 994 && u.body.usage.credits_held === 6,
      JSON.stringify(u.body.usage));
    const detail = await post(env, { action: 'run_detail', id: r.body.id });
    check('run_detail returns held run to owner', detail.status === 200 && detail.body.status === 'held');
  }
  // overrun: actual 9000 > 6000 per-call reserve -> charged fully, never clamped away
  {
    const d1 = makeD1();
    caps(d1);
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [9000] };
    const r = await post(env, runBody());
    check('cost above reserve: actual kept in ledger and charged',
      r.status === 200 && r.body.ledger[0].cost_micro === 9000 && r.body.spent_micro === 9000 && r.body.credits_used === 9 && r.body.credits_held === 0,
      JSON.stringify({ c: r.body.ledger[0] && r.body.ledger[0].cost_micro, s: r.body.spent_micro, u: r.body.credits_used }));
    check('overrun stops further dispatch (1 op only)', r.body.ledger.length === 1, String(r.body.ledger.length));
  }
  // provider throws after some measured calls
  {
    const d1 = makeD1();
    caps(d1);
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { costs: [3000], throwAfter: 'jev exploded' };
    const r = await post(env, runBody());
    check('provider throw: measured cost kept, hold released, error recorded',
      r.status === 200 && r.body.status === 'failed' && r.body.error === 'jev exploded' && r.body.credits_used === 3 && r.body.credits_held === 0,
      JSON.stringify({ s: r.body.status, e: r.body.error, u: r.body.credits_used }));
  }
  // provider throws before any call (creds-style failure inside provider)
  {
    const d1 = makeD1();
    caps(d1);
    seedGrant(d1, 'user_a', 1000);
    const env = baseEnv(d1);
    globalThis.__leadStub = { throwBefore: 'no credentials' };
    const r = await post(env, runBody());
    check('throw before dispatch: hold fully released, failed',
      r.status === 200 && r.body.status === 'failed' && r.body.error === 'no credentials' && r.body.credits_held === 0 && r.body.credits_used === 0 && r.body.ledger.length === 0,
      JSON.stringify(r.body));
    const u = await post(env, { action: 'usage' });
    check('nothing spent, wallet intact', u.body.usage.credits_available === 1000, String(u.body.usage.credits_available));
  }
}

// --- IDOR: results private to owner, admin included ------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  caps(d1);
  seedGrant(d1, 'user_a', 1000);
  const env = baseEnv(d1);
  globalThis.__leadStub = { costs: [3000, 3000] };

  const r = await post(env, runBody());
  check('owner can read own run_detail', (await post(env, { action: 'run_detail', id: r.body.id })).status === 200);

  const other = await post(env, { action: 'run_detail', id: r.body.id }, { token: sessionToken({ sub: 'user_b' }) });
  check('other user cannot read run (404, no existence leak)', other.status === 404 && other.body.error === 'not_found', JSON.stringify(other.body));

  const admin = await post(env, { action: 'run_detail', id: r.body.id }, { token: sessionToken({ sub: 'user_admin' }) });
  check('admin cannot read another user either', admin.status === 404, JSON.stringify(admin.body));

  const badId = await post(env, { action: 'run_detail', id: 'zzz' });
  check('malformed run id -> 400', badId.status === 400);

  const otherUsage = await post(env, { action: 'usage' }, { token: sessionToken({ sub: 'user_b' }) });
  check('usage history scoped to the caller', otherUsage.body.runs.length === 0, JSON.stringify(otherUsage.body.runs));
}

// --- admin -----------------------------------------------------------------
{
  resetClerkFixtures();
  clerkFixtures.users['user_low'] = userJson('user_low', 'low@example.com');
  const d1 = makeD1();
  caps(d1);
  seedGrant(d1, 'user_low', 1000);
  const adminTok = { token: sessionToken({ sub: 'user_admin' }) };
  const env = baseEnv(d1);

  const denied = await post(env, { action: 'admin_usage' });
  check('non-admin blocked from admin_usage', denied.status === 403 && denied.body.error === 'forbidden');
  const denied2 = await post(env, { action: 'admin_update', global_daily_cap_micro: 1 });
  check('non-admin blocked from admin_update', denied2.status === 403);

  const au = await post(env, { action: 'admin_usage' }, adminTok);
  check('admin_usage global shape', au.status === 200 &&
    au.body.global.daily_cap_micro === 1000000 && au.body.global.spent_micro === 0 && au.body.global.held_micro === 0 &&
    au.body.global.welcome_credits === 0 && au.body.global.trial_pool_credits === 0 &&
    au.body.global.default_daily_credit_cap === 10000 && au.body.global.default_daily_row_cap === 10000 &&
    typeof au.body.day === 'string', JSON.stringify(au.body.global));
  check('admin_usage users entry shape', au.body.users.some((u) => u.id === 'user_low' && u.credits_available === 1000 && u.disabled === 0 && u.email === ''),
    JSON.stringify(au.body.users));

  // global update + readback
  const upd = await post(env, { action: 'admin_update', global_daily_cap_micro: 500000, welcome_credits: 25, trial_pool_credits: 500, default_daily_credit_cap: 77, default_daily_row_cap: 88 }, adminTok);
  check('admin_update global readback after save', upd.status === 200 &&
    upd.body.global.daily_cap_micro === 500000 && upd.body.global.welcome_credits === 25 && upd.body.global.trial_pool_credits === 500 &&
    upd.body.global.default_daily_credit_cap === 77 && upd.body.global.default_daily_row_cap === 88, JSON.stringify(upd.body));

  // bounds and strictness
  for (const [label, bad] of [
    ['negative rejected', { global_daily_cap_micro: -1 }],
    ['fractional rejected', { welcome_credits: 1.5 }],
    ['overflow rejected', { global_daily_cap_micro: 1e15 }],
    ['unknown field rejected', { global_daily_cap_micro: 5, tyop: 1 }],
  ]) {
    const r = await post(env, { action: 'admin_update', ...bad }, adminTok);
    check(label + ' -> 400', r.status === 400, JSON.stringify(r.body));
  }
  const noFields = await post(env, { action: 'admin_update' }, adminTok);
  check('admin_update with no fields -> 400', noFields.status === 400 && noFields.body.error === 'no_fields');

  // per-user update + readback + effect + no arbitrary grants, no elevation
  const uUpd = await post(env, { action: 'admin_update', user_id: 'user_low', daily_credit_cap: 5, daily_row_cap: 2, disabled: false }, adminTok);
  check('admin_update user readback', uUpd.status === 200 && uUpd.body.user.id === 'user_low' && uUpd.body.user.daily_credit_cap === 5 && uUpd.body.user.disabled === 0, JSON.stringify(uUpd.body));
  const before = (await post(env, { action: 'admin_usage' }, adminTok)).body.users.find((u) => u.id === 'user_low').credits_available;
  check('admin_update does not mint credits', before === 1000, String(before));

  const elevate = await post(env, { action: 'admin_update', user_id: 'user_low', is_admin: true }, adminTok);
  check('admin_update cannot touch admin status (unknown field)', elevate.status === 400 && elevate.body.error === 'unknown_field', JSON.stringify(elevate.body));
  const grantAttempt = await post(env, { action: 'admin_update', user_id: 'user_low', credits: 500 }, adminTok);
  check('admin_update cannot grant credits (unknown field)', grantAttempt.status === 400);

  // override takes effect on the wallet path
  globalThis.__leadStub = { costs: [3000] };
  const capped = await post(env, runBody(), { token: sessionToken({ sub: 'user_low' }) });
  check('user override cap 5 rejects 42-credit run -> 429', capped.status === 429 && capped.body.error === 'daily_credit_cap', JSON.stringify(capped.body));

  await post(env, { action: 'admin_update', user_id: 'user_low', disabled: true }, adminTok);
  const disabledRun = await post(env, runBody(), { token: sessionToken({ sub: 'user_low' }) });
  check('disabled user cannot run -> 403', disabledRun.status === 403 && disabledRun.body.error === 'account_disabled', JSON.stringify(disabledRun.body));
  const disabledUsage = await post(env, { action: 'usage' }, { token: sessionToken({ sub: 'user_low' }) });
  check('usage reports disabled flag', disabledUsage.body.usage.disabled === 1);
}

check('no unexpected network calls during api selftest', clerkFixtures.unexpected.length === 0, JSON.stringify(clerkFixtures.unexpected));
finish('toolkit-api-selftest');
