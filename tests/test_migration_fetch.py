import importlib.util
import json
import sys
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('estat_pipeline', ROOT / 'tools' / 'estat_pipeline.py')
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
SOURCE = Path('/mnt/data/e-stat-staging(5).zip')

class MigrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if SOURCE.exists():
            with zipfile.ZipFile(SOURCE) as z:
                cls.metadata = json.loads(z.read('0004044293_meta.json'))
        else:
            cls.metadata = None
        cities = mod.municipalities()
        def clsobj(k, name, entries):
            return {'@id': k, '@name': name, 'CLASS': [{'@code': code, '@name': label} for code, label in entries.items()]}
        cls.fixture = {'GET_META_INFO': {'METADATA_INF': {
            'TABLE_INF': {'@id': '0004044293', 'TITLE': {'$': '移動前の住所地別転入者数（2025年）'}},
            'CLASS_INF': {'CLASS_OBJ': [
                clsobj('cat01', '移動後の住所地（現住地）', cities),
                clsobj('area', '移動前の住所地（前住地）', {'00005': '総数（前住地）'}),
                clsobj('tab', '表章項目', {'18': '転入者数'}),
                clsobj('cat02', '年齢', {'000': '総数'}),
                clsobj('cat03', '性別', {'0': '総数'}),
                clsobj('cat04', '国籍', {'60000': '移動者'}),
                clsobj('time', '時間軸', {'2025000000': '2025年'}),
            ]}}}}

    def test_actual_2025_inbound_metadata(self):
        codes = set(mod.municipalities())
        filters, selectors = mod.migration_filter(self.metadata or self.fixture, 'in', codes)
        self.assertEqual(filters['cdArea'], '00005')
        self.assertEqual(set(filters['cdCat01'].split(',')), codes)
        self.assertEqual(filters['cdCat02'], '000')
        self.assertEqual(filters['cdCat03'], '0')
        self.assertEqual(filters['cdTime'], '2025000000')

    def test_correct_54_results(self):
        codes = set(mod.municipalities())
        selectors = {'area': '00005', 'cat02': '000', 'cat03': '0',
                     'cat04': '60000', 'time': '2025000000', 'tab': '18'}
        rows = [{'@area': '00005', '@cat01': c, '@cat02': '000',
                 '@cat03': '0', '@cat04': '60000', '@time': '2025000000',
                 '@tab': '18', '$': '12'} for c in sorted(codes)]
        result = {'GET_STATS_DATA': {'STATISTICAL_DATA': {
            'RESULT_INF': {'TOTAL_NUMBER': 54}, 'DATA_INF': {'VALUE': rows}}}}
        self.assertEqual(len(mod.validate_migration_values(result, selectors, codes)), 54)
        rows[0]['$'] = '-'
        with self.assertRaisesRegex(ValueError, 'Missing'):
            mod.validate_migration_values(result, selectors, codes)
        rows[0]['$'] = '12'
        rows[1]['@cat01'] = rows[0]['@cat01']
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            mod.validate_migration_values(result, selectors, codes)

    def test_reject_wrong_axis(self):
        import copy
        bad = copy.deepcopy(self.fixture)
        obj = bad['GET_META_INFO']['METADATA_INF']['CLASS_INF']['CLASS_OBJ']
        next(x for x in obj if x['@id'] == 'area')['@name'] = '移動後の住所地'
        with self.assertRaisesRegex(ValueError, 'Unexpected municipality'):
            mod.migration_filter(bad, 'in', set(mod.municipalities()))

    def test_outbound_fails_if_reusing_inbound_metadata(self):
        with self.assertRaisesRegex(ValueError, 'not the expected'):
            mod.migration_filter(self.fixture, 'out', set(mod.municipalities()))

if __name__ == '__main__':
    unittest.main()
