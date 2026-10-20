#!/usr/bin/env python3
"""Read-only genuine-pointer navigation diagnostic for UC12 desktop and UC16 mobile.
No dispatchEvent, DOM click(), force=True or mutation of the deployed website.
"""
import csv,json,os,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
URL=os.environ.get('MIERU_URL','https://code4aichi.org/atlas/').rstrip('/')+'/'
OUT=Path('atlas-navigation-final-results');OUT.mkdir(exist_ok=True)
RESULTS=[]; ERRORS=[]

def snapshot(page,tag):
    data=page.evaluate('''() => {
      const r=[];
      const nodes=document.querySelectorAll('button, a, [role="button"], summary');
      for(const e of nodes){const t=(e.innerText||e.textContent||'').trim();
        if(!/機能|レポート|AI|地域|調べる|分析|目的|比較/.test(t) && !e.closest('.v285-purpose-nav,.workspace-nav,#v291-quicknav')) continue;
        const rect=e.getBoundingClientRect(),css=getComputedStyle(e);
        r.push({tag:e.tagName,text:t.slice(0,140),className:String(e.className).slice(0,140),id:e.id,mode:e.dataset.workspace||e.dataset.mode||e.dataset.v290Mode||'',visible:!!(rect.width&&rect.height&&css.visibility!=='hidden'&&css.display!=='none'),inViewport:rect.top<innerHeight&&rect.bottom>0,rect:{x:Math.round(rect.x),y:Math.round(rect.y),w:Math.round(rect.width),h:Math.round(rect.height)}});
      }
      return {width:innerWidth,nav:r,panels:[...document.querySelectorAll('.tool-panel')].map(e=>({id:e.id,hidden:e.hidden,rectH:e.getBoundingClientRect().height})),quicknav:!!document.querySelector('#v291-quicknav'),purpose:!!document.querySelector('.v285-purpose-nav')};
    }''')
    (OUT/f'{tag}_dom.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf8')
    page.screenshot(path=str(OUT/f'{tag}.png'),full_page=True,animations='disabled')
    return data

def attempt(page,loc,description,history,target):
    if loc.count()==0:return False
    for i in range(min(loc.count(),8)):
        b=loc.nth(i)
        if not b.is_visible():continue
        try:
            b.click(timeout=1800)
            page.wait_for_timeout(300)
            ok=page.locator('#panel-'+target).is_visible()
            history.append({'action':description,'result':'CLICKED','target_visible':ok})
            if ok:return True
        except Exception as exc:history.append({'action':description,'result':'BLOCKED','error':str(exc)[:300]})
    return False

def check(page,target,device):
    history=[]
    before=snapshot(page,f'{device}_before')
    target_name='レポート' if target=='report' else 'AIに聞く'
    # 1. Primary purpose-driven visible controls, no hidden legacy buttons.
    candidates=[
      ('.v285-purpose-nav button', 'purpose-menu button'),
      ('.v285-purpose-nav a', 'purpose-menu link'),
      ('.v291-advanced button','expanded-menu button'),
      ('.v291-advanced a','expanded-menu link'),
      ('.workspace-nav-button[data-workspace="'+target+'"]','legacy visible button')
    ]
    def try_options():
        for selector,desc in candidates:
            loc=page.locator(selector).filter(has_text=target_name)
            if attempt(page,loc,desc,history,target):return True
        return False
    ok=try_options()
    if not ok:
        # 2. Explicitly expand the user-visible disclosure, selecting one actually
        # visible control. A click on the disclosure itself is an authentic action.
        for locator,desc in [
          (page.locator('#v291-quicknav .v291-more'),'desktop other-features disclosure'),
          (page.get_by_role('button',name='その他の機能'),'other-features button'),
          (page.get_by_text('その他の機能',exact=False),'other-features label')
        ]:
            if not locator.count() or not locator.first.is_visible():continue
            clicked = attempt(page,locator.first,desc,history,'__not_a_panel__')
            # attempt() uses ordinary pointer clicks and logs the disclosure interaction.
            # After expanding, inspect purpose navigation immediately.
            if try_options():ok=True;break
    if not ok:
        # 3. Accessible text labels present outside the common containers.
        for loc,desc in [(page.get_by_role('button',name=target_name),'button by accessible name'),
                         (page.get_by_role('link',name=target_name),'link by accessible name')]:
            if attempt(page,loc,desc,history,target):ok=True;break
    after=snapshot(page,f'{device}_after')
    if ok:
        # Function is also exercised without invoking any paid generative AI endpoint.
        if target=='report':
            assert page.locator('#report-a').is_visible() and page.locator('#report-json').is_visible()
        else:
            assert page.locator('#ai-nav-input').is_visible() and page.locator('#ai-nav-submit').is_visible()
    status='PASS' if ok else 'REVIEW'
    detail=('Visible pointer navigation reached '+target if ok else 'No confirmed genuine-pointer route to '+target+'; see navigation evidence')
    (OUT/f'{device}_click_log.json').write_text(json.dumps(history,ensure_ascii=False,indent=2),encoding='utf8')
    RESULTS.append({'usecase':'UC12' if target=='report' else 'UC16','device':device,'result':status,'detail':detail,'attempts':len(history)})
    print(status,device,detail,flush=True)

def main():
    with sync_playwright() as p:
      browser=p.chromium.launch(headless=True)
      for target,device,w,h in [('report','desktop',1440,900),('ai-nav','mobile',390,844)]:
        ctx=browser.new_context(viewport={'width':w,'height':h},locale='ja-JP')
        page=ctx.new_page();page.on('pageerror',lambda err:ERRORS.append(str(err)))
        try:
            page.goto(URL,wait_until='domcontentloaded',timeout=60000)
            page.locator('#city-select option').nth(1).wait_for(state='attached',timeout=30000)
            page.wait_for_timeout(1600)
            check(page,target,device)
        except Exception as e:
            RESULTS.append({'usecase':'UC12' if target=='report' else 'UC16','device':device,'result':'FAIL','detail':repr(e)[:400],'attempts':0})
            try:page.screenshot(path=str(OUT/f'{device}_fatal.png'),full_page=True)
            except Exception:pass
        finally:ctx.close()
      browser.close()
    with (OUT/'results.csv').open('w',newline='',encoding='utf-8-sig') as f:
        x=csv.DictWriter(f,fieldnames=['usecase','device','result','detail','attempts']);x.writeheader();x.writerows(RESULTS)
    summary={'version':'2.9.16.2','test_cases':len(RESULTS),'PASS':sum(x['result']=='PASS' for x in RESULTS),'FAIL':sum(x['result']=='FAIL' for x in RESULTS),'REVIEW':sum(x['result']=='REVIEW' for x in RESULTS),'javascript_exceptions':len(ERRORS),'NOTE':'Existing 14 PASS remain from prior run; not re-executed here. UI acceptance remains HOLD until the 16-case suite passes.'}
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf8')
    (OUT/'javascript_errors.json').write_text(json.dumps(ERRORS,ensure_ascii=False,indent=2),encoding='utf8')
    print('SUMMARY',summary,flush=True)
    return 1 if summary['FAIL'] or summary['REVIEW'] or ERRORS else 0
if __name__=='__main__':sys.exit(main())
