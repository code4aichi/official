/* MIERU AICHI v2.9.1: compact PC navigation; existing workspace controller owns state. */
(()=>{'use strict';
function init(){
 const aside=document.querySelector('.info-column'), nav=aside?.querySelector('.workspace-nav');
 const purpose=aside?.querySelector('.v285-purpose-nav');
 if(!aside||!nav||!purpose||document.getElementById('v291-quicknav'))return;
 const entries=[['city','基本情報'],['compare','まちを比較'],['ranking','ランキング'],['external','追加統計']];
 const original=[...nav.querySelectorAll('.workspace-nav-button')];
 const bar=document.createElement('section');bar.id='v291-quicknav';bar.className='v291-quicknav';bar.setAttribute('aria-label','よく使う機能');
 const top=document.createElement('div');top.className='v291-quicknav-heading';
 const label=document.createElement('strong');label.textContent='よく使う機能';
 const more=document.createElement('button');more.type='button';more.className='v291-more';more.textContent='その他の機能 ▾';more.setAttribute('aria-expanded','false');more.setAttribute('aria-controls','v291-all-features');
 top.append(label,more);
 const links=document.createElement('div');links.className='v291-quicknav-links';
 const buttons=new Map();
 function activate(mode){const source=original.find(b=>b.dataset.workspace===mode);if(source)source.click();}
 entries.forEach(([mode,text])=>{if(!original.some(b=>b.dataset.workspace===mode))return;const b=document.createElement('button');b.type='button';b.dataset.mode=mode;b.textContent=text;b.setAttribute('aria-pressed','false');b.addEventListener('click',()=>activate(mode));links.append(b);buttons.set(mode,b);});
 const advanced=document.createElement('div');advanced.id='v291-all-features';advanced.className='v291-all-features';advanced.hidden=true;
 const note=document.createElement('p');note.className='v291-advanced-hint';note.textContent='目的から機能を探す';advanced.append(note);
 // Move the existing purpose navigation, preserving listeners and IDs.
 advanced.append(purpose);
 bar.append(top,links,advanced);aside.insertBefore(bar,nav);
 function setExpanded(v){advanced.hidden=!v;more.setAttribute('aria-expanded',String(v));more.textContent=v?'その他の機能 ▴':'その他の機能 ▾';}
 more.addEventListener('click',()=>setExpanded(advanced.hidden));
 function sync(){const active=original.find(b=>b.classList.contains('is-current'));const id=active?.dataset.workspace;
  buttons.forEach((b,mode)=>{const selected=mode===id;b.classList.toggle('is-current',selected);b.setAttribute('aria-pressed',String(selected));});
  // When using a mode not in the quick links, expose its selection and description.
  if(id&&!buttons.has(id))setExpanded(true);
 }
 new MutationObserver(sync).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});sync();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
