# Toolkit usage and launch decisions

## Visitor journey
Browse the public toolkit without an account. Open Lead Scorer, sign in through the shared Clerk application, and receive one welcome grant when trials are enabled. Upload and map a CSV or Excel file locally. The mapped rows are sent to the server only for the approved quote/run workflow. Review the maximum credit reservation before starting. Treg supplies enrichment and email checks; Jev evaluates ICP fit and up to three custom rubrics. Review private results, uncertainty and evidence, then export safely.

The account page is the common home for balance, reserved credits, usage, run history and Clerk-managed subscription UI. Account creation never means a new trial for each tool. Browser-local PDF work must remain free.

## Ownership of money and credits
Clerk owns authentication, plans, checkout, payment status and subscriptions. The toolkit owns execution credits. Clerk's monetary Account Credits are not execution credits.

Current execution units: 1 credit corresponds to 1,000 USD microdollars of provider cost, or $0.001. Credits are a usage allowance, not a customer cash balance or refund entitlement. Plan retail prices are separate and must be selected before enabling billing. Provider costs, credits consumed and plan charges are distinct records.

Reserve the full conservative maximum before provider dispatch. Consume known actual costs, round once at run settlement, return the remainder. Unknown provider charges retain a hold for reconciliation, never become a free call. Stop future paid steps when a charge is missing or above its allowance. User and platform caps apply before dispatch and share one ledger across registered tools.

## Limits and launch defaults
Keep welcome grants, plan allowances and spend authority at zero until the operator chooses budgets. Require a server-side admin allowlist. The launch controls need user caps, platform caps, suspension and a global stop. A fresh login or a second browser tab must not bypass caps. The trial pool limits exposure from signup farming but does not identify every person across multiple accounts.

## Clerk Billing eligibility is a launch gate
Checked against https://clerk.com/docs/guides/billing/overview on 2026-10-20: Clerk Billing uses Stripe for payments, supports USD billing only, is not a merchant of record, and explicitly lists Brazil, India, Malaysia, Mexico, Singapore and Thailand as unsupported because of payment-processing restrictions.

Deep is based in India, but the legal merchant entity and Stripe account country have not been confirmed. Do not infer eligibility from residence or from the existence of a US group company. Leave billing disabled until the actual merchant setup is confirmed supported. Clerk authentication and a capped free trial can launch independently of paid subscriptions. If the merchant is India-only, retain Clerk identity and the shared ledger, but choose an India-supported billing provider in a separate approved change. No workaround or unsupported account setup is implied.

## Integration truth
Lead Scorer is the first tool being integrated with this shared ledger. Existing external products are not automatically converted by adding gallery cards. ChampBeam and ChamPDF retain their own account/availability behavior until their backend integrations are explicitly implemented and verified. Event Scout is a preview deployment. GitHub-only projects are source listings, not runnable hosted services. ChampUTM is consolidated under ChampBeam. Internal systems stay in the build-stack record, not the customer launcher.

## Launch decisions still required
Confirm the Clerk application and frontend host, eligible merchant country, welcome grant, total trial exposure, user and platform caps, paid plan IDs and allowances, and data retention/deletion policy. Configure server-side secrets without putting them in chat or source control. Run Clerk test-mode signup, checkout, cancellation, payment-failure and webhook replay flows before public launch. Separately approve a tiny live Treg/Jev spend probe. Retire the old Supabase Lead Scorer endpoint rather than leaving a parallel public spend path.

No production deployment, migration, checkout or paid provider execution has been performed during this build.
