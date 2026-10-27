// scripts/toolkit-admin-selftest.mjs : admin by verified email, admin_grant, admin_users.
// Real SQL (node:sqlite), real @clerk/backend token verification, Clerk REST answered by fixtures.
// No network. Run: node scripts/toolkit-admin-selftest.mjs

import {
  makeD1, setSetting, seedGrant, seedRun, installFetchRouter, resetClerkFixtures, clerkFixtures,
  userJson, apiRequest, sessionToken, PK, SK, CLERK_JS_URL, JWT_PUBLIC_PEM, check, finish, ORIGIN,
} from './toolkit-testkit.mjs';

installFetchRouter();
const { handleToolkit } = await import('../worker/toolkit.js');
const STUB = new URL('./fixtures/lead-scorer-stub.mjs', import.meta.url).href;
globalThis.__leadStub = {};

const baseEnv = (d1, over = {}) => ({
  TOOLKIT_DB: d1, CLERK_PUBLISHABLE_KEY: PK, CLERK_SECRET_KEY: SK, CLERK_JWT_KEY: JWT_PUBLIC_PEM, CLERK_JS_URL,
  CLERK_ADMIN_IDS: 'user_admin', CLERK_ADMIN_EMAILS: 'deep1499@gmail.com',
  TREG_API_KEY: 'treg-key', JEV_API_KEY: 'jev-key', __TOOLKIT_TEST_PROVIDER: STUB, ...over,
});

async function post(env, body, sub = 'user_admin') {
  const res = await handleToolkit(apiRequest(body, { token: sessionToken({ sub }) }), env);
  let j = null;
  try { j = await res.json(); } catch { /* none */ }
  return { status: res.status, body: j };
}
const balance = (d1, uid) => Number(d1.query(
  `SELECT (SELECT COALESCE(SUM(credits),0) FROM toolkit_events WHERE user_id=?1) - (SELECT COALESCE(SUM(credits_used+credits_held),0) FROM toolkit_runs WHERE user_id=?1) AS b`, uid).results[0].b);
const events = (d1, type) => d1.query(`SELECT * FROM toolkit_events WHERE type=?1 ORDER BY created_at, key`, type).results;
const uuidKey = () => 'grant-' + crypto.randomUUID();

// --- admin by email ----------------------------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  const env = baseEnv(d1);
  clerkFixtures.users.user_deep = userJson('user_deep', 'deep1499@gmail.com');
  clerkFixtures.users.user_case = userJson('user_case', 'Deep1499@Gmail.COM');
  clerkFixtures.users.user_fake = userJson('user_fake', 'deep1499@gmail.com', { verified: false });
  clerkFixtures.users.user_other = userJson('user_other', 'someone@example.com');

  check('verified matching email is admin (admin_users 200)', (await post(env, { action: 'admin_users' }, 'user_deep')).status === 200);
  check('email match is case-insensitive', (await post(env, { action: 'admin_users' }, 'user_case')).status === 200);
  const fakeUsers = await post(env, { action: 'admin_users' }, 'user_fake');
  check('UNVERIFIED matching email is not admin (admin_users 403)', fakeUsers.status === 403 && fakeUsers.body.error === 'forbidden', JSON.stringify(fakeUsers));
  const fakeGrant = await post(env, { action: 'admin_grant', target_uid: 'user_other', credits: 10, reason: 'x', idempotency_key: uuidKey() }, 'user_fake');
  check('UNVERIFIED matching email cannot grant (403, nothing written)', fakeGrant.status === 403 && events(d1, 'admin_grant').length === 0);
  check('unverified matching email: usage says is_admin false', (await post(env, { action: 'usage' }, 'user_fake')).body.user.is_admin === false);
  check('verified matching email: usage says is_admin true', (await post(env, { action: 'usage' }, 'user_deep')).body.user.is_admin === true);
  check('verified non-matching email is not admin', (await post(env, { action: 'admin_users' }, 'user_other')).status === 403);
  check('CLERK_ADMIN_IDS still works without any Clerk lookup', (await post(env, { action: 'admin_users' }, 'user_admin')).status === 200);
  check('Clerk lookup failure (user not found) fails closed', (await post(env, { action: 'admin_users' }, 'user_ghost')).status === 403);
  const noEmails = baseEnv(d1, { CLERK_ADMIN_EMAILS: '' });
  check('no CLERK_ADMIN_EMAILS configured: matching email is not admin', (await post(noEmails, { action: 'admin_users' }, 'user_deep')).status === 403);
  const bodyEscalate = await post(env, { action: 'admin_users', is_admin: true, admin: true, actor: 'user_admin' }, 'user_other');
  check('request body cannot self-promote', bodyEscalate.status === 403);
  check('no unexpected network calls (admin by email)', clerkFixtures.unexpected.length === 0, clerkFixtures.unexpected.join(','));
}

