# DemandScope — Owner Launch Handoff 2026-11-12

## Current state

Status: SALE_RC / LIVE OFF

Stripe LIVE already prepared:
- Product: DemandScope Pro
- Product ID: prod_VbErdTf8qXvmSr
- Price: price_1Ua2NWBGa8rL8jwIKk7Tbtas — JPY 980/month
- Portal config: bpc_1UZqUZBGa8rL8jwIrmBsxuO0
- Portal login: https://billing.stripe.com/p/login/7sYaEW1Q36DN9Km1GN93y00
- Webhook endpoint: we_1UZqVxBGa8rL8jwIWuHw7CVK
- Webhook URL: https://web-stock-78r.pages.dev/api/stripe-webhook

Customer total:
- Pro: JPY 980/month
- Stripe Tax automatic add-on: not used

## Owner-only actions

### 1. Cloudflare Production secrets
Set / verify:
- STRIPE_LIVE_SECRET_KEY
- STRIPE_LIVE_WEBHOOK_SECRET
- GOOGLE_OAUTH_CLIENT_SECRET
- SESSION_SECRET

Verify non-secret values:
- STRIPE_LIVE_PRO_PRICE_ID=price_1Ua2NWBGa8rL8jwIKk7Tbtas
- STRIPE_LIVE_PORTAL_CONFIG_ID=bpc_1UZqUZBGa8rL8jwIrmBsxuO0

Keep LIVE_BILLING_ENABLED=false until final E2E.

### 2. Google OAuth
Verify the DemandScope production callback URI configured in Google Auth Platform matches the current production app callback exactly.

### 3. Stripe public display
Review:
- public business name
- statement descriptor / Japanese card-statement display
- support contact

### 4. Final real-card E2E
1. commercial-readiness green
2. temporarily set LIVE_BILLING_ENABLED=true
3. buy one Pro subscription with owner-controlled real card
4. verify same-browser Pro activation
5. verify Google member -> Stripe Customer/Subscription binding
6. verify webhook backlog zero
7. open Customer Portal
8. cancel at period end
9. verify access remains until period end and next charge is stopped

### 5. Public sale switch
Leave LIVE_BILLING_ENABLED=true only after the above lifecycle passes.

## Assistant-owned work already completed
- security/code audit
- Google-bound live checkout/activation hardening
- exact JPY 980 live Price verification
- Portal/Webhook integration
- Japanese/English UI
- sale RC and CI gates

## Reduced Cloudflare input after owner approval

Non-secret LIVE settings are now pinned in code:
- LIVE mode automatically activates when a valid STRIPE_LIVE_SECRET_KEY is present (unless LIVE_BILLING_ENABLED=false is explicitly set).
- Live Pro Price: price_1Ua2NWBGa8rL8jwIKk7Tbtas
- Live Portal config: bpc_1UZqUZBGa8rL8jwIrmBsxuO0
- Live Portal login URL is pinned.
- Production origin: https://web-stock-78r.pages.dev

Therefore the remaining Cloudflare secrets are only:
- STRIPE_LIVE_SECRET_KEY
- STRIPE_LIVE_WEBHOOK_SECRET

Do not place either secret in GitHub or chat.
