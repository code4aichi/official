#!/usr/bin/env python3
"""Validate indicator metadata and optional municipality value sets. No third-party dependencies."""
import json
import sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent
meta=json.loads((root/'data/indicators.json').read_text(encoding='utf-8'))
assert meta['schema_version']==1
categories={c['id'] for c in meta['categories']}
assert categories
ids=set()
for m in meta['metrics']:
    assert m['id'] not in ids, f"Duplicate indicator: {m['id']}"
    ids.add(m['id'])
    assert m['category'] in categories, m['id']
    assert m['years'] and all(isinstance(x,int) for x in m['years']),m['id']
    for required in ('label','unit','source','description'):
        assert required in m, (m['id'], required)
for e in meta.get('extensions', []):
    assert e['metric_id'] in ids
    f=root/'data'/e['file']
    assert f.exists(), f
    d=json.loads(f.read_text(encoding='utf-8'))
    assert d['schema_version']==1
    assert len(d.get('cities',{}))==54, f"{e['metric_id']}: expected 54 codes"
    assert all(len(code)==5 and code.isascii() and code.isdigit() for code in d['cities']), e['metric_id']
    assert all(v is None or isinstance(v,(int,float)) or isinstance(v,dict) and (v.get('value') is None or isinstance(v.get('value'),(int,float))) for v in d['cities'].values())
print(f"OK: {len(categories)} categories, {len(ids)} indicators, {len(meta.get('extensions', []))} additional data files")
