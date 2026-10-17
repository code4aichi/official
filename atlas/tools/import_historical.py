#!/usr/bin/env python3
"""Import externally verified statistics with strict validation. Never estimates missing values.
CSV columns: code,population_2015,age65_plus_2020,age_known_2020
age_known_2020: age-known denominator, not total population; blank row values are ignored.
Usage: python3 tools/import_historical.py /path/to/verified.csv
"""
import csv,json,sys,pathlib,math
root=pathlib.Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:raise SystemExit('usage: python3 tools/import_historical.py verified.csv')
lookup={c['code']:c for c in json.loads((root/'data/municipalities.json').read_text())}
with open(sys.argv[1],encoding='utf-8-sig',newline='') as f:rows=list(csv.DictReader(f))
required={'code','population_2015','age65_plus_2020','age_known_2020'}
if not rows or not required.issubset(rows[0]):raise SystemExit('Missing required CSV columns: '+','.join(sorted(required)))
seen=set();data={}
for line,row in enumerate(rows,2):
 code=str(row['code']).strip()
 if code not in lookup or code in seen:raise SystemExit(f'Invalid or repeated municipality code at row {line}: {code}')
 seen.add(code); item={}
 p=row['population_2015'].strip().replace(',','')
 if p:
  if not p.isdigit() or int(p)<=0:raise SystemExit(f'Invalid population 2015 at row {line}')
  item['population_2015']=int(p)
 a=row['age65_plus_2020'].strip().replace(',','');den=row['age_known_2020'].strip().replace(',','')
 if bool(a)!=bool(den):raise SystemExit(f'Age numerator and denominator must both be present at row {line}')
 if a:
  if not a.isdigit() or not den.isdigit() or int(den)<=0 or int(a)>int(den):raise SystemExit(f'Invalid age counts at row {line}')
  item['elderly_rate_2020']=round(int(a)/int(den)*100,4)
 if item:data[code]=item
# Do not accidentally publish partially imported statistics across years silently.
if len(seen)!=54:raise SystemExit(f'Requires exactly 54 distinct municipality rows, found {len(seen)}')
existing=json.loads((root/'data/historical.json').read_text())
existing.update({'schema_version':1,'source':'Verified input: '+pathlib.Path(sys.argv[1]).name,'notes':'2015 population = official 2015 census; elderly rate = 2020 age 65+ divided by 2020 population with known age, unless source defines otherwise.','cities':data})
(root/'data/historical.json').write_text(json.dumps(existing,ensure_ascii=False,indent=2)+'\n')
print('Imported',len(data),'municipalities,',sum('population_2015' in x for x in data.values()),'with 2015 population,',sum('elderly_rate_2020' in x for x in data.values()),'with elderly rates')
