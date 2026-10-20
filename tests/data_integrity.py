#!/usr/bin/env python3
"""Read-only integrity audit of public atlas data. Avoids changing any site content.
Findings: PASS/FAIL/REVIEW/SKIP. REVIEW indicates no independent source comparison.
"""
import csv, io, json, os, sys, urllib.request
from pathlib import Path
from urllib.parse import urljoin

BASE = os.getenv('MIERU_URL', 'https://code4aichi.org/atlas/').rstrip('/') + '/'
OUT = Path('data-audit-results'); OUT.mkdir(exist_ok=True)
RESULTS = []

def rec(group, check, status, details):
    RESULTS.append(dict(group=group, check=check, status=status, details=str(details)[:1200]))

def get(path, required=True):
    url=urljoin(BASE,path)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent':'MIERU-data-audit/2.9.11', 'Cache-Control':'no-cache'}),timeout=40) as f:
            content=f.read()
        return content
    except Exception as exc:
        rec('fetch',path,'FAIL' if required else 'SKIP',f'{url}: {exc}')
        return None

def JSON(path):
    raw=get(path)
    if raw is None: return None
    try: return json.loads(raw.decode('utf-8-sig'))
    except Exception as exc:
        rec('parse',path,'FAIL',f'Invalid JSON: {exc}');return None

def CSV(path,required=False):
    raw=get(path,required)
    if raw is None: return None
    try: return list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
    except Exception as exc: rec('parse',path,'FAIL',exc);return None

def integer(x):
    if isinstance(x,bool): return False
    return isinstance(x,int) and x>=0

def codes(d):
    return set(d.keys()) if isinstance(d,dict) else set()

def compare_set(group,name,found,expected):
    extra=sorted(found-expected);missing=sorted(expected-found)
    rec(group,name,'PASS' if not (extra or missing) else 'FAIL',f'{len(found)} codes; missing={missing[:15]} extra={extra[:15]}')

