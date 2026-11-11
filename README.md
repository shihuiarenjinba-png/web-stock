# DemandScope v0.2 — 需要予測・在庫リスクシミュレーター / Demand & Inventory Risk

**日本語 / English · ファイルアップロード中心 · Cloudflare Pages · Stripe TEST/LIVE分離対応**

**Cloudflareに接続する際は、[Pages Git連携の設定手順](docs/CLOUDFLARE_PAGES_SETUP_ja.md)を先に参照してください。Workers Buildsの `npx wrangler deploy` は本リポジトリには使用しません。**

会計機能を含まない、過去需要の残差標準偏差と4,000回のモンテカルロ試行による需要・在庫リスクの意思決定支援Webアプリです。需要データの読み込み・計算・CSVレポート出力はすべてブラウザ内で実行し、サーバーへ送信しません。

## 認証方針更新（2026-11-10）

DemandScope本番では**Google OAuthを本人認証だけに使用**します。Googleの安定ID `sub` をD1上の内部memberへ紐付け、決済・契約・Pro権限の権威は引き続きStripe Checkout / Subscription / Customer Portalです。**Googleログイン成功だけでProにはしません。**

Pro権限は、(1) Checkout開始ブラウザのHttpOnly署名CookieとStripe Subscription再照合、または (2) Google認証済み内部memberに紐付いたStripe Customer / active・trialing Subscriptionの再照合で判定します。メールアドレス文字列だけを根拠にProを復元しません。

Stripe Customer Portalのメールログインは契約管理用です。別端末ではGoogle本人認証後、内部memberとStripe Customerの紐付けが確認できた場合にPro権限を再検証します。

現在のLive Productは `DemandScope Pro`、Live Priceは `price_1Ua2NWBGa8rL8jwIKk7Tbtas`（JPY 980 / month）です。NamiDataの商品・Priceは流用しません。

## 現在の商用公開準備（2026-11-09）

- Pro本番価格: **月額980円**
- Live課金は明示ゲート `LIVE_BILLING_ENABLED=true` のときだけ有効
- TEST/LIVEのStripe key・Price・Portal・Webhookを分離
- Live PriceはCheckout直前に **Live / active / JPY 980 / monthly / DemandScope Pro metadata** を再照合し、不一致なら決済をfail closed
- D1 Webhook同期・backlog監視・livemode分離済み
- Pro PDFは全体サマリー＋SKU別詳細＋分布図＋実際の分析警告を出力
- 本番公開の残件は [商用公開チェックリスト](docs/COMMERCIAL_LAUNCH_CHECKLIST_ja.md) を参照

> 現在は安全のためLive課金スイッチをOFFにしています。Google本人認証、Stripe Customer/Subscription紐付け、Live Product/Price、法務/返金条件、Live secrets、最終Live E2Eが完了するまで一般向け実課金は開始しません。


## できること

| | 無料 / Free | Pro（別ページ `/pro/`） |
|---|---|---|
| 読み込み | `.xlsx`, `.csv`, `.tsv`, `.txt` | 同じ |
| 行・列方向 | 自動提案し、手動で変更可能 | 同じ |
| 1ファイルからの分析 | **最大2つの需要系列**。日付やSKUの見出し列は上限に含まない | 複数需要系列を自動検出し、分割するか確認して登録 |
| 複数系列の合算 | なし（混同を防ぐ） | 明示的に選択した場合のみ。同じ期で整列している系列に限定 |
| 現在庫 | 系列ごとに任意で設定可能 | SKU編集画面で個別に設定 |
| シミュレーション | 4,000回、平均・SD・P50/P90/P95/P99・安全在庫・発注点・欠品確率・直近z値 | 各SKUを4,000回実行、一覧比較 |
| レポート | 最大2系列の簡易**CSV** | 全登録系列の比較**CSV**、全体サマリー＋SKU別詳細＋分布図＋注意事項の**PDF** |
| 制限 | 2系列 | 最大200 SKU、ブラウザ保存容量に依存 |
| 認証 | 不要 | ProはGoogle本人認証＋Stripe Subscriptionを使用。Google単独ではProにならない |
| データ保存 | 画面内のみ | ブラウザの`localStorage`のみ。クラウド同期・自動バックアップなし |

**注意：アップロードされたExcel自体を再配布する機能ではありません。出力するのは分析結果CSV/TXTです。** CSVはExcelで開けます。旧形式`.xls`は未対応です。Excel内の数式は実行せず、ファイルに保存されている計算済み値のみ読みます。

### 推奨するデータ形式（1期＝1日）

**列方向**：`Date,SKU-A,SKU-B,SKU-C` のように最初の行が列名で、その下に日々の需要を並べる。`Date`列は系列数に含みません。

