# Deep End Toolkit design

## 1. Visual theme and atmosphere
An operator's workbench, not a software directory. Public product showcase first, the personal build stack second. Night Ink surfaces with Paper typography and one Lamp accent. Editorial entry copy gives way to compact tool controls. Real availability labels instead of fabricated metrics.

## 2. Color palette and roles
Background #0E1A33, surface #1A2742, card #212E4B, border #24314F. Text #F4EBD9, muted #B4B0AB, dim #999998. Primary accent #F4A62A on Ink only. No Lamp on Paper. State always has a word, never only color.

## 3. Typography rules
Existing self-hosted Inter for UI and operator headings; JetBrains Mono for compact metadata and workflow steps. Display heading 44px desktop and 30px mobile, body 16px/1.6. No new font downloads. Uppercase eyebrows 11px with .08em tracking.

## 4. Component stylings
A full-width account strip with shared-credit explanation and an account action. Feature area: one large Lead Scorer card with a diagram of its real processing stages, one narrow explanatory account panel. Compact product rows below, 44px minimum actionable height. Cards use 1px borders and 10px corners; no glow, glass, decorative sparklines or repeated icon tiles. Buttons have clear focus and disabled states.

## 5. Layout principles
Retain existing 1200px site container and page spacing. Namespace all new classes tk- to avoid inherited chart/card rules. Desktop feature split 2:1 with stretch alignment, mobile stack. Product grid 3/2/1 columns with minmax(0,1fr). Secondary build-stack inventory retains its existing anchors and data source.

## 6. Depth and elevation
Solid surfaces only. Primary feature uses a brighter surface but no shadow bloom. Dividers indicate sections, never colored left borders. Hover uses a small border/text color change, no shifting geometry.

## 7. Do and don't
Do name what's usable here, external, source-only or private. Do preserve free browser-local tools as free. Don't imply Clerk or shared credits work in external products. Don't show internal tools as runnable public tools. Don't replace the whole site or invent commercial prices. Keep provider dollars and user credits distinct.

## 8. Responsive behavior
Pointer surface with touch-capable mobile. Test at 375,768,1280,1600. No horizontal overflow; data tables scroll inside their own wrappers. Minimum 44px touch targets. Motion budget: only opacity/transform, 200ms interaction ceiling, no continuous animation. Reduced motion disables transitions without hiding content.

## 9. Agent prompt guide
Use the existing deependhq brand tokens. Lead with the user's job: useful tools, one account. Present Lead Scorer as the integrated metered workflow; honest external-product links and source links follow. Preserve the existing stack record below an explicit separation. Every new public capability label must be grounded in implemented behavior or marked setup-required.
