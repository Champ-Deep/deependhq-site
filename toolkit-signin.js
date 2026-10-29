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
// The static dock's mobile menu closes on Escape, as Nav.jsx does on deependhq.com.
document.addEventListener('keydown', e => {
  const menu = e.key === 'Escape' && document.querySelector('.v3-dock-mobile[open]');
  if (menu) { menu.open = false; menu.querySelector('summary').focus(); }
});
// 21st.dev 2034 input glow (vanilla port): the ring on a .dh-glow input follows the pointer.
document.querySelector('#toolkit-signin-root').addEventListener('pointermove', e => {
  const input = e.target.closest && e.target.closest('.dh-glow');
  if (!input) return;
  const r = input.getBoundingClientRect();
  input.style.setProperty('--gx', Math.round(e.clientX - r.left) + 'px');
  input.style.setProperty('--gy', Math.round(e.clientY - r.top) + 'px');
});
session.onAuthChange(s => { if (s.signedIn) location.replace('/'); });
connect();
