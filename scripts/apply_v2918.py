#!/usr/bin/env python3
"""Add v2.9.18 assets to the CURRENT atlas/index.html without replacing it.
Idempotent; preserve all earlier CSS/JS references, analytics and data.
"""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
html=root/'atlas'/'index.html'
if not html.is_file():
    sys.exit('ERROR: atlas/index.html が見つかりません。最新版のGitHubリポジトリのルートで実行してください。')
s=html.read_text(encoding='utf-8')
if '</head>' not in s or '</body>' not in s:
    sys.exit('ERROR: HTML内の </head> または </body> が見つかりません。ファイルを変更していません。')
if './ui-v2917.js' not in s or './ui-v2917.css' not in s:
    sys.exit('ERROR: v2.9.17の読み込みがありません。先に現行版のHTMLを確認してください。')
style='<link rel="stylesheet" href="./ui-v2918.css?v=2918">'
script='<script defer src="./ui-v2918.js?v=2918"></script>'
if 'ui-v2918.css' not in s:s=s.replace('</head>',style+'\n</head>',1)
if 'ui-v2918.js' not in s:s=s.replace('</body>',script+'\n</body>',1)
html.write_text(s,encoding='utf-8')
print('OK: atlas/index.html に v2.9.18 の参照を追加しました（重複なし）。')
