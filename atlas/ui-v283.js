/* MIERU AICHI v2.8.3: presentation only. Never mutates stored statistics. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const all = (s, root = document) => [...root.querySelectorAll(s)];
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const onReady = () => {
    const nav = $('.workspace-nav');
    const aside = $('.info-column');
    if (!nav || !aside || !window.MIERU_WORKSPACE) return;
    const old = all('.workspace-nav-button', nav);
    const bar = make('div', 'v283-mode');
    const label = make('label', '', '表示する情報');
    label.htmlFor = 'v283-mode-select';
    const select = make('select', 'v283-mode-select');
    select.id = 'v283-mode-select';
    for (const button of old) {
      const title = button.textContent.trim();
      const option = new Option(title, button.dataset.workspace);
      select.add(option);
    }
    select.value = (old.find(b => b.classList.contains('is-current')) || old[0]).dataset.workspace;
    select.addEventListener('change', () => window.MIERU_WORKSPACE.open(select.value));
    const observe = new MutationObserver(() => {
      const active = old.find(b => b.classList.contains('is-current'));
      if (active && select.value !== active.dataset.workspace) select.value = active.dataset.workspace;
    });
    observe.observe(nav, {subtree:true, attributes:true, attributeFilter:['class']});
    label.append(select); bar.append(label);
    nav.parentNode.insertBefore(bar, nav);
    nav.classList.add('v283-hidden-nav'); // original buttons remain functional for legacy JS callers
    nav.setAttribute('aria-hidden','true');
    old.forEach(b => { b.tabIndex=-1; });

    // Replace never-ending external statistics column with four focused views.
    const panel = $('#panel-external');
    if (!panel) return;
    const controls = make('div', 'v283-external-controls');
    const tabs = make('div', 'v283-stat-tabs');
    tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','追加統計の表示切替');
    const views = make('div', 'v283-stat-views');
    const keys = [
      ['list','指標一覧'],['compare','産業・雇用'],['sectors','産業別構成'],['migration','人口移動'],['source','出典・注意']
    ];
    const areas = new Map(); const buttons = new Map();
    for (const [key,title] of keys) {
      const btn = make('button','v283-stat-tab',title);btn.type='button';btn.id='v283-tab-'+key;
      btn.setAttribute('role','tab'); btn.setAttribute('aria-controls','v283-pane-'+key);
      btn.setAttribute('aria-selected',key==='list'?'true':'false');btn.tabIndex=key==='list'?0:-1;
      const view=make('section','v283-stat-view');view.id='v283-pane-'+key;view.setAttribute('role','tabpanel');view.setAttribute('aria-labelledby',btn.id);view.hidden=key!=='list';
      tabs.append(btn); views.append(view);buttons.set(key,btn);areas.set(key,view);
      btn.addEventListener('click',()=>show(key));
      btn.addEventListener('keydown',(ev)=>{if(ev.key!=='ArrowRight'&&ev.key!=='ArrowLeft')return;ev.preventDefault();const idx=keys.findIndex(x=>x[0]===key),step=ev.key==='ArrowRight'?1:-1;const next=keys[(idx+step+keys.length)%keys.length][0];show(next);buttons.get(next).focus();});
    }
    function show(key){for(const [id,el] of areas){el.hidden=id!==key;const b=buttons.get(id);b.setAttribute('aria-selected',String(id===key));b.tabIndex=id===key?0:-1;} const scroll=panel.closest('#tools');if(scroll)scroll.scrollTop=0;}
    panel.insertBefore(controls,panel.firstChild);controls.append(tabs);panel.append(views);
    const indicator=$('#external-indicator');
    const status=$('#external-status');
    const list=$('#external-list');
    const source=$('#external-source');
    const economic=$('#economic-analysis');
    const sector=$('#industry-sector');
    if(indicator){const lab=indicator.closest('label'); if(lab)areas.get('list').append(lab);}
    if(status)areas.get('list').append(status);
    if(list)areas.get('list').append(list);
    if(economic)areas.get('compare').append(economic);
    if(sector)areas.get('sectors').append(sector);
    // industry-sector.js creates its panel after awaiting JSON fetch.
    // Its target.after(host) may run after this script's DOMContentLoaded handler.
    const sectorObserver = new MutationObserver(() => {
      const live = $('#industry-sector');
      if(live && live.parentNode !== areas.get('sectors')) areas.get('sectors').append(live);
      if(live) sectorObserver.disconnect();
    });
    if(!sector) sectorObserver.observe(document.querySelector('main') || document.body, {childList:true,subtree:true});
    if(source)areas.get('source').append(source);
    // Move source paragraphs/links out of comparison after its async rebuild, without changing data logic.
    const hint=make('p','muted tiny','2021年経済センサス（確報）の値は、国勢調査の人口・世帯値とは別の統計です。');
    areas.get('source').prepend(hint);
    const note=make('p','muted tiny','「-」など欠損している産業区分は0とみなしません。従業者数は事業所所在地ベースです。');
    areas.get('source').append(note);
    if(!sector)areas.get('sectors').append(make('p','muted tiny','産業構成データの読み込みが完了すると表示されます。'));

    // Keep only first 8 municipalities visible in the long list by default;
    // searching still searches ALL existing rows, not only the first page.
    if(list){
      const filterBox=make('div','v283-list-tools');
      const search=make('input','v283-list-search');search.type='search';search.placeholder='自治体名を検索（例：豊田市）';search.setAttribute('aria-label','追加統計の自治体名を検索');
      const count=make('span','v283-list-count');count.setAttribute('role','status');
      const more=make('button','v283-list-more','すべての自治体を見る');more.type='button';
      filterBox.append(search,count);list.before(filterBox);list.after(more);
      let expanded=false;
      let scheduled=false;
      const filter=()=>{scheduled=false;const text=search.value.trim().normalize('NFKC').toLowerCase();const items=all('.external-stat-item',list);let matching=0;
        for(const item of items){const found=item.textContent.normalize('NFKC').toLowerCase().includes(text);if(found)matching++;item.hidden=!found||(!expanded&&!text&&matching>8);}
        count.textContent=items.length?`${matching}自治体（表示 ${items.filter(x=>!x.hidden).length}件）`:'統計データを読み込み中';
        more.hidden=!!text||matching<=8;more.textContent=expanded?'上位8件だけ表示':'54市町村をすべて表示';};
      search.addEventListener('input',()=>{expanded=false;filter()});more.addEventListener('click',()=>{expanded=!expanded;filter()});
      new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(filter);}}).observe(list,{childList:true});filter();
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',onReady);
  else onReady();
})();
