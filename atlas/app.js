'use strict';
const $=q=>document.querySelector(q);
const all=q=>[...document.querySelectorAll(q)];
const els={picker:$('#city-select'),year:$('#year-select'),name:$('#selected-name'),code:$('#selected-code'),pop:$('#population'),note:$('#population-note'),coverage:$('#coverage'),chart:$('#chart'),a:$('#compare-a'),b:$('#compare-b'),comp:$('#comparison'),share:$('#share'),toast:$('#toast'),map:$('#map-view'),mapStatus:$('#map-status'),mapRetry:$('#map-retry')};
let catalog=null, extensionData={};
let householdsData={},householdsPref={},seniorData={},seniorPref={},familyData={},familyPref={},educationData={},educationPref={},housingData={},housingPref={},seniorHousingData={},seniorHousingPref={},coupleLifeData={},coupleLifePref={}, municipalities=[], historical={}, selected='23100', year=2025, metric='population', shapes=[], storyText='';
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
const num=x=>Number(x).toLocaleString('ja-JP');
const fmt=x=>Number.isFinite(x)?`${num(x)}人`:'未収録';
const pct=(x,d=2)=>Number.isFinite(x)?`${x>0?'+':''}${x.toFixed(d)}%`:'未収録';
const getCity=code=>municipalities.find(c=>c.code===code);
const info=c=>historical[c.code]||{};
const household=c=>householdsData[c?.code]||null;
const seniorKinds=['elderly_single_rate','elderly_couple_rate','three_generation_rate'];
const seniorLabel={elderly_single_rate:'高齢単身世帯率',elderly_couple_rate:'高齢夫婦世帯率',three_generation_rate:'3世代世帯率'};
const senior=c=>seniorData[c?.code]||null;
const familyKinds=['under18_households_rate','couple_children_rate','single_mother_children_rate','single_father_children_rate'];
const familyLabel={under18_households_rate:'18歳未満がいる世帯の割合',couple_children_rate:'夫婦と子どもの世帯率',single_mother_children_rate:'母と子どもの世帯率',single_father_children_rate:'父と子どもの世帯率'};
const family=c=>familyData[c?.code]||null;
const housingKinds=['owner_rate','rental_rate','detached_rate','apartment_rate'];
const housingLabels={owner_rate:'持ち家率',rental_rate:'借家率',detached_rate:'一戸建率',apartment_rate:'共同住宅率'};
const seniorHousingKinds=['elderly_households_rate','elderly_owner_rate','elderly_rental_rate','over75_households_rate','over85_households_rate','elderly_owner'];
const seniorHousingLabels={elderly_households_rate:'65歳以上の人がいる世帯率',elderly_owner_rate:'高齢者世帯の持ち家率',elderly_rental_rate:'高齢者世帯の借家率',over75_households_rate:'75歳以上の人がいる世帯率',over85_households_rate:'85歳以上の人がいる世帯率',elderly_owner:'高齢者のいる持ち家世帯数'};
const coupleLifeKinds=['couple_only','couple_both65_rate','couple_senior_rate','couple_husband_under60_rate','couple_owner_rate'];
const coupleLifeLabels={couple_only:'夫婦のみの世帯数',couple_both65_rate:'夫婦とも65歳以上',couple_senior_rate:'夫65歳以上・妻60歳以上',couple_husband_under60_rate:'夫60歳未満',couple_owner_rate:'夫婦のみ世帯の持ち家率'};
const educationKinds=['primary_schools','primary_students','junior_schools','junior_students'];
const educationDerivedKinds=['primary_students_per_school','junior_students_per_school','primary_schools_per_10000','junior_schools_per_10000'];
const educationDerivedLabels={primary_students_per_school:'小学校1校当たり児童数',junior_students_per_school:'中学校1校当たり生徒数',primary_schools_per_10000:'人口1万人当たり小学校数',junior_schools_per_10000:'人口1万人当たり中学校数'};
function educationDerivedValue(c,k){const d=educationData[c?.code];if(!d||year!==2025)return null;let numerator,denominator,multiplier=1;if(k==='primary_students_per_school'){numerator=d.primary_students;denominator=d.primary_schools}else if(k==='junior_students_per_school'){numerator=d.junior_students;denominator=d.junior_schools}else if(k==='primary_schools_per_10000'){numerator=d.primary_schools;denominator=population(c,2025);multiplier=10000}else if(k==='junior_schools_per_10000'){numerator=d.junior_schools;denominator=population(c,2025);multiplier=10000}else return null;return Number.isFinite(numerator)&&Number.isFinite(denominator)&&denominator>0?numerator/denominator*multiplier:null}

const educationLabels={primary_schools:'小学校数',primary_students:'小学校児童数',junior_schools:'中学校数',junior_students:'中学校生徒数'};
const hhKinds=['single_rate','two_person_rate','avg_household_size','under_18_rate'];
const hhLabel={single_rate:'単身世帯率',two_person_rate:'2人世帯率',avg_household_size:'1世帯当たり人数',under_18_rate:'18歳未満の世帯員がいる世帯の割合'};

function metricDef(id){return catalog?.metrics.find(m=>m.id===id)||null}
function enabledMetric(m){return m.years.includes(year)}
function fillIndicatorOptions(preferred){
 const group=$('#category-select'),indicator=$('#indicator-select');
 if(!catalog)return;
 const categories=catalog.categories.filter(cat=>catalog.metrics.some(m=>m.category===cat.id&&enabledMetric(m)));
 group.replaceChildren(...categories.map(c=>{const o=new Option(c.label,c.id);return o}));
 const preferredDef=metricDef(preferred),preferredCategory=preferredDef&&enabledMetric(preferredDef)?preferredDef.category:null;
 const category=categories.some(c=>c.id===group.dataset.keep)?group.dataset.keep:preferredCategory||categories[0]?.id;
 group.value=category||'';
 const options=catalog.metrics.filter(m=>m.category===category&&enabledMetric(m));
 indicator.replaceChildren(...options.map(m=>new Option(m.label,m.id)));
 const chosen=options.some(m=>m.id===preferred)?preferred:options[0]?.id;
 if(chosen){indicator.value=chosen;metric=chosen}
 updateMetricMeta();
}
function updateMetricMeta(){const m=metricDef(metric),node=$('#metric-meta');if(!m||!node)return;const fixed=m.years.length===1?`${m.years[0]}年`: `${year}年`;node.textContent=`${m.label}（${fixed}）｜出典：${m.source}。${m.description||''}`;renderSelectedMetric()}
function renderSelectedMetric(){const c=getCity(selected),m=metricDef(metric);if(!m||!c)return;$('#active-metric-label').textContent=m.label;$('#active-metric-value').textContent=formatValue(value(c),metric);$('#active-metric-source').textContent=`${m.years.length===1?m.years[0]:year}年｜${m.source}`}

