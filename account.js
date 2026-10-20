// account.js : shared balance, Clerk native billing mounts, and the admin
// caps form. Session and API calls live in toolkit-session.js.

import { formatUsd, formatCredits } from './toolkit-lib.js';
import * as toolkit from './toolkit-session.js';

const $ = (id) => document.getElementById(id);

const state = {
  cfg: null,
  signedIn: false,
  usage: null,
  isAdmin: false,
  adminData: null,
  userMounted: false,
  pricingMounted: false,
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function setMeter(node, ratio) {
  const p = Math.max(0, Math.min(1, Number(ratio) || 0));
  node.style.setProperty('--p', String(p));
}

function status(msg, bad) {
  const n = $('admin-status');
  n.textContent = msg || '';
  n.classList.toggle('bad', !!bad);
  n.classList.toggle('hide', !msg);
}

// ---------------------------------------------------------------- balance

function renderBalance() {
  const u = state.usage;
  if (!state.signedIn || !u) return;
  const usage = u.usage || {};
  $('balance-day').textContent = 'day of ' + (usage.day || 'today') + ' · ' + (u.user ? u.user.email : '');
  $('account-disabled').classList.toggle('hide', !usage.disabled);
  $('b-available').textContent = formatCredits(u.credits_available ?? usage.credits_available ?? 0);
  $('b-held').textContent = formatCredits(usage.credits_held || 0);
  $('b-held-sub').textContent = formatUsd(usage.held_micro || 0) + ' unresolved';
  $('b-used').textContent = formatCredits(usage.credits_used || 0);
  $('b-spend').textContent = formatUsd(usage.spent_micro || 0);
  $('b-rows').textContent = String(usage.rows || 0);
  const creditCap = usage.daily_credit_cap || 0;
  const rowCap = usage.daily_row_cap || 0;
  $('b-rows-sub').textContent = rowCap > 0 ? 'of ' + rowCap + ' row cap' : 'no row cap set';
  $('b-credit-cap').textContent = creditCap > 0
    ? formatCredits(usage.credits_used || 0) + ' of ' + formatCredits(creditCap)
    : 'no cap set';
  setMeter($('b-credit-meter'), creditCap > 0 ? (usage.credits_used || 0) / creditCap : 0);
  $('b-row-cap').textContent = rowCap > 0 ? (usage.rows || 0) + ' of ' + rowCap : 'no cap set';
  setMeter($('b-row-meter'), rowCap > 0 ? (usage.rows || 0) / rowCap : 0);
  $('b-held-micro').textContent = String(usage.held_micro || 0);
  const providers = $('b-providers');
  providers.replaceChildren();
  const p = u.providers || {};
  for (const name of ['treg', 'jev']) {
    providers.append(el('span', 'chip ' + (p[name] ? 'chip-ok' : 'chip-bad'),
      name + (p[name] ? ' ready' : ' offline')));
  }
}

function ageText(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const ms = Date.now() - t;
  if (ms < 60000) return 'just now';
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return Math.floor(ms / 3600000) + 'h ago';
  return d + 'd ago';
}

function renderUsageTable() {
  const body = $('usage-table').querySelector('tbody');
  body.replaceChildren();
  const runs = (state.usage && state.usage.runs) || [];
  $('usage-empty').classList.toggle('hide', runs.length > 0);
  for (const run of runs) {
    const tr = el('tr');
    const when = el('td');
    const age = el('span', 'age', ageText(run.created_at));
    const abs = new Date(run.created_at);
    if (!Number.isNaN(abs.getTime()) && Date.now() - abs.getTime() > 30 * 86400000) age.classList.add('old');
    when.append(age);
    when.append(el('span', 'sub2', Number.isNaN(abs.getTime()) ? '' : abs.toISOString().slice(0, 10)));
    tr.append(when);
    tr.append(el('td', null, run.tool_id || 'lead-scorer'));
    tr.append(el('td', null, run.list_name || 'unnamed list'));
    const st = el('td');
    const cls = run.status === 'completed' ? 'chip-ok' : run.status === 'review' ? 'chip-bad' : 'chip-idle';
    st.append(el('span', 'chip ' + cls, run.status || 'unknown'));
    tr.append(st);
    tr.append(el('td', 'num', String(run.row_count ?? 0)));
    tr.append(el('td', 'num', formatCredits(run.credits_used || 0)));
    tr.append(el('td', 'num', formatUsd(run.spent_micro || 0)));
    body.append(tr);
  }
}

// ---------------------------------------------------------------- billing

function renderBilling() {
  const box = $('pricing');
  if (!state.cfg || !state.cfg.configured) return;
  const off = $('billing-off');
  const needSignIn = $('billing-signin');
  off.classList.add('hide');
  needSignIn.classList.add('hide');
  if (!state.cfg.billing_enabled) {
    off.classList.remove('hide');
    return;
  }
  if (!state.signedIn) {
    needSignIn.classList.remove('hide');
    return;
  }
  if (!state.pricingMounted) {
    state.pricingMounted = toolkit.mountPricingTable(box);
    if (!state.pricingMounted) {
      off.classList.remove('hide');
    }
  }
}

// ---------------------------------------------------------------- admin

function intFrom(node, label) {
  const raw = String(node.value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error(label + ' must be a whole number of 0 or more.');
  }
  return Number(raw);
}

function renderAdmin() {
  const data = state.adminData;
  if (!data) return;
  const g = data.global || {};
  $('g-cap').value = String(g.daily_cap_micro ?? 0);
  $('g-welcome').value = String(g.welcome_credits ?? 0);
  $('g-pool').value = String(g.trial_pool_credits ?? 0);
  $('g-default-credits').value = String(g.default_daily_credit_cap ?? 0);
  $('g-default-rows').value = String(g.default_daily_row_cap ?? 0);
  $('g-cap-usd').textContent = formatUsd(g.daily_cap_micro || 0);

  const body = $('users-table').querySelector('tbody');
  body.replaceChildren();
  const users = data.users || [];
  $('users-meta').textContent = users.length + ' account' + (users.length === 1 ? '' : 's');
  if (!users.length) {
    const tr = el('tr', 'empty-row');
    const td = el('td');
    td.colSpan = 7;
    td.textContent = 'No users recorded yet.';
    tr.append(td);
    body.append(tr);
    return;
  }
  users.forEach((u, i) => {
    const tr = el('tr');
    const who = el('td');
    who.append(el('b', null, u.email || u.id));
    who.append(el('span', 'sub2', String(u.id).slice(0, 12)));
    tr.append(who);

    const capCell = el('td');
    const cap = el('input', 'mini-input');
    cap.type = 'number';
    cap.min = '0';
    cap.step = '1';
    cap.value = String(u.daily_credit_cap ?? 0);
    cap.setAttribute('aria-label', 'Daily credit cap for ' + (u.email || u.id));
    capCell.append(cap);
    tr.append(capCell);

    const rowCell = el('td');
    const rows = el('input', 'mini-input');
    rows.type = 'number';
    rows.min = '0';
    rows.step = '1';
    rows.value = String(u.daily_row_cap ?? 0);
    rows.setAttribute('aria-label', 'Daily row cap for ' + (u.email || u.id));
    rowCell.append(rows);
    tr.append(rowCell);

    const disCell = el('td');
    const wrap = el('div', 'checkline');
    const dis = el('input');
    dis.type = 'checkbox';
    dis.id = 'dis-' + i;
    dis.checked = !!u.disabled;
    const disLabel = el('label', null, 'suspended');
    disLabel.htmlFor = dis.id;
    wrap.append(dis, disLabel);
    disCell.append(wrap);
    tr.append(disCell);

    tr.append(el('td', 'num', formatCredits(u.credits_available || 0) + ' free'));
    tr.append(el('td', 'num', formatUsd(u.spent_micro || 0)));

    const act = el('td');
    const save = el('button', 'btn sec', 'Save');
    save.type = 'button';
    save.addEventListener('click', async () => {
      status('');
      let body2;
      try {
        body2 = {
          user_id: u.id,
          daily_credit_cap: intFrom(cap, 'Daily credit cap'),
          daily_row_cap: intFrom(rows, 'Daily row cap'),
          disabled: dis.checked,
        };
      } catch (e) {
        status(e.message, true);
        return;
      }
      save.disabled = true;
      try {
        await toolkit.api('admin_update', body2);
        await loadAdmin();
        status('Saved ' + (u.email || u.id) + ' and read the values back.');
      } catch (e) {
        status('Save failed: ' + e.message, true);
      } finally {
        save.disabled = false;
      }
    });
    act.append(save);
    tr.append(act);
    body.append(tr);
  });
}

async function loadAdmin() {
  if (!state.isAdmin) return;
  try {
    state.adminData = await toolkit.api('admin_usage', {});
  } catch (e) {
    status('Could not load admin data: ' + e.message, true);
    return;
  }
  renderAdmin();
}

// ---------------------------------------------------------------- auth

function renderAuth(snap) {
  state.signedIn = snap.signedIn;
  const hint = $('auth-hint');
  const signin = $('signin');
  const slot = $('user-slot');
  if (!state.cfg || !state.cfg.configured) {
    signin.hidden = true;
    hint.textContent = 'backend not configured';
    return;
  }
  if (snap.signedIn) {
    hint.classList.add('hide');
    signin.hidden = true;
    if (!state.userMounted) state.userMounted = toolkit.mountUserButton(slot);
    renderBilling();
    loadUsage();
  } else {
    hint.classList.remove('hide');
    hint.textContent = 'sign in to see your balance';
    signin.hidden = false;
    slot.replaceChildren();
    state.userMounted = false;
    state.usage = null;
    state.isAdmin = false;
    state.pricingMounted = false;
    $('pricing').replaceChildren();
    $('admin').classList.add('hide');
    $('balance-day').textContent = 'sign in to see your balance';
    $('b-available').textContent = 'sign in';
    $('usage-table').querySelector('tbody').replaceChildren();
    $('usage-empty').classList.remove('hide');
    renderBilling();
  }
}

async function loadUsage() {
  if (!state.signedIn) return;
  try {
    state.usage = await toolkit.api('usage', {});
  } catch (e) {
    $('balance-day').textContent = 'usage unavailable: ' + e.message;
    return;
  }
  renderBalance();
  renderUsageTable();
  state.isAdmin = !!(state.usage.user && state.usage.user.is_admin);
  $('admin').classList.toggle('hide', !state.isAdmin);
  if (state.isAdmin) loadAdmin();
}

// ---------------------------------------------------------------- init

function wireEvents() {
  $('signin').addEventListener('click', async () => {
    try {
      await toolkit.startClerk();
      await toolkit.openSignIn();
    } catch (e) {
      $('auth-hint').textContent = e.message;
      $('auth-hint').classList.remove('hide');
    }
  });

  $('g-cap').addEventListener('input', () => {
    const v = Number($('g-cap').value);
    $('g-cap-usd').textContent = Number.isFinite(v) ? formatUsd(v) : '';
  });

  $('g-save').addEventListener('click', async () => {
    status('');
    let body;
    try {
      body = {
        global_daily_cap_micro: intFrom($('g-cap'), 'Global daily cap'),
        welcome_credits: intFrom($('g-welcome'), 'Welcome credits'),
        trial_pool_credits: intFrom($('g-pool'), 'Trial pool credits'),
        default_daily_credit_cap: intFrom($('g-default-credits'), 'Default daily credit cap'),
        default_daily_row_cap: intFrom($('g-default-rows'), 'Default daily row cap'),
      };
    } catch (e) {
      status(e.message, true);
      return;
    }
    const btn = $('g-save');
    btn.disabled = true;
    try {
      await toolkit.api('admin_update', body);
      await loadAdmin();
      status('Global limits saved and read back.');
    } catch (e) {
      status('Save failed: ' + e.message, true);
    } finally {
      btn.disabled = false;
    }
  });
}

async function init() {
  wireEvents();
  try {
    state.cfg = await toolkit.loadConfig();
  } catch (e) {
    state.cfg = { configured: false };
    $('setup-text').textContent = 'Config endpoint unreachable: ' + e.message;
  }
  if (!state.cfg.configured) {
    $('setup-banner').classList.remove('hide');
    $('auth-hint').textContent = 'backend not configured';
    $('billing-off').classList.remove('hide');
    return;
  }
  renderBilling();
  try {
    await toolkit.startClerk();
  } catch (e) {
    $('auth-hint').textContent = e.message;
    $('auth-hint').classList.remove('hide');
  }
  toolkit.onAuthChange(renderAuth);
  renderAuth(toolkit.authState());
}

init();
