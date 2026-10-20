/* MIERU AICHI v2.8.8: accessible guidance for maps and charts; read-only, no data transformations. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const selectedText=el=>el?.selectedOptions?.[0]?.textContent?.trim()||'';
const explain=[
 ['panel-ranking','ランキングの読み方','指標の大きい順・小さい順を切り替えられます。順位は自治体の優劣を表すものではありません。'],
 ['panel-discovery','散布図の読み方','横軸と縦軸は異なる指標です。点が近い自治体は値の組み合わせが似ていますが、相関は原因を示しません。'],
 ['panel-compare','比較グラフの読み方','同じ調査年・定義の指標か確認してください。人数などの実数と割合では比較の意味が異なります。'],
 ['panel-trend','人口推移の読み方','年ごとの人口を比較します。増減率と人数の差は別の指標です。'],
 ['panel-external','追加統計の読み方','統計ごとに調査年・定義が異なります。地図の年度を変えても追加統計の調査年は変わりません。'],
 ['panel-challenge','地域の注目点の読み方','指標の組み合わせから特徴を探します。統計上の位置づけは、問題の原因や良し悪しを断定しません。']
];
function init(){
 const legend=document.querySelector('.map-legend');
 const indicator=$('indicator-select'),year=$('year-select'),meta=$('metric-meta');
 if(legend&&!$('v288-legend-note')){
  const wrap=document.createElement('div');wrap.className='v288-map-guide';wrap.id='v288-legend-note';
  wrap.innerHTML='<div class="v288-guide-heading"><strong>地図の色の読み方</strong><span id="v288-legend-title"></span></div><p id="v288-map-explain">色が濃い自治体ほど、選択した指標の値が大きいことを示します。</p><p class="v288-guide-caution">※ 正確な色分けの区間境界は、この表示では未掲載です。自治体を選んで実数値・単位を確認してください。色の濃淡は良し悪しを意味しません。</p>';
  legend.insertAdjacentElement('afterend',wrap);
  const title=$('v288-legend-title');
  const update=()=>{
   const metric=selectedText(indicator)||'選択中の指標';
   const y=selectedText(year)||'';
   title.textContent=[metric,y].filter(Boolean).join(' / ');
   const ratio=/(率|割合|比率|％|%)/.test(metric);
   $('v288-map-explain').textContent=ratio?'色の濃淡で割合の違いを示します。人数の多さを表しているわけではありません。':'色の濃淡で指標の値の大小を示します。人口・施設等の実数値は自治体の規模にも左右されます。';
  };
  [indicator,year].filter(Boolean).forEach(el=>el.addEventListener('change',update));
  if(indicator)new MutationObserver(update).observe(indicator,{childList:true,subtree:true});
  update();
 }
 for(const [panelId,title,body] of explain){
  const panel=$(panelId);if(!panel||panel.querySelector('.v288-chart-guide'))continue;
  const guide=document.createElement('details');guide.className='v288-chart-guide';
  guide.innerHTML='<summary></summary><p></p>';
  guide.querySelector('summary').textContent=title;
  guide.querySelector('p').textContent=body;
  const heading=panel.querySelector('h3, .section-caption, .v08-ranking-head, .compare-selects, .discovery-intro, .challenge-head');
  if(heading)heading.insertAdjacentElement('afterend',guide);else panel.prepend(guide);
 }
 const metaGuide=document.createElement('p');metaGuide.className='v288-unit-reminder';metaGuide.id='v288-unit-reminder';metaGuide.textContent='※ 指標の単位・集計対象・調査年は上の指標説明、選択した自治体の数値、出典でご確認ください。';
 if(meta&&!$('v288-unit-reminder'))meta.insertAdjacentElement('afterend',metaGuide);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
