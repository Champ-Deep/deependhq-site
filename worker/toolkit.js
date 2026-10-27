// worker/toolkit.js : shared toolkit backend for /api/toolkit*.
//
// Contract: docs/toolkit-api.md. Parent's worker/index.js routes /api/toolkit*
// here and owns worker/lead-scorer.js (provider module, imported lazily so a
// missing provider file fails closed on quote/run only).
//
//   GET  /api/toolkit/config     public, no-store
//   POST /api/toolkit            Bearer Clerk session token, {action, ...}
//   POST /api/toolkit/webhook    Clerk Billing webhook, svix signature verified
//
// Security posture: no CORS headers ever (same-origin only), no client-supplied
// user id except admin target, results readable by owner only (admins included),
// verified session token plus authorizedParties (azp) check on every action,
// webhook body is a notification only: entitlement is re-read from the Clerk
// backend and grants are idempotent per user + subscription item + period.

import { createClerkClient } from '@clerk/backend';
import { verifyWebhook } from '@clerk/backend/webhooks';
import * as store from './toolkit-store.js';
import * as cols from './column-ops.js';

const TOOLS = new Set(['lead-scorer', 'data-workbench']); // only actually integrated tool ids; data-workbench = column ops
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIST_NAME = 120;

// Explicit nonnegative bounds for every admin-settable integer.
const MAX_CREDIT_CAP = 1000000000;
const MAX_ROW_CAP = 1000000;
const MAX_MICRO_CAP = 1000000000000;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      // Deliberately no access-control-allow-origin: same origin only.
    },
  });

const getDb = (env) => (env && (env.TOOLKIT_DB || env.toolkitDB)) || null;
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const intIn = (v, max) => (Number.isSafeInteger(v) && v >= 0 && v <= max ? v : null);

async function sha256Hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Provider module. The literal import is what the bundler ships; the test
// seam only runs in local selftests, never in deployment config.
async function loadProvider(env) {
  try {
    if (env.__TOOLKIT_TEST_PROVIDER) return await import(env.__TOOLKIT_TEST_PROVIDER);
    return await import('./lead-scorer.js');
  } catch {
    return null;
  }
}

function clerkClientFor(env) {
  return createClerkClient({ publishableKey: env.CLERK_PUBLISHABLE_KEY, secretKey: env.CLERK_SECRET_KEY });
}

