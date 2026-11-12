// toolkit-guide.js : Deepbot, the toolkit's front door (docs/toolkit-v4-api.md sections 8 to 10).
// The pixel Deep mascot in the bottom right corner opens a panel with threads, a composer and assistant turns as cards:
// text, steps (Show me / Do it through toolkit-pointer.js), staged (the one Lamp Approve), ask, quote (never runs), catalog.
// On phones the panel is a bottom sheet with a handle (60 and 100 percent) that rides above the keyboard.
// Shell ported from 21st.dev 27159 "Ask AI" (AdiKodez). Card list after 21st.dev 31661 "Message Thread" and 43126
// "Tool Call Card" (one line per card head, mono status), chips after 12342 "Suggestions", sheet after 31360 "Drawer"
// (wensity: handle, snap points). Vanilla ports on the site tokens: the toolkit ships no React and no Tailwind.
// Model and agent text only ever lands in text nodes.
import * as session from './toolkit-session.js';
import * as pointer from './toolkit-pointer.js';

const SPRITE = '#mare-'; // symbols from /brand/pixel-mare.svg, inlined below so the first open never paints an empty tile
const STAGES = ['file', 'columns', 'ask', 'quote', 'run', 'report'];
const MAX_Q = 2000;
// Signed out: static answers, only from facts the toolkit states elsewhere. No call, no credits.
const TIPS = [
  ['What are the stages?', 'Six stages: File, Columns, Ask, Quote, Run, Report. Nothing runs before you approve the quote.'],
  ['Where does my file go?', 'Your file is read in your browser. Only the columns you map go to the server, and only after you approve a quote.'],
  ['How big can my file be?', 'Up to 5 MiB, 20,000 rows and 200 columns.'],
  ['What does a credit cost?', '1 credit is $0.001. The quote reserves the maximum, and the run settles at the actual cost.'],
];
const CATALOG_ASK = 'what can you do'; // the server answers this from the catalog: no model call, no charge, nothing stored
const ERR = {
  offline: 'Deepbot is offline right now. Setup needed: the AI provider is not configured.',
  spent: 'Your AI allowance for today is used up. Tips and the catalog are still free.',
  missed: 'That one did not land. Try again or rephrase.',
  full: 'This thread is too long for one more turn. Start a new thread.',
  gone: 'That thread is not there any more. Start a new one.',
};
const KIND = {run: 'Run', files_move: 'Move', connector_act: 'Connector', agent_call: 'Your agent'};
const PROVIDER = {harbinger: 'ChampHarbinger', beam: 'ChampBeam'};

const signinPage = document.body.classList.contains('signin-page');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const phone = () => innerWidth <= 768;
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function btn(text, fn, cls = 'btn btn-outline') { const b = el('button', text, cls); b.type = 'button'; b.addEventListener('click', fn); return b; }
function svgUse(frame) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('shape-rendering', 'crispEdges');
  use.setAttribute('href', SPRITE + frame); svg.append(use); return svg;
}
function ago(iso) { const s = (Date.now() - Date.parse(iso)) / 1000; if (!Number.isFinite(s)) return ''; const m = Math.floor(s / 60), h = Math.floor(m / 60), d = Math.floor(h / 24); return s < 60 ? 'just now' : m < 60 ? m + ' min ago' : h < 24 ? h + ' h ago' : d === 1 ? '1 day ago' : d + ' days ago'; }
function credits(micro) { const n = Math.ceil((Number(micro) || 0) / 1000); return n + (n === 1 ? ' credit' : ' credits'); }

// ---- DOM ----
const launcher = el('button', undefined, 'tg-launcher'); launcher.type = 'button';
launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'tg-panel'); launcher.setAttribute('aria-label', 'Deepbot');
const badge = el('img'); badge.src = '/brand/pixel-mare-badge.svg'; badge.alt = ''; badge.width = badge.height = 48; launcher.append(badge);

