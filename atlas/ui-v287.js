/* MIERU AICHI UI phase 3: read-only shared viewing-condition summary. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 function init(){
  const picker=document.querySelector('.city-picker');
  const city=$('city-select'),year=$('year-select'),category=$('category-select'),indicator=$('indicator-select');
  const heading=$('selected-name'),nav=document.querySelector('.workspace-nav');
  if(!picker||!city||!year||!category||!indicator)return;
  if($('v287-context'))return;
  const section=document.createElement('section');section.id='v287-context';section.className='v287-context';
  section.setAttribute('aria-label','現在の表示条件');
  section.innerHTML='<div class="v287-context-title"><strong>現在の表示条件</strong><span>地図の条件と追加統計の調査年は別です</span></div><div class="v287-context-values"><div><span>選択中のまち</span><strong id="v287-city">読み込み中</strong></div><div><span>地図の年度</span><strong id="v287-year">—</strong></div><div><span>地図の指標</span><strong id="v287-metric">—</strong></div></div><p class="v287-context-note" id="v287-note"></p>';
  picker.insertAdjacentElement('afterend',section);
  const label=(el)=>el?.selectedOptions?.[0]?.textContent?.trim()||'';
  const activeMode=()=>nav?.querySelector('.workspace-nav-button.is-current')?.dataset.workspace||'city';
  let raf=0;
  function update(){
   raf=0;
   const selectedName=heading?.textContent?.trim();
   const cityText=selectedName&&selectedName!=='読み込み中'&&selectedName!=='—'?selectedName:label(city);
   $('v287-city').textContent=cityText&&cityText!=='読み込み中…'?cityText:'読み込み中';
   $('v287-year').textContent=label(year)||year.value+'年';
   const metric=label(indicator);
   $('v287-metric').textContent=metric||label(category)||'読み込み中';
   const mode=activeMode(), note=$('v287-note');
   if(mode==='external'){
    note.textContent='地図の年度は国勢調査の表示条件です。追加統計は指標ごとに調査年が異なります（産業：2021年、人口移動：2025年）。';
    section.classList.add('v287-context-external');
   }else{
    note.textContent='「地図の年度・指標」は左側の地図に適用されます。比較・分析・AIなどの画面は、各機能に記載された調査年・指標定義を確認してください。';
    section.classList.remove('v287-context-external');
   }
  }
  function schedule(){if(!raf)raf=requestAnimationFrame(update);}
  [city,year,category,indicator].forEach(el=>{
   el.addEventListener('change',schedule);
   el.addEventListener('input',schedule);
  });
  if(heading)new MutationObserver(schedule).observe(heading,{subtree:true,childList:true,characterData:true});
  new MutationObserver(schedule).observe(indicator,{childList:true,subtree:true,attributes:true,attributeFilter:['selected']});
  if(nav)new MutationObserver(schedule).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
  schedule();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
