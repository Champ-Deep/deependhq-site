# P3 component provenance

## Draggable Widget Grid
Source: operator-supplied 21st.dev prompt at /Users/deep/.hermes/attachments/pasted_content_2026-10-20_16-09-21-595_e8bc02.txt, component draggable-widget-grid.tsx. This is the actual source port, not a lookalike. Demo.tsx and simulated metrics are not used.

Retained: exact backtracking tiler, canonical reading order, candidate group swaps, nearest-slot choice, Motion layout and drag controls, touch long press with scroll cancellation, Alt+arrow navigation and focus restoration.

Changed: TypeScript erased, Tailwind replaced by wg- token CSS, no entry choreography or spring bounce, normal links no longer unconditionally swallowed, readable rectangular cells, fractional final rows filled by widening small tiles, deterministic full-band fallback closes holes the source left beside tall tiles. Phone outcomes span two columns but one row to avoid empty vertical space. Desktop/tablet outcomes retain 2x2 sizing. Storage, reset and reduced-motion canonical static mode are local additions. P1 registry and build script were read as references, not modified.

## Metric cards
Reference: https://kokonutui.com/r/metric-card.json, fetched successfully during implementation. Metric Card v2.0.0, author @dorianbaffier, MIT, https://github.com/kokonut-labs/kokonutui. P3 uses the compact label/value shell as static prerendered wx-metric-card markup. It does not install or mount the full interactive CD-12 chart: existing hero stats do not provide the historical segmented series that chart expects, and synthesizing those series would be false data. No simulated chart, invented deltas, date picker or extra dependency was added. This is a reduced shell adaptation, not adoption of the full CD-12 component.

Context7 tools were not exposed by this session. React createRoot and Motion useDragControls APIs were checked against react.dev and motion.dev directly. No Hermes configuration or external account was changed.

## Integration
The parent owns home-islands.js and islands/index.jsx. Register default WidgetGrid from islands/widget-grid.island.jsx under widget-grid. The Home.jsx mount already contains serialized props and a complete static ordered-list fallback. P3's p3-local.jsx and build-p3-island.mjs only power the isolated browser fixture. Keep the four Proof stats elsewhere until the parent resolves intentional duplication.
