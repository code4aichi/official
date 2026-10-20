#!/usr/bin/env python3
"""Apply v2.9.17 to the actual current atlas/index.html, preserving its other bytes.
Run from the GitHub repo root after copying atlas/ui-v2917.* and this script.
"""
from pathlib import Path
import sys
p=Path('atlas/index.html')
if not p.is_file():sys.exit('ERROR: Run from repository root; atlas/index.html is missing')
html=p.read_text(encoding='utf-8')
for marker in ['id="v291-quicknav"','./ui-v291.js','data-workspace="report"','data-workspace="ai-nav"']:
 if marker=='id="v291-quicknav"':continue # generated in JS, not static HTML
 if marker not in html:sys.exit('ERROR: expected compatible UI marker not found: '+marker)
if 'ui-v2917.js' in html or 'ui-v2917.css' in html:
 if 'ui-v2917.js' in html and 'ui-v2917.css' in html:
  print('v2.9.17 asset references already installed; no changes.');sys.exit(0)
 sys.exit('ERROR: partial v2.9.17 references; inspect index.html manually')
for file in ['atlas/ui-v2917.js','atlas/ui-v2917.css']:
 if not Path(file).is_file():sys.exit('ERROR: missing '+file)
head='</head>'
if html.count(head)!=1:sys.exit('ERROR: unexpected index.html head structure')
add='<link rel="stylesheet" href="./ui-v2917.css?v=2917"/><script defer src="./ui-v2917.js?v=2917"></script>'
html=html.replace(head,add+head,1)
p.write_text(html,encoding='utf-8')
print('OK: added two references before </head>. No other HTML modified.')
