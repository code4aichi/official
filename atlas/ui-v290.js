/* MIERU AICHI v2.9.0: navigation/presentation only; no data or map manipulation. */
(()=>{'use strict';
function init(){
 const picker=document.querySelector('.city-picker');
 const workspace=document.querySelector('.workspace');
 const info=document.querySelector('.info-column');
 const map=document.querySelector('.map-column');
 const name=document.getElementById('selected-name');
 const population=document.getElementById('population');
 const metricLabel=document.getElementById('primary-metric-label');
 const year=document.getElementById('year-select');
 if(!picker||!workspace||!info||!map||!name||!population||document.getElementById('v290-mobile-home'))return;
 const home=document.createElement('section');home.id='v290-mobile-home';home.className='v290-mobile-home';home.setAttribute('aria-label','選択したまちの情報と主な操作');
 const heading=document.createElement('div');heading.className='v290-summary-top';
 const caption=document.createElement('span');caption.textContent='選択中のまち';
 const city=document.createElement('strong');city.id='v290-city';city.textContent='読み込み中';
 heading.append(caption,city);
 const metrics=document.createElement('div');metrics.className='v290-summary-stats';
 const field=document.createElement('span');field.id='v290-metric-name';field.textContent='総人口';
 const number=document.createElement('strong');number.id='v290-value';number.textContent='—';
 const source=document.createElement('span');source.id='v290-year';source.textContent='地図の表示年度';
 metrics.append(field,number,source);
 const shortcuts=document.createElement('div');shortcuts.className='v290-shortcuts';shortcuts.setAttribute('aria-label','よく使う機能');
 const actions=[['compare','まちを比較'],['ranking','ランキング'],['external','産業・人口移動'],['city','詳しい情報']];
 for(const [mode,label] of actions){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.v290Mode=mode;b.addEventListener('click',()=>{
  const original=[...document.querySelectorAll('.workspace-nav-button')].find(x=>x.dataset.workspace===mode);
  if(original)original.click();
  const target=mode==='city'?document.querySelector('.info-column .detail'):document.querySelector('#tools')||info;
  (target||info).scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
 });shortcuts.append(b);}
 const mapLink=document.createElement('button');mapLink.type='button';mapLink.className='v290-map-link';mapLink.textContent='地図でまちを探す ↓';mapLink.addEventListener('click',()=>map.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
 home.append(heading,metrics,shortcuts,mapLink);picker.insertAdjacentElement('afterend',home);
 function labelValue(){return metricLabel?.textContent?.trim()||'地図の選択指標';}
 const sync=()=>{const v=name.textContent.trim();city.textContent=v&&v!=='読み込み中'?v:'読み込み中';field.textContent=labelValue();number.textContent=population.textContent.trim()||'—';const y=year?.selectedOptions?.[0]?.textContent?.trim()||'';source.textContent=y?`表示年度：${y}`:'調査年は各指標の表示をご確認ください';};
 let pending=false;const schedule=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;sync();});};
 for(const el of [name,population,metricLabel])if(el)new MutationObserver(schedule).observe(el,{childList:true,subtree:true,characterData:true});
 if(year)year.addEventListener('change',schedule);
 const indicator=document.getElementById('indicator-select');if(indicator)indicator.addEventListener('change',schedule);
 sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
