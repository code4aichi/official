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
    // Purpose-first navigation. The existing workspace buttons remain the single source
    // of mode IDs and the existing workspace controller still owns all panel state.
    const old = all('.workspace-nav-button', nav);
    if (!old.length) return;
    const purposeGroups = [
      {id:'know', name:'まちを知る', items:[
        ['city','まちの基本情報','人口・世帯・高齢化など、選択したまちの基本情報を確認します。'],
        ['trend','人口の推移','2015年・2020年・2025年の人口の変化を見ます。'],
        ['story','まちの特徴を読む','選んだまちの特徴をまとめて確認します。']]},
      {id:'compare', name:'まちを比べる', items:[
        ['compare','2つのまちを比較','自治体を選んで数値を並べて比較します。'],
        ['ranking','まちのランキング','選んだ統計指標で54市町村を並べ替えます。']]},
      {id:'discover', name:'地域を深掘りする', items:[
        ['external','産業・雇用・人口移動','経済センサスや人口移動の追加統計を調べます。'],
        ['discovery','2つの指標で分析','散布図で自治体ごとの違いや関係を探索します。'],
        ['challenge','地域の注目点を探す','複数の指標から地域の特徴や課題のヒントを探します。']]},
      {id:'use', name:'結果を活用する', items:[
        ['report','比較レポートを作成','選んだ自治体の比較レポートを作成します。'],
        ['ai-nav','AIで地域データを調べる','質問から登録済みの地域統計を調べます。']]}
    ];
    const present = new Set(old.map(b=>b.dataset.workspace));
    const groups = purposeGroups.map(g=>({...g,items:g.items.filter(i=>present.has(i[0]))})).filter(g=>g.items.length);
    const lookup = new Map(groups.flatMap(g=>g.items.map(i=>[i[0],{group:g,...{label:i[1],description:i[2]}}])));
    const bar = make('div', 'v283-mode v285-purpose-nav');
    const title = make('p','v285-purpose-heading','何を調べたいですか？');
    const fields = make('div','v285-purpose-fields');
    const groupLabel=make('label','','目的を選ぶ');groupLabel.htmlFor='v285-purpose-select';
    const groupSelect=make('select','v285-purpose-select');groupSelect.id='v285-purpose-select';
    const featureLabel=make('label','','使う機能');featureLabel.htmlFor='v283-mode-select';
    const select=make('select','v283-mode-select');select.id='v283-mode-select';
    const description=make('p','v285-purpose-description');description.id='v285-purpose-description';
    description.setAttribute('role','status');description.setAttribute('aria-live','polite');
    select.setAttribute('aria-describedby', description.id);
    for(const g of groups) groupSelect.add(new Option(g.name,g.id));
    function populate(groupId, modeId){
      const group=groups.find(g=>g.id===groupId)||groups[0];
      select.replaceChildren();
      for(const [id,label] of group.items)select.add(new Option(label,id));
      select.value=group.items.some(i=>i[0]===modeId)?modeId:group.items[0][0];
      description.textContent=lookup.get(select.value)?.description||'';
    }
    const initial=(old.find(b=>b.classList.contains('is-current'))||old[0]).dataset.workspace;
    const initialGroup=lookup.get(initial)?.group||groups[0];
    groupSelect.value=initialGroup.id;populate(initialGroup.id,initial);
    groupSelect.addEventListener('change',()=>{
      populate(groupSelect.value);
      window.MIERU_WORKSPACE.open(select.value);
    });
    select.addEventListener('change',()=>{
      description.textContent=lookup.get(select.value)?.description||'';
      window.MIERU_WORKSPACE.open(select.value);
    });
    const observe = new MutationObserver(() => {
      const active=old.find(b=>b.classList.contains('is-current'));
      const mode=active?.dataset.workspace;
      const entry=lookup.get(mode);
      if(!entry)return;
      if(groupSelect.value!==entry.group.id){groupSelect.value=entry.group.id;populate(entry.group.id,mode);}
      else if(select.value!==mode)select.value=mode;
      description.textContent=entry.description;
    });
    observe.observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
    groupLabel.append(groupSelect);featureLabel.append(select);
    fields.append(groupLabel,featureLabel);bar.append(title,fields,description);
    nav.parentNode.insertBefore(bar,nav);
    nav.classList.add('v283-hidden-nav');
    nav.setAttribute('aria-hidden','true');
    old.forEach(b=>{b.tabIndex=-1;});

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
