// worker/connectors.js : connector adapters for DeepBot (docs/toolkit-v4-api.md section 9).
// No db. Every call takes c = {key, base, fetch}. The key goes into the X-API-Key header and nowhere else:
// never into a return value, an error message or a log line.

const enc = new TextEncoder();
const dec = new TextDecoder();
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (ch) => ch.charCodeAt(0));

// shortcut: the key is SHA-256 of the secret, no KDF. Fine for a random 32 byte secret (openssl rand -base64 32); upgrade if a human-chosen secret is ever used.
const aes = async (secret) => crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', enc.encode(secret)), 'AES-GCM', false, ['encrypt', 'decrypt']);
// aad binds a ciphertext to its row, so a copied value does not open under another user or provider.
export async function seal(secret, aad, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, await aes(secret), enc.encode(plain)));
  return `${b64(iv)}.${b64(ct)}`;
}
export async function unseal(secret, aad, sealed) {
  const [iv, ct] = String(sealed).split('.').map(unb64);
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(aad) }, await aes(secret), ct));
}

export const KEY_RE = /\b(?:(?:hb|cb|dhk)_live_|whsec_)[A-Za-z0-9_-]{8,}/g; // a pasted key must not reach the model, a turn or ai_log
export const maskKey = (key) => `${key.slice(0, 8)}****${key.slice(-4)}`;

const HB_MAX_CONTACTS = 2000;
const FILE_MAX_BYTES = 20 * 1024 * 1024;

