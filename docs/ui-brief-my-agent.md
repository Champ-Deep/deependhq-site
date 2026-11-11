# UI brief: My agent window (card t_2fa771e9)

Contract: `docs/toolkit-v4-api.md` section 12 (`agent_status`, `agent_connect`, `agent_tools_set`, `agent_test`, `webhook_set`, `webhook_rotate`, `webhook_deliveries`, `webhook_resend`, the signature check). Plan: DeepBot Full Toolkit and Agent Connections Plan 2026-11-05, section 3 and the threat rows "Injection that tries to exfiltrate" and "Foreign agent output".

## Surface
One desktop app, id `myagent`, label "My agent", in the dock and on the desktop between ChamPDF and Account. Three tabs: MCP server, Webhooks, Verify deliveries. Each tab renders once and keeps its state.

## Visual language
The toolkit desktop's own tokens (`toolkit-desktop.css`, `scheme-tokens.css`): operator mode, Inter UI, JetBrains Mono for tool names, event names and codes, one Lamp accent. Status colour is never the only carrier: every chip carries its word.

| State | Chip |
|-------|------|
| not connected | grey, "Not connected" |
| checking | grey with a pulsing dot (static under reduced motion), "Checking" |
| connected (pending or active) | green, "Connected" |
| changed | amber fill, "Tools changed", line "Your agent's tools changed. Review them before DeepBot can use them." |
| error | red, "Error", line is the server's message; a `timeout` code reads "Your agent did not answer in time." |
| delivery 2xx | green code chip |
| delivery other, or no answer | red code chip with the code or the guard error |

## Component table

| Region | Name | Author | id | Role |
|--------|------|--------|----|------|
| Off / Read / Ask me control | Segmented Control | klyv-ui | 21st.dev 43311 | Pattern port, no code copied: the pill radiogroup look rebuilt on native radio inputs in a fieldset, so the group name, arrow keys and form semantics come from the platform. The sliding thumb is dropped (it would animate a layout property). |
| Webhook form | Illos Webhook Setup | navedux | 21st.dev 44500 | Considered, not adopted. React with a shader illustration and a live request preview the contract does not have. Not vendorable as static HTML and CSS. |
| Delivery log | Audit Log | corr | 21st.dev 25163 | Considered, not adopted. Context menus and field filters the log does not need. House `table` instead; on phones each row stacks to event and status, time and age, then Resend. |
| Verify snippet | Code Block | uilayout.contact | 21st.dev 28139 | Considered, not adopted. Syntax highlighting is a dependency for ten lines. A `pre` that scrolls inside its own box plus a Copy button. |
| Everything else | house components | toolkit-desktop.js | `el`, `button`, `field`, `input`, `check`, `notice`, `table`, `openApp`, `APPS`, `ICON`, `.tabs` | Same primitives as Files, Admin and Account. |

Search queries run on 21st.dev: "segmented control three options", "webhook delivery log", "code snippet copy button".

## Untrusted text (graded)
- Tool names and descriptions from the user's server are set with `textContent` only, descriptions cut to 300 characters (the server cuts them too). A description that reaches 300 says it may go on. Nothing from the agent reaches `innerHTML`.
- A list over the tools says they come from the agent and are treated as untrusted. The agent's `readOnlyHint` shows as its claim, and never changes a mode.
- Every tool starts Off. Choosing Read the first time for a tool shows: "DeepBot will call this tool without asking, and may pass text from your files to it. Use Read only for tools that do not change anything."
- A `tools_changed` answer on save, or a changed list on Test or load, turns the chip amber and resets every control to Off until the user saves again.

## Secret handling (graded)
- The MCP token is a password field. After save it is cleared and only the server's masked `key_hint` is shown.
- The webhook secret lives in one closure variable and one `code` element inside the reveal panel. "I saved it, close" sets the variable to `null`, empties the element and removes the panel. It is never written to localStorage, sessionStorage, the URL or the console. Afterwards the secret is referred to by its last four characters only, because the server's masked form starts with `whsec_`.
- The only `whsec_` text left in the DOM is the comment inside the docs snippet (`// secret: your whsec_ value.`), which is the docs block verbatim.

## URL check
The client refuses what `checkOutboundUrl` refuses at parse time (length over 2,048, not https, a port other than 443, user info, an IP literal, a single label host) with the server's one message: "That URL is not allowed. It must be a public https address on port 443." Nothing is posted. The server stays the authority for names and DNS.

## States
Loading ("Loading your agent connection..."), load error with Try again, switched off ("Connections are not switched on yet."), not connected, no tools listed, checking, connected with nothing approved, active, changed, error, provider timeout, tools did not load (press Test), no webhook, no deliveries, deliveries loading and failing.

## Ask me and Approvals
A save with Ask me tools says each Ask me call goes to Approvals and runs only after approval. The Approvals window is on `ui/agent-access`, not on this base, so the "Open Approvals" button renders only when `NAME.approvals` exists.

## Not here
Disconnect and webhook remove buttons (the actions exist; the card did not ask for them), `myagent` in DeepBot's `page_steps` targets (`worker/deepbot-core.js`, off limits for this card).
