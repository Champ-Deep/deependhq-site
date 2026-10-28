// scripts/toolkit-testkit.mjs : shared harness for the toolkit selftests.
//
// Provides a real-SQL D1 stand-in over node:sqlite (same API surface the
// backend uses: prepare().bind().run()/.first()/.all() + transactional batch),
// local RS256 session tokens for the real @clerk/backend authenticateRequest,
// hand-signed svix webhook headers for the real verifyWebhook, and a fetch
// router installed BEFORE worker/toolkit.js is imported (the SDK captures
// globalThis.fetch at module load, so mock-before-import is required).

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign as rsaSign, createHmac, randomUUID } from 'node:crypto';

export const ORIGIN = 'https://deependhq.com';
export const PK = 'pk_test_' + Buffer.from('clerk.test.dev$').toString('base64');
export const SK = 'sk_test_' + Buffer.from('toolkit.selftest@clerk.test.dev$').toString('base64');
export const WEBHOOK_SECRET = 'whsec_' + Buffer.from('0123456789abcdef0123456789abcdef').toString('base64');
export const CLERK_JS_URL = 'https://cdn.clerk.com/clerk.js';

// --- real SQLite behind the D1 API -----------------------------------------

export function makeD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of ['0001_toolkit.sql', '0002_v4.sql', '0003_run_job_id.sql']) db.exec(readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8'));
  const san = (row) => {
    if (!row) return row;
    const out = { ...row };
    for (const k of Object.keys(out)) if (typeof out[k] === 'bigint') out[k] = Number(out[k]);
    return out;
  };
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    async run() {
      const info = db.prepare(sql).run(...params);
      return { success: true, results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
    },
    async first() {
      const r = db.prepare(sql).get(...params);
      return r === undefined ? null : san(r);
    },
    async all() {
      return { success: true, results: db.prepare(sql).all(...params).map(san), meta: {} };
    },
  });
  return {
    prepare: (sql) => stmt(sql),
    async batch(list) {
      db.exec('BEGIN');
      try {
        const out = [];
        for (const s of list) out.push(await s.run());
        db.exec('COMMIT');
        return out;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    raw: db,
    query: (sql, ...params) => ({ results: db.prepare(sql).all(...params).map(san) }),
  };
}

// In-memory R2 bucket: the put/get/delete/list surface worker/toolkit-files.js uses.
export function makeR2() {
  const objects = new Map();
  return {
    objects,
    async put(key, value, opts = {}) {
      const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value); // worker passes Uint8Array or string
      objects.set(key, { bytes: bytes.slice(), httpMetadata: opts.httpMetadata || {} });
      return { key, size: bytes.length };
    },
    async get(key) {
      const o = objects.get(key);
      if (!o) return null;
      return { key, size: o.bytes.length, httpMetadata: o.httpMetadata, body: new Blob([o.bytes]).stream(), arrayBuffer: async () => o.bytes.slice().buffer, text: async () => new TextDecoder().decode(o.bytes) };
    },
    async delete(keys) { for (const k of [].concat(keys)) objects.delete(k); },
    async list({ prefix = '' } = {}) { return { objects: [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
  };
}

// In-memory KV namespace (get/put/delete with expirationTtl accepted and ignored).
export function makeKV() {
  const m = new Map();
  return { map: m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); } };
}

export function setSetting(d1, key, value) {
  d1.raw
    .prepare(`INSERT INTO toolkit_settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .run(key, String(value));
}

// Seed a wallet balance the way grants do (through the events table).
// Real grants always accompany account creation (usage/webhook/first run), so
// the helper provisions the account row too.
export function seedGrant(d1, uid, credits, key = `test:${uid}:${randomUUID()}`) {
  d1.raw
    .prepare(`INSERT INTO toolkit_accounts (user_id, email, created_at) VALUES (?, '', ?) ON CONFLICT(user_id) DO NOTHING`)
    .run(uid, new Date().toISOString());
  d1.raw.prepare(`INSERT INTO toolkit_events (key, user_id, type, credits, detail, created_at) VALUES (?, ?, 'welcome', ?, '', ?)`).run(key, uid, credits, new Date().toISOString());
}

// Backdated run row for cross-day aggregate tests.
export function seedRun(d1, { id = randomUUID(), uid = 'user_x', createdAt, creditsHeld = 0, heldMicro = 0, spentMicro = 0, creditsUsed = 0, rows = 1, status = 'held' }) {
  d1.raw
    .prepare(
      `INSERT INTO toolkit_runs (id, user_id, request_id, tool_id, list_name, payload_hash, status, row_count,
        max_credits, reserve_micro, credits_held, credits_used, held_micro, spent_micro, results, pricing_version, created_at, settled_at)
       VALUES (?, ?, ?, 'lead-scorer', 'l', 'h', ?, ?, 0, 0, ?, ?, ?, ?, '', 1, ?, ?)`
    )
    .run(id, uid, randomUUID(), status, rows, creditsHeld, creditsUsed, heldMicro, spentMicro, createdAt, createdAt);
}

// --- local session tokens (verified by the real authenticateRequest) --------

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
export const JWT_PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();

export function sessionToken({ sub = 'user_a', azp = ORIGIN, expired = false } = {}) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: 'RS256', typ: 'JWT', kid: 'local-1' });
  const p = b64({
    iss: 'https://clerk.test.dev',
    sid: 'sess_' + sub,
    sub,
    azp,
    iat: now - 60,
    nbf: now - 60,
    exp: expired ? now - 30 : now + 300,
  });
  const sig = rsaSign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url');
  return `${h}.${p}.${sig}`;
}

// --- hand-signed svix/standard-webhooks headers ----------------------------

export function svixHeaders(body, { id = randomUUID(), ts = Math.floor(Date.now() / 1000), secret = WEBHOOK_SECRET, tamper = false } = {}) {
  const key = Buffer.from(secret.slice(6), 'base64');
  let mac = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
  if (tamper) mac = Buffer.alloc(32, 7).toString('base64');
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${mac}`, 'content-type': 'application/json' };
}

// --- fetch router (installed before toolkit.js import) ---------------------

export const clerkFixtures = {
  subscriptions: {}, // uid -> BillingSubscriptionJSON | 'not_found'
  users: {},         // uid -> UserJSON | 'not_found'
  userList: [],      // UserJSON[] served by GET /v1/users?email_address= (and /v1/users/count)
  listFails: false,  // true -> the list endpoint answers 500
  unexpected: [],
};

export function resetClerkFixtures() {
  clerkFixtures.subscriptions = {};
  clerkFixtures.users = {};
  clerkFixtures.userList = [];
  clerkFixtures.listFails = false;
  clerkFixtures.unexpected = [];
}

export function installFetchRouter() {
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    let m = url.match(/api\.clerk\.com\/v1\/users\/([^/]+)\/billing\/subscription/);
    if (m) {
      const fx = clerkFixtures.subscriptions[m[1]];
      if (fx === 'not_found' || !fx) return json({ errors: [{ code: 'resource_not_found', message: 'no subscription' }] }, 404);
      return json(fx);
    }
    if (/api\.clerk\.com\/v1\/users(\/count)?\?/.test(url) || /api\.clerk\.com\/v1\/users\/count$/.test(url)) {
      if (clerkFixtures.listFails) return json({ errors: [{ code: 'internal', message: 'boom' }] }, 500);
      const wanted = new URL(url).searchParams.getAll('email_address').map((e) => e.toLowerCase());
      const hits = clerkFixtures.userList.filter((u) => !wanted.length || u.email_addresses.some((e) => wanted.includes(e.email_address.toLowerCase())));
      return /\/count/.test(url) ? json({ object: 'total_count', total_count: hits.length }) : json(hits);
    }
    m = url.match(/api\.clerk\.com\/v1\/users\/([^/?]+)(\?|$)/);
    if (m) {
      const fx = clerkFixtures.users[m[1]];
      if (fx === 'not_found' || !fx) return json({ errors: [{ code: 'resource_not_found', message: 'no user' }] }, 404);
      return json(fx);
    }
    clerkFixtures.unexpected.push(url);
    throw new Error('unexpected network call in selftest: ' + url);
  };
}

