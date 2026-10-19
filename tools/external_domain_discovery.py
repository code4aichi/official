#!/usr/bin/env python3
"""Search e-Stat for non-census employment and migration tables.

Stage a candidate catalog only: NEVER read/write atlas/data or publish values.
"""
import argparse
import datetime as dt
import json
import sys
from pathlib import Path

from estat_pipeline import api_get

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_THEMES = {
    'employment': ('雇用', '労働力調査', '賃金構造基本統計調査', '職業安定業務統計'),
    'migration': ('住民基本台帳人口移動報告', '人口移動報告', '転入者数', '転出者数'),
}

def array(value):
    if value is None: return []
    return value if isinstance(value, list) else [value]

def text(value):
    if isinstance(value, dict):
        # e-Stat strings often appear as {'$': 'text'}.
        return str(value.get('$', value.get('@name', '')))
    return '' if value is None else str(value)

def normalize(item, keyword, theme):
    name = text(item.get('STAT_NAME'))
    title = text(item.get('TITLE'))
    survey = text(item.get('SURVEY_DATE'))
    ident = str(item.get('@id',''))
    return {
        'statsDataId': ident, 'theme': theme, 'matchingKeywords': [keyword],
        'survey': name, 'title': title, 'surveyDateRaw': survey,
        'updatedDateRaw': text(item.get('UPDATED_DATE')),
        'assessment': 'manual_review_required',
        'checksRequired': ['non_census_source', 'municipal_level_54', 'survey_year', 'units_denominator', 'aichi_completeness', 'license_attribution'],
    }

def discover(themes, max_per_keyword, api=api_get):
    by_id = {}
    problems = []
    for theme in themes:
        for keyword in ALLOWED_THEMES[theme]:
            try:
                raw = api('getStatsList', {'searchWord': keyword, 'limit': max_per_keyword})
                items = array(raw.get('GET_STATS_LIST',{}).get('DATALIST_INF',{}).get('TABLE_INF'))
            except Exception as exc:
                problems.append({'theme':theme,'keyword':keyword, 'error':str(exc)[:250]})
                continue
            for item in items:
                if not isinstance(item,dict): continue
                rec=normalize(item,keyword,theme)
                key=rec['statsDataId']
                if not key.isdigit(): continue
                if key in by_id:
                    old=by_id[key]
                    if keyword not in old['matchingKeywords']: old['matchingKeywords'].append(keyword)
                    if theme != old['theme']:
                        old['theme']='employment,migration'
                else:
                    by_id[key]=rec
    entries=sorted(by_id.values(),key=lambda r:(r['theme'],r['statsDataId']))
    return {'status':'candidates_only_not_approved', 'source':'e-Stat REST API v3',
        'generatedUTC':dt.datetime.now(dt.timezone.utc).isoformat(),
        'searchedThemes':list(themes),'entryCount':len(entries),'entries':entries,'searchErrors':problems,
        'publicationRule':'No values may be published without reviewed metadata and approved per-municipality validation.'}

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--theme', choices=['employment','migration','all'], default='all')
    parser.add_argument('--limit',type=int,default=50)
    args=parser.parse_args(argv)
    if not 1 <= args.limit <= 100: parser.error('--limit must be 1..100')
    themes=list(ALLOWED_THEMES) if args.theme=='all' else [args.theme]
    result=discover(themes,args.limit)
    dest=ROOT/'staging'/'external_domain_candidates.json'
    dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f"Candidate tables: {result['entryCount']}; search errors: {len(result['searchErrors'])}; saved {dest.relative_to(ROOT)}")
    if result['searchErrors']:
        for error in result['searchErrors']: print(f"Warning: {error['keyword']}: {error['error']}",file=sys.stderr)
    # Fail when no query succeeded, without hiding partial successes.
    if len(result['searchErrors']) == sum(len(ALLOWED_THEMES[t]) for t in themes):
        return 1
    return 0

if __name__=='__main__':raise SystemExit(main())
