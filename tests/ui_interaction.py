"""Non-destructive browser interaction checks for MIERU AICHI.
Records granular checks and screenshots. Does not mutate deployment or export data.
"""
import csv
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('MIERU_URL', 'https://code4aichi.org/atlas/')
OUT = Path('ui-test-results')
OUT.mkdir(exist_ok=True)
rows = []
errors = []


def record(view, case, status, detail=''):
    rows.append({'viewport':view,'check':case,'status':status,'detail':str(detail)[:900]})


def test(view, name, func):
    try:
        passed, explanation = func()
        record(view, name, 'PASS' if passed else 'FAIL', explanation)
    except Exception as exc:
        record(view, name, 'FAIL', f'{type(exc).__name__}: {exc}')


def value(page, selector):
    return (page.locator(selector).first.text_content(timeout=6000) or '').strip()


def change_city(page):
    sel = page.locator('#city-select')
    options = sel.locator('option').evaluate_all('els => els.filter(e=>e.value && !e.disabled).map(e=>({value:e.value,label:e.textContent.trim()}))')
    if len(options) < 2:
        return False, f'Not enough city options: {len(options)}'
    before_name = value(page, '#selected-name')
    original = sel.input_value()
    chosen = next((o for o in options if o['value'] != original), None)
    if not chosen:
        return False, 'No alternative city'
    sel.select_option(chosen['value'])
    page.wait_for_function('old => document.querySelector("#selected-name")?.textContent.trim() !== old', arg=before_name, timeout=10000)
    after_name = value(page, '#selected-name')
    page.screenshot(path=str(OUT/'interaction_city_changed.png'), full_page=False)
    sel.select_option(original)
    return after_name != before_name, f'{before_name} => {after_name} ({chosen["label"]})'


def change_year(page):
    sel = page.locator('#year-select')
    original = sel.input_value()
    alt = next((x for x in ['2020','2015','2025'] if x != original and sel.locator(f'option[value="{x}"]').count()), None)
    if not alt:
        return False, 'No alternate year'
    sel.select_option(alt)
    page.wait_for_function('year => document.querySelector("#year-select")?.value === year',arg=alt,timeout=5000)
    # Check visible year indicators, not correctness of numerical data
    context = value(page, '#metric-context')
    main_label = value(page, '#primary-metric-label')
    ok = alt in context or alt in main_label
    sel.select_option(original)
    return ok, f'year={alt}, map-context={context[:100]}, primary={main_label[:100]}'


def change_indicator(page):
    sel = page.locator('#indicator-select')
    opts = sel.locator('option').evaluate_all('es => es.filter(e=>e.value && !e.disabled).map(e=>e.value)')
    original = sel.input_value()
    alt = next((x for x in opts if x != original), None)
    if not alt:
        return False, f'Only {len(opts)} indicators'
    before = value(page, '#metric-context')
    sel.select_option(alt)
    page.wait_for_timeout(550)
    after = value(page, '#metric-context')
    active = value(page, '#active-metric-label')
    sel.select_option(original)
    return before != after or bool(active), f'indicator={alt}, before={before[:100]}, after={after[:100]}, active={active[:100]}'


def select_mode(page, mobile, mode):
    if mobile:
        selector = f'#v290-mobile-home [data-v290-mode="{mode}"]'
    else:
        selector = f'#v291-quicknav .v291-quicknav-links [data-mode="{mode}"]'
    button=page.locator(selector).first
    if not button.count() or not button.is_visible():
        raise RuntimeError(f'Visible mode control unavailable: {selector}')
    button.click()
    page.wait_for_function('mode => document.querySelector(`.workspace-nav-button[data-workspace="${mode}"]`)?.classList.contains("is-current")',arg=mode,timeout=9000)


def compare_changes(page,mobile):
    select_mode(page,mobile,'compare')
    page.locator('#panel-compare').wait_for(state='visible',timeout=7000)
    a=page.locator('#compare-a')
    b=page.locator('#compare-b')
    opts=b.locator('option').evaluate_all('els=>els.filter(e=>e.value&&!e.disabled).map(e=>e.value)')
    current=b.input_value()
    other=next((x for x in opts if x!=current and x!=a.input_value()),None)
    if not other:
        return False,'Comparison has no alternative municipality'
    before=value(page,'#comparison')
    b.select_option(other)
    page.wait_for_timeout(800)
    after=value(page,'#comparison')
    page.screenshot(path=str(OUT/'interaction_compare.png'),full_page=False)
    return (before != after and len(after)>8),f'b={other}, changed={before!=after}, summary_chars={len(after)}'