function setCategory(category){const m=catalog?.metrics.find(x=>x.category===category&&enabledMetric(x));if(!m)return;$('#category-select').dataset.keep=category;fillIndicatorOptions(m.id);setMetric(m.id);syncDetails(category)}
function syncDetails(category){const p={demography:'overview',households:'households',senior:'senior',family:'family',education:'education',housing:'housing',senior_housing:'senior_housing',couple_lifestage:'couple_lifestage'}[category];if(p)showDetailPane(p)}
function showDetailPane(p){$('#detail-section-select').value=p;activateTabs('.city-detail-tab','cityPane','city-pane-',p)}
function extensionValue(c,k){const d=extensionData[k];if(!d)return null;const m=metricDef(k);if(!m||!enabledMetric(m))return null;const entry=d.cities?.[c.code];const n=typeof entry==='number'?entry:entry?.value;return Number.isFinite(n)?n:null}
async function loadCatalog(){const res=await fetch('./data/indicators.json');if(!res.ok)throw new Error('指標の設定を読み込めません');catalog=await res.json();if(catalog.schema_version!==1||!Array.isArray(catalog.metrics)||!Array.isArray(catalog.categories))throw new Error('指標設定の形式が不正です');const ids=new Set();for(const m of catalog.metrics){if(ids.has(m.id)||!catalog.categories.some(c=>c.id===m.category)||!Array.isArray(m.years)||!m.years.length)throw new Error('指標定義に重複・不整合があります');ids.add(m.id)}for(const ext of catalog.extensions||[]){const m=metricDef(ext.metric_id);if(!m)throw new Error('拡張指標が登録されていません');const response=await fetch('./data/'+ext.file);if(!response.ok)continue;const raw=await response.json();if(raw.schema_version!==1||!raw.cities)continue;extensionData[ext.metric_id]=raw}}
function population(c,y=year){if(!c)return null;const d=info(c);return y===2015?(Number.isInteger(d.population_2015)?d.population_2015:null):y===2025?(Number.isInteger(d.population_2025)?d.population_2025:null):c.population}
function elderly(c,y=year){if(!c)return null;const v=info(c)[`elderly_rate_${y}`];return y===2015?null:Number.isFinite(v)?v:null}
function households(c,y=year){return y===2025?info(c)?.households_2025??null:null}
function priorYear(y=year){return y===2025?2020:y===2020?2015:null}
function change(c,y=year){const from=priorYear(y),before=from?population(c,from):null,to=population(c,y);return Number.isFinite(before)&&before>0&&Number.isFinite(to)?(to-before)/before*100:null}
function value(c,k=metric){if(k==='population')return population(c);if(k==='share')return 100*population(c)/prefTotal();if(k==='change')return change(c);if(k==='elderly')return elderly(c);if(k==='households')return households(c);if(hhKinds.includes(k))return year===2025?household(c)?.[k]??null:null;if(seniorKinds.includes(k))return year===2025?senior(c)?.[k]??null:null;if(familyKinds.includes(k))return year===2025?family(c)?.[k]??null:null;if(educationKinds.includes(k))return year===2025?educationData[c?.code]?.[k]??null:null;if(educationDerivedKinds.includes(k))return educationDerivedValue(c,k);if(housingKinds.includes(k))return year===2025?housingData[c?.code]?.[k]??null:null;if(seniorHousingKinds.includes(k))return year===2025?seniorHousingData[c?.code]?.[k]??null:null;if(coupleLifeKinds.includes(k))return year===2025?coupleLifeData[c?.code]?.[k]??null:null;return extensionValue(c,k)}
function prefTotal(y=year){return municipalities.reduce((s,c)=>s+(population(c,y)||0),0)}
function rank(c,k='population'){const group=municipalities.map(x=>({code:x.code,v:value(x,k)})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>b.v-a.v||a.code.localeCompare(b.code));const idx=group.findIndex(x=>x.code===c.code);return idx<0?null:idx+1}
function formatValue(v,k){if(!Number.isFinite(v))return '未収録';if(k==='population')return fmt(v);if(k==='households')return `${num(v)}世帯`;if(k==='change')return pct(v);if(k==='avg_household_size')return v.toFixed(2)+'人';if(educationKinds.includes(k))return num(v)+(k.endsWith('schools')?'校':'人');if(educationDerivedKinds.includes(k))return v.toLocaleString('ja-JP',{minimumFractionDigits:1,maximumFractionDigits:1})+(k.endsWith('_per_school')?'人/校':'校/万人');if(k==='elderly_owner'||k==='couple_only')return num(v)+'世帯';const ext=metricDef(k);if(ext&&!['population','share','change','elderly','households',...hhKinds,...seniorKinds,...familyKinds].includes(k))return v.toLocaleString('ja-JP',{maximumFractionDigits:2})+(ext.unit||'');return v.toFixed(2)+'%'}
function renderList(){const opts=document.createDocumentFragment();for(const c of municipalities){const o=make('option','',c.name);o.value=c.code;opts.append(o)}els.picker.replaceChildren(opts);els.picker.value=selected;$('#city-count').textContent=municipalities.length+'市町村'}
function selectOptions(){for(const [el,def] of [[els.a,'23100'],[els.b,'23211']]){el.replaceChildren();for(const c of municipalities){const o=make('option','',c.name);o.value=c.code;el.append(o)}el.value=def}}
function choose(code,updateUrl=true){const c=getCity(code);if(!c)return;selected=code;els.picker.value=code;els.name.textContent=c.name;const r=rank(c);els.code.textContent=`自治体コード ${c.code} / ${year}年 県内人口 ${r??'—'}位（54市町村）`;els.pop.textContent=fmt(population(c));$('#primary-metric-label').textContent=`総人口（${metricDef(metric)?.years.length===1?metricDef(metric).years[0]:year}年）`;els.note.textContent=`${year}年10月1日 国勢調査`;els.coverage.textContent=year===2025?'人口・世帯・年齢':'人口・年齢等';renderInsight();renderExtraStats();renderPrefComparison();renderCityStory();renderHouseholds();renderSenior();renderFamily();renderEducation();renderHousing();renderSeniorHousing();renderCoupleLife();renderAge();renderTrend();renderComparison();renderChart();highlightMap();renderSelectedMetric();renderDiscovery();renderReport();if(updateUrl){const url=new URL(location.href);url.searchParams.set('city',code);url.searchParams.set('year',year);history.replaceState(null,'',url)}}
function setYear(next){
 year=Number(next);els.year.value=String(year);
 $('#pref-compare-year').textContent=year+'年';
 $('.data-pill').textContent=`${year}年 国勢調査${year===2025?'（確定値）':''}`;
 $('#metric-context').textContent=`${year}年の統計を表示中。人口増減は${priorYear()?`${priorYear()}〜${year}年`:'2015年の比較対象なし'}。`;
 $('.map-source').textContent=`境界：2022年行政区域データ。人口：${year}年国勢調査。教育指標：2025年5月1日学校基本調査。基準日と対象が異なります。`;
 const current=metricDef(metric);if(current&&!enabledMetric(current))delete $('#category-select').dataset.keep;
 fillIndicatorOptions(current&&enabledMetric(current)?metric:'population');
 for(const o of $('#ranking-metric').options){const md=metricDef(o.value);o.disabled=md?!enabledMetric(md):(year!==2025&&o.value==='households')}
 if($('#ranking-metric').selectedOptions[0]?.disabled)$('#ranking-metric').value='population';
 choose(selected);recolorMap();renderMapLegend();
}
function setMetric(kind){const m=metricDef(kind);if(!m||!enabledMetric(m))return;metric=kind;const group=$('#category-select');group.dataset.keep=m.category;group.value=m.category;const opts=$('#indicator-select');if(![...opts.options].some(o=>o.value===kind))fillIndicatorOptions(kind);opts.value=kind;updateMetricMeta();recolorMap();renderMapLegend()}
function colorForCity(c){const v=value(c);if(!Number.isFinite(v))return '#e2e8ef';if(metric==='change')return v>=5?'#0d2b57':v>=0?'#167cb8':v>=-5?'#97dfe8':'#dceef8';if(metric==='elderly')return v>=35?'#163c49':v>=30?'#087b77':v>=25?'#3eaa9b':v>=20?'#99d8c8':'#deeee9';if(hhKinds.includes(metric)||seniorKinds.includes(metric)||familyKinds.includes(metric)){const top=metric==='avg_household_size'?3:metric==='under_18_rate'?30:metric==='two_person_rate'?40:metric==='elderly_single_rate'?20:metric==='elderly_couple_rate'?22:metric==='three_generation_rate'?15:60;const rangeMax=familyKinds.includes(metric)?(metric==='couple_children_rate'?40:metric==='under18_households_rate'?30:metric==='single_mother_children_rate'?12:4):top;const ratio=Math.max(0,Math.min(1,v/rangeMax));return ratio>.8?'#0d2b57':ratio>.6?'#157eac':ratio>.4?'#3db8c3':ratio>.2?'#96dfe7':'#dceef8'}if(educationKinds.includes(metric)||educationDerivedKinds.includes(metric)){const entries=municipalities.map(x=>value(x,metric)).filter(Number.isFinite).sort((a,b)=>a-b);if(!entries.length)return '#e2e8ef';const rank=entries.findIndex(x=>x>=v)/Math.max(1,entries.length-1);return rank>=.8?'#0d2b57':rank>=.6?'#157eac':rank>=.4?'#3db8c3':rank>=.2?'#96dfe7':'#dceef8'}if(housingKinds.includes(metric)){const entries=municipalities.map(x=>housingData[x.code]?.[metric]).filter(Number.isFinite).sort((a,b)=>a-b);if(!entries.length)return '#e2e8ef';const quantile=entries.findIndex(x=>x>=v)/Math.max(1,entries.length-1);return quantile>=.8?'#0d2b57':quantile>=.6?'#157eac':quantile>=.4?'#3db8c3':quantile>=.2?'#96dfe7':'#dceef8'}if(coupleLifeKinds.includes(metric)){const entries=municipalities.map(x=>coupleLifeData[x.code]?.[metric]).filter(Number.isFinite).sort((a,b)=>a-b);if(!entries.length)return "#e2e8ef";const q=entries.findIndex(x=>x>=v)/Math.max(1,entries.length-1);return q>=.8?"#0d2b57":q>=.6?"#157eac":q>=.4?"#3db8c3":q>=.2?"#96dfe7":"#dceef8"}if(extensionData[metric]){const entries=municipalities.map(x=>extensionValue(x,metric)).filter(Number.isFinite).sort((a,b)=>a-b);if(!entries.length)return '#e2e8ef';const quantile=entries.findIndex(x=>x>=v)/Math.max(1,entries.length-1);return quantile>=.8?'#0d2b57':quantile>=.6?'#157eac':quantile>=.4?'#3db8c3':quantile>=.2?'#96dfe7':'#dceef8'}if(metric==='share')return v>=10?'#163c49':v>=3?'#087b77':v>=1?'#3eaa9b':v>=.3?'#99d8c8':'#deeee9';return v>=300000?'#0d2b57':v>=100000?'#157eac':v>=50000?'#3db8c3':v>=20000?'#96dfe7':'#dceef8'}
function renderMapLegend(){const labels={population:['人口 少','人口 多'],share:['県内割合 少','県内割合 多'],change:['減少','増加'],elderly:['高齢化率 低','高齢化率 高'],single_rate:['単身世帯率 低','単身世帯率 高'],elderly_single_rate:['高齢単身世帯率 低','高齢単身世帯率 高'],elderly_couple_rate:['高齢夫婦世帯率 低','高齢夫婦世帯率 高'],avg_household_size:['1世帯当たり 少','1世帯当たり 多'],under18_households_rate:['18歳未満世帯率 低','18歳未満世帯率 高'],couple_children_rate:['夫婦と子ども 低','夫婦と子ども 高'],single_mother_children_rate:['母と子ども 低','母と子ども 高'],single_father_children_rate:['父と子ども 低','父と子ども 高']}[metric]||['低','高'];const nodes=all('.map-legend span');if(nodes.length>1){nodes[0].textContent=labels[0];nodes[nodes.length-1].textContent=labels[1]}}
function recolorMap(){for(const path of all('#map-view path[data-code]')){const c=getCity(path.dataset.code);if(c){path.setAttribute('fill',colorForCity(c));path.querySelector('title').textContent=`${c.name}：${formatValue(value(c),metric)}（${educationKinds.includes(metric)?'2025年度':year+'年'}）`}}for(const tile of all('.city-tile')){const c=getCity(tile.dataset.code);if(c){tile.style.background=colorForCity(c);tile.style.color='#10273d'}}}
function highlightMap(){for(const p of all('#map-view [data-code]'))p.classList.toggle(p.tagName.toLowerCase()==='path'?'active':'current',p.dataset.code===selected)}
function rings(g){return g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():[]}
function renderMap(){if(!shapes.length){const text=make('p','map-placeholder-title','境界GeoJSONが未取得のため、自治体タイルを表示しています。');const tiles=make('div','city-tiles');for(const c of municipalities){const b=make('button','city-tile',c.name);b.type='button';b.dataset.code=c.code;b.addEventListener('click',()=>choose(c.code));tiles.append(b)}els.map.replaceChildren(text,tiles);recolorMap();highlightMap();return}
 let minx=Infinity,maxx=-Infinity,miny=Infinity,maxy=-Infinity;const projected=(a,b)=>[a*Math.cos(Math.PI*35/180),-b];for(const s of shapes)for(const ring of rings(s.geometry))for(const pt of ring){const [x,y]=projected(pt[0],pt[1]);minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}
 const W=740,H=450,pad=25,scale=Math.min((W-2*pad)/(maxx-minx),(H-2*pad)/(maxy-miny)),dx=(W-(maxx-minx)*scale)/2,dy=(H-(maxy-miny)*scale)/2;
 const xy=p=>{const[x,y]=projected(p[0],p[1]);return[(dx+(x-minx)*scale).toFixed(1),(dy+(y-miny)*scale).toFixed(1)]};
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','group');svg.setAttribute('aria-label','愛知県市町村地図');
 for(const shape of shapes){const c=getCity(shape.code);if(!c)continue;const path=document.createElementNS(ns,'path');let d='';for(const ring of rings(shape.geometry)){if(ring.length<3)continue;d+=ring.map((pt,i)=>(i?'L':'M')+xy(pt).join(',')).join(' ')+'Z '}path.setAttribute('d',d);path.dataset.code=c.code;path.setAttribute('tabindex','0');path.setAttribute('role','button');path.setAttribute('aria-label',c.name+'の詳細を表示');const title=document.createElementNS(ns,'title');path.append(title);path.addEventListener('click',()=>choose(c.code));path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(c.code)}});svg.append(path)}els.map.replaceChildren(svg);els.map.setAttribute('aria-busy','false');recolorMap();highlightMap()}