const panel = el('aside', undefined, 'tg-panel'); panel.id = 'tg-panel'; panel.hidden = true; panel.dataset.snap = 'half';
panel.setAttribute('role', 'complementary'); panel.setAttribute('aria-label', 'Deepbot');
const handle = btn('', () => snap(panel.dataset.snap === 'full' ? 'half' : 'full'), 'tg-handle'); handle.setAttribute('aria-label', 'Make Deepbot taller');
const head = el('header', undefined, 'tg-head');
const stageBox = el('div', undefined, 'tg-mascot'); const mascot = svgUse('idle'); stageBox.append(mascot);
const headText = el('div', undefined, 'tg-head-text');
const status = el('p', '', 'tg-status'); status.setAttribute('role', 'status');
headText.append(el('p', 'Deepbot', 'tg-eyebrow'), el('h2', 'Ask, or have it done', 'tg-title'), status);
const tools = el('div', undefined, 'tg-tools');
const threadsBtn = btn('Threads', () => view === 'threads' ? showChat() : showThreads(), 'tg-tool'); threadsBtn.setAttribute('aria-pressed', 'false');
const newBtn = btn('New', () => newThread(), 'tg-tool'); newBtn.setAttribute('aria-label', 'New thread');
const close = btn('×', () => toggle(false), 'tg-close'); close.setAttribute('aria-label', 'Close Deepbot');
tools.append(threadsBtn, newBtn, close);
head.append(stageBox, headText, tools);
const log = el('div', undefined, 'tg-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-label', 'Deepbot conversation');
const threadList = el('div', undefined, 'tg-threads'); threadList.hidden = true;
const scroller = el('div', undefined, 'tg-body'); scroller.append(log, threadList);
const foot = el('div', undefined, 'tg-foot');
panel.append(handle, head, scroller, foot);

const form = el('form', undefined, 'tg-form');
const qLabel = el('label', 'Message Deepbot', 'tg-label'); qLabel.htmlFor = 'tg-q';
const q = el('textarea'); q.id = 'tg-q'; q.rows = 2; q.maxLength = MAX_Q; q.placeholder = 'Connect my Harbinger';
q.setAttribute('enterkeyhint', 'send');
const send = el('button', 'Send', 'btn btn-outline tg-send'); send.type = 'submit';
const row = el('div', undefined, 'tg-form-row'); row.append(el('span', 'Deepbot stages. You approve.', 'tg-count'), send);
form.append(qLabel, q, row);
const signIn = el('a', 'Sign in to talk to Deepbot', 'btn btn-gold tg-signin'); signIn.href = signinPage ? '#toolkit-signin-root' : '/sign-in';
signIn.addEventListener('click', () => { if (signinPage) { toggle(false, false); document.querySelector('#toolkit-signin-root input, #toolkit-signin-root')?.focus?.(); } });

document.body.append(launcher, panel);
fetch('/brand/pixel-mare.svg').then(r => r.ok ? r.text() : '').then(t => {
  const box = el('div'); box.hidden = true; box.setAttribute('aria-hidden', 'true'); box.innerHTML = t; document.body.append(box);
}).catch(() => {});

// ---- mascot: idle is ready, think is in flight (no blinking), point while steps run ----
let face = 'idle', blinkTimer = 0;
function setFace(f) {
  face = f; panel.dataset.face = f; mascot.firstChild.setAttribute('href', SPRITE + f);
  clearTimeout(blinkTimer); if (f === 'idle' && !panel.hidden && !reduce.matches) blinkTimer = setTimeout(blink, 3200 + Math.random() * 2400);
}
function blink() {
  if (face !== 'idle' || panel.hidden) return;
  mascot.firstChild.setAttribute('href', SPRITE + 'blink');
  setTimeout(() => { if (face === 'idle') setFace('idle'); }, 140);
}

// ---- where the user is: sent as context with every turn ----
function workbench() { return document.querySelector('.window[data-app="workbench"]:not([hidden])'); }
function currentStage() {
  if (signinPage) return 'sign_in';
  const sec = workbench()?.querySelector('section.stage[data-stage]:not([hidden])');
  if (sec && STAGES.includes(sec.dataset.stage)) return sec.dataset.stage;
  return document.querySelector('.window[data-app="account"][data-focused="true"]:not([hidden])') ? 'account' : 'gallery';
}
const currentWindow = () => document.querySelector('.window[data-focused="true"]:not([hidden])')?.dataset.app?.slice(0, 40);

