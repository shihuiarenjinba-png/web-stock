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
| `STRIPE_SECRET_KEY` | 既存Stripeアカウントの`sk_test_...` | Secret |
| `STRIPE_PRO_PRICE_ID` | このアプリ専用のテスト月額`price_...` | Variable |
| `SESSION_SECRET` | ランダムな32文字以上 | Secret |
| `APP_ORIGIN` | 生成されたサイトの正確なオリジン（例：`https://web-stock.pages.dev`、末尾 `/` なし） | Variable |
| `STRIPE_WEBHOOK_SECRET` | Webhookをテストする場合のみ`whsec_...` | Secret |

`APP_ORIGIN`はサイトURLと完全一致が必要です。プレビューのURLは別オリジンになるため、この試作版の決済テストでは **本番ブランチのPages URL** を使用します。テスト用のStripe Product / Priceが未作成の場合、設定は後回しで構いません。先に無料版を公開してください。**ライブ秘密鍵 `sk_live_` は使用禁止**です。

Proはまだ商用販売に必要な本人認証・契約IDの永続同期を備えていません。**テスト決済だけを行い、有料販売を開始しない**でください。ブラウザ内で計算するJavaScriptは閲覧可能で、Privateリポジトリであってもコードの複製を防ぐものではありません。

### GitHubをPrivateに切り替える際の注意

公開したPagesサイトのURLとGitHubリポジトリの可視性は独立しています。Private GitHubリポジトリからもCloudflare Pagesは公開できます。ただし、GitHub AppによるCloudflareのリポジトリアクセス権限が維持されていることを確認してください。

推奨順序：まずCloudflare PagesをGit連携で作り、無料版のURLと更新を確認 → Stripeテストを設定 → 最後にGitHubのSettings → General → Danger Zone → Change repository visibilityでPrivate化 → 小さな変更をpushしてPagesの自動ビルドが継続することを確認。Private化後は接続済みGitHubアプリにPrivateリポジトリのアクセスが残っているか必要に応じて見直します。GitHubリポジトリをPrivateに変更しても、**すでに第三者が取得したソースコードは回収できません**。

関連公式資料：
- https://developers.cloudflare.com/pages/get-started/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
- https://developers.cloudflare.com/pages/functions/get-started/
- https://developers.cloudflare.com/pages/configuration/git-integration/
