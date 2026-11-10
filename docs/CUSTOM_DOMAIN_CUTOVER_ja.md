# DemandScope 独自ドメイン接続手順

この手順は、独自ドメイン名が確定する前にコード側を準備し、ドメイン完成後の変更をCloudflare/Stripe設定中心に限定するためのものです。

## 現在の準備

コードは `APP_ORIGIN` を正規URLとして使えます。

`APP_ORIGIN` を独自HTTPS originに設定し、Stripe Dashboard側のURL更新確認後に `STRIPE_DOMAIN_URLS_CONFIRMED=true` とすると、Stripe Checkoutの成功/キャンセル戻り先とStripe Customer Portalの戻り先は、その正規URLを優先します。確認前は既存ホストを使い続け、古い `APP_ORIGIN` だけで戻り先を壊さない設計です。

独自ドメイン移行が完了するまで:

```text
DOMAIN_CUTOVER_ENFORCED=false
STRIPE_DOMAIN_URLS_CONFIRMED=false
```

を維持してください。

## ドメイン完成後

例:

```text
APP_ORIGIN=https://demand.YOUR_DOMAIN
DOMAIN_CUTOVER_ENFORCED=false
STRIPE_DOMAIN_URLS_CONFIRMED=false
```

`APP_ORIGIN` はパスを含めず、HTTPS originだけを設定します。

### 1. Cloudflare

1. `web-stock` Pagesプロジェクトへ独自ドメインを追加
2. DNSと証明書がActiveになるまで確認
3. 独自ドメインから `/`, `/pro/`, `/api/stripe-status` を確認
4. Production環境の `APP_ORIGIN` を独自ドメインへ変更

### 2. Stripe

既存のDemandScope専用リソースを更新し、別製品のIDは作り直さない。

- Product URL → `https://demand.YOUR_DOMAIN/pro/`
- Billing Portal privacy URL → `https://demand.YOUR_DOMAIN/legal/privacy/`
- Billing Portal terms URL → `https://demand.YOUR_DOMAIN/legal/terms/`
- Billing Portal default return URL → `https://demand.YOUR_DOMAIN/pro/`
- Webhook endpoint URL → `https://demand.YOUR_DOMAIN/api/stripe-webhook`

可能なら既存Webhook endpointのURLを更新し、endpointを新規作成して署名Secretを不要に増やさない。

上記をStripe Dashboardで確認した後だけ:

```text
STRIPE_DOMAIN_URLS_CONFIRMED=true
```

とします。

### 3. Readiness

```text
GET https://demand.YOUR_DOMAIN/api/domain-readiness
```

で以下を確認:

- `custom_domain=true`
- `stripe_dashboard_urls_confirmed=true`
- `ready_for_domain_cutover=true`

### 4. E2E

独自ドメインから次を確認:

1. Free画面
2. Pro画面
3. Checkout開始
4. Stripe Checkout cancel → 独自ドメインへ復帰
5. TEST/LIVEで許可した場合のみ決済完了 → 独自ドメインへ復帰
6. Portal → 独自ドメインへ復帰
7. Webhook受信
8. entitlement確認
9. 法務ページ
10. Cookieが独自ドメインで正常に維持されること

メールによるクロスデバイス復元はAuth Mail Gateway側の別工程です。Gateway本体はこの作業では変更しません。ドメイン移行時にはGateway側のDemandScope callback allowlistも新ドメインへ合わせる必要があります。

### 5. 旧ホストからの課金操作を停止

上記E2EがPASSした最後にだけ:

```text
DOMAIN_CUTOVER_ENFORCED=true
```

へ変更します。

この状態では、独自ドメイン以外から到達したCheckout/Portal等の同一オリジン保護対象操作をfail-closedにできます。

## 切替前に行わないこと

- 独自ドメイン完成前の `DOMAIN_CUTOVER_ENFORCED=true`
- DemandScope以外のStripe Product/Priceの流用
- Auth Mail GatewayのSecret変更
- 本番課金条件の変更
- NamiData側の変更
