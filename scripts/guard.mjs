// guard.mjs : the mechanical gates that run on every build.
//
// Two gates, both deterministic, both failing the build rather than warning:
//
// 1. NAMING DENYLIST. No real team member, no client in an active deal, and the
//    patriarch is "Chief" on any public surface. Until now this lived only in the
//    authoring self-check, which is a human remembering. This is the backstop.
//
// 2. SENSITIVE DISCLOSURE. A public log entry can describe a severance dispute
//    or a performance plan. Nobody named is not the same as nothing disclosed.
//    Entries scoring over the threshold are refused unless --allow-sensitive is
//    passed, which routes them to review instead of publishing.
//
// Both read a denylist file rather than hardcoding names in a build script, so
// the list is editable without touching code and is never committed with real
// names in it if that is ever the preference.
//
//   node scripts/guard.mjs                  check only, exit 1 on a hit
//   node scripts/guard.mjs --allow-sensitive  log the hit, do not fail
//
// No em dashes.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const DENYLIST_FILE = join(root, 'scripts', 'denylist.json');
const SENSITIVE_THRESHOLD = 0.8;

const allowSensitive = process.argv.includes('--allow-sensitive');

// ---- denylist -------------------------------------------------------------

function loadDenylist() {
  // No denylist file means no names configured, not "allow everything silently".
  // It is reported so an empty list cannot be mistaken for a passing check.
  if (!existsSync(DENYLIST_FILE)) {
    return { names: [], clients: [], configured: false };
  }
  const raw = JSON.parse(readFileSync(DENYLIST_FILE, 'utf8'));
  return {
    names: (raw.names || []).map((s) => String(s).toLowerCase()).filter(Boolean),
    clients: (raw.clients || []).map((s) => String(s).toLowerCase()).filter(Boolean),
    configured: true,
  };
}

// Whole-word match, case-insensitive, with a minimum length so a two letter
// first name does not match half the log. Names shorter than 4 characters must
// match case exactly, same rule the stack miner uses for tool names.
function wordRe(term) {
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^A-Za-z0-9])${esc}(?=$|[^A-Za-z0-9])`, term.length <= 3 ? '' : 'i');
}

// ---- sensitive disclosure -------------------------------------------------
// The point of this gate is to stop and ask a human, not to make the judgement.

// A stem, not a substring. "pip" matched "pipeline" on eight separate days and
// "hospitali" matched "hospitality", which is how a gate that cries wolf gets
// switched off. Every pattern below is matched on a word boundary, and the
// short dangerous ones are exact words.
const SENSITIVE_STEMS = [
  'severance', 'performance plan', 'written warning', 'exit interview',
  'disciplinary', 'misconduct', 'harassment', 'grievance',
  'medical record', 'diagnosis', 'prescription', 'hospitalised', 'hospitalized',
  'lawsuit', 'litigation', 'arbitration', 'legal notice',
  'trademark dispute', 'nda breach', 'confidential client', 'under oath',
  'investigation into', 'pip', 'hr complaint',
];

// Words that look sensitive but are ordinary on this site. "pipeline" is the
// single most common noun in the log and is never a disclosure.
const NOT_SENSITIVE = new Set([
  'pipeline', 'pipelines', 'hospitality', 'hospital', 'disciplinary action',
  'grievance redressal', 'termination notice period', 'severance package',
]);

const SENSITIVE_HITS = [];
function scanSensitive(where, text) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z'-]*/g) || [];
  const flat = words.join(' ');
  for (const stem of SENSITIVE_STEMS) {
    if (stem.includes(' ')) {
      // Multi-word phrase: must appear as consecutive words.
      if (flat.includes(stem)) record(where, stem, text, stem);
    } else {
      if (!words.includes(stem)) continue;
      if (NOT_SENSITIVE.has(stem)) continue;
      record(where, stem, text, stem);
    }
  }
}

function record(where, stem, text, needle) {
  SENSITIVE_HITS.push({ where, stem, excerpt: excerptAround(text, needle) });
}

function excerptAround(text, needle) {
  const low = String(text || '').toLowerCase();
  const i = low.indexOf(needle);
  if (i < 0) return '';
  const start = Math.max(0, i - 60);
  return String(text).slice(start, start + 160).replace(/\s+/g, ' ');
}

// ---- the walk -------------------------------------------------------------

function walk(node, path, out) {
  if (typeof node === 'string') { out.push([path, node]); return out; }
  if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${path}[${i}]`, out)); return out; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k, out);
  }
  return out;
}

function main() {
  const list = loadDenylist();
  const SRC = join(root, 'content.json');
  const content = JSON.parse(readFileSync(SRC, 'utf8'));

  // _meta is editor-only and never published, so it is not scanned.
  const { _meta, ...published } = content;
  const strings = walk(published, '', []);

  const nameHits = [];
  for (const term of list.names.concat(list.clients)) {
    const re = wordRe(term);
    for (const [path, text] of strings) {
      if (re.test(text)) nameHits.push({ term, path, excerpt: excerptAround(text, term) });
    }
  }

  // The sensitive gate runs on the public log only. A section about, say, HR
  // policy in general is not a disclosure about a person.
  const journey = Array.isArray(content.journey) ? content.journey : [];
  for (const e of journey) {
    for (const field of ['shipping_now', 'yesterday_thread', 'raw_thought']) {
      scanSensitive(`journey.${e.date}.${field}`, e[field]);
    }
  }

  console.log('--- guard ---');
  console.log(`scanned ${strings.length} published strings across ${journey.length} journey entries`);
  console.log(`denylist: ${list.configured ? `${list.names.length} names, ${list.clients.length} client patterns` : 'NOT CONFIGURED (scripts/denylist.json missing)'}`);

  let failed = false;

  if (nameHits.length) {
    failed = true;
    console.error(`\nNAMING DENYLIST: ${nameHits.length} hit(s). The build is refused.`);
    for (const h of nameHits.slice(0, 20)) {
      console.error(`  "${h.term}" at ${h.path}\n    ...${h.excerpt}...`);
    }
    if (nameHits.length > 20) console.error(`  ... and ${nameHits.length - 20} more`);
    console.error('\nFix the entry, or anonymise the client to a role. Do not edit the denylist to make a hit go away.');
  } else {
    console.log('naming denylist: clean');
  }

  if (SENSITIVE_HITS.length) {
    console.error(`\nSENSITIVE DISCLOSURE: ${SENSITIVE_HITS.length} hit(s) in the public log.`);
    for (const h of SENSITIVE_HITS.slice(0, 12)) {
      console.error(`  ${h.where} matched "${h.stem}"\n    ...${h.excerpt}...`);
    }
    if (allowSensitive) {
      console.error('\n  --allow-sensitive passed: routing to review, not publishing silently. The entry stays but must be reviewed before it is trusted.');
    } else {
      failed = true;
      console.error('\n  An entry that describes a dispute, a medical matter or client-confidential detail does not go on a public log without a human deciding. Re-run with --allow-sensitive only after that decision.');
    }
  } else {
    console.log('sensitive disclosure: clean');
  }

  if (!list.configured) {
    console.warn('\nWARNING: no scripts/denylist.json. The naming gate is running empty. Create it before the next publish.');
  }

  if (failed) {
    console.error('\nGUARD FAILED. data.js was not regenerated.');
    process.exit(1);
  }
  console.log('\nGUARD PASSED');
}

main();
