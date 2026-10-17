# ミエルあいち v0.6 デザイン刷新版

## 主な変更
- サイト名称：「ミエルあいち by Code for AICHI」
- キャッチコピー：「データで見つける、知らなかった愛知。」
- 添付メインビジュアル、Code for AICHIロゴを利用。紺・青・ターコイズ・オレンジに統一
- PCでは地図（左・大）＋検索／自治体の数値（右）を同時表示
- 比較、ランキング、推移をタブに整理
- スマートフォン向けに縦配置へ自動切替
- 現在の2020年人口、境界GeoJSON、検索・選択・コピー機能を維持

## GitHub Pages (code4aichi/official, main/root) に適用
1. `main` から作業ブランチ `feature/mieru-aichi-ui` を作成します。
2. このZIPの `atlas/index.html`, `atlas/styles.css`, `atlas/app.js` と `atlas/assets/` の**webp画像**を、リポジトリ内の同じパスに追加・上書きしてください。
3. `atlas/data/` 内の既存 `aichi-boundaries.geojson` は**削除せずそのまま残してください**。今回はGeoJSONの置き換えもGitHub Actions実行も不要です。
4. `Files changed` で、更新が上記3ファイル＋画像だけであることを確認してください。既存公式サイトのルート `index.html`, `main.js`, `style.css`, `CNAME` には触れないでください。
5. Pull Requestを作り `main` にマージします。GitHub Pages更新後、https://code4aichi.org/atlas/ を確認します。

## 動作確認
- 地図が表示され、クリックで選択市町村が右側に反映される
- 名古屋市の区境界は、既存のv0.5.1修正版GeoJSONを使う場合にのみ非表示となります
- 人口／県内人口割合の色分け切替、検索、市町村のURLコピーが動く
- 「まちを比較」「人口ランキング」「人口の推移」タブの切替が動く
- スマホ表示で地図の幅が収まっている

## データと制約
- 2020年国勢調査人口のみ既存データを同梱しています。高齢化率・2015年人口は元データ未収録の場合は出しません。
- 地図は既存の `atlas/data/aichi-boundaries.geojson` を読み込みます。ZIP内には本番環境のGeoJSONは含まれません。
- 画面の静的構成とJavaScript構文、HTMLの参照先は確認していますが、本番GitHub Pages上での表示は未検証です。

## ファイル
- `atlas/index.html` HTML
- `atlas/styles.css` CSS
- `atlas/app.js` JavaScript（名古屋境界修正v0.5.1をベースに継承）
- `atlas/assets/mieru-hero.webp` 提供メインイメージ
- `atlas/assets/code-for-aichi-horizontal.webp` 提供ロゴ
- `atlas/data/*` 既存の統計データ（変更不要、スタンドアロン表示確認用）
