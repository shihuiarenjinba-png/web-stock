# Cloudflare Pages 初回セットアップ / Setup (web-stock)

更新: 2026-11-07。対象は `shihuiarenjinba-png/web-stock` の `main`。このリポジトリは **Pages Functions** を使用します。

## 重要：Workers Buildsの画面では公開しない

画面に「デプロイコマンド `npx wrangler deploy`」「プレビューコマンド `npx wrangler preview`」「APIトークンに `artifacts_read` / `artifacts_write` が不足」と表示された場合、これは **Workers Builds** の設定画面です。PagesのGit連携画面ではありません。不要なWorkerを作らず、前の画面に戻って「Pages → Connect to Git」を選択してください。Workersビルド用トークンの権限を今回のために追加する必要はありません。

## Cloudflare Pages Git連携（推奨）

1. Cloudflare Dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**。
2. GitHubを許可し、`shihuiarenjinba-png/web-stock`を選ぶ。
3. **Project name**: `web-stock`（重複した場合は別名を選択）。**Production branch**: `main`。
4. **Framework preset**: `None`。**Root directory**: `/`。**Build command**: `npm run build`。**Build output directory**: `public`。
5. **NODE_VERSION**: `22`（Pagesのビルド環境で選択できる場合は環境変数へ設定）。
6. **Save and Deploy**。デプロイログで `npm run build` のテスト成功と `PASS Cloudflare Pages layout` を確認し、サイトURLを開いて無料版を動作確認。
7. ページ `https://<プロジェクト名>.pages.dev/`、Pro画面 `/pro/`、APIの `/api/entitlement` が使えることを確認します。秘密情報がない状態ではAPIが `{ "active": false, "configured": false }` を返すのは想定どおりです。

ビルドはNode組み込み機能と同梱したJSZipを利用するため、外部ライブラリのインストールは不要です。`functions/`はリポジトリルートにあり、Pagesが自動検出します。**`wrangler.toml` / `wrangler.jsonc` / Worker用 `npx wrangler deploy` は不要**です。

### Stripeテスト設定（無料版公開後）

Cloudflare Pagesの **Settings → Variables and Secrets** に設定します。設定値をGitHubのファイル、ログ、Issueに書かないでください。

| 名前 | 値 | 種別 |
|---|---|---|
| `STRIPE_SECRET_KEY` | 既存Stripeアカウントのテスト鍵 `sk_test_...` または権限を絞った `rk_test_...` | Secret |
| `STRIPE_PRO_PRICE_ID` | 任意。未設定なら月額100円のテスト用インラインPriceが使われます。既存NamiData LabのPrice IDを流用しないでください | Variable（任意） |
| `SESSION_SECRET` | **32文字以上の暗号学的に安全な乱数**。他サービスのセッション秘密値は流用しない | Secret |
| `APP_ORIGIN` | 任意。設定する場合は `https://web-stock-78r.pages.dev`（末尾 `/` なし） | Variable（任意） |
| `STRIPE_WEBHOOK_SECRET` | Webhookをテストする場合のみ`whsec_...` | Secret |

`APP_ORIGIN`はサイトURLと完全一致が必要です。プレビューのURLは別オリジンになるため、この試作版の決済テストでは **本番ブランチのPages URL** を使用します。テスト用のStripe Product / Priceが未作成の場合、設定は後回しで構いません。先に無料版を公開してください。**ライブ秘密鍵 `sk_live_`、ライブ制限付き鍵 `rk_live_` は使用禁止**です。

Proはまだ商用販売に必要な本人認証・契約IDの永続同期を備えていません。**テスト決済だけを行い、有料販売を開始しない**でください。ブラウザ内で計算するJavaScriptは閲覧可能で、Privateリポジトリであってもコードの複製を防ぐものではありません。


### 既存NamiData LabのStripe設定を使い、最短でテスト決済する方法

1. **Stripe側は既存のテストアカウントを利用**。DemandScope専用テストポータルは `bpc_1UZ2FNBGa8rL8jwIBPFuUkWT`（テストモード）を使用します。既存NamiData LabのLiveキーや価格は流用しません。
2. Cloudflare Dashboard → **Workers & Pages → web-stock → Settings → Variables and Secrets** を開き、**Production**に以下2つを追加し、どちらも **Encrypt / Secret** にします。
   - `STRIPE_SECRET_KEY` = Stripeテストアカウントの `sk_test_...` または `rk_test_...`（制限付き）。コードは両方に対応しています。`rk_live_...` は登録しないでください。以前のWorkerのSecret一覧に**名前**があっても値は再表示できず、別のPagesプロジェクトには自動で引き継がれません。Stripeの **Developers / API keys（テストモード）** でキーを取得し、Cloudflareへ直接貼り付けてください。チャット、GitHub、スクリーンショットに秘密値を含めないでください。
   - `SESSION_SECRET` = 新規に生成したランダムな秘密値。Windows PowerShellで `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` を実行すれば64桁の16進数を生成できます。生成結果はCloudflareへ直接登録。
