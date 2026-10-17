import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
import fetch_boundaries as f

class GeoJSONTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cities=json.loads((f.DATA/'municipalities.json').read_text())
        cls.geom={'type':'Polygon','coordinates':[[[137.0,35.0],[137.1,35.0],[137.1,35.1],[137.0,35.0]]]}

    def test_54_municipalities_and_69_units(self):
        units=f.expected_units(self.cities)
        self.assertEqual(len(units),69)
        self.assertEqual(len(set(x[0] for x in units)),54)
        self.assertEqual(len(set(x[1] for x in units)),69)

    def test_geometry_validation(self):
        self.assertEqual(f.validate_geometry(self.geom),4)
        invalid={'type':'Polygon','coordinates':[[[138.9,35],[137,35],[137,35.2],[138.9,35]]]}
        with self.assertRaises(ValueError):f.validate_geometry(invalid)
        unclosed={'type':'Polygon','coordinates':[[[137,35],[137.1,35],[137.1,35.1],[137.0,35.2]]]}
        with self.assertRaises(ValueError):f.validate_geometry(unclosed)

    def test_full_collection_validation(self):
        fc={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'code':c['code'],'name':c['name']},'geometry':self.geom} for c in self.cities]}
        self.assertEqual(f.validate_collection(fc,self.cities),54)
        fc['features'].pop()
        with self.assertRaises(ValueError): f.validate_collection(fc,self.cities)

    def test_dissolve_adjacent_wards(self):
        a={'type':'Polygon','coordinates':[[[137.0,35.0],[137.1,35.0],[137.1,35.1],[137.0,35.1],[137.0,35.0]]]}
        b={'type':'Polygon','coordinates':[[[137.1,35.0],[137.2,35.0],[137.2,35.1],[137.1,35.1],[137.1,35.0]]]}
        merged=f.dissolve_geometries([a,b])
        from shapely.geometry import shape
        self.assertAlmostEqual(shape(merged).area,0.02,places=8)
        self.assertEqual(merged['type'],'Polygon')

    def test_fetch_failure_never_saves_partial(self):
        with patch.object(f,'fetch_geometry',side_effect=RuntimeError('network unavailable')):
            with self.assertRaises(RuntimeError):f.build(self.cities)

if __name__=='__main__':unittest.main()
