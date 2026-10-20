/* MIERU AICHI v2.8.9 — external statistics readability, presentation only. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const HELP={
    list:['指標を探す','事業所数や従業者数など、指標を選んで54市町村の数値を確認できます。','2021年経済センサス'],
    compare:['自治体を比べる','産業・雇用の規模や、事業所当たりの従業者数を比較します。','2021年経済センサス'],
    sectors:['産業の内訳を知る','産業大分類別の事業所・従業者を確認します。構成比と集積指数は欠損のない自治体のみが対象です。','2021年経済センサス'],
    migration:['人の移動を知る','2025年の転入・転出と転入超過数を確認します。出生・死亡を含む人口増減とは異なります。','2025年人口移動報告'],
    source:['根拠を確認する','調査名・定義・比較時の注意点を確認します。地図の表示年度とは別の調査です。','統計ごとに異なります']
  };
  function init(){
    const pane=byId('panel-external'),tabs=pane?.querySelector('.v283-stat-tabs');
    if(!pane||!tabs||byId('v289-stat-guide'))return;
    pane.classList.add('v289-external');
    const guide=make('section','v289-stat-guide');guide.id='v289-stat-guide';guide.setAttribute('aria-live','polite');guide.setAttribute('aria-atomic','true');
    const label=make('div','v289-guide-top');const title=make('strong','v289-guide-title');const year=make('span','v289-guide-year');label.append(title,year);
    const desc=make('p','v289-guide-desc');const city=make('p','v289-guide-city');
    guide.append(label,desc,city);
    tabs.insertAdjacentElement('afterend',guide);
    const buttons=[...tabs.querySelectorAll('[role="tab"]')];
    function sync(){
      const active=buttons.find(b=>b.getAttribute('aria-selected')==='true')||buttons[0];
      const key=active?.id?.replace('v283-tab-','');const data=HELP[key]||['追加統計','内容を選択してご覧ください。',''];
      title.textContent=data[0];desc.textContent=data[1];year.textContent=data[2];
      const select=byId('city-select');const name=select?.selectedOptions?.[0]?.textContent?.trim();
      city.textContent=name && !/読み込み中/.test(name)?'選択中のまち：'+name:'まちを選択すると、対応する情報が表示されます。';
    }
    tabs.addEventListener('click',()=>queueMicrotask(sync));
    tabs.addEventListener('keydown',()=>queueMicrotask(sync));
    const citySelect=byId('city-select');citySelect?.addEventListener('change',sync);
    const tabWatcher=new MutationObserver(sync);
    tabWatcher.observe(tabs,{subtree:true,attributes:true,attributeFilter:['aria-selected']});
    sync();

    // The migration module creates ranking asynchronously. Keep the whole list
    // and CSV download available; offer a reversible compact display.
    function decorateMigration(){
      const migration=byId('migration-2025');
      if(!migration||migration.querySelector('.v289-rank-toggle'))return false;
      const ranks=migration.querySelector('.migration-ranks');
      if(!ranks)return false;
      migration.classList.add('v289-ranks-compact');
      const button=make('button','v289-rank-toggle','ランキングをすべて表示');
      button.type='button';button.setAttribute('aria-expanded','false');
      button.setAttribute('aria-controls','v289-ranked-list');
      ranks.id='v289-ranked-list';
      ranks.insertAdjacentElement('beforebegin',button);
      button.addEventListener('click',()=>{
        const expanded=migration.classList.toggle('v289-ranks-expanded');
        button.setAttribute('aria-expanded',String(expanded));
        button.textContent=expanded?'ランキングをコンパクトにする':'ランキングをすべて表示';
      });
      return true;
    }
    if(!decorateMigration()){
      const observer=new MutationObserver(()=>{if(decorateMigration())observer.disconnect();});
      observer.observe(pane,{subtree:true,childList:true});
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
