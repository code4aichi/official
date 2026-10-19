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
import time
import socket
from urllib.error import HTTPError, URLError
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
    # e-Stat occasionally takes longer to return catalog responses.
    # Retry transient network failures only, never authentication or API errors.
    retryable_http = {429, 500, 502, 503, 504}
    for attempt in range(3):
        try:
            with urlopen(req, timeout=90) as resp:
                result = json.load(resp)
            break
        except HTTPError as exc:
            if exc.code not in retryable_http or attempt == 2:
                raise
            print(f'e-Stat temporary HTTP {exc.code}; retry {attempt + 1}/2', file=sys.stderr)
        except (TimeoutError, socket.timeout, URLError, ConnectionError) as exc:
            # URLError may also represent DNS or network failures; retries are bounded.
            if attempt == 2:
                raise RuntimeError('e-Stat API unavailable after 3 attempts (90s timeout each). Retry later.') from exc
            print(f'e-Stat network error ({type(exc).__name__}); retry {attempt + 1}/2', file=sys.stderr)
        time.sleep(3 * (2 ** attempt))
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
    if not re.fullmatch(r'\d{6,20}', args.stats_id):
        raise ValueError('Invalid statsDataId')
    meta = api_get('getMetaInfo', {'statsDataId': args.stats_id})
    saved(ROOT / 'staging' / f'{args.stats_id}_meta.json', meta)
    if args.metadata_only:
        print('Saved metadata only; no data published.')
        return

    filters = {'statsDataId': args.stats_id, 'limit': 100000}
    expected_areas = None
    if args.aichi_only:
        # cdArea accepts up to 100 comma-separated codes. Exactly 54 cities are
        # defined by the project's canonical municipality code reference.
        expected_areas = set(municipalities())
        filters['cdArea'] = ','.join(sorted(expected_areas))
        print(f'Filtering at API level to {len(expected_areas)} Aichi municipality codes.')

    all_values = []
    next_start = 1
    seen_pages = set()
    result = None
    expected_total = None
    # Cap total pages to avoid infinite/broken API loops or accidental huge jobs.
    for page in range(1, 21):
        if next_start in seen_pages:
            raise ValueError(f'e-Stat returned repeated startPosition {next_start}')
        seen_pages.add(next_start)
        raw = api_get('getStatsData', {**filters, 'startPosition': next_start})
        body = raw['GET_STATS_DATA']['STATISTICAL_DATA']
        info = body.get('RESULT_INF', {})
        total = int(info.get('TOTAL_NUMBER', 0))
        rows = body.get('DATA_INF', {}).get('VALUE', [])
        if isinstance(rows, dict):
            rows = [rows]
        if not isinstance(rows, list):
            raise ValueError('Unexpected e-Stat response VALUE format')
        if result is None:
            result = raw
            expected_total = total
        elif expected_total != total:
            raise ValueError('e-Stat total count changed between pages; retry later')
        if expected_areas is not None:
            invalid = [str(r.get('@area','')) for r in rows if str(r.get('@area','')) not in expected_areas]
            if invalid:
                raise ValueError(f'Unexpected area outside 54 municipalities: {invalid[:5]}')
        all_values.extend(rows)
        next_key = info.get('NEXT_KEY')
        print(f'Page {page}: +{len(rows)} values, total collected {len(all_values)}/{expected_total}.')
        if not next_key:
            if expected_total != len(all_values):
                raise ValueError(f'e-Stat incomplete after last page ({len(all_values)}/{expected_total})')
            break
        try:
            follow = int(next_key)
        except (ValueError, TypeError):
            raise ValueError(f'Invalid e-Stat NEXT_KEY: {next_key}') from None
        if follow <= next_start:
            raise ValueError('e-Stat NEXT_KEY did not advance')
        next_start = follow
    else:
        raise ValueError('Exceeded 20 API pages; tighten metadata-based filters')

    if not result:
        raise ValueError('e-Stat returned no data')
    result['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF']['VALUE'] = all_values
    result['GET_STATS_DATA']['STATISTICAL_DATA']['RESULT_INF'].pop('NEXT_KEY', None)
    path = ROOT / 'staging' / f'{args.stats_id}_data.json'
    saved(path, result)
    print(f'Saved {len(all_values)} validated raw values to {path.relative_to(ROOT)}. Nothing published.')


# 2025 resident migration tables.  Keep this distinct from the generic cdArea
# municipality filter: these tables use "area" for the migration COUNTERPART.
MIGRATION_TABLES = {'in': '0004044293', 'out': '0004044294'}

def _meta_dimension(meta, dim):
    dim_map = {x.get('@id'): x for x in classes(meta)}
    if dim not in dim_map:
        raise ValueError(f'Migration table missing required dimension {dim}')
    obj = dim_map[dim]
    entries = obj.get('CLASS', [])
    if isinstance(entries, dict):
        entries = [entries]
    return str(obj.get('@name', '')), {str(e.get('@code')): str(e.get('@name', '')) for e in entries}

