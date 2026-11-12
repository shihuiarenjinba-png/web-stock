# DemandScope SALE_RC Package — 2026-11-12

Status: **SALE_RC / LIVE HOLD**

Repository: `shihuiarenjinba-png/web-stock`
Audited code head: `ff08eafa1a21960beaf4839f3391dbb8c75bc582`
Test gate: **82/82 PASS**

## Package contents

The web-product release package is the immutable Git commit plus Cloudflare Pages build output. No desktop installer is required.

Included:
- public Free / Pro UI
- Japanese / English UI
- demand import and Monte Carlo analytics
- Stripe TEST/LIVE billing implementation
- Google identity + Stripe entitlement binding
- legal / billing / commerce surfaces
- security headers
- CI and commercial readiness checks

## Promotion sequence

1. Merge audited hardening PR.
2. Verify main CI exact-head.
3. Verify Cloudflare Pages exact-head deployment.
4. Complete owner-only live gates in PRE_SALE_AUDIT_2026-11-12.md.
5. Run one real-card production lifecycle E2E.
6. Only after all five steps, set LIVE_BILLING_ENABLED=true and record the production SHA / deployment ID.

No test or preview build may be promoted by URL alone; SHA equality is required.