// --- admin_grant -------------------------------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  const env = baseEnv(d1);
  clerkFixtures.users.user_deep = userJson('user_deep', 'deep1499@gmail.com');
  clerkFixtures.users.user_t1 = userJson('user_t1', 't1@example.com');
  seedGrant(d1, 'user_t1', 5);
  seedGrant(d1, 'user_bystander', 7);

  const k1 = uuidKey();
  const g1 = await post(env, { action: 'admin_grant', target_uid: 'user_t1', credits: 500, reason: 'launch trial', idempotency_key: k1 });
  check('grant by uid: 200, new balance returned', g1.status === 200 && g1.body.granted === 500 && g1.body.replayed === false && g1.body.credits_available === 505, JSON.stringify(g1));
  const ev = events(d1, 'admin_grant');
  check('grant is one keyed toolkit_events row (type admin_grant, actor + reason in detail)',
    ev.length === 1 && ev[0].user_id === 'user_t1' && ev[0].credits === 500 && ev[0].key === `admin_grant:user_admin:${k1}` && JSON.parse(ev[0].detail).actor === 'user_admin' && JSON.parse(ev[0].detail).reason === 'launch trial', JSON.stringify(ev));
  check('ledger balance moved for the target only', balance(d1, 'user_t1') === 505 && balance(d1, 'user_bystander') === 7);
  const usage = await post(env, { action: 'usage' }, 'user_t1');
  check('target sees the grant in usage', usage.body.usage.credits_available === 505, JSON.stringify(usage.body.usage));

  // replay
  const r1 = await post(env, { action: 'admin_grant', target_uid: 'user_t1', credits: 500, reason: 'launch trial', idempotency_key: k1 });
  check('replay with the same key + payload: 200 replayed, balance unchanged', r1.status === 200 && r1.body.replayed === true && r1.body.credits_available === 505 && events(d1, 'admin_grant').length === 1, JSON.stringify(r1));
  const rr = await post(env, { action: 'admin_grant', target_uid: 'user_t1', credits: 500, reason: 'a different reason text', idempotency_key: k1 });
  check('replay with a changed reason is still a replay (credits + target identical)', rr.status === 200 && rr.body.replayed === true && events(d1, 'admin_grant').length === 1);
  const c1 = await post(env, { action: 'admin_grant', target_uid: 'user_t1', credits: 900, reason: 'launch trial', idempotency_key: k1 });
  check('same key, different amount -> 409 idempotency_conflict, no mint', c1.status === 409 && c1.body.error === 'idempotency_conflict' && balance(d1, 'user_t1') === 505, JSON.stringify(c1));
  const c2 = await post(env, { action: 'admin_grant', target_uid: 'user_bystander', credits: 500, reason: 'launch trial', idempotency_key: k1 });
  check('same key, different target -> 409, bystander untouched', c2.status === 409 && balance(d1, 'user_bystander') === 7);
  // concurrent replay of a fresh key mints once
  const kc = uuidKey();
  const burst = await Promise.all(Array.from({ length: 5 }, () => post(env, { action: 'admin_grant', target_uid: 'user_t1', credits: 40, reason: 'burst', idempotency_key: kc })));
  check('5 concurrent identical grants mint exactly once', burst.every((b) => b.status === 200) && burst.filter((b) => !b.body.replayed).length === 1 && balance(d1, 'user_t1') === 545, JSON.stringify(burst.map((b) => b.body && b.body.replayed)));
  // key is scoped to the acting admin
  clerkFixtures.users.user_deep = userJson('user_deep', 'deep1499@gmail.com');
  const other = await post(env, { action: 'admin_grant', target_uid: 'user_t1', credits: 40, reason: 'second admin', idempotency_key: kc }, 'user_deep');
  check('a different admin reusing the key is a separate grant', other.status === 200 && other.body.replayed === false && balance(d1, 'user_t1') === 585, JSON.stringify(other));

  // by email
  clerkFixtures.userList = [userJson('user_t2', 'T2@Example.com'), userJson('user_t3', 'dup@example.com'), userJson('user_t4', 'dup@example.com'), userJson('user_t5', 'unv@example.com', { verified: false })];
  const ge = await post(env, { action: 'admin_grant', target_email: ' t2@example.com ', credits: 100, reason: 'by email', idempotency_key: uuidKey() });
  check('grant by email resolves through Clerk, creates the account, stores the email', ge.status === 200 && ge.body.user.id === 'user_t2' && ge.body.user.email === 't2@example.com' && ge.body.credits_available === 100, JSON.stringify(ge));
  const dup = await post(env, { action: 'admin_grant', target_email: 'dup@example.com', credits: 5, reason: 'ambiguous', idempotency_key: uuidKey() });
  check('email matching two users is refused (no guess)', dup.status === 404 && dup.body.error === 'target_not_found' && balance(d1, 'user_t3') === 0 && balance(d1, 'user_t4') === 0);
  const unv = await post(env, { action: 'admin_grant', target_email: 'unv@example.com', credits: 5, reason: 'unverified', idempotency_key: uuidKey() });
  check('email that is unverified on the matched user is refused', unv.status === 404 && balance(d1, 'user_t5') === 0);
  const none = await post(env, { action: 'admin_grant', target_email: 'nobody@example.com', credits: 5, reason: 'none', idempotency_key: uuidKey() });
  check('unknown email -> 404 target_not_found', none.status === 404 && none.body.error === 'target_not_found');
  const ghost = await post(env, { action: 'admin_grant', target_uid: 'user_ghost', credits: 5, reason: 'ghost', idempotency_key: uuidKey() });
  check('unknown uid (no account, no Clerk user) -> 404, no account created', ghost.status === 404 && d1.query(`SELECT 1 FROM toolkit_accounts WHERE user_id='user_ghost'`).results.length === 0);
  const before = events(d1, 'admin_grant').length;
  clerkFixtures.listFails = true;
  const down = await post(env, { action: 'admin_grant', target_email: 't2@example.com', credits: 5, reason: 'clerk down', idempotency_key: uuidKey() });
  clerkFixtures.listFails = false;
  check('Clerk outage on email lookup -> 503 clerk_unavailable, nothing minted', down.status === 503 && down.body.error === 'clerk_unavailable' && events(d1, 'admin_grant').length === before, JSON.stringify(down));

  // bounds
  const base = { action: 'admin_grant', target_uid: 'user_t1', credits: 10, reason: 'ok', idempotency_key: 'bound-key-0001' };
  const before2 = events(d1, 'admin_grant').length;
  const bad = async (label, patch, code) => {
    const r = await post(env, { ...base, ...patch });
    check(`bounds: ${label} -> 400 ${code}`, r.status === 400 && r.body.error === code, JSON.stringify(r));
  };
  for (const [label, v] of [['credits 0', 0], ['credits -1', -1], ['credits 100001', 100001], ['credits 1.5', 1.5], ['credits "5"', '5'], ['credits null', null], ['credits 1e21', 1e21]]) await bad(label, { credits: v }, 'invalid_credits');
  await bad('credits missing', { credits: undefined }, 'invalid_credits');
  await bad('empty reason', { reason: '   ' }, 'invalid_reason');
  await bad('reason 201 chars', { reason: 'x'.repeat(201) }, 'invalid_reason');
  await bad('reason not a string', { reason: 42 }, 'invalid_reason');
  await bad('idempotency key too short', { idempotency_key: 'short' }, 'invalid_idempotency_key');
  await bad('idempotency key with spaces', { idempotency_key: 'has spaces in it!' }, 'invalid_idempotency_key');
  await bad('idempotency key missing', { idempotency_key: undefined }, 'invalid_idempotency_key');
  await bad('both target_uid and target_email', { target_email: 'a@b.co' }, 'invalid_target');
  await bad('no target', { target_uid: undefined }, 'invalid_target');
  await bad('target_uid with path characters', { target_uid: 'user_t1/../x' }, 'invalid_target');
  await bad('target_email not an email', { target_uid: undefined, target_email: 'not-an-email' }, 'invalid_target');
  const edge = await post(env, { ...base, credits: 100000, idempotency_key: 'bound-key-max01' });
  check('bounds: 100000 credits is accepted (upper edge)', edge.status === 200 && edge.body.granted === 100000);
  const edge1 = await post(env, { ...base, credits: 1, idempotency_key: 'bound-key-min01' });
  check('bounds: 1 credit is accepted (lower edge)', edge1.status === 200 && edge1.body.granted === 1);
  check('bounds: rejected requests wrote nothing', events(d1, 'admin_grant').length === before2 + 2);

  // non-admin + IDOR
  const bal = balance(d1, 'user_t1');
  const na = await post(env, { ...base, idempotency_key: 'nonadmin-key-1' }, 'user_t1');
  check('non-admin admin_grant (to self) -> 403, balance unchanged', na.status === 403 && na.body.error === 'forbidden' && balance(d1, 'user_t1') === bal);
  const na2 = await post(env, { ...base, target_uid: 'user_bystander', idempotency_key: 'nonadmin-key-2' }, 'user_t1');
  check('non-admin admin_grant (to another user) -> 403, bystander unchanged', na2.status === 403 && balance(d1, 'user_bystander') === 7);
  const na3 = await post(env, { action: 'admin_users' }, 'user_t1');
  check('non-admin admin_users -> 403 and leaks no users', na3.status === 403 && na3.body.users === undefined);
  const smuggle = await post(env, { ...base, idempotency_key: 'smuggle-key-01', user_id: 'user_bystander', uid: 'user_bystander', actor: 'user_bystander' });
  check('IDOR: stray user_id/uid/actor fields are ignored, only target_* counts', smuggle.status === 200 && smuggle.body.user.id === 'user_t1' && balance(d1, 'user_bystander') === 7);
  const smEv = events(d1, 'admin_grant').find((e) => e.key === 'admin_grant:user_admin:smuggle-key-01');
  check('IDOR: actor recorded from the verified session, not the body', JSON.parse(smEv.detail).actor === 'user_admin');

  // grants never bypass spending caps
  setSetting(d1, 'global_daily_cap_micro', 1000000);
  setSetting(d1, 'default_daily_credit_cap', 30);
  setSetting(d1, 'default_daily_row_cap', 1000);
  const run = await post(env, { action: 'run', tool_id: 'lead-scorer', request_id: crypto.randomUUID(), list_name: 'l', rows: [{ name: 'a' }, { name: 'b' }], icp: 'x', enrich: true, verify_email: true, custom: [], max_credits: 42 }, 'user_t1');
  check('a large grant does not bypass the daily credit cap (429 daily_credit_cap)', run.status === 429 && run.body.error === 'daily_credit_cap', JSON.stringify(run));
  check('no unexpected network calls (admin_grant)', clerkFixtures.unexpected.length === 0, clerkFixtures.unexpected.join(','));
}

