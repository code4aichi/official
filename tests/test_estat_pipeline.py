import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1]/'tools'/'estat_pipeline.py'
spec=importlib.util.spec_from_file_location('estat_pipeline',MODULE)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ROOT=Path(__file__).resolve().parents[1]

class PipelineTests(unittest.TestCase):
    def test_54_municipalities(self):
        codes=mod.municipalities()
        self.assertEqual(len(codes),54)
        self.assertEqual(codes['23100'],'名古屋市')

    def test_census_rejection_and_completeness(self):
        codes=mod.municipalities()
        sid='1234567890'
        manifest={'slug':'industry_sites','statsDataId':sid,'label':'事業所数','year':2021,'unit':'所',
            'sourceTitle':'経済センサス','sourceUrl':'https://www.e-stat.go.jp/',
            'selectors':{'cat01':'0001','time':'2021'},'areaDimension':'area','valueConstraint':'nonnegative'}
        meta={'GET_META_INFO':{'METADATA_INF':{'CLASS_INF':{'CLASS_OBJ':[
            {'@id':'area','CLASS':[{'@code':x} for x in codes]},
            {'@id':'cat01','CLASS':[{'@code':'0001'},{'@code':'9999'}]},
            {'@id':'time','CLASS':[{'@code':'2021'}]}]}}}}
        def data(codes_subset):
            return {'GET_STATS_DATA':{'STATISTICAL_DATA':{'DATA_INF':{'VALUE':[
                {'@area':x,'@cat01':'0001','@time':'2021','$':str(i+1)} for i,x in enumerate(codes_subset)]}}}}
        class Args: pass
        with tempfile.TemporaryDirectory() as d:
            tmp=Path(d)
            (tmp/'staging').mkdir();(tmp/'config').mkdir()
            (tmp/'config'/'aichi_54_municipalities.json').write_text(json.dumps([{'code':k,'name':v} for k,v in codes.items()]))
            p=tmp/'manifest.json';p.write_text(json.dumps(manifest))
            args=Args();args.manifest=str(p)
            with patch.object(mod,'ROOT',tmp):
                mod.saved(tmp/'staging'/f'{sid}_meta.json',meta)
                mod.saved(tmp/'staging'/f'{sid}_data.json',data(list(codes)[:53]))
                with self.assertRaisesRegex(ValueError,'Only 53/54'):mod.prepare(args)
                self.assertFalse((tmp/'staging'/'industry_sites_candidate.json').exists())
                mod.saved(tmp/'staging'/f'{sid}_data.json',data(list(codes)))
                mod.prepare(args)
                self.assertEqual(len(json.loads((tmp/'staging'/'industry_sites_candidate.json').read_text())['cities']),54)
                manifest['sourceTitle']='国勢調査';p.write_text(json.dumps(manifest))
                with self.assertRaisesRegex(ValueError,'Census'):mod.prepare(args)

if __name__=='__main__':unittest.main()
