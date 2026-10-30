// Users never see more than 2 decimals. Costs and quotes round up to the cent; pass 'down' for balances and remaining allowance.
export function money(micro, round = 'up') {
  const n = Number(micro) || 0, abs = Math.abs(n);
  if (abs > 0 && abs < 10000) return n < 0 ? '-under $0.01' : 'under $0.01';
  const cents = (round === 'down' ? Math.floor : Math.ceil)(abs / 10000);
  return (n < 0 ? '-' : '') + (cents / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'});
}
// One Recent runs line per Workbench job: chunks share job_id; rows and spend add up, mixed statuses read "partly done".
export function groupRuns(runs) {
  const jobs = new Map();
  for (const r of runs) {
    const k = r.job_id || r.id, g = jobs.get(k);
    if (!g) { jobs.set(k, {...r}); continue; }
    g.row_count += r.row_count; g.spent_micro += r.spent_micro;
    if (g.status !== r.status) g.status = 'partly done';
    if (Date.parse(r.created_at) > Date.parse(g.created_at)) g.created_at = r.created_at;
  }
  return [...jobs.values()];
}
export function validateFileTable(table) {
  if (!table.rows.length) throw new Error('This file has no data rows. Add a header and at least one row.');
  const headers = [...new Set(table.rows.flatMap(r => Object.keys(r)))];
  if (headers.length > 200 || headers.some(h => !h || h.length > 200 || ['__proto__','prototype','constructor'].includes(h))) throw new Error('Use up to 200 named columns, each at most 200 characters, without reserved names.');
  if (table.rows.some(r => Object.values(r).some(v => String(v).length > 1000))) throw new Error('A cell exceeds 1,000 characters. Shorten it before uploading; nothing has been truncated.');
  return { headers, rows: table.rows };
}
export function quoteSummary(quotes) {
  const allowance = quotes[quotes.length - 1].allowance;
  const micro = quotes.reduce((s,q) => s+q.max_cost_micro,0);
  const credits = quotes.reduce((s,q) => s+q.max_credits,0);
  const rows = quotes.reduce((s,q) => s+q.row_count,0);
  // The server names the first cap that fails (account, chunk ceiling, rows, daily limit, balance, shared budget) in plain words.
  const refused = quotes.find(q => q.can_run === false);
  const reasons = refused ? [refused.message || 'This job cannot run right now. Ask an administrator.'] : micro <= 0 ? ['No usable cells for these operations. Check your column mapping.'] : [];
  return {micro,credits,rows,allowance,reasons};
}
const NORMALIZED = ['title_normalized', 'seniority', 'function'];
export function resultRows(rows, columns, results) {
  return rows.map((row,i) => {
    const out = {...row};
    columns.forEach((spec,c) => {
      const result = results[c];
      const index = result?.row_map?.[i];
      const item = index >= 0 ? result?.items?.[index] : null;
      const prefix = `Result ${c+1}: ${spec.column} / ${spec.op}`;
      const extra = spec.op === 'normalize_title' ? NORMALIZED : spec.op === 'research' ? spec.output_columns || [] : [];
      out[prefix] = item?.label || (extra.length && item ? String(item[extra[0]] ?? item.values?.[extra[0]] ?? '') : '') || (index === -1 ? 'skipped' : 'not_run');
      for (const key of extra) out[prefix+' / '+key] = item ? String(item[key] ?? item.values?.[key] ?? '') : '';
      out[prefix+' / confidence'] = item?.confidence ?? '';
      out[prefix+' / review'] = item ? (item.review ? 'Review needed' : 'No flag') : 'Review needed';
      out[prefix+' / evidence'] = [item?.source,item?.note,...['name','title','company'].filter(k => item?.[k]).map(k => `${k}: ${item[k]}`)].filter(Boolean).join('; ') || 'No independent source supplied';
      out[prefix+' / checked_at'] = item?.checked_at || '';
    });
    return out;
  });
}

// ---- V4 Data Workbench: intake, mapping and plan ----
export const FIELDS = ['person_name','first_name','last_name','title','company','domain','email','phone','linkedin_url','city','country','industry','other'];
export const FIELD_LABEL = {person_name:'Person name',first_name:'First name',last_name:'Last name',title:'Job title',company:'Company',domain:'Company domain',email:'Email',phone:'Phone',linkedin_url:'LinkedIn URL',city:'City',country:'Country',industry:'Industry',other:'Other'};
export const OPS = {normalize_title:['jev','deepseek'],classify:['jev','deepseek'],verify:['jev','deepseek'],research:['deepseek'],enrich:['treg'],verify_email:['treg']};
export const OP_LABEL = {normalize_title:'Normalize job titles',classify:'Sort into categories',verify:'Yes or no check',research:'Research a question',enrich:'Find contact data',verify_email:'Check the email address'};
export const ENGINE_LABEL = {jev:'Jev (fast, cheap labels)',deepseek:'DeepSeek (research and reasoning)',treg:'Treg (contact data)'};
export const STARTER_CHIPS = ['Enrichment','Title normalization','Categorization','Classification','Email verification','Company research'];
export const PRIVACY_LINE = 'We keep your instructions and the AI conversation (never your cell values) to improve the toolkit.';
export const MAX_JOB_ROWS = 20000, CHUNK_ROWS = 100;

// Header names to the contract's field vocabulary. Order matters: "Company name" is a company, not a person.
const GUESS = [[/e-?mail/i,'email'],[/linked\s*in/i,'linkedin_url'],[/first/i,'first_name'],[/last|surname/i,'last_name'],[/company|account|organi[sz]ation|employer/i,'company'],[/domain|website|url|site/i,'domain'],[/title|job|role|position|designation/i,'title'],[/name/i,'person_name'],[/phone|mobile|tel/i,'phone'],[/city|town/i,'city'],[/country/i,'country'],[/industry|sector|vertical/i,'industry']];
export function guessFields(headers) {
  return headers.map(h => ({source: h, field: (GUESS.find(([re]) => re.test(h)) || [0, 'other'])[1], keep: true}));
}
// A guess is sure when the header matched and the sample values look like that field; unsure ones render dashed until confirmed.
const LOOKS = {email: /@/, domain: /\./, linkedin_url: /linkedin/i, phone: /\d{3}/};
export function guessSure(field, samples) {
  if (field === 'other') return false;
  const re = LOOKS[field], vals = samples.filter(Boolean);
  return !re || !vals.length || vals.filter(v => re.test(v)).length * 2 > vals.length;
}
// Up to 5 distinct non-empty samples per header, each at most 200 characters (contract section 1). Headers up to 200.
export function intakeFile(name, headers, rows) {
  const samples = {};
  for (const h of headers.slice(0, 200)) {
    const seen = new Set();
    for (const r of rows) { const v = String(r[h] ?? '').trim().slice(0, 200); if (v) seen.add(v); if (seen.size >= 5) break; }
    samples[h] = [...seen];
  }
  return {name: String(name).slice(0, 200), rows_total: rows.length, headers: headers.slice(0, 200), samples};
}
export function mergeMapping(current, incoming) {
  const by = new Map((incoming || []).filter(m => m && FIELDS.includes(m.field)).map(m => [m.source, m]));
  return current.map(m => by.has(m.source) ? {source: m.source, field: by.get(m.source).field, keep: by.get(m.source).keep !== false} : m);
}
// The worker returns validated categories as {name, description}; edits come back as comma text.
const list = v => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x && typeof x === 'object' ? x.name ?? '' : x).trim()).filter(Boolean);
// A plan item straight from intake or the editor, in the editor's shape.
export function planItem(p = {}, headers = []) {
  const op = OPS[p.op] ? p.op : 'classify';
  return {column: headers.includes(p.column) ? p.column : headers[0] || '', op, engine: OPS[op].includes(p.engine) ? p.engine : OPS[op][0],
    instruction: p.instruction || '', categories: list(p.categories).join(', '), output_columns: list(p.output_columns).join(', '),
    web: !!p.web, fields: Array.isArray(p.fields) && p.fields.length ? p.fields.filter(f => ['name','title','company'].includes(f)) : ['name','title','company']};
}
// The editable plan to the run columns. Throws a plain-English error for the first problem; nothing runs from intake directly.
export function planToSpecs(plan, mapping, headers) {
  if (!plan.length) throw new Error('Add at least one operation to the plan.');
  if (plan.length > 8) throw new Error('Use up to 8 operations per job.');
  const kept = new Set(mapping.filter(m => m.keep).map(m => m.source));
  const fieldColumn = f => mapping.find(m => m.keep && m.field === f)?.source;
  return plan.map((p, i) => {
    const n = `Operation ${i + 1}`;
    if (!headers.includes(p.column)) throw new Error(`${n}: choose a column from your file.`);
    if (!kept.has(p.column)) throw new Error(`${n} uses "${p.column}", which is set to skip. Keep that column or pick another.`);
    if (!OPS[p.op]?.includes(p.engine)) throw new Error(`${n}: ${ENGINE_LABEL[p.engine] || 'that engine'} cannot ${OP_LABEL[p.op]?.toLowerCase() || 'do that'}.`);
    const spec = {column: p.column, op: p.op, engine: p.engine};
    if (['classify','verify','research'].includes(p.op)) {
      if (!p.instruction.trim()) throw new Error(`${n}: write the ${p.op === 'verify' ? 'yes or no question' : p.op === 'research' ? 'research question' : 'instruction'}.`);
      spec.instruction = p.instruction.trim().slice(0, 1000);
    }
    if (p.op === 'classify') {
      spec.categories = list(p.categories);
      if (spec.categories.length < 2 || spec.categories.length > 30 || new Set(spec.categories.map(x => x.toLowerCase())).size !== spec.categories.length) throw new Error(`${n}: list 2 to 30 different categories.`);
    }
    if (p.op === 'research') {
      spec.output_columns = list(p.output_columns);
      if (spec.output_columns.length < 1 || spec.output_columns.length > 3) throw new Error(`${n}: name 1 to 3 output columns.`);
      if (p.web) spec.web = true;
    }
    if (p.op === 'enrich') {
      if (!p.fields.length) throw new Error(`${n}: choose at least one contact field.`);
      spec.fields = p.fields;
      const name = fieldColumn('person_name'), domain = fieldColumn('domain');
      if (name) spec.name_column = name;
      if (domain) spec.domain_column = domain;
    }
    return spec;
  });
}
// Skipped columns never leave the browser.
export function keptRows(rows, mapping) {
  const kept = mapping.filter(m => m.keep).map(m => m.source);
  return rows.map(r => Object.fromEntries(kept.map(h => [h, r[h] ?? ''])));
}
// ---- V5 report: counted in the browser from the result rows, never stored, no AI call ----
const META = / \/ (confidence|evidence|checked_at|review)$/;
const filled = v => String(v ?? '').trim() !== '';
const pct = (n, d) => d ? Math.round(n / d * 1000) / 10 : 0;
// Before = the kept columns of the file the job started from; after = the result rows. Rows line up by index.
export function reportAggregates(source, outputs, kept) {
  const rows = outputs.length, before = source.slice(0, rows), headers = rows ? Object.keys(outputs[0]) : [];
  const added = headers.filter(h => /^Result \d+: /.test(h) && !META.test(h));
  const count = (list, h) => list.filter(r => filled(r[h])).length;
  const fill = [...added, ...kept].map(h => { const b = kept.includes(h) ? count(before, h) : 0, a = count(outputs, h); return {column: h, before: b, after: a, before_pct: pct(b, rows), after_pct: pct(a, rows)}; });
  const distributions = added.map(h => {
    const tally = new Map();
    for (const r of outputs) { const v = filled(r[h]) ? String(r[h]).trim() : '(empty)'; tally.set(v, (tally.get(v) || 0) + 1); }
    const top = [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10).map(([value, n]) => ({value, count: n, pct: pct(n, rows)}));
    return {column: h, distinct: tally.size, top};
  });
  const reviewCols = headers.filter(h => / \/ review$/.test(h));
  const flagged = outputs.map((r, i) => reviewCols.some(h => r[h] === 'Review needed') ? i + 1 : 0).filter(Boolean);
  return {rows, columns_kept: kept.length, columns_added: added.length, fill, distributions, review: {count: flagged.length, pct: pct(flagged.length, rows), rows: flagged.slice(0, 50)}};
}
export function agentBrief(file, mapping, plan, aggregates) {
  return {file, mapping: mapping.map(({source, field, keep}) => ({source, field, keep})), plan, aggregates, generated_at: new Date().toISOString()};
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const n0 = n => Number(n).toLocaleString('en-US');
// One markup for the in-app cards and the downloaded report. SPAN data-card rule: every number names its source and carries a note.
export function reportCards(brief) {
  const a = brief.aggregates, f = brief.file.name;
  const card = (title, body, source, note, cls = '') => `<article class="rp-card${cls}"><h4>${esc(title)}</h4>${body}<p class="rp-src"><b>Source</b> ${esc(source)}</p><p class="rp-note"><b>Note</b> ${esc(note)}</p></article>`;
  const bar = (label, value, p, extra = '') => `<li><span class="rp-label">${esc(label)}</span><span class="rp-val">${esc(value)}</span><span class="rp-bar" aria-hidden="true"><i style="width:${Math.min(100, p)}%"></i>${extra}</span></li>`;
  const metric = (label, value) => `<div><dt>${esc(label)}</dt><dd class="money">${esc(value)}</dd></div>`;
  const out = [card('Summary', `<dl class="metrics">${metric('Result rows', n0(a.rows))}${metric('Columns kept', n0(a.columns_kept))}${metric('Columns added', n0(a.columns_added))}${metric('Flagged for review', n0(a.review.count))}</dl>`,
    `${n0(a.rows)} result rows of ${f}.`, 'Counted in your browser from the rows in the table below. Nothing was sent to a model for this report.', ' rp-wide')];
  out.push(card('Fill rate, before and after', `<ul class="rp-bars" data-kind="fill">${a.fill.map(x => bar(x.column, `${x.before_pct}% to ${x.after_pct}%`, x.after_pct, `<b style="width:${Math.min(100, x.before_pct)}%"></b>`)).join('')}</ul>`,
    `Non-empty cells per column in ${n0(a.rows)} rows. Before is your file, after is the result.`, 'Thin grey bar is your file, gold is the result. Added columns start at 0%.', ' rp-wide'));
  for (const d of a.distributions) out.push(card(d.column, `<ul class="rp-bars" data-kind="dist">${d.top.map(t => bar(t.value, `${n0(t.count)} (${t.pct}%)`, t.pct)).join('')}</ul>`,
    `${n0(a.rows)} values in the column ${d.column}.`, d.distinct > 10 ? `Top 10 of ${n0(d.distinct)} different values.` : `All ${n0(d.distinct)} different values. "skipped" means the row had no input for this step.`));
  out.push(card('Rows flagged for review', `<p class="rp-big">${n0(a.review.count)} <small>of ${n0(a.rows)} rows (${a.review.pct}%)</small></p>${a.review.rows.length ? `<p class="rp-rows">Rows ${a.review.rows.join(', ')}${a.review.count > a.review.rows.length ? ' and more' : ''}</p>` : ''}`,
    'Every review column in the result rows.', 'A row counts once even if several steps flagged it. Check these before you use the file.'));
  return out.join('');
}
// The downloaded report: one HTML file, inline CSS, no scripts.
export function reportHtml(brief) {
  const css = 'body{margin:0;background:#0D0F14;color:#E8E4DC;font:15px/1.6 Inter,system-ui,sans-serif}main{max-width:1100px;margin:0 auto;padding:32px 20px}h1{font-size:28px;line-height:1.15;margin:0 0 4px}h4{margin:0 0 10px;font-size:15px;overflow-wrap:anywhere}.lede{color:#A8A8A2;margin:0 0 24px}.rp-grid{display:flex;flex-wrap:wrap;gap:14px}.rp-card{flex:1 1 320px;min-width:0;background:#181C26;border:1px solid #2A2E3A;border-radius:10px;padding:16px 18px}.rp-wide{flex-basis:100%}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0}.metrics div{background:#1E2330;border-radius:6px;padding:12px 14px}.metrics dt{font-size:13px;color:#A8A8A2}.metrics dd{margin:4px 0 0;font:700 22px/1.1 ui-monospace,monospace}.rp-bars{list-style:none;margin:0;padding:0;display:grid;gap:8px}.rp-bars li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px}.rp-label{overflow-wrap:anywhere}.rp-val{font:13px ui-monospace,monospace;color:#A8A8A2}.rp-bar{grid-column:1/-1;position:relative;height:12px;border-radius:2px;background:#232838}.rp-bar i,.rp-bar b{position:absolute;left:0;bottom:0;height:8px;border-radius:2px;background:#C9A84C}.rp-bar b{top:0;bottom:auto;height:3px;background:#A8A8A2}.rp-src,.rp-note{margin:10px 0 0;font-size:13px;color:#A8A8A2}.rp-note{margin-top:2px}.rp-src b,.rp-note b{color:#E8E4DC;margin-right:6px}.rp-big{font:700 28px/1.1 ui-monospace,monospace;margin:0}.rp-big small{font:400 14px Inter,sans-serif;color:#A8A8A2}.rp-rows{font:13px ui-monospace,monospace;color:#A8A8A2;overflow-wrap:anywhere}';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(brief.file.name)} report</title><style>${css}</style></head><body><main><h1>${esc(brief.file.name)}</h1><p class="lede">Data Workbench report, generated ${esc(brief.generated_at.slice(0, 16).replace('T', ' '))} UTC. ${n0(brief.aggregates.rows)} rows, ${brief.plan.length} ${brief.plan.length === 1 ? 'step' : 'steps'}.</p><div class="rp-grid">${reportCards(brief)}</div></main></body></html>`;
}
export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const FILE_TYPES = /\.(csv|xlsx|json|txt|md|pdf)$/i, FILE_LIMIT = 10 * 1024 * 1024;
// ---- Desktop geometry ----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(Math.max(lo, hi), v));
// a = the usable desktop {x,y,w,h}. Corners take a 48px band so they are easy to hit.
export function snapZone(x, y, a, edge = 12) {
  const L = x <= a.x + edge, R = x >= a.x + a.w - edge;
  if (L || R) {
    if (y <= a.y + 48) return L ? 'top-left' : 'top-right';
    if (y >= a.y + a.h - 48) return L ? 'bottom-left' : 'bottom-right';
    return L ? 'left' : 'right';
  }
  return y <= a.y + edge ? 'max' : null;
}
export function zoneRect(zone, a) {
  const hw = Math.round(a.w / 2), hh = Math.round(a.h / 2);
  return {max:{x:a.x,y:a.y,w:a.w,h:a.h},left:{x:a.x,y:a.y,w:hw,h:a.h},right:{x:a.x+a.w-hw,y:a.y,w:hw,h:a.h},
    'top-left':{x:a.x,y:a.y,w:hw,h:hh},'top-right':{x:a.x+a.w-hw,y:a.y,w:hw,h:hh},
    'bottom-left':{x:a.x,y:a.y+a.h-hh,w:hw,h:hh},'bottom-right':{x:a.x+a.w-hw,y:a.y+a.h-hh,w:hw,h:hh}}[zone] || null;
}
export function fitRect(r, a, minW = 360, minH = 240) {
  const w = clamp(r.w, Math.min(minW, a.w), a.w), h = clamp(r.h, Math.min(minH, a.h), a.h);
  return {x: clamp(r.x, a.x, a.x + a.w - w), y: clamp(r.y, a.y, a.y + a.h - h), w, h};
}
// Resize from an edge ('n','se',...) by a pointer delta, never below the minimum and never off the desktop.
export function resizeRect(s, edge, dx, dy, a, minW = 360, minH = 240) {
  let {x, y, w, h} = s;
  if (edge.includes('e')) w = clamp(s.w + dx, minW, a.x + a.w - s.x);
  if (edge.includes('s')) h = clamp(s.h + dy, minH, a.y + a.h - s.y);
  if (edge.includes('w')) { x = clamp(s.x + dx, a.x, s.x + s.w - minW); w = s.x + s.w - x; }
  if (edge.includes('n')) { y = clamp(s.y + dy, a.y, s.y + s.h - minH); h = s.y + s.h - y; }
  return {x, y, w, h};
}
// The free grid cell closest to `want` ([col,row]); `taken` holds "col,row" strings. null when the grid is full.
export function nearestFreeCell(want, cols, rows, taken) {
  const [wc, wr] = [clamp(Math.round(want[0]), 0, cols - 1), clamp(Math.round(want[1]), 0, rows - 1)];
  let best = null, bestD = Infinity;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    if (taken.has(c + ',' + r)) continue;
    const d = (c - wc) ** 2 + (r - wr) ** 2 + c * 1e-6; // ties go to the left column
    if (d < bestD) { bestD = d; best = [c, r]; }
  }
  return best;
}
