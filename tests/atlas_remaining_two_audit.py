#!/usr/bin/env python3
"""MIERU AICHI 2.9.14: read-only map numeric ordering & official scope evidence.
Never equate intra-prefecture-inclusive city sums with official inter-prefecture gross flows.
"""
import csv, json, os, sys, urllib.request
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE = os.environ.get('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT = Path('remaining-two-results'); OUT.mkdir(exist_ok=True)
CHECKS=[]
PALETTE=['rgb(220, 238, 248)','rgb(150, 223, 231)','rgb(61, 184, 195)','rgb(21, 126, 172)','rgb(13, 43, 87)']

def log(name,status,detail):
    assert status in {'PASS','FAIL','REVIEW','SKIP'}
    CHECKS.append(dict(check=name,status=status,detail=str(detail)[:1600]))
    print(status,name,str(detail)[:250],flush=True)

def remote_json(name):
    req=urllib.request.Request(urljoin(BASE,name), headers={'User-Agent':'MIERU-v2914-audit','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=45) as r:return json.load(r)

def map_check(history):
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':900},locale='ja-JP')
        page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
        page.locator('#map-view svg path, #map-view svg polygon').first.wait_for(timeout=40000)
        # Select the known official-data view using visible options, not guessed option VALUES.
        year=page.locator('#year-select')
        year_opts=year.locator('option').evaluate_all('els=>els.map(e=>({v:e.value,t:e.textContent.trim()}))') if year.count() else []
        if year.count():
            year2025=next((o for o in year_opts if '2025' in o['t'] or o['v']=='2025'),None)
            if year2025:year.select_option(year2025['v'])
        cat=page.locator('#category-select'); ind=page.locator('#indicator-select')
        opts=ind.locator('option').evaluate_all('els=>els.map(e=>({v:e.value,t:e.textContent.trim()}))')
        pop=next((o for o in opts if '総人口' in o['t']),None)
        if pop is None and cat.count():
            for c in cat.locator('option').evaluate_all('els=>els.map(e=>({v:e.value,t:e.textContent.trim()}))'):
                cat.select_option(c['v'])
                opts=ind.locator('option').evaluate_all('els=>els.map(e=>({v:e.value,t:e.textContent.trim()}))')
                pop=next((o for o in opts if '総人口' in o['t']),None)
                if pop:break
        if not pop:
            log('2025 population map selected','REVIEW',f'No visible option labelled 総人口; indicator choices={opts[:12]}')
            browser.close();return
        ind.select_option(pop['v']);page.wait_for_timeout(1500)
        actual=page.evaluate('''() => {
            const svg=document.querySelector('#map-view svg');if(!svg)return [];
            return [...svg.querySelectorAll('path,polygon')].filter(e=>e.getBoundingClientRect().width>1)
             .map(e=>({code:e.getAttribute('data-code')||e.getAttribute('data-city')||e.getAttribute('data-id'),fill:getComputedStyle(e).fill}));
        }''')
        page.screenshot(path=str(OUT/'population_map_2025.png'),full_page=False)
        browser.close()
    values={code:rec.get('population_2025') for code,rec in history['cities'].items()}
    rows=[];seen=set();issues=[]
    for item in actual:
        code=item.get('code');color=item.get('fill')
        if code not in values:issues.append(f'unknown code {code}');continue
        if code in seen:issues.append(f'duplicate {code}');continue
        seen.add(code)
        rank=PALETTE.index(color) if color in PALETTE else None
        if rank is None:issues.append(f'unknown palette {code}: {color}')
        rows.append(dict(code=code,population_2025=values[code],fill=color,class_rank=rank if rank is not None else ''))
    with (OUT/'map_54_population_colors.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['code','population_2025','fill','class_rank']);w.writeheader();w.writerows(rows)
    missing=set(values)-seen
    log('54 municipalities with expected mapped colors','PASS' if not issues and not missing and len(rows)==54 else 'FAIL',f'rows={len(rows)},missing={sorted(missing)},errors={issues[:8]}')
    if issues or missing:return
    # Monotonic bins: max value in any lighter class <= min value in darker class.
    groups={i:[r['population_2025'] for r in rows if r['class_rank']==i] for i in range(5)}
    inversions=[]
    for i in range(5):
        for j in range(i+1,5):
            if groups[i] and groups[j] and max(groups[i])>min(groups[j]):
                inversions.append({'lighter':i,'darker':j,'max_light':max(groups[i]),'min_dark':min(groups[j])})
    log('color classes monotonic with 2025 population','PASS' if not inversions else 'FAIL',f'class_ranges={[(i,len(v),min(v) if v else None,max(v) if v else None) for i,v in groups.items()]}, inversions={inversions[:8]}')
    # Observed data ranges are NOT CSS/classification thresholds.
    log('exact palette cutoff values independently identified','REVIEW','Observed min/max per class is not the classifier threshold. Inspect the deployed classification implementation before validating boundaries.')

def migration_scope(data):
    cities=data['municipalities'];totals={k:sum(c[k] for c in cities.values()) for k in ('in','out','net')}
    log('54-city population migration arithmetic','PASS' if len(cities)==54 and totals['net']==totals['in']-totals['out'] else 'FAIL',f'54-city totals {totals}')
    evidence={
      'published_official_2025_summary':'https://www.stat.go.jp/data/idou/2025np/jissu/youyaku/index.html',
      'published_official_2025_report':'https://www.stat.go.jp/data/idou/2025np/jissu/pdf/2025all.pdf',
      'official_e_stat_annual_tables':'https://www.e-stat.go.jp/stat-search/files?cycle=7&layout=datalist&month=0&page=1&tclass1=000001148746&toukei=00200523&tstat=000000070001&year=20250',
      'municipal_sum':totals,
      'comparison_constraint':'Municipality inbound/outbound totals include within-prefecture municipal moves; prefecture inter-prefecture inbound/outbound statistics omit these moves. Gross totals must not be compared directly.',
      'pending':'Choose official tabulation with identical nationality, age, location and overseas coverage; obtain official Aichi pref values; verify algebra including intraprefecture moves. Do not label equal until verified.'
    }
    (OUT/'official_scope_review.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
    log('official prefectural gross-count independent comparison','REVIEW','Scope differs from typical official inter-prefectural gross table. Refer to official_scope_review.json; no matching numeric benchmark confirmed.')

def main():
    try:
        history=remote_json('data/historical.json'); migration=remote_json('data/external-statistics/migration_2025_approved.json')
    except Exception as e:log('data download','FAIL',repr(e));history=migration=None
    if migration:
        try:migration_scope(migration)
        except Exception as e:log('migration arithmetic','FAIL',repr(e))
    if history:
        try:map_check(history)
        except Exception as e:log('map examination','FAIL',repr(e))
    with (OUT/'results.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=['check','status','detail']);w.writeheader();w.writerows(CHECKS)
    counts={s:sum(v['status']==s for v in CHECKS) for s in ['PASS','FAIL','REVIEW','SKIP']}
    (OUT/'results.json').write_text(json.dumps({'counts':counts,'checks':CHECKS},ensure_ascii=False,indent=2),encoding='utf-8')
    print('TOTAL',counts)
    return int(bool(counts['FAIL']))

if __name__=='__main__':sys.exit(main())