3. `APP_ORIGIN`を設定する場合は `https://web-stock-78r.pages.dev` を**平文Variable**で登録してください（末尾スラッシュなし）。未設定でも現行コードは実リクエストのHTTPSオリジンを使用します。
4. `STRIPE_PRO_PRICE_ID` は今回のテストでは**空欄／未登録**にしてください。月額100円テスト専用のインライン価格がCheckout作成時に使われます。
5. 保存後、**Productionのデプロイを再実行**。ログに実際のSecret値を表示しないでください。
6. ブラウザで `https://web-stock-78r.pages.dev/api/entitlement` を開き、`configured:true`を確認（契約前は`active:false`で正常）。`configured:false`の場合はJSONの`missing`に出る**変数名だけ**を確認してください。
7. `https://web-stock-78r.pages.dev/pro/?lang=ja` からテストCheckoutを開き、Stripeテストカードで決済→同じブラウザで戻り先→Pro開放→契約管理ポータルを確認します。**本番課金禁止**。

**セキュリティ注記**：既存Workerに`STRIPE_SECRET_KEY`があることだけでは、そこに保存された値が`sk_test_`か`sk_live_`かは判断できません。既存のLive Secretをコピーしないでください。既存のWorkerのSecretを削除・上書きしないでください。

### GitHubをPrivateに切り替える際の注意

公開したPagesサイトのURLとGitHubリポジトリの可視性は独立しています。Private GitHubリポジトリからもCloudflare Pagesは公開できます。ただし、GitHub AppによるCloudflareのリポジトリアクセス権限が維持されていることを確認してください。

推奨順序：まずCloudflare PagesをGit連携で作り、無料版のURLと更新を確認 → Stripeテストを設定 → 最後にGitHubのSettings → General → Danger Zone → Change repository visibilityでPrivate化 → 小さな変更をpushしてPagesの自動ビルドが継続することを確認。Private化後は接続済みGitHubアプリにPrivateリポジトリのアクセスが残っているか必要に応じて見直します。GitHubリポジトリをPrivateに変更しても、**すでに第三者が取得したソースコードは回収できません**。

関連公式資料：
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/configuration/git-integration/

### `rk_test_` 制限付きAPIキーを使う場合（2026-11-08）

- キーの先頭が **`rk_test_`** か確認してください。`rk_live_` は本番用なので**登録しない**でください。`rk_` のみでは環境は判別できません。
- Cloudflare Pages → web-stock → Settings → Variables and Secrets → **Production** → Add。変数名は `STRIPE_SECRET_KEY` のまま、値には `rk_test_...` の**実際の秘密値**を入力し、**Encrypt / Secret** を選びます。`rk_` 用の別変数名は必要ありません。
- `SESSION_SECRET`（安全な新規乱数・32文字以上）もSecret登録し、Productionのデプロイを再実行します。
- Stripe側のRestricted Key権限は実際のAPI操作と一致する必要があります。最低限、**Checkout Sessionsの作成・取得、Subscriptionsの取得、Billing Portal Sessionsの作成**が可能な権限が必要です。StripeのUI上ではCheckout Sessions **Write**（読み取りを包含するか権限表示を確認）、Subscriptions **Read**、Customer Portal / Billing Portal関連 **Write** を確認してください。CustomerのReadやPrices/ProductsのRead・WriteについてはCheckoutのテストエラーがあった場合にStripeのログで不足する権限を確認し、必要な項目だけ追加してください。安易に全項目Writeへしないでください。
- **未接続の原因がキー形式なのか権限不足なのかは別問題**です。`/api/entitlement` の `configured:true` は接続資格情報の書式検査が通ったことを示すだけで、Stripe APIの実接続成功を保証しません。
- 公開GitHubリポジトリにキーは絶対に入れず、Cloudflare側のSecretだけに保存します。Private化後も公開サイトのJSは利用者が取得できるため、秘密情報をブラウザコードへ入れないでください。
