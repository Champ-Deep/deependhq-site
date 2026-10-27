# Toolkit desktop

## 1. Visual Theme & Atmosphere
An operator workstation, not a dashboard. A quiet terminal wallpaper behind solid app windows, a floating glass dock and a compact menubar. The Data Workbench is the primary app. Sign-in is a two-column access terminal based on 21st.dev Split Sign In Form 39096, with a workflow illustration instead of the source's invented testimonial.

## 2. Color Palette & Roles
Use the locked deependhq operator palette through scheme-tokens.css: Night Ink #0E1A33, Paper #F4EBD9, green #30E060 and its light-text twin #0F6B33. Matrix Green theme a5824b87-e9ae-4817-9b57-439e211d80e5 is the reference for terminal hierarchy, mapped to the site's tokens rather than importing its black ground and low-contrast muted green. Light mode uses #F6F5F2 and #0E1A33. All text has an explicit color.

## 3. Typography Rules
Existing self-hosted Inter for controls and headings. Existing JetBrains Mono for monetary values, status and operator copy. Body 15px, form fields 16px, headings 24px to 44px. No additional fonts.

## 4. Component Stylings
21st.dev macOS Dock 2572: port the cosine magnification and open-app indicators to native buttons and plain CSS. Always-visible names replace hover-only tooltips. Reduced motion removes magnification. Split Sign In Form 39096: port the two-column layout; Clerk owns the actual authentication form via its appearance API. No custom credential handling. Solid app windows expose focus, drag, minimize, close and restore. Controls are at least 44px.

## 5. Layout Principles
Desktop windows live inside a bounded workspace. Each has its own scroll area. Mobile shows a labelled app grid and one full-screen app at a time. Forms stack; data tables have local horizontal scrolling. Padding uses the existing 4px scale.

## 6. Depth & Elevation
Solid content surfaces. Glass is limited to the floating dock, with an opaque fallback and reduced-transparency support. Focused windows have a stronger outline; focus is not conveyed by color alone.

## 7. Do's and Don'ts
Show real API money only. Never imply a held cost is free. Quote every batch before running and retain the same request id on a retry. Keep uploaded data in memory, never browser storage. Local scanner reports are heuristic, not a guarantee. No invented progress percentages. Keep the existing backend and legacy lead scorer unchanged.

## 8. Responsive Behavior
Device class: pointer surface with touch/mobile support. Verify 375, 390, 768, 1280, 1440 and 1600. Motion budget: dock transforms only, no continuous animation loop; reduced motion shows the same labelled buttons at rest. Each app retains state when minimized. Narrow screens use one app window.

## 9. Agent Prompt Guide
Build an operator desktop using the site's existing tokens and session API. Quote costs in dollars. Design loading, empty, setup-needed, signed-out, exhausted allowance, provider failure and held states. No new runtime dependency, no external decorative asset, no fabricated account data.
