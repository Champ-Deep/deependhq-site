// islands/index.jsx : the registry and the mount loop, bundled by
// scripts/build-islands.mjs into home-islands.js at the repo root.
//
// Contract: source is islands/<name>.island.jsx with a default export, listed
// here under the name the prerendered markup uses in data-island. The bundle
// loads defer, so the DOM already exists: each [data-island] has its
// server-rendered fallback cleared, then createRoot renders into the same
// element. A page with no islands does nothing.
//
// React pages render after this bundle (Babel standalone runs on
// DOMContentLoaded), so a late island has to be mounted as it appears. The
// mounted flag keeps the observer from reacting to our own renders.
// No em dashes.

import { createRoot } from 'react-dom/client';
import SchemeBadge from './scheme-badge.island.jsx';

const REGISTRY = {
  'scheme-badge': SchemeBadge,
};

function mount(el) {
  if (el.dataset.islandMounted) return;
  const Comp = REGISTRY[el.dataset.island];
  if (!Comp) return;
  let props = {};
  try { props = JSON.parse(el.dataset.props || '{}'); } catch (e) { /* bad props: mount with none */ }
  el.dataset.islandMounted = '1';
  el.textContent = ''; // the static fallback has done its job
  createRoot(el).render(<Comp {...props} />);
}

function sweep() {
  document.querySelectorAll('[data-island]').forEach(mount);
}

sweep();
new MutationObserver(sweep).observe(document.documentElement, { childList: true, subtree: true });
