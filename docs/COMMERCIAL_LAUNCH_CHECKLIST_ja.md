# DemandScope 商用公開チェックリスト

更新: 2026-11-13

## 現在の販売設計

- Free: 0円
- Pro: **月額980円**
- 課金周期: 月額自動更新
- 決済: Stripe Checkout
- 契約管理: Stripe Customer Portal
- 解約: 原則として現在の契約期間末で終了
- 返金: 利用者都合の日割返金なし。二重請求・誤請求・サービス側の重大な決済不具合・法令上必要な場合は対応
- 分析データ: 原則ブラウザ内処理
- アプリ本人認証: **Google OAuth（openid email profile）**
- 権限元: **Stripe Subscription**。Googleログイン成功だけではProにしない
- Pro権限: Checkout開始ブラウザの署名Cookie＋Stripe再照合、またはGoogle `sub`→内部member→Stripe Customer/Subscriptionの再照合
- 別端末復旧: Google本人認証後、内部memberに紐付くStripe Customer/active Subscriptionを再検証。メール文字列だけでの復元は禁止
- Live課金: 有効なProduction Live Secretが揃うまで公開Checkoutをfail-closed。旧設定で `LIVE_BILLING_ENABLED=false` が明示されている場合だけ、最終切替時に解除する。

## 完了済み

### Stripe LIVE

- Stripe本人確認: PASS
- `charges_enabled=true`
- `payouts_enabled=true`
- `details_submitted=true`
- Product: `DemandScope Pro`
- Product ID: `prod_VbErdTf8qXvmSr`
- Price: **JPY 980 / month**
- Price ID: `price_1Ua2NWBGa8rL8jwIKk7Tbtas`
- Product metadata: `app=demand-scope-pro`, `tier=pro`
- Product statement descriptor: `DEMANDSCOPE`
- Live Portal: `bpc_1UZqUZBGa8rL8jwIrmBsxuO0`
- Live Portal login: `https://billing.stripe.com/p/login/7sYaEW1Q36DN9Km1GN93y00`
- Live Webhook: `we_1UZqVxBGa8rL8jwIWuHw7CVK`
- Live Webhook URL: `https://web-stock-78r.pages.dev/api/stripe-webhook`
- TEST/LIVE key・Price・Portal・Webhookを分離
- Checkout前にLive Priceを再取得し、Live / active / JPY / 980 / monthly / DemandScope metadataを検証

### アプリ / Cloudflare

- GitHub main → Cloudflare Pages Production自動デプロイ
- 公開ProductionでTEST Checkoutを禁止し、Live未準備時は **PRE-LAUNCH / 販売準備中** と表示
- 初期Pro販売枠: **25名**
- 同一memberのCheckout連打は同一30分予約を再利用し、1人で複数枠を消費できない
- D1 Production binding `DB`
- Stripe Webhook冪等保存
- Webhook backlog監視
- Checkout Sessionのブラウザ紐付け
- Stripe Subscriptionの再照合
- Free / Pro機能境界
- PDF / CSV
- XLSX / CSV / TSV / TXT
- 日本語 / 英語
- 4,000回Monte Carlo
- Pro PDF総合所見・優先SKU・推奨アクション
- GitHub Actions + Cloudflare deployment gate

## Google本人認証 + Stripe権限方針

Googleに委託するもの:

- OpenID Connectによる本人認証
- 安定ID `sub`
- 検証済みメール情報（連絡・照合補助。権限元にはしない）

Stripeに委託するもの:

- 決済時のカード認証
- 購入者メールアドレス
- Customer
- Subscription
- Customer Portalへのメールログイン
- 支払方法変更
- 請求書確認
- 解約

DemandScope側に残すもの:

- Google `sub` と内部member IDの紐付け
- 内部memberとStripe Customer IDの紐付け
- Checkoutを開始したブラウザとの照合
- HttpOnly署名Cookie
- Stripe Subscriptionのactive/trialing再検証
- Webhookによる契約状態同期

**Googleログイン成功 = Pro** ではない。Proは必ずStripe Subscriptionを再照合して決める。Stripe Customer Portalは課金・契約管理用であり、メールアドレスを入力しただけで既存Subscriptionを復元する実装は禁止する。

## 本番公開を止めている残件

### 1. Cloudflare Production LIVE Stripe Secrets

Google OAuth / D1 /法務条件は公開環境で確認済みです。残るProduction秘密値は次の2つです。

- `STRIPE_LIVE_SECRET_KEY`
- `STRIPE_LIVE_WEBHOOK_SECRET`

非SecretのLive Price / Portal / origin はコード側で固定済みです。

Secret値はGitHub・README・Issue・PR・チャットへ保存しない。

現在の公開 `/api/commercial-readiness` は `environment=test` / `ready_for_live=false` で、PRE-LAUNCHロックにより公開TEST Checkoutも停止しています。

有効なLive Secret設定後も `environment=test` の場合のみ、Cloudflareに旧 `LIVE_BILLING_ENABLED=false` が残っていないか確認してください。

### 2. Stripe明細表示

DemandScope Productには `DEMANDSCOPE` の statement descriptor を設定済み。Subscription課金ではProduct descriptorを利用するため、アカウント全体の既定descriptor変更は販売開始条件にしない。

カード発行会社がStripeから送られたdescriptorとは異なる独自のfriendly merchant nameを表示する場合があるため、銀行アプリ上の表示差は販売ゲートではなく運用監視項目として扱う。

### 3. 最終Live Gate

1. Productionの2つのLive Stripe Secretを設定
2. 最新mainがCloudflare Pages Productionへ反映済みか確認
3. `/api/commercial-readiness` を確認
4. `environment=live`
5. `ready_for_live=true`
6. Live Price = **DemandScope Pro / 980円 / 月額**
7. Stripe account charges / payouts / details submitted = true
8. live webhook secret = true
9. D1 schema = true / webhook backlog = 0
10. Google OAuth configured = true
11. capacity limit = 25

Owner自身の実カード自己購入は必須条件から除外する。最初の実顧客取引を Checkout → Subscription → Webhook → entitlement → Portal のproduction validationとして監視する。

## SALE_READY条件

- GitHub Checks PASS
- Cloudflare Productionが最新mainを配信
- 公開TEST CheckoutがPRE-LAUNCH中は停止
- 初期Pro販売枠25名 + 同一member重複予約防止
- Cloudflare Production PASS
- Stripe Price = JPY 980/month
- Stripe payout可能
- Webhook署名検証PASS
- Webhook backlog=0
- Checkoutブラウザ紐付けPASS
- Subscription再照合PASS
- PDF/CSV/XLSX PASS
- 法務表示と実課金条件一致
- Stripe公開表示に不要な個人情報・NamiData商品名の混入なし
- Google OAuth本人認証PASS
- Google `sub`→内部member→Stripe Customer/Subscription紐付けPASS
- Google単独・メール文字列単独でProにならないことを確認


### 価格表示確認（2026-11-12）
- お客様の支払総額: **980円 / 月**
- Stripe Taxによる追加課税を前提にせず、事業者側の消費税申告・経理処理とは分離して扱う。
