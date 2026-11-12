# DemandScope — Pre-Sale Audit 2026-11-12

## Verdict

- Code / CI quality: **PASS**
- Security hardening: **PASS**
- Sale release candidate: **PASS (SALE_RC)**
- Live charging / public sale: **HOLD_OWNER**

Audited code head before this documentation-only commit:
`ff08eafa1a21960beaf4839f3391dbb8c75bc582`

GitHub CI result: **82 / 82 tests PASS**.

## Reviewed surfaces

- Free and Pro UI / Japanese-English i18n
- CSV / XLSX import and spreadsheet-injection defenses
- 4,000-run Monte Carlo analytics and multi-SKU workflow
- Google OIDC identity
- Stripe TEST/LIVE separation
- Checkout / activation / entitlement / Customer Portal
- Stripe webhook signature and D1 event persistence
- Cross-device recovery
- Cloudflare Pages security headers and CSP
- legal / billing / commerce pages
- commercial readiness endpoint and launch checklist
- GitHub Actions / syntax / secret checks

## Sale-critical hardening added in this audit

1. LIVE Checkout fails closed if Google identity is not configured.
2. LIVE activation requires a Google member_id recorded by the initiating checkout.
3. The currently authenticated Google member must match the checkout member.
4. APP_ORIGIN is treated as the canonical mutation origin; alternate preview/host mutations are rejected.
5. Commercial readiness now requires Google configuration and canonical APP_ORIGIN.
6. A positive LIVE path test proves:
   Google identity -> verified JPY 980 Live Price -> Checkout browser binding -> active Stripe Subscription -> member/customer link -> Pro cookie.
7. GitHub Actions upgraded to current v7 and runner pinned to Ubuntu 24.04.

## Live sale owner gates

Do not switch to public charging until all items are confirmed:

- LIVE_BILLING_ENABLED=true only at final cutover.
- Exact production APP_ORIGIN is configured and Google callback URI matches it.
- STRIPE_LIVE_SECRET_KEY and STRIPE_LIVE_PRO_PRICE_ID are present.
- Live Price remains active JPY 980 / month and Product metadata is app=demand-scope-pro, tier=pro.
- Live webhook endpoint / signing secret and D1 webhook processing are healthy.
- Stripe Customer Portal cancellation works on a real subscription.
- Tax treatment and customer-facing total price display are confirmed by the business owner.
- Stripe public business name / statement descriptor / support contact are reviewed in the Stripe Dashboard.
- One owner-controlled real-card purchase -> activation -> portal -> period-end cancellation -> webhook lifecycle E2E is completed.
- The commercial disclosure process can actually provide the legally required operator information without delay before the customer decides to purchase.
- If marketed to English-speaking jurisdictions, legal / tax / consumer terms require jurisdiction-specific review beyond the Japanese launch materials.

## Release rule

This SHA may be used as the basis of a sale release candidate.
It must not be interpreted as authorization to enable live billing automatically.
