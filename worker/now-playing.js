// worker/now-playing.js : public "off the clock" feed for deependhq.com (docs/toolkit-v4-api.md section 6).
//
//   GET  /api/now-playing        public, cached 120 s. No secrets -> the launch state.
//   POST /api/spotify/start      signed-in admin only: returns the Spotify authorize URL with a one-time state.
//   GET  /api/spotify/callback   Spotify redirects here; a known state stores the refresh token in KV.
//
// Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, PSN_NPSSO (optional). KV: SPOTIFY_KV.

import { adminFromRequest } from './toolkit.js';
import { psnGame } from './psn.js';

export const FAVORITES = ['Split Fiction', 'Overwatch 2', "Marvel's Wolverine"];
const TOKEN_KEY = 'spotify:refresh_token';
const SCOPES = 'user-read-currently-playing user-read-recently-played';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

const json = (body, status = 200, cache = 'no-store') => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, 'x-content-type-options': 'nosniff' },
});
const basic = (env) => 'Basic ' + btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
const https = (u, prefix) => (typeof u === 'string' && u.startsWith(prefix) ? u : null);

function track(t, state, at) {
  const imgs = t?.album?.images || [];
  const img = imgs.find((i) => i.width && i.width <= 300) || imgs[0];
  return {
    state,
    track: String(t?.name || '').slice(0, 200) || null,
    artist: (t?.artists || []).map((a) => a?.name).filter(Boolean).join(', ').slice(0, 200) || null,
    url: https(t?.external_urls?.spotify, 'https://open.spotify.com/'),
    art: https(img?.url, 'https://i.scdn.co/'),
    at,
  };
}

const OFF = { state: 'off', track: null, artist: null, url: null, art: null, at: null };

async function spotify(env) {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_KV) return OFF;
  const refresh = await env.SPOTIFY_KV.get(TOKEN_KEY);
  if (!refresh) return OFF;
  const tr = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { authorization: basic(env), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }).toString(),
  });
  if (!tr.ok) return OFF;
  const tok = await tr.json();
  if (tok.refresh_token && tok.refresh_token !== refresh) await env.SPOTIFY_KV.put(TOKEN_KEY, tok.refresh_token); // rotated
  const h = { headers: { authorization: `Bearer ${tok.access_token}` } };
  const now = await fetch('https://api.spotify.com/v1/me/player/currently-playing?additional_types=track', h);
  if (now.status === 200) {
    const d = await now.json();
    if (d?.is_playing && d.item?.type !== 'episode' && d.item) return track(d.item, 'playing', new Date().toISOString());
  }
  const rec = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', h);
  if (!rec.ok) return OFF;
  const item = (await rec.json())?.items?.[0];
  return item?.track ? track(item.track, 'recent', item.played_at || null) : OFF;
}

async function game(env) {
  if (!env.PSN_NPSSO) return { state: 'favorites', title: null, at: null };
  try {
    return await psnGame(env.PSN_NPSSO);
  } catch {
    return { state: 'favorites', title: null, at: null }; // unofficial API: any failure is just "no data"
  }
}

async function nowPlaying(request, env, ctx) {
  const cache = globalThis.caches?.default;
  const key = new Request(new URL('/api/now-playing', request.url).href);
  const hit = cache && (await cache.match(key));
  if (hit) return hit;
  const [s, g] = await Promise.all([spotify(env).catch(() => OFF), game(env)]);
  const res = json({ spotify: s, game: g, favorites: FAVORITES }, 200, 'public, max-age=120');
  if (cache) {
    const put = cache.put(key, res.clone());
    try { ctx.waitUntil(put); } catch { await put; }
  }
  return res;
}

export async function handleNowPlaying(request, env, ctx, url) {
  if (url.pathname === '/api/now-playing') {
    return request.method === 'GET' || request.method === 'HEAD' ? nowPlaying(request, env, ctx) : json({ error: 'method_not_allowed' }, 405);
  }
  if (url.pathname === '/api/spotify/start') {
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    const admin = await adminFromRequest(request, env);
    if (admin.error) return json({ error: admin.error }, admin.status);
    if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET || !env.SPOTIFY_KV) return json({ error: 'spotify_not_configured' }, 503);
    const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    await env.SPOTIFY_KV.put(`spotify:state:${state}`, admin.uid, { expirationTtl: 600 });
    const q = new URLSearchParams({ client_id: env.SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: `${url.origin}/api/spotify/callback`, scope: SCOPES, state });
    return json({ url: `${SPOTIFY_ACCOUNTS}/authorize?${q}` });
  }
  if (url.pathname === '/api/spotify/callback') {
    if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
    const state = url.searchParams.get('state') || '';
    const code = url.searchParams.get('code') || '';
    if (!env.SPOTIFY_KV || !/^[0-9a-f]{32}$/.test(state) || !code) return json({ error: 'invalid_state' }, 400);
    const k = `spotify:state:${state}`;
    if (!(await env.SPOTIFY_KV.get(k))) return json({ error: 'invalid_state' }, 400);
    await env.SPOTIFY_KV.delete(k); // one-time
    const tr = await fetch(`${SPOTIFY_ACCOUNTS}/api/token`, {
      method: 'POST',
      headers: { authorization: basic(env), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: `${url.origin}/api/spotify/callback` }).toString(),
    });
    const tok = tr.ok ? await tr.json() : null;
    if (!tok?.refresh_token) return json({ error: 'spotify_exchange_failed' }, 502);
    await env.SPOTIFY_KV.put(TOKEN_KEY, tok.refresh_token);
    return new Response('Spotify connected. You can close this tab.', { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  }
  return null;
}
