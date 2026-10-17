#!/usr/bin/env python3
"""Update Aichi municipal boundary geometry from the MIT licensed 2022 dataset.

All-or-nothing: if any download or validation fails, the committed boundary is untouched.
No third party packages required. This script is intended for GitHub Actions.
"""
from __future__ import annotations
import argparse
import json
import math
import os
from pathlib import Path
from shapely.geometry import shape, mapping
from shapely.ops import unary_union
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'
BASES=(
 'https://raw.githubusercontent.com/sankichi92/shikuchoson-boundaries/gh-pages/{code}.geojson',
 'https://shikuchoson-boundaries.sankichi.app/{code}.geojson',
)


def expected_units(cities):
    assert len(cities)==54 and len({c['code'] for c in cities})==54, 'expected 54 distinct municipalities'
    return [(city['code'], f'{n:05d}' if city['code']=='23100' else city['code'],city['name'])
            for city in cities for n in (range(23101,23117) if city['code']=='23100' else [int(city['code'])])]


def download_json(url, timeout=20, retries=3):
    last=None
    for attempt in range(retries):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Code-for-AICHI/Aichi-Data-Atlas-v0.4 (contact via repository issues)','Accept':'application/geo+json,application/json'})
            with urllib.request.urlopen(req,timeout=timeout) as response:
                if response.status!=200: raise RuntimeError(f'HTTP {response.status}')
                blob=response.read(12_000_001)
                if len(blob)>12_000_000: raise ValueError('individual GeoJSON exceeds 12 MB')
                return json.loads(blob)
        except (OSError,ValueError,RuntimeError,json.JSONDecodeError) as ex:
            last=ex
            if attempt<retries-1: time.sleep(min(2**attempt,4))
    raise RuntimeError(f'{url}: {last}')


def fetch_geometry(code):
    failures=[]
    for template in BASES:
        url=template.format(code=code)
        try:
            data=download_json(url)
            if data.get('type')=='Feature': geom=data.get('geometry')
            elif data.get('type')=='FeatureCollection' and len(data.get('features',[]))==1:
                geom=data['features'][0].get('geometry')
            else: raise ValueError('unexpected GeoJSON type or multiple features')
            validate_geometry(geom)
            return geom
        except Exception as e: failures.append(str(e))
    raise RuntimeError(f'failed all sources for code {code}: ' + ' / '.join(failures))


def validate_geometry(geometry):
    if not isinstance(geometry,dict) or geometry.get('type') not in ('Polygon','MultiPolygon'):
        raise ValueError('geometry type must be Polygon or MultiPolygon')
    multi=geometry.get('coordinates')
    if not isinstance(multi,list) or not multi: raise ValueError('missing coordinates')
    polygons=[multi] if geometry['type']=='Polygon' else multi
    vertices=0
    for poly in polygons:
        if not isinstance(poly,list) or not poly: raise ValueError('invalid polygon')
        for ring in poly:
            if not isinstance(ring,list) or len(ring)<4 or ring[0]!=ring[-1]:
                raise ValueError('invalid / unclosed ring')
            for position in ring:
                if not isinstance(position,list) or len(position)<2: raise ValueError('invalid position')
                lon,lat=position[:2]
                if not all(isinstance(v,(int,float)) and math.isfinite(v) for v in (lon,lat)):
                    raise ValueError('invalid coordinate number')
                # Aichi land and island regions; broad limit permits tiny border excursions.
                if not (136.3<lon<138.5 and 34.3<lat<35.8):
                    raise ValueError(f'coordinate outside plausible Aichi extent {lon}, {lat}')
                vertices+=1
    if vertices<4: raise ValueError('empty geometry')
    return vertices


def validate_collection(fc, cities):
    """The published boundary file contains exactly one feature per municipality."""
    if fc.get('type')!='FeatureCollection': raise ValueError('not FeatureCollection')
    features=fc.get('features')
    if not isinstance(features,list) or len(features)!=54:
        raise ValueError('expected exactly 54 municipalities (Nagoya wards must be dissolved)')
    expected={str(c['code']) for c in cities}
    seen=set()
    for f in features:
        if f.get('type')!='Feature': raise ValueError('not feature')
        p=f.get('properties') or {}
        code=str(p.get('code'))
        if code not in expected or code in seen:
            raise ValueError('unexpected or repeated municipality '+code)
        seen.add(code)
        validate_geometry(f.get('geometry'))
    if seen!=expected: raise ValueError('boundary municipalities missing')
    return 54


def dissolve_geometries(geometries):
    """Remove shared ward edges by taking a geometric union, not by hiding strokes."""
    combined=unary_union([shape(g) for g in geometries])
    if combined.is_empty or combined.geom_type not in ('Polygon','MultiPolygon'):
        raise ValueError('failed to dissolve ward polygons')
    # shapely.mapping returns tuples; JSON will serialize them as coordinate arrays.
    result=json.loads(json.dumps(mapping(combined)))
    validate_geometry(result)
    return result


def build(cities):
    units=expected_units(cities)
    downloaded={}
    for idx,(code,unit,name) in enumerate(units,1):
        downloaded.setdefault(code,[]).append(fetch_geometry(unit))
        print(f'[{idx:02d}/69] {unit} {name} OK',flush=True)
    features=[]
    for city in cities:
        code=city['code']
        geometries=downloaded[code]
        geometry=dissolve_geometries(geometries) if len(geometries)>1 else geometries[0]
        features.append({'type':'Feature',
                         'properties':{'code':code,'name':city['name']},
                         'geometry':geometry})
    fc={'type':'FeatureCollection','features':features}
    validate_collection(fc,cities)
    return fc

def serialize(obj): return (json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n').encode('utf8')


def atomic_write(path,blob):
    path.parent.mkdir(parents=True,exist_ok=True)
    fd,temp=tempfile.mkstemp(dir=path.parent,prefix='.geojson-')
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(blob)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp,path)
    finally:
        if os.path.exists(temp): os.unlink(temp)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--check',action='store_true',help='validate local GeoJSON without fetching')
    ap.add_argument('--fixture-dir',type=Path,help='test: directory with 69 local {code}.geojson files')
    args=ap.parse_args()
    cities=json.loads((DATA/'municipalities.json').read_text(encoding='utf8'))
    dst=DATA/'aichi-boundaries.geojson'
    if args.check:
        if not dst.exists(): raise SystemExit('MISSING: '+str(dst))
        fc=json.loads(dst.read_text(encoding='utf8'))
        print('PASS: ',validate_collection(fc,cities),'features, 54 municipalities')
        return
    if args.fixture_dir:
        def fixture(code):
            p=args.fixture_dir/f'{code}.geojson'
            data=json.loads(p.read_text(encoding='utf8'))
            return data['geometry'] if data['type']=='Feature' else data
        globals()['fetch_geometry']=fixture
    fc=build(cities)
    blob=serialize(fc)
    if dst.exists() and dst.read_bytes()==blob:
        print('UNCHANGED: existing GeoJSON matches source, no commit needed')
        return
    atomic_write(dst,blob)
    print('UPDATED:',dst,'bytes:',len(blob))

if __name__=='__main__':main()
