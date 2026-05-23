/**
 * deependhq.com edge router (Cloudflare Worker, module syntax).
 *
 * Routing strategy:
 *   - Content paths (/blog/*, /journey/*, /toolkit/*) are served from the
 *     content site hosted on Cloudflare Pages.
 *   - Everything else (the homepage at /, Next.js assets under /_next/*,
 *     favicons, and any unmatched path) is proxied to the Next.js homepage
 *     deployed on Vercel.
 *
 * This keeps the marketing homepage and the long-form content site as two
 * independently deployable origins behind a single domain.
 */

// Origin for the Next.js homepage (Vercel).
const HOMEPAGE_ORIGIN = "https://thedeependhq.pages.dev";

// Origin for the long-form content site (Cloudflare Pages).
const CONTENT_ORIGIN = "https://deependhq-content.pages.dev";

// Path prefixes that should be served from the content origin.
const CONTENT_PREFIXES = ["/blog/", "/journey/", "/toolkit/"];

/**
 * Returns true when the request path should be served from the content site.
 * Matches both the exact prefix root (e.g. "/blog") and anything beneath it.
 */
function isContentPath(pathname) {
  return CONTENT_PREFIXES.some((prefix) => {
    const root = prefix.slice(0, -1); // "/blog" from "/blog/"
    return pathname === root || pathname.startsWith(prefix);
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname, search } = url;

    // Pick the origin based on the request path.
    const origin = isContentPath(pathname) ? CONTENT_ORIGIN : HOMEPAGE_ORIGIN;

    // Rebuild the upstream URL, preserving path and query string.
    const upstreamUrl = `${origin}${pathname}${search}`;

    // Forward the original request (method, headers, body) to the upstream.
    const upstreamRequest = new Request(upstreamUrl, request);

    // Fetch and return the upstream response as-is.
    return fetch(upstreamRequest);
  },
};
