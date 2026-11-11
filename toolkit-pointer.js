// toolkit-pointer.js : runs a Deepbot `page_steps` plan on the page, OpenClicky style (docs/toolkit-v4-api.md section 8).
// Show me points and the user clicks; Do it points, waits 400 ms, then does the step, and the user can stop it.
// Vanilla port of the 21st.dev 26918 "Product Tour" pattern (laziekiki): a ring that glides to a real element, a caption
// beside it, keyboard driven, reduced-motion aware. No dimming layer: the toolkit stays usable while it points.
// The page decides what is reachable: only elements carrying data-guide="<id>" and the dock launchers. A step the page
// cannot resolve is refused out loud and nothing happens. Spend and approval (ids ending .run or .approve) are never clicked.
const OPS = ['open', 'go', 'point', 'click', 'say'];
const APPS = ['workbench', 'enrich', 'files', 'beam', 'pdf', 'account', 'approvals'];
const STAGES = ['file', 'columns', 'ask', 'quote', 'run', 'report'];
const HUMAN = /(^|[._-])(run|approve)$/i;
export const REFUSED = 'I can\'t reach that.';
export const PAUSE_MS = 400;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');

function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
const byGuide = id => [...document.querySelectorAll('[data-guide]')].find(n => n.dataset.guide === id && n.isConnected);
const launcher = id => document.querySelector(`#app-launcher [data-launch="${CSS.escape(id)}"]`);
const workbench = () => document.querySelector('.window[data-app="workbench"]:not([hidden])');

// Every id the page can resolve now, plus the ids of windows that are not open yet (so a plan can open Account and
// then point inside it). Sent to Deepbot as context.targets, 200 max. The runner still refuses any id not on the page.
const KNOWN = [
  ...['file', 'columns', 'ask', 'quote', 'run', 'report'].map(s => 'workbench.stage.' + s),
  'workbench.file.drop', 'workbench.file.sample', 'workbench.file.next', 'workbench.columns.confirm', 'workbench.ask.goal', 'workbench.ask.quote',
  'files.upload', 'files.new_folder', 'approvals.refresh', 'account.refresh', 'account.connections',
  ...['harbinger', 'beam'].flatMap(p => ['key', 'save', 'open', 'remove', ...(p === 'harbinger' ? ['invite'] : [])].map(x => `account.connections.${p}.${x}`)),
];
export function targets() {
  const live = [...document.querySelectorAll('[data-guide]')].map(n => n.dataset.guide);
  return [...new Set([...live, ...KNOWN])].filter(t => /^[\w.-]{1,80}$/.test(t)).slice(0, 200);
}

// ---- the ring and the caption ----
const ring = el('div', undefined, 'tp-ring'); ring.hidden = true; ring.setAttribute('aria-hidden', 'true');
const cap = el('div', undefined, 'tp-caption'); cap.hidden = true; cap.setAttribute('role', 'status'); cap.setAttribute('aria-live', 'polite');
const capStep = el('p', '', 'tp-step'), capText = el('p', '', 'tp-text'), capActs = el('div', undefined, 'tp-acts');
cap.append(capStep, capText, capActs);
document.body.append(ring, cap);
let follow = null, raf = 0;

// While a step is on screen the ring and caption track the target every frame: windows scroll, load and reflow
// under it without telling anyone. The loop runs only while a step is showing.
function frame() {
  raf = 0;
  if (cap.hidden) { ring.hidden = true; return; }
  if (!follow || !follow.isConnected) { ring.hidden = true; placeCaption(null); }
  else {
    const r = follow.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, {left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + 2 * pad + 'px', height: r.height + 2 * pad + 'px'});
    ring.hidden = false; placeCaption(r);
  }
  raf = requestAnimationFrame(frame);
}
const queue = () => { if (!raf) raf = requestAnimationFrame(frame); };

function placeCaption(r) {
  if (cap.hidden) return;
  const w = Math.min(320, innerWidth - 24), h = cap.offsetHeight, gap = 18; // clear of the ring and its halo
  let left, top;
  if (!r) { left = Math.round((innerWidth - w) / 2); top = 72; } // a say step or a refusal: top centre, clear of the panel and the dock
  else { // below the ring, else above it, else (a tall target) over its lower edge; never over the ringed control's top
    left = Math.min(Math.max(12, r.left), innerWidth - w - 12);
    top = r.bottom + gap + h < innerHeight - 8 ? r.bottom + gap : r.top - gap - h >= 8 ? r.top - gap - h : innerHeight - h - 8;
  }
  Object.assign(cap.style, {width: w + 'px', left: left + 'px', top: Math.max(8, top) + 'px'});
}

