# e-Stat APIキー登録

自動更新にはGitHub Actions Repository Secret `ESTAT_APP_ID` が必要です。

## GitHub画面から登録

このリポジトリで:

1. Settings
2. Secrets and variables
3. Actions
4. New repository secret
5. Name: `ESTAT_APP_ID`
6. Secret: 手元のe-StatアプリケーションID

同じキーを `shihuiarenjinba-png/portfolio-audit` にも同名で登録します。

## PowerShellで2リポジトリへ一括登録

`portfolio-audit` 側に、キーを画面表示せず2リポジトリへ登録するヘルパーがあります。

```powershell
cd <portfolio-audit のローカルclone>
powershell -ExecutionPolicy Bypass -File .\scripts\set_estat_secrets.ps1
```

APIキーはGit、Cloudflare、ブラウザ、設定ファイルには保存しません。
