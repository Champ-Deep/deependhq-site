// lead-scorer.js : workspace controller for lead-scorer.html.
// Pure parsing, mapping, export and money maths live in toolkit-lib.js
// (unit tested). Session, config and API calls live in toolkit-session.js.
// This file only wires state to the DOM.

import {
  parseCsv, toCsv, parseXlsx, guessMapping, mapRows, sanitizeRow, chunk,
  formatUsd, formatCredits, MAX_FILE_BYTES, MAX_FILE_ROWS,
} from './toolkit-lib.js';
import * as toolkit from './toolkit-session.js';

const $ = (id) => document.getElementById(id);
const CANON = ['name', 'email', 'title', 'company', 'domain', 'linkedin'];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  cfg: null,
  signedIn: false,
  usage: null,
  headers: [],
  source: [],
  mapping: {},
  rows: [],
  rubrics: [],
  batches: [],
  quotes: [],
  frozen: null,        // run inputs captured at quote time
  quoteMicro: 0,
  quoteCredits: 0,
  quoting: false,
  running: false,
  cancel: false,
  started: false,      // a run session happened, re-quote before running again
  results: [],
  detail: false,       // viewing a saved run from history
  spentMicro: 0,
  heldMicro: 0,
  creditsUsed: 0,
  creditsHeld: 0,
  aggLedger: {},
  rowsDone: 0,
  userMounted: false,
};

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

// The usage response nests every meter under usage.usage per toolkit-api.md.
function usageBox() {
  return (state.usage && state.usage.usage) || {};
}

function creditsAvailable() {
  return usageBox().credits_available || 0;
}

function setMeter(node, ratio) {
  const p = Math.max(0, Math.min(1, Number(ratio) || 0));
  node.style.setProperty('--p', String(p));
}

// ---------------------------------------------------------------- shell

function listErr(msg) {
  const n = $('list-status');
  n.textContent = msg;
  n.classList.toggle('hide', !msg);
}

function approveErr(msg) {
  $('approve-err').textContent = msg || '';
}

function setStatus(msg) {
  $('run-status').textContent = msg;
}

function stage(name) {
  $('stage-drop').classList.toggle('hide', name !== 'drop');
  $('stage-map').classList.toggle('hide', name !== 'map');
}

function listName() {
  return $('listname').value.trim() || 'lead-scorer list';
}

function icpText() {
  const sell = $('sell').value.trim();
  const want = $('want').value.trim();
  const parts = [];
  if (sell) parts.push('What we sell: ' + sell);
  if (want) parts.push('Who we want: ' + want);
  return parts.join('\n');
}

function updateIcpCount() {
  const n = icpText().length;
  const node = $('icp-count');
  node.textContent = n + ' / 2000 characters for the brief';
  node.classList.toggle('over', n > 2000);
}

// ---------------------------------------------------------------- rubrics

function buildCustom() {
  const out = [];
  state.rubrics.forEach((r, i) => {
    const label = (r.label || '').trim();
    const criteria = (r.criteria || []).map((c) => c.trim()).filter(Boolean);
    const instructions = (r.instructions || '').trim();
    if (!label && !criteria.length && !instructions) return;
    if (!label) throw new Error('Rubric ' + (i + 1) + ' needs a label.');
    if (criteria.length < 2 || criteria.length > 5) {
      throw new Error('Rubric "' + label + '" needs 2 to 5 criteria, it has ' + criteria.length + '.');
    }
    if (new Set(criteria).size !== criteria.length) {
      throw new Error('Rubric "' + label + '" has duplicate criteria labels.');
    }
    if (criteria.some((c) => c.length > 100)) {
      throw new Error('A criterion in "' + label + '" is over 100 characters.');
    }
    if (instructions.length > 500) {
      throw new Error('Instructions for "' + label + '" are over 500 characters.');
    }
    out.push({
      id: 'c' + out.length,
      label: label.slice(0, 80),
      type: r.type === 'category' ? 'category' : 'score',
      instructions,
      criteria,
    });
  });
  return out;
}

