#!/usr/bin/env python3
"""Read-only v2.9.18 layout/interaction browser acceptance."""
import csv, os, json
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT=Path('atlas-v2918-results');OUT.mkdir(parents=True,exist_ok=True)
rows=[]
def case(device,name,fn):
    try:
        info=fn(); status='PASS'
    except Exception as e:
        info=f'{type(e).__name__}: {e}';status='FAIL'
    rows.append(dict(device=device,case=name,status=status,detail=str(info)[:700]));print(status,device,name,info,flush=True)
def verify(page,device):
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    page.goto(URL,wait_until='domcontentloaded',timeout=45000)
    page.locator('#v2918-shell').wait_for(state='visible',timeout=18000)
    page.wait_for_timeout(900)
    def structure():
        assert page.locator('#v2918-shell .city-picker #city-select').count()==1
        assert page.locator('#v2918-shell .city-picker #year-select').count()==1
        assert page.locator('#v2918-shell .v2918-controls #indicator-select').count()==1
        assert page.locator('#explore > .city-picker').count()==0
        assert page.locator('#v2918-shell > .workspace > .map-column').count()==1
        assert page.locator('#v2918-shell > .workspace > .info-column').count()==1
        return 'Selectors merged, v2.9.6 map/aside siblings preserved'
    case(device,'Unified controls and map',structure)
    def map_show():
        page.locator('#v2918-shell .v2918-tab[data-v2918-view="map"]').click()
        assert page.locator('#v2918-shell').get_attribute('data-v2918-view')=='map'
        page.locator('#map-view svg').wait_for(state='visible',timeout=12000)
        return 'Map SVG visible in integrated workspace'
    case(device,'Map tab',map_show)
    for mode,panel in [('compare','panel-compare'),('ranking','panel-ranking'),('external','panel-external')]:
        def go(mode=mode,panel=panel):
            button=page.locator(f'.v2918-tab[data-v2918-view="{mode}"]')
            button.click(timeout=8000)
            assert page.locator('#v2918-shell').get_attribute('data-v2918-view')==mode
            page.locator('#'+panel).wait_for(state='visible',timeout=10000)
            return f'{panel} visible'
        case(device,mode+' tab',go)
    def more():
        dropdown=page.locator('#v2918-shell .v2918-more > summary')
        dropdown.click()
        button=page.locator('#v2918-shell .v2918-menu-item[data-v2918-view="report"]')
        button.click(timeout=5000)
        page.locator('#panel-report').wait_for(state='visible',timeout=9000)
        return 'Report navigated with visible additional menu'
    case(device,'Additional report menu',more)
    def width():
        o=page.evaluate('Math.max(0,document.documentElement.scrollWidth-innerWidth)')
        assert o<=2,f'Horizontal overflow {o}px'
        return f'Horizontal overflow: {o}px'
    case(device,'No page horizontal overflow',width)
    def backmap():
        page.locator('#v2918-shell .v2918-tab[data-v2918-view="map"]').click()
        page.locator('#map-view svg').wait_for(state='visible',timeout=9000)
        rect=page.locator('#map-view svg').bounding_box()
        assert rect and rect['width']>200 and rect['height']>150,str(rect)
        return f'Map dimensions: {rect["width"]:.0f}×{rect["height"]:.0f}px'
    case(device,'Map retained after navigation',backmap)
    page.screenshot(path=str(OUT/f'{device}.png'),full_page=True,animations='disabled')
    case(device,'No JS exceptions',lambda: (_ for _ in ()).throw(AssertionError('; '.join(errors))) if errors else 'No page exceptions')
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for device,width,height in [('desktop',1440,900),('mobile',390,844)]:
        context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
        verify(context.new_page(),device)
        context.close()
    browser.close()
with (OUT/'results.csv').open('w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=['device','case','status','detail']);w.writeheader();w.writerows(rows)
(OUT/'summary.json').write_text(json.dumps({'version':'2.9.18','pass':sum(r['status']=='PASS' for r in rows),'fail':sum(r['status']=='FAIL' for r in rows),'rows':len(rows)},ensure_ascii=False,indent=2),encoding='utf-8')
raise SystemExit(1 if any(r['status']=='FAIL' for r in rows) else 0)
