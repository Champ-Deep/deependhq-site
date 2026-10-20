// scripts/toolkit-billing-selftest.mjs : signed webhook handling, authoritative
// subscription read, idempotent paid-period allowance grants.
// Run: node scripts/toolkit-billing-selftest.mjs

import {
  makeD1, setSetting, installFetchRouter, resetClerkFixtures, clerkFixtures,
  subscriptionJson, svixHeaders, apiRequest, WEBHOOK_SECRET, sessionToken, PK, SK,
  CLERK_JS_URL, JWT_PUBLIC_PEM, check, finish, ORIGIN,
} from './toolkit-testkit.mjs';

installFetchRouter();
const { handleToolkit } = await import('../worker/toolkit.js');

function env(d1, over = {}) {
  return {
    TOOLKIT_DB: d1,
    CLERK_PUBLISHABLE_KEY: PK,
    CLERK_SECRET_KEY: SK,
    CLERK_JWT_KEY: JWT_PUBLIC_PEM,
    CLERK_JS_URL,
    CLERK_WEBHOOK_SIGNING_SECRET: WEBHOOK_SECRET,
    CLERK_ADMIN_IDS: 'user_admin',
    ...over,
  };
}

function paidSettings(d1, { allowance = 500 } = {}) {
  setSetting(d1, 'paid_plan_id', 'plan_pro');
  setSetting(d1, 'paid_allowance_credits', allowance);
}

const body = (type, data) =>
  JSON.stringify({ type, data, timestamp: Date.now(), instance_id: 'inst_1', event_attributes: { http_request: { client_ip: '1.2.3.4', user_agent: 'selftest' } } });

function whRequest(str, opts = {}) {
  return new Request(ORIGIN + '/api/toolkit/webhook', { method: 'POST', headers: svixHeaders(str, opts), body: str });
}

async function send(e, str, opts = {}) {
  const res = await handleToolkit(whRequest(str, opts), e);
  let j = null;
  try { j = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: j };
}

const itemCount = (d1, type = 'paid') => d1.query(`SELECT COUNT(*) AS c FROM toolkit_events WHERE type=?`, type).results[0].c;
const creditSum = (d1, type = 'paid') => d1.query(`SELECT COALESCE(SUM(credits),0) AS c FROM toolkit_events WHERE type=?`, type).results[0].c;

const subEvt = (data) => body('subscriptionItem.active', data);
const itemData = (over = {}) => ({
  object: 'commerce_subscription_item', id: 'si_1', payer_id: 'user_a',
  status: 'active', is_free_trial: false, period_start: 1760000000000, plan_id: 'plan_pro', ...over,
});
const topSubData = (over = {}) => ({
  object: 'commerce_subscription', id: 'sub_1', payer_id: 'user_a', status: 'active',
  payer: { object: 'billing_payer', user_id: 'user_a', email: 'a@example.com', image_url: '', created_at: 1, updated_at: 1 },
  items: [itemData()], ...over,
});

// --- signature verification ------------------------------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  paidSettings(d1);
  const e = env(d1);

  const unsigned = await handleToolkit(new Request(ORIGIN + '/api/toolkit/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: subEvt(itemData()),
  }), e);
  check('unsigned webhook -> 400', unsigned.status === 400);

  const tampered = await send(e, subEvt(itemData()), { tamper: true });
  check('bad signature -> 400, no grant', tampered.status === 400 && itemCount(d1) === 0, JSON.stringify(tampered.body));

  const wrongSecret = await send(e, subEvt(itemData()), { secret: 'whsec_' + Buffer.from('ffffffffffffffffffffffffffffffff').toString('base64') });
  check('wrong signing secret -> 400', wrongSecret.status === 400 && itemCount(d1) === 0);

  const old = await send(e, subEvt(itemData()), { ts: Math.floor(Date.now() / 1000) - 3600 });
  check('stale timestamp outside tolerance -> 400', old.status === 400 && itemCount(d1) === 0, JSON.stringify(old.body));

  const get = await handleToolkit(new Request(ORIGIN + '/api/toolkit/webhook'), e);
  check('GET webhook -> 405', get.status === 405);

  const noSecret = await send(env(d1, { CLERK_WEBHOOK_SIGNING_SECRET: undefined }), subEvt(itemData()));
  check('missing signing secret config -> 503', noSecret.status === 503 && noSecret.body.error === 'webhook_not_configured');

  const noDb = await send(env(d1, { TOOLKIT_DB: undefined }), subEvt(itemData()));
  check('missing d1 binding -> 503 fail closed', noDb.status === 503 && noDb.body.error === 'toolkit_db_not_configured');
}