function renderRubrics() {
  const box = $('rubrics');
  box.replaceChildren();
  state.rubrics.forEach((r, i) => {
    const card = el('div', 'rubric');
    const head = el('div', 'rubric-head');
    head.append(el('span', 'r-id', 'rubric ' + (i + 1) + ' · ' + (r.type === 'category' ? 'category' : 'score')));
    const rm = el('button', 'linkbtn', 'Remove');
    rm.type = 'button';
    rm.addEventListener('click', () => {
      state.rubrics.splice(i, 1);
      renderRubrics();
      invalidateQuote();
    });
    head.append(rm);
    card.append(head);

    const lab = el('div', 'field');
    const labLabel = el('label', null, 'Label');
    labLabel.htmlFor = 'r-label-' + i;
    const labInput = el('input');
    labInput.id = 'r-label-' + i;
    labInput.value = r.label;
    labInput.maxLength = 80;
    labInput.placeholder = 'Budget authority';
    labInput.addEventListener('input', () => {
      r.label = labInput.value;
      invalidateQuote();
    });
    lab.append(labLabel, labInput);
    card.append(lab);

    const grid = el('div', 'rubric-grid');
    const instrField = el('div', 'field');
    const instrLabel = el('label', null, 'Instructions');
    instrLabel.htmlFor = 'r-instr-' + i;
    const instr = el('textarea');
    instr.id = 'r-instr-' + i;
    instr.rows = 2;
    instr.maxLength = 500;
    instr.value = r.instructions;
    instr.placeholder = 'Judge only from the uploaded columns, no profile lookups.';
    instr.addEventListener('input', () => {
      r.instructions = instr.value;
      invalidateQuote();
    });
    instrField.append(instrLabel, instr);

    const typeField = el('div', 'field');
    const typeLabel = el('label', null, 'Type');
    typeLabel.htmlFor = 'r-type-' + i;
    const typeSel = el('select');
    typeSel.id = 'r-type-' + i;
    const oScore = el('option', null, 'Score: bucket from criteria');
    oScore.value = 'score';
    const oCat = el('option', null, 'Category: pick one label');
    oCat.value = 'category';
    typeSel.append(oScore, oCat);
    typeSel.value = r.type === 'category' ? 'category' : 'score';
    typeSel.addEventListener('change', () => {
      r.type = typeSel.value;
      renderRubrics();
      invalidateQuote();
    });
    typeField.append(typeLabel, typeSel);
    grid.append(instrField, typeField);
    card.append(grid);

    const critField = el('div', 'field');
    const critLabel = el('label', null, 'Criteria');
    critLabel.htmlFor = 'r-crit-' + i;
    const critRow = el('div', 'row');
    const critInput = el('input');
    critInput.id = 'r-crit-' + i;
    critInput.maxLength = 100;
    critInput.placeholder = r.criteria.length >= 5 ? '5 criteria maximum' : 'Add a label, then press Add';
    critInput.disabled = r.criteria.length >= 5;
    const addCrit = el('button', 'btn sec', 'Add');
    addCrit.type = 'button';
    const pushCrit = () => {
      const v = critInput.value.trim();
      if (!v) return;
      if (r.criteria.length >= 5) return;
      r.criteria.push(v);
      critInput.value = '';
      renderRubrics();
      invalidateQuote();
    };
    addCrit.addEventListener('click', pushCrit);
    critInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        pushCrit();
      }
    });
    critRow.append(critInput, addCrit);
    const chips = el('div', 'criteria');
    r.criteria.forEach((c, ci) => {
      const chip = el('span', 'criteria-chip');
      chip.append(document.createTextNode(c));
      const x = el('button', null, 'x');
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove criterion ' + c);
      x.addEventListener('click', () => {
        r.criteria.splice(ci, 1);
        renderRubrics();
        invalidateQuote();
      });
      chip.append(x);
      chips.append(chip);
    });
    critField.append(critLabel, critRow, chips);
    card.append(critField);
    box.append(card);
  });
  $('rubric-add').disabled = state.rubrics.length >= 3;
}

// ---------------------------------------------------------------- file + mapping

function setFileHints() {
  const hint = $('fhint');
  const note = $('map-note');
  const base = 'Mapping picks the source column for each field. Every other column is kept for your rubrics.';
  if (state.mapping.linkedin) {
    hint.textContent = 'LinkedIn column mapped, profile level signals.';
    hint.className = 'ok';
  } else {
    hint.textContent = 'No LinkedIn column: name and domain lookups only.';
    hint.className = '';
  }
  let extra = base;
  if (!state.mapping.name && state.mapping.first && state.mapping.last) {
    extra = 'Name is joined from ' + state.mapping.first + ' + ' + state.mapping.last + '. ' + base;
  }
  note.textContent = extra;
}

function renderMapping() {
  const grid = $('mapgrid');
  grid.replaceChildren();
  for (const field of CANON) {
    const wrap = el('div', 'field');
    const lab = el('label', null, field);
    const sel = el('select');
    sel.setAttribute('data-field', field);
    sel.setAttribute('aria-label', 'Source column for ' + field);
    const none = el('option', null, '(none)');
    none.value = '';
    sel.append(none);
    for (const h of state.headers) {
      const o = el('option', null, h);
      o.value = h;
      sel.append(o);
    }
    sel.value = state.mapping[field] || '';
    sel.addEventListener('change', () => {
      state.mapping[field] = sel.value;
      recomputeRows();
      setFileHints();
      invalidateQuote();
    });
    lab.htmlFor = 'map-' + field;
    sel.id = 'map-' + field;
    wrap.append(lab, sel);
    grid.append(wrap);
  }
}

function recomputeRows() {
  state.rows = mapRows(state.source, state.mapping).map(sanitizeRow);
  $('frows').textContent = String(state.rows.length);
  renderPreview();
}

function renderPreview() {
  const tbl = $('preview');
  const head = tbl.querySelector('thead tr');
  const body = tbl.querySelector('tbody');
  head.replaceChildren();
  body.replaceChildren();
  if (!state.rows.length) return;
  const canonCols = CANON.filter((c) => state.rows.some((r) => r[c] !== undefined));
  const extraCols = Object.keys(state.rows[0]).filter((k) => !CANON.includes(k));
  const cols = canonCols.concat(extraCols);
  for (const c of cols) head.append(el('th', null, c));
  for (const r of state.rows.slice(0, 5)) {
    const tr = el('tr');
    for (const c of cols) tr.append(el('td', null, r[c] ?? ''));
    body.append(tr);
  }
  $('preview-meta').textContent = 'first ' + Math.min(5, state.rows.length) + ' of ' +
    state.rows.length + ' mapped rows, ' + cols.length + ' columns';
}

