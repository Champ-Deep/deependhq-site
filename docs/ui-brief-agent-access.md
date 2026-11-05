# UI brief: Approvals window and Agent access (card t_0281e09b)

Contract: `docs/toolkit-v4-api.md` section 10 (staged items, `staged_list`, `staged_get`, `staged_decide`) and section 11 (`api_keys_list`, `api_key_create`, `api_key_revoke`, endpoints). Plan: DeepBot Full Toolkit and Agent Connections Plan 2026-11-05, sections 1, 2.2 to 2.4, threat rows "Approval spoofing" and "Stolen API key".

## Surfaces
1. **Approvals** desktop app (`approvals`): dock entry and desktop icon with a pending count badge (hidden at 0), one row per staged item, newest first, deep link `#approvals/<id>`.
2. **Agent access** in the Account window: `agentAccess(container)`, called from `account(w)` with one line so the Connections card can add its own section beside it.

## Visual language
The toolkit desktop's own tokens (`toolkit-desktop.css`, `scheme-tokens.css`): operator mode, Inter UI, JetBrains Mono for data (key prefixes, scopes, credits), one Lamp accent. Status colour is never the only carrier: every pill carries its word.

| State | Pill |
|-------|------|
| pending | amber outline, "Waiting" |
| approving | amber, "Approving" |
| approved | green, "Approved" |
| rejected | grey, "Rejected" |
| expired | grey on a hatched ground, "Expired" |
| failed | danger, "Failed" |

Agent text (`note`) is set with `textContent` only, in a quote block labelled "Note from the agent". `title` and `source` are also text nodes. Nothing from a staged item reaches `innerHTML`.

## Component table

| Region | Name | Author | id | Role |
|--------|------|--------|----|------|
| Agent access key rows and the one time reveal | Environment Variables | syeddhasnainn | 21st.dev 36559 | Vanilla port: a list of secret rows, label over a monospace masked value, scope chips, hairline separators, a copy button whose icon swaps to a check. The reveal toggle is dropped: the server never returns a key after creation, so the only reveal is the one time panel. |
| Approvals queue | Access Request Inbox | uvain | 21st.dev 28857 | Considered, not adopted. 158 KB of React with framer-motion, grouping and supersede semantics the contract does not have. Not vendorable as static HTML and CSS. House components only. |
| Approvals rows, buttons, inline confirm, tabs, notices | house components | toolkit-desktop.js | `el`, `button`, `field`, `check`, `notice`, `.confirm`, `.tabs` | The same primitives as Files and Admin. |

Search queries run on 21st.dev: "secret key reveal copy" and "approval queue list".

## Secret handling (graded)
- The full key lives in one local variable inside the reveal panel's closure. Close sets it to `null` and removes the panel. It is never written to localStorage, sessionStorage, the URL or the console, and the list rerender only ever shows `prefix`.
- Snippets use the placeholder `<your key>`, never the real key.

## States
Approvals: loading, empty ("Nothing waiting. When DeepBot or your agent prepares something, it lands here."), error with retry, expired rows (no buttons, a line saying to stage it again). Agent access: loading, switched off for non admins ("Agent access is not switched on yet." and nothing else), list, empty list, limit reached, create error, revoke confirm.

## Run approval flow
"Review and run" opens the Workbench through `w.reviewStaged(fileId, plan, onStarted)`: it fetches the file from Files, loads it, takes the staged plan, and requests a fresh quote. Nothing runs. When the user presses Run and the first chunk is recorded, the Approvals window posts `staged_decide {id, decision: 'approve', job_id}`.
