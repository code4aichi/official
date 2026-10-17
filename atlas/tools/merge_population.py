#!/usr/bin/env python3
"""公式資料から整えた市町村別CSVを検証して人口JSONへ反映する。
Usage: python tools/merge_population.py population_2020.csv
CSV columns: code,population (UTF-8 with optional BOM)
市町村コードは5桁、人口は整数。元データの出典・年度は必ず確認すること。
"""
import csv
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'municipalities.json'

def main(filename):
    entries = json.loads(DATA.read_text(encoding='utf-8'))
    lookup = {r['code']: r for r in entries}
    imported = {}
    with open(filename, 'r', encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            code = row['code'].strip()
            val = row['population'].replace(',', '').strip()
            if code not in lookup:
                raise ValueError(f'未知の自治体コード: {code}')
            if code in imported:
                raise ValueError(f'自治体コードが重複: {code}')
            if not val.isdigit():
                raise ValueError(f'人口は0以上の整数で入力: {code}={val}')
            imported[code] = int(val)
    for code, value in imported.items():
        lookup[code]['population'] = value
    DATA.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'{len(imported)}市町村分を取り込みました。収録済み合計: {sum(x["population"] is not None for x in entries)}/54')

if __name__=='__main__':
    if len(sys.argv)!=2:
        raise SystemExit('Usage: python tools/merge_population.py population_2020.csv')
    main(sys.argv[1])