async function handleFile(f) {
  if (!f) return;
  listErr('');
  const lower = f.name.toLowerCase();
  if (!lower.endsWith('.csv') && !lower.endsWith('.xlsx')) {
    listErr('CSV or XLSX only. Export anything else as CSV first.');
    return;
  }
  if (f.size > MAX_FILE_BYTES) {
    listErr('That file is over 5 MB. Split the list and run it in parts.');
    return;
  }
  try {
    const parsed = lower.endsWith('.csv')
      ? parseCsv(await f.text())
      : await parseXlsx(await f.arrayBuffer());
    if (!parsed.headers.length) {
      listErr('That file has no header row.');
      return;
    }
    if (!parsed.rows.length) {
      listErr('That file has a header but no data rows.');
      return;
    }
    if (parsed.rows.length > MAX_FILE_ROWS) {
      listErr('That file has ' + parsed.rows.length + ' rows. The limit is ' + MAX_FILE_ROWS + '.');
      return;
    }
    state.headers = parsed.headers;
    state.source = parsed.rows;
    state.mapping = guessMapping(state.headers);
    state.rows = mapRows(state.source, state.mapping).map(sanitizeRow);
    $('fname').textContent = f.name;
    renderMapping();
    recomputeRows();
    setFileHints();
    invalidateQuote();
    if (!$('listname').value) $('listname').value = f.name.replace(/\.[^.]+$/, '');
    stage('map');
  } catch (e) {
    listErr('Could not read that file: ' + e.message);
  }
}

// ---------------------------------------------------------------- quote

function invalidateQuote() {
  if (!state.quotes.length && !state.started) return;
  state.quotes = [];
  state.batches = [];
  state.quoteMicro = 0;
  state.quoteCredits = 0;
  state.frozen = null;
  if (!state.running) {
    state.started = false;
    renderDocket();
    approveErr('Inputs changed. Get a fresh quote before running.');
  }
}

function renderDocket(partial) {
  const box = $('quote-docket');
  box.replaceChildren();
  if (partial) {
    box.append(el('p', 'muted', partial));
    return;
  }
  if (!state.quotes.length) {
    const line = el('div', 'docket-line');
    line.append(el('span', null, 'No quote yet'), el('b', null, 'upload, sign in, quote'));
    box.append(line);
    return;
  }
  const rows = state.rows.length;
  const line = (label, value, cls) => {
    const n = el('div', 'docket-line' + (cls ? ' ' + cls : ''));
    n.append(el('span', null, label), el('b', null, value));
    box.append(n);
  };
  let enr = 0, em = 0, jev = 0, micro = 0, credits = 0;
  const warns = new Set();
  for (const q of state.quotes) {
    micro += q.max_cost_micro || 0;
    credits += q.max_credits || 0;
    if (q.breakdown) {
      enr += q.breakdown.enrichment_micro || 0;
      em += q.breakdown.email_micro || 0;
      jev += q.breakdown.jev_micro || 0;
    }
    for (const w of q.warnings || []) warns.add(w);
  }
  state.quoteMicro = micro;
  state.quoteCredits = credits;
  line('Rows', rows + ' in ' + state.batches.length + (state.batches.length === 1 ? ' batch of 5' : ' batches of 5'));
  line('Enrichment lookups', formatUsd(enr));
  line('Email verification', formatUsd(em));
  line('Jev judging', formatUsd(jev));
  line('Maximum authorized', formatUsd(micro) + ' · ' + formatCredits(credits) + ' credits', 'total');

  const warnBox = $('quote-warns');
  warnBox.replaceChildren();
  for (const w of warns) warnBox.append(el('div', 'warn-line', w));
  warnBox.classList.toggle('hide', warns.size === 0);

  const available = state.signedIn ? creditsAvailable() : 0;
  $('balance-value').textContent = state.signedIn ? formatCredits(available) : 'sign in';
  if (state.signedIn) {
    const left = available - credits;
    $('balance-sub').textContent = left >= 0
      ? 'after this run about ' + formatCredits(left) + ' credits left'
      : 'short by ' + formatCredits(credits - available) + ' credits, top up on the account page';
  } else {
    $('balance-sub').textContent = 'one balance across every toolkit tool';
  }
  renderRunButton();
}

function renderRunButton() {
  const btn = $('run-btn');
  const n = state.rows.length;
  if (state.running) {
    btn.disabled = true;
    btn.textContent = 'Running';
    return;
  }
  if (!state.quotes.length) {
    btn.disabled = true;
    btn.textContent = n ? 'Run ' + n + (n === 1 ? ' row' : ' rows') : 'Run the list';
    return;
  }
  btn.textContent = 'Run ' + n + (n === 1 ? ' row · ' : ' rows · ') + formatCredits(state.quoteCredits) + ' credits';
  let blocked = '';
  if (!state.signedIn) blocked = 'Sign in to run.';
  else if (!state.cfg || !state.cfg.configured) blocked = 'Backend not configured.';
  else if (state.usage && usageBox().disabled) blocked = 'This account is paused for spending.';
  else if (state.usage && state.quoteCredits > creditsAvailable()) {
    blocked = 'Quote needs ' + formatCredits(state.quoteCredits) + ' credits, balance is ' +
      formatCredits(creditsAvailable()) + '.';
  }
  btn.disabled = !!blocked;
  if (blocked) approveErr(blocked);
}

