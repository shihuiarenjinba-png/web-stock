# DemandScope 商用公開チェックリスト

更新: 2026-11-10

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
- Live課金: `LIVE_BILLING_ENABLED=true` が最終スイッチ

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

### 1. Cloudflare Google / LIVE Stripe Variables / Secrets

Productionに設定:

- `GOOGLE_OAUTH_CLIENT_SECRET` = Secret
- `SESSION_SECRET` = Secret（Google identity cookie / Checkout browser state用）
- Google Auth PlatformのDemandScope専用ClientにProduction callback URIを登録

Stripe側:

- `STRIPE_LIVE_SECRET_KEY` = Secret
- `STRIPE_LIVE_PRO_PRICE_ID=price_1Ua2NWBGa8rL8jwIKk7Tbtas`
- `STRIPE_LIVE_PORTAL_CONFIG_ID=bpc_1UZqUZBGa8rL8jwIrmBsxuO0`
- `STRIPE_LIVE_PORTAL_LOGIN_URL=https://billing.stripe.com/p/login/7sYaEW1Q36DN9Km1GN93y00`
- `STRIPE_LIVE_WEBHOOK_SECRET` = Secret
- `REFUND_POLICY_CONFIRMED=true`
- `LIVE_BILLING_ENABLED=false` のまま設定を完了する

Secret値はGitHub・README・チャットへ保存しない。

### 2. Stripeアカウント公開表示

アカウント既定のstatement descriptorに個人名が残っている。DemandScope Productには `DEMANDSCOPE` を設定済みでSubscriptionではProduct descriptorが優先されるが、日本のカード発行会社による表示差があるため、一般公開前にStripeの公開ブランド名・日本語明細表示を確認する。

### 3. 最終Live E2E

1. Cloudflare LIVE variables/secrets設定
2. `/api/commercial-readiness` 確認
3. `LIVE_BILLING_ENABLED=true`
4. Stripe Checkoutが **DemandScope Pro / 980円 / 月額** と表示することを確認
5. 実カードで1件だけ本番購入
6. Checkout完了 → 同一ブラウザPro開放
7. Webhook backlog=0
8. Customer Portalを直接開ける
9. Portalメールログインが購入メールで機能
10. cancel_at_period_end
11. 契約期間末までProが有効
12. 次回請求停止を確認

## SALE_READY条件

- GitHub Checks PASS
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