// --- admin_users -------------------------------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  const env = baseEnv(d1);
  setSetting(d1, 'default_daily_credit_cap', 1000);
  setSetting(d1, 'default_daily_row_cap', 200);
  for (let i = 0; i < 120; i++) seedGrant(d1, `user_p${String(i).padStart(3, '0')}`, 10 + i);
  seedGrant(d1, 'user_p007', 200);
  d1.raw.prepare(`UPDATE toolkit_accounts SET email='p007@example.com', daily_credit_cap=250, disabled=1 WHERE user_id='user_p007'`).run();
  const today = new Date().toISOString();
  const yesterday = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
  seedRun(d1, { uid: 'user_p007', createdAt: today, spentMicro: 12000, creditsUsed: 12, rows: 3, status: 'completed' });
  seedRun(d1, { uid: 'user_p007', createdAt: yesterday, spentMicro: 99000, creditsUsed: 99, rows: 9, status: 'completed' });

  const p1 = await post(env, { action: 'admin_users' });
  const p2 = await post(env, { action: 'admin_users', page: 2 });
  const p3 = await post(env, { action: 'admin_users', page: 3 });
  const p4 = await post(env, { action: 'admin_users', page: 4 });
  check('page 1 (default): 50 users, total 120, has_more', p1.status === 200 && p1.body.users.length === 50 && p1.body.total === 120 && p1.body.page === 1 && p1.body.page_size === 50 && p1.body.has_more === true, JSON.stringify({ n: p1.body.users && p1.body.users.length, t: p1.body.total }));
  check('page 2: 50 users, has_more', p2.body.users.length === 50 && p2.body.has_more === true);
  check('page 3: 20 users, no more', p3.body.users.length === 20 && p3.body.has_more === false);
  check('page 4: empty, not an error', p4.status === 200 && p4.body.users.length === 0 && p4.body.has_more === false);
  const ids = [...p1.body.users, ...p2.body.users, ...p3.body.users].map((u) => u.id);
  check('pages are disjoint and cover all 120 accounts', new Set(ids).size === 120);
  const u7 = p1.body.users.find((u) => u.id === 'user_p007');
  check('row carries email and ledger balance (grants 17+200 minus used 111 = 106)', u7 && u7.email === 'p007@example.com' && u7.credits_available === 106, JSON.stringify(u7));
  check('row: today spend counts today only (12000 not 111000), rows_today 3', u7.spent_micro_today === 12000 && u7.credits_used_today === 12 && u7.rows_today === 3, JSON.stringify(u7));
  check('row: explicit cap 250 reported, default 200 rows reported as effective', u7.daily_credit_cap === 250 && u7.effective_daily_credit_cap === 250 && u7.daily_row_cap === null && u7.effective_daily_row_cap === 200, JSON.stringify(u7));
  check('row: disabled flag', u7.disabled === 1 && p1.body.users.find((u) => u.id === 'user_p000').disabled === 0);
  const u0 = p1.body.users.find((u) => u.id === 'user_p000');
  check('row: untouched user shows full grant and default caps', u0.credits_available === 10 && u0.effective_daily_credit_cap === 1000 && u0.daily_credit_cap === null);
  for (const [label, page] of [['page 0', 0], ['page -1', -1], ['page "2"', '2'], ['page 1.5', 1.5], ['page 1e9', 1e9]]) {
    const r = await post(env, { action: 'admin_users', page });
    check(`bounds: ${label} -> 400 invalid_page`, r.status === 400 && r.body.error === 'invalid_page', JSON.stringify(r));
  }
}

finish('toolkit-admin-selftest');