// ---- views ----
let view = 'chat', threadId = null, busy = false, catalog = null;
const live = () => !signinPage && session.authState().signedIn;
function showChat() { view = 'chat'; log.hidden = false; threadList.hidden = true; threadsBtn.setAttribute('aria-pressed', 'false'); foot.hidden = false; }
function reveal(node, who) { scroller.scrollTop = who === 'user' ? scroller.scrollHeight : scroller.scrollTop + node.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12; }
function bubble(text, who, meta) {
  const m = el('div', undefined, 'tg-msg tg-' + who); m.append(el('p', text, 'tg-text'));
  if (meta) m.append(el('p', meta, 'tg-meta'));
  log.append(m); reveal(m, who); return m;
}
const card = (kind, eyebrow) => { const c = el('section', undefined, 'tg-card'); c.dataset.kind = kind; c.setAttribute('aria-label', eyebrow); c.append(el('p', eyebrow, 'tg-card-head')); return c; };

async function showThreads() {
  pointer.stop(); view = 'threads'; log.hidden = true; threadList.hidden = false; threadsBtn.setAttribute('aria-pressed', 'true'); foot.hidden = true;
  threadList.replaceChildren(el('p', 'Loading your threads...', 'tg-empty'));
  try {
    const r = await session.api('deepbot_threads', {});
    if (view !== 'threads') return;
    const ul = el('ul', undefined, 'tg-thread-list'); ul.setAttribute('aria-label', 'Your threads, newest first');
    for (const t of r.threads || []) {
      const li = el('li'), b = btn('', () => openThread(t.id), 'tg-thread'); b.dataset.thread = t.id;
      if (t.id === threadId) b.setAttribute('aria-current', 'true');
      b.append(el('span', t.title || 'Untitled thread', 'tg-thread-title'), el('span', ago(t.last_ts || t.created_at), 'tg-thread-age')); li.append(b); ul.append(li);
    }
    threadList.replaceChildren(r.threads?.length ? ul : el('p', 'No threads yet. Your first message starts one.', 'tg-empty'), btn('New thread', () => newThread(), 'btn btn-outline tg-new'));
  } catch (e) {
    if (view !== 'threads') return;
    const n = el('p', 'Your threads did not load. ' + (e.data?.message || ''), 'tg-empty tg-bad'); n.setAttribute('role', 'alert');
    threadList.replaceChildren(n, btn('Try again', showThreads), btn('Back to the chat', showChat, 'btn btn-text'));
  }
}
async function openThread(id) {
  pointer.stop(); showChat(); threadId = id; log.replaceChildren(); status.textContent = 'Loading the thread.';
  try {
    const r = await session.api('deepbot_thread', {thread_id: id});
    for (const t of r.turns || []) { if (t.role === 'user') bubble(String(t.content.text || ''), 'user'); else assistant(t.content, ago(t.ts)); }
    status.textContent = 'Ready.'; scroller.scrollTop = scroller.scrollHeight;
  } catch (e) { threadId = null; bubble(e.status === 404 ? ERR.gone : ERR.missed, 'bot tg-error'); status.textContent = 'Ready.'; }
  keepFocus();
}
function newThread() {
  pointer.stop(); showChat(); threadId = null; log.replaceChildren();
  if (!live()) { bubble('These tips are free and need no account. Sign in to talk to Deepbot.', 'bot'); tipsCard(); return; }
  bubble('Ask how to do something, or ask me to do it. I point at it on the page, or do it while you watch. Anything that spends or sends waits for you.', 'bot');
  catalogCard();
}

