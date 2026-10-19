#!/usr/bin/env python3
"""Research recent non-census e-Stat tables; staging-only, no production writes.

Uses API-side surveyYears filtering and bounded pages, then optionally verifies
municipality code coverage against getMetaInfo. No values are downloaded.
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

from estat_pipeline import api_get

ROOT = Path(__file__).resolve().parents[1]
ALLOWED_THEMES = {
    'employment': ('労働力調査', '賃金構造基本統計調査', '職業安定業務統計', '雇用'),
    'migration': ('住民基本台帳人口移動報告', '人口移動報告', '転入者数', '転出者数'),
}


def array(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def text(value):
    if isinstance(value, dict):
        return str(value.get('$', value.get('@name', '')))
    return '' if value is None else str(value)


def survey_year(value):
    """Only a YYYY-MM style survey field is an observed year; not UPDATED_DATE."""
    s = re.sub(r'\D', '', text(value))
    if len(s) < 4:
        return None
    yr = int(s[:4])
    return yr if 1900 <= yr <= 2100 else None


def normalize(item, keyword, theme):
    yr = survey_year(item.get('SURVEY_DATE'))
    return {
        'statsDataId': str(item.get('@id', '')),
        'theme': theme,
        'matchingKeywords': [keyword],
        'survey': text(item.get('STAT_NAME')),
        'title': text(item.get('TITLE')),
        'surveyDateRaw': text(item.get('SURVEY_DATE')),
        'surveyYear': yr,
        'updatedDateRaw': text(item.get('UPDATED_DATE')),
        'municipalityCoverage': 'not_checked',
        'assessment': 'manual_review_required',
        'checksRequired': ['non_census_source', 'municipal_level_54', 'survey_year', 'units_denominator', 'aichi_completeness', 'license_attribution'],
    }


def classify_area_metadata(payload, expected):
    """Check metadata availability, not whether indicator has numerical values."""
    objs = array(payload.get('GET_META_INFO', {}).get('METADATA_INF', {}).get('CLASS_INF', {}).get('CLASS_OBJ'))
    area = next((x for x in objs if isinstance(x, dict) and x.get('@id') == 'area'), None)
    if area is None:
        return {'status': 'area_dimension_not_found', 'matchingCodes': 0, 'expectedCodes': len(expected)}
    codes = {str(x.get('@code', '')) for x in array(area.get('CLASS')) if isinstance(x, dict)}
    overlap = codes & expected
    return {
        'status': 'all_54_codes_in_metadata' if len(overlap) == 54 else 'partial_or_no_city_codes',
        'matchingCodes': len(overlap), 'expectedCodes': len(expected),
        'missingCodes': sorted(expected - codes),
        'note': 'Metadata coverage only. Per-indicator nonmissing values remain unverified.',
    }


def discover(themes, max_per_keyword, start_year=2020, max_pages=2, inspect_metadata=5,
             api=api_get, municipality_codes=None):
    this_year = dt.datetime.now(dt.timezone.utc).year
    if start_year > this_year:
        raise ValueError('start_year cannot be in the future')
    expected = set(municipality_codes or [])
    by_id, problems = {}, []
    successful_searches = 0
    survey_range = f'{start_year}01-{this_year}12'
    for theme in themes:
        for keyword in ALLOWED_THEMES[theme]:
            for page in range(max_pages):
                args = {'searchWord': keyword, 'surveyYears': survey_range,
                        'limit': max_per_keyword, 'startPosition': 1 + page * max_per_keyword}
                try:
                    raw = api('getStatsList', args)
                    block = raw.get('GET_STATS_LIST', {})
                    status = block.get('RESULT', {})
                    # e-Stat sometimes returns a nonzero API status for no matches.
                    if str(status.get('STATUS', '0')) != '0':
                        message = text(status.get('ERROR_MSG', ''))
                        if '該当データはありません' in message:
                            successful_searches += 1
                            break
                        raise ValueError(message)
                    items = array(block.get('DATALIST_INF', {}).get('TABLE_INF'))
                    successful_searches += 1
                except Exception as exc:
                    message = str(exc)
                    if '該当データはありません' in message:
                        successful_searches += 1
                        break
                    problems.append({'theme': theme, 'keyword': keyword,
                                     'page': page + 1, 'error': message[:250]})
                    break
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    rec = normalize(item, keyword, theme)
                    ident = rec['statsDataId']
                    if not ident.isdigit() or rec['surveyYear'] is None or rec['surveyYear'] < start_year:
                        continue
                    if ident in by_id:
                        old = by_id[ident]
                        if keyword not in old['matchingKeywords']:
                            old['matchingKeywords'].append(keyword)
                        if theme not in old['theme'].split(','):
                            old['theme'] += ',' + theme
                    else:
                        by_id[ident] = rec
                if len(items) < max_per_keyword:
                    break
    entries = sorted(by_id.values(), key=lambda r: (-(r['surveyYear'] or 0), r['theme'], r['statsDataId']))
    for rec in entries[:inspect_metadata]:
        try:
            meta = api('getMetaInfo', {'statsDataId': rec['statsDataId']})
            rec['municipalityCoverage'] = classify_area_metadata(meta, expected) if expected else {'status': 'reference_codes_unavailable'}
        except Exception as exc:
            rec['municipalityCoverage'] = {'status': 'metadata_failed', 'reason': str(exc)[:220]}
    return {
        'status': 'candidates_only_not_approved', 'source': 'e-Stat REST API v3',
        'generatedUTC': dt.datetime.now(dt.timezone.utc).isoformat(),
        'searchedThemes': list(themes), 'surveyYearsFilter': survey_range,
        'sort': 'survey_year_descending', 'entryCount': len(entries), 'entries': entries,
        'searchErrors': problems, 'successfulSearchCalls': successful_searches,
        'metadataInspected': min(inspect_metadata, len(entries)),
        'publicationRule': 'No values may be published without reviewed metadata and approved per-municipality validation.',
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--theme', choices=['employment', 'migration', 'all'], default='migration')
    parser.add_argument('--limit', type=int, default=50)
    parser.add_argument('--start-year', type=int, default=2020)
    parser.add_argument('--max-pages', type=int, default=2)
    parser.add_argument('--inspect-metadata', type=int, default=5)
    args = parser.parse_args(argv)
    if not 1 <= args.limit <= 100: parser.error('--limit must be 1..100')
    if not 2000 <= args.start_year <= dt.date.today().year: parser.error('--start-year invalid')
    if not 1 <= args.max_pages <= 5: parser.error('--max-pages must be 1..5')
    if not 0 <= args.inspect_metadata <= 15: parser.error('--inspect-metadata must be 0..15')
    themes = list(ALLOWED_THEMES) if args.theme == 'all' else [args.theme]
    # The project already has a canonical list of municipalities; avoid hardcoding.
    reference = ROOT / 'config/aichi_54_municipalities.json'
    codes = set()
    if reference.exists():
        values = json.loads(reference.read_text(encoding='utf-8'))
        codes = {str(obj['code']) for obj in values}
        if len(codes) != 54: parser.error('canonical municipality file must contain 54 unique codes')
    output = discover(themes, args.limit, args.start_year, args.max_pages,
                      args.inspect_metadata, municipality_codes=codes)
    dest = ROOT / 'staging/external_domain_candidates.json'
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f"Recent candidate tables: {output['entryCount']}; searches: {output['successfulSearchCalls']}; errors: {len(output['searchErrors'])}")
    print(f"Saved {dest.relative_to(ROOT)}; no statistical values were published.")
    if output['searchErrors']:
        for p in output['searchErrors']:
            print(f"Warning: {p['keyword']} page {p['page']}: {p['error']}", file=sys.stderr)
    return 0 if output['successfulSearchCalls'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
