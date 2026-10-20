"""v2.9.19 UI-only acceptance; MIERU_URL points to the published atlas page."""
import csv
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL=os.getenv('MIERU_URL','https://code4aichi.org/atlas/')
OUT=Path('v2919-results'); OUT.mkdir(exist_ok=True)
rows=[]

def check(name, fn):
    try:
        detail=fn() or 'OK'
        rows.append([name,'PASS',str(detail)])
    except Exception as exc:
        rows.append([name,'FAIL',str(exc)[:600]])

def assert_true(condition, message):
    if not condition: raise AssertionError(message)

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    for profile,width,height in [('desktop',1440,900),('mobile',390,844)]:
        context=browser.new_context(viewport={'width':width,'height':height}, device_scale_factor=1)
        page=context.new_page(); exceptions=[]
        page.on('pageerror',lambda error: exceptions.append(str(error)))
        page.goto(URL,wait_until='domcontentloaded',timeout=45000)
        page.locator('#v2918-shell.v2919-ready').wait_for(timeout=25000)
        def controls():
            return page.evaluate('''() => {
              const ids=['city-select','year-select','category-select','indicator-select'];
              const rects=ids.map(id=>document.getElementById(id).getBoundingClientRect());
              return rects.map(r=>({height:r.height,width:r.width,top:r.top,bottom:r.bottom}));
            }''')
        def filter_case():
            result=controls()
            assert_true(all(r['width']>70 and abs(r['height']-44)<3 for r in result),f'filter heights/widths {result}')
            if profile=='desktop':
                assert_true(max(r['top'] for r in result)-min(r['top'] for r in result)<5,f'unaligned tops {result}')
            return result
        check(profile+'_filters',filter_case)
        def tab(view):
            page.locator('#v2918-shell .v2918-tab[data-v2918-view="'+view+'"]').click()
            assert_true(page.locator('#v2918-shell').get_attribute('data-v2918-view')==view,'tab not selected')
            assert_true(page.locator('#v2918-shell').is_visible(),'shell hidden')
            page.screenshot(path=str(OUT/(profile+'_'+view+'.png')),full_page=False)
        for view in ['map','basic','compare','ranking','external']:
            check(profile+'_'+view,lambda view=view:tab(view))
        def basic_reference():
            tab('basic')
            assert_true(page.locator('.v2919-basic-reference').is_visible(),'reference info not visible')
            assert_true(page.locator('.v2919-basic-reference .v2919-reference-map svg').count()>0,'reference map not ready')
        check(profile+'_basic_reference',basic_reference)
        def no_overflow():
            return page.evaluate('''() => ({scroll:document.documentElement.scrollWidth, viewport:innerWidth})''')
        check(profile+'_no_horizontal_overflow',lambda:assert_true((lambda a:a['scroll']<=a['viewport']+4)(no_overflow()),str(no_overflow())))
        check(profile+'_js_errors',lambda:assert_true(len(exceptions)==0,str(exceptions)))
        context.close()
    browser.close()
with (OUT/'results.csv').open('w',newline='',encoding='utf-8-sig') as f:
    writer=csv.writer(f); writer.writerow(['check','status','detail']);writer.writerows(rows)
print('\n'.join(f'{name}: {status} - {detail}' for name,status,detail in rows))
if any(status=='FAIL' for _,status,_ in rows):raise SystemExit(1)