// --- happy path + duplicates + period idempotency --------------------------
{
  resetClerkFixtures();
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a' });
  const d1 = makeD1();
  paidSettings(d1);
  const e = env(d1);

  const r1 = await send(e, subEvt(itemData()));
  check('active paid subscription grants allowance', r1.status === 200 && r1.body.granted === true, JSON.stringify(r1.body));
  check('grant is 500 credits for user_a', creditSum(d1) === 500, String(creditSum(d1)));
  check('receipt persisted with grant', itemCount(d1, 'receipt') === 1);
  check('account row provisioned for the payer', d1.query(`SELECT COUNT(*) AS c FROM toolkit_accounts WHERE user_id='user_a'`).results[0].c === 1);

  // exact duplicate delivery (same svix id)
  const str = subEvt(itemData());
  const opts = { id: 'msg_fixed_1' };
  const again = await send(e, str, opts);
  check('duplicate delivery acknowledged without double grant', again.status === 200 && itemCount(d1) === 1 && creditSum(d1) === 500,
    JSON.stringify({ b: again.body, n: itemCount(d1) }));

  // different message id, same paid period
  const r3 = await send(e, subEvt(itemData()), { id: 'msg_fixed_2' });
  check('same period via new message id: no second grant', r3.body.granted === false && itemCount(d1) === 1 && creditSum(d1) === 500, JSON.stringify(r3.body));

  // renewal: same item, next period -> fresh grant
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', periodStart: 1762592000000 });
  const r4 = await send(e, subEvt(itemData({ period_start: 1762592000000 })), { id: 'msg_fixed_3' });
  check('next paid period grants once more', r4.body.granted === true && itemCount(d1) === 2 && creditSum(d1) === 1000,
    JSON.stringify({ b: r4.body, n: itemCount(d1), s: creditSum(d1) }));
}

// --- out-of-order and authoritative-read dominance -------------------------
{
  resetClerkFixtures();
  const d1 = makeD1();
  paidSettings(d1);
  const e = env(d1);

  // past_due arrives first: read says not active -> no grant, receipt only
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', status: 'past_due', itemStatus: 'past_due' });
  const o1 = await send(e, body('subscription.pastDue', topSubData({ status: 'past_due' })), { id: 'ooo_1' });
  check('past_due first: receipt, no grant', o1.status === 200 && o1.body.granted === false && itemCount(d1, 'paid') === 0 && itemCount(d1, 'receipt') === 1, JSON.stringify(o1.body));

  // then active for the same period: read now active -> grant exactly once
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a' });
  const o2 = await send(e, subEvt(itemData()), { id: 'ooo_2' });
  check('active later grants once', o2.body.granted === true && itemCount(d1, 'paid') === 1, JSON.stringify(o2.body));

  // the OLD past_due event replays after the grant: still one grant
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a' });
  const o3 = await send(e, body('subscription.pastDue', topSubData({ status: 'past_due' })), { id: 'ooo_1' });
  check('old out-of-order replay cannot change grants', o3.body.granted === false && itemCount(d1, 'paid') === 1 && creditSum(d1) === 500, JSON.stringify(o3.body));

  // body claims active, backend read says not: no grant (body never trusted)
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', status: 'past_due', itemStatus: 'past_due' });
  const beat1 = await send(e, subEvt(itemData()), { id: 'beat_1' });
  check('body active but read past_due -> no grant', beat1.body.granted === false && itemCount(d1, 'paid') === 1, JSON.stringify(beat1.body));

  // body claims pastDue, backend read says active: grant happens (read wins)
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', periodStart: 1765184000000 });
  const beat2 = await send(e, body('subscriptionItem.pastDue', itemData({ status: 'past_due', period_start: 1765184000000 })), { id: 'beat_2' });
  check('body pastDue but read active -> granted for that period', beat2.body.granted === true && creditSum(d1) === 1000, JSON.stringify(beat2.body));

  // subscription read 404 (no subscription at all) -> no grant
  clerkFixtures.subscriptions['user_nosub'] = 'not_found';
  const noSub = await send(e, subEvt(itemData({ payer_id: 'user_nosub' })), { id: 'nosub_1' });
  check('no subscription on account -> receipt only', noSub.body.granted === false && itemCount(d1, 'paid') === 2, JSON.stringify(noSub.body));
}