def migration_filter(meta, direction, city_codes):
    """Only accept tables with city location on cat01 and counterpart on area.

    Fail closed rather than silently using cdArea against the wrong dimension.
    """
    if direction not in MIGRATION_TABLES:
        raise ValueError('Direction must be in or out')
    obj = meta.get('GET_META_INFO', {}).get('METADATA_INF', {}).get('TABLE_INF', {})
    if str(obj.get('@id')) != MIGRATION_TABLES[direction]:
        raise ValueError('Metadata statistical table ID is not the expected migration table')
    title = obj.get('TITLE', '')
    title = title.get('$', '') if isinstance(title, dict) else str(title)
    expected_title = '転入者数' if direction == 'in' else '転出者数'
    if expected_title not in title:
        raise ValueError(f'Table title is not {expected_title}: {title}')
    city_name, city_entries = _meta_dimension(meta, 'cat01')
    counterpart_name, counterpart_entries = _meta_dimension(meta, 'area')
    expected_city_name = '移動後' if direction == 'in' else '移動前'
    expected_counterpart_name = '移動前' if direction == 'in' else '移動後'
    if expected_city_name not in city_name or expected_counterpart_name not in counterpart_name:
        raise ValueError(f'Unexpected municipality/counterpart axes: cat01={city_name}, area={counterpart_name}')
    missing = sorted(set(city_codes) - set(city_entries))
    if missing:
        raise ValueError(f'cat01 is missing municipality codes: {missing[:6]}')
    # These 2025 reference tables use "00005" as the nationwide total for
    # counterpart area.  Never interpret a prefecture or municipality as total.
    if '00005' not in counterpart_entries or '総数' not in counterpart_entries['00005']:
        raise ValueError('Counterpart area total code 00005 not found; inspect metadata')
    selectors = {'cat01': ','.join(sorted(city_codes)), 'area': '00005'}
    for dim, expected_code, keyword in (
        ('cat02', '000', '総数'), ('cat03', '0', '総数'),
        ('cat04', '60000', '移動者'), ('time', '2025000000', '2025年')):
        _, entries = _meta_dimension(meta, dim)
        if expected_code not in entries or keyword not in entries[expected_code]:
            raise ValueError(f'Unexpected migration selector {dim}={expected_code}: {entries.get(expected_code)}')
        selectors[dim] = expected_code
    _, tab_entries = _meta_dimension(meta, 'tab')
    if len(tab_entries) != 1:
        raise ValueError('Unexpected tab categories; cannot uniquely pick migration count')
    selectors['tab'] = next(iter(tab_entries))
    return {'statsDataId': MIGRATION_TABLES[direction], 'cdCat01': selectors['cat01'],
            'cdArea': selectors['area'], 'cdCat02': selectors['cat02'],
            'cdCat03': selectors['cat03'], 'cdCat04': selectors['cat04'],
            'cdTime': selectors['time'], 'cdTab': selectors['tab'], 'limit': 100000}, selectors

def validate_migration_values(result, selectors, city_codes):
    body = result['GET_STATS_DATA']['STATISTICAL_DATA']
    inf = body.get('RESULT_INF', {})
    values = body.get('DATA_INF', {}).get('VALUE', [])
    if isinstance(values, dict):
        values = [values]
    if not isinstance(values, list):
        raise ValueError('Unexpected migration values structure')
    total = int(inf.get('TOTAL_NUMBER', -1))
    if total != len(values) or total != 54 or inf.get('NEXT_KEY'):
        raise ValueError(f'Migration result should contain exactly 54 values, got {len(values)}/{total}')
    seen = {}
    for row in values:
        for dim in ('area', 'cat02', 'cat03', 'cat04', 'time', 'tab'):
            if str(row.get('@' + dim)) != selectors[dim]:
                raise ValueError(f'Unexpected migration row dimension {dim}: {row.get("@" + dim)}')
        city = str(row.get('@cat01', ''))
        if city not in city_codes or city in seen:
            raise ValueError(f'Unknown/duplicate migration city code: {city}')
        raw = str(row.get('$', '')).strip()
        if not re.fullmatch(r'\d+', raw):
            raise ValueError(f'Missing, suppressed or invalid migration count for {city}: {raw}')
        seen[city] = int(raw)
    missing = sorted(set(city_codes) - set(seen))
    if missing:
        raise ValueError(f'Only {len(seen)}/54 migration municipalities: missing {missing}')
    return seen

def fetch_migration(args):
    cities = municipalities()
    stats_id = MIGRATION_TABLES[args.direction]
    meta = api_get('getMetaInfo', {'statsDataId': stats_id})
    filters, selectors = migration_filter(meta, args.direction, set(cities))
    raw = api_get('getStatsData', filters)
    counts = validate_migration_values(raw, selectors, set(cities))
    # Save only after *all* 54 counts have been validated; no publication.
    path = ROOT / 'staging'
    saved(path / f'{stats_id}_meta.json', meta)
    saved(path / f'{stats_id}_data.json', raw)
    saved(path / f'migration_2025_{args.direction}_review.json', {
        'status': 'review_required', 'year': 2025, 'direction': args.direction,
        'statsDataId': stats_id, 'source': '住民基本台帳人口移動報告',
        'definition': '2025年、年齢総数・男女総数・移動者、相手先地域総数',
        'selectors': selectors,
        'municipalities': {code: {'name': cities[code], 'value': counts[code]} for code in sorted(cities)}
    })
    print(f'Validated {len(counts)} municipalities for {args.direction}; review-only, nothing published.')

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
    s=sub.add_parser('fetch');s.add_argument('--stats-id',required=True);s.add_argument('--metadata-only',action='store_true');s.add_argument('--aichi-only',action='store_true',help='Filter API request to exactly 54 municipality area codes');s.set_defaults(func=fetch)
    s=sub.add_parser('fetch-migration');s.add_argument('--direction',choices=['in','out'],required=True);s.set_defaults(func=fetch_migration)
    s=sub.add_parser('prepare');s.add_argument('--manifest',required=True);s.set_defaults(func=prepare)
    s=sub.add_parser('publish');s.add_argument('--slug',required=True);s.add_argument('--approve',required=True);s.set_defaults(func=publish)
    args=p.parse_args()
    try:args.func(args)
    except (ValueError,KeyError,FileNotFoundError) as exc:
        print('ERROR:',exc,file=sys.stderr);sys.exit(1)

if __name__=='__main__':main()
