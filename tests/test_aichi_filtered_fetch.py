import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

src = Path(__file__).resolve().parents[1] / 'tools' / 'estat_pipeline.py'
spec = importlib.util.spec_from_file_location('estat_pipeline', src)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FilteredFetchTests(unittest.TestCase):
    def test_filtered_and_paginated(self):
        calls=[]
        def fake_api(kind, params):
            calls.append((kind, params))
            if kind=='getMetaInfo':return {'GET_META_INFO':{'METADATA_INF':{}}}
            start=params['startPosition']
            values=[{'@area':'23100','$':'10'}] if start==1 else [{'@area':'23201','$':'20'}]
            info={'TOTAL_NUMBER':'2'}
            if start==1:info['NEXT_KEY']='2'
            return {'GET_STATS_DATA':{'STATISTICAL_DATA':{'RESULT_INF':info,'DATA_INF':{'VALUE':values}}}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(mod,'ROOT',Path(tmp)), patch.object(mod,'municipalities',return_value={'23100':'名古屋市','23201':'豊橋市'}), patch.object(mod,'api_get',side_effect=fake_api):
            mod.fetch(SimpleNamespace(stats_id='0004006322',metadata_only=False,aichi_only=True))
            result=json.loads((Path(tmp)/'staging/0004006322_data.json').read_text())
            self.assertEqual(len(result['GET_STATS_DATA']['STATISTICAL_DATA']['DATA_INF']['VALUE']),2)
            self.assertEqual(calls[1][1]['cdArea'],'23100,23201')
            self.assertEqual(calls[2][1]['startPosition'],2)
    def test_reject_unexpected_area(self):
        def fake_api(kind, params):
            if kind=='getMetaInfo':return {}
            return {'GET_STATS_DATA':{'STATISTICAL_DATA':{'RESULT_INF':{'TOTAL_NUMBER':'1'},'DATA_INF':{'VALUE':[{'@area':'13000','$':'4'}]}}}}
        with tempfile.TemporaryDirectory() as tmp, patch.object(mod,'ROOT',Path(tmp)), patch.object(mod,'municipalities',return_value={'23100':'名古屋市'}), patch.object(mod,'api_get',side_effect=fake_api):
            with self.assertRaisesRegex(ValueError,'Unexpected area'):
                mod.fetch(SimpleNamespace(stats_id='0004006322',metadata_only=False,aichi_only=True))

if __name__=='__main__':unittest.main()
