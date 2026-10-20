#!/usr/bin/env python3
"""Read-only Playwright comparison: municipality's displayed population vs published CSV.
UI calculations, map color bins and AI outputs are not claimed to be audited here.
"""
import csv,io,json,os,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.getenv('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT=Path('data-audit-results');OUT.mkdir(exist_ok=True)
results=[]

def add(case,status,detail):
    results.append({'check':case,'status':status,'detail':str(detail)[:600]})

def fetch_csv(year):
    with urllib.request.urlopen(BASE+f'data/population_{year}.csv', timeout=40) as f:
        return list(csv.DictReader(io.StringIO(f.read().decode('utf-8-sig'))))

def visible_number(page):
    return ''.join(c for c in page.locator('#population').inner_text() if c.isdigit())

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':900},locale='ja-JP')
        errors=[]
        page.on('pageerror', lambda err:errors.append(str(err)))
        page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
        page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=40000)
        page.wait_for_timeout(1700)
        select=page.locator('#city-select');year_select=page.locator('#year-select')
        # Correct source files: 2015 is historical.json, 2020 is municipalities.json,
        # and 2025 is population_2025.csv plus historical.json.
        with urllib.request.urlopen(BASE+'data/historical.json',timeout=40) as f:
            historical=json.loads(f.read().decode('utf-8-sig'))['cities']
        with urllib.request.urlopen(BASE+'data/municipalities.json',timeout=40) as f:
            municipalities=json.loads(f.read().decode('utf-8-sig'))
        reference2020={str(x['code']):int(x['population']) for x in municipalities}
        csv2025=fetch_csv(2025)
        reference2025={str(r['code']):int(r['population_2025']) for r in csv2025}
        reference2015={str(c):v['population_2015'] for c,v in historical.items()}
        for year,ref in ((2025,reference2025),(2020,reference2020),(2015,reference2015)):
            year_select.select_option(str(year))
            keys=list(ref) if year==2025 else list(ref)[:4]+list(ref)[-1:]
            for code in keys:
                expected=ref[code]
                case=f'{year} {code}'
                try:
                    select.select_option(code)
                    page.wait_for_function('expected => {let el=document.querySelector("#population");if(!el)return false;let n=el.textContent.replace(/[^0-9]/g,"");return n===String(expected);}',arg=expected,timeout=4000)
                    label=page.locator('#selected-name').inner_text()
                    add(case,'PASS',f'expected={expected}; displayed={visible_number(page)}; selected={label}')
                except Exception as exc:
                    actual=visible_number(page)
                    add(case,'FAIL',f'expected={expected}; actual={actual}; error={str(exc)[:120]}')
                    if len([r for r in results if r['status']=='FAIL'])<5:
                        page.screenshot(path=str(OUT/f'display_mismatch_{year}_{code}.png'),full_page=False)
        add('browser page exceptions','FAIL' if errors else 'PASS',errors[:5] if errors else 'none')
        add('map color scale numeric agreement','REVIEW','Needs map bin thresholds and per-city fill verification in separate test')
        add('other rendered metrics vs source','REVIEW','Population display checked; households, sector, migration rendering require metric-specific tests')
        browser.close()

if __name__=='__main__':
    try:run()
    except Exception as exc:add('test harness','FAIL',f'{type(exc).__name__}: {exc}')
    (OUT/'display_audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    with (OUT/'display_audit.csv').open('w',newline='',encoding='utf-8-sig') as f:
        w=csv.DictWriter(f,fieldnames=['check','status','detail']);w.writeheader();w.writerows(results)
    counts={x:sum(r['status']==x for r in results) for x in ('PASS','FAIL','REVIEW')}
    print('Display data audit:',counts)
    for r in results:
        if r['status']!='PASS':print(r['status'],r['check'],r['detail'])
    raise SystemExit(1 if counts['FAIL'] else 0)