async function loadMap(){els.mapStatus.textContent='市町村境界を読み込み中…';try{const response=await fetch('./data/aichi-boundaries.geojson');if(!response.ok)throw new Error('地図未収録');const geo=await response.json();if(geo.type!=='FeatureCollection'||geo.features.length!==54||new Set(geo.features.map(f=>String(f.properties.code))).size!==54)throw new Error('地図の54自治体を検証できません');shapes=geo.features.map(f=>({code:String(f.properties.code),geometry:f.geometry}));els.mapStatus.textContent='地図を表示中（54/54市町村）'}catch(err){shapes=[];els.mapStatus.textContent='地図を読み込めません。市町村一覧で選択できます。'}renderMap()}
function renderInsight(){const c=getCity(selected),p=population(c);const share=p/prefTotal()*100;$('#prefecture-share').textContent=share.toFixed(2)+'%';$('#share-fill').style.width=Math.max(0,Math.min(100,share))+'%';$('#insight-note').textContent=`${year}年：${c.name} ${fmt(p)} ／ 愛知県 ${fmt(prefTotal())}`}
function renderExtraStats(){const c=getCity(selected),ch=change(c),elder=elderly(c);$('#detail-change').textContent=Number.isFinite(ch)?pct(ch):'比較対象なし';$('#detail-elderly').textContent=Number.isFinite(elder)?elder.toFixed(1)+'%':'未収録';const labels=all('#extra-stats .extra-stat span');if(labels[0])labels[0].textContent=priorYear()?`${priorYear()}〜${year}年 人口増減率`:'人口増減率';if(labels[1])labels[1].textContent=`${year}年 高齢化率`;let household=$('#household-summary');if(!household){household=make('div','extra-stat');household.id='household-summary';$('#extra-stats').append(household)}household.replaceChildren(make('span','',`世帯数（${year}年）`),make('strong','',year===2025?`${num(households(c))}世帯`:'未収録'))}
function renderPrefComparison(){const c=getCity(selected),local=elderly(c),valid=municipalities.every(x=>Number.isFinite(elderly(x))),elderSum=valid?municipalities.reduce((s,x)=>s+info(x)[`age_65_plus_${year}`],0):null;let denom=year===2025?municipalities.reduce((s,x)=>s+(population(x)-info(x).age_unknown_2025),0):prefTotal();const pref=valid?elderSum/denom*100:null;$('#local-elderly').textContent=Number.isFinite(local)?local.toFixed(1)+'%':'未収録';$('#pref-elderly').textContent=Number.isFinite(pref)?pref.toFixed(1)+'%':'未収録';$('#elderly-diff').textContent=Number.isFinite(pref)&&Number.isFinite(local)?`県全体との差：${(local-pref)>0?'+':''}${(local-pref).toFixed(2)}ポイント。${year===2025?'年齢不詳を除外':'年齢不詳補完値を使用'}。`:'この年度の年齢別人口は未収録です。'}
const ages=[['age_0_14','0〜14歳','#32b6bb'],['age_15_64','15〜64歳','#2574c7'],['age_65_plus','65歳以上','#f28d50']];
function renderAge(){const c=getCity(selected),d=info(c),host=$('#age-stack'),legend=$('#age-legend');host.replaceChildren();legend.replaceChildren();$('#age-heading').textContent=`${year}年の年齢構成`;const arr=ages.map(([key])=>d[`${key}_${year}`]),missing=arr.some(x=>!Number.isInteger(x));if(missing){host.textContent='この年度の年齢構成は未収録です。';$('#age-note').textContent='2015年の年齢別人口は今回の収録対象外です。';return}const unknown=year===2025?d.age_unknown_2025:0,p=population(c);if(arr.reduce((s,x)=>s+x,0)+unknown!==p){host.textContent='年齢構成の合計が総人口と一致しません。';return}ages.forEach(([key,label,color],i)=>{const n=arr[i],share=n/p*100,part=make('div','v08-age-part');part.style.width=share+'%';part.style.background=color;part.title=`${label} ${fmt(n)}（総人口比${share.toFixed(1)}%）`;host.append(part);const item=make('div','v08-age-item'),dot=make('i');dot.style.background=color;item.append(dot,make('span','',label),make('strong','',`${share.toFixed(1)}%`),make('small','',fmt(n)));legend.append(item)});if(unknown){const part=make('div','v08-age-part');part.style.width=100*unknown/p+'%';part.style.background='#9eabbc';host.append(part);const item=make('div','v08-age-item'),dot=make('i');dot.style.background='#9eabbc';item.append(dot,make('span','','年齢不詳'),make('strong','',`${(unknown/p*100).toFixed(1)}%`),make('small','',fmt(unknown)));legend.append(item)}$('#age-note').textContent=year===2025?'2025年は年齢不詳を含む実数値。各割合は総人口を分母とします（高齢化率の分母は年齢不詳を除く）。':'2020年は年齢不詳補完値。割合の分母は総人口です。';host.setAttribute('aria-label',`${c.name} ${year}年の年齢構成`)}
function renderTrend(){const c=getCity(selected),host=$('#trend-content');host.replaceChildren();const years=[2015,2020,2025],vals=years.map(y=>population(c,y)),top=Math.max(...vals);const graph=make('div','trend-graph');years.forEach((y,i)=>{const e=make('div','trend-bar');e.append(make('strong','',fmt(vals[i])));const bar=make('i');bar.style.height=Math.max(4,vals[i]/top*105)+'px';if(y===year)bar.style.background='#ff8936';e.append(bar,make('span','',`${y}年`));graph.append(e)});host.append(graph);const ch=change(c);host.append(make('p','trend-caption',`${year}年の人口：${fmt(population(c))}${Number.isFinite(ch)?` ／ ${priorYear()}年から${pct(ch)}（${num(population(c)-population(c,priorYear()))}人）`:''}`));if(year===2025)host.append(make('p','trend-caption',`世帯数：${num(households(c))}世帯（2025年）`))}
function renderHouseholds(){
 const host=$('#household-stats'),structure=$('#household-structure'),comparison=$('#household-pref'),intro=$('#household-intro');
 if(!host||!structure||!comparison)return;
 host.replaceChildren();structure.replaceChildren();comparison.replaceChildren();
 const d=household(getCity(selected));if(!d){intro.textContent='この自治体の世帯統計は未収録です。';return}
 intro.textContent=`${getCity(selected).name}の2025年国勢調査（一般世帯 ${num(d.general_households)}世帯）`;
 const items=[['単身世帯率',d.single_rate.toFixed(1)+'%'],['2人世帯率',d.two_person_rate.toFixed(1)+'%'],['1世帯当たり人数',d.avg_household_size.toFixed(2)+'人'],['18歳未満の世帯員がいる世帯',d.under_18_rate.toFixed(1)+'%']];
 for(const [label,number] of items){const card=make('div','household-stat');card.append(make('span','',label),make('strong','',number));host.append(card)}
 structure.append(make('h4','','世帯人数別の構成（一般世帯）'));
 const cats=[['1人',d.single],['2人',d.two_person],['3人',d.three_person],['4人',d.four_person],['5人以上',d.five_person+d.six_person+d.seven_plus]];
 const bar=make('div','hh-stacked');bar.setAttribute('role','img');bar.setAttribute('aria-label',cats.map(([k,v])=>k+' '+(v/d.general_households*100).toFixed(1)+'%').join('、'));
 const colors=['#177cbe','#12a5bb','#42c6ba','#f0ab67','#a0aabb'];
 for(let i=0;i<cats.length;i++){const [label,count]=cats[i];const seg=make('div','hh-segment');seg.style.width=(count/d.general_households*100)+'%';seg.style.background=colors[i];seg.title=label+' '+num(count)+'世帯';bar.append(seg)}structure.append(bar);
 const legend=make('div','hh-legend');for(let i=0;i<cats.length;i++){const [label,count]=cats[i];const it=make('span','');const dot=make('i','');dot.style.background=colors[i];it.append(dot,document.createTextNode(label+' '+(100*count/d.general_households).toFixed(1)+'%'));legend.append(it)}structure.append(legend);
 const delta=d.single_rate-householdsPref.single_rate;
 comparison.textContent=`県全体の単身世帯率 ${householdsPref.single_rate.toFixed(1)}% に対し、${getCity(selected).name}は ${Math.abs(delta).toFixed(1)}ポイント${Math.abs(delta)<0.05?'で、ほぼ同じ':delta>0?'高い':'低い'}。`;
}
function renderSenior(){
 const host=$('#senior-stats'),intro=$('#senior-intro'),comparison=$('#senior-pref');
 if(!host||!intro||!comparison)return;
 host.replaceChildren();comparison.textContent='';
 const d=senior(getCity(selected));if(!d){intro.textContent='この市町村の高齢者世帯データは未収録です。';return}
 intro.textContent=`${getCity(selected).name}の2025年一般世帯 ${num(d.general_households)}世帯に対する割合`;
 const fields=[['65歳以上の単身世帯',d.elderly_single_households,'elderly_single_rate'],['高齢夫婦のみの世帯',d.elderly_couple_households,'elderly_couple_rate'],['3世代世帯',d.three_generation_households,'three_generation_rate']];
 for(const [label,count,key] of fields){const box=make('div','senior-stat');box.append(make('span','',label),make('strong','',`${num(count)}世帯`),make('small','',`一般世帯の${d[key].toFixed(1)}%`));host.append(box)}
 const delta=d.elderly_single_rate-seniorPref.elderly_single_rate;
 comparison.textContent=`県全体の高齢単身世帯率 ${seniorPref.elderly_single_rate.toFixed(1)}% に対し、${getCity(selected).name}は ${Math.abs(delta).toFixed(1)}ポイント${Math.abs(delta)<0.05?'でほぼ同じ':delta>0?'高い':'低い'}。`;
}
function renderFamily(){
 const host=$('#family-stats'),intro=$('#family-intro'),comparison=$('#family-pref');
 if(!host)return;host.replaceChildren();comparison.textContent='';
 const d=family(getCity(selected));if(!d){intro.textContent='この市町村の家族構成データは未収録です。';return}
 intro.textContent=`${getCity(selected).name}の2025年一般世帯 ${num(d.general_households)}世帯に対する割合`;
 const fields=[['18歳未満の世帯員がいる世帯',d.under18_households,'under18_households_rate'],['夫婦と子どもから成る世帯',d.couple_children_households,'couple_children_rate'],['母と子どもから成る世帯',d.single_mother_children_households,'single_mother_children_rate'],['父と子どもから成る世帯',d.single_father_children_households,'single_father_children_rate']];
 for(const [label,count,key] of fields){const box=make('div','senior-stat');box.append(make('span','',label),make('strong','',`${num(count)}世帯`),make('small','',`一般世帯の${d[key].toFixed(1)}%`));host.append(box)}
 const delta=d.under18_households_rate-familyPref.under18_households_rate;
 comparison.textContent=`県全体で18歳未満の世帯員がいる世帯の割合は${familyPref.under18_households_rate.toFixed(1)}%。${getCity(selected).name}は${Math.abs(delta).toFixed(1)}ポイント${Math.abs(delta)<0.05?'でほぼ同じ':delta>0?'高い':'低い'}。`;
}
function renderEducation(){
 const host=$('#education-stats'),intro=$('#education-intro'),pref=$('#education-pref');
 if(!host||!intro||!pref)return;
 host.replaceChildren();pref.replaceChildren();
 const d=educationData[selected];
 intro.textContent=`${getCity(selected)?.name||'自治体'}｜2025年5月1日現在（学校所在地別）`;
 if(!d||!educationKinds.every(k=>Number.isInteger(d[k])&&d[k]>=0)){
  host.append(make('p','muted','市町村別の学校基本調査データはまだ未収録です。県全体の確定値のみ確認できます。'));
 } else {
  for(const k of educationKinds){const item=make('div','senior-stat');item.append(make('span','',educationLabels[k]),make('strong','',formatValue(d[k],k)));host.append(item)}
  for(const k of educationDerivedKinds){const item=make('div','senior-stat');item.append(make('span','',educationDerivedLabels[k]),make('strong','',formatValue(educationDerivedValue(getCity(selected),k),k)));host.append(item)}
 }
 const title=make('strong','','愛知県全体（2025年度・確定値）');pref.append(title);
 for(const k of educationKinds){if(Number.isInteger(educationPref[k]))pref.append(make('p','muted tiny',`${educationLabels[k]}：${formatValue(educationPref[k],k)}`))}
 if(educationPref.primary_schools>0&&educationPref.junior_schools>0){pref.append(make('p','muted tiny',`小学校1校当たり児童数：${formatValue(educationPref.primary_students/educationPref.primary_schools,'primary_students_per_school')}`));pref.append(make('p','muted tiny',`中学校1校当たり生徒数：${formatValue(educationPref.junior_students/educationPref.junior_schools,'junior_students_per_school')}`))}
}
function renderHousing(){
 const host=$('#housing-stats'),intro=$('#housing-intro'),comp=$('#housing-pref');if(!host||!intro||!comp)return;
 host.replaceChildren();comp.replaceChildren();const d=housingData[selected];if(!d){intro.textContent='2025年の住宅統計は未収録です。';return}
 intro.textContent=`${getCity(selected).name}：住宅に住む一般世帯 ${num(d.residential)}世帯`;
 for(const k of housingKinds){const card=make('div','senior-stat');card.append(make('span','',housingLabels[k]),make('strong','',formatValue(d[k],k)));host.append(card)}
 const text=make('p','muted tiny',`県全体の持ち家率 ${housingPref.owner_rate.toFixed(1)}% ／ ${getCity(selected).name}との差 ${(d.owner_rate-housingPref.owner_rate>=0?'+':'')+(d.owner_rate-housingPref.owner_rate).toFixed(1)}ポイント`);comp.append(text);
 const note=make('p','muted tiny',`持ち家 ${num(d.owner)}世帯、借家 ${num(d.public_rent+d.private_rent+d.company_rent)}世帯、一戸建 ${num(d.detached)}世帯、共同住宅 ${num(d.apartment)}世帯`);comp.append(note);
}
function renderSeniorHousing(){
 const host=$('#senior-housing-stats'),intro=$('#senior-housing-intro'),pref=$('#senior-housing-pref');if(!host||!intro||!pref)return;
 host.replaceChildren();pref.replaceChildren();
 const d=seniorHousingData[selected];if(!d){intro.textContent='2025年の高齢者と住まいの統計は未収録です。';return}
 intro.textContent='65歳以上の世帯員がいる世帯の住宅状況です。';
 const fields=[['65歳以上の人がいる世帯',d.elderly_households,'世帯'],['うち持ち家に住む世帯',d.elderly_owner,'世帯'],['高齢者世帯の持ち家率',d.elderly_owner_rate,'%'],['高齢者世帯の借家率',d.elderly_rental_rate,'%'],['75歳以上の人がいる世帯',d.over75_households,'世帯'],['85歳以上の人がいる世帯',d.over85_households,'世帯']];
 for(const [label,v,unit] of fields){const card=make('div','senior-stat');card.append(make('span','',label),make('strong','',unit==='%'?v.toFixed(1)+'%':num(v)+'世帯'));host.append(card)}
 const diff=d.elderly_owner_rate-seniorHousingPref.elderly_owner_rate;
 pref.append(make('p','muted tiny',`高齢者世帯の持ち家率：県全体 ${seniorHousingPref.elderly_owner_rate.toFixed(1)}% ／ ${getCity(selected).name} ${d.elderly_owner_rate.toFixed(1)}%（県との差 ${diff>=0?'+':''}${diff.toFixed(1)}ポイント）`));
}
function renderCoupleLife(){
 const host=$('#couple-life-stats'),intro=$('#couple-life-intro'),pref=$('#couple-life-pref');if(!host||!intro||!pref)return;
 host.replaceChildren();pref.replaceChildren();const d=coupleLifeData[selected];if(!d){intro.textContent='2025年の夫婦世帯データは未収録です。';return}
 intro.textContent=`${getCity(selected).name}：夫婦のみの一般世帯 ${num(d.couple_only)}世帯。割合は指標ごとに分母を確認してください。`;
 const fields=[['夫婦のみの世帯数','couple_only'],['夫婦とも65歳以上の割合','couple_both65_rate'],['夫65歳以上・妻60歳以上の割合','couple_senior_rate'],['夫60歳未満の割合','couple_husband_under60_rate'],['夫婦のみ世帯の持ち家率','couple_owner_rate']];
 for(const [label,key] of fields){const card=make('div','senior-stat');card.append(make('span','',label),make('strong','',formatValue(d[key],key)));host.append(card)}
 const delta=d.couple_both65_rate-coupleLifePref.couple_both65_rate;
 pref.append(make('p','muted tiny',`夫婦とも65歳以上の割合：県全体 ${coupleLifePref.couple_both65_rate.toFixed(1)}% ／ ${getCity(selected).name} ${d.couple_both65_rate.toFixed(1)}%（県との差 ${delta>=0?'+':''}${delta.toFixed(1)}ポイント）`));
 pref.append(make('p','muted tiny','※「夫婦のみ」は子どもと同居する世帯を含みません。持ち家率の分母のみ住宅に住む夫婦のみの世帯です。'));
}
function renderChart(){const kind=$('#ranking-metric').value,order=$('#ranking-order').value;const rows=municipalities.map(c=>({c,v:value(c,kind)})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>order==='asc'?a.v-b.v:b.v-a.v);const top=rows.slice(0,12),selectedRow=rows.find(x=>x.c.code===selected);if(selectedRow&&!top.includes(selectedRow))top.push(selectedRow);$('#ranking-caption').textContent=`${(seniorKinds.includes(kind)||hhKinds.includes(kind)||familyKinds.includes(kind)||educationKinds.includes(kind)||educationDerivedKinds.includes(kind)||housingKinds.includes(kind)||seniorHousingKinds.includes(kind)||coupleLifeKinds.includes(kind))?2025:year}年 ${kind==='change'?`${priorYear()}年比人口増減率`:({population:'人口',elderly:'高齢化率',households:'世帯数',...hhLabel,...seniorLabel,...familyLabel,...housingLabels,...seniorHousingLabels,...coupleLifeLabels})[kind]||metricDef(kind)?.label||kind}：${order==='asc'?'低い順':'高い順'} 上位12＋選択中`;els.chart.replaceChildren();const min=Math.min(0,...rows.map(x=>x.v)),max=Math.max(0,...rows.map(x=>x.v)),range=max-min||1;for(const {c,v} of top){const row=make('div','bar-row');row.append(make('span','',c.name));const track=make('div','bar-track'),fill=make('div','bar-fill'+(c.code===selected?' selected':''));fill.style.width=Math.max(1,(v-min)/range*100)+'%';track.append(fill);row.append(track,make('span','bar-value',formatValue(v,kind)));els.chart.append(row)}if(!rows.length)els.chart.append(make('p','muted','この指標は未収録です。'))}
function renderComparison(){els.comp.replaceChildren();const cs=[getCity(els.a.value),getCity(els.b.value)].filter(Boolean);for(const c of cs){const card=make('div','compare-result');card.append(make('h3','',c.name),make('strong','',fmt(population(c))),make('small','',`${year}年国勢調査／県内${rank(c)}位`));els.comp.append(card)}const host=$('#comparison-bars');host.replaceChildren();const max=Math.max(1,...cs.map(c=>population(c)));for(const c of cs){const row=make('div','compare-mini'),track=make('div','bar-track'),fill=make('div','bar-fill');fill.style.width=(population(c)/max*100)+'%';track.append(fill);row.append(make('strong','',c.name),track);host.append(row)}if(cs.length===2){host.append(make('p','muted tiny',`総人口差：${fmt(Math.abs(population(cs[0])-population(cs[1])))}（${year}年）`));const ch=cs.map(c=>change(c)),el=cs.map(c=>elderly(c));$('#compare-details').textContent=[Number.isFinite(ch[0])&&Number.isFinite(ch[1])?`${priorYear()}〜${year}年増減率：${cs.map((c,i)=>c.name+' '+pct(ch[i])).join('／')}`:null,el.every(Number.isFinite)?`高齢化率：${cs.map((c,i)=>c.name+' '+el[i].toFixed(1)+'%').join('／')}`:null].filter(Boolean).join(' ・ ')||'この年度の人口を比較しています。'}}
function buildStory(c){const changeValue=change(c),local=elderly(c),pr=priorYear(),p=population(c),data=info(c);const sumAge=ages.map(([key])=>data[`${key}_${year}`]);const cards=[{title:'人口と県内順位',value:fmt(p),desc:`${year}年の総人口は愛知県内54市町村中${rank(c)}位です。県全体の${(p/prefTotal()*100).toFixed(2)}%を占めます。`,meta:`${year}年国勢調査`},{title:'直前5年間の人口変化',value:pct(changeValue),desc:Number.isFinite(changeValue)?`${pr}年の${fmt(population(c,pr))}から${year}年の${fmt(p)}に変化しました。増減の原因を表すものではありません。`:'2015年より前の人口は収録されていません。',meta:pr?`${pr}年→${year}年`:'比較対象なし'},{title:'65歳以上人口の割合',value:Number.isFinite(local)?local.toFixed(1)+'%':'未収録',desc:year===2025?'年齢不詳を除く人口に対する65歳以上の割合です。':year===2020?'年齢不詳補完値から算出した割合です。':'この年度の年齢別人口は未収録です。',meta:`${year}年国勢調査`},{title:'年齢構成・暮らし',value:year===2025?`${num(households(c))}世帯`:year===2020?'2020年 年齢3区分':'未収録',desc:sumAge.every(Number.isInteger)?`0〜14歳 ${fmt(sumAge[0])}、15〜64歳 ${fmt(sumAge[1])}、65歳以上 ${fmt(sumAge[2])}。${year===2025?`年齢不詳 ${fmt(data.age_unknown_2025)}。`:''}`:'追加の年齢区分データは未収録です。',meta:`${year}年国勢調査`}];return cards}
function renderCityStory(){const c=getCity(selected),cards=buildStory(c);$('#glance-summary').textContent=`${year}年の${c.name}の人口は${fmt(population(c))}。${Number.isFinite(change(c))?`直前5年間の人口増減率は${pct(change(c))}。`:''}${Number.isFinite(elderly(c))?`高齢化率は${elderly(c).toFixed(1)}%。`:''}`;$('#story-city').textContent=`${c.name}の特徴（${year}年）`;const host=$('#story-cards');host.replaceChildren();for(const o of cards){const card=make('article','v09-story-card');card.append(make('h4','',o.title),make('div','v09-story-value',o.value),make('p','',o.desc),make('div','v09-story-meta',o.meta));host.append(card)}storyText=`${c.name}（${year}年国勢調査）\n`+cards.map(o=>`${o.title}: ${o.value}\n${o.desc}`).join('\n\n')+'\n\n出典：愛知県・国勢調査。2020年・2025年は年齢不詳の取扱いが異なります。'}
function activateTabs(selector,attr,prefix,active){for(const t of all(selector)){const yes=t.dataset[attr]===active;t.classList.toggle('active',yes);t.classList.toggle('is-active',yes);t.setAttribute('aria-selected',String(yes));t.tabIndex=yes?0:-1;const pane=$(`#${prefix}${t.dataset[attr]}`);if(pane)pane.hidden=!yes}}
function initTabs(selector,attr,prefix){const tabs=all(selector);for(const t of tabs){t.addEventListener('click',()=>activateTabs(selector,attr,prefix,t.dataset[attr]));t.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();let i=tabs.indexOf(t);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;activateTabs(selector,attr,prefix,tabs[i].dataset[attr]);tabs[i].focus()})}}

