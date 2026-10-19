/* v2.4.1 — UI coordination only; source data and metric calculations remain in app.js. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const nav = [...document.querySelectorAll('.workspace-nav-button')];
  const detail = $('.info-column > .detail');
  const tools = $('#tools');
  const legacy = new Map([...document.querySelectorAll('.tool-tab')].map(b => [b.dataset.panel,b]));
  const state = { active:'city' };
  function activate(id) {
    if (id !== 'city' && !legacy.has(id)) id = 'city';
    state.active=id;
    for(const b of nav){const current=b.dataset.workspace===id;b.classList.toggle('is-current',current);b.setAttribute('aria-pressed',String(current));}
    detail.hidden = id!=='city';
    tools.hidden = id==='city';
    if(id!=='city') legacy.get(id).click();
    const aside=$('.info-column');
    if(aside) aside.scrollTop=0;
    // Explicitly avoid scrolling the document. Keep the map visible on every workspace change.
  }
  nav.forEach(b=>b.addEventListener('click',()=>activate(b.dataset.workspace)));
  // Existing story CTA formerly scrolled down to the old lower tool area.
  const story=$('#open-story');
  if(story){story.addEventListener('click',(event)=>{event.stopImmediatePropagation();activate('story');},true);}
  window.MIERU_WORKSPACE = {open:activate};

  const search=$('#discovery-city-search');
  const selected=$('#discovery-selected');
  const dots=$('#discovery-chart');
  if(search && dots){
    // The map/list selector is filled by app.js only after the census dataset has loaded.
    const cityPicker=$('#city-select')||document.querySelector('.city-picker select');
    const syncOptions=()=>{
      if(!cityPicker || cityPicker.options.length<2)return;
      if(search.options.length!==cityPicker.options.length){
        search.replaceChildren(...[...cityPicker.options].map(o=>new Option(o.textContent,o.value)));
      }
      search.value=cityPicker.value;
    };
    search.addEventListener('change',()=>{
      if(!search.value)return;
      if(cityPicker){cityPicker.value=search.value;cityPicker.dispatchEvent(new Event('change',{bubbles:true}));}
    });
    // Adds a clear name label to the clicked / keyboard-selected SVG dot.
    const updateLabels=()=>{
      const svg=dots.querySelector('svg');if(!svg)return;
      svg.querySelectorAll('.discovery-floating-label').forEach(n=>n.remove());
      const point=svg.querySelector('circle.discovery-dot.is-selected');
      if(!point)return;
      const raw=point.getAttribute('aria-label')||'';
      const cityName=raw.split('、')[0];
      if(!cityName)return;
      const cx=+point.getAttribute('cx'),cy=+point.getAttribute('cy');
      const ns='http://www.w3.org/2000/svg';
      const group=document.createElementNS(ns,'g');group.setAttribute('class','discovery-floating-label');group.setAttribute('pointer-events','none');
      const w=Math.max(67,Math.min(cityName.length*15+20,140));
      const x=Math.max(103,Math.min(cx-w/2,735-w));
      const y=Math.max(4,cy-40);
      const rect=document.createElementNS(ns,'rect');Object.entries({x,y,width:w,height:27,rx:7}).forEach(([k,v])=>rect.setAttribute(k,v));
      const text=document.createElementNS(ns,'text');Object.entries({x:x+w/2,y:y+18,'text-anchor':'middle'}).forEach(([k,v])=>text.setAttribute(k,v));text.textContent=cityName;
      group.append(rect,text);svg.append(group);
      // Hover/focus labels on any point, not only selected ones.
      for(const dot of svg.querySelectorAll('circle.discovery-dot')){
        dot.addEventListener('mouseenter',()=>showHover(dot));
        dot.addEventListener('focus',()=>showHover(dot));
        dot.addEventListener('mouseleave',()=>{if(selected)selected.classList.remove('is-hovered')});
      }
    };
    function showHover(dot){
      const label=dot.getAttribute('aria-label')||'';
      if(selected){selected.classList.add('is-hovered');selected.setAttribute('data-hover',label.replaceAll('、',' ／ '));}
    }
    let observedSvg=null;
    const observer=new MutationObserver(()=>{const current=dots.querySelector('svg');if(current===observedSvg)return;observedSvg=current;syncOptions();updateLabels()});
    observer.observe(dots,{childList:true});
    // options may be set after chart; this is called again on later chart renders.
    if(cityPicker)new MutationObserver(syncOptions).observe(cityPicker,{childList:true});
    syncOptions();updateLabels();
  }
})();
