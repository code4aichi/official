/* MIERU AICHI phase 2: responsive city jump without replacing map/workspace handlers. */
(()=>{
 'use strict';
 function ready(){
  const map=document.querySelector('.map-column');
  const aside=document.querySelector('.info-column');
  const selected=document.getElementById('selected-name');
  const amount=document.getElementById('population');
  if(!map||!aside||!selected)return;
  const bar=document.createElement('div');bar.className='v286-city-jump';bar.hidden=true;
  bar.setAttribute('aria-label','選択したまちの情報へ移動');
  const copy=document.createElement('div');copy.className='v286-city-jump-copy';
  const name=document.createElement('div');name.className='v286-city-jump-name';
  const value=document.createElement('div');value.className='v286-city-jump-number';
  const go=document.createElement('button');go.type='button';go.className='v286-city-jump-go';go.textContent='情報を見る';
  const close=document.createElement('button');close.type='button';close.className='v286-city-jump-close';close.textContent='×';close.setAttribute('aria-label','案内を閉じる');
  copy.append(name,value);bar.append(copy,go,close);document.body.append(bar);
  const mobile=window.matchMedia('(max-width:1020px)');
  let mapVisible=false;let asideVisible=false;let dismissedName='';
  const sync=()=>{
   const city=selected.textContent.trim();
   const number=amount?.textContent?.trim()||'';
   name.textContent=city||'選択中のまち';value.textContent=number&&number!=='—'?`総人口：${number}`:'市町村の情報を確認';
   const valid=city&&city!=='読み込み中'&&city!=='—';
   bar.hidden=!(mobile.matches&&valid&&mapVisible&&!asideVisible&&city!==dismissedName);
  };
  go.addEventListener('click',()=>{bar.hidden=true;aside.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
  close.addEventListener('click',()=>{dismissedName=selected.textContent.trim();sync();});
  new MutationObserver(()=>{if(selected.textContent.trim()!==dismissedName)dismissedName='';sync();}).observe(selected,{childList:true,subtree:true,characterData:true});
  if(amount)new MutationObserver(sync).observe(amount,{childList:true,subtree:true,characterData:true});
  const observer=new IntersectionObserver(entries=>{for(const e of entries){if(e.target===map)mapVisible=e.isIntersecting;if(e.target===aside)asideVisible=e.isIntersecting;}sync();},{threshold:0.08});
  observer.observe(map);observer.observe(aside);
  if(mobile.addEventListener)mobile.addEventListener('change',sync);else mobile.addListener(sync);
  sync();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