function show(target, text, n, total) {
  follow = target || null;
  capStep.textContent = `Step ${n} of ${total}`; capText.textContent = text;
  cap.hidden = false; cap.dataset.refused = 'false';
  if (target) target.scrollIntoView({block: 'center', inline: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth'});
  queue();
}
export function clear() { follow = null; ring.hidden = true; cap.hidden = true; capActs.replaceChildren(); cancelAnimationFrame(raf); raf = 0; }

// ---- resolving a step: the element it acts on, and what doing it means ----
function resolve(s) {
  if (!s || !OPS.includes(s.op)) return null;
  const t = typeof s.target === 'string' ? s.target : '';
  if (s.op === 'say') return {node: null, act: () => {}};
  if (s.op === 'open') { const b = APPS.includes(t) && launcher(t); return b && {node: b, act: () => b.click()}; }
  if (s.op === 'go') {
    if (t === 'account') { const b = launcher('account'); return b && {node: b, act: () => b.click()}; }
    const i = STAGES.indexOf(t); if (i < 0) return null;
    const wb = workbench(), btn = wb && byGuide('workbench.stage.' + t);
    if (!wb) { const b = launcher('workbench'); return b && {node: b, act: () => { b.click(); workbench()?.guideGo?.(i); }}; }
    return {node: btn || wb, act: () => wb.guideGo?.(i)};
  }
  const node = byGuide(t);
  if (!node) return null;
  if (s.op === 'click' && (HUMAN.test(t) || node.disabled || node.getAttribute('aria-disabled') === 'true')) return null;
  return {node, act: s.op === 'click' ? () => node.click() : () => {}};
}

// Show me: each step waits for Next (the user does the clicking). Do it: each step acts after PAUSE_MS, Stop ends it.
// Resolves to {status: 'done' | 'stopped' | 'refused', index}. One run at a time; a new run stops the last one.
let current = null;
export function stop() { current?.end('stopped'); }
export function running() { return !!current; }
export function run(steps, {mode = 'show', onStep} = {}) {
  stop();
  const list = Array.isArray(steps) ? steps.slice(0, 8) : [];
  return new Promise(resolveRun => {
    let i = -1, timer = 0;
    const me = {end(status) { if (current !== me) return; current = null; clearTimeout(timer); document.removeEventListener('keydown', key, true); if (status !== 'refused') clear(); resolveRun({status, index: i}); }};
    current = me;
    const key = e => { if (e.key === 'Escape' && current === me) { e.stopPropagation(); me.end('stopped'); } };
    document.addEventListener('keydown', key, true);
    const button = (text, fn, cls) => { const b = el('button', text, cls); b.type = 'button'; b.addEventListener('click', fn); return b; };
    function next(waited = 0) {
      if (current !== me) return;
      if (!waited && ++i >= list.length) { me.end('done'); return; }
      const s = list[i], r = resolve(s);
      if (!waited) onStep?.(i, s);
      // A window that just opened may still be loading its controls: give a registered id up to 2 s to appear.
      if (!r && OPS.includes(s?.op) && s.op !== 'open' && !(s.op === 'click' && HUMAN.test(s.target || '')) && waited < 2000) { timer = setTimeout(() => next(waited + 100), 100); return; }
      if (!r) { // refused: say so, touch nothing, end the run
        show(null, REFUSED, i + 1, list.length); cap.dataset.refused = 'true'; cap.setAttribute('role', 'alert');
        capActs.replaceChildren(button('OK', () => { cap.setAttribute('role', 'status'); clear(); }, 'btn btn-outline'));
        capActs.querySelector('button').focus({preventScroll: true});
        me.end('refused'); return;
      }
      cap.setAttribute('role', 'status');
      const text = s.say || {open: 'Opening ' + s.target + '.', go: 'Going to ' + s.target + '.', click: 'Clicking this.', point: 'This one.'}[s.op] || '';
      show(r.node, text, i + 1, list.length);
      const last = i === list.length - 1;
      if (mode === 'do') {
        capActs.replaceChildren(button('Stop', () => me.end('stopped'), 'btn btn-outline tp-stop'));
        timer = setTimeout(() => { if (current !== me) return; r.act(); timer = setTimeout(next, PAUSE_MS); }, PAUSE_MS);
      } else {
        const go = button(last ? 'Done' : 'Next', () => next(), 'btn btn-outline tp-next');
        capActs.replaceChildren(button('Stop', () => me.end('stopped'), 'btn btn-text'), go);
        const at = i; r.node?.addEventListener('click', () => setTimeout(() => { if (i === at) next(); }, 0), {once: true}); // the user did the step
        go.focus({preventScroll: true});
      }
    }
    next();
  });
}
