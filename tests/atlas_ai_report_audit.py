#!/usr/bin/env python3
"""MIERU AICHI v2.9.15: read-only AI navigator and report acceptance.

Uses only public UI. Does not claim AI answer correctness without verifying references.
External AI invocation is opt-in (MIERU_TEST_GENERATIVE_AI=true).
"""
import csv
import json
import os
import sys
from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE=os.getenv('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT=Path('ai-report-audit-results');OUT.mkdir(parents=True,exist_ok=True)
ROWS=[]

def record(group,name,status,detail=''):
    assert status in {'PASS','FAIL','REVIEW','SKIP'}
    ROWS.append({'group':group,'check':name,'status':status,'detail':str(detail)[:1800]})
    print(f'{status:6s} [{group}] {name}: {str(detail)[:180]}',flush=True)

def run_check(group,name,action):
    try:action()
    except Exception as exc:record(group,name,'FAIL',f'{type(exc).__name__}: {exc}')

def activate(page,mode):
    """Switch modes without clicking an obsolete/overlaid navigation surface.

    Modern shortcuts are used when present and actionable. For legacy modes
    (not exposed in quicknav), dispatch the original DOM button's click event,
    which invokes the application's own workspace navigation handler.
    This checks data and rendering, not pointer accessibility of legacy tabs.
    """
    modern = [
        f'#v291-quicknav [data-mode="{mode}"]',
        f'#v290-mobile-home [data-v290-mode="{mode}"]',
    ]
    for selector in modern:
        button=page.locator(selector).first
        if button.count() and button.is_visible():
            try:
                button.click(timeout=2500)
                page.locator(f'#panel-{mode}').wait_for(state='visible',timeout=12000)
                return
            except Exception:
                pass
    legacy=page.locator(f'.workspace-nav-button[data-workspace="{mode}"]').first
    if not legacy.count():
        raise RuntimeError(f'No workspace control for {mode}')
    legacy.evaluate('(button) => button.click()')
    page.locator(f'#panel-{mode}').wait_for(state='visible',timeout=15000)

def report_run(page):
    activate(page,'report')
    for selector in ('#report-a','#report-b','#report-c','#report-table','#report-copy','#report-json','#report-print'):
        if not page.locator(selector).count():
            record('report',f'UI control {selector}','FAIL','Missing report control')
    cities=[]
    for selector in ('#report-a','#report-b'):
        select=page.locator(selector)
        options=select.locator('option').evaluate_all('els => els.filter(x=>x.value && !x.disabled).map(x=>({value:x.value,text:x.textContent.trim()}))')
        if not options:raise RuntimeError(f'Empty options in {selector}')
        candidate=next((o for o in options if o['value'] not in [c['value'] for c in cities]),None)
        if not candidate:raise RuntimeError('No distinct comparison city')
        select.select_option(candidate['value']);cities.append(candidate)
    page.wait_for_timeout(900)
    title=(page.locator('#report-subtitle').inner_text() or '').strip()
    table=(page.locator('#report-table').inner_text() or '').strip()
    names=[x['text'] for x in cities]
    good=all(name in (title+' '+table) for name in names)
    record('report','selected cities appear in report','PASS' if good else 'FAIL',f'cities={names}, subtitle={title[:200]}, chars={len(table)}')
    record('report','report table populated','PASS' if len(table)>70 else 'FAIL',f'table chars={len(table)}')
    page.screenshot(path=str(OUT/'report_desktop.png'),full_page=False)

    # Capture real JSON download; inspect structure without assuming undocumented schema.
    try:
        with page.expect_download(timeout=15000) as pending:
            page.locator('#report-json').click()
        download=pending.value
        path=OUT/'report_export.json';download.save_as(str(path))
        payload=json.loads(path.read_text(encoding='utf-8-sig'))
        raw=json.dumps(payload,ensure_ascii=False)
        record('report','JSON export is valid','PASS' if isinstance(payload,(dict,list)) and len(raw)>100 else 'FAIL',f'filename={download.suggested_filename}; bytes={len(raw)}')
        # JSON must refer to the selected cities by name or code; report schema is not presumed.
        terms=[[city['text'],city['value']] for city in cities]
        matched=[any(t in raw for t in candidates) for candidates in terms]
        record('report','JSON export refers to selected municipalities','PASS' if all(matched) else 'FAIL',f'selected={cities}; present={matched}')
        record('report','every exported indicator independently matches original statistical tables','REVIEW','Export parsed, but full official-data comparison requires schema-specific source mapping.')
    except Exception as exc:record('report','download and parse JSON export','FAIL',f'{type(exc).__name__}: {exc}')

    try:
        page.context.grant_permissions(['clipboard-read','clipboard-write'],origin=BASE.rstrip('/'))
        page.locator('#report-copy').click()
        page.wait_for_timeout(350)
        copied=page.evaluate('async () => await navigator.clipboard.readText()')
        record('report','copy comparison table','PASS' if len(copied)>40 and any(city['text'] in copied for city in cities) else 'FAIL',f'clipboard chars={len(copied)}; selected municipality mentioned={any(city["text"] in copied for city in cities)}')
    except Exception as exc:record('report','copy comparison table','REVIEW',f'Clipboard inaccessible in automated browser: {exc}')

    try:
        with page.expect_event('popup',timeout=3500) as popup_event:
            page.locator('#report-print').click()
        popup=popup_event.value
        popup.close()
        record('report','PDF/print control opens printable view','PASS','Print popup appeared')
    except Exception:
        # Direct window.print may not open a popup; do not report false PASS/FAIL.
        record('report','PDF/print opens usable print dialog','REVIEW','Print dialog may be handled by browser; automated export not verified. Manual print-to-PDF required.')

    page.locator('#ai-report-generate').wait_for(state='visible',timeout=12000)
    record('report','AI report generation control visible','PASS','AI generate button present')
    if os.getenv('MIERU_TEST_GENERATIVE_AI','false').lower()=='true':
        page.locator('#ai-report-generate').click()
        page.wait_for_timeout(10000)
        output=(page.locator('#ai-report-output').inner_text() or '').strip()
        status=(page.locator('#ai-report-status').inner_text() or '').strip()
        record('report','external AI explanation request','REVIEW',f'output chars={len(output)}; status={status[:300]}; review accuracy, sources and privacy manually')
    else:
        record('report','external AI explanation request','SKIP','Opt-in disabled. No external AI request sent.')


def ai_navigator_run(page):
    activate(page,'ai-nav')
    page.locator('#ai-nav-input').wait_for(state='visible',timeout=12000)
    state=(page.locator('#ai-nav-state').inner_text() or '').strip()
    record('ai','navigator mode is shown','PASS' if bool(state) else 'FAIL',f'mode={state}')
    query='岡崎市の単身世帯率は？'
    page.locator('#ai-nav-input').fill(query)
    page.locator('#ai-nav-submit').click()
    try:page.wait_for_function('''() => {let el=document.querySelector('#ai-nav-result');return !!(el && el.innerText && el.innerText.trim().length>20)}''',timeout=18000)
    except Exception:pass
    result=(page.locator('#ai-nav-result').inner_text() or '').strip()
    status=(page.locator('#ai-nav-status').inner_text() or '').strip()
    record('ai','navigator returns result for city query','PASS' if len(result)>20 and '岡崎' in result else 'FAIL',f'result={result[:400]}; status={status[:180]}')
    # Verify no clearly wrong municipality, no unsupported claim of numerical accuracy.
    record('ai','statistical answer independently verified against source','REVIEW','Text and municipality checked; numerical values/denominators/source year require source-specific independent validation.')
    page.screenshot(path=str(OUT/'ai_navigator_desktop.png'),full_page=False)
    if os.getenv('MIERU_TEST_GENERATIVE_AI','false').lower()!='true':
        record('ai','external generative AI response','SKIP','Opt-in disabled; navigator local/statistical search tested only.')
    else:
        record('ai','external generative AI response','REVIEW','AI invocation may depend on deployment configuration; inspect output and factual grounding manually.')


def mobile_run(page):
    page.set_viewport_size({'width':390,'height':844})
    activate(page,'report')
    page.locator('#report-a').wait_for(state='visible',timeout=12000)
    over=page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
    record('mobile','report does not overflow screen horizontally','FAIL' if over else 'PASS',f'viewport=390; overflow={over}')
    page.screenshot(path=str(OUT/'report_mobile.png'),full_page=False)
    activate(page,'ai-nav')
    over=page.evaluate('document.documentElement.scrollWidth > window.innerWidth + 2')
    record('mobile','AI navigator does not overflow screen horizontally','FAIL' if over else 'PASS',f'viewport=390; overflow={over}')
    page.screenshot(path=str(OUT/'ai_navigator_mobile.png'),full_page=False)


def main():
    with sync_playwright() as playwright:
        browser=playwright.chromium.launch(headless=True)
        context=browser.new_context(viewport={'width':1440,'height':900},accept_downloads=True)
        page=context.new_page()
        page.set_default_timeout(12000)
        exceptions=[]
        page.on('pageerror',lambda error:exceptions.append(str(error)))
        try:
            page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
            page.locator('#report-a').wait_for(state='attached',timeout=30000)
            page.wait_for_timeout(1800)
            run_check('report','report controls, rendering and exports',lambda:report_run(page))
            run_check('ai','AI navigator statistical query',lambda:ai_navigator_run(page))
            run_check('mobile','mobile report and AI viewport',lambda:mobile_run(page))
            record('browser','uncaught JS page exceptions','PASS' if not exceptions else 'FAIL',exceptions[:8])
        finally:
            context.close();browser.close()
    with (OUT/'results.csv').open('w',newline='',encoding='utf-8-sig') as handle:
        writer=csv.DictWriter(handle,fieldnames=['group','check','status','detail']);writer.writeheader();writer.writerows(ROWS)
    (OUT/'results.json').write_text(json.dumps(ROWS,ensure_ascii=False,indent=2),encoding='utf-8')
    counts={key:sum(row['status']==key for row in ROWS) for key in ('PASS','FAIL','REVIEW','SKIP')}
    (OUT/'summary.json').write_text(json.dumps({'counts':counts,'url':BASE},ensure_ascii=False,indent=2),encoding='utf-8')
    print('SUMMARY',counts,flush=True)
    return 1 if counts['FAIL'] else 0

if __name__=='__main__':sys.exit(main())
