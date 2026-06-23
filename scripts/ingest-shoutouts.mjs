#!/usr/bin/env node
// ingest-shoutouts.mjs
// Scans the Celsus vault for github repos the owner dispatched/saved and writes
// them to scripts/shoutout-candidates.json as a REVIEW QUEUE. Nothing is ever
// auto-published to the live site: a human promotes vetted entries into
// content.json -> shoutouts.items. This protects a public persona surface from
// placeholders, ToS-risky scrapers, and bot-evasion tooling.
// No deps. Node 18+. Any failure is caught so a publish never breaks.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const vault = join(repo, '..', '..', '..', '..');
const SRC = join(repo, 'content.json');
const OUT = join(here, 'shoutout-candidates.json');
const SCAN_DIRS = ['Inbox', 'Atlas/Context Docs', 'Atlas/Products'];
const RE = /https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g;
// owners that are obviously placeholders, and name patterns that are unsafe to
// shout out publicly (scrapers, anti-detect / bot-evasion). Flagged, not silently dropped.
const BAD_OWNER = new Set(['your-org', 'example', 'org', 'user', 'test', 'username']);
const FLAG = /(anti-?detect|scraper|scrape|bot[-_]?detection|captcha|stealth)/i;

const walk = (dir, out = [], depth = 0) => {
  if (depth > 4) return out;
  let ents = []; try { ents = readdirSync(dir); } catch { return out; }
  for (const e of ents) {
    const fp = join(dir, e); let st; try { st = statSync(fp); } catch { continue; }
    if (st.isDirectory()) walk(fp, out, depth + 1);
    else if (e.endsWith('.md')) out.push(fp);
  }
  return out;
};

try {
  const content = JSON.parse(readFileSync(SRC, 'utf8'));
  const live = new Set(((content.shoutouts && content.shoutouts.items) || []).map((i) => i.url.toLowerCase()));
  const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { candidates: [] };
  const seen = new Set(prior.candidates.map((c) => c.url.toLowerCase()));
  const fresh = [];
  for (const d of SCAN_DIRS) {
    for (const f of walk(join(vault, d))) {
      let txt = ''; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
      let m;
      while ((m = RE.exec(txt))) {
        const owner = m[1], name = m[2].replace(/\.git$/, '');
        const url = `https://github.com/${owner}/${name}`;
        const key = url.toLowerCase();
        if (owner.toLowerCase() === 'champ-deep') continue;
        if (live.has(key) || seen.has(key)) continue;
        seen.add(key);
        fresh.push({
          name, repo: `${owner}/${name}`, url,
          review: BAD_OWNER.has(owner.toLowerCase()) ? 'placeholder' : (FLAG.test(name) ? 'flagged-sensitive' : 'pending'),
          source: f.replace(vault + '/', ''),
        });
      }
    }
  }
  const all = [...prior.candidates, ...fresh];
  writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString().slice(0, 10), note: 'Review queue. Promote vetted entries into content.json shoutouts.items by hand.', candidates: all }, null, 2));
  console.log(`ingest-shoutouts: ${fresh.length} new candidate(s) queued for review (${all.length} total). Nothing published.`);
} catch (err) { console.error('ingest-shoutouts skipped:', err.message); }
