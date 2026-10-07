#!/usr/bin/env node
// essay-audio.mjs : the listen-to-this version of each essay, read by an
// ElevenLabs voice, with the time each block starts so the page can follow
// along while it plays.
//
//   node scripts/essay-audio.mjs --latest 4         newest four essays
//   node scripts/essay-audio.mjs --slug week-46-the-empty-room-arc
//   node scripts/essay-audio.mjs --missing          every essay without audio
//   node scripts/essay-audio.mjs --missing --since 14   only essays from the last 14 days
//   node scripts/essay-audio.mjs --missing --dry-run    how many characters it would cost
//   add --force to redo files whose text has not changed
//
// Writes audio/<slug>.mp3 (64 kbps mono) and audio/<slug>.json (voice, length,
// block start times, a hash of the text read). build-data.mjs attaches the
// pair to the post only when both exist. A file whose text hash still matches
// is skipped, so reruns cost nothing.
//
// The voice lives in audio/voice.json. Change voice_id there, then rerun with
// --force to re-read every essay in the new voice.
//
// KEY: ELEVENLABS_API_KEY, else the file named by ELEVENLABS_KEY_FILE, else
// <vault>/Other/.secrets/elevenlabs_api_key (the same place publish.sh keeps
// its deploy key). The key is never printed, logged or written anywhere.
//
// Cost: ElevenLabs bills one credit per character on eleven_multilingual_v2.
// The character count is printed before each request and summed at the end.
// A quota or auth error stops the run without touching files already written.
// No em dashes.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { blockText } from './derive-posts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const AUDIO = join(root, 'audio');
mkdirSync(AUDIO, { recursive: true });

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const VOICE = JSON.parse(readFileSync(join(AUDIO, 'voice.json'), 'utf8'));
const MODEL = VOICE.model || 'eleven_multilingual_v2';
const FORMAT = 'mp3_44100_64';
const KBPS = 64;
const CHUNK = 2400;

function key() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY.trim();
  const f = process.env.ELEVENLABS_KEY_FILE || resolve(root, '..', '..', '..', '..', 'Other', '.secrets', 'elevenlabs_api_key');
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : '';
}

// What is read aloud: the title, the byline, the deck, then every block.
// Returns the blocks as a list of { i, text } where i is the body index
// (-1 for the intro) so start times can be mapped back onto the page.
export function narration(post) {
  const clean = (s) => String(s || '').replace(/>_/g, '').replace(/\s+/g, ' ').trim();
  const out = [{ i: -1, text: clean(`${post.title} By Sreedeep Surapaneni. ${post.deck || ''}`) }];
  (post.body || []).forEach((b, i) => {
    let t = clean(blockText(b));
    if (!t) return;
    if (b && (b.type === 'h2' || b.type === 'callout') && !/[.!?:]$/.test(t)) t += '.';
    out.push({ i, text: t });
  });
  return out;
}

// MP3 frames from the API carry an ID3 tag and a LAME "Info" frame. Both are
// stripped so the chunks join into one clean CBR stream whose length every
// browser reads the same way.
function stripHeaders(buf) {
  let o = 0;
  if (buf.slice(0, 3).toString('latin1') === 'ID3') {
    const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    o = 10 + sz;
  }
  while (o < buf.length - 1 && !(buf[o] === 0xff && (buf[o + 1] & 0xe0) === 0xe0)) o++;
  // first frame: MPEG1 layer III at 64 kbps, 44.1 kHz is 208 or 209 bytes
  const pad = (buf[o + 2] >> 1) & 1;
  const flen = Math.floor((144 * KBPS * 1000) / 44100) + pad;
  const first = buf.slice(o, o + flen).toString('latin1');
  if (first.includes('Info') || first.includes('Xing')) o += flen;
  return buf.slice(o);
}

async function speak(apiKey, text, prev) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE.voice_id}/with-timestamps?output_format=${FORMAT}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: VOICE.settings || { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
      ...(prev.length ? { previous_request_ids: prev.slice(-3) } : {}),
    }),
    signal: AbortSignal.timeout(120000),
  });
  const body = await res.text();
  if (!res.ok) {
    let msg = body.slice(0, 300);
    try { const j = JSON.parse(body); msg = (j.detail && (j.detail.message || j.detail.status)) || msg; } catch (e) {}
    const err = new Error(`ElevenLabs ${res.status}: ${msg}`);
    err.fatal = res.status === 401 || res.status === 402 || res.status === 429 || /quota|credit/i.test(msg);
    throw err;
  }
  const j = JSON.parse(body);
  return { audio: Buffer.from(j.audio_base64, 'base64'), align: j.alignment || j.normalized_alignment, id: res.headers.get('request-id') };
}

