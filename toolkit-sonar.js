// Sonar: browser-owned data, server-owned plans. Vanilla 21st.dev ports listed in docs/sonar-design.md.
import * as session from './toolkit-session.js';
import {profileColumns, validatePlan, runPlan, cleanHeadline, fillHeadline, describePlan, fmt, VIEWS} from './sonar-core.js';
import {validateFileTable, money} from './toolkit-workbench-lib.js';
import {toCsv} from './toolkit-lib.js';

const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
const btn = (text, fn) => { const b = el('button', text, 'sonar-button'); b.type = 'button'; b.addEventListener('click', fn); return b; };
const cost = micro => Number.isFinite(micro) && micro >= 0 ? (micro / 1000).toLocaleString('en-US', {maximumFractionDigits: 3}) + ' credits (' + money(micro) + ')' : 'unavailable';
const plain = s => String(s ?? '').replace(/[\u2013\u2014]/g, ', ');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function sonar(w, {readTable, dropTarget, refreshUsage}) {
  const root = w.body; root.classList.add('sonar');
  let source = null, filename = '', history = [], busy = false, generation = 0, closed = false;
  const timers = new Set(), typers = new WeakMap();
  function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); if (!closed) fn(); }, ms); timers.add(id); return id; }
  function type(node, text, property = 'textContent', mouth = false) {
    clearTimeout(typers.get(node)); node[property] = '';
    let i = 0;
    const tick = () => {
      i = reduced() ? text.length : Math.min(text.length, i + (property === 'placeholder' ? 2 : 3)); node[property] = text.slice(0, i);
      if (mouth) mouthFrame(i < text.length ? 1 + i % 3 : 0);
      if (i < text.length) typers.set(node, later(tick, 24));
    }; tick();
  }
  const head = el('header', undefined, 'sonar-header');
  head.append(el('p', 'SONAR / ASK YOUR FILE', 'sonar-readout'), el('h3', 'Find the signal.', 'sonar-title'));
  const drop = el('div', undefined, 'sonar-drop'), file = el('input'); file.type = 'file'; file.accept = '.csv,.xlsx'; file.id = 'sonar-file';
  const label = el('label', 'Drop a CSV or XLSX, or choose a file'); label.htmlFor = file.id;
  drop.append(label, file, el('p', 'Up to 5 MiB. Read locally. No rows uploaded.', 'sonar-note'));
  const fileHead = el('div', undefined, 'sonar-file-head'), columns = el('div', undefined, 'sonar-columns');
  const ask = el('form', undefined, 'sonar-ask'), q = el('input'); q.id = 'sonar-question'; q.maxLength = 2000; q.required = true; q.disabled = true;
  const qLabel = el('label', 'Ask the file'); qLabel.htmlFor = q.id;
  const ping = btn('Ping', () => {}); ping.type = 'submit'; ping.disabled = true;
  const askRow = el('div', undefined, 'sonar-ask-row'); askRow.append(q, ping); ask.append(qLabel, askRow);
  const starters = el('div', undefined, 'sonar-suggestions'); starters.setAttribute('aria-label', 'Starter questions');
  const terminal = el('div', undefined, 'sonar-terminal sonar-brackets'); terminal.hidden = true;
  const lines = el('div'), caret = el('span', '▌', 'sonar-caret'); caret.setAttribute('aria-hidden', 'true'); terminal.append(lines, caret);
  const answer = el('section', undefined, 'sonar-answer sonar-brackets'); answer.hidden = true; answer.setAttribute('aria-label', 'Answer');
  const bubble = el('p', undefined, 'sonar-bubble'); bubble.setAttribute('role', 'status');
  const view = el('div', undefined, 'sonar-view'), readout = el('p', undefined, 'sonar-plan'), follow = el('div', undefined, 'sonar-suggestions');
  follow.setAttribute('aria-label', 'Follow-up questions'); answer.append(bubble, view, readout, follow);
  const msg = el('p', '', 'sonar-message'); msg.setAttribute('role', 'status');
  const hostRow = el('div', undefined, 'sonar-host-row'), host = el('div', undefined, 'sonar-host'), sprite = el('div', undefined, 'sonar-sprite'); host.setAttribute('aria-hidden', 'true'); host.append(sprite);
  const layers = {};
  for (const name of ['body_neutral', 'body_thinking', 'body_happy', 'body_serious', 'eyes_closed', 'mouth_1', 'mouth_2', 'mouth_3']) {
    const image = el('img'); image.src = '/brand/sonar-host/' + name + '.png'; image.alt = ''; image.width = 555; image.height = 989; image.hidden = true; layers[name] = image; sprite.append(image);
  }
  let pose = 'neutral';
  function face(next) { pose = next; host.dataset.pose = next; for (const name of ['neutral', 'thinking', 'happy', 'serious']) layers['body_' + name].hidden = name !== next; layers.eyes_closed.hidden = true; }
  function mouthFrame(n) { for (let i = 1; i <= 3; i++) layers['mouth_' + i].hidden = i !== n; }
  function blink() { if (reduced() || closed) return; later(() => { if (!reduced() && pose !== 'happy') layers.eyes_closed.hidden = false; later(() => { layers.eyes_closed.hidden = true; blink(); }, 120); }, 2600 + Math.random() * 2600); }
  face('neutral'); blink();
  hostRow.append(el('p', 'The model plans. Your browser counts.\nThat\'s the deep end.', 'sonar-note'), host);
  const content = el('div', undefined, 'sonar-content');
  content.append(head, drop, fileHead, columns, ask, el('p', 'A question sends column names, types and short samples. Your rows stay here.', 'sonar-note'), starters, terminal, msg, answer);
  root.append(content, hostRow);
  type(q, 'ask the file anything, e.g. which country has the most companies?', 'placeholder', true);
  const prior = w.cleanup; w.cleanup = () => { closed = true; generation++; timers.forEach(clearTimeout); prior?.(); source = null; history = []; };
  function controls() { q.disabled = !source || busy; ping.disabled = !source || busy; file.disabled = busy; root.querySelectorAll('.sonar-suggestions button').forEach(b => { b.disabled = busy; }); }
  function chips(node, texts) { node.replaceChildren(...texts.map(text => btn(plain(text), () => send(text)))); }
  function log(text) { const line = el('p'); lines.append(line); type(line, '> ' + text); }
  async function load(value, name) {
    if (busy || closed || !value) return;
    const version = ++generation; busy = true; controls(); fileHead.dataset.live = 'true'; fileHead.textContent = 'PARSING FILE'; msg.textContent = '';
    try {
      // Workbench validates a bounded copy and keeps originals. Sonar also computes over those originals locally.
      const parsed = Array.isArray(value) ? {...validateFileTable({rows: value.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 1000) : v])))}), originals: value} : await readTable(value, true);
      const next = {headers: parsed.headers, rows: parsed.originals || parsed.rows};
      if (closed || version !== generation) return;
      const profile = profileColumns(next.headers, next.rows);
      source = {...next, profile}; filename = name || value.name || 'results.csv'; history = [];
      fileHead.replaceChildren(el('strong', filename), el('p', `${fmt(next.rows.length)} rows x ${fmt(next.headers.length)} columns`, 'sonar-readout'));
      columns.replaceChildren(...profile.map(c => el('span', `${{number: '#', date: '◷', text: 'Aa'}[c.type]} ${c.name}`, 'sonar-column')));
      const text = profile.find(c => c.type === 'text' && c.distinct >= 2 && c.distinct <= 12), number = profile.find(c => c.type === 'number'), first = profile.find(c => c.type === 'text' && c.samples.length);
      chips(starters, [text && `How many rows by ${text.name}?`, text && number && `Average ${number.name} by ${text.name}`, first && `Show rows where ${first.name} is ${first.samples[0]}`].filter(Boolean));
      drop.classList.add('sonar-loaded'); answer.hidden = terminal.hidden = true; q.value = ''; face('neutral');
    } catch (e) { msg.textContent = plain(e.message); if (source) fileHead.textContent = filename + ' remains loaded'; else fileHead.textContent = ''; }
    finally { busy = false; delete fileHead.dataset.live; controls(); }
  }
  w.load = load; file.addEventListener('change', () => load(file.files[0])); dropTarget(root, load, 'sonar');
  ask.addEventListener('submit', e => { e.preventDefault(); send(q.value); });
  async function send(question) {
    question = String(question || '').trim(); if (!source || busy || closed || !question) return;
    if (question.length > 2000) { msg.textContent = 'Keep the question under 2,000 characters.'; return; }
    if (!session.authState().signedIn) { msg.textContent = 'Sign in to ask Sonar. Your file stays in this browser.'; return; }
    busy = true; controls(); face('thinking'); q.value = question; msg.textContent = 'Asking Sonar...';
    terminal.hidden = false; terminal.dataset.live = 'true'; lines.replaceChildren(); answer.hidden = true;
    log(`profiling ${fmt(source.headers.length)} columns`); log('asking sonar'); terminal.scrollIntoView({block: 'nearest', behavior: 'instant'});
    const version = generation;
    try {
      const reply = await session.api('sonar', {file: {name: filename, rows_total: source.rows.length, headers: source.headers, profile: source.profile}, question, history: history.slice(-6)});
      if (closed || version !== generation) return;
      history.push({role: 'user', content: question}, {role: 'assistant', content: JSON.stringify(reply)}); history = history.slice(-6);
      answer.hidden = false; view.replaceChildren(); delete view.dataset.view; readout.textContent = 'Question cost: ' + cost(reply.cost_micro);
      const plan = reply.plan;
      if (!plan || !Object.hasOwn(VIEWS, plan.view) || validatePlan(plan, source.headers)) {
        face('serious'); type(bubble, plain(reply.question || 'Which column should I use? Please rephrase the question.'), 'textContent', true);
        msg.textContent = 'No plan was run.';
      } else {
        log('plan received: ' + plan.view); log(`running over ${fmt(source.rows.length)} rows in your browser`);
        // Bound preview only, never imply that it is the full matching export.
        const displayPlan = plan.view === 'list' ? {...plan, limit: Math.min(plan.limit || 20, 20)} : plan.view === 'compare' ? {...plan, limit: Math.min(plan.limit || 4, 4)} : plan;
        const result = runPlan(source.rows, displayPlan);
        renderView(displayPlan, result); face('happy');
        const headline = cleanHeadline(reply.headline);
        type(bubble, plain(headline ? fillHeadline(headline, result) : describePlan(displayPlan, result)), 'textContent', true);
        readout.textContent = plain(describePlan(displayPlan, result)) + ' / Question cost: ' + cost(reply.cost_micro);
        msg.textContent = 'Answer computed in your browser.';
      }
      chips(follow, (Array.isArray(reply.follow_ups) ? reply.follow_ups : []).filter(s => typeof s === 'string').slice(0, 3));
      refreshUsage().catch(() => {});
    } catch (e) {
      if (closed || version !== generation) return;
      face('serious'); msg.textContent = e.message === 'provider_not_configured' ? 'Setup needed. Sonar\'s AI provider is not configured. Your file is still here.' : plain(e.data?.message || e.message || 'Sonar did not answer. Try again.');
    } finally {
      if (!closed && version === generation) { busy = false; delete terminal.dataset.live; controls(); (answer.hidden ? msg : answer).scrollIntoView({block: 'start', behavior: 'instant'}); q.focus({preventScroll: true}); }
    }
  }
  function renderView(plan, result) {
    view.dataset.view = plan.view;
    if (!result.matched) { view.append(el('p', 'No rows match. Try a broader question.')); return; }
    if (plan.view === 'number') {
      const n = el('div', fmt(result.value), 'sonar-number'); n.setAttribute('aria-label', fmt(result.value)); view.append(n, el('p', `${fmt(result.matched)} of ${fmt(result.total)} rows`, 'sonar-note'));
      // Count Up 20068: critically damped spring, final-value reduced-motion path.
      if (!reduced() && Number.isFinite(result.value)) { const start = performance.now(); const tick = () => { if (!n.isConnected) return; const t = (performance.now() - start) / 1000, p = 1 - (1 + 12 * t) * Math.exp(-12 * t); n.textContent = t >= 1 ? fmt(result.value) : fmt(Number.isInteger(result.value) ? Math.round(result.value * p) : result.value * p); if (t < 1 && !reduced()) later(tick, 16); else n.textContent = fmt(result.value); }; later(tick, 16); }
      return;
    }
    if (plan.view === 'list') {
      const scroll = el('div', undefined, 'sonar-table-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Matching rows. Scroll horizontally for all columns');
      const table = el('table'), thead = el('thead'), tr = el('tr'), tbody = el('tbody');
      for (const c of result.columns) { const th = el('th', c); th.scope = 'col'; tr.append(th); } thead.append(tr);
      for (const row of result.rows) { const tr = el('tr'); for (const c of result.columns) tr.append(el('td', String(row[c] ?? ''))); tbody.append(tr); }
      table.append(thead, tbody); scroll.append(table); view.append(scroll, btn(`Download CSV: first ${fmt(result.rows.length)} matching rows`, () => {
        const url = URL.createObjectURL(new Blob([toCsv(result.columns, result.rows)], {type: 'text/csv;charset=utf-8'})), a = el('a'); a.href = url; a.download = filename.replace(/\.(csv|xlsx)$/i, '') + ' sonar preview.csv'; a.click(); later(() => URL.revokeObjectURL(url), 1000);
      })); return;
    }
    const groups = result.groups;
    if (!groups.length) { view.append(el('p', 'No groups to show.')); return; }
    if (plan.view === 'compare') {
      const grid = el('div', undefined, 'sonar-compare'); for (const g of groups) { const tile = el('div', undefined, 'sonar-stat'); tile.append(el('p', g.key), el('strong', fmt(g.value)), el('small', `${fmt(g.count)} rows`)); grid.append(tile); } view.append(grid); return;
    }
    if (plan.view === 'share') {
      const sum = groups.reduce((s, g) => s + (g.value || 0), 0), valid = sum > 0 && groups.every(g => g.value !== null && g.value >= 0);
      const bar = el('div', undefined, 'sonar-share'), legend = el('ul', undefined, 'sonar-legend'); bar.setAttribute('aria-hidden', 'true');
      groups.forEach((g, i) => { const segment = el('span', undefined, 'sonar-segment sonar-tone-' + (i ? 1 + (i - 1) % 5 : 0)); segment.dataset.other = String(!!g.other); segment.style.flexGrow = String(valid ? g.value : 0); bar.append(segment); const li = el('li'); li.append(el('span', g.key), el('span', fmt(g.value)), el('span', valid ? fmt(g.value / sum * 100) + '%' : 'n/a')); legend.append(li); });
      if (valid) view.append(bar); else view.append(el('p', 'Shares need nonnegative values and a positive total. Values are listed below.'));
      view.append(legend); return;
    }
    if (plan.view === 'trend') { trend(groups, plan); return; }
    // Rank Bars 29452: zero baseline also supports negative measures without hiding their sign.
    const min = Math.min(0, ...groups.map(g => g.value || 0)), max = Math.max(0, ...groups.map(g => g.value || 0)), span = max - min || 1;
    const list = el('ol', undefined, 'sonar-ranks');
    groups.forEach(g => { const row = el('li', undefined, 'sonar-rank'), track = el('div', undefined, 'sonar-track'), bar = el('span', undefined, 'sonar-bar'); const v = g.value || 0;
      track.style.setProperty('--zero', (-min / span * 100) + '%'); bar.style.width = Math.abs(v) / span * 100 + '%'; bar.style.left = ((Math.min(v, 0) - min) / span * 100) + '%'; track.append(bar); row.append(el('span', g.key), track, el('strong', fmt(g.value))); list.append(row); }); view.append(list);
  }
  function trend(groups, plan) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.classList.add('sonar-trend'); svg.setAttribute('viewBox', '0 0 300 170'); svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', 'Trend by ' + plan.group_by);
    const min = Math.min(0, ...groups.map(g => g.value || 0)), max = Math.max(0, ...groups.map(g => g.value || 0)), range = max - min || 1, y = v => 128 - (v - min) / range * 112, slot = 276 / groups.length;
    const tip = el('p', 'Focus or point at a column for its value.', 'sonar-tooltip'); tip.setAttribute('role', 'status');
    const make = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
    svg.append(make('line', {x1: 12, x2: 288, y1: y(0), y2: y(0), class: 'sonar-axis'}));
    groups.forEach((g, i) => {
      const group = make('g', {tabindex: 0, role: 'img', 'aria-label': `${g.key}: ${fmt(g.value)}`, class: 'sonar-trend-point'}), x = 12 + i * slot;
      group.append(make('rect', {x, y: 8, width: slot, height: 128, class: 'sonar-hit'}), make('rect', {x: x + slot * .12, y: Math.min(y(g.value || 0), y(0)), width: slot * .76, height: Math.abs(y(g.value || 0) - y(0)), class: 'sonar-column-bar'}));
      const show = () => { tip.textContent = `${g.key}: ${fmt(g.value)} / ${fmt(g.count)} rows`; }; group.addEventListener('pointerenter', show); group.addEventListener('focus', show); svg.append(group);
      if (i % Math.ceil(groups.length / 3) === 0) { const label = make('text', {x: x + slot / 2, y: 154, 'text-anchor': 'middle'}); label.textContent = g.key.length > 11 ? g.key.slice(0, 10) + '…' : g.key; svg.append(label); }
    });
    // Narrow chart columns get a full-size touch equivalent.
    const picker = el('select'), label = el('label', 'Inspect a column'); picker.id = 'sonar-trend-choice'; label.htmlFor = picker.id;
    groups.forEach((g, i) => { const option = el('option', `${g.key}: ${fmt(g.value)}`); option.value = String(i); picker.append(option); });
    const inspect = () => { const g = groups[Number(picker.value)]; tip.textContent = `${g.key}: ${fmt(g.value)} / ${fmt(g.count)} rows`; };
    picker.addEventListener('change', inspect); picker.addEventListener('focus', inspect);
    view.append(el('p', `${plan.group_by} / ${plan.measure?.fn || 'count'}${plan.measure?.column ? ' of ' + plan.measure.column : ''}`, 'sonar-note'), svg, label, picker, tip);
  }
}
