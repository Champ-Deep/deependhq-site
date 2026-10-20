# P4 terrain and working day

## 1. Visual Theme & Atmosphere
The existing Window: editorial introduction beside an actual activity terrain, followed by a compact operator timeline. Terrain is the log, never decorative sample data.

## 2. Color Palette & Roles
Use refresh-contract.md and P1 system.css as canonical. Dark ground --bg #0E1A33, text --text #F4EBD9. Light ground #F6F5F2, text #0E1A33. Columns read --build, --think, --win at runtime; text uses --text and --muted, not saturated fills. No new palette.

## 3. Typography Rules
Preserve brand Fraunces editorial headline, Inter UI, JetBrains Mono operator data. Hero fluid 40 to 64px; supporting prose 17px; terrain labels 14px minimum. Heading hierarchy remains h1 then h2 then h3.

## 4. Component Stylings
Port selected Kokonut Activity Terrain projection, visible faces, hit testing and wave to plain trn- classes. No demo data or contribution totals. Pointer selection and a labelled native day select update the same readout and real journey link. Accessible data table remains available. Buttons and select at least 44px. Static fallback contains real entry links.

## 5. Layout Principles
Mobile first. Under 768px flat terrain, no drag. Desktop editorial copy and terrain in two columns, live log below copy, mare small at foot. Existing seven-lane list on mobile, pinned day at 64rem only. Tracks use minmax(0, 1fr).

## 6. Depth & Elevation
Terrain cuboid faces provide depth. No glass, glows, new cards or invented ornament. Existing hairlines and surfaces remain.

## 7. Do's and Don'ts
Keep all dates and activity from source. Missing dates have zero height. A recorded zero commits remains zero even when an entry exists. Label every terminal snippet illustrative. Omit inferred last-lane dates rather than regex-guessing them. Preserve unrelated proof and log sections.

## 8. Responsive Behavior
Device class: pointer surface and touch phone. Check 375, 768, 1280 in light and dark. Motion budget: one sleeping RAF loop, 60fps target, finite introductory wave; reduced-motion always flat and immediate. Resize and scheme changes repaint. Offscreen and hidden document stop animation. No WebGL.

## 9. Agent Prompt Guide
Use P1 tokens as fixture reference without merging P1. Register default Terrain under terrain during final integration. Local P4 bundle is isolated. Test canvas changes, selection destination, JS-off copy, all seven clocks including midnight, and mobile list. Do not claim deployment or integrated scheme support from this isolated branch.
