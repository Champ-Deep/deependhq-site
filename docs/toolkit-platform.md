# Deep End Toolkit: shared identity, credits and billing

## User decision

Upgrade the existing Lead Scorer as part of the personal-brand toolkit at deependhq.com. Anyone can sign up through Clerk. Each person gets one shared trial-credit balance usable across integrated tools. Clerk Billing handles paid plans and subscription management. Showcase and consolidate the actual tools, not every external dependency or unlaunched repository.

This supersedes the Supabase OTP and per-tool account portions of the initial Lead Scorer drafts. No production code or database migration from those drafts has been deployed.

## Verified starting point

The live /toolkit currently presents a mixed technology-stack inventory, ranked by mentions in the public log. It includes third-party products, internal tools, skills, repositories and actual runnable products. That is a build-in-public stack page, not a customer-ready tool launcher. `ToolkitPage.jsx:29-62` builds the inventory and rankings, and `:137` / `:181` open catalog URLs, often GitHub rather than product URLs.

`content.json` lists ChampBeam and ChampUTM separately even though ChampBeam's own description says ChampUTM lives inside it. It lists several `#` destinations and internal products. A catalog entry or HTTP 200 does not prove a tool supports public users or a shared wallet. Verify actual flows before marking a card usable.

Production has a static React/prerender + Cloudflare Worker site. A Next.js 16 / React 19 app also exists under deependhq-next, but it is not evidence that the live host runs it. Do not migrate the entire personal site merely to add billing. Pick the smallest supported Clerk integration after checking current SDK support for the served React/browser stack.

## Visitor journey

1. Browse a public, visual gallery organised by outcomes: research and data, outreach and content, documents, and workflow. Each owned tool gets a plain description, real preview, availability, pricing mode and a clear action.
2. Open a free local/browser-only tool immediately where appropriate. No forced login or artificial credit charge for computation the visitor's browser performs.
3. Open a metered tool and use one Clerk sign-in, preferably Google or email. Return to the tool and preserve its locally configured input.
4. Receive one bounded welcome grant per eligible verified account. The grant amount is configurable and remains disabled in production until approved; a global trial-spend ceiling protects against signup farming. Do not promise one person equals one account.
5. See the maximum credits before a paid action, the shared balance, and which data leaves the browser. Reserve credits atomically before dispatch; settle actual usage, release unused reservations, hold ambiguous outcomes for reconciliation.
6. Review results with evidence, cost, and a private run history. A run in Tool A immediately reduces the available balance in Tool B.
7. Upgrade through Clerk Billing. Grant the plan's allowance once for each verified paid subscription period, using idempotent server-side handling. Failed or incomplete checkout must never mint credits. A browser success redirect is not proof of payment.
8. Visit one account page for plan, billing management, credits remaining and per-tool usage history.

## Responsibility split

| Layer | Responsibility |
| --- | --- |
| Clerk | Signup, signin, verified identity, session management, profile |
| Clerk Billing | User subscriptions, checkout, plan and feature entitlements, payment lifecycle |
| Application database | Cross-tool usage wallet, grants, reservations, settlements, refunds, quotas and audit history |
| Tool backends | Verify Clerk identity and entitlement, reserve shared credits, execute bounded work, record measured provider costs |
| Admin | Trial grant and plan-credit configuration, per-user/global ceilings, suspend access, inspect spend by tool and user |

Clerk's documented Account Credits are monetary balances applied to eligible billing charges. They are not assumed to be the application's arbitrary execution-credit meter. Keep usage credits and billing monetary credits distinct unless Clerk explicitly supports the desired consumption semantics.

Sources checked: https://clerk.com/docs/guides/billing/overview , https://clerk.com/docs/guides/billing/for-b2c , https://clerk.com/docs/guides/billing/account-credits . Clerk Billing uses Stripe for payment processing, and Clerk plans/subscriptions are distinct from Stripe Billing.

## Credit design

Use integer credits with a versioned server-side price per action. Keep provider cost separately in integer USD microdollars. Credits measure the user's allowance; provider USD measures our cost. Don't present arbitrary conversion as literal vendor billing.

Each ledger operation records Clerk user id, tool id, run id, event type, idempotency key, credit delta/reservation, provider actual/unknown cost, timestamp and pricing version. Shared wallet balances must be transactionally enforced, not kept in Clerk client metadata or browser state. Every expensive endpoint uses the same reserve/settle path. A pretty account badge alone does not integrate a tool.

Trial credit count, paid prices, monthly allowance, rollover and grant expiry remain commercial decisions. Implement configuration but do not invent live prices or enable spending without an approved ceiling. Suggested initial model: one welcome grant, then one paid monthly plan, no automatic overages. Add plan complexity only when demanded.

## Catalog states

- Integrated: public flow verified, Clerk session verified server-side, shared credits enforced, cost and error handling tested.
- Free/browser-local: no provider spend; can remain free and accessible without signup.
- External product: showcase and link, but do not imply shared credits or shared login until its backend is integrated.
- Coming soon/private: no false Try now button. Explain availability or omit from the public launcher.

Keep the build stack and repositories reachable as a secondary section or /stack; do not delete the build-in-public record to create the customer gallery. Consolidate duplicate products under one canonical entry, preserving useful old links.

## Lead Scorer as first integrated tool

CSV/XLSX -> local mapping and preview -> user-approved maximum credits -> Treg enrichment and actual email verification -> Jev ICP/custom score/category judgements -> private results and formula-safe CSV export.

Email deliverability is a provider observation with source, timestamp and unknown/catch-all distinctions, not an LLM guess or guarantee of inbox placement. Missing Jev output is Unjudged. Run evidence is private to its owner. No contact sending in this scope.

## Release gates

Verified Clerk signup/signout/return path; backend rejects anonymous or wrong-audience tokens; a user cannot read another user's runs or grant credits; duplicate and out-of-order billing events cannot double-grant; concurrent runs across two tool IDs cannot overspend; provider timeout retains a hold; failed payments grant nothing; price changes don't alter in-flight reservations; global limits fail closed; mobile and desktop browser flows and screenshots pass.

No live Clerk keys are present in the current process. Production Clerk instance/domain, billing payment gateway, webhook signing configuration and approved commercial settings are prerequisites for a live launch. Never request secret keys in chat. Set them through the deployment secret manager.
