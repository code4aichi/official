/* MIERU AICHI v2.6: deterministic two-indicator discovery using ONLY existing verified local data. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const themes = Object.freeze({
    aging: {title:'高齢化と高齢単身世帯', axes:[{id:'elderly',direction:'high'},{id:'elderly_single_rate',direction:'high'}], rationale:'高齢化と高齢単身世帯の割合が、ともに自治体分布の上位25%に位置する組合せ'},
    family:{title:'人口変化と子育て世帯',axes:[{id:'change',direction:'low'},{id:'under18_households_rate',direction:'low'}],rationale:'人口増減率と18歳未満の人がいる世帯の割合が、ともに自治体分布の下位25%に位置する組合せ'},
    housing:{title:'借家と単身世帯',axes:[{id:'rental_rate',direction:'high'},{id:'single_rate',direction:'high'}],rationale:'借家率と単身世帯率が、ともに自治体分布の上位25%に位置する組合せ'},
    education:{title:'児童数と高齢化',axes:[{id:'primary_students_per_school',direction:'low'},{id:'elderly',direction:'high'}],rationale:'小学校1校当たり児童数が下位25%、高齢化率が上位25%に位置する組合せ'}
  });
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  function quantile(sorted,q){if(!sorted.length)return NaN;const pos=(sorted.length-1)*q;const lo=Math.floor(pos),hi=Math.ceil(pos);return sorted[lo]+(sorted[hi]-sorted[lo])*(pos-lo);}
  function render(){
    const api=window.MieruAiData, status=$('challenge-status'),results=$('challenge-results'),axes=$('challenge-axis');
    if(!results||!status||!axes)return;
    results.replaceChildren();axes.replaceChildren();
    if(!api?.ready?.()){status.textContent='統計データを準備しています。読み込み後に再表示してください。';return;}
    if(api.currentYear()!==2025){status.textContent='この機能は2025年の検証済み統計を使用します。上部の「表示年度」を2025年に切り替えてください。';return;}
    const t=themes[$('challenge-theme').value]||themes.aging;
    const cities=api.municipalities(),stats=t.axes.map(axis=>{
      const metric=api.metric(axis.id),rows=cities.map(c=>({...c,value:api.value2025(c.code,axis.id)})).filter(c=>Number.isFinite(c.value));
      const sorted=rows.map(x=>x.value).sort((a,b)=>a-b);
      const threshold=quantile(sorted,axis.direction==='high'?.75:.25);
      return {...axis,metric,rows,threshold,count:rows.length};
    });
    if(stats.some(s=>!s.metric||s.count<40)){status.textContent='この組合せに必要な統計が不足しています。別の視点をお試しください。';return;}
    const labels=stats.map(s=>`${s.metric.label}：${s.direction==='high'?'上位':'下位'}25%（境界目安 ${api.format(s.threshold,s.id)}、有効${s.count}市町村）`);
    labels.forEach(label=>axes.append(node('div','challenge-axis-item',label)));
    const qualifying=cities.map(city=>{
      const measurements=stats.map(s=>({s,v:api.value2025(city.code,s.id)}));
      if(measurements.some(({v})=>!Number.isFinite(v)))return null;
      if(!measurements.every(({s,v})=>s.direction==='high'?v>=s.threshold:v<=s.threshold))return null;
      const distinctiveness=measurements.reduce((score,{s,v})=>{
        const relative=s.rows.filter(r=>s.direction==='high'?r.value>=v:r.value<=v).length;
        return score+(1-relative/s.count);
      },0);
      return {city,measurements,distinctiveness};
    }).filter(Boolean).sort((a,b)=>b.distinctiveness-a.distinctiveness||a.city.code.localeCompare(b.city.code));
    const note=`${t.title}：${qualifying.length} / ${cities.length}市町村が2条件に該当（各指標の対象${stats.map(s=>s.count).join('、')}市町村）。`;
    status.textContent=note;
    results.append(node('h4','',`該当する自治体：${qualifying.length}件`));
    results.append(node('p','challenge-intro',t.rationale+'。境界値と同値の自治体も含めます。'));
    if(!qualifying.length){results.append(node('p','challenge-empty','この条件に該当する自治体はありません。データ未収録は該当なしとは区別しています。'));return;}
    for(const {city,measurements} of qualifying){
      const card=node('article','challenge-result');
      const title=node('button','challenge-city',city.name+' → 地図で確認');title.type='button';
      title.addEventListener('click',()=>{api.selectCity(city.code);});
      card.append(title);
      for(const {s,v} of measurements){const p=node('p','challenge-value');p.append(node('span','',s.metric.label),node('strong','',api.format(v,s.id)));card.append(p);}
      card.append(node('p','challenge-source',measurements.map(({s})=>s.metric.source?.title||'出典は指標定義を参照').filter((x,i,a)=>a.indexOf(x)===i).join(' ／ ')));
      results.append(card);
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const select=$('challenge-theme');if(!select)return;
    select.addEventListener('change',render);
    $('year-select')?.addEventListener('change',render);
    document.querySelector('[data-workspace="challenge"]')?.addEventListener('click',render);
    $('city-select')?.addEventListener('change',()=>{
      for(const button of document.querySelectorAll('.challenge-city')){
        button.classList.toggle('is-selected',button.textContent.startsWith($('city-select')?.selectedOptions[0]?.textContent||'\0'));
      }
    });
    render();
  });
})();
