/* v2.8 step 2. Additional approved data only; never alters census. */
(()=>{'use strict';
const F='./data/external-statistics/industry_2021_sectors_approved.json';
const $=id=>document.getElementById(id);
const n=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e};
const format=x=>new Intl.NumberFormat('ja-JP').format(x);
function valid(d){
 if(d?.schema_version!==1||d?.status!=='approved'||d?.statsDataId!=='0004006322'||d?.year!==2021||d?.geography!=='aichi_54_municipalities'||!Array.isArray(d.sectors)||d.sectors.length<2||!d.cities||Object.keys(d.cities).length!==54||!d.definition||!d.sourceUrl)return false;
 if(new Set(d.sectors.map(s=>s.code)).size!==d.sectors.length)return false;
 const codes=d.sectors.map(s=>s.code);
 return Object.entries(d.cities).every(([code,item])=>/^23\d{3}$/.test(code)&&typeof item.name==='string'&&codes.every(c=>item.values&&Object.hasOwn(item.values,c)&&typeof item.values[c]==='object'&&item.values[c]!==null&&['establishments','employees'].every(k=>item.values[c][k]===null||(Number.isSafeInteger(item.values[c][k])&&item.values[c][k]>=0))));
}
function render(host,d){
 host.replaceChildren(); host.append(n('h4','','産業大分類別の特徴（2021年）'),n('p','industry-sector-note','2021年経済センサス確報。既存の民営事業所総数とは集計対象が異なるため、割合はこの表で定義する対象内で計算します。'));
 const controls=n('div','industry-sector-controls'), l1=n('label','','指標'),l2=n('label','','自治体');
 const metric=n('select','industry-sector-select');[['establishments','事業所数'],['employees','従業者数']].forEach(([v,t])=>metric.add(new Option(t,v)));
 const city=n('select','industry-sector-select'); Object.entries(d.cities).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ja')).forEach(([code,item])=>city.add(new Option(item.name,code)));
 l1.append(metric);l2.append(city);controls.append(l1,l2);host.append(controls);
 const message=n('p','industry-sector-note'), bars=n('div','industry-sector-bars');host.append(message,bars);
 function draw(){bars.replaceChildren();const k=metric.value, c=d.cities[city.value], entries=d.sectors.map(s=>({name:s.name,code:s.code,value:c.values[s.code]?.[k]}));
 const numeric=entries.filter(x=>Number.isSafeInteger(x.value));const suppressed=entries.length-numeric.length;
 const total=numeric.reduce((s,x)=>s+x.value,0),max=Math.max(...numeric.map(x=>x.value),0);
 message.textContent=`${c.name}：表示できる産業 ${numeric.length}分野${suppressed?'／非公表など '+suppressed+'分野':''}。構成比は表示可能な産業区分の合計を分母とする参考値です。`;
 for(const item of numeric.sort((a,b)=>b.value-a.value)){
 const line=n('div','industry-sector-line'), head=n('div','industry-sector-linehead');head.append(n('span','',item.name),n('strong','',`${format(item.value)}${k==='employees'?'人':'事業所'} ／ ${total?(item.value/total*100).toFixed(1):'—'}%`));
 const track=n('div','industry-sector-track'),fill=n('div','industry-sector-fill');fill.style.width=`${max?100*item.value/max:0}%`;track.append(fill);line.append(head,track);bars.append(line);
 }
 if(!numeric.length)bars.append(n('p','industry-sector-note','この自治体では数値を表示できません。'));
 }
 city.value=d.cities[$('city-select')?.value]?$('city-select').value:Object.keys(d.cities)[0];metric.addEventListener('change',draw);city.addEventListener('change',()=>{const other=$('city-select');if(other&&[...other.options].some(o=>o.value===city.value)){other.value=city.value;other.dispatchEvent(new Event('change',{bubbles:true}))}draw()});$('city-select')?.addEventListener('change',()=>{const code=$('city-select').value;if(d.cities[code]&&code!==city.value){city.value=code;draw()}});draw();
 const src=n('a','industry-sector-source','e-Stat 元の統計表を確認 ↗');src.href=d.sourceUrl;src.target='_blank';src.rel='noopener noreferrer';host.append(src,n('p','industry-sector-note',d.definition));
}
document.addEventListener('DOMContentLoaded',async()=>{const target=$('economic-analysis');if(!target)return;const host=n('section','industry-sector');host.id='industry-sector';host.append(n('h4','','産業大分類別の特徴'),n('p','industry-sector-note','追加データの取得・照合が完了するまで公開準備中です。既存の事業所・従業者数は引き続きご覧いただけます。'));target.after(host);
 try{const res=await fetch(F,{cache:'no-cache'});if(!res.ok)return;const data=await res.json();if(!valid(data))throw Error('invalid/unapproved sector dataset');render(host,data)}catch(e){console.info('industry sector: no approved dataset',e.message)};
});})();