// v2.1: municipalities scatter plot. This reuses the validated catalogue and value().
const discoveryPairs=[['elderly','elderly_single_rate'],['change','under18_households_rate'],['owner_rate','elderly_owner_rate'],['primary_students_per_school','junior_students_per_school']];
let discoveryX='elderly',discoveryY='elderly_single_rate';
const svgNode=(name,attributes={})=>{const e=document.createElementNS('http://www.w3.org/2000/svg',name);for(const [k,v] of Object.entries(attributes))e.setAttribute(k,String(v));return e};
function setupDiscovery(){
 const xs=$('#discovery-x'),ys=$('#discovery-y');const available=catalog.metrics.filter(m=>m.years.includes(2025)&&m.id!=='share');
 for(const select of [xs,ys])select.replaceChildren(...available.map(m=>new Option(`${m.label}（${m.unit}）`,m.id)));
 xs.value=discoveryX;ys.value=discoveryY;
 xs.addEventListener('change',()=>{discoveryX=xs.value;renderDiscovery()});
 ys.addEventListener('change',()=>{discoveryY=ys.value;renderDiscovery()});
 for(const b of all('.discovery-preset'))b.addEventListener('click',()=>{discoveryX=b.dataset.x;discoveryY=b.dataset.y;xs.value=discoveryX;ys.value=discoveryY;renderDiscovery()});
 renderDiscovery();
}
function renderDiscovery(){
 const host=$('#discovery-chart'),status=$('#discovery-status'),selectedBox=$('#discovery-selected');if(!host||!catalog||!municipalities.length)return;
 if(year!==2025){host.replaceChildren();status.textContent='この分析は2025年データに対応しています。上部の年度を「2025年」に切り替えてください。';selectedBox.textContent='';return}
 const xDef=metricDef(discoveryX),yDef=metricDef(discoveryY);
 if(!xDef||!yDef){status.textContent='指標の定義が見つかりません';return}
 const rows=municipalities.map(c=>({c,x:value(c,discoveryX),y:value(c,discoveryY)})).filter(r=>Number.isFinite(r.x)&&Number.isFinite(r.y));
 const omitted=municipalities.length-rows.length;
 if(!rows.length){host.replaceChildren();status.textContent='この組み合わせでは比較できる市町村データがありません。';selectedBox.textContent='';return}
 status.textContent=`2025年データ：${rows.length}/54市町村を表示${omitted?`（欠損 ${omitted}市町村）`:''}。点をクリックまたはEnterキーで自治体を選択できます。`;
 const W=760,H=445,L=100,R=30,T=27,B=79,tw=W-L-R,th=H-T-B;
 const extent=key=>{const a=rows.map(r=>r[key]);let lo=Math.min(...a),hi=Math.max(...a);const pad=(hi-lo||Math.max(Math.abs(hi),1))*.075;return [lo-pad,hi+pad]};
 const [xmin,xmax]=extent('x'),[ymin,ymax]=extent('y');const xp=v=>L+(v-xmin)/(xmax-xmin)*tw,yp=v=>H-B-(v-ymin)/(ymax-ymin)*th;
 const svg=svgNode('svg',{viewBox:`0 0 ${W} ${H}`,role:'group','aria-label':`${xDef.label}と${yDef.label}の54市町村散布図`});
 const ticks=5,number=n=>Number(n).toLocaleString('ja-JP',{maximumFractionDigits:1});
 for(let i=0;i<=ticks;i++){
  const x=L+tw*i/ticks,y=T+th*i/ticks;
  svg.append(svgNode('line',{x1:x,y1:T,x2:x,y2:H-B,class:'discovery-grid'}),svgNode('line',{x1:L,y1:y,x2:W-R,y2:y,class:'discovery-grid'}));
  const xt=svgNode('text',{x,y:H-B+21,'text-anchor':'middle',class:'discovery-tick'});xt.textContent=number(xmin+(xmax-xmin)*i/ticks);svg.append(xt);
  const yt=svgNode('text',{x:L-10,y:y+4,'text-anchor':'end',class:'discovery-tick'});yt.textContent=number(ymax-(ymax-ymin)*i/ticks);svg.append(yt);
 }
 svg.append(svgNode('line',{x1:L,y1:H-B,x2:W-R,y2:H-B,class:'discovery-axis'}),svgNode('line',{x1:L,y1:T,x2:L,y2:H-B,class:'discovery-axis'}));
 const xl=svgNode('text',{x:L+tw/2,y:H-21,'text-anchor':'middle',class:'discovery-axis-label'});xl.textContent=`${xDef.label}（${xDef.unit}）`;svg.append(xl);
 const yl=svgNode('text',{x:22,y:T+th/2,transform:`rotate(-90 22 ${T+th/2})`,'text-anchor':'middle',class:'discovery-axis-label'});yl.textContent=`${yDef.label}（${yDef.unit}）`;svg.append(yl);
 for(const r of rows){const dot=svgNode('circle',{cx:xp(r.x),cy:yp(r.y),r:r.c.code===selected?7:5.3,class:'discovery-dot'+(r.c.code===selected?' is-selected':''),tabindex:0,role:'button','aria-label':`${r.c.name}、${xDef.label}${number(r.x)}、${yDef.label}${number(r.y)}`});const title=svgNode('title');title.textContent=`${r.c.name}\n${xDef.label}: ${formatValue(r.x,discoveryX)}\n${yDef.label}: ${formatValue(r.y,discoveryY)}`;dot.append(title);dot.addEventListener('click',()=>choose(r.c.code));dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(r.c.code)}});svg.append(dot)}
 host.replaceChildren(svg);const r=rows.find(r=>r.c.code===selected);selectedBox.replaceChildren();if(r){selectedBox.append(make('strong','',r.c.name),make('span','',`：${xDef.label} ${formatValue(r.x,discoveryX)} ／ ${yDef.label} ${formatValue(r.y,discoveryY)}`))}else selectedBox.textContent='選択中の自治体には、この組み合わせのデータがありません。';
}

