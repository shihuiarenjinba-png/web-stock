# DemandScope 公的経済変数サンプル更新

DemandScopeの追加説明変数として使う月次サンプルを、e-Statから定期更新します。

## 初期採用変数

- コアCPI（生鮮食品を除く総合、前年同月比）
- 鉱工業生産指数から算出した前年比

各ファイルは `date + 数値変数1列` で、DemandScopeの追加変数入力形式に合わせています。
保存期間は両方とも最新120か月です。

## 採用基準

変数は `config/estat_economic_samples.json` の `approved=true` のものだけ出力されます。
追加時には、研究上の根拠と変換方法を設定ファイルへ記録します。
研究上の関連性は、個々の顧客データで有意になることを保証しません。

## セキュリティ

GitHub Actionsではe-StatアプリケーションIDを Repository Secret `ESTAT_APP_ID` からのみ受け取ります。

- ブラウザ/CloudflareへAPIキーを配布しない
- URLやappIdをログへ出さない
- raw APIレスポンスを保存しない
- 公開するのは120か月へ整形したCSVとprovenanceのみ
- commit直前にSecret値混入チェックを実施

## 出典

出典：政府統計の総合窓口(e-Stat)、内閣府「景気動向指数 採用系列」を加工して作成。

e-Stat利用規約:
https://www.e-stat.go.jp/terms-of-use

対象統計表:
https://www.e-stat.go.jp/dbview?sid=0003446462

## 注意

このサンプルは月次履歴向けです。日次需要にそのまま同月値を展開すると、公表時点を無視した先読みになる可能性があるため、自動的な日次forward-fillは行いません。
