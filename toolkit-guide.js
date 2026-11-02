// toolkit-guide.js : the toolkit guide. A pixel mare in the bottom right corner that answers how-to questions
// through the `guide` action (docs/toolkit-v4-api.md) and points at the Workbench stage it is talking about.
// Toolkit host pages only (desktop and sign-in). Shell ported from 21st.dev 27159 "Ask AI" (AdiKodez): round mascot
// trigger, popover card with title, description and a suggestion row; the mascot wakes while the card is open.
import * as session from './toolkit-session.js';

const SPRITE = '#mare-'; // symbols from /brand/pixel-mare.svg, inlined below so the first open never paints an empty tile
const STAGES = ['file', 'columns', 'ask', 'quote', 'run', 'report'];
const LABEL = {file: 'File', columns: 'Columns', ask: 'Ask', quote: 'Quote', run: 'Run', report: 'Report', account: 'Account'};
const MAX_Q = 500, MAX_TURNS = 8, MAX_TURN_CHARS = 1000;
// Static answers, only from facts the toolkit states elsewhere. No call, no credits.
const TIPS = [
  ['What are the stages?', 'Six stages: File, Columns, Ask, Quote, Run, Report. Nothing runs before you approve the quote.'],
  ['Where does my file go?', 'Your file is read in your browser. Only the columns you map go to the server, and only after you approve a quote.'],
  ['How big can my file be?', 'Up to 5 MiB, 20,000 rows and 200 columns.'],
  ['What does a credit cost?', '1 credit is $0.001. The quote reserves the maximum, and the run settles at the actual cost.'],
  ['How does Lead Scorer batch rows?', 'Lead Scorer handles up to 5 rows per batch.'],
];
const OFFLINE = 'The guide is offline right now.';
const SPENT = 'Your AI allowance for today is used up. These tips are free.';
const MISSED = 'That one did not land. Try again or rephrase.';

const signinPage = document.body.classList.contains('signin-page');
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function svgUse(frame) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), use = document.createElementNS(ns, 'use');
  svg.setAttribute('viewBox', '0 0 32 32'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('shape-rendering', 'crispEdges');
  use.setAttribute('href', SPRITE + frame); svg.append(use); return svg;
}

// ---- DOM ----
const launcher = el('button', undefined, 'tg-launcher'); launcher.type = 'button';
launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'tg-panel'); launcher.setAttribute('aria-label', 'Toolkit guide');
const badge = el('img'); badge.src = '/brand/pixel-mare-badge.svg'; badge.alt = ''; badge.width = badge.height = 48; launcher.append(badge);

const panel = el('aside', undefined, 'tg-panel'); panel.id = 'tg-panel'; panel.hidden = true;
panel.setAttribute('role', 'complementary'); panel.setAttribute('aria-label', 'Toolkit guide');
const head = el('header', undefined, 'tg-head');
const stageBox = el('div', undefined, 'tg-mascot'); const mascot = svgUse('idle'); stageBox.append(mascot);
const headText = el('div', undefined, 'tg-head-text');
const status = el('p', '', 'tg-status');
headText.append(el('p', 'Toolkit guide', 'tg-eyebrow'), el('h2', 'Ask the mare', 'tg-title'), status);
const close = el('button', '×', 'tg-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close the toolkit guide');
head.append(stageBox, headText, close);
const log = el('div', undefined, 'tg-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-label', 'Guide conversation');
const chips = el('div', undefined, 'tg-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', 'Suggested questions');
const foot = el('div', undefined, 'tg-foot');
// Header (mascot) and ask box stay put; only the conversation scrolls, so the mascot never scrolls away.
const scroller = el('div', undefined, 'tg-body'); scroller.append(log, chips);
panel.append(head, scroller, foot);

const form = el('form', undefined, 'tg-form');
const qLabel = el('label', 'Ask how to do something in the toolkit', 'tg-label'); qLabel.htmlFor = 'tg-q';
const q = el('textarea'); q.id = 'tg-q'; q.rows = 2; q.maxLength = MAX_Q; q.placeholder = 'How much will this cost?';
const count = el('span', '0 / ' + MAX_Q, 'tg-count'); count.id = 'tg-count'; q.setAttribute('aria-describedby', 'tg-count');
const send = el('button', 'Ask', 'btn btn-gold tg-send'); send.type = 'submit';
const row = el('div', undefined, 'tg-form-row'); row.append(count, send);
form.append(qLabel, q, row);
const signIn = el('a', 'Sign in to ask anything', 'btn btn-gold tg-signin'); signIn.href = signinPage ? '#toolkit-signin-root' : '/sign-in';
signIn.addEventListener('click', () => { if (signinPage) { toggle(false, false); document.querySelector('#toolkit-signin-root input, #toolkit-signin-root')?.focus?.(); } });

