#!/usr/bin/env python3
"""Validate municipality-level official census figures and publish historical.json.
Requires only Python 3 standard library. Does not guess missing numbers.
CSV header: code,population_2015,age_0_14_2020,age_15_64_2020,age_65_plus_2020,age_unknown_2020
2020 elderly rate denominator = (0-14 + 15-64 + 65+), excludes age unknown.
"""
import argparse,csv,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def parseint(value,field,line):
 s=(value or '').strip().replace(',','')
 if not s:return None
 if not s.isdecimal():raise ValueError(f'{line}行 {field}: 整数を入力してください')
 return int(s)
def build(source):
 places=json.loads((ROOT/'data/municipalities.json').read_text(encoding='utf-8'))
 codes={c['code']:c for c in places}; out={};seen=set()
 with source.open(encoding='utf-8-sig',newline='') as f:
  rdr=csv.DictReader(f)
  required=['code','population_2015','age_0_14_2020','age_15_64_2020','age_65_plus_2020','age_unknown_2020']
  if not set(required)<=set(rdr.fieldnames or []):raise ValueError('必要な列がありません: '+', '.join(required))
  for line,row in enumerate(rdr,2):
   code=(row.get('code') or '').strip()
   if not code:continue
   if code not in codes:raise ValueError(f'{line}行: 愛知県54市町村に存在しないコード {code}')
   if code in seen:raise ValueError(f'{line}行: 重複コード {code}')
   seen.add(code); p=parseint(row['population_2015'],'population_2015',line)
   vals=[parseint(row[c],c,line) for c in required[2:]]
   if p is not None and p<=0:raise ValueError(f'{line}行: 2015年人口は正の整数')
   item={}
   if p is not None:item['population_2015']=p
   if any(v is not None for v in vals):
    if not all(v is not None for v in vals):raise ValueError(f'{line}行: 2020年の年齢4列は全て入力してください')
    if sum(vals)!=codes[code]['population']:
     raise ValueError(f'{line}行 {code}: 年齢別合計 {sum(vals)} と既存2020年人口 {codes[code]["population"]} が不一致')
    denominator=sum(vals[:3])
    if denominator<=0:raise ValueError(f'{line}行: 年齢既知人口が0です')
    item['elderly_rate_2020']=round(vals[2]/denominator*100,4)
    item['age_0_14_2020']=vals[0];item['age_15_64_2020']=vals[1];item['age_65_plus_2020']=vals[2];item['age_unknown_2020']=vals[3]
   if item:out[code]=item
 return {'schema_version':1,'source':'愛知県 平成27年・令和2年国勢調査（市町村別。元資料から転記・照合）','notes':'65歳以上割合は年齢不詳を除く人口に対する割合。2015/2020年人口は国勢調査の同定義で比較。','cities':out},len(seen)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('csv',type=Path);p.add_argument('--output',type=Path,default=ROOT/'data/historical.json');p.add_argument('--require-54',action='store_true');args=p.parse_args()
 try:
  data,seen=build(args.csv)
  if args.require_54 and (seen!=54 or len(data['cities'])!=54):raise ValueError(f'全54市町村分が揃っていません: 行={seen}、値あり={len(data["cities"])}')
  args.output.parent.mkdir(parents=True,exist_ok=True)
  args.output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  print(f'OK: 入力{seen}市町村、数値を収録した自治体{len(data["cities"])}。出力={args.output}')
 except (ValueError,OSError) as e:print('ERROR:',e,file=sys.stderr);sys.exit(1)