**行方向**：先頭セルが`SKU`で、`SKU-A,12,13,...`のように各商品を行に並べる。期間は日付または期番号で統一してください。数値ではない商品名／日付欄は需要とみなしません。

- 複数シートがある場合、分析対象のシートを選択します。
- シリーズ数は自動推測なので、検出された「列ごと / 行ごと」「系列名」「プレビュー」を必ず確認してください。誤って日付を需要として扱わないよう、`Date`/`日付`などのヘッダーを付けるのがお勧めです。
- Proの合算は同じ期間・同じ単位を前提とします。欠損期・期間のズレが疑われる場合は個別分析を選択してください。期間ラベルの全件一致までは検査していないため、合算前の目視確認も必要です。
- 無料版で2系列選択時、現在庫は**各系列の入力欄**で別々に設定します。共通の「現在庫」は1系列分析／手動入力向けです。
- ファイル容量は最大5 MB、展開後24 MB、シートは最大12枚、各シートはおよそ10,010行・256列・550,000セル以内を上限とします。CSVのUTF-8（BOMあり／なし）と一般的なShift-JIS/CP932の読み込みをサポートします。
- 無効値・途中にある空白・期数不足の系列はエラーまたは対象外になります。移動平均7日の初期設定では10期以上の履歴を使用してください。

## 起動方法

```bash
cd demand-risk-simulator
npm run build
python -m http.server 8765 --directory public
```

無料版: `http://localhost:8765/`、Pro画面: `http://localhost:8765/pro/`。

静的HTTPサーバーだけでは`/api/*`（Stripe）がありません。**Proの決済／契約確認にはCloudflare Pages Functionsが必要**です。ブラウザ表示と計算のローカル開発には外部API、クラウドアカウント、Google Cloud JSONは不要です。

JSZip v3.10.1のブラウザ用ビルドを`public/assets/jszip.min.js`に同梱しています。ライセンスは`JSZIP_LICENSE.md`。公開中に外部CDNへ依存しません。

## モデル計算

1. 基準＝履歴の全体平均、または各時点の直前`w`日の単純移動平均。移動平均には未来値を使いません。
2. 残差＝実際の需要−当日の基準。残差の標本標準偏差（`n−1`）を推定。
3. 将来日次需要＝`max(0, 将来の基準 + 正規乱数 × 残差標準偏差)`。リードタイム内の需要を合計し4,000回独立に実行。
4. 出力＝リードタイム需要の平均・標準偏差・分位点、目標サービスレベル分位点から発注点、平均から推奨安全在庫、現在庫が入力された場合の欠品確率。
5. 最新日の乖離＝`(最新需要−当日の基準)/残差SD`。**標準誤差（SE）ではなく、残差の標準偏差（SD）を使用**します。

目標サービスレベルは**サイクルサービスレベル**（補充リードタイム中に欠品が起こらない確率）の目安で、数量充足率ではありません。実務では在庫ポジション（手持ち＋発注残−未引当）と現在庫を混同しないでください。モデルは独立・正規・一定のリードタイムを仮定しており、季節性、休日、トレンド、需要の自己相関、入荷変動、欠品による売上欠測などを直接扱いません。

## 同じStripeテストアカウント + 新Cloudflareアカウントで運用

Stripe MCPでは**既存アカウントのテスト環境**が確認済みです。既存サービスの商品・料金は変更しません。このツール専用の`Product`と月額サブスクリプション`Price`は、金額・税の取り扱い決定後に**テストモードで**作成してください。Checkout開始ブラウザと決済完了の照合は、別のHttpOnly Cookieに紐づけ、URLのSession ID単体では権限を開放しません。

Cloudflareについては**新しく作るアカウント**でも、**既存アカウントの別Pagesプロジェクト**でも、同じ配布物を利用できます。Cloudflare Pagesの無料枠内に収めるため、データはブラウザ内で計算し、FunctionsはStripe契約確認など必要なAPIだけに使います。別アカウント作成自体はアプリの動作要件ではありません。

**重要：ZIPファイルをPagesダッシュボードからドラッグ＆ドロップするだけでは`functions/`はデプロイされません。** Git連携かWrangler CLIを使います。

1. 新しいCloudflareアカウントにログイン。Workers & PagesからPagesプロジェクトを作成。Git連携の場合：**リポジトリルートが本プロジェクト、出力ディレクトリが`public`、Functionsディレクトリがルート直下`functions/`**。
2. CLIの場合は新アカウントへ`npx wrangler login`でログインし、Pagesプロジェクトを作ったうえで：

```bash
npx wrangler pages deploy public --project-name demand-risk-simulator
```

