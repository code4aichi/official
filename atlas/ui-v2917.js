/* v2.9.17: user-operable report and AI navigation; does not alter data or layout sizing. */
(()=>{'use strict';
const MODES=[['report','レポートを作成','2〜3自治体の統計を比較・出力'],['ai-nav','AIに聞く','公開統計を質問で探す']];
function initialize(){
 const quick=document.getElementById('v291-quicknav');
 const expanded=document.getElementById('v291-all-features');
 const nav=document.querySelector('.info-column .workspace-nav');
 if(!quick||!expanded||!nav||document.getElementById('v2917-actions'))return;
 const area=document.createElement('nav');area.id='v2917-actions';area.className='v2917-actions';
 area.setAttribute('aria-label','レポート・AIの機能');
 for(const [mode,label,description] of MODES){
   const source=nav.querySelector('.workspace-nav-button[data-workspace="'+mode+'"]');
   if(!source)continue;
   const button=document.createElement('button');button.type='button';
   button.className='v2917-action';button.dataset.mode=mode;
   button.setAttribute('aria-pressed','false');
   const title=document.createElement('strong');title.textContent=label;
   const sub=document.createElement('span');sub.textContent=description;
   button.append(title,sub);
   button.addEventListener('click',()=>{
      // An explicit human click forwards to the existing workspace controller.
      source.click();
      const panel=document.getElementById('panel-'+mode);
      if(panel && !panel.hidden && panel.getBoundingClientRect().height>0){
         const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
         panel.scrollIntoView({behavior:reduce?'auto':'smooth',block:'start'});
      }
   });
   area.append(button);
 }
 if(!area.children.length)return;
 // Place before the older purpose navigation, in the existing disclosure.
 expanded.insertBefore(area,expanded.querySelector('.v285-purpose-nav')||expanded.firstChild);
 function sync(){
   const current=nav.querySelector('.workspace-nav-button.is-current')?.dataset.workspace;
   for(const button of area.querySelectorAll('button')){
     const selected=button.dataset.mode===current;
     button.classList.toggle('is-current',selected);
     button.setAttribute('aria-pressed',String(selected));
   }
 }
 new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
 sync();
}
function boot(){
 initialize();
 if(document.getElementById('v2917-actions'))return;
 // Older navigation initializes on DOMContentLoaded; allow it to finish first.
 let attempts=0;const observer=new MutationObserver(()=>{initialize();if(document.getElementById('v2917-actions')||++attempts>50)observer.disconnect()});
 observer.observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
