/* MIERU AICHI v2.9.18: integrated exploration workspace.
 * UI-only. Existing data bindings and workspace controller remain authoritative.
 */
(() => {
  'use strict';
  const primary = [
    ['map', '地図', 'city'],
    ['basic', '基本情報', 'city'],
    ['compare', 'まちを比較', 'compare'],
    ['ranking', 'ランキング', 'ranking'],
    ['external', '追加統計', 'external']
  ];
  const secondary = [
    ['discovery', '特徴を発見'], ['challenge', '地域の注目点'],
    ['report', 'レポートを作成'], ['ai-nav', 'AIに聞く'],
    ['trend', '人口の推移'], ['story', 'まちの特徴']
  ];
  const $ = (selector, root = document) => root.querySelector(selector);
  const sourceFor = mode => $('.info-column .workspace-nav-button[data-workspace="' + mode + '"]');
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function createButton(label, view, sourceMode, className) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.dataset.v2918View = view;
    button.dataset.v2918Source = sourceMode;
    button.textContent = label;
    button.setAttribute('aria-pressed', 'false');
    return button;
  }
  function initialize() {
    const explore = $('#explore');
    const chooser = $('#explore > .city-picker');
    const workspace = $('#explore > .workspace');
    const mapCard = $('.map-column', workspace || document);
    const nav = $('.info-column .workspace-nav');
    if (!explore || !chooser || !workspace || !mapCard || !nav || $('#v2918-shell')) return false;
    const shell = document.createElement('div');
    shell.id = 'v2918-shell';
    shell.className = 'v2918-shell';
    shell.dataset.v2918View = 'map';
    const toolbar = document.createElement('div');
    toolbar.className = 'v2918-header';
    const title = document.createElement('div');
    title.className = 'v2918-heading';
    title.innerHTML = '<h3>愛知県 市町村マップ</h3><p>54市町村から、気になるまちを調べる</p>';
    const tabbar = document.createElement('nav');
    tabbar.className = 'v2918-tabs';
    tabbar.setAttribute('aria-label', '地図と統計の表示切替');
    primary.forEach(([view,label,mode]) => {
      if (!sourceFor(mode)) return;
      tabbar.append(createButton(label, view, mode, 'v2918-tab'));
    });
    const more = document.createElement('details');
    more.className = 'v2918-more';
    const summary = document.createElement('summary');
    summary.textContent = 'その他の機能';
    const menu = document.createElement('div');
    menu.className = 'v2918-menu';
    secondary.forEach(([mode,label]) => {
      if (!sourceFor(mode)) return;
      menu.append(createButton(label, mode, mode, 'v2918-menu-item'));
    });
    more.append(summary,menu);
    tabbar.append(more);
    toolbar.append(title,tabbar);
    const controls = document.createElement('div');
    controls.className = 'v2918-controls';
    const metricPicker = $('.metric-picker',mapCard);
    // Keep the existing select elements and their listeners, do not clone them.
    explore.insertBefore(shell, chooser);
    shell.append(toolbar, controls, workspace);
    controls.append(chooser);
    if (metricPicker) controls.append(metricPicker);
    const help = document.createElement('div');
    help.className = 'v2918-help';
    const meta = $('#metric-meta',mapCard);
    if (meta) { meta.classList.add('v2918-map-meta'); }
    // Preserve mapCard as direct workspace child for v2.9.6 height sync.
    const originalHeading = $('.map-heading',mapCard);
    if (originalHeading) originalHeading.classList.add('v2918-original-map-heading');
    const active = new Set(['map','basic',...secondary.map(x=>x[0]),'compare','ranking','external']);
    let lastCityView = 'map';
    const apply = (view, requestSource) => {
      if (!active.has(view)) view = 'map';
      const mode = (primary.find(p=>p[0]===view)||[])[2] || view;
      if (requestSource) {
        const source=sourceFor(mode);
        if (!source) return;
        source.click(); // Native controller remains responsible for switching the panels.
      }
      if (mode==='city') {
        lastCityView=view;
        if(view==='basic'){
          const select=$('#detail-section-select');
          if(select && select.value!=='overview'){
            select.value='overview';
            select.dispatchEvent(new Event('change',{bubbles:true}));
          }
        }
      }
      shell.dataset.v2918View=view;
      for(const button of shell.querySelectorAll('[data-v2918-view]')){
        const chosen=button.dataset.v2918View===view;
        button.classList.toggle('is-active',chosen);
        button.setAttribute('aria-pressed', String(chosen));
      }
      const primaryActive = tabbar.querySelector('.v2918-tab.is-active');
      more.classList.toggle('is-active',!primaryActive);
      if(requestSource) more.open=false;
    };
    shell.addEventListener('click',e=>{
      const button=e.target.closest('button[data-v2918-view]');
      if(!button || !shell.contains(button)) return;
      apply(button.dataset.v2918View,true);
    });
    // Keep tabs in sync when users navigate with existing header/shortcut controls.
    const updateFromNav=()=>{
      const current=nav.querySelector('.workspace-nav-button.is-current')?.dataset.workspace;
      if(!current) return;
      const view=current==='city'?lastCityView:current;
      if(shell.dataset.v2918View!==view) apply(view,false);
    };
    const observer=new MutationObserver(updateFromNav);
    observer.observe(nav,{attributes:true,subtree:true,attributeFilter:['class','aria-pressed']});
    updateFromNav();
    apply(shell.dataset.v2918View,false);
    // Anchor links remain valid even after moving the picker and map inside the new shell.
    shell.setAttribute('aria-label','愛知県の地図・統計の統合操作エリア');
    return true;
  }
  function boot(){
    if(initialize()) return;
    let tries=0;
    const timer=setInterval(()=>{if(initialize() || ++tries>30) clearInterval(timer);},150);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