document.body.append(launcher, panel);
fetch('/brand/pixel-mare.svg').then(r => r.ok ? r.text() : '').then(t => {
  const box = el('div'); box.hidden = true; box.setAttribute('aria-hidden', 'true'); box.innerHTML = t; document.body.append(box);
}).catch(() => {});

// ---- mascot: idle is ready, think is in flight (no blinking), point when a reply names a stage ----
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

// ---- where the user is ----
function workbench() { return document.querySelector('.window[data-app="workbench"]:not([hidden])'); }
function currentStage() {
  if (signinPage) return 'sign_in';
  const sec = workbench()?.querySelector('section.stage[data-stage]:not([hidden])');
  if (sec && STAGES.includes(sec.dataset.stage)) return sec.dataset.stage;
  return document.querySelector('.window[data-app="account"][data-focused="true"]:not([hidden])') ? 'account' : 'gallery';
}

// ---- pointing: a lamp ring on the stepper step, and a Go to button that switches stage ----
let pointing = null;
function ring() {
  document.querySelectorAll('.stepper li[data-guide-point]').forEach(li => li.removeAttribute('data-guide-point'));
  const i = STAGES.indexOf(pointing);
  if (i >= 0) workbench()?.querySelectorAll('.stepper li')[i]?.setAttribute('data-guide-point', '');
}
function goTo(stage) {
  if (stage === 'account') { document.querySelector('[data-launch="account"]')?.click(); return; }
  if (!workbench()) document.querySelector('[data-launch="workbench"]')?.click();
  const w = workbench(); if (!w?.guideGo) return;
  w.guideGo(STAGES.indexOf(stage)); ring();
  if (innerWidth <= 768) toggle(false, false); // the window is full screen on phones; show it
}

// ---- conversation ----
let history = [], busy = false;
function bubble(text, who, meta) {
  const m = el('div', undefined, 'tg-msg tg-' + who); m.append(el('p', text, 'tg-text'));
  if (meta) m.append(el('p', meta, 'tg-meta'));
  log.append(m);
  // a question scrolls to the end; an answer scrolls so its first line is in view, whatever its length
  scroller.scrollTop = who === 'user' ? scroller.scrollHeight : scroller.scrollTop + m.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
  return m;
}
function showChips(list, live) {
  chips.replaceChildren(...list.map(([label, answer]) => {
    const c = el('button', label, 'tg-chip'); c.type = 'button';
    c.addEventListener('click', () => live ? ask(label) : tip(label, answer)); return c;
  }));
  chips.hidden = !list.length;
}
function tip(question, answer) { bubble(question, 'user'); bubble(answer, 'bot', 'Tip · no credits used'); setFace('idle'); keepFocus(); }
const scripted = () => showChips(TIPS, false);
function credits(micro) { const n = Math.ceil((Number(micro) || 0) / 1000); return n + (n === 1 ? ' credit' : ' credits'); }

async function ask(question) {
  question = question.trim().slice(0, MAX_Q);
  if (!question || busy) return;
  busy = true; send.disabled = true; send.textContent = 'Thinking'; pointing = null; ring(); setFace('think');
  log.querySelectorAll('.tg-go').forEach(b => b.remove()); // only the newest reply may move the Workbench
  status.textContent = 'Thinking about it.'; bubble(question, 'user');
  try {
    const r = await session.api('guide', {question, stage: currentStage(), history});
    const reply = String(r.reply || '');
    const point = STAGES.includes(r.point_to) || r.point_to === 'account' ? r.point_to : null;
    const msg = bubble(reply, 'bot', typeof r.model === 'string' ? r.model + ' · ' + credits(r.cost_micro) : null);
    history = history.concat({role: 'user', content: question.slice(0, MAX_TURN_CHARS)}, {role: 'assistant', content: reply.slice(0, MAX_TURN_CHARS)}).slice(-MAX_TURNS);
    if (point) {
      pointing = point; ring();
      const go = el('button', 'Go to ' + LABEL[point], 'btn btn-outline tg-go'); go.type = 'button'; go.addEventListener('click', () => goTo(point)); msg.append(go);
    }
    setFace(point ? 'point' : 'idle'); status.textContent = point ? 'Pointing at ' + LABEL[point] + '.' : 'Ready.';
    showChips((Array.isArray(r.chips) ? r.chips : []).slice(0, 3).map(c => [String(c)]), true);
  } catch (e) {
    const s = e.status;
    const text = s === 503 ? OFFLINE : s === 403 || s === 429 ? SPENT : s === 502 ? MISSED : s === 400 ? (e.data?.message || MISSED) : s ? MISSED : e.message;
    bubble(text, 'bot tg-error'); setFace('idle'); status.textContent = s === 503 ? 'Offline. Tips below are free.' : 'Ready.';
    if (s === 503 || s === 403 || s === 429) scripted();
  } finally { busy = false; send.disabled = false; send.textContent = 'Ask'; keepFocus(); }
}
form.addEventListener('submit', e => { e.preventDefault(); const v = q.value; if (!v.trim()) { q.focus(); return; } q.value = ''; count.textContent = '0 / ' + MAX_Q; ask(v); });
q.addEventListener('input', () => { count.textContent = q.value.length + ' / ' + MAX_Q; });
q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });

