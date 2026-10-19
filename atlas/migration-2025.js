/* MIERU AICHI: approved 2025 migration numbers, separate from the national census. */
(()=>{'use strict';
const DATA='./data/external-statistics/migration_2025_approved.json';
const $=(sel,root=document)=>root.querySelector(sel);
const create=(tag,className='',label)=>{const e=document.createElement(tag);if(className)e.className=className;if(label!==undefined)e.textContent=label;return e;};
const fmt=n=>new Intl.NumberFormat('ja-JP').format(n);
function valid(d){return d?.status==='approved'&&d.year===2025&&d.geography==='aichi_54_municipalities'&&d.tables?.in==='0004044293'&&d.tables?.out==='0004044294'&&d.municipalities&&Object.keys(d.municipalities).length===54&&Object.values(d.municipalities).every(x=>x&&typeof x.name==='string'&&Number.isSafeInteger(x.in)&&x.in>=0&&Number.isSafeInteger(x.out)&&x.out>=0&&x.net===x.in-x.out);}
function setup(host,d){host.replaceChildren();host.append(create('h4','','人口移動（2025年）'),create('p','migration-lead','2025年中の転入・転出を比較します。国外との移動を含む「移動者（外国人含む）」の統計です。出生・死亡などを含む人口増減とは異なります。'));
 const mainSelect=$('#city-select'); const controls=create('div','migration-controls');const label=create('label','','自治体');const selector=create('select');selector.id='migration-city';for(const [code,c] of Object.entries(d.municipalities).sort((a,b)=>a[1].name.localeCompare(b[1].name,'ja')))selector.add(new Option(c.name,code));label.append(selector);
 const sortLabel=create('label','','ランキング指標');const metric=create('select');for(const [key,name] of [['net','転入超過数'],['in','転入者数'],['out','転出者数']])metric.add(new Option(name,key));sortLabel.append(metric);controls.append(label,sortLabel);host.append(controls);
 const summary=create('div','migration-summary');const chart=create('div','migration-chart');const rankTitle=create('h5','','54市町村のランキング');const ranks=create('div','migration-ranks');const status=create('p','migration-status');status.setAttribute('role','status');host.append(summary,chart,rankTitle,status,ranks);
 const details=create('details','migration-source');details.append(create('summary','','出典・集計定義・注意事項'));
 const link=create('a','','e-Stat 統計表（転入） ↗');link.href='https://www.e-stat.go.jp/dbview?sid=0004044293';link.target='_blank';link.rel='noopener noreferrer';details.append(link);
 const outLink=create('a','','e-Stat 統計表（転出） ↗');outLink.href='https://www.e-stat.go.jp/dbview?sid=0004044294';outLink.target='_blank';outLink.rel='noopener noreferrer';details.append(outLink);
 for(const text of [d.source, d.definition,...d.notes,'2025年1月〜12月／統計表 0004044293・0004044294。54市町村の数値は元データと突合済み。県計との外部照合は未実施。'])details.append(create('p','',text));host.append(details);
 function makeCard(title,value,note){const card=create('div','migration-card');card.append(create('span','migration-card-label',title),create('strong','migration-card-number',value),create('small','',note));return card;}
 function render(){const code=selector.value,c=d.municipalities[code];if(!c)return;summary.replaceChildren();chart.replaceChildren();ranks.replaceChildren();summary.append(makeCard('転入者数',`${fmt(c.in)} 人`,'2025年'),makeCard('転出者数',`${fmt(c.out)} 人`,'2025年'),makeCard('転入超過数',`${c.net>0?'+':''}${fmt(c.net)} 人`,c.net>0?'転入超過':c.net<0?'転出超過':'転入・転出が同数'));
 const max=Math.max(c.in,c.out,1);for(const [key,labelName] of [['in','転入'],['out','転出']]){const line=create('div','migration-bar-row');const lab=create('span','',labelName);const track=create('div','migration-track');const fill=create('div',`migration-fill migration-fill-${key}`);fill.style.width=`${c[key]/max*100}%`;track.append(fill);line.append(lab,track,create('strong','',fmt(c[key])));chart.append(line);}
 const rank=Object.entries(d.municipalities).sort((a,b)=>b[1][metric.value]-a[1][metric.value]||a[1].name.localeCompare(b[1].name,'ja'));const selectedIndex=rank.findIndex(([id])=>id===code);status.textContent=`${metric.selectedOptions[0].text}：${c.name} は54市町村中 ${selectedIndex+1}位。数値の大小は自治体の優劣を意味しません。`;
 for(const [i,[id,city]] of rank.slice(0,10).entries()){const row=create('div','migration-rank-row');if(id===code)row.classList.add('is-selected');const button=create('button','','');button.type='button';button.textContent=`${i+1}位  ${city.name}`;button.addEventListener('click',()=>{selector.value=id;updateMain(id);render()});row.append(button,create('strong','',`${city[metric.value]>0&&metric.value==='net'?'+':''}${fmt(city[metric.value])}人`));ranks.append(row);}
 const download=create('a','migration-download','全54市町村のCSVをダウンロード');download.href='#';download.addEventListener('click',(event)=>{event.preventDefault();const lines=['自治体コード,自治体名,転入者数,転出者数,転入超過数',...Object.entries(d.municipalities).map(([id,x])=>`${id},${x.name},${x.in},${x.out},${x.net}`)];const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=create('a');a.href=url;a.download='mieru_aichi_migration_2025.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});ranks.append(download);
 }
 function updateMain(id){if(mainSelect&&[...mainSelect.options].some(o=>o.value===id)){mainSelect.value=id;mainSelect.dispatchEvent(new Event('change',{bubbles:true}));}}
 selector.addEventListener('change',()=>{updateMain(selector.value);render()});metric.addEventListener('change',render);
 mainSelect?.addEventListener('change',()=>{if(d.municipalities[mainSelect.value]&&selector.value!==mainSelect.value){selector.value=mainSelect.value;render();}});
 selector.value=d.municipalities[mainSelect?.value]?mainSelect.value:'23100';render();
}
async function init(){const panel=$('#panel-external');if(!panel)return;const target=$('#v283-pane-migration')||panel;const host=create('section','migration-section');host.id='migration-2025';target.append(host);host.append(create('p','','人口移動データを読み込み中…'));
 try{const r=await fetch(DATA,{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(!valid(d))throw Error('承認・数値検証に失敗しました');setup(host,d);}catch(error){host.replaceChildren(create('h4','','人口移動（2025年）'),create('p','migration-error','統計データを表示できません。元の統計情報はそのまま利用できます。'));console.warn('migration:',error.message);}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