3. PagesのSettingsで次の設定を追加。**秘密情報はWorkers/Pages Secretsに設定し、GitやZIPには入れないでください。**

| 名前 | 設定値 |
|---|---|
| `STRIPE_SECRET_KEY` | Stripeの既存アカウントの**`sk_test_...`**（Secret） |
| `STRIPE_PRO_PRICE_ID` | **DemandScope専用**のテスト月額Price `price_...` |
| `SESSION_SECRET` | 新しく生成した32字以上のランダム文字列（Secret） |
| `APP_ORIGIN` | **新Cloudflareアカウント側で公開したサイトのURL**（`https://...pages.dev`。末尾`/`なし） |
| `STRIPE_WEBHOOK_SECRET` | Webhookエンドポイントを使う場合のみ`whsec_...`（Secret） |

4. 設定後に再デプロイ。Stripeテスト環境でCheckout/Customer Portalを設定し、成功時の`/pro/?session_id=...`遷移と契約権限を試験してください。
5. Stripe Webhook: `https://<NEW_PROJECT>.pages.dev/api/stripe-webhook`（現行実装は署名検証し受信するのみで、課金状態をDBに永続化しません）。

ローカルでPages Functionsも検証する場合、`.dev.vars.example`を`.dev.vars`にコピーして秘密鍵などを設定し、`APP_ORIGIN=http://localhost:8788`として：

```bash
npx wrangler pages dev public --port 8788
```

`APP_ORIGIN`が実際のオリジンと一致しない場合、Stripe Checkout APIはOriginを拒否します。**本番`sk_live_`を設定しても、この試験版は決済を有効化しない設計です。**

## テスト範囲と商用化前の残件

`npm test`ではモンテカルロ計算・CSV読込・行列検出・安全なCSV書き出し・Stripe APIモックなど18件を自動テスト。追加でChromium上のブラウザ内モジュール結合確認（FreeのCSV/XLSX、日英切替、モバイル、Pro多系列インポート、レポートDL）を実施。**Proのブラウザ試験は契約確認APIをモックしたもので、実決済試験ではありません。Cloudflareへの本番デプロイも未実施です。**

販売開始前には、**Google OAuth本人認証とStripe Customer/Subscription紐付けの実地確認、Stripe Webhookの冪等同期、法務・サポート表示、税区分、Live Checkout/Portal/解約E2E**を完走してください。現行コードはGoogle本人認証とStripe権限を分離しており、Google単独・メール文字列単独ではProを付与しません。

公式資料：
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/workers/wrangler/commands/pages/
- https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted

## 初期監査（2026-11-07）

- GitHub初期インポートに向け、決済Session IDの横流し再利用に対するブラウザ紐づけを追加。Stripe Checkout Sessionの`client_reference_id`を検証してから署名Cookieを発行します。
- Pro一括処理はSKUごとにUIへ制御を返し、成功/失敗件数を表示。上限2,500万日次抽選を超えた場合は明示的に停止します。
- 無料版で新しいファイルを開くと旧結果は非表示になります。
- CSPなど静的ページのセキュリティヘッダを追加しました。
- **安全性の境界**：試作版のPro処理はブラウザJSなので、支払いなしにコード改変して模倣することまで阻止できません。商用販売にするにはサーバー側での権限付き処理、購入者本人認証・ID紐づけが必要です。

## v0.3 — file upload, bilingual picker, PDF, Stripe test checkout

- Browser-native file chooser text is now custom translated labels in Japanese / English.
- Downloadable 60-day synthetic demand fixtures: 2-SKU CSV, 5-SKU CSV, row-based CSV, and 5-SKU Excel at `public/samples/`.
- Free and Pro include a browser **Print → Save as PDF** A4 report with text and tables. Browser PDF printing preserves Japanese characters and selectable text; no demand data is uploaded.
- Stripe **test mode only** allows a temporary JPY 100/month recurring Checkout price when no dedicated `STRIPE_PRO_PRICE_ID` is configured. It is not the final sale price.
- Pages Settings > Variables and Secrets: set `STRIPE_SECRET_KEY=sk_test_...` and `SESSION_SECRET` (32+ unpredictable characters) as encrypted Secrets, then redeploy. Optional: `APP_ORIGIN=https://web-stock-78r.pages.dev` and `STRIPE_PRO_PRICE_ID=price_...` (dedicated *test* monthly price).
- `/api/entitlement` returns only the names of missing settings, not any secret values.
- Existing NamiData Lab pricing is untouched; this pilot must not accept live cards or a live Stripe key.
- PDF output requires a browser with Save as PDF printing. It does not directly stream a PDF from the server.
- **Live Cloudflare Stripe transaction has not yet been verified** (needs user to configure Secrets). Do not enable real billing until user identity, subscriptions, taxes, and security tests are completed.

