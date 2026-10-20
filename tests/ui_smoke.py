"""MIERU AICHI browser acceptance smoke test. Read-only; no publishing."""
import csv
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('MIERU_URL', 'https://code4aichi.org/atlas/')
OUTPUT = Path('ui-test-results')
OUTPUT.mkdir(exist_ok=True)
checks = []
console_errors = []


def check(viewport, name, ok, detail=''):
    checks.append(dict(viewport=viewport, check=name, status='PASS' if ok else 'FAIL', detail=detail))


def safe_test(viewport, name, fn):
    try:
        result, detail = fn()
        check(viewport, name, bool(result), str(detail))
    except Exception as exc:
        check(viewport, name, False, f'{type(exc).__name__}: {exc}')


def visible(page, selector):
    return page.locator(selector).first.is_visible(timeout=4000)


def inspect(page, label, mobile):
    page.goto(URL, wait_until='domcontentloaded', timeout=60000)
    page.wait_for_timeout(2500)
    safe_test(label, 'site loaded', lambda: (page.locator('#city-select').count() == 1, page.title()))
    safe_test(label, 'no horizontal page overflow', lambda: (
        page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2'),
        str(page.evaluate('({doc:document.documentElement.scrollWidth, viewport:innerWidth})'))))
    safe_test(label, 'map panel exists', lambda: (visible(page, '#map-view'), 'map container'))
    safe_test(label, 'city picker usable', lambda: (visible(page, '#city-select') and page.locator('#city-select').is_enabled(), 'city picker'))
    safe_test(label, 'year and indicator selectors', lambda: (
        all(visible(page, x) for x in ['#year-select','#indicator-select']), 'year and indicator selectors'))
    if not mobile:
        safe_test(label, 'map/info panels aligned', lambda: (
            page.evaluate('''() => {const a=document.querySelector('#explore .map-column')?.getBoundingClientRect();
                const b=document.querySelector('#explore .info-column')?.getBoundingClientRect();
                return !!a&&!!b&&Math.abs(a.bottom-b.bottom)<=5}'''), 'bottom difference <= 5px'))
    else:
        safe_test(label, 'mobile map follows summary flow', lambda: (
            page.evaluate('''() => {const s=document.querySelector('#v290-mobile-home');const m=document.querySelector('#explore .map-column');
                return !!s && !!m && s.getBoundingClientRect().top < m.getBoundingClientRect().top}'''),
            'summary before map'))
        safe_test(label, 'mobile back-to-map navigation', lambda: (visible(page, '#v298-back-actions'), 'back actions'))
    safe_test(label, 'map SVG not visibly clipped', lambda: (
        page.evaluate('''() => { const s=document.querySelector('#map-view svg'); if(!s) return false;
          const r=s.getBoundingClientRect(), p=document.querySelector('#map-view').getBoundingClientRect();
          return r.width>0 && r.height>0 && r.left>=p.left-4 && r.right<=p.right+4 && r.top>=p.top-4 && r.bottom<=p.bottom+4;}'''),
        'SVG inside map viewport (bounding rectangle only; geographic clipping needs visual review)'))
    for mode, target in [('city', '#city-pane-overview'),('compare', '#panel-compare'),('ranking','#panel-ranking'),('external','#panel-external')]:
        def run_mode(mode=mode, target=target):
            # Click the actual visible control, rather than force-clicking the hidden
            # legacy .workspace-nav-button. v2.9+ routes both controls to that source.
            if mobile:
                selector=f'#v290-mobile-home [data-v290-mode="{mode}"]'
            else:
                selector=f'#v291-quicknav .v291-quicknav-links [data-mode="{mode}"]'
            trigger=page.locator(selector).first
            if not trigger.count() or not trigger.is_visible():
                return False, f'Visible navigation missing: {selector}'
            trigger.click(timeout=8000)
            # The underlying workspace controller sets the current mode and
            # reveals #tools only for analysis views.
            try:
                page.wait_for_function('''mode => { const btn=document.querySelector(`.workspace-nav-button[data-workspace="${mode}"]`); return !!btn && btn.classList.contains('is-current'); }''', arg=mode,timeout=6000)
                page.locator(target).first.wait_for(state='visible',timeout=6000)
            except Exception as e:
                current=page.locator('.workspace-nav-button.is-current').first
                active=current.get_attribute('data-workspace') if current.count() else '(none)'
                tools_hidden=page.locator('#tools').get_attribute('hidden') if page.locator('#tools').count() else '(missing)'
                return False, f'{mode} active={active} tools_hidden={tools_hidden} target={target}: {str(e)[:200]}'
            return True, f'{mode} visible: {target}'
        safe_test(label, f'switch to {mode}',run_mode)
        page.screenshot(path=str(OUTPUT/f'{label}_{mode}.png'),full_page=True,animations='disabled')
    page.screenshot(path=str(OUTPUT/f'{label}_full.png'),full_page=True,animations='disabled')


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width,height in [(1440,900),(1280,800),(430,932),(390,844),(375,812)]:
        label=f'{width}x{height}'
        page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
        page.on('pageerror',lambda err,label=label: console_errors.append({'viewport':label,'error':str(err)}))
        try:
            inspect(page,label,width<=430)
        except Exception as exc:
            check(label,'test run',False,str(exc))
        finally:
            page.close()
    browser.close()

with open(OUTPUT/'results.csv','w',newline='',encoding='utf-8-sig') as f:
    w=csv.DictWriter(f,fieldnames=['viewport','check','status','detail'])
    w.writeheader(); w.writerows(checks)
with open(OUTPUT/'page-errors.json','w',encoding='utf-8') as f:
    json.dump(console_errors,f,ensure_ascii=False,indent=2)
failed=[x for x in checks if x['status']=='FAIL']
print(f'Browser smoke checks: {len(checks)-len(failed)} PASS / {len(failed)} FAIL; page exceptions: {len(console_errors)}')
for x in failed: print('FAIL',x['viewport'],x['check'],x['detail'])
if failed: raise SystemExit(1)