async function getQuote() {
  if (state.quoting || state.running) return;
  if (!state.signedIn) {
    approveErr('Sign in to get a quote.');
    return;
  }
  if (!state.rows.length) {
    approveErr('Upload a list first.');
    return;
  }
  const icp = icpText();
  if (icp.length > 2000) {
    approveErr('The brief is over 2000 characters.');
    return;
  }
  let custom;
  try {
    custom = buildCustom();
  } catch (e) {
    approveErr(e.message);
    return;
  }
  state.quoting = true;
  approveErr('');
  const btn = $('quote-btn');
  btn.disabled = true;
  btn.textContent = 'Quoting';
  try {
    state.batches = chunk(state.rows, 5);
    state.quotes = [];
    for (let i = 0; i < state.batches.length; i++) {
      renderDocket('quoting batch ' + (i + 1) + ' of ' + state.batches.length);
      const q = await toolkit.api('quote', {
        rows: state.batches[i],
        icp,
        enrich: $('enrich').checked,
        verify_email: $('verify').checked,
        custom,
      });
      state.quotes.push(q);
    }
    state.frozen = {
      icp,
      enrich: $('enrich').checked,
      verify_email: $('verify').checked,
      custom,
    };
    state.started = false;
    renderDocket();
    if (state.usage) renderWallet();
    if (state.signedIn && state.quoteCredits > creditsAvailable()) {
      approveErr('Quote is above your shared balance.');
    }
  } catch (e) {
    state.quotes = [];
    state.frozen = null;
    renderDocket();
    approveErr(e.message);
  } finally {
    state.quoting = false;
    btn.disabled = false;
    btn.textContent = 'Refresh quote';
  }
}

// ---------------------------------------------------------------- run

function resetRunViews() {
  state.results = [];
  state.detail = false;
  state.spentMicro = 0;
  state.heldMicro = 0;
  state.creditsUsed = 0;
  state.creditsHeld = 0;
  state.aggLedger = {};
  state.rowsDone = 0;
  $('wire').replaceChildren();
  $('ledger').classList.add('hide');
  $('ledger-body').replaceChildren();
  $('results').classList.add('hide');
  $('results-h').textContent = 'Call sheet';
  $('t-batches').textContent = '0 / ' + state.batches.length;
  $('t-batches-sub').textContent = 'queued';
  $('t-rows').textContent = '0';
  $('t-rows-sub').textContent = 'of ' + state.rows.length;
  $('t-spend').textContent = '$0.00';
  $('t-held').textContent = '$0.00';
  $('prog-text').textContent = 'Queued';
  $('prog-pct').textContent = '0%';
  setMeter($('prog-meter'), 0);
}

function wireRow(index, input) {
  const w = el('div', 'w arrive');
  w.dataset.i = String(index);
  const name = el('span', 'w-name', (input && input.name) || 'Row ' + (index + 1));
  const note = el('span', 'w-note', [(input && input.title), (input && input.company)].filter(Boolean).join(' · '));
  const stateNode = el('span', 'w-state', 'queued');
  w.append(name, note, stateNode);
  $('wire').append(w);
  return w;
}

function wireFinish(startIndex, results) {
  results.forEach((r, k) => {
    const i = startIndex + k;
    const node = $('wire').querySelector('[data-i="' + i + '"]');
    if (!node) return;
    const st = node.querySelector('.w-state');
    st.textContent = (r.email_status || '').replace('_', ' ') + ' ';
    st.append(el('span', 'chip ' + fitChip(r.icp_fit), r.icp_fit || 'Unjudged'));
    node.classList.remove('arrive');
  });
}

function fitChip(fit) {
  if (fit === 'Strong fit') return 'chip-ok';
  if (fit === 'Possible fit') return 'chip';
  if (fit === 'Unjudged' || !fit) return 'chip-idle';
  return '';
}

function addLedger(entries) {
  for (const e of entries || []) {
    const key = (e.provider || '?') + '|' + (e.endpoint || '?') + '|' + (e.status || '?');
    if (!state.aggLedger[key]) {
      state.aggLedger[key] = {
        provider: e.provider || '?',
        endpoint: e.endpoint || '?',
        status: e.status || '?',
        cost_micro: 0,
        reserved_micro: 0,
        calls: 0,
      };
    }
    state.aggLedger[key].cost_micro += e.cost_micro || 0;
    state.aggLedger[key].reserved_micro += e.reserved_micro || 0;
    state.aggLedger[key].calls += 1;
  }
  renderLedger();
}

function renderLedger() {
  const body = $('ledger-body');
  body.replaceChildren();
  const keys = Object.keys(state.aggLedger);
  $('ledger').classList.toggle('hide', keys.length === 0);
  for (const k of keys) {
    const e = state.aggLedger[k];
    const tr = el('tr');
    tr.append(el('td', null, e.provider));
    tr.append(el('td', null, e.endpoint));
    const st = el('td');
    st.append(el('span', 'chip ' + (e.status === 'settled' ? 'chip-ok' : e.status === 'unknown' ? 'chip-bad' : 'chip-idle'), e.status));
    tr.append(st);
    tr.append(el('td', 'num', e.status === 'unknown' ? 'Not reconciled' : formatUsd(e.cost_micro)));
    tr.append(el('td', 'num', formatUsd(e.reserved_micro) + ' (' + e.calls + ' calls)'));
    body.append(tr);
  }
}

