# DemandScope 商用公開チェックリスト

更新: 2026-11-09

## 現在の販売設計

- Free: 0円
- Pro: **月額980円**
- 課金周期: 月額自動更新
- 解約: Stripe Customer Portalから行い、原則として契約期間末で終了
- 決済: Stripe Checkout
- 契約管理: Stripe Customer Portal
- 分析データ: 原則ブラウザ内処理。需要ファイル自体を決済サーバーへ送らない
- Live課金: **まだOFF**。 `LIVE_BILLING_ENABLED=true` が最終スイッチ

## 完了済み

### アプリ / Cloudflare

- GitHub main → Cloudflare Pages Production自動デプロイ
- D1 Production binding `DB`
- D1 schema: members / subscriptions / stripe_events / checkout_acceptances 等
- Webhookの冪等保存
- Webhook backlog監視
- TEST/LIVEイベントの署名シークレット分離
- TEST/LIVE subscriptionのlivemode分離
- Free / Pro機能境界
- PDF / CSVレポート
- 日本語 / 英語
- XLSX / CSV / TSV / TXT読込
- 4,000回Monte Carlo
- 直近ボラティリティを長期で薄めない保守推定
- GitHub Actions + Cloudflare build gate

### Stripe TEST

- TEST Checkout E2E
- Customer作成
- Subscription作成
- Pro権限反映
- Customer Portal
- cancel-at-period-end
- Webhook persistence
- 別購入者メールのCheckout引継ぎ

### Stripe LIVE準備

- Live Customer Portal:
  `bpc_1UZqUZBGa8rL8jwIrmBsxuO0`
- Live Portal login:
  `https://billing.stripe.com/p/login/7sYaEW1Q36DN9Km1GN93y00`
- Live Webhook:
  `we_1UZqVxBGa8rL8jwIWuHw7CVK`
- Live Webhook URL:
  `https://web-stock-78r.pages.dev/api/stripe-webhook`
- Live決済は専用Live key / Price / Portal / Webhookを使用
- TESTとLIVEをコードで混在させない
- Live PriceはCheckout前に次をサーバーで再照合:
  - livemode=true
  - active=true
  - JPY
  - **980円**
  - month / interval_count=1
  - Product metadata: `app=demand-scope-pro`, `tier=pro`

## 本番公開を止めている残件

### 1. Stripe本人確認

Stripe accountは決済受付自体は可能だが、現時点では本人確認書類の要件により payout が停止している。

本番公開前にStripe Dashboardで本人確認書類を完了し、

- charges_enabled=true
- payouts_enabled=true
- details_submitted=true

をすべて満たすこと。

### 2. DemandScope専用Live Product / Price

作成予定:

- Product: DemandScope Pro
- metadata:
  - app=demand-scope-pro
  - tier=pro
- Price:
  - JPY 980
  - recurring monthly

既存NamiData Product/Priceを流用しない。

### 3. Google会員認証

別端末・Cookie削除後にもPro権限を復元するため、本番ではGoogle OIDCを必須にする。

Cloudflare Production:

- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- AUTH_REQUIRED=true

D1 member ↔ Stripe Customer ↔ Subscription が一致することをE2Eで確認する。

### 4. Live Stripe Secrets / Variables

Cloudflare Productionに設定:

- STRIPE_LIVE_SECRET_KEY = Secret
- STRIPE_LIVE_PRO_PRICE_ID = Variable
- STRIPE_LIVE_PORTAL_CONFIG_ID = `bpc_1UZqUZBGa8rL8jwIrmBsxuO0`
- STRIPE_LIVE_PORTAL_LOGIN_URL = Live Portal login URL
- STRIPE_LIVE_WEBHOOK_SECRET = Secret
- LIVE_BILLING_ENABLED = **最後までfalse**

Live Webhook signing secretはGitHub・ドキュメント・チャットへ保存しない。

### 5. 返金条件

`REFUND_POLICY_CONFIRMED=true` にする前に、課金・解約ページと特商法表記の内容を最終確定する。

### 6. 法務表示

現状は事業者情報の「請求により遅滞なく開示」導線をreadinessが認識する構成。

公開前に少なくとも以下を画面上で一致させる:

- 月額980円
- 月額自動更新
- 決済後に提供開始
- Stripe Portalから解約
- 解約の効力発生日
- 返金条件
- 利用規約
- プライバシー
- 特商法表記

## 最終Live切替手順

**順序を変えない。**

1. GitHub Actions PASS
2. Cloudflare Production PASS
3. PDF / CSV / XLSX実機QA PASS
4. Stripe本人確認・payout PASS
5. Live Product/Priceの980円検証 PASS
6. Live Portal PASS
7. Live Webhook Secret設定 PASS
8. Google OAuth PASS
9. member ↔ Customer ↔ Subscription E2E PASS
10. 法務/返金表示 PASS
11. `/api/commercial-readiness` の未達を解消
12. 最後に `LIVE_BILLING_ENABLED=true`
13. 少額の実カード本番Checkoutを1件実施
14. Checkout → Pro権限 → Webhook → Portal → cancel を確認
15. 問題なければ一般公開

## SALE_READY条件

次を全部満たすまで `SALE_READY` としない。

- GitHub Checks PASS
- Cloudflare Pages PASS
- `ready_for_live=true`
- Live Price = JPY 980/month をサーバー再照合
- Stripe payout可能
- Google認証済みmemberで購入
- 別端末でPro復旧
- Webhook backlog=0
- PDF/CSV出力正常
- 解約導線正常
- 法務表示と実際の課金条件が一致

