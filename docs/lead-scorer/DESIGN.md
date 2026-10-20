# DESIGN.md: Lead Scorer and Account

Design contract for `lead-scorer.html/css/js` and `account.html/css/js`.
Precedence: the `deependhq-design-system` skill and its identity kit (as
implemented in `system.css`) override anything here. This file fills in what
the brand skill does not specify for an operator tool surface.

## 1. Visual theme and atmosphere

Operator mode inside the site's editorial shell. The pages read as an
instrument panel, not a marketing page: Night Ink ground, Paper text, one Lamp
accent, mono data, dense rows, no decoration that is not load bearing. The
single premium contrast moment is the money authorization panel, printed on a
Paper tile like a docket the operator signs before spend. Density law holds:
no card over three lines of prose, no empty column, every state worded.

## 2. Color palette and roles

| Token | Hex | Role |
| --- | --- | --- |
| `--bg` | `#0E1A33` | Night Ink page ground |
| `--surface` | `#15213A` | sticky bar, table headers, hover rows |
| `--card` | `#1C2841` | default panel |
| `--card-2` | `#243048` | sunken control fills, secondary buttons |
| `--line` / `--line-2` | `#303C53` / `#434E64` | 1px hairlines, input borders |
| `--text` | `#F4EBD9` | Paper, primary text (14.60 on bg) |
| `--muted` | `#A9ABA6` | Mare grey, secondary text (7.46 on bg) |
| `--dim` | `#9098AA` | tertiary, meta, disabled labels (5.98 on bg) |
| `--lamp` | `#F4A62A` | the single accent: primary buttons, focus, meters, active tab, eyebrows (8.51 on bg) |
| `--danger` / `--danger-text` | `#E05030` / `#F37050` | failure only: errors, stalled runs, over-cap meters |
| `--paper` / `--paper-muted` / `--paper-line` | `#F4EBD9` / `#5A6478` / `#D2C3A5` | the authorization docket tile, its text and its dotted leaders |
| `--ink` | `#0E1A33` | text on paper and on lamp fills |

Rules: Lamp never sits on Paper (1.72:1), Ink text on a Lamp fill instead
(8.51:1). One accent, so every chip and status carries a word, never colour
alone. Failure is the only other hue. Retired palette values (old gold
`#C9A84C`, old grounds) are refused by `scripts/brand-guard.mjs`.

## 3. Typography rules

| Level | Family | Size and weight |
| --- | --- | --- |
| h1 | Inter | `clamp(1.75rem, 3vw, 2.5rem)` 800, tracking -0.03em |
| h2 card title | Inter | 1.125rem 700, tracking -0.02em |
| Operator body | JetBrains Mono | 15px, line-height 1.65 |
| UI body, labels | Inter | .9375rem / .8125rem, labels 600 |
| Eyebrows, tab labels, tile labels | JetBrains Mono | .6875rem 600, uppercase, tracking .08em |
| Big numbers | Inter 800 | 1.375 to 1.75rem, `tabular-nums` everywhere a number can change |

Fraunces does not appear: it is editorial-only and these pages are operator.
Fonts come from the self-hosted `fonts.css`, no third-party font request.

## 4. Component stylings

- Primary button: Lamp fill, Ink text, 48px for run actions, hover lifts to
  `color-mix(lamp 85%, white)`. Secondary: `--card-2` fill, `--line-2` border.
  Stop: transparent with a danger border. Disabled: `--line` fill, `--dim`
  text, still readable (disabled is a state, not a corpse).
- Inputs and selects: 44px minimum, Ink fill, `--line-2` border, visible
  labels above (placeholders never stand in for labels).
- Chips: pill, mono uppercase, word always present. `chip-ok` Lamp for
  positive, `chip-bad` danger for failure, `chip-idle` for neutral or absent.
- Tiles: Ink fill inside a card, uppercase label, tabular number, one-line
  sub caption. Meters fill by `transform: scaleX()`, never by animating width.
- Tables: sticky header on `--surface`, 1px row rules, own scroll box,
  hover row highlight. Numeric columns tabular.
- Docket lines (paper tile): label left, mono bold value right, dotted
  `--paper-line` leaders, the total line un-dotted and larger.
- Mounts (Clerk PricingTable, UserButton): framed by `.mount` card, dark
  appearance variables passed from `toolkit-session.js` so native components
  land on Night Ink instead of a white rectangle.

## 5. Layout principles

Content max 1200px, page padding 20/24/32px by breakpoint, 4px spacing scale
with no off-scale values. Workspace deck is `minmax(0,5fr) minmax(0,7fr)` at
64rem and stacks below, with `align-items: stretch` so both cards end on one
baseline. `minmax(min(100%, Npx), 1fr)` grid tracks everywhere, never a bare
fixed width. No nested cards; sections are cards, content inside is tiles,
rows and tables.

## 6. Depth and elevation

Flat by decision. One pixel borders and the surface ladder (bg to surface to
card) carry hierarchy. No box shadows, no glows, no glass, no gradients on
text. The Paper docket is the elevation: a light tile on a dark ground reads
as lifted without a single blur pixel.

## 7. Dos and don'ts

- Do put Ink text on a Lamp fill; don't put Lamp text on Paper.
- Do word every state (chip text, aria labels, status lines); don't let hue
  carry meaning alone.
- Do use `--dim` for quiet text; never `opacity` on a text node.
- Do keep focus visible: 2px Lamp outline, 2px offset, Ink outline on the
  paper tile; never `outline: 0`.
- Do design the failure states: config missing, quote failed, batch failed,
  filter empty, signed out, account paused. Don't render invented data: every
  number on these pages comes from the API or the local file.
- Do keep sample and fixture data synthetic. Never a real person.
- Don't add emoji icons, side-strip borders, gradient text, frosted panels or
  a second accent hue.

## 8. Responsive behavior

Breakpoints 30/40/48/64rem, 375px binding constraint: everything stacks, the
deck collapses to one column, tiles wrap via `auto-fit minmax(min(100%,150px),1fr)`,
mapping grid wraps to two columns, every table scrolls inside its own box with
zero page-level horizontal scroll. Touch targets 44x44 including padding.

Device class: pointer-first operator tool (desktop and laptop primary) with a
phone-capable single column as the secondary surface. Motion budget: 60fps on
the compositor only, transform and opacity exclusively, 120ms feedback and
200ms state changes. The expressive tier is banned here (task-completion
flow), and `prefers-reduced-motion: reduce` disables all animation and
transition outright rather than merely slowing it.

## 9. Agent prompt guide

Build on Night Ink `#0E1A33` with card `#1C2841` and hairline `#303C53`.
Text tiers `#F4EBD9`, `#A9ABA6`, `#9098AA`. One accent, Lamp `#F4A62A`, used
for primary action, focus, active tab and meters; failure `#E05030` with text
`#F37050`. Inter for headings and UI, JetBrains Mono for data and eyebrows.
Spacing 4px scale, radii 4/6/10, content 1200px, pad 20/24/32. Authorization
surfaces invert to Paper `#F4EBD9` with Ink text. Reuse the classes already
in `lead-scorer.css` (`.card`, `.tile`, `.chip`, `.docket-line`, `.hrow`)
before inventing new ones.
