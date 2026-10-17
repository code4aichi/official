# AICHI DATA ATLAS v0.5 : officialリポジトリ追加用パッケージ

対象: https://github.com/code4aichi/official
公開予定: https://code4aichi.org/atlas/

**注意:** 今回の作業環境では対象のGitHubリポジトリを取得できなかったため、既存サイトの実際の公開ブランチ、ディレクトリ構成、既存Actionsを未確認です。このZIPは**既存のコードを上書きしない追加差分**です。公開ブランチが `/docs` の場合は配置先を調整してください。

## 配置

### GitHub Pagesが main / (root) の場合
- `atlas/` をリポジトリ直下へ追加
- `.github/workflows/update-atlas-boundaries.yml` をリポジトリ直下の同名ディレクトリへ追加（既存`.github`は丸ごと置換しない）

### GitHub Pagesが main /docs の場合
- `atlas/` は `docs/atlas/` に追加
- ただし更新用スクリプトは `docs/atlas/tools/` になるため、YAML内の `atlas/` をすべて `docs/atlas/` に置き換える
- `.github/workflows/` は `docs/` ではなく**リポジトリ直下**

### `gh-pages` ブランチや独自Actions公開の場合
既存のビルド・コピー対象に `atlas/` を含める必要があります。公開元を確認するまで既存デプロイ設定を変更しないでください。

## 手順
1. リポジトリの `Settings > Pages > Build and deployment` で公開元を確認。
2. 新しいブランチを作り、上記の配置でファイルを追加。プルリクエストで差分をレビュー。
3. mergeすると、既存GitHub Pagesの公開ルールに従い `/atlas/` が公開されます。
4. `Actions > Update AICHI DATA ATLAS boundaries > Run workflow` で初回GeoJSON取得。
5. 更新ワークフローは成功後にPull Requestを作ります。**PRをmergeするとPagesの通常デプロイが走る**想定です（既存サイトがブランチ公開の場合）。
6. `https://code4aichi.org/atlas/` と `/atlas/data/aichi-boundaries.geojson` の読み込みを確認。

## GitHub Actions設定で必要な権限
`Settings > Actions > General > Workflow permissions`: `Read and write permissions`。さらに `Allow GitHub Actions to create and approve pull requests` を有効化（組織で許可されない場合、管理者による設定か代替方式が必要）。権限がないとPR作成が失敗します。

## ローカル検証
```bash
python3 atlas/tools/validate.py
python3 -m unittest discover -s atlas/tests -v
python3 -m http.server 8000
# ブラウザ: http://localhost:8000/atlas/
```

## 制約
- 外部ネットワークへの接続制限のためGeoJSON本体は未収録。Actionsで取得・検証するまで境界地図の代わりにタイル表示となる。
- 取得元はMITライセンスの `sankichi92/shikuchoson-boundaries`（2022年国土数値情報由来）。2026年最新版を保証しない。
- 人口は2020年国勢調査。2015年人口・2020年高齢化率は未収録。
- 統合版は既存サイト・本番環境で未検証。初回リリースは別ブランチでレビュー推奨。
- サイトの公開先の全ファイルを確認できていないため、`atlas` パスとの衝突がないか管理者が確認すること。
- 自動更新ワークフローはPRを作るところまで自動。**自動マージはしない**（既存公式サイトへの影響を抑えるため）。
