"""Read-only v2.9.19.2 acceptance tests: live map in both Map and Basic tabs."""
import csv
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('MIERU_URL', 'https://code4aichi.org/atlas/')
OUT = Path('artifacts/v29192')
OUT.mkdir(parents=True, exist_ok=True)
results = []


def check(label, condition, detail=''):
    results.append((label, 'PASS' if condition else 'FAIL', str(detail)))


def test_view(browser, label, width, height):
    page = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1)
    exceptions = []
    page.on('pageerror', lambda e: exceptions.append(str(e)))
    try:
        page.goto(URL, wait_until='domcontentloaded', timeout=60000)
        page.locator('#v2918-shell.v29192-ready').wait_for(timeout=30000)
        page.locator('#map-view svg').wait_for(timeout=45000)
        map_svg = page.locator('#map-view svg')
        original_svg = page.evaluate('document.querySelector("#map-view svg")')
        tabs = page.locator('#v2918-shell .v2918-tab')
        tabs.filter(has_text='基本情報').click(timeout=10000)
        page.wait_for_timeout(750)
        check(label + ' basic mode', page.locator('#v2918-shell').get_attribute('data-v2918-view') == 'basic')
        check(label + ' map and detail visible', page.locator('.map-column').is_visible() and page.locator('.info-column .detail').is_visible())
        check(label + ' same map SVG', page.evaluate('document.querySelectorAll("#map-view svg").length===1'))
        check(label + ' no duplicate miniature map', not page.locator('.v2919-basic-reference').is_visible())
        map_bounds = page.locator('#map-view').bounding_box()
        detail_bounds = page.locator('.info-column .detail').bounding_box()
        if map_bounds and detail_bounds:
            check(label + ' substantial map', map_bounds['width'] >= (290 if width >= 901 else min(width * .65, 250)), round(map_bounds['width']))
            if width >= 901:
                check(label + ' map on left', map_bounds['x'] + map_bounds['width'] <= detail_bounds['x'] + 24, (map_bounds,detail_bounds))
            else:
                check(label + ' map above info', map_bounds['y'] < detail_bounds['y'])
        # Original map and its pointer-based municipality selection remain live.
        shapes = page.locator('#map-view svg path, #map-view svg polygon')
        check(label + ' geographic shapes', shapes.count() >= 54, shapes.count())
        selects = page.locator('#v2918-shell .v2918-controls select')
        heights = [round(selects.nth(i).bounding_box()['height']) for i in range(min(selects.count(),4))]
        check(label + ' uniform controls', len(heights) == 4 and max(heights)-min(heights) <= 1, heights)
        check(label + ' no page horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'))
        page.screenshot(path=str(OUT/(label+'_basic.png')), full_page=True)
        tabs.filter(has_text='地図').click(timeout=10000)
        page.wait_for_timeout(300)
        check(label + ' map tab restored', page.locator('#v2918-shell').get_attribute('data-v2918-view') == 'map' and page.locator('.map-column').is_visible())
        page.screenshot(path=str(OUT/(label+'_map.png')), full_page=True)
        check(label + ' no JS exceptions', not exceptions, ' | '.join(exceptions[:3]))
    except Exception as exc:
        check(label + ' test execution', False, repr(exc))
        try:
            page.screenshot(path=str(OUT/(label+'_error.png')), full_page=True)
        except Exception:
            pass
    finally:
        page.close()


with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    for label, width, height in [('desktop',1440,900),('tablet',820,900),('mobile',390,844)]:
        test_view(browser,label,width,height)
    browser.close()
with (OUT/'results.csv').open('w',encoding='utf-8-sig',newline='') as f:
    writer=csv.writer(f);writer.writerow(['test','status','detail']);writer.writerows(results)
passed=sum(row[1]=='PASS' for row in results)
failed=len(results)-passed
print(f'v2.9.19.2: PASS={passed}, FAIL={failed}')
for name,status,detail in results:
    print(status,name,detail[:150] if detail else '')
if failed: raise SystemExit(1)