function toast(message){els.toast.textContent=message;els.toast.classList.add('show');setTimeout(()=>els.toast.classList.remove('show'),2800)}
async function boot(){try{await loadCatalog();const [popRes,histRes,hhRes,seniorRes,familyRes]=await Promise.all([fetch('./data/municipalities.json'),fetch('./data/historical.json'),fetch('./data/households_2025.json'),fetch('./data/senior_households_2025.json'),fetch('./data/family_2025.json')]);if(!popRes.ok||!histRes.ok)throw new Error('統計データを読み込めません');municipalities=await popRes.json();const raw=await histRes.json();if(raw.schema_version!==1||!raw.cities)throw new Error('統計データ形式が正しくありません');historical=raw.cities;if(!hhRes.ok)throw new Error('世帯統計データを読み込めません');const hhRaw=await hhRes.json();if(hhRaw.year!==2025||hhRaw.schema_version!==1||Object.keys(hhRaw.cities||{}).length!==54)throw new Error('世帯統計の54市町村を検証できません');householdsData=hhRaw.cities;householdsPref=hhRaw.prefecture;if(!seniorRes.ok)throw new Error('高齢者世帯データを読み込めません');const seniorRaw=await seniorRes.json();if(seniorRaw.year!==2025||seniorRaw.schema_version!==1||Object.keys(seniorRaw.cities||{}).length!==54)throw new Error('高齢者世帯データの形式が正しくありません');seniorData=seniorRaw.cities;seniorPref=seniorRaw.prefecture;if(!familyRes.ok)throw new Error('家族構成データを読み込めません');const familyRaw=await familyRes.json();if(familyRaw.year!==2025||familyRaw.schema_version!==1||Object.keys(familyRaw.cities||{}).length!==54)throw new Error('家族構成データの54市町村を検証できません');familyData=familyRaw.cities;familyPref=familyRaw.prefecture;
 const housingRes=await fetch('./data/housing_2025.json');if(!housingRes.ok)throw new Error('住宅統計データを読み込めません');const housing=await housingRes.json();if(housing.schema_version!==1||housing.year!==2025||Object.keys(housing.cities||{}).length!==54)throw new Error('住宅統計の54市町村を検証できません');housingData=housing.cities;housingPref=housing.prefecture;for(const k of ['residential','owner','public_rent','private_rent','company_rent','lodger','detached','row_houses','apartment']){const total=Object.values(housingData).reduce((acc,row)=>acc+row[k],0);if(total!==housingPref[k])throw new Error('住宅統計の県計照合に失敗しました：'+k)}
 const shRes=await fetch('./data/senior_housing_2025.json');if(!shRes.ok)throw new Error('高齢者と住まいの統計を読み込めません');const sh=await shRes.json();if(sh.schema_version!==1||sh.year!==2025||Object.keys(sh.cities||{}).length!==54)throw new Error('高齢者と住まいの54市町村を検証できません');seniorHousingData=sh.cities;seniorHousingPref=sh.prefecture;for(const k of ['elderly_households','elderly_residential','elderly_owner','elderly_public_rent','elderly_private_rent','elderly_company_rent','elderly_lodger','over75_households','over85_households']){if(Object.values(seniorHousingData).reduce((acc,row)=>acc+row[k],0)!==seniorHousingPref[k])throw new Error('高齢者と住まいの県計照合に失敗しました：'+k)}
 const clRes=await fetch('./data/couple_lifestage_2025.json');if(!clRes.ok)throw new Error('夫婦・ライフステージ統計を読み込めません');const cl=await clRes.json();if(cl.schema_version!==1||cl.year!==2025||Object.keys(cl.cities||{}).length!==54)throw new Error('夫婦・ライフステージ統計の54市町村を検証できません');coupleLifeData=cl.cities;coupleLifePref=cl.prefecture;for(const k of ['couple_only','couple_both65','couple_senior','couple_husband_under60','couple_owner','couple_residential']){if(Object.values(coupleLifeData).reduce((acc,row)=>acc+row[k],0)!==coupleLifePref[k])throw new Error('夫婦・ライフステージ統計の県計照合に失敗しました：'+k)}
 const eduRes=await fetch('./data/education_2025.json');
 if(eduRes.ok){const edu=await eduRes.json();if(edu.schema_version!==1||edu.year!==2025||!edu.cities||!edu.prefecture)throw new Error('教育データの形式が正しくありません');
 educationPref=edu.prefecture;educationData=edu.cities;
 for(const [code,entry] of Object.entries(educationData)){if(!municipalities.some(c=>c.code===code)||!educationKinds.every(k=>Number.isInteger(entry[k])&&entry[k]>=0))throw new Error('教育データの市町村コード・数値が不正です')}
 if(Object.keys(educationData).length===54){for(const k of educationKinds){const total=Object.values(educationData).reduce((acc,row)=>acc+row[k],0);if(total!==educationPref[k])throw new Error('教育データの県計照合に失敗しました：'+k)}}
 }
 if(municipalities.length!==54||municipalities.some(c=>!Number.isInteger(c.population)||!Number.isInteger(historical[c.code]?.population_2025)||!Number.isInteger(historical[c.code]?.households_2025)))throw new Error('54市町村の人口・世帯の整合性を確認できません');
 const qp=new URLSearchParams(location.search),requested=qp.get('city'),requestedYear=Number(qp.get('year'));if(getCity(requested))selected=requested;if([2015,2020,2025].includes(requestedYear))year=requestedYear;
 renderList();selectOptions();const ranking=$('#ranking-metric');ranking.replaceChildren(...catalog.metrics.filter(m=>m.id!=='share').map(m=>new Option(m.label,m.id)));els.year.addEventListener('change',()=>setYear(els.year.value));els.picker.addEventListener('change',()=>choose(els.picker.value));els.a.addEventListener('change',renderComparison);els.b.addEventListener('change',renderComparison);els.mapRetry.addEventListener('click',loadMap);
 $('#category-select').addEventListener('change',e=>setCategory(e.target.value));$('#indicator-select').addEventListener('change',e=>setMetric(e.target.value));$('#detail-section-select').addEventListener('change',e=>showDetailPane(e.target.value));
 $('#ranking-metric').addEventListener('change',renderChart);$('#ranking-order').addEventListener('change',renderChart);
 initTabs('.tool-tab','panel','panel-');setupDiscovery();setupReport();initTabs('.city-detail-tab','cityPane','city-pane-');
 $('#open-story').addEventListener('click',()=>{activateTabs('.tool-tab','panel','panel-','story');$('#tools').scrollIntoView({behavior:'smooth'});$('#tab-story').focus()});
 $('#share').addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('city',selected);url.searchParams.set('year',year);try{await navigator.clipboard.writeText(url.href);toast('このまちのURLをコピーしました')}catch{toast('コピーできませんでした')}});
 $('#copy-story').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(storyText);toast('解説をコピーしました')}catch{toast('コピーできませんでした')}});
 setYear(year);await loadMap();
 }catch(e){console.error(e);$('#data-error').hidden=false;$('#data-error').textContent='統計の読み込みに失敗しました。再読み込みしても改善しない場合は運営にご連絡ください。';els.name.textContent='読み込み失敗';els.mapStatus.textContent='統計データを確認してください。'}}
