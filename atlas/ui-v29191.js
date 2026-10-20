/* v2.9.19.1 compact information layout: visual-only DOM rearrangement. */
(() => {
  'use strict';
  const $ = (selector, root=document) => root.querySelector(selector);
  function install() {
    const shell = $('#v2918-shell');
    const detail = $('#explore .info-column > .detail');
    const reference = detail && $('.v2919-basic-reference',detail);
    const head = detail && $('.detail-head',detail);
    if (!shell || !detail || !reference || !head) return false;
    if (shell.classList.contains('v29191-ready')) return true;
    shell.classList.add('v29191-ready');
    // Relocate the existing miniature map; never touch or reparent #map-view.
    reference.classList.add('v29191-map-inset');
    reference.querySelector('.v2919-reference-selection')?.remove();
    reference.querySelector('.v2919-reference-desc')?.remove();
    const label = reference.querySelector('.v2919-reference-head strong');
    if (label) label.textContent = '県内の位置';
    reference.querySelector('.v2919-reference-head > span')?.remove();
    head.append(reference);
    const cmp = $('#panel-compare .v2919-compare-reference');
    if(cmp) {
      cmp.classList.add('v29191-compare-note');
      cmp.querySelector('.v2919-reference-map')?.remove();
      cmp.querySelector('.v2919-reference-desc')?.remove();
      const cmpTitle = cmp.querySelector('.v2919-reference-head strong');
      if(cmpTitle) cmpTitle.textContent = '比較対象';
      cmp.querySelector('.v2919-reference-head > span')?.remove();
    }
    // Turn the discovery location guide into a compact corner badge, not a new tall panel.
    const discovery = $('#panel-discovery .v2919-discovery-reference');
    if(discovery) {
      discovery.classList.add('v29191-discovery-note');
      discovery.querySelector('.v2919-reference-desc')?.remove();
    }
    return true;
  }
  function boot() {
    if (install()) return;
    let attempts=0;
    const timer=setInterval(()=>{if(install()||++attempts>=80)clearInterval(timer);},150);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