// --- Clerk fixture builders ------------------------------------------------

export function userJson(id, email, { verified = true } = {}) {
  return {
    object: 'user',
    id,
    first_name: 'Test',
    last_name: 'User',
    username: null,
    image_url: '',
    profile_image_url: '',
    has_image: false,
    primary_email_address_id: 'em_' + id,
    primary_phone_number_id: null,
    password_enabled: false,
    two_factor_enabled: false,
    totp_enabled: false,
    backup_code_enabled: false,
    email_addresses: [
      {
        id: 'em_' + id,
        object: 'email_address',
        email_address: email,
        reserved: false,
        linked_to: [],
        verification: { status: verified ? 'verified' : 'unverified', strategy: 'email_code', timestamp: 1 },
      },
    ],
    phone_numbers: [],
    external_accounts: [],
    saml_connections: [],
    organization_memberships: [],
    web3_wallets: [],
    enterprise_accounts: [],
    passkeys: [],
    created_at: 1,
    updated_at: 1,
  };
}

export function subscriptionJson({ userId, subId = 'sub_1', itemId = 'si_1', status = 'active', planId = 'plan_pro', periodStart = 1760000000000, freeTrial = false, itemStatus = 'active' } = {}) {
  return {
    object: 'commerce_subscription',
    id: subId,
    instance_id: 'inst_1',
    status,
    payer_id: userId,
    created_at: periodStart,
    updated_at: periodStart,
    active_at: status === 'active' ? periodStart : null,
    past_due_at: status === 'past_due' ? periodStart : null,
    eligible_for_free_trial: false,
    subscription_items: [
      {
        object: 'commerce_subscription_item',
        id: itemId,
        instance_id: 'inst_1',
        status: itemStatus,
        plan_period: 'month',
        payer_id: userId,
        price_id: 'price_1',
        period_start: periodStart,
        period_end: periodStart + 2592000000,
        is_free_trial: freeTrial,
        ended_at: null,
        created_at: periodStart,
        updated_at: periodStart,
        canceled_at: null,
        past_due_at: null,
        plan_id: planId,
        plan: {
          object: 'commerce_plan',
          id: planId,
          name: 'Pro',
          slug: 'pro',
          description: null,
          is_default: false,
          is_recurring: true,
          has_base_fee: true,
          publicly_visible: true,
          created_at: 1,
          updated_at: 1,
          for_payer_type: 'user',
          fee: { amount: 1000, currency: 'usd' },
          annual_fee: null,
          annual_monthly_fee: null,
          features: [],
          avatar_url: null,
          free_trial_days: null,
          free_trial_enabled: freeTrial,
        },
      },
    ],
  };
}

// --- request + assertion helpers -------------------------------------------

export function apiRequest(actionBody, { token = sessionToken(), origin = ORIGIN, path = '/api/toolkit' } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (origin) headers.origin = origin;
  return new Request(ORIGIN + path, { method: 'POST', headers, body: JSON.stringify(actionBody) });
}

let passed = 0;
const failures = [];

export function check(label, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`ok ${passed} - ${label}`);
  } else {
    failures.push(label + (detail ? ` :: ${detail}` : ''));
    console.log(`FAIL - ${label}${detail ? ' :: ' + detail : ''}`);
  }
}

export function finish(name) {
  if (failures.length) {
    console.error(`\n${name}: ${failures.length} FAILED, ${passed} passed`);
    for (const f of failures) console.error('  x ' + f);
    process.exit(1);
  }
  console.log(`\n${name}: all ${passed} passed`);
}
