// islands/index.jsx : the registry and the mount pass for the homepage
// islands (contract section 2).
//
// Every island lives in a prerendered <div data-island="..." data-props="...">
// that already carries a complete static fallback. This file parses the props,
// clears the fallback and renders the component into that same div. Pages with
// no mounts do nothing, and a page with JS off keeps the fallback forever.
// No em dashes.

import * as React from 'react';
import { createRoot } from 'react-dom/client';
import HalftoneFooter from './halftone-footer.island.jsx';
import FolderCards from './folder-cards.island.jsx';
import WidgetGrid from './widget-grid.island.jsx';
import Terrain from './terrain.island.jsx';

const REGISTRY = {
  'halftone-footer': HalftoneFooter,
  'folder-cards': FolderCards,
  'widget-grid': WidgetGrid,
  'terrain': Terrain,
};

export function mountIslands(root) {
  const scope = root || document;
  const nodes = scope.querySelectorAll ? scope.querySelectorAll('[data-island]') : [];
  let mounted = 0;
  nodes.forEach((el) => {
    if (el.getAttribute('data-mounted')) return;
    const Comp = REGISTRY[el.getAttribute('data-island')];
    if (!Comp) return;
    let props = {};
    const raw = el.getAttribute('data-props');
    if (raw) {
      try {
        props = JSON.parse(raw);
      } catch (err) {
        // Bad JSON leaves the fallback in place: the page reads, only the
        // motion is missing.
        return;
      }
    }
    el.setAttribute('data-mounted', '1');
    el.textContent = '';
    createRoot(el).render(React.createElement(Comp, props));
    mounted += 1;
  });
  return mounted;
}

if (typeof document !== 'undefined') {
  new MutationObserver(() => mountIslands(document)).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mountIslands(document));
  } else {
    mountIslands(document);
  }
}
