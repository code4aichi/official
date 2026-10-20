#!/usr/bin/env python3
"""v2.9.17.1: genuine pointer-only verification of new v2917 controls.
Read-only: never mutate site DOM, force click, trigger old nav with evaluate(),
or call generative AI. Reports each failure stage and preserves artifacts.
"""
import csv
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('MIERU_URL', 'https://code4aichi.org/atlas/').rstrip('/') + '/'
OUT = Path('atlas-v2917-navigation-results')
OUT.mkdir(parents=True, exist_ok=True)
ROWS = []


def evidence(page, tag):
    state = page.evaluate('''() => {
      const info = s => {
        const el=document.querySelector(s);
        if(!el)return {exists:false};
        const r=el.getBoundingClientRect(), cs=getComputedStyle(el);
        return {exists:true,visible:!!(r.width && r.height && cs.display!=='none' && cs.visibility!=='hidden'),
          className:String(el.className),hidden:el.hidden,ariaExpanded:el.getAttribute('aria-expanded'),
          text:(el.innerText||'').slice(0,220),width:Math.round(r.width),height:Math.round(r.height)};
      };
      return {url:location.href,width:innerWidth,loadedJS:[...document.scripts].some(s=>s.src.includes('ui-v2917.js')),
        loadedCSS:[...document.querySelectorAll('link[rel="stylesheet"]')].some(e=>e.href.includes('ui-v2917.css')),
        actions:info('#v2917-actions'),reportButton:info('#v2917-actions [data-mode="report"]'),
        aiButton:info('#v2917-actions [data-mode="ai-nav"]'),
        expanded:info('#v291-all-features'),quick:info('#v291-quicknav'),
        more:info('#v291-quicknav .v291-more'),
        reportPanel:info('#panel-report'),aiPanel:info('#panel-ai-nav'),
        legacyReport:info('.workspace-nav-button[data-workspace="report"]'),
        legacyAI:info('.workspace-nav-button[data-workspace="ai-nav"]')};
    }''')
    (OUT / f'{tag}.json').write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding='utf-8')
    page.screenshot(path=str(OUT / f'{tag}.png'), full_page=True, animations='disabled')
    return state


def check(page, device, target, request_log):
    uc = 'UC12' if target == 'report' else 'UC16'
    tag = f'{device}_{uc}'
    notes = []
    stage = 'ASSETS'
    status = 'REVIEW'
    before = evidence(page, f'{tag}_initial')
    try:
        if not before['loadedJS'] or not before['loadedCSS']:
            notes.append('v2.9.17 script or stylesheet reference missing')
            return
        # Page must create new v2917 actions; no force creation.
        page.locator('#v2917-actions').wait_for(state='attached', timeout=8000)
        btn = page.locator(f'#v2917-actions button[data-mode="{target}"]')
        stage = 'BUTTON_CREATED'
        if btn.count() != 1:
            notes.append(f'Expected exactly one new button; actual {btn.count()}')
            return
        # Open the existing disclosure using a real pointer click when needed.
        stage = 'DISCLOSURE'
        if not btn.is_visible():
            options = [
                page.locator('#v291-quicknav .v291-more'),
                page.get_by_role('button', name='その他の機能'),
                page.get_by_text('その他の機能', exact=False),
            ]
            for opt in options:
                for idx in range(min(opt.count(), 4)):
                    item = opt.nth(idx)
                    if not item.is_visible():
                        continue
                    try:
                        item.click(timeout=2500)
                        page.wait_for_timeout(300)
                        notes.append('Opened other-features disclosure by native pointer click')
                        if btn.is_visible():
                            break
                    except Exception as exc:
                        notes.append('Disclosure click blocked: ' + str(exc)[:180])
                if btn.is_visible():
                    break
        evidence(page, f'{tag}_expanded')
        if not btn.is_visible():
            notes.append('New button remains hidden after real disclosure click')
            return
        # Require a usable pointer target, not the collapsed 8px / 14px legacy item.
        stage = 'HIT_TARGET'
        box = btn.bounding_box()
        if not box or box['width'] < 100 or box['height'] < 40:
            notes.append(f'New button too small: {box}')
            return
        stage = 'CLICK_AND_NAVIGATE'
        btn.click(timeout=6000)  # Genuine Playwright pointer, no force=True.
        page.wait_for_timeout(600)
        panel = page.locator('#panel-' + target)
        if not panel.is_visible():
            notes.append('New button clickable, but target panel not visible')
            return
        stage = 'FUNCTION_CONTROLS'
        controls = ['#report-a', '#report-json'] if target == 'report' else ['#ai-nav-input', '#ai-nav-submit']
        missing = [selector for selector in controls if not page.locator(selector).is_visible()]
        if missing:
            notes.append('Panel opened but controls not visible: ' + ', '.join(missing))
            return
        status = 'PASS'
        stage = 'SUCCESS'
        notes.append('New v2.9.17 button is visible, large enough, pointer-clickable, and opens target panel')
    except Exception as exc:
        notes.append(f'{type(exc).__name__}: {str(exc)[:400]}')
    finally:
        evidence(page, f'{tag}_after')
        ROWS.append({'usecase': uc, 'device':device,'status':status,'stage':stage,'detail':' | '.join(notes),
                     'v2917_js_responses': json.dumps([x for x in request_log if 'ui-v2917.' in x['url']],ensure_ascii=False)})
        print(f'{uc} {device}: {status} ({stage}) - {" | ".join(notes)}',flush=True)


def run():
    page_errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        for device,target,w,h in [('desktop','report',1440,900),('mobile','ai-nav',390,844)]:
            ctx=browser.new_context(viewport={'width':w,'height':h},locale='ja-JP',device_scale_factor=1)
            page=ctx.new_page()
            responses=[]
            page.on('response',lambda r: responses.append({'url':r.url,'status':r.status}) if 'ui-v2917.' in r.url else None)
            page.on('pageerror',lambda e: page_errors.append({'device':device,'error':str(e)}))
            try:
                page.goto(URL,wait_until='domcontentloaded',timeout=60000)
                page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=30000)
                page.wait_for_timeout(1500)
                check(page,device,target,responses)
            except Exception as exc:
                try: evidence(page,f'{device}_fatal')
                except Exception: pass
                ROWS.append({'usecase':'UC12' if target=='report' else 'UC16','device':device,'status':'FAIL',
                             'stage':'INITIAL_LOAD','detail':repr(exc)[:400],'v2917_js_responses':json.dumps(responses)})
            ctx.close()
        browser.close()
    with (OUT / 'results.csv').open('w',newline='',encoding='utf-8-sig') as fh:
        wr=csv.DictWriter(fh,fieldnames=['usecase','device','status','stage','detail','v2917_js_responses'])
        wr.writeheader();wr.writerows(ROWS)
    (OUT / 'page_errors.json').write_text(json.dumps(page_errors,ensure_ascii=False,indent=2),encoding='utf-8')
    summary={'version':'2.9.17.1','site_url':URL,'cases':len(ROWS),'PASS':sum(r['status']=='PASS' for r in ROWS),
             'FAIL':sum(r['status']=='FAIL' for r in ROWS),'REVIEW':sum(r['status']=='REVIEW' for r in ROWS),
             'js_exceptions':len(page_errors),'note':'This is only a 2-case diagnostic. Full 16-case re-run required for final acceptance.'}
    (OUT / 'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False),flush=True)
    return 0 if summary['PASS']==2 and summary['js_exceptions']==0 else 1


if __name__=='__main__':
    raise SystemExit(run())
