// Users never see more than 2 decimals. Costs and quotes round up to the cent; pass 'down' for balances and remaining allowance.
export function money(micro, round = 'up') {
  const n = Number(micro) || 0, abs = Math.abs(n);
  if (abs > 0 && abs < 10000) return n < 0 ? '-under $0.01' : 'under $0.01';
  const cents = (round === 'down' ? Math.floor : Math.ceil)(abs / 10000);
  return (n < 0 ? '-' : '') + (cents / 100).toLocaleString('en-US', {style: 'currency', currency: 'USD'});
}
export function validateFileTable(table) {
  if (!table.rows.length) throw new Error('This file has no data rows. Add a header and at least one row.');
  if (table.rows.length > 1000) throw new Error('Use up to 1,000 rows per file. Split the file and try again.');
  const headers = [...new Set(table.rows.flatMap(r => Object.keys(r)))];
  if (headers.length > 30 || headers.some(h => !h || h.length > 100 || ['__proto__','prototype','constructor'].includes(h))) throw new Error('Use up to 30 named columns, each at most 100 characters, without reserved names.');
  if (table.rows.some(r => Object.values(r).some(v => String(v).length > 1000))) throw new Error('A cell exceeds 1,000 characters. Shorten it before uploading; nothing has been truncated.');
  return { headers, rows: table.rows };
}
export function quoteSummary(quotes) {
  const allowance = quotes[quotes.length - 1].allowance;
  const micro = quotes.reduce((s,q) => s+q.max_cost_micro,0);
  const credits = quotes.reduce((s,q) => s+q.max_credits,0);
  const rows = quotes.reduce((s,q) => s+q.row_count,0);
  const reasons = [];
  if (allowance.disabled) reasons.push('This account is disabled. Contact an administrator.');
  if (quotes.some(q => !q.fits_batch_ceiling)) reasons.push('A batch exceeds the $0.25 limit. Use fewer rows or operations.');
  if (micro <= 0) reasons.push('No usable cells for these operations. Check your column mapping.');
  if (credits > allowance.credits_available) reasons.push('Your balance is too low. Ask an administrator for credits.');
  if (credits > allowance.remaining_daily_credits) reasons.push('Daily spending allowance reached or not enabled. Ask an administrator, or return after the UTC day resets.');
  if (rows > allowance.remaining_daily_rows) reasons.push('Daily row allowance reached or not enabled. Ask an administrator.');
  return {micro,credits,rows,allowance,reasons};
}
export function resultRows(rows, columns, results) {
  return rows.map((row,i) => {
    const out = {...row};
    columns.forEach((spec,c) => {
      const result = results[c];
      const index = result?.row_map?.[i];
      const item = index >= 0 ? result?.items?.[index] : null;
      const prefix = `Result ${c+1}: ${spec.column} / ${spec.op}`;
      out[prefix] = item?.label || (index === -1 ? 'skipped' : 'not_run');
      out[prefix+' / confidence'] = item?.confidence ?? '';
      out[prefix+' / review'] = item ? (item.review ? 'Review needed' : 'No flag') : 'Review needed';
      out[prefix+' / evidence'] = [item?.source,item?.note,...['name','title','company'].filter(k => item?.[k]).map(k => `${k}: ${item[k]}`)].filter(Boolean).join('; ') || 'No independent source supplied';
      out[prefix+' / checked_at'] = item?.checked_at || '';
    });
    return out;
  });
}
// shortcut: text heuristics cannot prove a file is safe; use a security scanner for release approval.
export function scanText(text) {
  const rules = [
    ['Private key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['Possible access token',/\b(?:sk[-_]|gh[pousr]_|github_pat_|AKIA)[A-Za-z0-9_-]{12,}/],
    ['Assigned secret',/\b(?:password|secret|api[_-]?key|token)\b\s*[=:]\s*["']?[^\s"']{6,}/i],
    ['Email address',/\b[^\s@]+@[^\s@]+\.[A-Za-z]{2,}\b/],
    ['Sensitive language',/\b(?:confidential|social security|passport number|bank account)\b/i],
  ];
  const findings=[];
  text.split(/\r?\n/).forEach((line,i) => rules.forEach(([type,re]) => { if(re.test(line)) findings.push({line:i+1,type}); }));
  return findings;
}