// Admin = uid listed in CLERK_ADMIN_IDS, or a VERIFIED email address (read from Clerk server-side,
// never from the token or the request) listed in CLERK_ADMIN_EMAILS. Fails closed on any Clerk error.
const csv = (v) => String(v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
async function isAdmin(env, uid) {
  if (String(env.CLERK_ADMIN_IDS || '').split(',').map((x) => x.trim()).includes(uid)) return true;
  const emails = csv(env.CLERK_ADMIN_EMAILS);
  if (!emails.length) return false;
  try {
    const u = await clerkClientFor(env).users.getUser(uid);
    return (u.emailAddresses || []).some((e) => e.verification?.status === 'verified' && emails.includes(String(e.emailAddress).toLowerCase()));
  } catch {
    return false;
  }
}

// azp claim must equal our own origin (or the operator's explicit list).
function authParties(url, env) {
  if (env.CLERK_AUTHORIZED_PARTIES) {
    return String(env.CLERK_AUTHORIZED_PARTIES)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [url.origin];
}

async function authenticate(request, url, env) {
  if (!env.CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY) {
    return { error: 'clerk_not_configured', status: 503 };
  }
  if (!request.headers.get('authorization')) return { error: 'unauthorized', status: 401 };
  try {
    const res = await clerkClientFor(env).authenticateRequest(request, {
      authorizedParties: authParties(url, env),
      acceptsToken: 'session_token',
      ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
    });
    const auth = res && res.isAuthenticated ? res.toAuth() : null;
    if (!auth || !auth.userId) return { error: 'unauthorized', status: 401 };
    return { uid: auth.userId };
  } catch (e) {
    console.error('toolkit: clerk auth failed:', e && e.message);
    return { error: 'unauthorized', status: 401 };
  }
}

function sameOrigin(request, url) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // non-browser caller, Bearer token still required
  return origin === url.origin;
}

async function fetchEmailIfEmpty(db, env, uid) {
  const row = await db.prepare(`SELECT email FROM toolkit_accounts WHERE user_id=?1`).bind(uid).first();
  if (!row || row.email) return;
  try {
    const u = await clerkClientFor(env).users.getUser(uid);
    const email = u.emailAddress || (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || '';
    if (email) await store.setEmail(db, uid, email);
  } catch {
    // email is display-only; account row already exists without it
  }
}

// ---------------------------------------------------------------------------
// GET /api/toolkit/config
// ---------------------------------------------------------------------------
async function handleConfig(env) {
  const db = getDb(env);
  const s = db ? await store.readSettings(db) : null;
  const publishable = env.CLERK_PUBLISHABLE_KEY || null;
  let scriptUrl = null; // operator-pinned, no invented fallback
  try {
    const candidate = new URL(env.CLERK_JS_URL);
    if (candidate.protocol === 'https:' && !candidate.username && !candidate.password && !candidate.search && !candidate.hash) scriptUrl = candidate.href;
  } catch { /* configuration remains disabled */ }
  const configured = Boolean(publishable && scriptUrl && env.CLERK_SECRET_KEY && db);
  const billing = Boolean(
    configured &&
      env.CLERK_SECRET_KEY &&
      env.CLERK_WEBHOOK_SIGNING_SECRET &&
      s &&
      s.paid_plan_id &&
      s.paid_allowance_credits > 0
  );
  return json({
    configured,
    clerk_publishable_key: publishable,
    clerk_script_url: scriptUrl,
    billing_enabled: billing,
    credits_per_usd: store.CREDITS_PER_USD,
    providers: { treg: !!env.TREG_API_KEY, jev: !!env.JEV_API_KEY, deepseek: !!env.JEV_API_KEY },
  });
}

// ---------------------------------------------------------------------------
// action: usage
// ---------------------------------------------------------------------------
async function actionUsage(db, env, uid, settings) {
  const now = store.nowIso();
  const dayStart = store.utcDayStart();
  await store.ensureAccount(db, uid, now);
  if (settings.welcome_credits > 0) {
    // guarded + idempotent inside SQL: disabled when 0, pool-bounded, once per account
    await store.welcomeGrantStmt(db, 'welcome:' + uid, uid, settings.welcome_credits, now).run();
  }
  await fetchEmailIfEmpty(db, env, uid);
  const agg = await store.getUserAggregate(db, uid, dayStart);
  const runs = await store.listRuns(db, uid, dayStart, 30);
  const effCredit = agg.daily_credit_cap == null ? settings.default_daily_credit_cap : store.num(agg.daily_credit_cap);
  const effRow = agg.daily_row_cap == null ? settings.default_daily_row_cap : store.num(agg.daily_row_cap);
  return json({
    user: { id: uid, email: agg.email || '', is_admin: await isAdmin(env, uid) },
    usage: {
      day: store.utcDay(),
      credits_available: store.num(agg.credits_available),
      credits_held: store.num(agg.credits_held),
      credits_used: store.num(agg.credits_used),
      spent_micro: store.num(agg.spent_micro),
      held_micro: store.num(agg.held_micro),
      rows: store.num(agg.rows),
      daily_credit_cap: effCredit,
      daily_row_cap: effRow,
      disabled: store.num(agg.disabled),
    },
    providers: { treg: !!env.TREG_API_KEY, jev: !!env.JEV_API_KEY },
    runs,
  });
}

// ---------------------------------------------------------------------------
// action: quote (sign-in required for throttling, no provider spend here)
// ---------------------------------------------------------------------------
async function actionQuoteColumns(db, uid, body) {
  let input;
  try {
    input = cols.validateColumnsInput(body);
  } catch (e) {
    return json({ error: 'invalid_columns', message: (e && e.message) || 'invalid input' }, 400);
  }
  const q = cols.quoteColumns(input);
  const settings = await store.readSettings(db);
  const agg = await store.getUserAggregate(db, uid, store.utcDayStart());
  const capC = !agg || agg.daily_credit_cap == null ? settings.default_daily_credit_cap : store.num(agg.daily_credit_cap);
  const capR = !agg || agg.daily_row_cap == null ? settings.default_daily_row_cap : store.num(agg.daily_row_cap);
  const available = agg ? store.num(agg.credits_available) : 0;
  const remainingCredits = Math.max(0, capC - (agg ? store.num(agg.credits_used) + store.num(agg.credits_held) : 0));
  const remainingRows = Math.max(0, capR - (agg ? store.num(agg.rows) : 0));
  const fits = q.max_cost_micro > 0 && q.max_cost_micro <= store.APP_BATCH_MICRO_CEILING;
  const disabled = agg ? store.num(agg.disabled) : 0;
  return json({
    ...q,
    fits_batch_ceiling: fits,
    batch_ceiling_micro: store.APP_BATCH_MICRO_CEILING,
    allowance: {
      credits_available: available,
      daily_credit_cap: capC,
      remaining_daily_credits: remainingCredits,
      remaining_daily_micro: remainingCredits * 1000,
      daily_row_cap: capR,
      remaining_daily_rows: remainingRows,
      disabled,
    },
    can_run: fits && !disabled && q.max_credits <= available && q.max_credits <= remainingCredits && q.row_count <= remainingRows,
  });
}

async function actionQuote(db, env, uid, body) {
  if (body.columns !== undefined) return actionQuoteColumns(db, uid, body);
  const provider = await loadProvider(env);
  if (!provider) return json({ error: 'provider_unavailable' }, 503);
  let input;
  try {
    input = provider.validateLeadInput({
      rows: body.rows,
      icp: body.icp,
      enrich: body.enrich,
      verify_email: body.verify_email,
      custom: body.custom,
    });
  } catch (e) {
    return json({ error: (e && e.message) || 'invalid_input' }, 400);
  }
  const q = provider.quoteLead(input);
  return json({
    row_count: store.num(q.row_count),
    max_cost_micro: store.num(q.max_cost_micro),
    max_credits: store.num(q.max_credits),
    breakdown: q.breakdown || {},
    warnings: Array.isArray(q.warnings) ? q.warnings : [],
  });
}

// ---------------------------------------------------------------------------
// Per-provider call adapter. Logs the reservation BEFORE perform() runs and
// records the actual cost after, including error responses. Unknown cost
// (timeout, malformed reply) stays null so the full reserve remains held.
// The returned shape matches the documented contract; sequential stopping on
// unknown or overrun cost is enforced inside executeLead (parent-owned loop).
// ---------------------------------------------------------------------------
function makeCall(db, runId) {
  let seq = 0;
  return async (spec, perform) => {
    seq += 1;
    const providerName = clip(spec && spec.provider, 40) || 'unknown';
    const endpoint = clip(spec && spec.endpoint, 80) || 'unknown';
    const rawReserve = spec && store.num(spec.reserve_micro);
    const reserve = rawReserve > 0 ? Math.ceil(rawReserve) : 0;
    await store.logOp(db, runId, seq, providerName, endpoint, reserve, store.nowIso());
    let out = null;
    try {
      out = await perform();
    } catch {
      out = null;
    }
    const rawCost = out && typeof out.cost_micro === 'number' && Number.isFinite(out.cost_micro) && out.cost_micro >= 0
      ? Math.ceil(out.cost_micro)
      : null;
    const ok = Boolean(out && out.ok);
    const callId = out && (out.call_id || out.callId) ? clip(out.call_id || out.callId, 120) : null;
    const status = rawCost === null ? 'unknown' : ok ? 'ok' : 'error';
    await store.recordOpResult(db, runId, seq, { costMicro: rawCost, status, callId });
    return { data: out && 'data' in out ? out.data : null, cost_micro: rawCost, ok, ...(callId ? { call_id: callId } : {}) };
  };
}

function runResponse(run, ops) {
  let results = [];
  try {
    results = run.results ? JSON.parse(run.results) : [];
  } catch {
    results = [];
  }
  const body = {
    id: run.id,
    status: run.status,
    results,
    credits_used: store.num(run.credits_used),
    credits_held: store.num(run.credits_held),
    spent_micro: store.num(run.spent_micro),
    held_micro: store.num(run.held_micro),
    ledger: (ops || []).map((o) => ({
      provider: o.provider,
      endpoint: o.endpoint,
      status: o.status,
      cost_micro: o.cost_micro,
      reserved_micro: store.num(o.reserved_micro),
      ...(o.call_id ? { call_id: o.call_id } : {}),
    })),
  };
  if (run.error) body.error = run.error;
  return body;
}

// Settlement from the op log: known costs charge, unknown-cost ops keep their
// full reserve held. Never counts a timeout as free.
async function settleAndRespond(db, run, results, errorMsg) {
  const ops = await store.listOps(db, run.id);
  let spent = 0;
  let heldMicro = 0;
  let unknown = 0;
  for (const op of ops) {
    if (op.cost_micro == null) {
      heldMicro += store.num(op.reserved_micro);
      unknown += 1;
    } else {
      spent += store.num(op.cost_micro);
    }
  }
  const status = unknown > 0 ? 'held' : errorMsg ? 'failed' : 'completed';
  await store.settleRun(db, {
    status,
    creditsUsed: store.ceilCredits(spent),
    creditsHeld: store.ceilCredits(heldMicro),
    spentMicro: spent,
    heldMicro,
    results: JSON.stringify(results || []),
    error: errorMsg ? clip(errorMsg, 500) : null,
    settledAt: store.nowIso(),
    id: run.id,
    uid: run.user_id,
  });
  const fresh = await store.getRunForOwner(db, run.id, run.user_id);
  const ops2 = await store.listOps(db, run.id);
  return json(runResponse(fresh, ops2));
}

// ---------------------------------------------------------------------------
// action: run
// ---------------------------------------------------------------------------
async function actionRun(db, env, uid, body) {
  const toolId = clip(body.tool_id, 40);
  const columnsMode = body.columns !== undefined;
  // Legacy lead-scorer shape stays on tool_id lead-scorer; column ops run as data-workbench.
  if (!TOOLS.has(toolId) || (toolId === 'data-workbench') !== columnsMode) return json({ error: 'unknown_tool' }, 400);
  const requestId = clip(body.request_id, 64);
  if (!UUID_RE.test(requestId)) return json({ error: 'bad_request_id' }, 400);
  const maxCredits = body.max_credits;
  if (intIn(maxCredits, MAX_CREDIT_CAP) === null) return json({ error: 'invalid_max_credits' }, 400);
  const listName = clip(body.list_name, MAX_LIST_NAME);

  let provider = null;
  let input;
  try {
    if (columnsMode) {
      input = cols.validateColumnsInput(body);
    } else {
      provider = await loadProvider(env);
      if (!provider) return json({ error: 'provider_unavailable' }, 503);
      input = provider.validateLeadInput({
        rows: body.rows,
        icp: body.icp,
        enrich: body.enrich,
        verify_email: body.verify_email,
        custom: body.custom,
      });
    }
  } catch (e) {
    return columnsMode
      ? json({ error: 'invalid_columns', message: (e && e.message) || 'invalid input' }, 400)
      : json({ error: (e && e.message) || 'invalid_input' }, 400);
  }

  // Missing provider credentials are detected BEFORE any reservation. Column ops only need the keys they use.
  const q = columnsMode ? cols.quoteColumns(input) : null;
  const needTreg = columnsMode ? q.columns.some((c) => c.engine === 'treg' && c.distinct_count) : true;
  const needLlm = columnsMode ? q.columns.some((c) => c.engine !== 'treg' && c.distinct_count) : true;
  if ((needTreg && !env.TREG_API_KEY) || (needLlm && !env.JEV_API_KEY)) return json({ error: 'provider_not_configured' }, 503);

  const quote = columnsMode ? q : provider.quoteLead(input);
  const quoteMicro = store.num(quote.max_cost_micro);
  if (!Number.isSafeInteger(quoteMicro) || quoteMicro <= 0) return json({ error: 'invalid_quote' }, 400);
  if (quoteMicro > store.APP_BATCH_MICRO_CEILING) return json({ error: 'batch_ceiling' }, 400);
  const needed = store.ceilCredits(quoteMicro);
  if (maxCredits < needed) return json({ error: 'max_credits_below_quote' }, 400);

  const payloadHash = await sha256Hex(
    JSON.stringify({ tool_id: toolId, list_name: listName, input, max_credits: maxCredits })
  );

  // Idempotency: same request_id + payload returns the existing run.
  const existing = await store.getRunByIdempotency(db, uid, requestId);
  if (existing) {
    if (existing.payload_hash !== payloadHash) return json({ error: 'request_conflict' }, 409);
    return json(runResponse(existing, await store.listOps(db, existing.id)));
  }

  const p = {
    id: crypto.randomUUID(),
    uid,
    requestId,
    toolId,
    listName,
    payloadHash,
    rowCount: store.num(input.rows.length),
    maxCredits,
    reserveMicro: quoteMicro,
    creditsHeld: needed,
    createdAt: store.nowIso(),
    dayStart: store.utcDayStart(),
  };

  let results;
  try {
    results = await db.batch([store.ensureAccountStmt(db, uid, p.createdAt), store.reserveStmt(db, p)]);
  } catch (e) {
    // Lost a race on UNIQUE(user_id, request_id): return the winner if the payload matches.
    if (String((e && e.message) || '').includes('UNIQUE')) {
      const won = await store.getRunByIdempotency(db, uid, requestId);
      if (won) {
        if (won.payload_hash !== payloadHash) return json({ error: 'request_conflict' }, 409);
        return json(runResponse(won, await store.listOps(db, won.id)));
      }
    }
    throw e;
  }
  if (results[1].meta.changes === 0) {
    const why = await store.diagnoseReserve(db, p);
    return json({ error: why.error }, why.status);
  }

  let runResults = [];
  let errorMsg = null;
  try {
    const out = await (columnsMode ? cols.executeColumns : provider.executeLead)(input, {
      tregKey: env.TREG_API_KEY,
      jevKey: env.JEV_API_KEY,
      model: env.LEAD_SCORER_MODEL,
      call: makeCall(db, p.id),
      customerId: uid,   // X-Treg-Meta audit/idempotency subject
      runId: p.id,       // X-Treg-Meta run UUID
    });
    runResults = Array.isArray(out) ? out : [];
  } catch (e) {
    errorMsg = (e && e.message) || 'provider_error';
    runResults = Array.isArray(e?.partial_results) ? e.partial_results : [];
  }
  const run = await store.getRunForOwner(db, p.id, uid);
  return settleAndRespond(db, run, runResults, errorMsg);
}

// ---------------------------------------------------------------------------
// actions: admin
// ---------------------------------------------------------------------------
async function adminGlobalView(db, settings, dayStart) {
  const g = await store.getGlobalAggregate(db, dayStart);
  return {
    daily_cap_micro: settings.global_daily_cap_micro,
    spent_micro: store.num(g.spent_micro),
    held_micro: store.num(g.held_micro),
    welcome_credits: settings.welcome_credits,
    trial_pool_credits: settings.trial_pool_credits,
    default_daily_credit_cap: settings.default_daily_credit_cap,
    default_daily_row_cap: settings.default_daily_row_cap,
  };
}

async function actionAdminUsage(db, settings) {
  const dayStart = store.utcDayStart();
  const users = await store.listUsers(db, dayStart);
  return json({
    day: store.utcDay(),
    global: await adminGlobalView(db, settings, dayStart),
    users: users.map((u) => ({
      id: u.uid,
      email: u.email || '',
      daily_credit_cap: u.daily_credit_cap, // null = use global default
      daily_row_cap: u.daily_row_cap,
      disabled: store.num(u.disabled),
      credits_available: store.num(u.credits_available),
      credits_used: store.num(u.credits_used),
      credits_held: store.num(u.credits_held),
      spent_micro: store.num(u.spent_micro),
      rows: store.num(u.rows),
    })),
  });
}

const ADMIN_PAGE_SIZE = 50;
const MAX_GRANT = 100000;
const GRANT_KEY_RE = /^[A-Za-z0-9._:-]{8,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function actionAdminUsers(db, settings, body) {
  const page = body.page === undefined ? 1 : body.page;
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return json({ error: 'invalid_page' }, 400);
  const total = await store.countUsers(db);
  const rows = await store.listUsersPage(db, store.utcDayStart(), ADMIN_PAGE_SIZE, (page - 1) * ADMIN_PAGE_SIZE);
  return json({
    day: store.utcDay(),
    page,
    page_size: ADMIN_PAGE_SIZE,
    total,
    has_more: page * ADMIN_PAGE_SIZE < total,
    users: rows.map((u) => ({
      id: u.uid,
      email: u.email || '',
      credits_available: store.num(u.credits_available),
      credits_held: store.num(u.credits_held),
      credits_used_today: store.num(u.credits_used),
      spent_micro_today: store.num(u.spent_micro),
      rows_today: store.num(u.rows),
      daily_credit_cap: u.daily_credit_cap, // null = use default
      effective_daily_credit_cap: u.daily_credit_cap == null ? settings.default_daily_credit_cap : store.num(u.daily_credit_cap),
      daily_row_cap: u.daily_row_cap,
      effective_daily_row_cap: u.daily_row_cap == null ? settings.default_daily_row_cap : store.num(u.daily_row_cap),
      disabled: store.num(u.disabled),
    })),
  });
}

// Resolve the grant target to an existing Clerk identity. Email is resolved by Clerk, never by our
// display copy, and must be VERIFIED on the matched user, so a stale or unverified address cannot redirect a grant.
async function resolveGrantTarget(db, env, body) {
  const hasEmail = body.target_email !== undefined;
  const hasUid = body.target_uid !== undefined;
  if (hasEmail === hasUid) return { error: 'invalid_target', status: 400 };
  const clerk = clerkClientFor(env);
  try {
    if (hasUid) {
      const uid = typeof body.target_uid === 'string' ? body.target_uid.trim() : '';
      if (!/^[\w-]{1,64}$/.test(uid)) return { error: 'invalid_target', status: 400 };
      const known = await db.prepare(`SELECT user_id FROM toolkit_accounts WHERE user_id=?1`).bind(uid).first();
      if (!known) await clerk.users.getUser(uid); // 404 throws -> target_not_found
      return { uid };
    }
    const email = typeof body.target_email === 'string' ? body.target_email.trim().toLowerCase() : '';
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) return { error: 'invalid_target', status: 400 };
    const list = await clerk.users.getUserList({ emailAddress: [email], limit: 2 });
    const hits = (list.data || []).filter((u) => (u.emailAddresses || []).some((e) => e.verification?.status === 'verified' && String(e.emailAddress).toLowerCase() === email));
    if (hits.length !== 1) return { error: 'target_not_found', status: 404 };
    return { uid: hits[0].id, email };
  } catch (e) {
    if (e?.status === 404) return { error: 'target_not_found', status: 404 };
    return { error: 'clerk_unavailable', status: 503 };
  }
}

async function actionAdminGrant(db, env, actor, body) {
  const credits = body.credits;
  if (!Number.isSafeInteger(credits) || credits < 1 || credits > MAX_GRANT) return json({ error: 'invalid_credits' }, 400);
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason || reason.length > 200) return json({ error: 'invalid_reason' }, 400);
  const idem = typeof body.idempotency_key === 'string' ? body.idempotency_key : '';
  if (!GRANT_KEY_RE.test(idem)) return json({ error: 'invalid_idempotency_key' }, 400);
  const target = await resolveGrantTarget(db, env, body);
  if (target.error) return json({ error: target.error }, target.status);

  const key = `admin_grant:${actor}:${idem}`; // scoped to the acting admin
  const now = store.nowIso();
  const res = await db.batch([
    store.ensureAccountStmt(db, target.uid, now),
    store.eventStmt(db, { key, uid: target.uid, type: 'admin_grant', credits, detail: JSON.stringify({ actor, reason }), now }),
  ]);
  const replayed = res[1].meta.changes === 0;
  if (replayed) {
    const prior = await store.getEvent(db, key);
    if (!prior || prior.user_id !== target.uid || store.num(prior.credits) !== credits) return json({ error: 'idempotency_conflict' }, 409);
  }
  if (target.email) await store.setEmail(db, target.uid, target.email);
  const agg = await store.getUserAggregate(db, target.uid, store.utcDayStart());
  return json({ granted: credits, replayed, user: { id: target.uid, email: (agg && agg.email) || '' }, credits_available: store.num(agg && agg.credits_available) });
}

const GLOBAL_FIELDS = {
  global_daily_cap_micro: MAX_MICRO_CAP,
  welcome_credits: MAX_CREDIT_CAP,
  trial_pool_credits: MAX_CREDIT_CAP,
  default_daily_credit_cap: MAX_CREDIT_CAP,
  default_daily_row_cap: MAX_ROW_CAP,
};

async function actionAdminUpdate(db, body) {
  const now = store.nowIso();
  const unknown = Object.keys(body).filter(
    (k) =>
      k !== 'action' &&
      k !== 'user_id' &&
      !(k in GLOBAL_FIELDS) &&
      !['daily_credit_cap', 'daily_row_cap', 'disabled'].includes(k)
  );
  if (unknown.length) return json({ error: 'unknown_field', field: unknown[0] }, 400);

  if ('user_id' in body) {
    const target = clip(body.user_id, 64);
    if (!target) return json({ error: 'invalid_user_id' }, 400);
    const fields = {};
    if ('daily_credit_cap' in body) {
      const v = intIn(body.daily_credit_cap, MAX_CREDIT_CAP);
      if (v === null) return json({ error: 'invalid_field', field: 'daily_credit_cap' }, 400);
      fields.daily_credit_cap = v;
    }
    if ('daily_row_cap' in body) {
      const v = intIn(body.daily_row_cap, MAX_ROW_CAP);
      if (v === null) return json({ error: 'invalid_field', field: 'daily_row_cap' }, 400);
      fields.daily_row_cap = v;
    }
    if ('disabled' in body) {
      const v = body.disabled === true || body.disabled === 1 ? 1 : body.disabled === false || body.disabled === 0 ? 0 : null;
      if (v === null) return json({ error: 'invalid_field', field: 'disabled' }, 400);
      fields.disabled = v;
    }
    if (!Object.keys(fields).length) return json({ error: 'no_fields' }, 400);
    const saved = await store.adminUpsertUser(db, target, fields, now);
    return json({
      user: {
        id: saved.user_id,
        email: saved.email || '',
        daily_credit_cap: saved.daily_credit_cap,
        daily_row_cap: saved.daily_row_cap,
        disabled: store.num(saved.disabled),
      },
    });
  }

  const entries = Object.entries(body).filter(([k]) => k in GLOBAL_FIELDS);
  if (!entries.length) return json({ error: 'no_fields' }, 400);
  for (const [k, v] of entries) {
    if (intIn(v, GLOBAL_FIELDS[k]) === null) return json({ error: 'invalid_field', field: k }, 400);
  }
  for (const [k, v] of entries) await store.adminUpsertSetting(db, k, v);
  const settings = await store.readSettings(db);
  return json({ global: await adminGlobalView(db, settings, store.utcDayStart()) });
}

// ---------------------------------------------------------------------------
// POST /api/toolkit dispatcher
// ---------------------------------------------------------------------------
async function handleAction(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: 'forbidden_origin' }, 403);
  const auth = await authenticate(request, url, env);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const db = getDb(env);
  if (!db) return json({ error: 'toolkit_db_not_configured' }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad_json' }, 400);
  }
  if (!body || typeof body !== 'object') return json({ error: 'bad_json' }, 400);
  const action = clip(body.action, 40);

  if (action === 'usage') {
    return actionUsage(db, env, auth.uid, await store.readSettings(db));
  }
  if (action === 'quote') return actionQuote(db, env, auth.uid, body);
  if (action === 'run') return actionRun(db, env, auth.uid, body);
  if (action === 'run_detail') {
    // Owner only: other users and admins get 404, existence is not leaked.
    const id = clip(body.id, 64);
    if (!UUID_RE.test(id)) return json({ error: 'bad_run_id' }, 400);
    const run = await store.getRunForOwner(db, id, auth.uid);
    if (!run) return json({ error: 'not_found' }, 404);
    return json(runResponse(run, await store.listOps(db, run.id)));
  }
  if (['admin_usage', 'admin_update', 'admin_users', 'admin_grant'].includes(action)) {
    if (!(await isAdmin(env, auth.uid))) return json({ error: 'forbidden' }, 403);
    const settings = await store.readSettings(db);
    if (action === 'admin_usage') return actionAdminUsage(db, settings);
    if (action === 'admin_users') return actionAdminUsers(db, settings, body);
    if (action === 'admin_grant') return actionAdminGrant(db, env, auth.uid, body);
    return actionAdminUpdate(db, body);
  }
  return json({ error: 'unknown_action' }, 400);
}

