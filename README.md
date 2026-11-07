# DemandScope v0.2 — 需要予測・在庫リスクシミュレーター / Demand & Inventory Risk

**日本語 / English · ファイルアップロード中心 · Cloudflare Pages + Stripe TEST環境対応**

会計機能を含まない、過去需要の残差標準偏差と4,000回のモンテカルロ試行による需要・在庫リスクの意思決定支援Webアプリです。需要データの読み込み・計算・CSVレポート出力はすべてブラウザ内で実行し、サーバーへ送信しません。

## できること

| | 無料 / Free | Pro（別ページ `/pro/`） |
|---|---|---|
| 読み込み | `.xlsx`, `.csv`, `.tsv`, `.txt` | 同じ |
| 行・列方向 | 自動提案し、手動で変更可能 | 同じ |
| 1ファイルからの分析 | **最大2つの需要系列**。日付やSKUの見出し列は上限に含まない | 複数需要系列を自動検出し、分割するか確認して登録 |
| 複数系列の合算 | なし（混同を防ぐ） | 明示的に選択した場合のみ。同じ期で整列している系列に限定 |
| 現在庫 | 系列ごとに任意で設定可能 | SKU編集画面で個別に設定 |
| シミュレーション | 4,000回、平均・SD・P50/P90/P95/P99・安全在庫・発注点・欠品確率・直近z値 | 各SKUを4,000回実行、一覧比較 |
| レポート | 最大2系列の**CSV**とテキスト（TXT） | 全登録系列の比較**CSV**、選択した系列の結果テキスト |
| 制限 | 2系列 | 試作版では最大200 SKU、ブラウザ保存容量に依存 |
| 認証 | 不要 | Stripe**テスト契約**の検証が必要 |
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
npm test
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

販売開始前には、少なくとも**購入者の本人認証（メールOTP等）とStripe Customer ID紐づけ、Stripe Webhookによる冪等な契約状態同期、顧客データのバックアップ/復元、規約・プライバシーポリシー・サポート対応、税区分・価格決定、テストカード決済実地検証**を追加してください。現行のPro権限はテスト用のCheckout Session IDと署名Cookieに基づくパイロットであり、Session ID漏洩による第三者でのアクセスの懸念があるため**そのまま実販売しないでください**。

公式資料：
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/workers/wrangler/commands/pages/
- https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=checkout&ui=stripe-hosted

## 初期監査（2026-11-07）

- GitHub初期インポートに向け、決済Session IDの横流し再利用に対するブラウザ紐づけを追加。決済完了URLのクエリパラメータも読み取り直後に消去します。Stripe Checkout Sessionの`client_reference_id`を検証してから署名Cookieを発行します。
- Pro一括処理はSKUごとにUIへ制御を返し、成功/失敗件数を表示。上限2,500万日次抽選を超えた場合は明示的に停止します。
- 無料版で新しいファイルを開くと旧結果は非表示になります。
- CSPなど静的ページのセキュリティヘッダを追加しました。
- **安全性の境界**：試作版のPro処理はブラウザJSなので、支払いなしにコード改変して模倣することまで阻止できません。商用販売にするにはサーバー側での権限付き処理、購入者本人認証・ID紐づけが必要です。
