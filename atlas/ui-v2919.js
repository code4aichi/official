/* MIERU AICHI v2.9.19: progressive UI-only refinements on v2.9.18.
   Never reparent the map or replace data-bound selectors. */
(() => {
  'use strict';
  const $ = (s,r=document) => r.querySelector(s);
  const nameOf = select => select?.selectedOptions?.[0]?.textContent?.trim() || '未選択';
  let scheduled = false;
  function referenceMap() {
    const original = $('#map-view svg');
    if (!original) return null;
    const copy = original.cloneNode(true);
    copy.removeAttribute('id');
    copy.setAttribute('aria-hidden','true');
    copy.setAttribute('focusable','false');
    copy.querySelectorAll('[id]').forEach((node,i) => {
      const old = node.id;
      if (!old) return;
      const newer = 'v2919-map-'+i+'-'+old;
      copy.querySelectorAll('*').forEach(n=>{
        for(const attr of ['clip-path','filter','mask','fill','stroke','href','xlink:href']) {
          const val=n.getAttribute(attr);
          if(val && (val.includes('url(#'+old+')') || val === '#'+old))
            n.setAttribute(attr,val.replaceAll('url(#'+old+')','url(#'+newer+')').replaceAll('#'+old,'#'+newer));
        }
      });
      node.id=newer;
    });
    copy.querySelectorAll('title,desc').forEach(el=>el.remove());
    return copy;
  }
  function buildReference(className, title, desc) {
    const aside=document.createElement('aside');
    aside.className=className+' v2919-reference';
    aside.innerHTML='<div class="v2919-reference-head"><strong>'+title+'</strong><span>位置の参考</span></div><div class="v2919-reference-map" aria-hidden="true"></div><p class="v2919-reference-desc">'+desc+'</p>';
    return aside;
  }
  function paintReference(target) {
    const host=$('.v2919-reference-map',target);
    if (!host || host.querySelector('svg')) return;
    const svg=referenceMap();
    if (svg) host.replaceChildren(svg);
    else host.textContent='地図を読み込むと、こちらに縮小表示します。';
  }
  function update() {
    scheduled=false;
    const shell=$('#v2918-shell');
    if(!shell) return;
    const city=nameOf($('#city-select'));
    const cityLabel=$('#v2919-current-city');
    if(cityLabel) cityLabel.textContent=city;
    const cmp=$('#v2919-compare-description');
    if(cmp) cmp.textContent=nameOf($('#compare-a'))+' と '+nameOf($('#compare-b'))+' の位置を、同じ愛知県地図で確認できます。比較数値は左のグラフをご覧ください。';
    shell.querySelectorAll('.v2919-reference').forEach(paintReference);
  }
  function queue() { if(!scheduled){scheduled=true;requestAnimationFrame(update);} }
  function initialize() {
    const shell=$('#v2918-shell'), detail=$('#explore .info-column > .detail');
    const compare=$('#panel-compare'), discovery=$('#panel-discovery'), external=$('#panel-external');
    if(!shell || !detail || !compare || !discovery || !external) return false;
    if(shell.classList.contains('v2919-ready')) return true;
    shell.classList.add('v2919-ready');

    const picker=$('.v2918-controls');
    if(picker){
      const city=$('.city-picker-control',picker), year=$('.year-picker-label',picker), count=$('.city-picker-count',picker);
      const metric=$('.metric-picker',picker);
      if(city){city.classList.add('v2919-filter-cell');city.dataset.label='市町村を選択';}
      if(year){year.classList.add('v2919-filter-cell');}
      if(metric) metric.classList.add('v2919-filter-group');
      if(count) count.classList.add('v2919-count');
      // Existing selects remain intact. A group label is visual only.
    }

    const basics=buildReference('v2919-basic-reference','愛知県内の位置','選択した自治体の位置は、左の「地図」タブで詳しく確認できます。');
    basics.innerHTML=basics.innerHTML.replace('</div><p class="v2919-reference-desc">','</div><p class="v2919-reference-selection">選択中：<strong id="v2919-current-city">—</strong></p><p class="v2919-reference-desc">');
    detail.insertBefore(basics, detail.querySelector('.metric-grid'));

    const comparison=buildReference('v2919-compare-reference','比較対象の位置を確認','自治体の位置関係を確認するための参考図です。');
    const compareNote=document.createElement('p');
    compareNote.id='v2919-compare-description';
    compareNote.className='v2919-reference-selection';
    comparison.insertBefore(compareNote,comparison.querySelector('.v2919-reference-desc'));
    compare.append(comparison);

    const discoveries=buildReference('v2919-discovery-reference','選択中のまちの位置','散布図の点を選んだ後、地図タブで自治体の場所を詳しく確認できます。');
    const discoveryChart=$('#discovery-chart',discovery);
    if(discoveryChart) discovery.insertBefore(discoveries,discoveryChart);
    else discovery.append(discoveries);

    const externalIntro=document.createElement('div');
    externalIntro.className='v2919-external-note';
    externalIntro.innerHTML='<strong>追加統計の見方</strong><p>上部で統計の種類を切り替え、下の欄で自治体別の数値や出典を確認できます。国勢調査の指標とは調査年・集計基準が異なる場合があります。</p>';
    const extTitle=external.querySelector('h3');
    if(extTitle) extTitle.after(externalIntro);

    ['city-select','year-select','compare-a','compare-b','category-select','indicator-select'].forEach(id=>{
      $('#'+id)?.addEventListener('change',queue);
    });
    // The map SVG is loaded asynchronously. Paint once it arrives.
    const map=$('#map-view');
    if(map){const observer=new MutationObserver(()=>{if(map.querySelector('svg')){observer.disconnect();queue();}});
      if(!map.querySelector('svg')) observer.observe(map,{subtree:true,childList:true});}
    const nav=new MutationObserver(queue);
    nav.observe(shell,{attributes:true,attributeFilter:['data-v2918-view']});
    queue();
    return true;
  }
  function boot(){if(initialize())return;let n=0;const t=setInterval(()=>{if(initialize()||++n>=45)clearInterval(t);},200);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
