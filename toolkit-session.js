// toolkit-session.js : the single Clerk session surface shared by
// lead-scorer.html and account.html. One loader, one token path, no duplicate
// auth code anywhere else.
//
// Contract (docs/toolkit-api.md): the Clerk script URL comes only from
// GET /api/toolkit/config (operator pinned, no fallback hostname we invent),
// the publishable key rides the script tag as data-clerk-publishable-key, we
// await Clerk.load(), take a session token per API call, and listen for auth
// changes. Tokens never touch localStorage, sessionStorage or a URL.

let config = null;
let clerkReady = null;
const listeners = new Set();

export async function loadConfig(force) {
  if (config && !force) return config;
  let r;
  try {
    r = await fetch('/api/toolkit/config', { cache: 'no-store' });
  } catch (e) {
    throw new Error('Could not reach the toolkit config endpoint.');
  }
  if (!r.ok) throw new Error('Toolkit config unavailable (HTTP ' + r.status + ').');
  config = await r.json();
  return config;
}

export function getConfig() {
  return config;
}

export function isConfigured() {
  return !!(config && config.configured);
}

// Loads the pinned Clerk script once, then Clerk.load(). Accepts both SDK
// shapes: a script that auto-instantiates window.Clerk, and one that exposes
// the Clerk class for us to construct.
export async function startClerk() {
  if (clerkReady) return clerkReady;
  clerkReady = (async () => {
    const cfg = await loadConfig();
    if (!cfg.configured || !cfg.clerk_script_url || !cfg.clerk_publishable_key) {
      throw new Error('Sign in is not configured on this deployment yet.');
    }
    if (!window.Clerk) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = cfg.clerk_script_url;
        s.async = true;
        s.setAttribute('data-clerk-publishable-key', cfg.clerk_publishable_key);
        s.onload = resolve;
        s.onerror = () => reject(new Error('The Clerk script failed to load.'));
        document.head.appendChild(s);
      });
    }
    if (window.Clerk && typeof window.Clerk.load === 'function') {
      await window.Clerk.load();
    } else if (typeof window.Clerk === 'function') {
      const made = new window.Clerk(cfg.clerk_publishable_key);
      await made.load();
      window.Clerk = made;
    } else {
      throw new Error('The Clerk script did not provide a usable SDK.');
    }
    window.Clerk.addListener((state) => emit(state));
    emit({ session: window.Clerk.session, user: window.Clerk.user });
    return window.Clerk;
  })().catch((e) => {
    clerkReady = null;
    throw e;
  });
  return clerkReady;
}

function primaryEmail(user) {
  if (!user) return '';
  if (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) {
    return user.primaryEmailAddress.emailAddress;
  }
  if (user.emailAddresses && user.emailAddresses[0]) return user.emailAddresses[0].emailAddress;
  return user.email || '';
}

function snapshot(state) {
  const signedIn = !!(state && state.session);
  return {
    signedIn,
    userId: (state && state.user && state.user.id) || '',
    email: primaryEmail(state && state.user),
  };
}

function emit(state) {
  const snap = snapshot(state);
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch (e) {
      // one bad listener must not break the others
    }
  });
}

export function onAuthChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function authState() {
  const clerk = window.Clerk;
  return snapshot({ session: clerk && clerk.session, user: clerk && clerk.user });
}

// A fresh token for every API call, held only for the length of that call.
export async function getToken() {
  const clerk = window.Clerk;
  if (!clerk || !clerk.session) return null;
  try {
    return await clerk.session.getToken();
  } catch (e) {
    return null;
  }
}

export async function api(action, body) {
  const token = await getToken();
  if (!token) throw new Error('Sign in required.');
  let r;
  try {
    r = await fetch('/api/toolkit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(Object.assign({ action: action }, body || {})),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch (e) {
    throw new Error('Could not reach the toolkit API. Check your connection and retry.');
  }
  let data = null;
  try {
    data = await r.json();
  } catch (e) {
    throw new Error('The toolkit API returned a non JSON response (HTTP ' + r.status + ').');
  }
  const runResult = ['run','run_detail'].includes(action) && data?.id && Array.isArray(data.results) && ['new','completed','failed','held'].includes(data.status);
  if (!r.ok || (data && data.error && !runResult)) {
    const err = new Error((data && data.error) || 'HTTP ' + r.status);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

// Shared appearance so native Clerk components sit on the page tokens instead
// of arriving as a white rectangle. Only documented variables are set, read
// from CSS at mount time so the modal follows the active scheme.
const tok = (name, fallback) => (getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
const APPEARANCE = () => ({
  colorScheme: document.documentElement.getAttribute('data-scheme') === 'light' ? 'light' : 'dark',
  variables: {
    colorBackground: tok('--surface', '#15213A'),
    colorText: tok('--text', '#F4EBD9'),
    colorPrimary: tok('--win', '#F4A62A'),
    colorDanger: tok('--danger', '#E05030'),
    colorInputBackground: tok('--bg', '#0E1A33'),
    colorInputText: tok('--text', '#F4EBD9'),
    // Only the toolkit shells set these two (Matrix Green: square corners, mono face).
    borderRadius: tok('--clerk-radius', '6px'),
    ...(tok('--clerk-font', '') ? { fontFamily: tok('--clerk-font', '') } : {}),
  },
});

export function openSignIn() {
  if (!window.Clerk || typeof window.Clerk.openSignIn !== 'function') {
    return Promise.reject(new Error('Sign in is not available yet.'));
  }
  return window.Clerk.openSignIn({ appearance: APPEARANCE() });
}

export function mountSignIn(node) {
  if (!window.Clerk || typeof window.Clerk.mountSignIn !== 'function') {
    throw new Error('Sign in is not available yet.');
  }
  const appearance = APPEARANCE();
  appearance.variables.colorPrimary = tok('--build', '#30E060');
  appearance.variables.colorPrimaryForeground = tok('--ink', '#0E1A33');
  return window.Clerk.mountSignIn(node, { appearance, routing: 'hash', forceRedirectUrl: '/' });
}

export async function signOut() {
  if (window.Clerk && typeof window.Clerk.signOut === 'function') {
    await window.Clerk.signOut();
  }
  emit({ session: null, user: null });
}

export function mountUserButton(node) {
  if (window.Clerk && typeof window.Clerk.mountUserButton === 'function') {
    window.Clerk.mountUserButton(node, { appearance: APPEARANCE(), afterSignOutUrl: location.pathname });
    return true;
  }
  return false;
}

export function mountPricingTable(node) {
  if (window.Clerk && typeof window.Clerk.mountPricingTable === 'function') {
    window.Clerk.mountPricingTable(node, { appearance: APPEARANCE() });
    return true;
  }
  return false;
}

// Shared gallery integration point: pages that do not import modules (or the
// parent toolkit gallery) use window.ToolkitSession instead of these exports.
if (typeof window !== 'undefined') {
  window.ToolkitSession = Object.freeze({
    startClerk,
    loadConfig,
    getConfig,
    isConfigured,
    authState,
    onAuthChange,
    getToken,
    api,
    openSignIn,
    signOut,
    mountUserButton,
    mountPricingTable,
  });
}
