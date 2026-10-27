import * as session from './toolkit-session.js';
const status = document.querySelector('#signin-status');
const retry = document.querySelector('#signin-retry');
let mounted = false;
async function connect() {
  retry.disabled = true;
  status.className = 'loading';
  status.textContent = 'Connecting to secure sign-in...';
  try {
    const config = await session.loadConfig(true);
    if (!config.configured) throw new Error('Setup needed. Sign-in is not configured on this deployment yet. No account or payment is required until access is enabled.');
    await session.startClerk();
    if (session.authState().signedIn) { location.replace('/'); return; }
    if (!mounted) { session.mountSignIn(document.querySelector('#toolkit-signin-root')); mounted = true; }
    status.textContent = 'Secure sign-in provided by Clerk.';
    retry.hidden = true;
  } catch (error) {
    status.textContent = error.message;
  } finally { retry.disabled = false; status.className = 'notice'; }
}
retry.addEventListener('click', connect);
session.onAuthChange(s => { if (s.signedIn) location.replace('/'); });
connect();
