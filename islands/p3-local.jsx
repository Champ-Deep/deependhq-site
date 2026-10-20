// P3-only registry. Parent integrates this entry into P1 islands/index.jsx.
import { createRoot } from 'react-dom/client';
import WidgetGrid from './widget-grid.island.jsx';
for (const el of document.querySelectorAll('[data-island="widget-grid"]')) {
  try {
    const props = JSON.parse(el.dataset.props);
    if (!Array.isArray(props.entries)) continue;
    createRoot(el).render(<WidgetGrid {...props} />);
  } catch (error) {
    console.error('Widget grid could not mount; retaining the static log.', error);
  }
}