export async function render(post, apiKey, { dry = false } = {}) {
  const parts = narration(post);
  const full = parts.map((p) => p.text).join('\n\n');
  const sha = createHash('sha256').update(VOICE.voice_id + MODEL + full).digest('hex').slice(0, 16);
  if (dry) return { chars: full.length, sha };

  // Group blocks into chunks under CHUNK characters, never splitting a block.
  const chunks = [];
  for (const p of parts) {
    const last = chunks[chunks.length - 1];
    if (last && last.text.length + 2 + p.text.length <= CHUNK) {
      last.marks.push({ i: p.i, at: last.text.length + 2 });
      last.text += '\n\n' + p.text;
    } else chunks.push({ text: p.text, marks: [{ i: p.i, at: 0 }] });
  }

  const audio = [];
  const starts = [];
  const prev = [];
  let offset = 0;
  for (const c of chunks) {
    const r = await speak(apiKey, c.text, prev);
    if (r.id) prev.push(r.id);
    const mp3 = stripHeaders(r.audio);
    const st = (r.align && r.align.character_start_times_seconds) || [];
    for (const m of c.marks) starts.push({ i: m.i, t: +(offset + (st[m.at] || 0)).toFixed(2) });
    audio.push(mp3);
    offset += (mp3.length * 8) / (KBPS * 1000);
  }
  const buf = Buffer.concat(audio);
  writeFileSync(join(AUDIO, `${post.slug}.mp3`), buf);
  const meta = {
    slug: post.slug, voice_id: VOICE.voice_id, voice_name: VOICE.name, model: MODEL, format: FORMAT,
    chars: full.length, bytes: buf.length, duration: +offset.toFixed(1), starts, text_sha: sha,
    generated: new Date().toISOString(),
  };
  writeFileSync(join(AUDIO, `${post.slug}.json`), JSON.stringify(meta, null, 2) + '\n');
  return meta;
}

async function main() {
  const data = JSON.parse(readFileSync(join(root, 'content.json'), 'utf8'));
  const posts = (data.posts || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  let pick = posts;
  if (val('--slug')) pick = posts.filter((p) => p.slug === val('--slug'));
  if (val('--latest')) pick = pick.slice(0, Number(val('--latest')));
  if (val('--since')) {
    const cut = new Date(Date.now() - Number(val('--since')) * 864e5).toISOString().slice(0, 10);
    pick = pick.filter((p) => String(p.date) >= cut);
  }
  if (!val('--slug') && !val('--latest') && !has('--missing')) {
    console.error('say which essays: --latest N, --slug <slug>, or --missing');
    process.exit(2);
  }
  const dry = has('--dry-run');
  const apiKey = dry ? '' : key();
  if (!dry && !apiKey) {
    console.error('essay-audio: no ElevenLabs key. Set ELEVENLABS_API_KEY or put it in Other/.secrets/elevenlabs_api_key. Nothing generated.');
    process.exit(2);
  }

  let spent = 0, made = 0, skipped = 0;
  for (const p of pick) {
    const plan = await render(p, '', { dry: true });
    const metaPath = join(AUDIO, `${p.slug}.json`);
    const cur = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : null;
    if (cur && cur.text_sha === plan.sha && existsSync(join(AUDIO, `${p.slug}.mp3`)) && !has('--force')) { skipped++; continue; }
    if (dry) { console.log(`would read ${p.slug}: ${plan.chars} characters`); spent += plan.chars; continue; }
    console.log(`reading ${p.slug}: ${plan.chars} characters ...`);
    try {
      const m = await render(p, apiKey);
      spent += m.chars; made++;
      console.log(`  audio/${p.slug}.mp3  ${(m.bytes / 1024).toFixed(0)} KB, ${Math.floor(m.duration / 60)}:${String(Math.round(m.duration % 60)).padStart(2, '0')}`);
    } catch (e) {
      console.error(`  failed: ${e.message}`);
      if (e.fatal) { console.error('essay-audio: stopping, the account refused the request.'); process.exitCode = 3; break; }
      process.exitCode = 1;
    }
  }
  console.log(`essay-audio: ${dry ? 'would spend' : 'spent'} ${spent} characters, ${made} made, ${skipped} already current, voice ${VOICE.name}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
