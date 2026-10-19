#!/usr/bin/env python3
"""MIERU AICHI v2.7: e-Stat staging -> strict curated external statistics.
No census JSON files are read or modified. Python standard library only.
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = 'https://api.e-stat.go.jp/rest/3.0/app/json/'
ALLOWED = re.compile(r'^[a-z][a-z0-9_]{2,45}$')
CODE = re.compile(r'^23\d{3}$')
NUM = re.compile(r'^-?(?:\d+)(?:\.\d+)?$')

def saved(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def api_get(kind, args):
    secret = os.getenv('E_STAT_APP_ID', '').strip()
    if not secret:
        raise ValueError('E_STAT_APP_ID is not set. Use an environment variable or Actions Secret.')
    params = {'appId': secret, **args}
    req = Request(API + kind + '?' + urlencode(params), headers={'User-Agent':'MIERU-AICHI-v2.7/1.0'})
    with urlopen(req, timeout=40) as resp:
        result = json.load(resp)
    outer = {'getStatsList':'GET_STATS_LIST','getMetaInfo':'GET_META_INFO','getStatsData':'GET_STATS_DATA'}[kind]
    payload = result.get(outer, {})
    status = payload.get('RESULT', {})
    if str(status.get('STATUS', '0')) != '0':
        raise ValueError(f'e-Stat {kind} error: {status.get("ERROR_MSG", status)}')
    return result

def municipalities():
    p = ROOT / 'config' / 'aichi_54_municipalities.json'
    obj = json.loads(p.read_text(encoding='utf-8'))
    codes = {x['code']: x['name'] for x in obj}
    if len(obj) != 54 or len(codes) != 54 or any(not CODE.fullmatch(k) for k in codes):
        raise ValueError('Municipality reference must contain exactly 54 valid unique codes')
    return codes

def search(args):
    content = api_get('getStatsList', {'searchWord':args.keyword,'limit':min(args.limit,100)})
    records = content.get('GET_STATS_LIST',{}).get('DATALIST_INF',{}).get('TABLE_INF',[])
    if isinstance(records,dict):records=[records]
    entries=[]
    for rec in records:
        if isinstance(rec,dict):
            entries.append({'statsDataId':rec.get('@id'),'title':rec.get('TITLE'), 'survey':rec.get('STAT_NAME'),'surveyDate':rec.get('SURVEY_DATE'), 'updated':rec.get('UPDATED_DATE')})
    path=ROOT/'staging'/'catalog.json'
    saved(path,{'keyword':args.keyword,'source':'e-Stat API v3', 'status':'search_only', 'entries':entries})
    print(f'Search results {len(entries)} saved to {path.relative_to(ROOT)}. Nothing published.')

def fetch(args):
    if not re.fullmatch(r'\d{6,20}',args.stats_id):raise ValueError('Invalid statsDataId')
    meta = api_get('getMetaInfo',{'statsDataId':args.stats_id})
    path = ROOT / 'staging' / f'{args.stats_id}_meta.json'
    saved(path,meta)
    if args.metadata_only:
        print('Saved metadata only:',path.relative_to(ROOT));return
    raw = api_get('getStatsData',{'statsDataId':args.stats_id,'limit':100000, 'startPosition':1})
    body=raw['GET_STATS_DATA']['STATISTICAL_DATA']
    inf=body.get('RESULT_INF',{})
    total=int(inf.get('TOTAL_NUMBER', 0))
    values=body.get('DATA_INF',{}).get('VALUE',[])
    if isinstance(values,dict):values=[values]
    if total>len(values) or body.get('RESULT_INF',{}).get('NEXT_KEY'):
        raise ValueError(f'Large dataset incomplete ({len(values)}/{total}); split or filter at API level before ingesting.')
    path=ROOT/'staging'/f'{args.stats_id}_data.json'
    saved(path,raw)
    print(f'Saved metadata and {len(values)} raw values in staging. Nothing published.')

def classes(meta):
    block=meta['GET_META_INFO']['METADATA_INF']['CLASS_INF'].get('CLASS_OBJ',[])
    return [block] if isinstance(block,dict) else block

def normalize(v):
    if isinstance(v,str):v=v.strip()
    if not isinstance(v,(int,float,str)) or not NUM.fullmatch(str(v)):
        raise ValueError('Suppressed / missing / nonnumeric value is not publishable: '+str(v)[:40])
    n=float(v)
    if not -1e16<n<1e16:raise ValueError('Out-of-range value')
    return int(n) if n.is_integer() else n

def prepare(args):
    manifest=json.loads(Path(args.manifest).read_text(encoding='utf-8'))
    required=['slug','statsDataId','label','year','unit','sourceTitle','sourceUrl','selectors','areaDimension','valueConstraint']
    for k in required:
        if k not in manifest:raise ValueError('Manifest missing: '+k)
    slug=manifest['slug']; sid=str(manifest['statsDataId'])
    if not ALLOWED.fullmatch(slug) or not re.fullmatch(r'\d{6,20}',sid):raise ValueError('Bad slug or statsDataId')
    if '国勢調査' in manifest['sourceTitle'] or 'census' in slug.lower():raise ValueError('Census must remain in existing verified pipeline')
    if not isinstance(manifest['year'],int) or not 1900 <= manifest['year'] <= 2100:raise ValueError('Invalid year')
    if not manifest['unit'] or not str(manifest['sourceUrl']).startswith('https://'):raise ValueError('Provide source unit and HTTPS citation')
    if manifest['valueConstraint'] not in ('nonnegative','any'):raise ValueError('Explicit value constraint required')
    sel=manifest['selectors']
    if not isinstance(sel,dict):raise ValueError('selectors must be mapping dimension to exact code')
    m=json.loads((ROOT/'staging'/f'{sid}_meta.json').read_text(encoding='utf-8'))
    d=json.loads((ROOT/'staging'/f'{sid}_data.json').read_text(encoding='utf-8'))
    cls=classes(m)
    area=manifest['areaDimension']
    dimensions={x.get('@id'):x for x in cls}
    if area not in dimensions:raise ValueError('areaDimension missing from e-Stat metadata')
    if set(sel)!=(set(dimensions)-{area}):
        raise ValueError('Specify one exact selector for EVERY non-area dimension, including time/sex/industry; expected '+str(sorted(set(dimensions)-{area})))
    for dim,code in sel.items():
        entries=dimensions[dim].get('CLASS',[])
        if isinstance(entries,dict):entries=[entries]
        if str(code) not in {str(x.get('@code')) for x in entries}:
            raise ValueError(f'Unrecognized {dim} selector code {code}')
    cities=municipalities()
    raw=d['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF'].get('VALUE',[])
    if isinstance(raw,dict):raw=[raw]
    rows={}
    # Explicit no-fallback code matching; submunicipal codes, other prefectures excluded.
    for item in raw:
        if any(str(item.get('@'+dim,'')) != str(code) for dim,code in sel.items()):continue
        loc=str(item.get('@'+area,''))
        if loc not in cities:continue
        if loc in rows:raise ValueError(f'Duplicate value for {loc}; ambiguous unfiltered statistical dimension')
        n=normalize(item.get('$'))
        if manifest['valueConstraint']=='nonnegative' and n<0:raise ValueError('Negative value for '+loc)
        rows[loc]={'name':cities[loc],'value':n}
    missing=sorted(set(cities)-set(rows))
    if missing:raise ValueError(f'Only {len(rows)}/54 municipalities; missing {missing}. No partial publication')
    output={'schema_version':1,'status':'review_required','id':slug,'label':manifest['label'],
        'year':manifest['year'],'unit':manifest['unit'],'geography':'aichi_54_municipalities',
        'source':{'type':'estat','title':manifest['sourceTitle'],'url':manifest['sourceUrl'],'statsDataId':sid,'selectors':sel,'areaDimension':area},
        'definition':manifest.get('definition',''),'limitations':manifest.get('limitations',''),
        'cities':rows}
    p=ROOT/'staging'/f'{slug}_candidate.json';saved(p,output)
    print(f'Candidate validated: {len(rows)} municipalities. Review {p.relative_to(ROOT)}; nothing published.')

def publish(args):
    if args.approve != 'I_REVIEWED_ALL_54_VALUES':raise ValueError('Manual approval token required')
    slug=args.slug
    if not ALLOWED.fullmatch(slug):raise ValueError('Invalid slug')
    obj=json.loads((ROOT/'staging'/f'{slug}_candidate.json').read_text(encoding='utf-8'))
    cities=municipalities()
    if obj['status']!='review_required' or obj['id']!=slug or set(obj['cities'])!=set(cities):raise ValueError('Invalid or incomplete candidate')
    out=ROOT/'atlas'/'data'/'external-statistics'/f'{slug}.json'
    if out.exists():raise ValueError('Refusing to overwrite an existing published indicator')
    obj['status']='approved'
    saved(out,obj)
    catalog=ROOT/'atlas'/'data'/'external-statistics'/'catalog.json'
    data=json.loads(catalog.read_text(encoding='utf-8')) if catalog.exists() else {'schema_version':1,'indicators':[]}
    if any(x['id']==slug for x in data['indicators']):raise ValueError('Duplicate catalog entry')
    data['indicators'].append({'id':slug,'label':obj['label'],'year':obj['year'],'unit':obj['unit'],'file':f'{slug}.json'})
    saved(catalog,data)
    print('Published approved new indicator:',out.relative_to(ROOT),'and catalog. Census JSON unchanged.')

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest='command',required=True)
    s=sub.add_parser('search');s.add_argument('--keyword',required=True);s.add_argument('--limit',type=int,default=30);s.set_defaults(func=search)
    s=sub.add_parser('fetch');s.add_argument('--stats-id',required=True);s.add_argument('--metadata-only',action='store_true');s.set_defaults(func=fetch)
    s=sub.add_parser('prepare');s.add_argument('--manifest',required=True);s.set_defaults(func=prepare)
    s=sub.add_parser('publish');s.add_argument('--slug',required=True);s.add_argument('--approve',required=True);s.set_defaults(func=publish)
    args=p.parse_args()
    try:args.func(args)
    except (ValueError,KeyError,FileNotFoundError) as exc:
        print('ERROR:',exc,file=sys.stderr);sys.exit(1)

if __name__=='__main__':main()