## 2026-11-07 Stripeテスト設定と現在庫入力の説明

- 既存NamiData Labテストアカウントに、DemandScope専用のカスタマーポータル設定 `bpc_1UZ2FNBGa8rL8jwIBPFuUkWT` を作成しました。デフォルトの既存ポータルは変更していません。
- `/api/portal` はこのテストポータルを使用します。別Stripeテストアカウントを使う場合は `STRIPE_PORTAL_CONFIG_ID` を別のIDに変更してください。
- **重要**: Stripe MCPでCloudflareのSecretは設定できません。Cloudflare Pages > Settings > Variables and Secrets (Production) に `STRIPE_SECRET_KEY` (`sk_test_...`) と `SESSION_SECRET`（32文字以上の暗号学的に安全な値）をSecretとして登録し、再デプロイしてください。価格IDは月額100円のテスト用inline priceを使う場合は不要です。
- サイトの `Pro` 画面で `/api/entitlement` の configured 判定が true になったことを確認した後、Stripeの**テストカード**で決済テストし、`/pro/?session_id=...` の復帰とPro権限開放を検証してください。StripeのDashboard側で成功したCheckoutが作成されたかも確認してください。
- 無料版の「現在庫」は商品ごとの**今日時点の利用可能な在庫数量**（入力任意）です。`2` は2単位の在庫を意味し、過去需要のデータや選択できる系列数ではありません。需要と同じ単位で入力してください。未入力時には欠品確率を出さず、安全在庫と発注点は算出します。
- 実際の発注点管理では、手持ち在庫だけでなく**在庫ポジション（手持ち＋発注残−引当済）**を用いてください。欠品率算出時の現在庫と発注点をそのまま同一視しないでください。

## v0.5 Free / Pro の棲み分け

- **Free**：Excel/CSVから最大2系列を選んだ簡易診断。安全在庫・発注点・現在庫がある場合の欠品確率だけを表示し、4列の簡易CSVのみ保存。基準＝7日移動平均、サービスレベル＝95%で固定。
- **Pro**：最大200系列（試作版）、基準・サービスレベルの変更、詳細パーセンタイル・需要分布、PDF、詳細CSV、シリーズの一括比較。ProはStripeテスト契約をサーバー側で照合。
- **テスト決済**：既存のStripeテストアカウントを利用し、月額100円の**テスト専用**インラインPrice。実際の請求なし。既存NamiData Labの商品・料金は変更しない。テストでは`STRIPE_PRO_PRICE_ID`不要。
- **Cloudflare必須設定**：Pages > `web-stock` > Settings > Variables and Secrets で、Production環境の`STRIPE_SECRET_KEY`（`sk_test_`で始まる）と`SESSION_SECRET`（暗号学的乱数32字以上）を**Encrypt**で登録。設定後に再デプロイ。秘密鍵をGitやチャットに貼らない。Stripe MCPの接続だけではCloudflareのSecretは作成されない。
- **検証**：`/api/entitlement`で`configured:true`が返った後、`/pro/`でStripe Checkoutのテストカード決済と戻り先、契約認証まで実地確認する。Cloudflare実環境での完走まで`SALE_READY`としない。
- **商用化注意**：無料画面からの非表示は機能境界・導線設計であり、クライアントJSのコピー防止にはならない。認証・契約管理・課金状態の恒久的検証は販売前に別途完成させる必要がある。

<!-- Cloudflare Pages redeploy marker: 2026-11-08T14:39Z; no secrets included. -->


## 商用SaaS基盤 — 2026-11-08

添付のNamiData再利用設計を基準に、DemandScopeを「据え置き型の月額SaaS」へ移行するための土台を追加。

- 法務: /legal/terms/, /legal/privacy/, /legal/commerce/, /legal/billing/
- SEO: robots.txt / sitemap.xml / Public canonical / Pro noindex
- 申込表示: テスト価格、月額、自動更新、解約導線、規約リンクをCheckoutボタン前に表示
- D1: members / subscriptions / stripe_events / legal_acceptances の初期マイグレーション
- Stripe Webhook: 署名検証後、D1にイベントを冪等保存しsubscription状態を同期
- DB未接続時はWebhookを503で拒否し、Stripeのretryを失わない
- /api/commercial-readiness で、D1・Webhook・認証・法務情報の準備状況を秘密値なしで確認可能
- Live billingは引き続き無効。Stripe-only Checkout/Subscription再照合、事業者情報、最終価格・税設定、実E2E完了後に別ゲートで解禁する

手動設定残件は docs/COMMERCIAL_LAUNCH_CHECKLIST_ja.md を参照。