async function call(c, method, path, body) {
  const scrub = (s) => clip(s, 200).split(c.key).join('[key]');
  let res;
  try {
    res = await c.fetch(c.base + path, {
      method,
      headers: { 'x-api-key': c.key, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch { return { error: 'provider_down', message: 'The provider did not answer.' }; }
  const data = await res.json().catch(() => null);
  if (res.ok) return { data };
  if (res.status === 401) return { error: 'invalid_key', message: 'The provider refused this key.' };
  if (res.status === 403) return { error: 'not_allowed', message: c.deny403 || 'This key is not allowed to do that.' };
  if (res.status >= 500) return { error: 'provider_down', message: 'The provider is having trouble.' };
  return { error: 'provider_refused', message: scrub(data?.error || data?.detail || `HTTP ${res.status}`) };
}
const list = (d, k) => (Array.isArray(d) ? d : Array.isArray(d?.[k]) ? d[k] : []);
const str = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
const bad = (message) => ({ error: 'invalid_args', message });

// --- ChampHarbinger: hb_live_ key, allowlisted routes only (goal/plan, import-csv, campaigns, overview/today, outreach/drafts, integrations/status)
function contactRow(row, mapping) {
  const by = {};
  for (const m of mapping) if (m.keep !== false) by[m.field] = String(row[m.source] ?? '').trim();
  const name = by.person_name || `${by.first_name || ''} ${by.last_name || ''}`.trim() || by.email || by.linkedin_url || '';
  return { name, company: by.company || null, domain: by.domain || null, title: by.title || null, email: by.email || null, linkedin: by.linkedin_url || null, phone: by.phone || null, country: by.country || null, location: [by.city, by.country].filter(Boolean).join(', ') || null };
}
function checkMapping(mapping, headers, fields) {
  if (!Array.isArray(mapping) || !mapping.length || mapping.length > 200) return 'mapping takes 1 to 200 items.';
  if (mapping.some((m) => !m || !headers.includes(m.source) || !fields.includes(m.field))) return 'mapping needs {source, field} with a header of the file and a known field.';
  if (!mapping.some((m) => m.keep !== false && ['person_name', 'first_name', 'email', 'linkedin_url'].includes(m.field))) return 'mapping needs a name, email or LinkedIn column.';
  return null;
}

const harbinger = {
  id: 'harbinger', label: 'ChampHarbinger', prefix: 'hb_live_',
  deny403: 'This key is not allowed to do that. ChampHarbinger is invite-only.',
  base: (env) => env.HARBINGER_API_URL || 'https://champ-harbinger.deep-ae0.workers.dev',
  async test(c) {
    const r = await call(c, 'GET', '/api/integrations/status');
    return r.error ? r : { ok: true, label: clip(r.data?.account?.email || r.data?.email || 'ChampHarbinger', 80) };
  },
  pulls: {
    capacity_today: { does: 'Sends available today per mailbox.', run: (c) => call(c, 'GET', '/api/overview/today') },
    campaigns: { does: 'Your campaigns.', run: async (c) => { const r = await call(c, 'GET', '/api/campaigns'); return r.error ? r : { data: list(r.data, 'campaigns').slice(0, 50).map(({ id, name, status }) => ({ id, name, status })) }; } },
    // Harbinger's drafts route needs ?sequence=, so list sequences (GET /api/outreach) first; shortcut: 5 sequences max, 50 drafts max.
    drafts_pending: {
      does: 'Drafts waiting for your approval. args: {sequence?} (a sequence id; default is your 5 newest sequences).',
      run: async (c, a) => {
        let ids = [];
        if (a.sequence !== undefined) { if (!ID_RE.test(String(a.sequence))) return bad('sequence is a ChampHarbinger sequence id.'); ids = [String(a.sequence)]; }
        else { const s = await call(c, 'GET', '/api/outreach'); if (s.error) return s; ids = list(s.data, 'sequences').slice(0, 5).map((x) => x.id).filter((id) => ID_RE.test(String(id))); }
        const out = [];
        for (const id of ids) { const r = await call(c, 'GET', `/api/outreach/drafts?sequence=${encodeURIComponent(id)}`); if (r.error) return r; out.push(...list(r.data, 'drafts')); }
        return { data: out.slice(0, 50) };
      },
    },
  },
  acts: {
    plan_campaign: {
      does: 'Size a lead gen goal to your mailbox capacity. Spends nothing. args: {goal}.',
      async stage(c, a) {
        if (!str(a.goal, 3, 500)) return bad('goal takes 3 to 500 characters.');
        return { args: { goal: a.goal.trim() }, preview: { goal: a.goal.trim(), note: 'Creates a plan in ChampHarbinger from this goal only. Spends nothing and sends nothing.' } };
      },
      approve: (c, a) => call(c, 'POST', '/api/goal/plan', { goal: a.goal }),
    },
    push_campaign: {
      does: 'Import a file as contacts and create a campaign. Sending stays inside ChampHarbinger.',
      async stage(c, a, h) {
        const t = await h.csv(a.file_id);
        if (t.error) return t;
        if (!str(a.name, 1, 120)) return bad('name takes 1 to 120 characters.');
        const m = checkMapping(a.mapping, t.headers, h.fields);
        if (m) return bad(m);
        return {
          args: { file_id: a.file_id, mapping: a.mapping, name: a.name.trim() },
          preview: { name: a.name.trim(), file: t.name, rows: t.rows.length, will_import: Math.min(t.rows.length, HB_MAX_CONTACTS), fields: a.mapping.filter((x) => x.keep !== false).map((x) => x.field), note: 'Imports the contacts and creates a campaign. ChampHarbinger then enriches the imported companies against your enrichment budget. Nothing is sent: you approve sending inside ChampHarbinger.' },
        };
      },
      async approve(c, a, h) {
        const t = await h.csv(a.file_id);
        if (t.error) return t;
        const created = await call(c, 'POST', '/api/campaigns', { name: a.name });
        if (created.error) return created;
        const id = created.data?.id;
        if (!id) return { error: 'provider_refused', message: 'ChampHarbinger did not return a campaign id.' };
        const contacts = t.rows.slice(0, HB_MAX_CONTACTS).map((r) => contactRow(r, a.mapping));
        const imp = await call(c, 'POST', '/api/import-csv', { campaignId: id, shape: 'contacts', contacts });
        if (imp.error) return { ...imp, message: `${imp.message} Campaign ${id} was created without contacts.` };
        return { data: { campaign_id: id, imported: contacts.length, approve_url: `${c.base}/campaigns/${encodeURIComponent(id)}` } };
      },
    },
  },
};

// --- ChampBeam: cb_live_ key (X-API-Key)
const ID_RE = /^[\w-]{1,64}$/;
const beam = {
  id: 'beam', label: 'ChampBeam', prefix: 'cb_live_',
  deny403: 'ChampBeam refused this key for that. The key may lack access, or the account has no organization selected.',
  base: (env) => env.BEAM_API_URL || 'https://champbeam.com',
  async test(c) {
    const r = await call(c, 'GET', '/api/v1/auth/me');
    return r.error ? r : { ok: true, label: clip(r.data?.email || 'ChampBeam', 80) };
  },
  pulls: {
    stats: { does: 'Opens and viewers of one shared file. args: {id}.', run: (c, a) => (ID_RE.test(String(a.id)) ? call(c, 'GET', `/api/v1/files/${a.id}/summary`) : bad('id is the ChampBeam file id.')) },
  },
  acts: {
    share_file: {
      does: 'Upload a toolkit file to ChampBeam and get a share link.',
      async stage(c, a, h) {
        const f = await h.file(a.file_id);
        if (f.error) return f;
        if (f.bytes.byteLength < 1 || f.bytes.byteLength > FILE_MAX_BYTES) return bad('The file must be 1 byte to 20 MB.');
        return { args: { file_id: a.file_id }, preview: { file: f.name, size: f.bytes.byteLength, note: 'Uploads this file to ChampBeam and creates a share link.' } };
      },
      async approve(c, a, h) {
        const f = await h.file(a.file_id);
        if (f.error) return f;
        const init = await call(c, 'POST', '/api/v1/files', { filename: f.name, content_type: f.mime, size_bytes: f.bytes.byteLength });
        if (init.error) return init;
        const { file_id: id, presigned_put_url: put, headers = {} } = init.data || {};
        if (!id || !put) return { error: 'provider_refused', message: 'ChampBeam did not return an upload target.' };
        const own = put.startsWith('/'); // ChampBeam's own blob endpoint takes the key; a presigned URL must not
        try {
          const up = await c.fetch(own ? c.base + put : put, { method: 'PUT', headers: { ...headers, 'content-type': f.mime, ...(own ? { 'x-api-key': c.key } : {}) }, body: f.bytes, signal: AbortSignal.timeout(30000) });
          if (!up.ok) return { error: 'provider_refused', message: 'The upload to ChampBeam failed.' };
        } catch { return { error: 'provider_down', message: 'The upload to ChampBeam failed.' }; }
        const fin = await call(c, 'POST', `/api/v1/files/${id}/finalize`, {});
        return fin.error ? fin : { data: { file_id: id, share_url: fin.data?.serve_url ?? null } };
      },
    },
  },
};

export const CONNECTORS = { harbinger, beam };