function applyBatch(res, batchIndex, total) {
  const batchRows = state.batches[batchIndex] || [];
  const results = res.results || [];
  state.results.push(...results);
  state.spentMicro += res.spent_micro || 0;
  state.heldMicro += res.held_micro || 0;
  state.creditsUsed += res.credits_used || 0;
  state.creditsHeld += res.credits_held || 0;
  state.rowsDone += results.length || batchRows.length;
  addLedger(res.ledger);

  wireFinish(batchIndex * 5, results);

  $('t-batches').textContent = (batchIndex + 1) + ' / ' + total;
  $('t-batches-sub').textContent = batchIndex + 1 === total ? 'last batch in' : 'in flight';
  $('t-rows').textContent = String(state.rowsDone);
  $('t-rows-sub').textContent = 'of ' + state.rows.length;
  $('t-spend').textContent = formatUsd(state.spentMicro);
  $('t-spend-sub').textContent = formatCredits(state.creditsUsed) + ' credits settled';
  $('t-held').textContent = formatUsd(state.heldMicro);
  $('t-held-sub').textContent = formatCredits(state.creditsHeld) + ' credits held';
  const pct = (batchIndex + 1) / total;
  $('prog-pct').textContent = Math.round(pct * 100) + '%';
  $('prog-text').textContent = 'Batch ' + (batchIndex + 1) + ' of ' + total + ' done';
  setMeter($('prog-meter'), pct);
  renderResults();
  renderCosts();
  $('results').classList.remove('hide');
}

function renderCosts() {
  $('c-max').textContent = state.detail ? 'see run' : formatUsd(state.quoteMicro);
  $('c-max-sub').textContent = state.detail
    ? 'quoted ceilings are kept with each run'
    : 'quoted ceiling for this run';
  $('c-spent').textContent = formatUsd(state.spentMicro);
  $('c-spent-sub').textContent = formatCredits(state.creditsUsed) + ' credits settled';
  $('c-held').textContent = formatUsd(state.heldMicro);
  $('c-held-sub').textContent = formatCredits(state.creditsHeld) + ' credits held';
}

async function startRun() {
  if (state.running || state.quoting || !state.quotes.length || !state.frozen) return;
  if (!state.signedIn) {
    approveErr('Sign in to run.');
    return;
  }
  if (state.usage && usageBox().disabled) {
    approveErr('This account is paused for spending.');
    return;
  }
  approveErr('');
  resetRunViews();
  state.running = true;
  state.cancel = false;
  state.started = true;
  renderRunButton();
  $('quote-btn').disabled = true;
  $('console').classList.remove('hide');
  $('cancel-btn').hidden = false;
  $('cancel-btn').disabled = false;
  $('cancel-btn').textContent = 'Stop after this batch';
  setStatus('Starting. Five rows per request, one fresh request id per batch, no automatic retry.');
  $('console').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });

  const total = state.batches.length;
  let stoppedBy = '';
  for (let i = 0; i < total; i++) {
    if (state.cancel) {
      stoppedBy = 'Stopped between batches at ' + state.rowsDone + ' of ' + state.rows.length + ' rows. Nothing else was sent.';
      break;
    }
    queueWire(i);
    setStatus('Batch ' + (i + 1) + ' of ' + total + ' in flight. Stop takes effect after it returns.');
    const body = {
      tool_id: 'lead-scorer',
      request_id: crypto.randomUUID(),
      list_name: listName(),
      rows: state.batches[i],
      icp: state.frozen.icp,
      enrich: state.frozen.enrich,
      verify_email: state.frozen.verify_email,
      custom: state.frozen.custom,
      max_credits: state.quotes[i].max_credits,
    };
    let res;
    try {
      res = await toolkit.api('run', body);
    } catch (e) {
      stoppedBy = 'Stopped after batch ' + i + ': ' + e.message + ' No automatic retry under a new id. Re-quote if you want to continue.';
      break;
    }
    applyBatch(res, i, total);
    if (res.status && res.status !== 'completed') {
      stoppedBy = 'Batch ' + (i + 1) + ' came back as "' + res.status + '". Held costs stay reserved. No automatic retry.';
      break;
    }
  }
  state.running = false;
  // The approved ceiling is spent for this session: a fresh quote is required
  // before anything else can run, so nobody re-sends rows by muscle memory.
  state.quotes = [];
  state.frozen = null;
  state.started = false;
  $('cancel-btn').hidden = true;
  $('quote-btn').disabled = false;
  $('quote-btn').textContent = 'Get quote';
  renderDocket();
  renderRunButton();
  setStatus(stoppedBy || ('Done. ' + state.rowsDone + ' rows, spent ' + formatUsd(state.spentMicro) +
    ', held ' + formatUsd(state.heldMicro) + '.'));
  approveErr(state.rowsDone > 0 ? 'Run finished. Get a fresh quote to run more rows.' : '');
  if (state.rowsDone > 0) {
    $('results').classList.remove('hide');
  }
  loadUsage().catch(() => {});
}

function cancelRun() {
  if (!state.running) return;
  state.cancel = true;
  const btn = $('cancel-btn');
  btn.disabled = true;
  btn.textContent = 'Stopping';
  setStatus('Stop requested. This batch finishes and nothing further is sent.');
}

function queueWire(batchIndex) {
  if (!$('wire') || !$('wire').isConnected) return;
  (state.batches[batchIndex] || []).forEach((row, k) => {
    const i = batchIndex * 5 + k;
    if (i >= 100) return; // the wire caps at 100 rows, the tiles carry the rest
    if ($('wire').querySelector('[data-i="' + i + '"]')) return;
    wireRow(i, row);
  });
}

// ---------------------------------------------------------------- results