// --- failed payment, incomplete, free trial, org payer, unsupported --------
{
  resetClerkFixtures();
  const d1 = makeD1();
  paidSettings(d1);
  const e = env(d1);

  // failed / incomplete payment
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', status: 'incomplete', itemStatus: 'incomplete' });
  const f1 = await send(e, body('subscriptionItem.incomplete', itemData({ status: 'incomplete' })), { id: 'f_1' });
  check('incomplete checkout grants nothing', f1.status === 200 && f1.body.granted === false && itemCount(d1, 'paid') === 0 && itemCount(d1, 'receipt') === 1, JSON.stringify(f1.body));

  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', status: 'past_due', itemStatus: 'past_due' });
  const f2 = await send(e, body('paymentAttempt.failed', { object: 'billing_payment_attempt', status: 'failed', payer: { object: 'billing_payer', user_id: 'user_a', email: 'a@x.c', image_url: '', created_at: 1, updated_at: 1 } }), { id: 'f_2' });
  check('failed payment attempt grants nothing', f2.body.granted === false && itemCount(d1, 'paid') === 0, JSON.stringify(f2.body));

  // free trial on the configured plan
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', freeTrial: true });
  const t1 = await send(e, subEvt(itemData({ is_free_trial: true })), { id: 't_1' });
  check('free trial grants nothing', t1.body.granted === false && itemCount(d1, 'paid') === 0, JSON.stringify(t1.body));

  // plan mismatch: active sub for a different plan
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a', planId: 'plan_other' });
  const p1 = await send(e, subEvt(itemData({ plan_id: 'plan_other' })), { id: 'p_1' });
  check('non-configured plan grants nothing', p1.body.granted === false && itemCount(d1, 'paid') === 0, JSON.stringify(p1.body));

  // org payer: no personal allowance
  clerkFixtures.subscriptions['user_org'] = subscriptionJson({ userId: 'user_org' });
  const g1 = await send(e, body('subscription.active', {
    object: 'commerce_subscription', id: 'sub_org', status: 'active',
    payer: { object: 'billing_payer', organization_id: 'org_1', organization_name: 'Acme', email: 'o@x.c', image_url: '', created_at: 1, updated_at: 1 },
    items: [itemData({ payer_id: undefined })],
  }), { id: 'g_1' });
  check('org payer: receipt only, no grant', g1.body.granted === false && itemCount(d1, 'paid') === 0, JSON.stringify(g1.body));

  // unsupported event: acknowledged, ignored, nothing written
  const before = itemCount(d1);
  const u1 = await send(e, body('user.created', { object: 'user', id: 'user_new' }), { id: 'u_1' });
  check('unsupported event ACKed with no grant and no rows', u1.status === 200 && u1.body.ignored === true && itemCount(d1) === before, JSON.stringify(u1.body));
}

// --- safe defaults: allowance 0 means disabled -----------------------------
{
  resetClerkFixtures();
  clerkFixtures.subscriptions['user_a'] = subscriptionJson({ userId: 'user_a' });
  const d1 = makeD1();
  setSetting(d1, 'paid_plan_id', 'plan_pro');
  setSetting(d1, 'paid_allowance_credits', 0); // default
  const e = env(d1);

  const cfgRes = await handleToolkit(new Request(ORIGIN + '/api/toolkit/config'), e);
  const cfg = await cfgRes.json();
  check('paid allowance 0 -> billing_enabled false', cfg.billing_enabled === false, JSON.stringify(cfg));

  const r = await send(e, subEvt(itemData()));
  check('paid allowance 0 -> even an active paid sub grants nothing', r.status === 200 && r.body.granted === false && creditSum(d1) === 0, JSON.stringify(r.body));
}

check('no unexpected network calls during billing selftest', clerkFixtures.unexpected.length === 0, JSON.stringify(clerkFixtures.unexpected));
finish('toolkit-billing-selftest');
