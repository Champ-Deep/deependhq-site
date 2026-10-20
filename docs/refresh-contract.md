# Refresh 2026-10: the contract every lane builds against

Branch `refresh/2026-10` (worktree `/Users/deep/repos/deependhq-refresh`). Lanes work in their own worktrees branched from it and are merged back by the integrator. Nothing here is optional.

## 1. Scheme (light and dark)

- `<html data-scheme="dark|light">`. Set before paint by the inline script in `index.html` (and every page that has one): `localStorage.dh_scheme` if set, else `matchMedia('(prefers-color-scheme: light)')` picks light, else **dark**. The old `data-theme="classic"` easter egg and `dh_theme` key are retired.
- All colour tokens live in `system.css` `:root`. Light overrides live in `:root[data-scheme="light"]` in the same file. Components never hard-code hex; they use tokens. If you need a token that does not exist, add it to BOTH schemes.
- Light palette (decided 2026-10-21, derived from the mark: ink, warm white, Lamp orange):

| Token | Dark (unchanged) | Light |
|---|---|---|
| `--bg` | `#0E1A33` | `#F6F5F2` |
| `--surface` | `#15213A` | `#FFFFFF` |
| `--card` | `#1C2841` | `#FFFFFF` |
| `--card-2` | `#243048` | `#EEECE7` |
| `--line` / `--line-2` | `#303C53` / `#434E64` | `#DCD9D2` / `#C4C0B7` |
| `--text` | `#F4EBD9` | `#0E1A33` |
| `--muted` | `#A9ABA6` | `#515B6E` (4.5+ on bg) |
| `--dim` | `#9098AA` | `#5A6478` |
| `--win` (Lamp) | `#F4A62A` | fills stay `#F4A62A` with ink text; as text use `--win-text: #8A5A00` |
| `--build` | `#30E060` | fills stay; as text/icons use `--build-text: #0F6B33` |
| `--think` | `#4A7BF7` | `--think-text: #2A55C8` |
| `--human` | `#E052C0` | `--human-text: #A8278F` |
| `--danger` | `#E05030` | `--danger-text: #B33A1E` |
| shadows | as today | `0 1px 2px rgba(14,26,51,.08)`, `0 4px 12px rgba(14,26,51,.10)`, `0 8px 32px rgba(14,26,51,.12)` |

  Rule: any accent used as text or a thin icon in light mode uses the `-text` twin. Measure with the contrast script before claiming AA.
- `theme-color` meta follows the scheme (`#0E1A33` / `#F6F5F2`).
- Toggle: one button in the nav, `[data-dh-scheme]`, cycles system -> light -> dark -> system, label states the current mode as text (not colour only). Writes or clears `dh_scheme`.
- The brandmark (`favicon.svg`, `brand/brandmark.svg`) is one geometry for both schemes. Do not create a second mark.

## 2. React islands

- Source: `islands/<name>.island.jsx`, default export a React component. Register in `islands/index.jsx`.
- Mount point in the prerendered JSX: `<div data-island="<name>" data-props='<json>'>` with a **server-rendered fallback inside** (static markup of the same content). The page must read correctly with JS off.
- Build: `scripts/build-islands.mjs` (esbuild, `react` and `react-dom` from `dependencies`, minified, `home-islands.js` at the repo root). `npm run build` runs it after prerender. The bundle is loaded `defer` after `home.js`, hydrates every `[data-island]` with `createRoot` after replacing the fallback, and does nothing on pages with no islands.
- Motion: respect `prefers-reduced-motion` (static render). Canvas loops sleep when off screen (IntersectionObserver). Only one `requestAnimationFrame` loop per island.
- Dependencies: `react`, `react-dom`, and `motion` are the only runtime packages allowed. No Tailwind, no shadcn runtime, no Radix. Pasted Tailwind components are ported to plain CSS classes with a per-island prefix (`.hwf-`, `.gfc-`, `.wg-`, `.trn-`).
- Each island ships its CSS in `home.css` (or `pages.css` for non-home pages) under its prefix, tokens only.

## 3. Content

- `content.json` is generated into `data.js` by `scripts/build-data.mjs`; edit `content.json`, never `data.js`.
- New arrays: `lanes[]` (section 4 of the plan), `off_the_clock[]`, `things_to_try[]`. Add under new keys so lanes do not collide.
- Honesty rule: every number on the page is derived from the log, dated, and never typed by hand.

## 4. Definition of done, per lane

1. `npm run build` passes, `npm test` passes, `node scripts/brand-guard.mjs` passes.
2. Screenshots at 375, 768, 1280 in both schemes via `node scripts/shot.mjs` (or Playwright with the same viewports), opened and checked, saved under `docs/shots/<lane>/`.
3. No horizontal scroll at 375. No em dashes anywhere in output. Page reads with JS disabled.
4. Commit on the lane branch with a message that says what changed and what was verified. Do not merge, do not push to main.