// ---- cards ----
function tipsCard() {
  const c = card('tips', 'Free tips'), chips = el('div', undefined, 'tg-chips');
  for (const [label, answer] of TIPS) chips.append(btn(label, () => { bubble(label, 'user'); bubble(answer, 'bot', 'Tip / no credits used'); }, 'tg-chip'));
  c.append(chips); log.append(c);
}
// "What can I do here": the server's free catalog, fetched once a session. No model call.
async function catalogCard() {
  const c = card('catalog', 'What you can do here'), wait = el('p', 'Checking what is on this desktop...', 'tg-empty'); c.append(wait); log.append(c);
  try { if (!catalog) catalog = (await session.api('deepbot', {message: CATALOG_ASK})).cards.find(x => x.kind === 'catalog')?.data; }
  catch { /* falls through to the tips */ }
  wait.remove();
  if (!catalog) { c.append(el('p', 'The catalog did not load. These tips are free.', 'tg-empty')); tipsCard(); return; }
  const chips = el('div', undefined, 'tg-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Apps on this desktop');
  for (const a of catalog.apps || []) chips.append(btn(a.label, () => { bubble('What is ' + a.label + '?', 'user'); const m = bubble(a.does, 'bot', 'From the catalog / no credits used'); m.after(stepsCard([{op: 'open', target: a.id, say: 'This opens ' + a.label + '.'}])); }, 'tg-chip'));
  c.append(chips);
  const conns = catalog.connectors || [];
  if (conns.length) {
    const cc = el('div', undefined, 'tg-chips'); cc.setAttribute('role', 'group'); cc.setAttribute('aria-label', 'Your work tools');
    for (const k of conns) cc.append(btn((k.status === 'connected' ? 'Use ' : 'Connect ') + k.label, () => ask(k.status === 'connected' ? `What can you pull from my ${k.label}?` : `Connect my ${k.label}`), 'tg-chip'));
    c.append(el('p', 'Your work tools', 'tg-card-sub'), cc);
  }
  if (catalog.limits) c.append(el('p', catalog.limits, 'tg-fine'));
}
// steps: a page_steps plan the page can play two ways. The step log is mono, one line per step.
function stepsCard(steps) {
  const c = card('steps', steps.length + (steps.length === 1 ? ' step on this page' : ' steps on this page'));
  const ol = el('ol', undefined, 'tg-steps');
  steps.forEach((s, i) => { const li = el('li'); li.dataset.state = 'todo'; li.append(el('span', String(i + 1).padStart(2, '0') + ' ' + s.op + (s.target ? ' ' + s.target : ''), 'tg-step-op'), el('span', s.say || '', 'tg-step-say')); ol.append(li); });
  const acts = el('div', undefined, 'tg-card-acts'), note = el('p', '', 'tg-fine'); note.setAttribute('aria-live', 'polite');
  const play = mode => async () => {
    acts.querySelectorAll('button').forEach(b => { b.disabled = true; }); c.dataset.running = mode; setFace('point');
    const tuck = !panel.hidden; if (tuck) toggle(false, false); // get out of the way of the page it points at
    note.textContent = mode === 'do' ? 'Doing it. Press Stop or Escape to stop.' : 'Pointing. Press Next as you go.';
    const r = await pointer.run(steps, {mode, onStep: i => ol.querySelectorAll('li').forEach((li, k) => { li.dataset.state = k < i ? 'done' : k === i ? 'now' : 'todo'; })});
    ol.querySelectorAll('li').forEach((li, k) => { li.dataset.state = r.status === 'done' || k < r.index ? 'done' : k === r.index ? (r.status === 'refused' ? 'refused' : 'stopped') : 'todo'; });
    note.textContent = r.status === 'done' ? 'Done.' : r.status === 'refused' ? `Step ${r.index + 1}: ${pointer.REFUSED} Nothing was done for that step.` : `Stopped at step ${r.index + 1}.`;
    delete c.dataset.running; acts.querySelectorAll('button').forEach(b => { b.disabled = false; }); setFace('idle');
    if (tuck && (!phone() || r.status !== 'done')) toggle(true, false); // on a phone a finished run leaves the window in view
  };
  const show = btn('Show me', play('show')); show.dataset.mode = 'show';
  const doIt = btn('Do it', play('do')); doIt.dataset.mode = 'do';
  acts.append(show, doIt); c.append(ol, acts, note); return c;
}
const kv = pairs => { const dl = el('dl', undefined, 'tg-kv'); for (const [k, v] of pairs) { const x = el('div'); x.append(el('dt', k), el('dd', String(v ?? ''))); dl.append(x); } return dl; };
function quoteCard(d) {
  const c = card('quote', 'Quote / a price, not a run');
  c.append(kv([['Rows', d.row_count], ['Up to', Number.isFinite(Number(d.max_credits)) ? Number(d.max_credits).toLocaleString('en-US') + ' credits' : 'not known'], ['Operations', Array.isArray(d.plan) ? d.plan.length : '']]),
    el('p', d.can_run === false ? (d.message || 'This quote cannot run as it is.') : 'Nothing runs from here. Review it in Data Workbench and press Run there.', d.can_run === false ? 'tg-fine tg-bad' : 'tg-fine'));
  return c;
}
function planCard(d) {
  const c = card('plan', 'Plan');
  const mapped = Array.isArray(d.mapping) ? d.mapping.filter(m => m.keep !== false).length : 0, ops = Array.isArray(d.plan) ? d.plan : [];
  c.append(el('p', `${mapped} column${mapped === 1 ? '' : 's'} mapped, ${ops.length} operation${ops.length === 1 ? '' : 's'} planned.`, 'tg-fine'));
  if (ops.length) { const ul = el('ul', undefined, 'tg-steps'); for (const o of ops.slice(0, 8)) ul.append(el('li', String(o.op || o.type || o.kind || 'operation') + (o.column ? ' ' + o.column : ''), 'tg-step-op')); c.append(ul); }
  return c;
}
function reportCard(d) { const c = card('report', 'Report'); c.append(kv([['Rows', d.rows], ['Chunks', d.chunks], ['Credits used', d.credits_used]])); return c; }
// staged: what it will do, Approve (the one Lamp fill) and Reject. A staged run is approved where it runs, in Approvals.
function stagedCard(d) {
  const id = d.staged_id || d.id, kind = d.kind || 'connector_act';
  const c = card('staged', 'Waiting for you / ' + (KIND[kind] || kind)); c.dataset.staged = id;
  const title = el('h3', d.title || `${PROVIDER[d.provider] || d.provider} ${String(d.op || '').replace(/_/g, ' ')}`, 'tg-card-title'); c.append(title);
  const pv = d.preview && typeof d.preview === 'object' ? d.preview : null;
  if (pv) { c.append(kv(Object.entries(pv).filter(([k, v]) => k !== 'note' && typeof v !== 'object').slice(0, 6).map(([k, v]) => [k.replace(/_/g, ' '), v]))); if (pv.note) c.append(el('p', pv.note, 'tg-fine')); }
  c.append(el('p', 'Nothing has happened yet. It waits until you approve it.', 'tg-fine'));
  const acts = el('div', undefined, 'tg-card-acts'), m = el('p', '', 'tg-fine'); m.setAttribute('aria-live', 'polite');
  const link = el('a', 'Open in Approvals', 'btn btn-text'); link.href = '#approvals/' + encodeURIComponent(id);
  if (kind === 'run') { link.textContent = 'Review and run in Approvals'; link.className = 'btn btn-outline'; acts.append(link); }
  else {
    const decide = decision => async () => {
      acts.querySelectorAll('button').forEach(b => { b.disabled = true; }); m.textContent = decision === 'approve' ? 'Approving...' : 'Rejecting...';
      try {
        const r = await session.api('staged_decide', {id, decision});
        c.dataset.state = r.item?.status || decision; m.textContent = r.item?.status === 'approved' ? 'Approved.' : r.item?.status === 'rejected' ? 'Rejected. Nothing was done.' : 'Status: ' + (r.item?.status || 'unknown') + '.';
        acts.querySelectorAll('button').forEach(b => b.remove());
      } catch (e) {
        const s = e.data?.status || e.data?.item?.status;
        m.textContent = e.status === 409 ? `Already decided${s ? ': ' + s : ''}.` : e.status === 410 ? 'This expired. Ask Deepbot to stage it again.' : (e.data?.message || 'That did not go through. Try again.');
        if (e.status === 409 || e.status === 410) acts.querySelectorAll('button').forEach(b => b.remove()); else acts.querySelectorAll('button').forEach(b => { b.disabled = false; });
      }
      dispatchEvent(new Event('dh:staged'));
    };
    const ok = btn('Approve', decide('approve'), 'btn btn-gold'), no = btn('Reject', decide('reject'));
    ok.setAttribute('aria-label', 'Approve: ' + title.textContent); no.setAttribute('aria-label', 'Reject: ' + title.textContent);
    acts.append(ok, no, link);
  }
  c.append(acts, m); return c;
}
function askCard(a) {
  const c = card('ask', 'Deepbot asks'); c.append(el('p', a.question, 'tg-card-title'));
  const chips = el('div', undefined, 'tg-chips');
  for (const o of (a.options || []).slice(0, 6)) chips.append(btn(String(o), () => { chips.querySelectorAll('button').forEach(b => { b.disabled = true; }); ask(String(o)); }, 'tg-chip'));
  c.append(chips); return c;
}
// One assistant turn: the reply, then its cards in order, then its asks, then its steps.
function assistant(t, meta) {
  const m = bubble(String(t.reply || ''), 'bot', meta);
  const cards = [];
  for (const x of t.cards || []) {
    const d = x.data || {};
    if (x.kind === 'staged') cards.push(stagedCard(d)); else if (x.kind === 'quote') cards.push(quoteCard(d)); else if (x.kind === 'plan') cards.push(planCard(d)); else if (x.kind === 'report') cards.push(reportCard(d));
    else if (x.kind === 'catalog') { catalog = d; catalogCard(); }
  }
  for (const a of t.asks || []) cards.push(askCard(a));
  if (Array.isArray(t.steps) && t.steps.length) cards.push(stepsCard(t.steps));
  m.after(...cards);
  if ((t.cards || []).some(x => x.kind === 'staged')) dispatchEvent(new Event('dh:staged')); // the dock badge counts it
  return m;
}

