# AICHI DATA ATLAS v0.4

Code for AICHI向け、市民が愛知県54市町村の2020年国勢調査人口を閲覧・比較できる静的Webサイトです。

## v0.4 の追加点

- `.github/workflows/update-boundaries.yml`：毎月1日（日本時間11:17ごろ。GitHub側で遅延する可能性あり）にGeoJSONを更新確認。Actions画面から手動実行も可能です。
- `tools/fetch_boundaries.py`：69の区域データ（名古屋16区＋それ以外53自治体）を2つの取得先から収集し、**完全性と座標を検証した後にのみ**1ファイルに保存。取得失敗時は既存ファイルを維持します。
- `tests/test_boundaries.py`：自治体コード・リング・異常入力・差分更新の単体テスト。
- 境界GeoJSONをサイト内に配置できれば、利用者のブラウザは外部の地図APIにアクセスする必要がありません。

## はじめに：地図ファイルについて【重要】

**この配布ZIPには実際の `data/aichi-boundaries.geojson` は含まれていません。** 作成環境から外部GeoJSONが取得できなかったためです。初回はGitHub Actionsの手動実行（またはネット接続されたPCで `python3 tools/fetch_boundaries.py`）を行う必要があります。それまでは、市町村名のタイル表示になります。

境界の公開元： https://github.com/sankichi92/shikuchoson-boundaries （MITライセンス）。国土交通省の国土数値情報・2022年行政区域データを加工したものです。最新の2026年行政区域を保証するものではありません。境界と2020年人口の基準年は異なります。

## 1. GitHub + Cloudflare Pages （おすすめ）

1. GitHubでリポジトリを新規作成し、このフォルダの**中身全部（`.github`を含む）**をアップロード。GitHub上で `main` ブランチに配置します。
2. GitHubリポジトリの **Actions → Update Aichi boundaries → Run workflow** をクリックします。初回実行で境界取得に成功すると `data/aichi-boundaries.geojson` がcommitされます。失敗時はジョブに失敗の理由が出て、既存ファイルは更新されません。
3. Cloudflareダッシュボード → Workers & Pages → Pages → **Connect to Git** → GitHubの対象リポジトリを選択。
4. ビルドコマンドは空欄、出力ディレクトリは `.`（ルート）を指定します。環境により `.` 指定不可なら静的サイトルートに設定してください。
5. デプロイされた `*.pages.dev` のURLで地図表示を確認します。GitHubに新しいGeoJSONがcommitされるとCloudflare Pagesが自動デプロイします。

**重要**：これまでDirect Uploadで作ったPagesプロジェクトを、そのままGit連携に切り替えることはできません。新規にGit連携Pagesプロジェクトを作成してください。デフォルトブランチの保護やActionsの書き込み権限によりpushが拒否される場合は設定変更またはPR方式への変更が必要です。

**GitHubの設定**：Settings → Actions → General → Workflow permissions をRead and write permissionsにします。組織ポリシーで不可の場合は管理者に相談してください。Scheduled workflowsはGitHub側の条件で無効になることがあります。

**無償枠**：GitHub Actions、Cloudflare Pagesの各プランの無料枠に収める想定です。超過やポリシー変更があれば費用・制限が生じ得ます。

## 2. ローカル動作確認

```bash
python3 tools/validate.py
python3 -m unittest discover -s tests -v
python3 tools/fetch_boundaries.py  # インターネット接続が必要
python3 tools/fetch_boundaries.py --check
python3 -m http.server 8000
```

http://localhost:8000/ を開きます。 `file://` で開くとJSONの読み込みがブロックされる場合があります。

## 3. データの正確性と今後

- 54市町村の2020年人口はv0.3から継承しています。最新版の推計人口ではありません。
- 2015年人口・2020年高齢化率は**未収録**。`tools/import_historical.py`で公式に確認したCSVを投入するまで非表示です。
- 現行の境界APIは2022年ベースであり、**データ元が更新されなければ毎月実行しても境界の年次は更新されません**。新しい公式版を採用するには取得元の変更が必要です。
- 出典：愛知県「令和2年国勢調査 人口等基本集計結果」 https://www.pref.aichi.jp/soshiki/toukei/kokuchotokeihyo2020.html
- 境界データ：`sankichi92/shikuchoson-boundaries`（MIT） https://github.com/sankichi92/shikuchoson-boundaries 、元資料：国土交通省「国土数値情報 行政区域データ」
- アプリのリアルブラウザ動作およびCloudflare Pagesへの公開はこの環境では未実施です。
