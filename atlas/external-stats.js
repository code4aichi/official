/* v2.7: reads only manually approved external indicators; never changes census datasets. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const datasetRoot = './data/external-statistics/';
  const valid = x => x && typeof x === 'object' && x.status === 'approved' && x.schema_version === 1 && x.geography === 'aichi_54_municipalities' && Object.keys(x.cities||{}).length===54 && x.source?.type==='estat';
  const element=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
  let catalog=[];
  const loaded=new Map();
  function safeFile(name){return /^[a-z][a-z0-9_]{2,45}\.json$/.test(name);}
  async function initialize(){
    const selector=$('external-indicator'), status=$('external-status');
    if(!selector||!status)return;
    try {
      const response=await fetch(datasetRoot+'catalog.json',{cache:'no-store'});
      if(!response.ok)throw Error('catalog not published');
      const data=await response.json();
      if(data.schema_version!==1 || !Array.isArray(data.indicators))throw Error('catalog invalid');
      catalog=data.indicators.filter(x=>safeFile(x.file)&&x.id===x.file.slice(0,-5));
      selector.replaceChildren();
      if(!catalog.length){status.textContent='承認済みの追加統計はまだありません。国勢調査の表示には影響しません。';return;}
      for(const item of catalog){const option=new Option(`${item.label}（${item.year}年）`,item.id);selector.add(option);}
      selector.disabled=false;
      status.textContent=`承認済みの追加統計：${catalog.length}指標`;
      await render();
    }catch(e){status.textContent='追加統計は準備中です。既存の国勢調査データはこれまでどおり利用できます。';}
  }
  async function render(){
    const selected=$('external-indicator')?.value, entry=catalog.find(x=>x.id===selected);
    const status=$('external-status'),list=$('external-list'),source=$('external-source');
    if(!entry||!list)return;
    status.textContent='追加統計を読み込み中…';list.replaceChildren();source.replaceChildren();
    try{
      let data=loaded.get(entry.id);
      if(!data){const response=await fetch(datasetRoot+entry.file);if(!response.ok)throw Error('file not found');data=await response.json();if(!valid(data)||data.id!==entry.id)throw Error('invalid source');loaded.set(entry.id,data);}
      const items=Object.entries(data.cities).map(([code,v])=>({code,...v})).sort((a,b)=>b.value-a.value);
      const selectedCode=$('city-select')?.value;
      for(const row of items){
        const item=element('button','external-stat-item');item.type='button';item.classList.toggle('is-selected',row.code===selectedCode);
        item.append(element('span','external-city-name',row.name),element('strong','external-city-value',`${row.value.toLocaleString('ja-JP')} ${data.unit}`));
        item.addEventListener('click',()=>{const picker=$('city-select');if(!picker)return;picker.value=row.code;picker.dispatchEvent(new Event('change',{bubbles:true}));list.querySelectorAll('.external-stat-item').forEach(b=>b.classList.remove('is-selected'));item.classList.add('is-selected');});
        list.append(item);
      }
      const a=element('a','',`出典：${data.source.title}（e-Stat 統計表ID ${data.source.statsDataId}） ↗`);a.href=data.source.url;a.target='_blank';a.rel='noopener noreferrer';source.append(a);
      source.append(element('p','',`対象年：${data.year}年　単位：${data.unit}。${data.definition||''} ${data.limitations||''}`));
      status.textContent=`${items.length}市町村の承認済みデータ。選ぶと左の地図の自治体選択も切り替わります。`;
    }catch(e){status.textContent='追加統計の形式または読み込みに問題があります。公開データを確認してください。';}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    if(!$('external-indicator'))return;
    $('external-indicator').addEventListener('change',render);
    initialize();
  });
})();
