/* MIERU AICHI v2.8 stage 3: sector specialization insights. Uses approved 2021 sector JSON only. */
(()=>{'use strict';
const FILE='./data/external-statistics/industry_2021_sectors_approved.json';
const $=(q,r=document)=>r.querySelector(q);
const elt=(tag,cls='',content)=>{const x=document.createElement(tag);x.className=cls;if(content!==undefined)x.textContent=content;return x;};
const fmt=n=>new Intl.NumberFormat('ja-JP').format(n);
const pct=n=>`${(100*n).toFixed(1)}%`;
const METRICS=[['employees','従業者数'],['establishments','事業所数']];
function approved(d){return d?.status==='approved'&&d?.statsDataId==='0004006322'&&d?.year===2021&&d?.geography==='aichi_54_municipalities'&&Array.isArray(d.sectors)&&d.sectors.length===17&&d.cities&&Object.keys(d.cities).length===54;}
function complete(c,sectors,k){return sectors.every(s=>Number.isSafeInteger(c.values?.[s.code]?.[k])&&c.values[s.code][k]>=0);}
function setup(root,d){
 const citySel=$('#city-select');
 root.replaceChildren();root.append(elt('h4','','産業構造・集積の特徴（2021年）'));
 root.append(elt('p','industry-insights-lead','産業ごとの構成割合を、同じ17区分が揃う自治体群と比較します。相対的な集積を示す参考指標であり、企業の生産性や地域の優劣を示すものではありません。'));
 const controls=elt('div','industry-insights-controls');
 const mlabel=elt('label','','比較する指標');const metric=elt('select');for(const [key,name] of METRICS)metric.add(new Option(name,key));mlabel.append(metric);
 const clabel=elt('label','','自治体');const select=elt('select');for(const [code,c] of Object.entries(d.cities).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ja')))select.add(new Option(c.name,code));clabel.append(select);
 controls.append(mlabel,clabel);root.append(controls);
 const notice=elt('div','industry-insights-notice');notice.setAttribute('role','status');
 const summary=elt('div','industry-insights-summary');const bars=elt('div','industry-insights-bars');root.append(notice,summary,bars);
 const detail=elt('details','industry-insights-details');const title=elt('summary','','計算方法・欠損値・出典');detail.append(title);
 const note=elt('p','',`集積指数 = 選択自治体の当該産業構成比 ÷ 比較可能自治体群の当該産業構成比。指数1.00が比較群と同水準です。構成比は同じ産業17区分の数値がすべて揃う自治体だけで算出します。値なし（-）を0に置き換えず、欠損が1つでもある自治体の指数は非表示です。2021年経済センサス確報。統計表0004006322。v2.7公開の全産業合計表とは集計対象が異なるため、混合しません。`);detail.append(note);
 const link=elt('a','','e-Stat統計表を見る ↗');link.href=d.sourceUrl;link.target='_blank';link.rel='noopener noreferrer';detail.append(link);root.append(detail);
 function draw(){const k=metric.value, code=select.value,c=d.cities[code];if(!c)return;
 summary.replaceChildren();bars.replaceChildren();const comps=Object.entries(d.cities).filter(([,x])=>complete(x,d.sectors,k));
 const valid=complete(c,d.sectors,k);
 const totals=Object.fromEntries(d.sectors.map(s=>[s.code,comps.reduce((sum,[,x])=>sum+x.values[s.code][k],0)]));
 const refTotal=Object.values(totals).reduce((a,b)=>a+b,0);
 notice.textContent=`比較基準：17区分が揃う${comps.length}自治体（規模加重合算）。54市町村全体の構成比ではありません。`;
 if(!valid){summary.append(elt('p','industry-insights-alert',`${c.name}は産業17区分の一部が「値なし」のため、構成比と集積指数を算出しません。`));
 const available=d.sectors.map(s=>({name:s.name,v:c.values?.[s.code]?.[k]})).filter(x=>Number.isSafeInteger(x.v)).sort((a,b)=>b.v-a.v).slice(0,5);
 summary.append(elt('p','industry-insights-help','参考：確認できた産業の実数値（上位5件）。欠損区分を除くため、産業全体の上位5件とは限りません。'));
 for(const x of available){const line=elt('div','industry-insights-raw');line.append(elt('span','',x.name),elt('strong','',`${fmt(x.v)}${k==='employees'?'人':'事業所'}`));bars.append(line);}return;}
 const cityTotal=d.sectors.reduce((sum,s)=>sum+c.values[s.code][k],0);
 if(cityTotal===0||refTotal===0){summary.append(elt('p','','構成比の分母が0のため比較できません。'));return;}
 const rows=d.sectors.map(s=>{const val=c.values[s.code][k],share=val/cityTotal,refShare=totals[s.code]/refTotal,idx=refShare>0?share/refShare:null;return {name:s.name,value:val,share,refShare,idx};});
 const order=rows.filter(x=>x.idx!==null&&Number.isFinite(x.idx)).sort((a,b)=>b.idx-a.idx);
 const top=order.filter(x=>x.idx>1).slice(0,3);
 const blurb=elt('div','industry-insights-highlight');blurb.append(elt('div','industry-insights-overline',`${c.name}の相対的に高い産業`));
 blurb.append(elt('strong','',top.length?top.map(x=>x.name).join(' ／ '):'比較群より構成割合が高い産業はありません'));summary.append(blurb);
 const note=elt('p','industry-insights-help',`指数は同条件の${comps.length}自治体との比較です。規模の大きい自治体が基準値へ強く影響します。`);summary.append(note);
 const heading=elt('div','industry-insights-tablehead');heading.append(elt('span','','産業'),elt('span','','自治体構成比'),elt('span','','集積指数'));bars.append(heading);
 for(const x of order){const line=elt('div','industry-insights-line');const label=elt('div','industry-insights-sector',x.name);const share=elt('span','industry-insights-value',pct(x.share));const index=elt('strong','industry-insights-index',x.idx.toFixed(2));index.dataset.level=x.idx>=1.5?'high':x.idx>=1?'above':'below';const track=elt('div','industry-insights-track'),fill=elt('span','industry-insights-fill');fill.style.width=`${Math.min(100,x.idx*40)}%`;track.append(fill);line.append(label,share,index,track);line.title=`${x.name}：${fmt(x.value)}${k==='employees'?'人':'事業所'}／比較群構成比 ${pct(x.refShare)}／集積指数 ${x.idx.toFixed(2)}`;bars.append(line);}
 }
 select.value=d.cities[citySel?.value]?citySel.value:Object.keys(d.cities)[0];metric.addEventListener('change',draw);select.addEventListener('change',()=>{if(citySel&&[...citySel.options].some(o=>o.value===select.value)){citySel.value=select.value;citySel.dispatchEvent(new Event('change',{bubbles:true}));}draw()});citySel?.addEventListener('change',()=>{if(d.cities[citySel.value]&&select.value!==citySel.value){select.value=citySel.value;draw()}});draw();
}
async function start(){const panel=$('#panel-external');if(!panel)return;const host=elt('section','industry-insights');host.id='industry-insights';const section=$('#v283-pane-sectors')||panel;section.append(host);host.append(elt('p','','産業構造の分析データを確認中…'));
 try{const res=await fetch(FILE,{cache:'no-cache'});if(!res.ok)throw Error(`HTTP ${res.status}`);const data=await res.json();if(!approved(data))throw Error('未承認または形式が不正です');setup(host,data);}catch(e){host.replaceChildren(elt('h4','','産業構造・集積の特徴'),elt('p','industry-insights-alert','検証済みデータを読み込めませんでした。既存の統計機能は利用できます。'));console.info('industry insights:',e.message);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