function rubricColumns() {
  const ids = [];
  for (const r of state.results) {
    for (const id of Object.keys(r.custom || {})) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  ids.sort();
  return ids.map((id) => {
    let label = id;
    for (const r of state.results) {
      if (r.custom && r.custom[id] && r.custom[id].column_label) {
        label = r.custom[id].column_label;
        break;
      }
    }
    return { id, label };
  });
}

function visibleResults() {
  const q = $('filter-q').value.trim().toLowerCase();
  const em = $('filter-email').value;
  const fit = $('filter-fit').value;
  return state.results.filter((r) => {
    if (em && (r.email_status || '') !== em) return false;
    if (fit && (r.icp_fit || '') !== fit) return false;
    if (q) {
      const i = r.input || {};
      const hay = [i.name, i.title, i.company, i.email, i.domain].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function emailChipClass(status) {
  if (status === 'deliverable') return 'chip-ok';
  if (status === 'undeliverable') return 'chip-bad';
  if (status === 'risky') return 'chip';
  return 'chip-idle';
}

function fitClass(fit) {
  if (fit === 'Strong fit') return 'fit-strong';
  if (fit === 'Possible fit') return 'fit-possible';
  if (fit === 'Weak fit') return 'fit-weak';
  if (fit === 'Not a fit') return 'fit-none';
  return 'fit-unjudged';
}

function renderResults() {
  const tbl = $('results-table');
  const head = tbl.querySelector('thead tr');
  const body = tbl.querySelector('tbody');
  const rows = visibleResults();
  const rubrics = rubricColumns();

  head.replaceChildren();
  for (const c of ['#', 'Fit', 'Lead', 'Email check']
    .concat(rubrics.map((r) => r.label))
    .concat(['Evidence', 'Notes'])) {
    head.append(el('th', null, c));
  }

  body.replaceChildren();
  if (!state.results.length) {
    const tr = el('tr', 'empty-row');
    const td = el('td');
    td.colSpan = head.children.length;
    td.textContent = 'No scored rows yet. Quote the list and run it.';
    tr.append(td);
    body.append(tr);
  } else if (!rows.length) {
    const tr = el('tr', 'empty-row');
    const td = el('td');
    td.colSpan = head.children.length;
    td.textContent = 'No rows match this filter.';
    tr.append(td);
    body.append(tr);
  } else {
    rows.forEach((r, idx) => {
      const i = r.input || {};
      const tr = el('tr', 'arrive');
      tr.append(el('td', 'num', String(idx + 1)));
      const fitTd = el('td');
      fitTd.append(el('span', fitClass(r.icp_fit), r.icp_fit || 'Unjudged'));
      tr.append(fitTd);
      const lead = el('td');
      lead.append(el('b', null, i.name || 'no name'));
      const sub = el('span', 'sub2', [i.title, i.company].filter(Boolean).join(' at '));
      if (sub.textContent) lead.append(sub);
      if (i.domain || i.email) lead.append(el('span', 'sub3', i.email || i.domain));
      tr.append(lead);

      const mail = el('td');
      mail.append(el('span', 'chip ' + emailChipClass(r.email_status), (r.email_status || 'unknown').replace('_', ' ')));
      if (r.email_reason) mail.append(el('span', 'sub2', r.email_reason));
      const src = [r.email_source, r.email_checked_at ? shortDate(r.email_checked_at) : ''].filter(Boolean).join(' · ');
      if (src) mail.append(el('span', 'sub3', src));
      tr.append(mail);

      for (const rc of rubrics) {
        const td = el('td');
        const c = r.custom && r.custom[rc.id];
        if (c) {
          td.append(document.createTextNode(c.label || ''));
          if (typeof c.index === 'number') td.append(el('span', 'sub3', 'bucket ' + (c.index + 1)));
        } else {
          td.append(el('span', 'sub3', 'not judged'));
        }
        tr.append(td);
      }

      const ev = el('td');
      if (r.evidence && (r.evidence.title || r.evidence.company || r.evidence.source)) {
        ev.append(el('span', null, [r.evidence.title, r.evidence.company].filter(Boolean).join(' · ')));
        const evs = [r.evidence.source, r.evidence.checked_at ? shortDate(r.evidence.checked_at) : ''].filter(Boolean).join(' · ');
        if (evs) ev.append(el('span', 'sub3', evs));
      } else {
        ev.append(el('span', 'sub3', r.enrichment_status || 'not_checked'));
      }
      tr.append(ev);

      tr.append(el('td', null, (r.notes || []).join(' ')));
      body.append(tr);
    });
  }
  $('res-count').innerHTML = '';
  $('res-count').append(el('b', null, String(state.results.length)), document.createTextNode(' processed'));
  const shown = rows.length === state.results.length
    ? 'showing all'
    : 'showing ' + rows.length + ' of ' + state.results.length;
  $('filter-count').textContent = shown;
}

function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().slice(0, 10);
}

function exportCsv() {
  const rows = visibleResults();
  if (!rows.length) {
    $('filter-count').textContent = 'nothing to export';
    return;
  }
  const inCols = [];
  for (const r of rows) {
    for (const k of Object.keys(r.input || {})) {
      if (!inCols.includes(k)) inCols.push(k);
    }
  }
  const rubrics = rubricColumns();
  const outCols = inCols.concat([
    'email_status', 'email_reason', 'email_source', 'email_checked_at',
    'icp_fit', 'enrichment_status',
    'evidence_title', 'evidence_company', 'evidence_source', 'evidence_checked_at',
    'notes',
  ], rubrics.map((r) => r.label));
  const data = rows.map((r) => {
    const o = Object.assign({}, r.input);
    o.email_status = r.email_status || '';
    o.email_reason = r.email_reason || '';
    o.email_source = r.email_source || '';
    o.email_checked_at = r.email_checked_at || '';
    o.icp_fit = r.icp_fit || '';
    o.enrichment_status = r.enrichment_status || '';
    o.evidence_title = (r.evidence && r.evidence.title) || '';
    o.evidence_company = (r.evidence && r.evidence.company) || '';
    o.evidence_source = (r.evidence && r.evidence.source) || '';
    o.evidence_checked_at = (r.evidence && r.evidence.checked_at) || '';
    o.notes = (r.notes || []).join(' ');
    for (const rc of rubrics) {
      const c = r.custom && r.custom[rc.id];
      o[rc.label] = c
        ? (c.label || '') + (typeof c.index === 'number' ? ' (' + (c.index + 1) + ')' : '')
        : 'Unjudged';
    }
    return o;
  });
  const csv = toCsv(outCols, data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (listName().replace(/[^A-Za-z0-9_-]+/g, '-') || 'lead-scorer') + '-scored.csv';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ---------------------------------------------------------------- history

function ageText(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const ms = Date.now() - t;
  if (ms < 60000) return 'just now';
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return Math.floor(ms / 3600000) + 'h ago';
  return d + 'd ago';
}

function renderHistory() {
  const box = $('history-list');
  box.replaceChildren();
  const runs = (state.usage && state.usage.runs) || [];
  $('history-empty').classList.toggle('hide', runs.length > 0);
  for (const run of runs) {
    const row = el('div', 'hrow');
    const main = el('div');
    main.append(el('div', 'h-name', run.list_name || 'unnamed list'));
    main.append(el('div', 'h-id', 'run ' + String(run.id).slice(0, 8) + ' · ' + (run.tool_id || 'lead-scorer')));
    row.append(main);
    const status = el('div', 'h-stat');
    const cls = run.status === 'completed' ? 'chip-ok' : run.status === 'review' ? 'chip-bad' : 'chip-idle';
    status.append(el('span', 'chip ' + cls, run.status || 'unknown'));
    row.append(status);
    const when = el('div', 'h-stat');
    const age = el('span', 'age', ageText(run.created_at));
    const abs = new Date(run.created_at);
    if (!Number.isNaN(abs.getTime())) when.title = abs.toLocaleString();
    if (Date.now() - abs.getTime() > 30 * 86400000) age.classList.add('old');
    when.append(age, document.createTextNode(' · ' + shortDate(run.created_at)));
    row.append(when);
    const stats = el('div', 'h-stat');
    stats.innerHTML = '';
    stats.append(el('b', null, String(run.row_count ?? 0)), document.createTextNode(' rows · '),
      el('b', null, formatCredits(run.credits_used || 0)), document.createTextNode(' credits · '),
      el('b', null, formatUsd(run.spent_micro || 0)));
    row.append(stats);
    const open = el('button', 'btn sec', 'Open');
    open.type = 'button';
    open.addEventListener('click', () => openRun(run.id));
    row.append(open);
    box.append(row);
  }
}

async function openRun(id) {
  let res;
  try {
    res = await toolkit.api('run_detail', { id: id });
  } catch (e) {
    $('history-empty').textContent = 'Could not open that run: ' + e.message;
    $('history-empty').classList.remove('hide');
    return;
  }
  state.results = res.results || [];
  state.detail = true;
  state.spentMicro = res.spent_micro || 0;
  state.heldMicro = res.held_micro || 0;
  state.creditsUsed = res.credits_used || 0;
  state.creditsHeld = res.credits_held || 0;
  state.aggLedger = {};
  state.quotes = [];
  state.frozen = null;
  state.started = false;
  addLedger(res.ledger);
  renderCosts();
  renderResults();
  renderDocket();
  renderRunButton();
  $('results-h').textContent = 'Call sheet · run ' + String(id).slice(0, 8);
  $('results').classList.remove('hide');
  selectTab($('tab-workspace'));
  $('results').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

// ---------------------------------------------------------------- usage + wallet

function renderWallet() {
  const u = state.usage;
  if (!state.signedIn || !u) return;
  const box = usageBox();
  $('wallet').classList.remove('hide');
  $('wallet-credits').textContent = formatCredits(box.credits_available || 0);
  const cap = box.daily_credit_cap || 0;
  setMeter($('wallet-meter'), cap > 0 ? (box.credits_used || 0) / cap : 0);
  $('wallet-sub').textContent = 'held ' + formatCredits(box.credits_held || 0) +
    ' · used ' + formatCredits(box.credits_used || 0) + ' today · ' + (box.rows || 0) + ' rows';
}

function renderUsage() {
  const u = state.usage;
  if (!u) return;
  const usage = u.usage || {};
  $('usage-day').textContent = 'day of ' + (usage.day || 'today');
  $('usage-disabled').classList.toggle('hide', !usage.disabled);
  $('u-available').textContent = formatCredits(usage.credits_available || 0);
  $('u-held').textContent = formatCredits(usage.credits_held || 0);
  $('u-held-sub').textContent = formatUsd(usage.held_micro || 0) + ' unresolved';
  $('u-used').textContent = formatCredits(usage.credits_used || 0);
  $('u-spend').textContent = formatUsd(usage.spent_micro || 0);
  $('u-rows').textContent = String(usage.rows || 0);
  const rowCap = usage.daily_row_cap || 0;
  const creditCap = usage.daily_credit_cap || 0;
  $('u-rows-sub').textContent = rowCap > 0 ? 'of ' + rowCap + ' row cap' : 'no row cap set';
  $('u-credit-cap-text').textContent = creditCap > 0
    ? formatCredits(usage.credits_used || 0) + ' of ' + formatCredits(creditCap)
    : 'no cap set';
  setMeter($('u-credit-meter'), creditCap > 0 ? (usage.credits_used || 0) / creditCap : 0);
  $('u-row-cap-text').textContent = rowCap > 0
    ? (usage.rows || 0) + ' of ' + rowCap
    : 'no cap set';
  setMeter($('u-row-meter'), rowCap > 0 ? (usage.rows || 0) / rowCap : 0);
  $('u-spent-micro').textContent = String(usage.spent_micro || 0);
  $('u-held-micro').textContent = String(usage.held_micro || 0);
  const providers = $('u-providers');
  providers.replaceChildren();
  const p = u.providers || {};
  for (const name of ['treg', 'jev']) {
    providers.append(el('span', 'chip ' + (p[name] ? 'chip-ok' : 'chip-bad'),
      name + (p[name] ? ' ready' : ' offline')));
  }
  renderWallet();
}

async function loadUsage(force) {
  if (!state.signedIn) return null;
  if (state.usage && !force) return state.usage;
  try {
    state.usage = await toolkit.api('usage', {});
  } catch (e) {
    if (!state.usage) {
      $('wallet-sub').textContent = 'usage unavailable: ' + e.message;
    }
    return state.usage;
  }
  renderUsage();
  renderHistory();
  renderRunButton();
  if (state.quotes.length) renderDocket();
  return state.usage;
}

// ---------------------------------------------------------------- auth + tabs

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
    if (!state.userMounted) {
      state.userMounted = toolkit.mountUserButton(slot);
    }
    $('wallet').classList.remove('hide');
    loadUsage(true).then(() => {
      if (state.quotes.length) renderDocket();
    });
  } else {
    hint.classList.remove('hide');
    hint.textContent = 'sign in to quote and run';
    signin.hidden = false;
    slot.replaceChildren();
    state.userMounted = false;
    state.usage = null;
    $('wallet').classList.add('hide');
    $('history-list').replaceChildren();
    $('history-empty').classList.remove('hide');
    state.quotes = [];
    state.frozen = null;
    renderDocket();
    renderRunButton();
    approveErr('');
  }
}

function selectTab(tab) {
  for (const t of document.querySelectorAll('[role=tab]')) {
    const on = t === tab;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    const panel = $(t.getAttribute('aria-controls'));
    if (panel) panel.hidden = !on;
  }
  if (tab.id === 'tab-history' || tab.id === 'tab-usage') {
    loadUsage(true);
  }
}

// ---------------------------------------------------------------- init

function wireEvents() {
  const dz = $('stage-drop');
  dz.addEventListener('click', () => $('file').click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      $('file').click();
    }
  });
  for (const ev of ['dragenter', 'dragover']) {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add('over');
    });
  }
  for (const ev of ['dragleave', 'drop']) {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove('over');
    });
  }
  dz.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    handleFile(f);
  });
  $('file').addEventListener('change', (e) => handleFile(e.target.files[0]));
  $('refile').addEventListener('click', () => {
    $('file').value = '';
    stage('drop');
  });

  $('rubric-add').addEventListener('click', () => {
    if (state.rubrics.length >= 3) return;
    state.rubrics.push({ label: '', type: 'score', instructions: '', criteria: [] });
    renderRubrics();
  });

  for (const id of ['listname', 'sell', 'want', 'enrich', 'verify']) {
    $(id).addEventListener('input', () => {
      updateIcpCount();
      invalidateQuote();
    });
    $(id).addEventListener('change', invalidateQuote);
  }

  $('quote-btn').addEventListener('click', getQuote);
  $('run-btn').addEventListener('click', startRun);
  $('cancel-btn').addEventListener('click', cancelRun);
  $('export-csv').addEventListener('click', exportCsv);
  $('new-list').addEventListener('click', () => {
    if (state.running) return;
    $('file').value = '';
    state.headers = [];
    state.source = [];
    state.rows = [];
    state.mapping = {};
    state.quotes = [];
    state.batches = [];
    state.frozen = null;
    state.quoteMicro = 0;
    state.quoteCredits = 0;
    state.started = false;
    state.results = [];
    state.detail = false;
    $('results').classList.add('hide');
    $('console').classList.add('hide');
    $('quote-btn').textContent = 'Get quote';
    renderDocket();
    renderRunButton();
    approveErr('');
    stage('drop');
  });

  for (const id of ['filter-q', 'filter-email', 'filter-fit']) {
    $(id).addEventListener('input', renderResults);
    $(id).addEventListener('change', renderResults);
  }

  $('signin').addEventListener('click', async () => {
    try {
      await toolkit.startClerk();
      await toolkit.openSignIn();
    } catch (e) {
      $('auth-hint').textContent = e.message;
      $('auth-hint').classList.remove('hide');
    }
  });

  const tabs = Array.from(document.querySelectorAll('[role=tab]'));
  tabs.forEach((t) => t.addEventListener('click', () => selectTab(t)));
  document.querySelector('.tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      tabs[next].focus();
      selectTab(tabs[next]);
    }
  });
}

async function init() {
  wireEvents();
  renderRubrics();
  renderDocket();
  updateIcpCount();
  stage('drop');
  renderResults();

  try {
    state.cfg = await toolkit.loadConfig();
  } catch (e) {
    state.cfg = { configured: false };
    $('setup-text').textContent = 'Config endpoint unreachable: ' + e.message;
  }
  if (!state.cfg.configured) {
    $('setup-banner').classList.remove('hide');
    $('auth-hint').textContent = 'backend not configured';
    approveErr('Quoting and runs are off until the backend is configured.');
    return;
  }
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
