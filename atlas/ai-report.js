/* MIERU AICHI v2.5: AI report commentary, never modifies census/education JSON. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const endpoint = () => String(window.MIERU_AI_WORKER_URL || '').trim().replace(/\/$/, '');
  let controller = null;
  let runId = 0;
  function show(message, kind='') { const node=$('ai-report-status');if(node){node.textContent=message;node.dataset.kind=kind;} }
  function clear() { runId++;controller?.abort();controller=null;const out=$('ai-report-output');if(out)out.replaceChildren();show('自治体の組み合わせを変更しました。必要ならAI解説を生成し直してください。'); }
  function evidenceFor(cities) {
    const ids = new Set(['change','single_rate','under18_households_rate','owner_rate','elderly_single_rate','elderly_owner_rate']);
    const report = buildAnalysisPayload(cities);
    const items = report.indicators.filter(x => ids.has(x.id)).map(x => ({
      label:x.label, source:x.source?.title||'出典不明',period:x.source?.period||'',
      prefecture:Number.isFinite(x.prefecture)?Number(x.prefecture.toFixed(2)):null,
      municipalities:x.municipalities.filter(y=>Number.isFinite(y.value)).map(y=>({name:y.name,code:y.code,value:Number(y.value.toFixed(2)), differencePoints:Number.isFinite(y.differencePoints)?Number(y.differencePoints.toFixed(2)):null}))
    })).filter(x=>x.municipalities.length);
    return {municipalities: cities.map(c=>({code:c.code,name:c.name})), indicators:items,
      notes:['対象年は2025年。人口増減率は2020〜2025年。','単身世帯率は一般世帯を分母とする。','高齢者世帯の持ち家率は高齢者がいる住宅居住世帯を分母とする。','県平均との差はポイント単位。','観察できる数値の特徴と因果関係を区別する。']};
  }
  function appendOutput(answer,cities) {
    const node=$('ai-report-output');node.replaceChildren();
    const h=document.createElement('h4');h.textContent='AIによる補足解説';
    const p=document.createElement('p');p.className='ai-report-answer';p.textContent=answer;
    const source=document.createElement('p');source.className='ai-report-notice';
    source.textContent=`対象：${cities.map(c=>c.name).join('・')} ／ 出典：2025年国勢調査（総務省・愛知県）。AIの記述は生成文です。数値の確認には以下の比較表を利用してください。`;
    node.append(h,p,source);
  }
  async function generate() {
    const cities=reportCities();
    if(cities.length<2 || cities.length>3 || new Set(cities.map(c=>c.code)).size!==cities.length){show('異なる自治体を2〜3件選択してください。','error');return;}
    const url=endpoint();if(!url){show('AI未接続です。Cloudflare Worker URLを ai-config.js に設定してください。通常の比較レポートは引き続き利用できます。','error');return;}
    if(!/^https:\/\//.test(url)){show('Worker URLはhttpsを指定してください。','error');return;}
    controller?.abort();controller=new AbortController();const mine=++runId;
    const button=$('ai-report-generate');button.disabled=true;show('統計を整理してAI解説を作成しています…');
    const timer=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({type:'report',question:'この自治体比較から読み取れる特徴を、事実と注意点を区別して日本語で説明してください。',evidence:evidenceFor(cities)}),signal:controller.signal});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`AI通信エラー (${response.status})`);
      if(typeof data.answer!=='string'||!data.answer.trim())throw new Error('AIの回答が空でした。');
      if(mine!==runId)return;
      appendOutput(data.answer.trim().slice(0,2200),cities);
      show('AI解説を表示しました。出典と数値を確認してご利用ください。','success');
    }catch(err){if(mine===runId)show(err.name==='AbortError'?'通信がタイムアウトしました。再試行してください。':`${err.message}。比較表は引き続き利用できます。`,'error');}
    finally{clearTimeout(timer);if(mine===runId){button.disabled=false;controller=null;}}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const button=$('ai-report-generate');if(!button)return;
    button.addEventListener('click',generate);
    ['report-a','report-b','report-c'].forEach(id=>$(id)?.addEventListener('change',clear));
    show(endpoint()?'AI接続設定を検出しました。2〜3自治体を選んで生成してください。':'AI未接続です。統計比較は利用できます。AI解説にはCloudflareの接続設定が必要です。');
  });
})();