// ---------------------------------------------------------------------------
// POST /api/toolkit/webhook : signed notification, authoritative read decides
// ---------------------------------------------------------------------------
function webhookUserId(data) {
  if (!data || typeof data !== 'object') return null;
  const payer = data.payer;
  if (payer && typeof payer === 'object') {
    if (payer.organization_id) return null; // org payer: no personal allowance
    if (payer.user_id) return String(payer.user_id);
  }
  if (data.payer_id && !data.organization_id) return String(data.payer_id);
  return null;
}

const planMatches = (item, planId) =>
  item.planId === planId || (item.plan && (item.plan.id === planId || item.plan.slug === planId));

async function handleWebhook(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const signingSecret = env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!signingSecret) return json({ error: 'webhook_not_configured' }, 503);

  const svixId = request.headers.get('svix-id');
  let evt;
  try {
    evt = await verifyWebhook(request, { signingSecret });
  } catch {
    return json({ error: 'webhook_verification_failed' }, 400);
  }

  const isBilling = /^(subscription|subscriptionItem|paymentAttempt)\./.test(evt.type);
  if (!isBilling) return json({ received: true, ignored: true }); // ACK, no grant

  const db = getDb(env);
  if (!db) return json({ error: 'toolkit_db_not_configured' }, 503);

  const now = store.nowIso();
  const userId = webhookUserId(evt.data);
  const dataId = evt.data && evt.data.id ? clip(evt.data.id, 80) : '';
  const receiptKey = 'evt:' + (svixId || crypto.randomUUID());

  if (!userId) {
    await store
      .eventStmt(db, {
        key: receiptKey,
        uid: 'unknown',
        type: 'receipt',
        credits: 0,
        detail: JSON.stringify({ event: evt.type, data_id: dataId, note: 'no_user_payer' }),
        now,
      })
      .run();
    return json({ received: true, granted: false });
  }

  // Authoritative state: ignore whatever the body claims about status or amount.
  const settings = await store.readSettings(db);
  let sub = null;
  try {
    sub = await clerkClientFor(env).billing.getUserBillingSubscription(userId);
  } catch (error) {
    if (error?.status !== 404) return json({ error: 'billing_temporarily_unavailable' }, 503);
  }

  let grantKey = null;
  if (sub && sub.status === 'active' && settings.paid_plan_id && settings.paid_allowance_credits > 0) {
    const item = (sub.subscriptionItems || []).find(
      (it) =>
        it &&
        it.status === 'active' &&
        !it.isFreeTrial &&
        planMatches(it, settings.paid_plan_id) &&
        Number.isFinite(it.periodStart) &&
        it.periodStart > 0
    );
    if (item) grantKey = `paid:${userId}:${item.id}:${item.periodStart}`;
  }

  // Receipt and grant persist in one atomic batch. The grant key makes
  // duplicates and out-of-order deliveries idempotent per paid period.
  const stmts = [
    store.ensureAccountStmt(db, userId, now),
    store.eventStmt(db, {
      key: receiptKey,
      uid: userId,
      type: 'receipt',
      credits: 0,
      detail: JSON.stringify({ event: evt.type, data_id: dataId }),
      now,
    }),
  ];
  if (grantKey) {
    stmts.push(
      store.eventStmt(db, {
        key: grantKey,
        uid: userId,
        type: 'paid',
        credits: settings.paid_allowance_credits,
        detail: JSON.stringify({ plan: settings.paid_plan_id, allowance: settings.paid_allowance_credits }),
        now,
      })
    );
  }
  const results = await db.batch(stmts);
  const granted = grantKey ? results[2].meta.changes > 0 : false;
  return json({ received: true, granted });
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------
export async function handleToolkit(request, env) {
  const url = new URL(request.url);
  try {
    if (request.method === 'POST' && request.body) {
      const limit = url.pathname === '/api/toolkit/webhook' ? 262144 : 65536;
      const reader = request.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) { await reader.cancel(); return json({ error: 'body_too_large' }, 413); }
        chunks.push(value);
      }
      request = new Request(request.url, { method: request.method, headers: request.headers, body: new Blob(chunks) });
    }
    if (url.pathname === '/api/toolkit/config') {
      return request.method === 'GET' ? await handleConfig(env) : json({ error: 'method_not_allowed' }, 405);
    }
    if (url.pathname === '/api/toolkit/webhook') return await handleWebhook(request, env);
    if (url.pathname === '/api/toolkit') {
      if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
      return await handleAction(request, env, url);
    }
    return json({ error: 'not_found' }, 404);
  } catch (e) {
    console.error('toolkit: internal failure');
    return json({ error: 'internal' }, 500);
  }
}
