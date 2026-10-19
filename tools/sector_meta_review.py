#!/usr/bin/env python3
"""Review e-Stat sector table metadata without publishing any statistical values.
Usage: python tools/sector_meta_review.py /path/to/0004006322_meta.json
"""
import json,sys
from pathlib import Path

def main(path):
    doc=json.loads(Path(path).read_text(encoding='utf-8'))
    info=doc['GET_META_INFO']['METADATA_INF']
    table=info.get('TABLE_INF',{})
    dims=info['CLASS_INF']['CLASS_OBJ']
    if isinstance(dims,dict):dims=[dims]
    print('Table:',table.get('@id'),table.get('TITLE'))
    print('Check all selectors against the original table and definitions. Do not use aggregate and subgroup categories together.')
    for obj in dims:
        entries=obj.get('CLASS',[])
        if isinstance(entries,dict):entries=[entries]
        print('\nDIMENSION:',obj.get('@id'),'total codes:',len(entries))
        for c in entries[:80]:
            print(' ',c.get('@code'),c.get('@name'),'level',c.get('@level'))
        if len(entries)>80:print('  ... remaining entries omitted')
    print('\nNothing published. To prepare sector data, confirm the numeric selectors, sector hierarchy, coverage and total comparability first.')
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('Usage: python tools/sector_meta_review.py path/to/meta.json')
    main(sys.argv[1])
