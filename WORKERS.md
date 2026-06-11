# deependhq.com — live endpoints (Cloudflare Workers)

The site works fully without these. They are progressive enhancement: when a
Worker is present the ticker and newsletter go live; when it is absent the site
falls back to static values in `content.json`. Deploy as Cloudflare Pages
Functions (a `functions/` dir) or standalone Workers routed on `deependhq.com`.

## GET /api/status  (powers Ticker.jsx)

Aggregates a few live signals. Cache 30-60s. Must return JSON; any missing key
falls back to the static `DH_DATA.status` value. The clock is computed
client-side and is NOT needed here.

Response shape:

```json
{
  "state": "shipping",
  "weather": "24C clear",
  "commits_today": 7,
  "now_playing": "Bonobo - Migration",
  "reading": "The Power Broker - Caro",
  "last_ship": "deependhq /writing - 2h ago",
  "uptime_days": 214
}
```

Example (Pages Function `functions/api/status.js`):

```js
export async function onRequest(context) {
  const { env } = context;
  const out = {};
  // GitHub commits today across the Champ-Deep org
  try {
    const since = new Date(); since.setUTCHours(0,0,0,0);
    const r = await fetch(
      `https://api.github.com/search/commits?q=org:Champ-Deep+author-date:>=${since.toISOString().slice(0,10)}`,
      { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
                   'Accept': 'application/vnd.github.cloak-preview+json',
                   'User-Agent': 'deependhq' } });
    if (r.ok) out.commits_today = (await r.json()).total_count;
  } catch (e) {}
  // Weather (OpenWeather)
  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=Bangalore,IN&units=metric&appid=${env.OWM_KEY}`);
    if (r.ok) { const w = await r.json(); out.weather = `${Math.round(w.main.temp)}C ${w.weather[0].main.toLowerCase()}`; }
  } catch (e) {}
  // Spotify now-playing (refresh-token flow) -> out.now_playing  (left as TODO)
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=45' } });
}
```

Secrets needed (Cloudflare Pages > Settings > Environment variables):
`GITHUB_TOKEN` (read-only, public repos), `OWM_KEY`, and Spotify refresh-token vars if used.

## POST /api/newsletter  (powers Dispatch signup)

Request: `{ "email": "x@y.com" }`. Response: `{ "ok": true, "status": "subscribed" | "already" }`
or `{ "ok": false, "error": "..." }`. Wire to Buttondown/ConvertKit, or insert
into a D1 table. Double-opt-in friendly. Rate-limit by IP.

## GET /cta?from=hero  (attribution -> booking)

Logs the source to D1, then 302-redirects to `https://scheduler.zoom.us/sreedeep`.
Lets every CTA be tracked without a client analytics script.

## og image

`og.html?title=...&sub=...&tag=...&meta=...` renders a 1200x630 share card in the
Gotham look. Turn it into a PNG with a screenshot Worker (Browser Rendering) or a
build step, then point `og:image` at the PNG. Until then, text-based OG meta tags
(already in each page head) are enough for most platforms.
```
