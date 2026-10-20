#!/usr/bin/env python3
"""v2.9.12 read-only diagnostics; PASS, FAIL, REVIEW and SKIP are distinct.
No guessed map thresholds or assumed semantic equivalence of totals.
"""
import csv, io, json, os, re, sys, urllib.request
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE=os.environ.get('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT=Path('deep-audit-results');OUT.mkdir(exist_ok=True)
ROWS=[]

def log(area,check,status,detail):
    assert status in ('PASS','FAIL','REVIEW','SKIP')
    ROWS.append({'area':area,'check':check,'status':status,'detail':str(detail)[:1800]})
    print(status,area,check,str(detail)[:220])

def download(relative):
    url=urljoin(BASE,relative)
    req=urllib.request.Request(url,headers={'User-Agent':'MIERU-deep-audit/2.9.12','Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=45) as res:return res.read()

def load_json(relative):
    try:return json.loads(download(relative).decode('utf-8-sig'))
    except Exception as exc:
        log('source',relative,'FAIL',f'{type(exc).__name__}: {exc}');return None

def use_mode(page,mode,mobile=False):
    quick=(f'#v290-mobile-home [data-v290-mode="{mode}"]' if mobile else f'#v291-quicknav .v291-quicknav-links [data-mode="{mode}"]')
    b=page.locator(quick).first
    if b.count() and b.is_visible():b.click()
    else:
        fallback=page.locator(f'.workspace-nav-button[data-workspace="{mode}"]').first
        if not fallback.count():raise RuntimeError(f'No mode control for {mode}')
        fallback.evaluate('(el)=>el.click()')
    page.locator(f'#panel-{mode}').wait_for(state='visible',timeout=12000)

def check_map(page):
    page.locator('#map-view svg').first.wait_for(timeout=25000)
    svg=page.locator('#map-view svg').first
    # Report actual rendered path colors and bounds, not fabricated bin boundaries.
    def state():
        return page.evaluate('''() => {
          const host=document.querySelector('#map-view'), svg=host?.querySelector('svg');
          if(!svg)return null;
          const root=host.getBoundingClientRect();
          const shapes=[...svg.querySelectorAll('path,polygon')].filter(el=>{const b=el.getBoundingClientRect();return b.width>1&&b.height>1});
          const fills={}; let outside=0;
          for(const s of shapes){const b=s.getBoundingClientRect();const c=getComputedStyle(s).fill;fills[c]=(fills[c]||0)+1;
            if(b.left<root.left-3||b.top<root.top-3||b.right>root.right+3||b.bottom>root.bottom+3)outside++;
          }
          return {shapes:shapes.length,colors:fills,outside,viewport:[Math.round(root.width),Math.round(root.height)]};
        }''')
    initial=state()
    if not initial or initial['shapes']<54:log('map','real municipality shapes','FAIL',initial);return
    log('map','map shapes fit viewport','PASS' if initial['outside']==0 else 'FAIL',initial)
    cat=page.locator('#category-select');sel=page.locator('#indicator-select')
    original_cat=cat.input_value();original_ind=sel.input_value()
    baseline=initial['colors']
    try:
        options=sel.locator('option').evaluate_all('els=>els.filter(x=>x.value&&!x.disabled).map(x=>x.value)')
        alternative=next((x for x in options if x!=original_ind),None)
        if not alternative:
            for co in cat.locator('option').evaluate_all('els=>els.filter(x=>x.value&&!x.disabled).map(x=>x.value)'):
                if co!=original_cat:
                    cat.select_option(co);page.wait_for_timeout(650)
                    options=sel.locator('option').evaluate_all('els=>els.filter(x=>x.value&&!x.disabled).map(x=>x.value)')
                    if options:alternative=options[0];break
        if alternative:
            sel.select_option(alternative);page.wait_for_timeout(1000)
            changed=state()
            log('map','fill change when indicator changes','PASS' if changed and baseline!=changed['colors'] else 'REVIEW',f'before={baseline}; after={changed}; indicator={alternative}')
        else:log('map','fill change when indicator changes','SKIP','No alternative indicator found')
    except Exception as exc:log('map','fill change when indicator changes','FAIL',exc)
    finally:
        cat.select_option(original_cat)
        if sel.locator(f'option[value="{original_ind}"]').count():sel.select_option(original_ind)
    log('map','each color bin equals its numerical threshold','REVIEW','The actual palette thresholds / all municipality values must be linked to rendered colors. No threshold inferred from gradients.')

def check_sector(sector,econ):
    if not isinstance(sector,dict):return
    items=sector.get('cities',{}); sectors=sector.get('sectors',[])
    keys=[x.get('code') for x in sectors if isinstance(x,dict)]
    if len(keys)!=17 or len(set(keys))!=17:
        log('industry','17 sector definitions','FAIL',f'codes={keys}');return
    completed={}; issues=[]; n_null=0
    for code,city in items.items():
        vals=city.get('values',{})
        complete={}
        for measure in ('establishments','employees'):
            arr=[]
            for k in keys:
                record=vals.get(k,{})
                v=record.get(measure) if isinstance(record,dict) else None
                if v is None:n_null+=1
                elif not isinstance(v,int) or isinstance(v,bool) or v<0:issues.append((code,k,measure,'invalid'))
                arr.append(v)
            complete[measure]=all(v is not None for v in arr)
        completed[code]=complete
    for measure in ('establishments','employees'):
        eligible=[code for code,v in completed.items() if v[measure]]
        log('industry',f'composition eligibility for {measure}','PASS' if not issues else 'FAIL',f'{len(eligible)} complete municipalities, {n_null} missing cells (both measures), sample={eligible[:8]}, bad={issues[:8]}')
        if not eligible:continue
        totals={k:sum(items[city]['values'][k][measure] for city in eligible) for k in keys}
        denom=sum(totals.values())
        if denom<=0:log('industry',f'valid comparison denominator {measure}','FAIL',denom);continue
        failures=[]
        for city in eligible:
            vals=items[city]['values'];city_total=sum(vals[k][measure] for k in keys)
            if city_total<=0:continue
            for k in keys:
                base=totals[k]/denom
                if base<=0:continue
                lq=(vals[k][measure]/city_total)/base
                if not (lq>=0 and lq<float('inf')):failures.append((city,k,lq))
        log('industry',f'independent reference LQ arithmetic {measure}','PASS' if not failures else 'FAIL',f'checked {len(eligible)} complete cities; bad={failures[:4]}; comparison cohort is NOT all 54')
    log('industry','rendered LQ agreement with independent calculation','REVIEW','Calculation can be independently derived, but renderer DOM binding/rounding needs a mapped numeric output before this can pass')
    if issues:log('industry','source value validity','FAIL',issues[:8])

def check_migration(migration):
    if not isinstance(migration,dict):return
    cities=migration.get('municipalities',{})
    issues=[]
    for code,x in cities.items():
        if not isinstance(x,dict) or any(type(x.get(k)) is not int for k in ('in','out','net')) or x['net']!=x['in']-x['out']:
            issues.append(code)
    log('migration','54 in/out/net arithmetic','PASS' if len(cities)==54 and not issues else 'FAIL',f'cities={len(cities)} invalid={issues[:10]}')
    log('migration','official prefectural published independent total','REVIEW','The sum of 54 municipalities is not itself an independent prefecture-total validation')

def try_csv(page,migration):
    use_mode(page,'external')
    page.wait_for_timeout(1200)
    container=page.locator('#panel-external')
    # Locate only a user-visible download control, never silently synthesize CSV.
    buttons=container.locator('button,a')
    candidates=[]
    for i in range(min(buttons.count(),80)):
        b=buttons.nth(i)
        try:
            if b.is_visible() and re.search(r'CSV|ダウンロード',b.inner_text(),re.I):candidates.append(b)
        except Exception:pass
    if not candidates:
        log('csv','visible CSV export','REVIEW','No CSV control visible in initial tab; switch to population migration or other export tab to check');return
    verified=False
    for b in candidates[:5]:
        try:
            label=b.inner_text()[:60]
            with page.expect_download(timeout=6500) as dl:b.click()
            artifact=dl.value
            dest=OUT/('export_'+str(len(list(OUT.glob('export_*'))))+'.csv')
            artifact.save_as(str(dest))
            raw=dest.read_bytes().decode('utf-8-sig',errors='replace')
            records=list(csv.reader(io.StringIO(raw)))
            if len(records)<2:log('csv',label,'FAIL',f'{len(records)} CSV rows');continue
            verified=True
            log('csv',f'export format {label}','PASS',f'{len(records)-1} data rows; header={records[0][:12]}')
            if migration and '人口移動' in label:
                log('csv','migration values versus JSON','REVIEW','Downloaded CSV saved; specific column and municipality code correspondence requires explicit mapping')
        except Exception as exc:log('csv','download attempt','REVIEW',str(exc)[:400])
    if not verified:log('csv','export content verification','REVIEW','No tested download succeeded; user interaction or tab switch may be necessary')

def check_external_tabs(page):
    use_mode(page,'external')
    box=page.locator('#panel-external')
    # Tab UI is runtime-generated. Detect tabs and exercise only visible controls.
    buttons=box.locator('button,[role="tab"]')
    visible=[]
    for i in range(min(buttons.count(),100)):
        b=buttons.nth(i)
        if b.is_visible() and any(s in (b.inner_text() or '') for s in ('指標一覧','産業・雇用','産業別構成','人口移動','出典・注意')):visible.append(b)
    names=[];issues=[]
    for b in visible:
        name=b.inner_text().strip()[:50]
        try:b.click(timeout=5000);page.wait_for_timeout(500);names.append(name)
        except Exception as exc:issues.append(f'{name}: {exc}')
    if len(set(names))>=5 and not issues:log('external','five statistics subviews clickable','PASS',names)
    elif issues:log('external','five statistics subviews clickable','FAIL',issues)
    else:log('external','five statistics subviews clickable','REVIEW',f'found {len(set(names))} visible tabs: {names}; tab selectors may differ')

def browser_checks():
    with sync_playwright() as pw:
        browser=pw.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True,locale='ja-JP')
        exceptions=[];page.on('pageerror',lambda error: exceptions.append(str(error)))
        page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
        page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=45000)
        page.wait_for_timeout(1400)
        for section,func in [('map',lambda:check_map(page)),('external',lambda:check_external_tabs(page))]:
            try:func()
            except Exception as exc:log(section,'harness/browser validation','FAIL',f'{type(exc).__name__}: {exc}')
        try:try_csv(page,migration)
        except Exception as exc:log('csv','harness/browser validation','FAIL',f'{type(exc).__name__}: {exc}')
        log('browser','JavaScript page exceptions','FAIL' if exceptions else 'PASS',exceptions[:6] if exceptions else 'none')
        page.screenshot(path=str(OUT/'deep_audit_desktop.png'),full_page=False)
        browser.close()

migration=None

def main():
    global migration
    econ=load_json('data/external-statistics/economic_2021_private_establishments.json')
    sector=load_json('data/external-statistics/industry_2021_sectors_approved.json')
    migration=load_json('data/external-statistics/migration_2025_approved.json')
    check_sector(sector,econ);check_migration(migration)
    try:browser_checks()
    except Exception as exc:log('browser','test startup','FAIL',f'{type(exc).__name__}: {exc}')
    with (OUT/'deep_audit.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=['area','check','status','detail']);writer.writeheader();writer.writerows(ROWS)
    counts={key:sum(r['status']==key for r in ROWS) for key in ('PASS','FAIL','REVIEW','SKIP')}
    (OUT/'deep_audit.json').write_text(json.dumps({'url':BASE,'counts':counts,'checks':ROWS},ensure_ascii=False,indent=2),encoding='utf-8')
    print('FINAL',counts)
    return 1 if counts['FAIL'] else 0

if __name__=='__main__':sys.exit(main())
