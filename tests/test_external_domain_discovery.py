import importlib.util
from pathlib import Path
from unittest import TestCase

MODULE=Path(__file__).resolve().parents[1]/'tools/external_domain_discovery.py'
import sys
sys.path.insert(0,str(MODULE.parent))
spec=importlib.util.spec_from_file_location('external_domain_discovery',MODULE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestCatalog(TestCase):
    def test_dedupe_and_no_approval(self):
        def fake_api(kind,arguments):
            return {'GET_STATS_LIST':{'DATALIST_INF':{'TABLE_INF':{'@id':'0001234567','TITLE':{'$':'事業所'},'STAT_NAME':{'$':'経済系調査'},'SURVEY_DATE':'2021'}}}}
        result=mod.discover(['employment'],5,fake_api)
        self.assertEqual(result['entryCount'],1)
        self.assertEqual(result['entries'][0]['assessment'],'manual_review_required')
        self.assertEqual(len(result['entries'][0]['matchingKeywords']),4)
    def test_partial_failure_survives(self):
        def fake_api(kind,arguments):
            if arguments['searchWord']=='転入者数':raise TimeoutError('mock')
            return {'GET_STATS_LIST':{'DATALIST_INF':{'TABLE_INF':[]}}}
        result=mod.discover(['migration'],5,fake_api)
        self.assertEqual(len(result['searchErrors']),1)
    def test_never_approved_by_search(self):
        r=mod.normalize({'@id':'123456','TITLE':'test'},'雇用','employment')
        self.assertNotIn('approved',r)
        self.assertEqual(r['assessment'],'manual_review_required')
if __name__=='__main__':
    import unittest
    unittest.main()
