// islands/scheme-badge.island.jsx : the proof island. It renders the scheme
// the page is actually in and follows the toggle, which is the smallest thing
// that exercises the whole pipeline: registry, props, mount, tokens.
// The static fallback in Footer.jsx carries the same text for JS-off readers.
// No em dashes.

import { useState, useEffect } from 'react';

const read = () => (typeof document !== 'undefined' && document.documentElement.dataset.scheme) || 'dark';

const SchemeBadge = () => {
  const [scheme, setScheme] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setScheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
    return () => mo.disconnect();
  }, []);
  return <span className="schb-t">scheme: {scheme}</span>;
};

export default SchemeBadge;
