/* MIERU AICHI v2.9.2: remove presentation redundancy, never alter data or original event handlers. */
(()=>{'use strict';
const byId=id=>document.getElementById(id);
function init(){
 if(byId('v292-installed'))return;
 const marker=document.createElement('span');marker.id='v292-installed';marker.hidden=true;document.body.append(marker);
 // Put the existing map-reading notes behind an accessible native disclosure.
 const map=document.querySelector('.map-column');
 const legendGuide=byId('v288-legend-note');
 if(map&&legendGuide&&!byId('v292-map-explanation')){
  const disclosure=document.createElement('details');disclosure.id='v292-map-explanation';disclosure.className='v292-disclosure';
  const summary=document.createElement('summary');summary.textContent='地図の見方・色分けの注意';
  disclosure.append(summary,legendGuide);const anchor=map.querySelector('.map-under')||map.querySelector('.map-source');
  if(anchor)anchor.insertAdjacentElement('afterend',disclosure);else map.append(disclosure);
 }
 // Preserve source links and notes while reducing how much space static guidance takes.
 const guide=byId('guide');
 if(guide&&!byId('v292-guide-toggle')){
  const content=guide.querySelector('div');
  if(content){const paragraphs=[...content.children].filter(el=>el.matches('p'));
   if(paragraphs.length){const details=document.createElement('details');details.id='v292-guide-toggle';details.className='v292-disclosure';
    const summary=document.createElement('summary');summary.textContent='詳しい集計定義・比較時の注意を読む';details.append(summary);
    for(const p of paragraphs)details.append(p);content.append(details);
   }
  }
 }
 // Duplicate on-screen values have no information value. Only suppress an exact match.
 const active= document.querySelector('.active-metric-card');
 const primary=byId('population'),current=byId('active-metric-value'),label=byId('primary-metric-label'),activeLabel=byId('active-metric-label');
 if(active&&primary&&current&&label&&activeLabel){
  let pending=false;
  const normalize=s=>(s||'').replace(/\s+/g,'').replace(/[（(]20\d{2}年[）)]/g,'').trim();
  const sync=()=>{pending=false;const a=normalize(current.textContent),b=normalize(primary.textContent);
   const l=normalize(label.textContent),al=normalize(activeLabel.textContent);
   // Only suppress when both measures and values match; retain all other metrics.
   const same=!!a&&a!=='—'&&a===b&&(l===al||al==='地図で選択中の指標'||al==='選択中の指標');
   active.classList.toggle('v292-exact-duplicate',same);
  };
  const schedule=()=>{if(!pending){pending=true;requestAnimationFrame(sync)}};
  for(const node of [primary,current,label,activeLabel])new MutationObserver(schedule).observe(node,{subtree:true,childList:true,characterData:true});sync();
 }
 // When an external-statistics info panel is displayed, use the existing disclosure, not a second long explanation.
 const stats=byId('panel-external');if(stats)stats.classList.add('v292-external');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
