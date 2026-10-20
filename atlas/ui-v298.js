/* MIERU AICHI v2.9.8: mobile reading/navigation helpers only. */
(()=>{'use strict';
 function init(){
  if(document.getElementById('v298-back-actions'))return;
  const info=document.querySelector('#explore .info-column');
  const map=document.querySelector('#explore .map-column');
  const chooser=document.querySelector('.city-picker');
  if(!info||!map||!chooser)return;
  const actions=document.createElement('nav');
  actions.id='v298-back-actions';actions.className='v298-back-actions';
  actions.setAttribute('aria-label','スマートフォンのページ内移動');
  const buttons=[['地図を見る',map],['まちを選ぶ',chooser]];
  for(const [label,target] of buttons){
   const button=document.createElement('button');button.type='button';button.textContent=label;
   button.addEventListener('click',()=>target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
   actions.append(button);
  }
  info.append(actions);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
