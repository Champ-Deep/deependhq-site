# deependhq-next : Porting Conventions

Read this before porting any legacy component. The legacy site is a no-build
React kit at `Efforts/Active/TheDeepEndHQ/deependhq-site/` (vault). Components
there are `window.*` globals loaded via Babel Standalone and read data from
`window.DH_DATA`.

## Hard rules

1. NO em-dashes in any output, code comments included. Periods, commas, colons.
2. Keep every legacy `dh-*` / `dh5-*` className EXACTLY as-is. The legacy CSS
   ships verbatim in `app/styles/`. Visual parity depends on class fidelity.
3. Public-naming rules: never name real team members, patriarch is "Chief".
   (Content comes from content.json which already complies. Do not add names.)
4. TypeScript strict. No `any`. Use types from `@/lib/data`, extend there if a
   structure is missing.

## Data access

- Server components: `import { DH } from "@/lib/data"` and read directly.
- Client components: NEVER import `@/lib/data` (it drags the whole JSON into
  the client bundle). Receive data as serializable props from a server parent.
- `DH` is shaped IDENTICALLY to the old `window.DH_DATA` (same transform).

## Component placement

- Server component (default): `components/Foo.tsx`, named export.
- Client component (hooks, browser APIs, event handlers): `components/client/Foo.tsx`
  with `"use client"` as first line.
- Guard browser APIs inside `useEffect`. Nothing touches `window` at module scope.

## Routing map (legacy -> Next)

| Legacy | Next route |
|---|---|
| index.html | / |
| now.html | /now |
| journey.html | /journey |
| writing.html | /writing |
| post.html?slug=X | /writing/[slug] |
| field-notes.html | /field-notes |
| toolkit.html | /toolkit |
| command.html | /command |
| company.html?slug=X | /company/[slug] |
| /cta?from=Y | /cta (route handler redirect, keep query) |

- Internal links: `<Link href="/journey">` from `next/link`. External links stay `<a>`.
- Dynamic routes: Next 16 params are async. Signature:
  `export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; ... }`
- Add `export function generateStaticParams()` returning slugs from `DH.posts`
  / `DH.companies` so every page is statically generated.
- Add `export async function generateMetadata({ params })` (async params again)
  with per-page title/description.
- Unknown slug: `notFound()` from `next/navigation`.

## Reference port

See `components/client/Nav.tsx` (interactive client port) and
`components/Footer.tsx` (server port with data). Follow those patterns.

## Build

Do NOT run builds yourself. Write files only. The orchestrator runs the
rsync + build + fix cycle in /tmp/site/deependhq-next.