async function ask(question) {
  question = question.trim().slice(0, MAX_Q);
  if (!question || busy) return;
  if (!live()) { bubble(question, 'user'); bubble('Sign in to talk to Deepbot. These tips are free.', 'bot'); return; }
  showChat(); busy = true; send.disabled = true; send.textContent = 'Thinking'; setFace('think'); status.textContent = 'Thinking about it.';
  bubble(question, 'user');
  try {
    const r = await session.api('deepbot', {...(threadId ? {thread_id: threadId} : {}), message: question, context: {stage: currentStage(), ...(currentWindow() ? {window: currentWindow()} : {}), targets: pointer.targets()}});
    if (r.thread_id) threadId = r.thread_id;
    assistant(r, r.model ? r.model + ' / ' + credits(r.cost_micro) : 'Free / no model call');
    status.textContent = 'Ready.';
  } catch (e) {
    const s = e.status;
    const text = s === 503 ? ERR.offline : s === 403 || s === 429 ? ERR.spent : s === 413 ? ERR.full : s === 404 ? ERR.gone : s === 400 ? (e.data?.message || ERR.missed) : s ? ERR.missed : 'You look offline. Check the connection and try again.';
    const m = bubble(text, 'bot tg-error'); m.setAttribute('role', 'alert');
    if (s === 413 || s === 404) { threadId = null; m.append(btn('New thread', () => newThread(), 'btn btn-outline tg-go')); }
    status.textContent = s === 503 ? 'Offline.' : 'Ready.';
  } finally { busy = false; send.disabled = false; send.textContent = 'Send'; setFace('idle'); keepFocus(); }
}
form.addEventListener('submit', e => { e.preventDefault(); const v = q.value; if (!v.trim()) { q.focus(); return; } q.value = ''; ask(v); });
q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });

