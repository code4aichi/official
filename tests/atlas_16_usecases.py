#!/usr/bin/env python3
"""MIERU AICHI v2.9.16, 16 read-only end-user acceptance scenarios.
PASS means the asserted observable behavior passed; REVIEW/SKIP are not PASS.
No external generative AI requests, production changes, or artificial JS clicks.
"""
import csv, io, json, os, sys, traceback, urllib.request
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

URL=os.environ.get('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT=Path('atlas-acceptance-results');OUT.mkdir(parents=True,exist_ok=True)
ROWS=[]; ERRORS=[]

class Review(Exception):pass

def case(number,viewport,title,fn):
    try:
        detail=fn()
        if detail is False:raise AssertionError('Assertion returned false')
        status='PASS'
    except Review as exc:status='REVIEW';detail=str(exc)
    except Exception as exc:status='FAIL';detail=f'{type(exc).__name__}: {exc}'
    ROWS.append(dict(id=f'UC{number:02}',viewport=viewport,scenario=title,status=status,detail=str(detail)[:1600]))
    print(f'{status:6} UC{number:02} {viewport}: {title}: {str(detail)[:150]}',flush=True)

def text(page,selector):return page.locator(selector).first.inner_text(timeout=10000).strip()
def opts(select):return select.locator('option').evaluate_all('es=>es.filter(x=>x.value&&!x.disabled).map(x=>({value:x.value,name:x.textContent.trim()}))')
def city(page):
    sel=page.locator('#city-select'); options=opts(sel); before=text(page,'#selected-name'); initial=sel.input_value()
    new=next(x for x in options if x['value']!=initial);sel.select_option(new['value'])
    page.wait_for_function('old=>document.querySelector("#selected-name")?.textContent.trim()!==old',arg=before,timeout=12000)
    after=text(page,'#selected-name');assert after!=before
    return f'{before} → {after}'

def mode(page,name,mobile=False):
    # Explicitly require a real clickable control; do not dispatch synthetic events.
    selectors=([f'#v290-mobile-home [data-v290-mode="{name}"]'] if mobile else [f'#v291-quicknav .v291-quicknav-links [data-mode="{name}"]'])
    selectors += [f'.workspace-nav-button[data-workspace="{name}"]']
    attempted=[]
    for selector in selectors:
        btn=page.locator(selector).first
        if not btn.count() or not btn.is_visible():continue
        try:
            btn.click(timeout=3500)
            page.locator(f'#panel-{name}').wait_for(state='visible',timeout=9000)
            return selector
        except Exception as exc:attempted.append(f'{selector}: {str(exc)[:100]}')
    # Existing legacy report/AI buttons are obscured: this is manual pointer-accessibility review.
    raise Review(f'No pointer-accessible navigation to {name}; {attempted[:2]}')

def year(page):
    sel=page.locator('#year-select');old=sel.input_value();choice=next((x for x in opts(sel) if x['value']!=old),None)
    assert choice,'No alternate year';sel.select_option(choice['value'])
    page.wait_for_timeout(500); ctx=text(page,'#metric-context')+' '+text(page,'#primary-metric-label')
    assert choice['value'] in ctx, f'Year not visible in metric context: {ctx[:200]}'
    return f'year={choice["value"]}, context={ctx[:140]}'

def metric(page):
    sel=page.locator('#indicator-select');old=sel.input_value();new=next(x for x in opts(sel) if x['value']!=old)
    before=text(page,'#metric-context');sel.select_option(new['value']);page.wait_for_timeout(500)
    after=text(page,'#metric-context');assert after!=before,(before,after)
    return f'indicator={new["value"]}; context updated'

def map_view(page):
    shapes=page.locator('#map-view svg path,#map-view svg polygon');n=shapes.count()
    assert n>=54,f'Only {n} SVG shapes'
    return f'{n} map shapes found'

def map_select(page):
    before=text(page,'#selected-name'); shapes=page.locator('#map-view svg path,#map-view svg polygon')
    for i in range(min(shapes.count(),45)):
        shape=shapes.nth(i)
        try:
            box=shape.bounding_box()
            if not box or box['width']<3 or box['height']<3:continue
            shape.click(timeout=1200);page.wait_for_timeout(140)
            after=text(page,'#selected-name')
            if after!=before:return f'{before} → {after}'
        except Exception:continue
    raise AssertionError('No map shape changed selected municipality')

def comparison(page,mobile=False):
    mode(page,'compare',mobile)
    a=page.locator('#compare-a');b=page.locator('#compare-b')
    before=text(page,'#comparison');other=next(x for x in opts(b) if x['value'] not in (a.input_value(),b.input_value()))
    b.select_option(other['value']);page.wait_for_timeout(850);after=text(page,'#comparison')
    assert len(after)>20 and after!=before,'Comparison output did not update'
    return f'compared with {other["name"]}'

def ranking(page,mobile=False):
    mode(page,'ranking',mobile);sel=page.locator('#ranking-order');before=text(page,'#chart')
    sel.select_option('asc' if sel.input_value()=='desc' else 'desc');page.wait_for_timeout(850)
    after=text(page,'#chart');assert len(after)>20 and before!=after,'Ranking unchanged'
    return 'Sort order changes ranking output'

def tab(page,title):
    panel=page.locator('#panel-external');buttons=panel.locator('button,[role="tab"]')
    for i in range(min(150,buttons.count())):
        el=buttons.nth(i)
        if el.is_visible() and title in (el.inner_text() or ''):
            el.click();page.wait_for_timeout(550);return
    raise Review(f'{title} tab not found with known selectors')

def external(page):
    mode(page,'external');panel=page.locator('#panel-external')
    btn=panel.locator('button,[role="tab"]');names=[]
    for i in range(min(btn.count(),150)):
        b=btn.nth(i)
        if b.is_visible() and b.inner_text().strip():names.append(b.inner_text().strip())
    assert len(set(names))>=5,f'Only {len(set(names))} buttons/tabs visible'
    return f'visible controls={len(set(names))}'

def migration(page):
    mode(page,'external');tab(page,'人口移動')
    host=page.locator('#migration-2025');host.wait_for(state='visible',timeout=12000)
    return f'population movement view shown, {len(host.inner_text())} chars'

def migration_csv(page):
    mode(page,'external');tab(page,'人口移動')
    with page.expect_download(timeout=20000) as task:page.locator('#migration-2025 .migration-download').first.click()
    dl=task.value;path=OUT/'migration_2025_export.csv';dl.save_as(str(path))
    data=list(csv.reader(io.StringIO(path.read_bytes().decode('utf-8-sig'))))
    assert len(data)==55,f'CSV contains {len(data)-1} data rows'
    assert data[0]==['自治体コード','自治体名','転入者数','転出者数','転入超過数'],data[0]
    codes=[r[0] for r in data[1:]]
    assert len(set(codes))==54 and all(len(r)==5 for r in data[1:])
    assert all(int(r[2])-int(r[3])==int(r[4]) for r in data[1:]),'Net migration arithmetic mismatch'
    # A downloaded file is not necessarily official-reference validated.
    return f'CSV 54 unique rows, all row net values consistent; file={dl.suggested_filename}'

def industry(page):
    mode(page,'external');tab(page,'産業別構成')
    host=page.locator('#industry-insights');host.locator('.industry-insights-controls select').first.wait_for(state='visible',timeout=15000)
    lines=host.locator('.industry-insights-line').count();assert lines>0 or host.locator('.industry-insights-alert').count()>0
    return f'industry rows={lines}; complete numerical matching covered by previous v2.9.13 test'

def report(page):
    mode(page,'report');select_a=page.locator('#report-a');select_b=page.locator('#report-b')
    a=opts(select_a)[0];b=next(x for x in opts(select_b) if x['value']!=a['value'])
    select_a.select_option(a['value']);select_b.select_option(b['value']);page.wait_for_timeout(800)
    content=text(page,'#report-table')+' '+text(page,'#report-subtitle')
    assert a['name'] in content and b['name'] in content and len(content)>100
    return f'{a["name"]} and {b["name"]} in report'

def report_json(page):
    mode(page,'report');a=page.locator('#report-a');b=page.locator('#report-b')
    cities=[]
    for sel in (a,b):
        candidate=next(x for x in opts(sel) if x['value'] not in [z['value'] for z in cities])
        sel.select_option(candidate['value']);cities.append(candidate)
    with page.expect_download(timeout=20000) as task:page.locator('#report-json').click()
    path=OUT/'report_export.json';task.value.save_as(str(path))
    payload=json.loads(path.read_text(encoding='utf-8-sig'));serialized=json.dumps(payload,ensure_ascii=False)
    assert len(serialized)>100 and all(any(term in serialized for term in [x['value'],x['name']]) for x in cities)
    return f'JSON valid, selected cities={[x["name"] for x in cities]}'

def ai(page):
    mode(page,'ai-nav')
    page.locator('#ai-nav-input').fill('岡崎市の単身世帯率は？');page.locator('#ai-nav-submit').click()
    page.wait_for_function('()=>document.querySelector("#ai-nav-result")?.innerText.trim().length>20',timeout=22000)
    result=text(page,'#ai-nav-result');assert '岡崎' in result
    return 'Navigator answered for 岡崎市; numerical accuracy remains separate official-source review'

def mobile_home(page):
    assert page.locator('#v290-mobile-home').is_visible()
    assert page.locator('#v298-back-actions').count()>0
    return 'Mobile home and back navigation controls found'

def overflow(page):
    width=page.evaluate('document.documentElement.scrollWidth-window.innerWidth');assert width<=2,f'horizontal overflow {width}px'
    return f'horizontal overflow={width}px'

def page_new(browser,w,h):
    ctx=browser.new_context(viewport={'width':w,'height':h},accept_downloads=True,locale='ja-JP')
    page=ctx.new_page();page.set_default_timeout(12000)
    page.on('pageerror',lambda err:ERRORS.append({'viewport':f'{w}x{h}','error':str(err)}))
    page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=30000)
    page.wait_for_timeout(1300)
    return ctx,page

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        ctx,page=page_new(browser,1440,900)
        pc=[(1,'Choose another municipality',city),(2,'Change census year',year),(3,'Change map indicator',metric),(4,'View municipality map',map_view),(5,'Select municipality on map',map_select),(6,'Compare two municipalities',comparison),(7,'Switch ranking sort order',ranking),(8,'Browse external statistical tabs',external),(9,'Open 2025 migration statistics',migration),(10,'Download migration CSV',migration_csv),(11,'Explore industry composition',industry),(12,'Generate and export municipal report',lambda q:(report(q),report_json(q)))]
        for idx,name,fn in pc:
            case(idx,'desktop 1440x900',name,lambda fn=fn:fn(page))
            try:page.screenshot(path=str(OUT/f'UC{idx:02}_desktop.png'),full_page=False,animations='disabled')
            except Exception:pass
        ctx.close()
        ctx,mobile=page_new(browser,390,844)
        mobile_cases=[(13,'Reach mobile home and navigation',mobile_home),(14,'Select a municipality on mobile',city),(15,'Compare cities on mobile',lambda q:comparison(q,True)),(16,'Use AI navigator on mobile',lambda q:(ai(q),overflow(q)))]
        for idx,name,fn in mobile_cases:
            case(idx,'mobile 390x844',name,lambda fn=fn:fn(mobile))
            try:mobile.screenshot(path=str(OUT/f'UC{idx:02}_mobile.png'),full_page=False,animations='disabled')
            except Exception:pass
        ctx.close();browser.close()
    (OUT/'browser_errors.json').write_text(json.dumps(ERRORS,ensure_ascii=False,indent=2),encoding='utf-8')
    with (OUT/'usecases.csv').open('w',encoding='utf-8-sig',newline='') as fp:
        writer=csv.DictWriter(fp,fieldnames=['id','viewport','scenario','status','detail']);writer.writeheader();writer.writerows(ROWS)
    counts={s:sum(r['status']==s for r in ROWS) for s in ('PASS','FAIL','REVIEW','SKIP')}
    report={'version':'2.9.16','target':URL,'total':len(ROWS),'counts':counts,'javascript_exceptions':len(ERRORS),'release_rule':'16 PASS, 0 FAIL, 0 REVIEW, 0 JS exceptions; separate source-level concerns remain','release_decision':'PASS' if counts['PASS']==16 and not ERRORS else 'HOLD'}
    (OUT/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'unresolved_quality_checks.md').write_text('''# 別途検証が必要な品質項目\n\n- 地図の色階級の正確な境界値と描画コードの独立照合\n- 2025年人口移動データの公表集計定義と公式県計の比較\n- レポート・AI回答の各数値と公式統計原表の完全照合\n- PDF印刷・保存結果の目視確認と日本語フォント・改ページ\n- 外部生成AIサービスの応答、費用、個人情報取扱い（デフォルトでは実行しない）\n- 実ユーザーの操作感や可読性・アクセシビリティ評価\n\nこれらは16ケースがPASSでも自動的に合格にはなりません。\n''',encoding='utf-8')
    print('SUMMARY',report,flush=True)
    return 1 if counts['FAIL'] or ERRORS else 0

if __name__=='__main__':sys.exit(main())
