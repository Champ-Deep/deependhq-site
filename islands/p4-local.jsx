// Isolated P4 wiring. Integrator registers Terrain in the canonical P1 registry.
import { createRoot } from 'react-dom/client';
import Terrain from './terrain.island.jsx';
for (const el of document.querySelectorAll('[data-island="terrain"]')) {
  try {
    const props = JSON.parse(el.dataset.props);
    if (!props.d?.length || props.d.length !== props.rows?.length || props.k?.length !== props.d.length || !props.start) continue;
    createRoot(el).render(<Terrain {...props} />);
  } catch (error) { console.error('Terrain could not mount; static log remains available.', error); }
}
