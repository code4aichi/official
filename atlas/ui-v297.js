/* MIERU AICHI v2.9.7 | compact external-statistics guidance only.
   No statistics, mapping, ranking, or map layout logic changes. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  function enhance(){
    const panel=byId('panel-external');
    const guide=byId('v289-stat-guide');
    if(!panel||!guide||guide.dataset.v297==='done')return !!guide;
    const top=guide.querySelector('.v289-guide-top');
    const desc=guide.querySelector('.v289-guide-desc');
    const city=guide.querySelector('.v289-guide-city');
    if(!top||!desc||!city)return false;
    // Preserve original dynamically updated nodes and their text for existing scripts.
    // Move the explanatory node to native details, rather than copying or hiding its content.
    const details=document.createElement('details');
    details.className='v297-guide-details';
    const summary=document.createElement('summary');
    summary.textContent='この統計の見方・注意点';
    details.append(summary,desc);
    guide.appendChild(details);
    guide.classList.add('v297-guide-compact');
    guide.dataset.v297='done';
    panel.classList.add('v297-external');
    return true;
  }
  function init(){
    if(enhance())return;
    const panel=byId('panel-external');
    if(!panel||!window.MutationObserver)return;
    const observer=new MutationObserver(()=>{if(enhance())observer.disconnect();});
    observer.observe(panel,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
