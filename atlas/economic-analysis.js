/* MIERU AICHI v2.8: supplemental 2021 economic analysis. Census files are untouched. */
(() => {
  'use strict';
  const ROOT = './data/external-statistics/';
  const FILES = ['economic_2021_private_establishments.json', 'economic_2021_private_employees.json'];
  const $ = id => document.getElementById(id);
  const fmt = n => new Intl.NumberFormat('ja-JP').format(n);
  const decimal = n => new Intl.NumberFormat('ja-JP', {maximumFractionDigits:1,minimumFractionDigits:1}).format(n);
  const el = (tag, cls, txt) => {const node = document.createElement(tag); if(cls) node.className=cls; if(txt!==undefined) node.textContent=txt; return node;};
  let rows=[], selected='';
  const valid = (d,id)=>d?.status==='approved' && d?.schema_version===1 && d?.geography==='aichi_54_municipalities' && d?.id===id && d?.year===2021 && d?.source?.type==='estat' && d.source.statsDataId==='0004005640' && Object.keys(d.cities||{}).length===54;
  async function load(){
    const datasets = await Promise.all(FILES.map(async f=>{const r=await fetch(ROOT+f); if(!r.ok)throw new Error('dataset unavailable'); return r.json();}));
    if(!valid(datasets[0],'economic_2021_private_establishments')||!valid(datasets[1],'economic_2021_private_employees'))throw new Error('unapproved or incompatible data');
    const a=datasets[0].cities, b=datasets[1].cities;
    if(Object.keys(a).sort().join(',')!==Object.keys(b).sort().join(','))throw new Error('area codes mismatch');
    rows=Object.keys(a).map(code=>{
      const est=a[code].value, emp=b[code].value;
      if(a[code].name!==b[code].name || !Number.isSafeInteger(est)||est<=0||!Number.isSafeInteger(emp)||emp<0)throw new Error('invalid municipal record');
      return {code,name:a[code].name,est,emp,ratio:emp/est};
    });
    if(rows.reduce((s,x)=>s+x.est,0)!==299232 || rows.reduce((s,x)=>s+x.emp,0)!==3818542)throw new Error('prefecture check failed');
    selected=$('city-select')?.value||rows[0].code;
  }
  function show(){
    const host=$('economic-analysis');if(!host||!rows.length)return;
    host.replaceChildren();
    const header=el('div','economic-head');header.append(el('h4','', '産業・雇用の比較（2021年）'),el('p','economic-note','令和3年経済センサス確報。民営事業所・事業所所在地ベースの統計です。'));
    host.append(header);
    const metricLabel=el('label','economic-label','比較する指標');
    const metric=el('select','economic-select');metric.id='economic-metric';
    [['est','民営事業所数'],['emp','民営事業所の従業者数'],['ratio','1事業所当たり従業者数（計算値）']].forEach(([v,t])=>metric.add(new Option(t,v)));
    metricLabel.append(metric);host.append(metricLabel);
    const focusLabel=el('label','economic-label','注目する自治体');
    const picker=el('select','economic-select');picker.id='economic-city';
    for(const row of [...rows].sort((a,b)=>a.name.localeCompare(b.name,'ja'))){picker.add(new Option(row.name,row.code));}
    picker.value=rows.some(x=>x.code===selected)?selected:rows[0].code;
    focusLabel.append(picker);host.append(focusLabel);
    const summary=el('div','economic-summary');host.append(summary);
    const subtitle=el('p','economic-note');host.append(subtitle);
    const chart=el('div','economic-bars');host.append(chart);
    const footer=el('p','economic-note','出典：e-Stat「令和3年経済センサス‐活動調査（確報）」表1-1（うち民営、2021年6月1日）。比率は従業者数÷事業所数（小数第1位に丸め）。人口・居住地別就業者数とは異なります。');host.append(footer);
    const link=el('a','economic-source','統計表・出典を確認 ↗');link.href='https://www.e-stat.go.jp/dbview?sid=0004005640';link.target='_blank';link.rel='noopener noreferrer';host.append(link);
    const redraw=()=>{
      const key=metric.value,unit=key==='est'?'事業所':key==='emp'?'人':'人／事業所';
      const ordered=[...rows].sort((a,b)=>b[key]-a[key]);
      const current=rows.find(x=>x.code===picker.value)||rows[0];
      selected=current.code;
      const rank=ordered.findIndex(x=>x.code===current.code)+1;
      const pref=key==='ratio'?3818542/299232:rows.reduce((s,x)=>s+x[key],0);
      const display=n=>key==='ratio'?decimal(n):fmt(n);
      summary.replaceChildren();
      [['選択自治体',current.name],['選択した指標',`${display(current[key])} ${unit}`],['54市町村中',`${rank}位`],['県全体',`${display(pref)} ${unit}`]].forEach(([title,v])=>{
        const tile=el('div','economic-stat');tile.append(el('small','',title),el('strong','',v));summary.append(tile);
      });
      subtitle.textContent='上位10市町村と選択中の自治体を表示（順位は全54市町村内）';
      chart.replaceChildren();
      const displayed=ordered.slice(0,10);
      if(!displayed.some(x=>x.code===current.code))displayed.push(current);
      const max=ordered[0][key];
      for(const item of displayed){
        const bar=el('button','economic-bar'+(item.code===current.code?' is-active':''));bar.type='button';bar.setAttribute('aria-label',`${item.name} ${display(item[key])} ${unit}`);
        const rankText=el('span','economic-bar-name',`${ordered.findIndex(x=>x.code===item.code)+1}位 ${item.name}`);
        const track=el('span','economic-bar-track');const fill=el('span','economic-bar-fill');fill.style.width=`${Math.max(.8,item[key]/max*100)}%`;track.append(fill);
        const value=el('strong','economic-bar-number',`${display(item[key])} ${unit}`);
        bar.append(rankText,track,value);
        bar.addEventListener('click',()=>{picker.value=item.code;selectOnMap(item.code);redraw();});chart.append(bar);
      }
    };
    function selectOnMap(code){const p=$('city-select');if(p && [...p.options].some(o=>o.value===code)){p.value=code;p.dispatchEvent(new Event('change',{bubbles:true}));}}
    metric.addEventListener('change',redraw);
    picker.addEventListener('change',()=>{selectOnMap(picker.value);redraw();});
    $('city-select')?.addEventListener('change',()=>{const code=$('city-select').value;if(rows.some(x=>x.code===code)&&picker.value!==code){picker.value=code;redraw();}});
    redraw();
  }
  document.addEventListener('DOMContentLoaded',async()=>{
    const target=$('economic-analysis');if(!target)return;
    try{await load();show();}catch(err){target.replaceChildren(el('p','economic-note','産業比較データを検証できませんでした。既存の追加統計・国勢調査は引き続き利用できます。'));console.warn('Economic analysis unavailable:',err.message);}
  });
})();
