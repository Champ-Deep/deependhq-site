# Component provenance

Preview task t_18bcdbd6, branch refresh/editorial-hero-v3.

## Mounted CTA

21st.dev, nextjsshop, Arrow Dots Button, Button05. Registry URL: https://21st.dev/r/nextjsshop/arrow-dots-button . The recovered shadcn installation produced .registry-import/components/ui/arrow-dots-button.tsx. Installed source SHA-256: 4828fc545a64e4e46b475ef35b6ab48fa94c0fbdec435ddf041c9f9ef4834d50.

Home.jsx ports the source's four chevrons, each with dot offsets [2,1,0,1,2], into the actual booking anchor. Browser test asserts all 20 dots are prerendered on the served homepage. Prefixed ev3-arrow CSS replaces library styling. The label stays stable, the arrow moves on hover, and reduced motion disables that movement. No Tailwind migration or runtime package added. Decorative background and label-swap layers were deliberately omitted. This is source adoption, not a catalog-only claim.

## Preserved interaction

Kokonut Activity Terrain, @dorianbaffier, MIT: https://kokonutui.com/r/activity-terrain.json . The existing islands/terrain.island.jsx port remains mounted unchanged. Projection, actual-day selection, flat view, keyboard behavior, data table and reduced-motion behavior survive relocation from the hero to #log. Existing 21st folder cards, widget grid and halftone footer also remain mounted.

Context7 tools were not exposed in this CLI tool catalog. No framework migration or new framework API was introduced. The React server-rendering reference was read directly at https://react.dev/reference/react-dom/server/renderToStaticMarkup . Existing build and browser gates exercise the actual installed React/esbuild pipeline.
