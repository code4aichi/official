import importlib.util
import sys
from pathlib import Path
from unittest import TestCase

MODULE = Path(__file__).resolve().parents[1] / 'tools/external_domain_discovery.py'
sys.path.insert(0, str(MODULE.parent))
spec = importlib.util.spec_from_file_location('external_domain_discovery', MODULE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class TestRecentCatalog(TestCase):
    def test_recent_api_filter_sort_dedupe(self):
        requests = []
        def api(kind, args):
            requests.append((kind, args))
            word = args['searchWord']
            if word == '人口移動報告':
                records = [{'@id': '222', 'SURVEY_DATE': '202404', 'TITLE': {'$': '市区町村別'}}]
            elif word == '住民基本台帳人口移動報告':
                records = [{'@id': '222', 'SURVEY_DATE': '202404'}, {'@id': '111', 'SURVEY_DATE': '202201'}, {'@id': '123', 'SURVEY_DATE': '200101'}]
            else:
                records = []
            return {'GET_STATS_LIST': {'RESULT': {'STATUS': 0}, 'DATALIST_INF': {'TABLE_INF': records}}}
        result = mod.discover(['migration'], 20, 2020, 1, 0, api)
        self.assertEqual(result['entryCount'], 2)
        self.assertEqual([e['statsDataId'] for e in result['entries']], ['222', '111'])
        self.assertEqual(result['entries'][0]['matchingKeywords'], ['住民基本台帳人口移動報告', '人口移動報告'])
        self.assertTrue(all(q['surveyYears'].startswith('202001-') for kind,q in requests))
        self.assertEqual(result['entries'][0]['assessment'], 'manual_review_required')

    def test_page_2_and_metadata_code_check(self):
        requests=[]
        expected={f'23{i:03d}' for i in range(54)}
        def api(kind, args):
            requests.append((kind,args))
            if kind=='getMetaInfo':
                return {'GET_META_INFO': {'METADATA_INF': {'CLASS_INF': {'CLASS_OBJ': {'@id': 'area', 'CLASS': [{'@code':x} for x in expected]}}}}}
            if args['searchWord'] != '住民基本台帳人口移動報告':return {'GET_STATS_LIST': {'DATALIST_INF': {'TABLE_INF': []}}}
            if args['startPosition']==1:
                rows=[{'@id':'1','SURVEY_DATE':'2024'}, {'@id':'2','SURVEY_DATE':'2023'}]
            else:
                rows=[{'@id':'3','SURVEY_DATE':'2022'}]
            return {'GET_STATS_LIST': {'DATALIST_INF': {'TABLE_INF': rows}}}
        result=mod.discover(['migration'],2,2020,2,1,api,expected)
        self.assertEqual(result['entryCount'],3)
        self.assertTrue(any(args.get('startPosition')==3 for k,args in requests if k=='getStatsList'))
        self.assertEqual(result['entries'][0]['municipalityCoverage']['status'], 'all_54_codes_in_metadata')

    def test_no_match_is_not_fatal(self):
        def api(kind,args):
            raise ValueError('e-Stat getStatsList error: 正常に終了しましたが、該当データはありませんでした。')
        result=mod.discover(['migration'],5,2020,1,0,api)
        self.assertEqual(result['entryCount'],0)
        self.assertEqual(result['successfulSearchCalls'],4)

    def test_missing_values_are_not_approved(self):
        c=mod.classify_area_metadata({'GET_META_INFO': {'METADATA_INF': {'CLASS_INF': {'CLASS_OBJ': {'@id':'area','CLASS':[{'@code':'23100'}]}}}}}, {'23100','23201'})
        self.assertEqual(c['matchingCodes'],1)
        self.assertEqual(c['status'],'partial_or_no_city_codes')

if __name__ == '__main__':
    import unittest
    unittest.main()
