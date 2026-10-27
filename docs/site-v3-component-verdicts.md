# Site V3 component verdicts

All 13 named components and the Matrix Green theme were retrieved through the paid 21st.dev MCP. This static JSX site ports source logic and styles rather than importing a Tailwind or shadcn runtime.

| Item | ID | Verdict | Reason |
| --- | --- | --- | --- |
| Text Flipping Board | 18574 | adapted | Split top and bottom flaps, staggered character changes, static readable headline before enhancement. |
| Squiggly Text | 18566 | adapted | Small SVG turbulence displacement on the fun guy note, bounded interaction and reduced-motion fallback. |
| Floating Dock | 18014 | adapted | Floating bottom navigation with pointer magnification, icons from the house brand sprite (brand/icons.svg), labelled keyboard links, native mobile disclosure. |
| Encrypted Text | 18575 | adapted | Space-preserving character reveal for the operator caption, never the only readable copy. |
| Pixel Art Painting Footer | 43022 | adapted | Ordered Bayer dither edge applied to Deep's own scouter art in the hero. No stock painting. |
| Dot Loader | 3037 | rejected | No genuine loading operation needs a second animation. |
| Loading Animation by prayaniwork | 43012 | rejected | Blocking a prerendered page with a preloader delays usable content; bundled figure frames are third-party people. |
| Agent Plan | 2127 | rejected | Task-management demo does not belong in this identity hero. |
| Orbit Timeline | 39014 | rejected | Adds a second data-navigation system outside the hero scope. |
| Logo Orbit | 40108 | rejected | Decorative orbit competes with the portrait and duplicates the existing stack. |
| macOS Dock | 2572 | rejected | Floating Dock supplies the same function with less layout animation and simpler accessible links. |
| Liquid Glass Navbar | 43059 | rejected | A WebGL water shader is unnecessary for navigation and conflicts with the pixel surface. |
| Resizable Navbar | 3112 | rejected | Retains a top bar; the request explicitly replaces it with a dock. |
| Matrix Green | a5824b87-e9ae-4817-9b57-439e211d80e5 | adapted | Map primary and ring to the house build-green tokens, keep readable house fonts, no VT323 or global glow. |

## Source attribution

Text Flipping Board, Squiggly Text, Floating Dock and Encrypted Text: manuarora700 / Aceternity UI on 21st.dev. Pixel Art Painting Footer: kedhareswer / wild-hunt-footer. Matrix Green: serafimcloud, https://21st.dev/community/themes/matrix-green.

## Integration boundary

Home.jsx is the real prerendered homepage hero. Hero.jsx is not its caller and is not being redesigned. Nav.jsx is shared by app.jsx and page.jsx. Native disclosure keeps the mobile dock usable without JavaScript. The existing homepage enhancement and island bundle remain the only runtime entry points. No auth, provider, billing or Worker changes.

Context7 resolution was attempted but returned a monthly-quota error. React's official useEffect documentation was fetched directly as the fallback.
