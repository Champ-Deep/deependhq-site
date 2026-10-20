# P3: public log and weekly narratives

## 1. Visual Theme & Atmosphere
DeepEndHQ's editorial shell and operator core. A compact board of real journal entries replaces the pinned horizontal rail. No decorative imagery or new visual language.

## 2. Color Palette & Roles
Use P1 system.css tokens. Night Ink ground, Paper text, Lamp accent. Light scheme uses warm white ground and ink text. Component CSS uses only semantic variables, including accent text twins. P1 scheme CSS is loaded only by the isolated browser fixture until parent integration.

## 3. Typography Rules
Preserve brand faces: Inter for UI and operator headings, JetBrains Mono for log data, Fraunces for editorial headings. Excerpts use readable UI type at 16px and 1.5 line height, three lines maximum. Day numbers lead each card.

## 4. Component Stylings
Port the supplied 21st.dev Draggable Widget Grid, not its simulated dashboard demo. Building is small, thinking wide, outcome large. Solid surfaces and quiet borders, visible focus outlines. Full-entry links remain normal anchors. Reset is a 44px control. Arc and word-share bars carry textual counts and denominators.

## 5. Layout Principles
Use existing spacing tokens and a 12px grid gap, 8px internal card gaps and readable 300px rows. Desktop four columns, tablet three, mobile two. Ten desktop entries, first six canonical entries on mobile plus whole-log link. Phone outcomes use 2x1, desktop/tablet outcomes use 2x2. Exact tiler widens small cards to complete a fractional row; the full-band fallback closes every remaining gap. Static fallback is an ordered list. Heatmap stays desktop-only. Mobile has a plain dated list.

## 6. Depth & Elevation
Existing token shadows only. Drag lift uses transform and a focus-like outline, no glow or glass. No new elevation system.

## 7. Do's and Don'ts
Keep source-derived metrics and existing listen control. Do not move or remove hero/proof stats. Do not generate images, invent counters, change other homepage sections, add Tailwind or introduce a new runtime library. Reuse the supplied grid source; strip simulated data and fix its unconditional link suppression.

## 8. Responsive Behavior
Device class: pointer and touch web surfaces. Verify 375, 768, 1280 in light and dark. Pointer drag, touch long press with scroll cancellation, Alt+arrow reorder. Reduced motion uses canonical static list/grid and disables reordering. Motion budget: transform/opacity only, no entrance choreography, no continuous loops, reduced-motion static fallback. Grid cells have enough height to show every required field even at 375px.

## 9. Agent Prompt Guide
All P3 classes start wg- or wx-metric-. Follow docs/refresh-contract.md except its obsolete palette. Build islands separately for local verification and leave parent registry integration to P4. Every assertion uses actual built HTML and source data. Record test output and screenshots beside the verification report.