let mode = '';
function render() {
  const on = live();
  if (mode === String(on)) return; mode = String(on); catalog = null;
  foot.replaceChildren(on ? form : signIn); threadsBtn.hidden = newBtn.hidden = !on;
  status.textContent = 'Ready.';
  if (!panel.hidden || !on) newThread(); else log.replaceChildren(); // signed in: the catalog loads on first open, not on page load
}
session.onAuthChange(render); render();

// ---- open and close: non-modal, Escape returns focus to the launcher ----
function toggle(open, restore = true) {
  panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); launcher.dataset.open = String(open);
  if (open) { if (!log.childElementCount && view === 'chat') newThread(); setFace('idle'); place(); (panel.querySelector('#tg-q') || panel.querySelector('.tg-chip') || close).focus({preventScroll: true}); }
  else { clearTimeout(blinkTimer); if (restore) launcher.focus(); }
}
launcher.addEventListener('click', () => toggle(panel.hidden));
document.addEventListener('keydown', e => {
  const a = document.activeElement;
  if (e.key === 'Escape' && !panel.hidden && !pointer.running() && (panel.contains(a) || a === document.body || a === launcher)) { e.stopPropagation(); toggle(false); }
}, true);
function keepFocus() { if (!panel.hidden && (!document.activeElement || document.activeElement === document.body)) (panel.querySelector('#tg-q') || close).focus({preventScroll: true}); }

