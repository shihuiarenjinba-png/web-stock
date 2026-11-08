# DemandScope 商用・据え置き運用チェックリスト

更新: 2026-11-08

## 目的

DemandScopeを、運営者が日常的に手作業しなくても「申込 → 月額課金 → 契約状態同期 → Pro権限 → 契約管理/解約」が継続するSaaSとして運用するための残件です。

## 現在できていること

- Cloudflare Pages + GitHub自動デプロイ
- Free / Pro分離
- Stripe TEST Checkout / Customer Portal
- サーバー側でのStripe契約再照合
- HttpOnly署名Cookie
- Stripe Webhook署名検証
- 法務ページ（利用規約 / プライバシー / 特商法表記 / 課金・解約）
- Pro申込画面の月額・自動更新・解約表示
- Publicはindex、Proはnoindex
- D1用スキーマとWebhook契約同期コード

## 本番課金を有効にする前の必須事項

### 1. Cloudflare D1

1. web-stock専用D1データベースを作成
2. migrations/0001_commercial_core.sql を適用
3. Pages FunctionsのProduction Bindingで変数名 DB としてD1を接続
4. Previewにも別DBを推奨（Production DBをPreviewから触らせない）

WebhookはDBが無い場合に 503 を返します。Stripeに成功応答を返してイベントを捨てる設計にはしていません。

### 2. Stripe Webhook

Stripe TESTエンドポイント:
https://web-stock-78r.pages.dev/api/stripe-webhook

最低限監視するイベント:
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted

Stripe TEST Webhook endpoint は作成済み: we_1UZXulBGa8rL8jwIJQf0McF8\n\nWebhook Signing Secret whsec_... をCloudflare Production Secret STRIPE_WEBHOOK_SECRET に登録。Secret値はGitHub・チャットへ保存しない。

### 3. 購入者本人認証

本番ではブラウザCookieだけを会員IDにしない。

推奨:
- Google OIDC
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- 認証済みGoogle subjectをD1 members に保存
- Stripe Customer IDとmemberを1対1で紐付け
- Pro権限 = 「認証済みmember」かつ「DB/Stripe上で有効なsubscription」

現行コードはこのID紐付けの前段階です。本番販売では必須。

### 4. 法務情報

/legal/commerce/ の以下を実情報へ置換してから本番販売:
- 販売事業者名
- 運営責任者
- 所在地
- 電話番号
- サポートメール
- 本番価格（税込）
- 支払時期
- 本番の返金条件
- 解約時の効力発生日

本番販売前は「本番販売開始前に掲載」のままでもテストページとしては可。ただしLive Checkoutを有効化してはいけない。

### 5. 本番価格・税

現在のJPY 100/月はTEST専用。
本番Product/Priceを作る前に、消費税/Stripe Taxの扱いと税込・税別表示を決定する。
既存NamiData Labの商品・価格は流用しない。

### 6. 決済最終確認

本番Checkout直前に明示:
- 月額料金
- 自動更新
- 各回の請求時期
- 提供開始時期
- 解約方法
- 解約の効力
- 返金条件
- 利用規約 / 特商法表記へのリンク

### 7. 運用監視

最低限:
- Stripe Webhook失敗通知
- Cloudflare Functions 5xx監視
- 支払失敗 / subscription canceled の確認
- D1バックアップ/復元手順
- 月1回のTEST Checkout / Portal / cancel E2E
- 利用規約・プライバシー・特商法ページのリンク切れ監視

## 現在の安全ゲート

- Live Stripe key (sk_live_ / rk_live_) はコードで拒否
- 本番販売価格は未設定
- /api/commercial-readiness はLive readyを常にfalseとする
- 法務事業者情報が未確定
- Google会員認証未接続

したがって、現段階で実カード課金に切り替わることはありません。
