#!/usr/bin/env python3
"""Read-only health probe for official statistical LOD SPARQL endpoint.

Explicit endpoint required; results are staging-only and cannot replace census.
"""
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]

def validate(endpoint, query, output):
    parsed=urlparse(endpoint)
    if parsed.scheme != 'https' or parsed.hostname != 'data.e-stat.go.jp' or parsed.username or parsed.password:
        raise ValueError('Endpoint must be an official HTTPS data.e-stat.go.jp URL')
    if not query.lstrip().upper().startswith('SELECT '):
        raise ValueError('Read-only SELECT queries only')
    if len(query)>4000: raise ValueError('Query is too long')
    path=Path(output)
    if path.is_absolute() or '..' in path.parts or path.parts[0]!='staging' or path.suffix!='.json':
        raise ValueError('Only staging/*.json paths are allowed')

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--endpoint',required=True,help='Official current SPARQL endpoint, verify from data.e-stat.go.jp')
    p.add_argument('--query-file',default='tools/lod_queries/connectivity_select.rq')
    args=p.parse_args()
    q=(ROOT/args.query_file).read_text(encoding='utf-8').strip()
    validate(args.endpoint,q,'staging/lod_connectivity.json')
    url=args.endpoint+('&' if '?' in args.endpoint else '?') +urlencode({'query':q,'format':'application/sparql-results+json'})
    req=Request(url,headers={'Accept':'application/sparql-results+json','User-Agent':'MIERU-AICHI-LOD-ReadOnly'})
    with urlopen(req,timeout=45) as resp:
        payload=json.load(resp)
    bindings=payload.get('results',{}).get('bindings')
    if not isinstance(bindings,list):raise ValueError('Unexpected SPARQL response')
    output=ROOT/'staging/lod_connectivity.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'status':'connectivity_only_not_approved','endpoint':args.endpoint,'rowCount':len(bindings),'bindings':bindings},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('LOD endpoint responded. This does NOT confirm coverage of specific Aichi indicators.')
if __name__=='__main__':main()