def ranking_changes(page,mobile):
    select_mode(page,mobile,'ranking')
    page.locator('#panel-ranking').wait_for(state='visible',timeout=7000)
    order=page.locator('#ranking-order')
    original=order.input_value()
    new='asc' if original=='desc' else 'desc'
    before=value(page,'#chart')
    order.select_option(new)
    page.wait_for_timeout(800)
    after=value(page,'#chart')
    return before!=after and len(after)>8,f'order {original}->{new}, ranking changed={before!=after}, length={len(after)}'


def external_visible(page,mobile):
    select_mode(page,mobile,'external')
    panel=page.locator('#panel-external')
    panel.wait_for(state='visible',timeout=8000)
    # Data panels have a varying content structure; do not assume buttons exist.
    has_controls = panel.locator('select,button,input').count() > 0
    return has_controls,f'controls={panel.locator("select,button,input").count()}, text_chars={len(panel.inner_text())}'


def map_click(page):
    svg=page.locator('#map-view svg').first
    if not svg.count():
        return False,'SVG not ready'
    # Find real municipality shape with an accessible interaction target.
    shapes=page.locator('#map-view svg path, #map-view svg polygon')
    count=shapes.count()
    if count<2:
        return False,f'Only {count} paths or polygons'
    old=value(page,'#selected-name')
    targets=shapes
    attempts=0
    for i in range(min(targets.count(),18)):
        t=targets.nth(i)
        try:
            box=t.bounding_box()
            if not box or box['width']<3 or box['height']<3:
                continue
            t.click(timeout=1500)
            attempts+=1
            page.wait_for_timeout(130)
            if value(page,'#selected-name') != old:
                return True,f'{old}->{value(page,"#selected-name")}, tried={attempts}'
        except Exception:
            continue
    return False,f'map has {count} shapes; selection not changed in {attempts} click attempts (selector/interaction may differ)'


def check_mobile_actions(page):
    a=page.locator('#v290-mobile-home')
    if not a.count() or not a.is_visible():
        return False,'Mobile home unavailable'
    nav=page.locator('#v298-back-actions')
    return nav.count()>0 and nav.is_visible(),f'back actions visible={nav.is_visible() if nav.count() else False}'


def run(page,label,mobile):
    page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=25000)
    page.wait_for_timeout(1800)
    test(label,'city selection changes detail',lambda:change_city(page))
    test(label,'year selection updates context',lambda:change_year(page))
    test(label,'indicator selection updates map context',lambda:change_indicator(page))
    # The production SVG might have very different interaction markup.
    test(label,'map shape selects another city',lambda:map_click(page))
    test(label,'compare selection changes values',lambda:compare_changes(page,mobile))
    test(label,'ranking order changes displayed result',lambda:ranking_changes(page,mobile))
    test(label,'external statistics controls rendered',lambda:external_visible(page,mobile))
    if mobile:
        test(label,'mobile navigation actions present',lambda:check_mobile_actions(page))
    page.screenshot(path=str(OUT/f'{label}_interaction_final.png'),full_page=True,animations='disabled')


with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    for width,height in [(1440,900),(390,844)]:
        label=f'{width}x{height}'
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        page.on('pageerror',lambda err,label=label:errors.append({'viewport':label,'error':str(err)}))
        try:
            run(page,label,width<800)
        except Exception as exc:
            record(label,'test harness initialization','FAIL',repr(exc))
        finally:
            page.close()
    browser.close()

with (OUT/'interaction-results.csv').open('w',encoding='utf-8-sig',newline='') as fp:
    writer=csv.DictWriter(fp,fieldnames=['viewport','check','status','detail'])
    writer.writeheader();writer.writerows(rows)
(OUT/'interaction-errors.json').write_text(json.dumps(errors,ensure_ascii=False,indent=2),encoding='utf-8')
fail=sum(r['status']=='FAIL' for r in rows)
print(f'Interaction checks: {len(rows)-fail} PASS / {fail} FAIL; exceptions={len(errors)}')
for r in rows:
    if r['status']=='FAIL':
        print('FAIL',r['viewport'],r['check'],r['detail'])
if fail or errors:
    raise SystemExit(1)
