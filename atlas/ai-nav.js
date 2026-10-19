'use strict';
(() => {
  const metrics = [
    ['elderly','高齢化率',['高齢化','高齢者の割合','65歳以上の割合']],
    ['elderly_single_rate','高齢単身世帯率',['高齢単身','高齢者の一人暮らし']],
    ['single_rate','単身世帯率',['単身','一人暮らし','ひとり暮らし']],
    ['under18_households_rate','18歳未満がいる世帯率',['子育て世帯','18歳未満','子どものいる世帯']],
    ['primary_students_per_school','小学校1校当たり児童数',['小学校の規模','小学校あたり','小学校1校あたり']],
    ['junior_students_per_school','中学校1校当たり生徒数',['中学校の規模','中学校あたり','中学校1校あたり']],
    ['primary_students','小学校児童数',['小学校児童','小学生の人数','児童数']],
    ['junior_students','中学校生徒数',['中学校生徒','中学生の人数','生徒数']],
    ['primary_schools','小学校数',['小学校数','小学校の数']],
    ['junior_schools','中学校数',['中学校数','中学校の数']],
    ['owner_rate','持ち家率',['持ち家','持家']],
    ['rental_rate','借家率',['借家','賃貸']],
    ['apartment_rate','共同住宅率',['共同住宅','マンション','アパート']],
    ['detached_rate','一戸建率',['一戸建','戸建']],
    ['change','人口増減率',['人口増減','人口変化','人口が増','人口が減']],
    ['couple_only','夫婦のみの世帯数',['夫婦のみ','夫婦世帯数']],
    ['population','総人口',['人口','住民数','何人']],
  ];
  const el = id => document.getElementById(id);
  const api = () => window.MieruAiData;
  const endpoint = () => typeof window.MIERU_AI_WORKER_URL === 'string' ? window.MIERU_AI_WORKER_URL.trim().replace(/\/$/,'') : '';
  const sourceDate = id => ['primary_students','junior_students','primary_schools','junior_schools','primary_students_per_school','junior_students_per_school'].includes(id) ? '2025年5月1日' : '2025年10月1日';
  function detectMetric(q){
    for (const [id,label,terms] of metrics) if(q.includes(label) || terms.some(t=>q.includes(t))) return id;
    return null;
  }
  function findCities(q){
    const names=api().municipalities();
    // 長い自治体名を優先。市・町・村を省略した単独地名は誤認防止のため使わない。
    return names.filter(c=>q.includes(c.name)).slice(0,3);
  }
  function node(tag,text,cls){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function renderEvidence(root,facts,meta){
    const box=node('div',undefined,'ai-nav-evidence');box.append(node('h4','確認できた統計値'));
    const table=node('table');const head=node('tr');['自治体',meta.label+'（'+(meta.unit||'')+'）','基準日'].forEach(x=>head.append(node('th',x)));table.append(head);
    facts.forEach(f=>{const tr=node('tr');[f.city,f.formatted,f.asof].forEach(x=>tr.append(node('td',x)));table.append(tr)});
    box.append(table);box.append(node('p',`指標：${meta.label}。出典：${meta.source}。${meta.description||''}`,'ai-nav-footnote'));
    root.append(box);
  }
  function simpleText(facts,meta){
    if(facts.length===1)return `${facts[0].city}の${meta.label}は${facts[0].formatted}です。上の表で出典と基準日をご確認ください。`;
    const sorted=[...facts].sort((a,b)=>b.value-a.value);
    return `${facts.map(f=>`${f.city}：${f.formatted}`).join('、')}。今回比較した自治体の中では${sorted[0].city}が最も高い値です。数値の大小だけで地域の優劣や原因は判断できません。`;
  }
  async function answer(question){
    const a=api(),status=el('ai-nav-status'),result=el('ai-nav-result'),submit=el('ai-nav-submit');
    result.replaceChildren();if(!a?.ready()){status.textContent='統計データの読み込みが完了していません。';return;}
    if(a.currentYear()!==2025){status.textContent='AIナビゲーターは現在2025年に対応しています。画面の年度を2025年へ切り替えてください。';return;}
    const key=detectMetric(question),found=findCities(question);
    if(!key){status.textContent='指標を特定できませんでした。「高齢化率」「単身世帯率」「持ち家率」「児童数」などを含めてください。';return;}
    const cities=found.length?found:[a.municipalities().find(c=>c.code===a.selectedCity())].filter(Boolean);
    const meta=a.metric(key);if(!meta){status.textContent='この指標は未登録です。';return;}
    const facts=cities.map(c=>({code:c.code,city:c.name,value:a.value2025(c.code,key)})).filter(f=>Number.isFinite(f.value)).map(f=>({...f,formatted:a.format(f.value,key),asof:sourceDate(key)}));
    if(!facts.length){status.textContent='該当する自治体・指標の確定データは未収録です。推測した数字は表示しません。';return;}
    status.textContent=`${facts.length}自治体の登録済み統計から回答しています。`;
    const article=node('article',undefined,'ai-nav-answer');article.append(node('h4','統計に基づく回答'));
    const text=node('p',simpleText(facts,meta));article.append(text);result.append(article);renderEvidence(result,facts,meta);
    const actions=node('div',undefined,'ai-nav-actions');const btn=node('button','地図で見る');btn.type='button';btn.addEventListener('click',()=>{a.selectCity(facts[0].code);a.selectMetric(key);document.getElementById('explore')?.scrollIntoView({behavior:'smooth'})});actions.append(btn);result.append(actions);
    if(!endpoint()){status.textContent+=' AI接続は未設定のため統計検索モードです。';return;}
    // サイトがHTTPSでもHTTPのエンドポイントは呼び出さない。
    let target;try{target=new URL(endpoint());if(target.protocol!=='https:')throw Error('https required');}catch{status.textContent='AI接続URLの形式が正しくありません。統計検索のみ利用できます。';return;}
    submit.disabled=true;status.textContent='検証済み統計を表示しました。AI解説を生成しています…';
    try {
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
      let r;try{r=await fetch(target.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,evidence:{metric:key,label:meta.label,source:meta.source,description:meta.description||'',facts:facts.map(({code,city,value,formatted,asof})=>({code,city,value,formatted,asof}))}}),signal:controller.signal})}finally{clearTimeout(timer)}
      if(!r.ok)throw new Error('AIサービスに接続できません（'+r.status+'）');const payload=await r.json();if(typeof payload.answer!=='string'||!payload.answer.trim())throw new Error('AI回答が空でした');
      const explanation=node('article',undefined,'ai-nav-answer');explanation.append(node('h4','AIによる補足解説'));explanation.append(node('p',payload.answer.slice(0,2000)));explanation.append(node('p','※ AI文章は誤りを含むことがあります。数値は上の確認済み統計表を優先してください。','ai-nav-footnote'));result.append(explanation);
      status.textContent='統計値とAI補足解説を表示しました。';
    }catch(e){status.textContent='AI解説を取得できませんでした。統計検索の結果は引き続き利用できます。';console.warn('AI connection:',e.message)}finally{submit.disabled=false}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const form=el('ai-nav-form');if(!form)return;
    el('ai-nav-state').textContent=endpoint()?'AI接続設定あり':'統計検索モード';
    form.addEventListener('submit',e=>{e.preventDefault();const q=el('ai-nav-input').value.trim().slice(0,160);if(q)answer(q)});
    document.querySelectorAll('[data-ai-example]').forEach(b=>b.addEventListener('click',()=>{el('ai-nav-input').value=b.dataset.aiExample;answer(b.dataset.aiExample)}));
  });
})();