let mode = '';
function render() {
  const live = !signinPage && session.authState().signedIn;
  if (mode === String(live)) return; mode = String(live);
  history = []; log.replaceChildren();
  bubble(live ? 'Ask me how to do something here. I can see which stage you are on.' : 'These tips are free and need no account. Sign in to ask your own question.', 'bot');
  showChips(TIPS, live); foot.replaceChildren(live ? form : signIn);
  status.textContent = 'Ready.';
}
session.onAuthChange(render); render();

// ---- open and close: non-modal, Escape returns focus to the launcher ----
function toggle(open, restore = true) {
  panel.hidden = !open; launcher.setAttribute('aria-expanded', String(open)); launcher.dataset.open = String(open);
  if (open) { setFace(pointing ? 'point' : 'idle'); place(); (panel.querySelector('#tg-q') || chips.querySelector('button') || close).focus(); }
  else { clearTimeout(blinkTimer); if (restore) launcher.focus(); }
}
launcher.addEventListener('click', () => toggle(panel.hidden));
close.addEventListener('click', () => toggle(false));
// Escape closes from inside the panel, or from the page when a chip that just answered took focus with it.
document.addEventListener('keydown', e => {
  const a = document.activeElement;
  if (e.key === 'Escape' && !panel.hidden && (panel.contains(a) || a === document.body || a === launcher)) { e.stopPropagation(); toggle(false); }
}, true);
// A clicked chip is replaced by the reply's chips; keep focus in the panel instead of dropping it on the page.
function keepFocus() { if (!panel.hidden && (!document.activeElement || document.activeElement === document.body)) (panel.querySelector('#tg-q') || chips.querySelector('button') || close).focus({preventScroll: true}); }

// ---- placement: bottom right, lifted above anything fixed in that corner (the dock, a stage footer, Ask Deep) ----
const OBSTACLES = '#app-launcher, .v3-dock, .stage-foot, [data-ask-deep], .ask-deep';
let queued = false;
function place() {
  queued = false;
  const base = innerWidth <= 768 ? 12 : 20, right = innerWidth - base;
  // How high to sit to clear every visible obstacle overlapping [left, right] near the bottom of the viewport.
  const clear = left => {
    let lift = base;
    for (const n of document.querySelectorAll(OBSTACLES)) {
      if (!n.checkVisibility()) continue;
      const r = n.getBoundingClientRect();
      if (r.width && r.right > left - 8 && r.left < right + 8 && r.bottom > innerHeight - 240) lift = Math.max(lift, Math.ceil(innerHeight - r.top + 12));
    }
    return lift;
  };
  const lift = clear(right - 56), panelWidth = Math.min(392, innerWidth - 2 * base);
  const root = document.documentElement.style;
  root.setProperty('--tg-lift', lift + 'px');
  root.setProperty('--tg-side', base + 'px');
  root.setProperty('--tg-panel-bottom', Math.max(lift + 68, clear(right - panelWidth)) + 'px');
  // never slide under the menu bar (it wraps to two rows on phones)
  root.setProperty('--tg-top', Math.max(24, Math.ceil(document.querySelector('.menubar')?.getBoundingClientRect().bottom || 0) + 12) + 'px');
}
const queue = () => { if (!queued) { queued = true; requestAnimationFrame(place); } };
addEventListener('resize', queue);
new MutationObserver(queue).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'data-zone', 'data-focused', 'class']});
// Pointing survives the Workbench being opened or the stage changing.
new MutationObserver(() => { if (pointing && !document.querySelector('.stepper li[data-guide-point]')) ring(); }).observe(document.body, {subtree: true, childList: true});
place();