boot();


// v2.2 自治体比較レポート: 既存統計を参照し、JSONを改変しない。
const reportSections=[
 {heading:'人口・年齢',metrics:[['population','総人口'],['change','2020〜2025年人口増減率'],['elderly','高齢化率']]},
 {heading:'世帯・子育て',metrics:[['households','世帯数（総世帯）'],['single_rate','単身世帯率'],['under18_households_rate','18歳未満がいる世帯率']]},
 {heading:'住宅・高齢者',metrics:[['owner_rate','持ち家率'],['apartment_rate','共同住宅率'],['elderly_single_rate','高齢単身世帯率'],['elderly_owner_rate','高齢者世帯の持ち家率']]},
 {heading:'教育・学校',metrics:[['primary_schools','小学校数'],['primary_students','小学校児童数'],['junior_schools','中学校数'],['junior_students','中学校生徒数'],['primary_students_per_school','小学校1校当たり児童数'],['junior_students_per_school','中学校1校当たり生徒数']]}
];
function reportCities(){return ['report-a','report-b','report-c'].map(id=>document.getElementById(id)?.value).filter(Boolean).map(getCity).filter(Boolean)}
function setupReport(){
 const defaults=['23100','23211',''];
 ['report-a','report-b','report-c'].forEach((id,i)=>{
  const el=document.getElementById(id);el.replaceChildren();
  if(i===2)el.add(new Option('選択しない',''));
  for(const c of municipalities)el.add(new Option(c.name,c.code));
  el.value=defaults[i];el.addEventListener('change',renderReport);
 });
 document.getElementById('report-print').addEventListener('click',()=>{if(!reportCitiesValid())return;window.print()});
 document.getElementById('report-copy').addEventListener('click',async()=>{
  if(!reportCitiesValid())return;
  const cities=reportCities();let lines=[['分類','指標',...cities.map(c=>c.name)].join('\t')];
  for(const section of reportSections){for(const [k,label] of section.metrics){lines.push([section.heading,label,...cities.map(c=>reportFormat(c,k))].join('\t'))}}
  try{await navigator.clipboard.writeText(lines.join('\n'));toast('比較表をコピーしました')}catch{toast('コピーに失敗しました')}
 });
 document.getElementById('report-json').addEventListener('click',()=>{
  if(!reportCitiesValid())return;
  const payload=buildAnalysisPayload(reportCities());
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  const link=document.createElement('a');const url=URL.createObjectURL(blob);
  link.href=url;link.download='mieru-aichi-report-2025.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 renderReport();
}
function reportCitiesValid(){const cities=reportCities(),valid=cities.length>=2&&new Set(cities.map(c=>c.code)).size===cities.length;const status=document.getElementById('report-status');status.textContent=valid?'':'異なる自治体を2〜3件選択してください。';document.getElementById('report-print').disabled=!valid;document.getElementById('report-copy').disabled=!valid;return valid}
function reportValue(c,k){
 if(k==='population')return population(c,2025);
 if(k==='change')return change(c,2025);
 if(k==='elderly')return elderly(c,2025);
 if(k==='households')return households(c,2025);
 if(hhKinds.includes(k))return household(c)?.[k]??null;
 if(seniorKinds.includes(k))return senior(c)?.[k]??null;
 if(familyKinds.includes(k))return family(c)?.[k]??null;
 if(housingKinds.includes(k))return housingData[c.code]?.[k]??null;
 if(seniorHousingKinds.includes(k))return seniorHousingData[c.code]?.[k]??null;
 if(educationKinds.includes(k))return educationData[c.code]?.[k]??null;
 if(k==='primary_students_per_school'||k==='junior_students_per_school'){
  const d=educationData[c.code];if(!d)return null;const primary=k==='primary_students_per_school';const count=d[primary?'primary_schools':'junior_schools'];return count>0?d[primary?'primary_students':'junior_students']/count:null;
 }
 return null;
}
function reportFormat(c,k){const v=reportValue(c,k);if(!Number.isFinite(v))return '未収録';if(k==='population')return num(v)+'人';if(k==='households')return num(v)+'世帯';if(educationKinds.includes(k))return num(v)+(k.endsWith('schools')?'校':'人');if(k.endsWith('_per_school'))return v.toFixed(1)+'人/校';if(k==='change')return (v>0?'+':'')+v.toFixed(2)+'%';return v.toFixed(1)+'%'}
// v2.3: 県計から算出した値だけを県平均として使う。市町村平均は代替しない。
function reportPrefValue(k){
 const pref={
  population:prefTotal(2025),
  change:(()=>{const before=prefTotal(2020),after=prefTotal(2025);return before>0?(after-before)/before*100:null})(),
  households:municipalities.reduce((sum,c)=>sum+(households(c,2025)||0),0),
  single_rate:householdsPref.single_rate,
  under18_households_rate:familyPref.under18_households_rate,
  owner_rate:housingPref.owner_rate,
  apartment_rate:housingPref.apartment_rate,
  elderly_single_rate:seniorPref.elderly_single_rate,
  elderly_owner_rate:seniorHousingPref.elderly_owner_rate,
  primary_schools:educationPref.primary_schools,
  primary_students:educationPref.primary_students,
  junior_schools:educationPref.junior_schools,
  junior_students:educationPref.junior_students,
  primary_students_per_school:educationPref.primary_schools>0?educationPref.primary_students/educationPref.primary_schools:null,
  junior_students_per_school:educationPref.junior_schools>0?educationPref.junior_students/educationPref.junior_schools:null
 };
 if(k==='elderly')return null; // 県全体の年齢不詳を除く分母がこのデータ構造にないため非表示
 return Number.isFinite(pref[k])?pref[k]:null;
}
function reportSources(k){
 if(['primary_schools','primary_students','junior_schools','junior_students','primary_students_per_school','junior_students_per_school'].includes(k))return {title:'愛知県 2025年度学校基本調査',period:'2025-05-01'};
 return {title:'総務省・愛知県 2025年国勢調査',period:'2025-10-01'};
}
function reportDirection(k){return ['change','single_rate','under18_households_rate','owner_rate','apartment_rate','elderly_single_rate','elderly_owner_rate'].includes(k)}
function reportDiff(c,k){const a=reportValue(c,k),b=reportPrefValue(k);return reportDirection(k)&&Number.isFinite(a)&&Number.isFinite(b)?a-b:null}
function reportFacts(cities){return reportSections.flatMap(section=>section.metrics.map(([id,label])=>({id,label,section:section.heading,source:reportSources(id),prefecture:reportPrefValue(id),municipalities:cities.map(c=>({code:c.code,name:c.name,value:reportValue(c,id),differencePoints:reportDiff(c,id)}))})))}
function buildAnalysisPayload(cities){return {
 schema_version:1,report_version:'2.3',generated_at:new Date().toISOString(),target_year:2025,
 municipalities:cities.map(c=>({code:c.code,name:c.name})),
 indicators:reportFacts(cities),
 notes:['2025年人口・国勢調査は10月1日、学校基本調査は5月1日現在。','割合の差はパーセントポイント。','県値の算出根拠が得られない指標はnull。','単身世帯率は一般世帯、持ち家率は住宅に住む一般世帯を分母とする。','年齢構成が異なる年度間の単純比較に注意。','特徴は記述統計であり原因や政策効果を示さない。']
 }}
function reportTopObservations(cities){
 const candidates=[['change','人口増減率'],['single_rate','単身世帯率'],['under18_households_rate','18歳未満がいる世帯率'],['owner_rate','持ち家率'],['elderly_single_rate','高齢単身世帯率'],['elderly_owner_rate','高齢者世帯の持ち家率']];
 return cities.map(c=>{
  const rows=candidates.map(([id,label])=>({id,label,diff:reportDiff(c,id),value:reportValue(c,id)}))
   .filter(x=>Number.isFinite(x.diff)&&Math.abs(x.diff)>=1).sort((a,b)=>Math.abs(b.diff)-Math.abs(a.diff)).slice(0,2);
  return {city:c.name,code:c.code,observations:rows.map(x=>({id:x.id,label:x.label,value:x.value,differencePoints:x.diff,text:`${x.label}は${x.value.toFixed(1)}%で、愛知県全体より${Math.abs(x.diff).toFixed(1)}ポイント${x.diff>=0?'高い':'低い'}。`}))};
 });
}
function renderReportInsights(cities){
 const panel=document.getElementById('report-insights');panel.replaceChildren();
 const title=make('h4','','数字から読み取れる特徴（自動整理）');panel.append(title);
 for(const row of reportTopObservations(cities)){
  const card=make('div','report-insight-card');card.append(make('h5','',row.city));
  if(!row.observations.length){card.append(make('p','','県平均との差が1ポイント以上の対象指標はありません（または未収録）。'));}
  for(const v of row.observations)card.append(make('p','',v.text));
  panel.append(card);
 }
 panel.append(make('p','report-caveat','※ 差の大きさに基づく機械的な抽出です。良し悪しや原因を判断するものではありません。'));
}
function renderReportHighlights(cities){
 const host=document.getElementById('report-highlights');host.replaceChildren();
 for(const [k,label] of [['change','人口増減率'],['single_rate','単身世帯率'],['owner_rate','持ち家率']]){
  const values=cities.map(c=>({name:c.name,value:reportValue(c,k)})).filter(o=>Number.isFinite(o.value));
  if(!values.length)continue;
  const card=make('div','report-highlight');card.append(make('h5','',label));
  const max=Math.max(1,...values.map(o=>Math.abs(o.value)));
  for(const item of values){
   const row=make('div','report-highlight-row');row.append(make('span','',item.name));
   const track=make('div','report-highlight-track');const bar=make('div','report-highlight-bar');bar.style.width=(Math.abs(item.value)/max*100).toFixed(1)+'%';track.append(bar);
   row.append(track,make('strong','',`${item.value>0&&k==='change'?'+':''}${item.value.toFixed(1)}%`));card.append(row);
  }
  card.append(make('small','','棒は選択自治体間で最大の絶対値を100%とする相対表示。負値は数値の符号を参照。'));
  host.append(card);
 }
}
function renderReport(){if(!document.getElementById('report-table'))return;const host=document.getElementById('report-table');if(!reportCitiesValid()){host.replaceChildren();for(const id of ['report-highlights','report-insights','report-pref'])document.getElementById(id)?.replaceChildren();return}const cities=reportCities();const subtitle=document.getElementById('report-subtitle');subtitle.textContent=cities.map(c=>c.name).join(' ／ ');document.getElementById('report-date').textContent=new Date().toLocaleDateString('ja-JP');
 const table=document.createElement('table');table.className='report-data';const thead=document.createElement('thead'),head=document.createElement('tr');for(const s of ['指標',...cities.map(c=>c.name)]){const th=document.createElement('th');th.textContent=s;head.append(th)}thead.append(head);table.append(thead);const tbody=document.createElement('tbody');
 for(const section of reportSections){const group=document.createElement('tr');group.className='report-group';const th=document.createElement('th');th.colSpan=cities.length+1;th.textContent=section.heading;group.append(th);tbody.append(group);for(const [k,label] of section.metrics){const tr=document.createElement('tr');const metricName=document.createElement('th');metricName.scope='row';metricName.textContent=label;tr.append(metricName);for(const city of cities){const cell=document.createElement('td');cell.textContent=reportFormat(city,k);tr.append(cell)}tbody.append(tr)}}table.append(tbody);host.replaceChildren(table);
 // 県全体の参考値と割合指標の差（pt）を表の後半に追加
 const prefSection=make('section','report-pref-section');prefSection.append(make('h4','','愛知県全体との比較（差：ポイント）'));
 const prefTable=make('table','report-data');const hd=make('tr');for(const h of ['指標','愛知県全体',...cities.map(c=>c.name)])hd.append(make('th','',h));prefTable.append(hd);
 for(const [k,label] of [['change','人口増減率'],['single_rate','単身世帯率'],['under18_households_rate','18歳未満がいる世帯率'],['owner_rate','持ち家率'],['apartment_rate','共同住宅率'],['elderly_single_rate','高齢単身世帯率'],['elderly_owner_rate','高齢者世帯の持ち家率']]){
  const r=make('tr');r.append(make('th','',label));const pv=reportPrefValue(k);r.append(make('td','',Number.isFinite(pv)?pv.toFixed(1)+'%':'未収録'));
  for(const city of cities){const d=reportDiff(city,k);r.append(make('td','',Number.isFinite(d)?(d>=0?'+':'')+d.toFixed(1)+' pt':'未収録'));}prefTable.append(r);
 }
 prefSection.append(prefTable);document.getElementById('report-pref').replaceChildren(prefSection);
 renderReportHighlights(cities);renderReportInsights(cities);
}


// v2.4: 既存の検証済み統計計算を読み取り専用でAIナビゲーターに公開。
window.MieruAiData = Object.freeze({
 ready: () => municipalities.length === 54 && !!catalog,
 municipalities: () => municipalities.map(c=>({code:c.code,name:c.name})),
 metric: id => {const m=metricDef(id);return m?{id:m.id,label:m.label,source:m.source,description:m.description||'',unit:m.unit||'',years:m.years}:null},
 value2025: (code,id) => {if(year!==2025)return null;const c=getCity(code);const m=metricDef(id);if(!c||!m||!m.years.includes(2025))return null;const v=value(c,id);return Number.isFinite(v)?v:null},
 format: (value,id) => formatValue(value,id),
 selectedCity: () => selected,
 currentYear: () => year,
 selectCity: code => {if(getCity(code))choose(code)},
 selectMetric: id => {if(metricDef(id))setMetric(id)}
});