// ---- phone sheet: two snap points, a handle you tap or drag, and the keyboard pushes it up ----
function snap(s) { panel.dataset.snap = s; handle.setAttribute('aria-label', s === 'full' ? 'Make Deepbot shorter' : 'Make Deepbot taller'); }
let dragY = null;
handle.addEventListener('pointerdown', e => { if (!phone()) return; dragY = e.clientY; handle.setPointerCapture(e.pointerId); });
handle.addEventListener('pointerup', e => {
  if (dragY === null) return; const dy = e.clientY - dragY; dragY = null;
  if (Math.abs(dy) < 24) return; // a tap: the click handler toggles
  handle.dataset.dragged = 'true';
  if (dy < 0) snap('full'); else if (panel.dataset.snap === 'full') snap('half'); else toggle(false);
});
handle.addEventListener('click', e => { if (handle.dataset.dragged) { delete handle.dataset.dragged; e.stopImmediatePropagation(); } }, true);
const vv = window.visualViewport;
// Under 80 px is browser chrome settling (the URL bar), not a keyboard.
function keyboard() { const kb = vv ? Math.round(innerHeight - vv.height - vv.offsetTop) : 0; document.documentElement.style.setProperty('--tg-kb', (kb >= 80 ? kb : 0) + 'px'); }
vv?.addEventListener('resize', keyboard); vv?.addEventListener('scroll', keyboard); addEventListener('resize', keyboard);

// ---- placement: bottom right, lifted above anything fixed in that corner (the dock, a stage footer, Ask Deep) ----
const OBSTACLES = '#app-launcher, .v3-dock, .stage-foot, [data-ask-deep], .ask-deep';
let queued = false;
function place() {
  queued = false;
  const base = phone() ? 12 : 20, right = innerWidth - base;
  const clear = left => {
    let lift = base;
    for (const n of document.querySelectorAll(OBSTACLES)) {
      if (!n.checkVisibility()) continue;
      const r = n.getBoundingClientRect();
      if (r.width && r.right > left - 8 && r.left < right + 8 && r.bottom > innerHeight - 240) lift = Math.max(lift, Math.ceil(innerHeight - r.top + 12));
    }
    return lift;
  };
  const lift = clear(right - 56), panelWidth = Math.min(420, innerWidth - 2 * base);
  const root = document.documentElement.style;
  root.setProperty('--tg-lift', lift + 'px');
  root.setProperty('--tg-side', base + 'px');
  root.setProperty('--tg-panel-bottom', Math.max(lift + 68, clear(right - panelWidth)) + 'px');
  root.setProperty('--tg-top', Math.max(24, Math.ceil(document.querySelector('.menubar')?.getBoundingClientRect().bottom || 0) + 12) + 'px');
}
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
addEventListener('resize', queue);
new MutationObserver(queue).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-zone', 'data-focused', 'class']});
place(); keyboard();
