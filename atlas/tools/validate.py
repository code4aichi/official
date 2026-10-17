import json,csv,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
r=json.loads((root/'data/municipalities.json').read_text(encoding='utf8'))
assert len(r)==54 and len(set(x['code'] for x in r))==54
assert len(set(x['name'] for x in r))==54
assert all(isinstance(x['population'],int) and x['population']>0 for x in r)
with (root/'data/population_2020.csv').open(encoding='utf-8-sig',newline='') as f: values={x['code']:int(x['population']) for x in csv.DictReader(f)}
assert len(values)==54 and all(values[x['code']]==x['population'] for x in r)
print('PASS:',len(r),'municipalities; total',sum(x['population'] for x in r))
