// worker/psn.js : PlayStation "what is Deep playing". UNOFFICIAL API, kept in this one module.
//
// Flow is the one achievements-app/psn-api uses: NPSSO cookie -> auth code -> access token ->
// presence, falling back to the most recently played title. Sony can change or block any of
// it; callers must treat every throw as "no data" and show favorites.

const AUTH = 'https://ca.account.sony.com/api/authz/v3/oauth';
// The PS App's public client (the same values every psn-api client ships).
const CLIENT_ID = '09515159-7237-4370-9b40-3806e67c0891';
const BASIC = 'Basic MDk1MTUxNTktNzIzNy00MzcwLTliNDAtMzgwNmU2N2MwODkxOnVjUGprYTV0bnRCMktxc1A=';
const REDIRECT = 'com.scee.psxandroid.scecompcall://redirect';

async function getJson(fetcher, url, init) {
  const res = await fetcher(url, { ...init, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`psn ${res.status}`);
  return res.json();
}

export async function psnGame(npsso, fetcher = fetch) {
  const q = new URLSearchParams({ access_type: 'offline', client_id: CLIENT_ID, redirect_uri: REDIRECT, response_type: 'code', scope: 'psn:mobile.v2.core psn:clientapp' });
  const auth = await fetcher(`${AUTH}/authorize?${q}`, { headers: { Cookie: `npsso=${npsso}` }, redirect: 'manual', signal: AbortSignal.timeout(4000) });
  const code = new URLSearchParams((auth.headers.get('location') || '').split('?')[1] || '').get('code');
  if (!code) throw new Error('psn: no auth code');
  const tok = await getJson(fetcher, `${AUTH}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: BASIC },
    body: new URLSearchParams({ code, redirect_uri: REDIRECT, grant_type: 'authorization_code', token_format: 'jwt' }).toString(),
  });
  const h = { headers: { Authorization: `Bearer ${tok.access_token}` } };
  const p = await getJson(fetcher, 'https://m.np.playstation.com/api/userProfile/v1/internal/users/me/basicPresences?type=primary', h);
  const now = p?.basicPresence?.gameTitleInfoList?.[0]?.titleName;
  if (now) return { state: 'playing', title: String(now).slice(0, 120), at: new Date().toISOString() };
  const g = await getJson(fetcher, 'https://m.np.playstation.com/api/gamelist/v2/users/me/titles?limit=1&offset=0', h);
  const last = g?.titles?.[0];
  if (!last?.name) throw new Error('psn: no titles');
  return { state: 'recent', title: String(last.name).slice(0, 120), at: last.lastPlayedDateTime || null };
}
