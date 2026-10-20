// contrast.mjs : measure the scheme tokens with the WCAG 2 relative-luminance
// formula and print a table. Every foreground in the text tiers, including the
// accent -text twins, must clear 4.5:1 on bg, card and card-2 in BOTH schemes,
// plus the paper band pairs, or the build fails.
//
//   node scripts/contrast.mjs        exit 0 when every pair clears, 1 otherwise
//
// The final numbers are copied into system.css as comments next to the tokens,
// the same way the dark ones already are. No em dashes.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'system.css'), 'utf8');

function block(re) {
  const m = css.match(re);
  if (!m) throw new Error(`contrast: token block not found: ${re}`);
  const tokens = {};
  for (const t of m[1].matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gi)) {
    tokens[t[1]] = t[2];
  }
  return tokens;
}

const dark = block(/:root\s*\{([\s\S]*?)\}/);
const light = block(/:root\[data-scheme="light"\]\s*\{([\s\S]*?)\}/);
const lightTokens = { ...dark, ...light }; // light inherits every token it does not override

const FORE = ['text', 'muted', 'dim', 'win-text', 'build-text', 'think-text', 'human-text', 'danger-text'];
const BACK = ['bg', 'card', 'card-2'];
const PAPER_BACK = ['paper', 'paper-2'];
const PAPER_FORE = ['ink', 'paper-muted', 'marigold-ink'];

const hex = (h) => {
  let s = h.slice(1);
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const lum = (h) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (fg, bg) => {
  const a = lum(fg), b = lum(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

let fails = 0;
const rows = [];

function table(label, tokens, fores, backs) {
  console.log(`\n${label}`);
  console.log('  fg            ' + backs.map((b) => b.padStart(12)).join('') + '   verdict');
  for (const f of fores) {
    const cells = backs.map((b) => {
      const r = ratio(tokens[f], tokens[b]);
      const ok = r >= 4.5;
      if (!ok) fails++;
      rows.push(`${label} ${f} on ${b}: ${r.toFixed(2)}`);
      return r.toFixed(2).padStart(12) + (ok ? '' : '  FAIL');
    });
    console.log('  ' + f.padEnd(13) + cells.join('') + (backs.every((b) => ratio(tokens[f], tokens[b]) >= 4.5) ? '   AA' : '   FAIL'));
  }
}

table('dark  (bg/card/card-2)', dark, FORE, BACK);
table('light (bg/card/card-2)', lightTokens, FORE, BACK);
table('dark  paper band', dark, PAPER_FORE, PAPER_BACK);
table('light paper band', lightTokens, PAPER_FORE, PAPER_BACK);

console.log(`\n${rows.length} pairs measured, ${fails} below 4.5.`);
if (fails) {
  console.error('CONTRAST FAILED. Adjust the light values in system.css and re-run.');
  process.exit(1);
}
console.log('contrast: every pair clears 4.5:1 in both schemes.');
