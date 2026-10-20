#!/usr/bin/env python3
"""MIERU AICHI v2.9.13: independent browser/source checks, read-only.
REVIEW is not PASS. No inferred official prefectural totals or color boundaries.
"""
import csv, io, json, os, sys, urllib.request
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE = os.getenv('MIERU_URL', 'https://code4aichi.org/atlas/').rstrip('/') + '/'
OUT = Path('four-pending-results'); OUT.mkdir(exist_ok=True)
ROWS=[]
def record(area, name, status, detail):
    assert status in ('PASS','FAIL','REVIEW','SKIP')
    ROWS.append(dict(area=area,check=name,status=status,detail=str(detail)[:1500]))
    print(f'{status:6} {area}: {name}: {str(detail)[:150]}',flush=True)
def get_json(path):
    request=urllib.request.Request(urljoin(BASE,path),headers={'User-Agent':'MIERU-acceptance-2.9.13','Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=40) as response: return json.load(response)
def activate(page,mode):
    button=page.locator(f'#v291-quicknav [data-mode="{mode}"]').first
    if not button.count() or not button.is_visible():
        button=page.locator(f'.workspace-nav-button[data-workspace="{mode}"]').first
    if not button.count():raise RuntimeError(f'No switch control for {mode}')
    if button.is_visible():button.click()
    else:button.evaluate('(element)=>element.click()')
    page.locator(f'#panel-{mode}').wait_for(state='visible',timeout=12000)
def select_tab(page,name):
    panel=page.locator('#panel-external')
    candidates=panel.locator('button,[role="tab"]')
    for i in range(min(candidates.count(),140)):
        button=candidates.nth(i)
        if button.is_visible() and name in (button.inner_text() or ''):
            button.click();page.wait_for_timeout(650);return True
    return False

def csv_audit(page,source):
    activate(page,'external')
    if not select_tab(page,'人口移動'):
        record('csv','migration tab accessible','FAIL','No visible population migration tab');return
    host=page.locator('#migration-2025')
    host.locator('.migration-download').first.wait_for(state='visible',timeout=18000)
    export=host.locator('.migration-download').first
    with page.expect_download(timeout=20000) as info: export.click()
    downloaded=info.value
    target=OUT/'migration_export_2025.csv'; downloaded.save_as(str(target))
    raw=target.read_bytes().decode('utf-8-sig')
    rows=list(csv.reader(io.StringIO(raw)))
    expected=source['municipalities']
    if not rows or rows[0]!=['自治体コード','自治体名','転入者数','転出者数','転入超過数']:
        record('csv','header matches documented export','FAIL', rows[0] if rows else 'empty');return
    mismatch=[]; found={}
    for row in rows[1:]:
        if len(row)!=5:mismatch.append(f'bad width: {row!r}');continue
        code=row[0]
        if code in found:mismatch.append(f'duplicate {code}')
        found[code]=row
        x=expected.get(code)
        if x is None:mismatch.append(f'extra {code}');continue
        if row[1]!=x['name'] or tuple(row[2:])!=(str(x['in']),str(x['out']),str(x['net'])):
            mismatch.append(f'{code}: CSV={row[1:]} JSON={x}')
    missing=sorted(set(expected)-set(found))
    record('csv','all 54 export rows match approved JSON','PASS' if len(rows)==55 and not mismatch and not missing else 'FAIL',f'rows={len(rows)-1}; missing={missing[:10]}; discrepancies={mismatch[:8]}')
    record('csv','download is actual CSV file','PASS' if downloaded.suggested_filename.endswith('.csv') else 'FAIL',downloaded.suggested_filename)

def lq_audit(page,data):
    activate(page,'external')
    if not select_tab(page,'産業別構成'):
        record('industry','sector tab accessible','FAIL','No visible sector tab');return
    host=page.locator('#industry-insights')
    host.locator('.industry-insights-controls select').first.wait_for(state='visible',timeout=18000)
    controls=host.locator('.industry-insights-controls select')
    city_sel=controls.nth(1); metric_sel=controls.nth(0)
    codes=[s['code'] for s in data['sectors']]
    failed=[]; samples=[]; verified=0
    for metric in ('employees','establishments'):
        cohort={id:city for id,city in data['cities'].items() if all(type(city.get('values',{}).get(k,{}).get(metric)) is int for k in codes)}
        totals={k:sum(city['values'][k][metric] for city in cohort.values()) for k in codes}
        cohort_total=sum(totals.values())
        if cohort_total<=0:record('industry','reference population', 'FAIL',f'{metric}: zero denominator');continue
        metric_sel.select_option(metric)
        # Check 3 eligible cities, different cohort sizes if possible.
        for id in list(cohort)[:3]:
            city_sel.select_option(id);page.wait_for_timeout(250)
            city=cohort[id]; city_total=sum(city['values'][k][metric] for k in codes)
            expected=[]
            for s in data['sectors']:
                denominator=totals[s['code']]/cohort_total
                if denominator>0 and city_total>0:
                    val=(city['values'][s['code']][metric]/city_total)/denominator
                    expected.append((s['name'], f'{val:.2f}',f'{100*city["values"][s["code"]][metric]/city_total:.1f}%'))
            expected.sort(key=lambda x:float(x[1]),reverse=True)
            shown=host.locator('.industry-insights-line')
            actual=shown.evaluate_all('''nodes=>nodes.map(n=>({name:n.querySelector('.industry-insights-sector')?.textContent.trim(), lq:n.querySelector('.industry-insights-index')?.textContent.trim(), share:n.querySelector('.industry-insights-value')?.textContent.trim()}))''')
            if len(actual)!=len(expected):failed.append(f'{metric}:{id} rows {len(actual)} != {len(expected)}');continue
            by_name={x['name']:x for x in actual}
            for name,idx,share in expected:
                x=by_name.get(name)
                if not x or x['lq']!=idx or x['share']!=share:
                    failed.append(f'{metric}:{id}:{name}: expected={idx},{share}, actual={x}')
            verified+=len(expected);samples.append((metric,id,len(expected)))
    record('industry','rendered LQ and shares match independent calculation', 'PASS' if verified>0 and not failed else 'FAIL',f'rows checked={verified}; samples={samples}; mismatches={failed[:8]}')
    # Missing-data behavior is not treated as zero.
    invalid=next((id for id,c in data['cities'].items() if any(c.get('values',{}).get(k,{}).get('employees') is None for k in codes)),None)
    if invalid:
        metric_sel.select_option('employees'); city_sel.select_option(invalid)
        notice=host.locator('.industry-insights-alert').all_inner_texts()
        record('industry','missing industry values never yield LQ','PASS' if notice and not host.locator('.industry-insights-index').count() else 'FAIL',f'city={invalid}; notice={notice[:1]}')

def map_audit(page):
    # Visual color changes are not enough to establish thresholds, so do not fake a pass.
    try:
        js=page.evaluate('''() => {
          const svg=document.querySelector('#map-view svg');if(!svg)return {error:'no svg'};
          return [...svg.querySelectorAll('path,polygon')].filter(x=>x.getBoundingClientRect().width>1).slice(0,60).map(x=>({id:x.id, code:x.getAttribute('data-code')||x.getAttribute('data-city')||x.getAttribute('data-id'),fill:getComputedStyle(x).fill}));
        }''')
        (OUT/'map_rendered_fills.json').write_text(json.dumps(js,ensure_ascii=False,indent=2),encoding='utf-8')
        record('map','record all SVG fill colors','PASS' if isinstance(js,list) and len(js)>=54 else 'REVIEW',f'recorded shapes={len(js) if isinstance(js,list) else js}')
        record('map','color class matches numeric thresholds','REVIEW','Actual color threshold computation and indicator value mapping were not independently identified. Screenshot/fill colors do not prove numeric class correctness.')
    except Exception as exc:record('map','capture color evidence','FAIL',str(exc))

def prefecture_audit(source):
    people=source.get('municipalities',{})
    sums={k:sum(city[k] for city in people.values()) for k in ('in','out','net')}
    record('migration','54-city sums and subtraction','PASS' if len(people)==54 and sums['net']==sums['in']-sums['out'] else 'FAIL',sums)
    record('migration','independent published Aichi prefecture total','REVIEW','Requires official 2025 prefecture source and harmonized nationality / overseas / geography scope; no authoritative benchmark included in artifacts')

def main():
    try:
        migration=get_json('data/external-statistics/migration_2025_approved.json')
        industry=get_json('data/external-statistics/industry_2021_sectors_approved.json')
    except Exception as exc:
        record('source','load approved datasets','FAIL',repr(exc));migration=industry=None
    if migration:prefecture_audit(migration)
    if migration and industry:
        try:
            with sync_playwright() as playwright:
                browser=playwright.chromium.launch(headless=True)
                page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True,locale='ja-JP')
                errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
                page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=45000)
                for title,job in [('CSV',lambda:csv_audit(page,migration)),('LQ',lambda:lq_audit(page,industry)),('map',lambda:map_audit(page))]:
                    try:job()
                    except Exception as exc:record(title,'browser test run','FAIL',f'{type(exc).__name__}: {exc}')
                record('browser','uncaught page exceptions','PASS' if not errors else 'FAIL',errors[:5])
                page.screenshot(path=str(OUT/'audit_desktop.png'),full_page=False)
                browser.close()
        except Exception as exc:record('browser','startup','FAIL',repr(exc))
    with (OUT/'results.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=['area','check','status','detail']);w.writeheader();w.writerows(ROWS)
    totals={status:sum(r['status']==status for r in ROWS) for status in ('PASS','FAIL','REVIEW','SKIP')}
    (OUT/'results.json').write_text(json.dumps({'url':BASE,'counts':totals,'checks':ROWS},ensure_ascii=False,indent=2),encoding='utf-8')
    print('FINAL',totals)
    return int(totals['FAIL']>0)
if __name__=='__main__':sys.exit(main())
