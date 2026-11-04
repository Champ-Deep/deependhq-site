# Sonar: Back Room

## Visual theme
Operator mode. One column, phone first. Deep's host is not the toolkit mare.

## Colors
Only scheme-tokens.css owns palette values. Scoped sonar tokens preserve other apps.
Ink ground, paper text, mare readouts. Lamp fills with Ink text. Live caret only uses phosphor in dark; light uses the dark build text twin.

## Typography
Self-hosted Pixelify Sans, display only at 24px or larger. JetBrains Mono for host speech, readouts and controls. No new runtime dependencies.

## Components and source licenses
Vanilla ports, not React or Tailwind installs. Each linked component page explicitly declares MIT (checked during implementation).

| Port | Demo | License evidence |
| --- | --- | --- |
| Terminal: typed lines, caret, scanline, brackets | 29817 | https://21st.dev/@thegridcn/components/terminal.md |
| Count Up: spring-to-target number, reduced-motion final value | 20068 | https://21st.dev/@unlumen/components/count-up.md |
| Rank Bars: label, zero baseline, bar, value, hero row | 29452 | https://21st.dev/@eugeneshilow/components/rank-bars.md |
| 8-bit Table: semantic table, hard border and dashed rows | 13078 | https://21st.dev/@theorcdev/components/8bit-table.md |
| Suggestions: wrapped prompt buttons and selection callback | 12342 | https://21st.dev/@serafimcloud/components/suggestions.md |

## Layout
375px binds the layout. Only the list table scrolls horizontally. The bottom-right host has a dedicated 120px grid track, never overlaid on content.

## Depth
Surface steps, pixel brackets, no blur. Three percent scanline only on terminal readout.

## Do and do not
Run validatePlan before runPlan. Clean headline templates again in the browser. Rows stay local; the column profile includes sample values, sent only with a question. No model number is used for analytical results. Billing metadata shows credits plus the existing money helper's dollar equivalent. No billing implementation changed.

## Responsive and motion
Pointer and touch surfaces: 375, 768, 1280, 1440 and 1600 checks. Controls 44px or larger. Reduced motion gets whole text, final numbers and static bars. Normal motion: finite count animation, 400ms bars, stepped 1.1s host bob, 120ms blink every 2.6 to 5.2 seconds except happy.

## Implementation contract
Entry: toolkit-sonar.js. Desktop passes existing readTable, dropTarget and usage refresh helpers. All file/result callers use w.load(file) or w.load(rows, name). CSV exports contain only the first preview rows and are labelled accordingly. No server calls to export.
