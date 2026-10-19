#!/usr/bin/env python3
"""Read-only SPARQL probe for statistical LOD. Saves JSON to staging only."""
import argparse
import json
from pathlib import Path
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

ROOT=Path(__file__).resolve().parents[1]
def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--endpoint',required=True,help='Verified official SPARQL endpoint URL')
    p.add_argument('--query-file',required=True,help='Reviewed SPARQL SELECT query file')
    p.add_argument('--output',default='staging/lod_probe.json')
    args=p.parse_args()
    url=urlparse(args.endpoint)
    if url.scheme!='https' or url.hostname not in ('data.e-stat.go.jp',):
        raise SystemExit('Only the verified official data.e-stat.go.jp HTTPS endpoint is permitted')
    query=Path(args.query_file).read_text(encoding='utf-8').strip()
    if not query.upper().startswith('SELECT ') or len(query)>8000:
        raise SystemExit('Only reviewed SELECT queries (max 8000 chars) are permitted')
    output=Path(args.output)
    if output.is_absolute() or '..' in output.parts or output.parts[0]!='staging' or output.suffix!='.json':
        raise SystemExit('Only staging/*.json output is allowed')
    req=Request(args.endpoint+'?'+urlencode({'query':query,'format':'application/sparql-results+json'}),headers={'Accept':'application/sparql-results+json','User-Agent':'MIERU-AICHI-v2.7-probe'})
    with urlopen(req,timeout=30) as r:
        response=json.load(r)
    if not isinstance(response.get('results',{}).get('bindings'),list):raise SystemExit('Unexpected SPARQL response')
    dest=ROOT/output;dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps({'status':'reference_only_not_published','endpoint':args.endpoint,'data':response},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Saved LOD probe to {output}; existing census data untouched.')
if __name__=='__main__':main()