def audit():
    mun=JSON('data/municipalities.json')
    if not isinstance(mun,list):
        rec('reference','municipalities','FAIL','Missing municipality reference; cannot compare all data');return
    ref={str(x.get('code','')):x.get('name','') for x in mun if isinstance(x,dict)}
    rec('reference','municipality uniqueness','PASS' if len(ref)==len(mun)==54 else 'FAIL',f'rows={len(mun)}, unique={len(ref)}')
    rec('reference','municipality code format','PASS' if all(c.isdigit() and len(c)==5 and c.startswith('23') for c in ref) else 'FAIL', '5-digit Aichi municipality codes')
    historical=JSON('data/historical.json')
    hcity=historical.get('cities',{}) if isinstance(historical,dict) else {}
    if not isinstance(historical,dict):
        rec('census','historical.json','FAIL','Historical data is the source of 2015 and 2025 census information')
    else:
        compare_set('census','historical coverage',codes(hcity),set(ref))
        for year in (2015,2025):
            key=f'population_{year}';issues=[]
            for c,item in hcity.items():
                if not isinstance(item,dict) or not integer(item.get(key)) or item[key]<=0:issues.append(c)
            rec('census',f'{year} population in historical','PASS' if not issues else 'FAIL',f'issues={issues[:15]}')
        issues=[]
        for c,item in hcity.items():
            pop=item.get('population_2025');old=item.get('age_65_plus_2025');unk=item.get('age_unknown_2025')
            rate=item.get('elderly_rate_2025')
            try:
                denominator=pop-unk
                if denominator<=0 or abs(float(rate)-100*old/denominator)>0.025:issues.append(c)
            except Exception:issues.append(c)
        rec('census','2025 elderly share formula in historical','PASS' if not issues else 'FAIL',f'issues={issues[:15]} (denominator excludes unknown age)')
    issues=[]
    for c,row in ref.items():
        municipality=next((x for x in mun if str(x.get('code'))==c),None)
        if not municipality or not integer(municipality.get('population')) or municipality['population']<=0:issues.append(c)
    rec('census','2020 population in municipalities.json','PASS' if not issues else 'FAIL',f'issues={issues[:15]}')
    rows=CSV('data/population_2025.csv',required=True)
    if rows:
        d={str(r.get('code','')).strip():r for r in rows}
        compare_set('census','2025 CSV municipalities',set(d),set(ref))
        rec('census','2025 CSV no duplicates','PASS' if len(d)==len(rows) else 'FAIL',f'rows={len(rows)} unique={len(d)}')
        issues=[]
        for c,r in d.items():
            if c not in hcity:continue
            h=hcity[c]
            for field in ('population_2025','households_2025','age_65_plus_2025','age_unknown_2025'):
                if field in r and field in h:
                    try:
                        if int(r[field].replace(',',''))!=int(h[field]):issues.append(f'{c} {field}')
                    except Exception:issues.append(f'{c} invalid {field}')
            if r.get('municipality') and r['municipality']!=ref.get(c):issues.append(f'{c} name')
        rec('census','2025 CSV-historical numerical agreement','PASS' if not issues else 'FAIL',f'issues={issues[:20]}')
        if 'population_change_rate_2020_2025_pct' in rows[0]:
            issues=[]
            for c,r in d.items():
                if c not in ref:continue
                old=next((x.get('population') for x in mun if str(x.get('code'))==c),None)
                try:
                    calculated=(int(r['population_2025'])-old)/old*100
                    rate=float(r['population_change_rate_2020_2025_pct'])
                    if abs(calculated-rate)>0.03:issues.append(c)
                except Exception:issues.append(c)
            rec('census','2020-2025 change percentage','PASS' if not issues else 'FAIL',f'issues={issues[:20]}; tolerance 0.03 percentage points')
    directory='data/external-statistics/'
    catalog=JSON(directory+'catalog.json')
    if not isinstance(catalog,dict):rec('economic','catalog','FAIL','catalog not available')
    datasets={}
    for ident in ('economic_2021_private_establishments','economic_2021_private_employees'):
        d=JSON(directory+ident+'.json');datasets[ident]=d
        if not isinstance(d,dict):continue
        cs=d.get('cities',{});compare_set('economic',ident+' coverage',codes(cs),set(ref))
        invalid=[c for c,r in cs.items() if not integer(r.get('value')) or r.get('name')!=ref.get(c)]
        rec('economic',ident+' values and names','PASS' if not invalid else 'FAIL',f'bad={invalid[:15]}')
        rec('economic',ident+' provenance','PASS' if d.get('year')==2021 and d.get('status')=='approved' and d.get('source',{}).get('statsDataId')=='0004005640' else 'FAIL',f'year={d.get("year")}, source={d.get("source",{}).get("statsDataId")}')
    if isinstance(catalog,dict):
        names={x.get('id') for x in catalog.get('indicators',[]) if isinstance(x,dict)}
        rec('economic','catalog references','PASS' if all(x in names for x in datasets) else 'FAIL',f'listed ids={sorted(names)}')
    sector=JSON(directory+'industry_2021_sectors_approved.json')
    if isinstance(sector,dict):
        cities=sector.get('cities',{});sectors=sector.get('sectors',[])
        compare_set('industry','industry municipalities',codes(cities),set(ref))
        types={s.get('code') for s in sectors if isinstance(s,dict)}
        rec('industry','17 unique sector categories','PASS' if len(types)==len(sectors)==17 else 'FAIL',f'count={len(sectors)}, unique={len(types)}')
        bad=[];complete={'establishments':0,'employees':0}
        for c,info in cities.items():
            vals=info.get('values',{})
            if set(vals)!=types or info.get('name')!=ref.get(c):bad.append(f'{c}: sectors/name')
            for metric in ('establishments','employees'):
                if all(isinstance(vals.get(s),dict) and integer(vals[s].get(metric)) for s in types):complete[metric]+=1
            for sec,row in vals.items():
                for metric in ('establishments','employees'):
                    if row.get(metric) is not None and not integer(row.get(metric)):
                        bad.append(f'{c} {sec} {metric}')
        rec('industry','missing value discipline and categories','PASS' if not bad else 'FAIL',f'bad={bad[:14]}, complete={complete}')
        rec('industry','composition comparison eligible count','REVIEW',f'complete municipalities: {complete}; independent source verification not included')
    migration=JSON(directory+'migration_2025_approved.json')
    if isinstance(migration,dict):
        cities=migration.get('municipalities',{})
        compare_set('migration','migration municipalities',codes(cities),set(ref))
        bad=[];sums={'in':0,'out':0,'net':0}
        for c,r in cities.items():
            if r.get('name')!=ref.get(c) or not integer(r.get('in')) or not integer(r.get('out')) or not isinstance(r.get('net'),int) or isinstance(r.get('net'),bool):bad.append(c);continue
            if r['net']!=r['in']-r['out']:bad.append(c+' net')
            for k in sums:sums[k]+=r[k]
        rec('migration','in/out/net per municipality','PASS' if not bad else 'FAIL',f'bad={bad[:15]}')
        target=migration.get('sum_54_municipalities',{})
        rec('migration','municipality sums equal declared sums','PASS' if sums==target else 'FAIL',f'computed={sums}, declared={target}')
        rec('migration','source selectors and date','PASS' if migration.get('year')==2025 and migration.get('tables')=={'in':'0004044293','out':'0004044294'} else 'FAIL',f'year={migration.get("year")}, tables={migration.get("tables")}')
        rec('migration','external official Aichi-prefecture total','REVIEW','Municipal sum is NOT independently verified against prefectural official total')
    rec('provenance','independent primary-source comparison','REVIEW','This audit validates internal consistency and published files, not every original official table')

if __name__=='__main__':
    audit()
    with (OUT/'data_audit.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['group','check','status','details']);w.writeheader();w.writerows(RESULTS)
    counts={s:sum(x['status']==s for x in RESULTS) for s in ('PASS','FAIL','REVIEW','SKIP')}
    (OUT/'data_audit.json').write_text(json.dumps({'site':BASE,'counts':counts,'results':RESULTS},ensure_ascii=False,indent=2),encoding='utf-8')
    print('Data integrity audit:',counts)
    for r in RESULTS:
        if r['status'] in ('FAIL','REVIEW'): print(r['status'],r['group'],r['check'],r['details'])
    sys.exit(1 if counts['FAIL'] else 0)
