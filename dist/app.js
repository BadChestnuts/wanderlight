import { APP_VERSION, demoTrips, today, countryName, countryKey, escapeHtml as h, icon, groupPlaces, filteredTrips, statistics, normalizeTrip, parseBackup, mergeTrips, backupPayload, dateLabel, tripDays, percent, number, readTrips, writeTrips, compressPhoto, placeKey } from './core.js';
import { TravelMap } from './map.js';
import { COUNTRY_META } from './countries.js';
const root=document.querySelector('#app'),modal=document.querySelector('#modal');
let atlas,places,ownTrips=[],map,state={page:'map',dataset:'demo',mode:'world',granularity:'country',flat:false,year:'all',query:'',selected:null,routes:false},tourTimer=null,tourIndex=0,toastTimer,formPhotos=[],formLocation=null,formEditing=null,photoBusy=false,storageOK=true,lastGeocode=0,lightboxReturn=null;
const globalCities=[
 ['392','东京',139.6917,35.6895],['392','大阪',135.5023,34.6937],['392','京都',135.7681,35.0116],['392','札幌',141.3545,43.0618],['392','福冈',130.4017,33.5904],['250','巴黎',2.3522,48.8566],['250','尼斯',7.262,43.7102],['756','苏黎世',8.5417,47.3769],['756','日内瓦',6.1432,46.2044],['826','伦敦',-.1276,51.5072],['826','爱丁堡',-3.1883,55.9533],['840','纽约',-74.006,40.7128],['840','洛杉矶',-118.2437,34.0522],['840','旧金山',-122.4194,37.7749],['410','首尔',126.978,37.5665],['410','釜山',129.0756,35.1796],['764','曼谷',100.5018,13.7563],['764','清迈',98.9853,18.7883],['702','新加坡',103.8198,1.3521],['360','巴厘岛',115.1889,-8.4095],['458','吉隆坡',101.6869,3.139],['704','河内',105.8342,21.0278],['036','悉尼',151.2093,-33.8688],['036','墨尔本',144.9631,-37.8136],['554','奥克兰',174.7633,-36.8485],['380','罗马',12.4964,41.9028],['380','威尼斯',12.3155,45.4408],['724','巴塞罗那',2.1734,41.3851],['724','马德里',-3.7038,40.4168],['276','柏林',13.405,52.52],['276','慕尼黑',11.582,48.1351],['528','阿姆斯特丹',4.9041,52.3676],['792','伊斯坦布尔',28.9784,41.0082],['784','迪拜',55.2708,25.2048],['818','开罗',31.2357,30.0444],['710','开普敦',18.4241,-33.9249],['124','温哥华',-123.1207,49.2827],['124','多伦多',-79.3832,43.6532],['620','里斯本',-9.1393,38.7223],['040','维也纳',16.3738,48.2082],['203','布拉格',14.4378,50.0755],['352','雷克雅未克',-21.9426,64.1466],['578','奥斯陆',10.7522,59.9139],['752','斯德哥尔摩',18.0686,59.3293],['246','赫尔辛基',24.9384,60.1699],['076','里约热内卢',-43.1729,-22.9068],['032','布宜诺斯艾利斯',-58.3816,-34.6037],['484','墨西哥城',-99.1332,19.4326],['604','利马',-77.0428,-12.0464],['356','新德里',77.209,28.6139],['524','加德满都',85.324,27.7172],['144','科伦坡',79.8612,6.9271],['116','暹粒',103.856,13.3633],['608','马尼拉',120.9842,14.5995],['682','利雅得',46.6753,24.7136],
];
const allTrips=()=>[...(state.dataset==='demo'?demoTrips():ownTrips)].sort((a,b)=>b.start.localeCompare(a.start));
let geocoderUrl='https://photon.komoot.io/api/';
const geocodeCache=new Map();
const currentTrips=()=>filteredTrips(allTrips(),state.year,state.query);
const stats=()=>statistics(currentTrips(),atlas,d3.geoArea,state.year);
function toast(text,error=false){const el=document.querySelector('#toast');clearTimeout(toastTimer);el.textContent=text;el.classList.toggle('error',error);el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,error?6500:4200);}
const image=(photo,cls='')=>`<img src="${h(photo?.src||'')}" alt="${h(photo?.name||'旅行照片')}" class="${cls}" loading="lazy" referrerpolicy="no-referrer">`;
function bindImages(scope=document){scope.querySelectorAll('img:not([data-safe-image])').forEach(img=>{img.dataset.safeImage='1';img.addEventListener('error',()=>{const box=document.createElement('div');box.className='photo-fallback';box.style.height=img.parentElement.classList.contains('feature-image')?'100%':'';box.innerHTML=icon('photo');box.setAttribute('aria-label','图片暂时不可用');img.replaceWith(box);});});}
const yearOptions=()=>`<option value="all">全部年份</option>${[...new Set(allTrips().flatMap(t=>{const years=[];for(let y=Number(t.start.slice(0,4));y<=Number(t.end.slice(0,4));y++)years.push(String(y));return years;}))].sort().reverse().map(y=>`<option value="${y}" ${state.year===y?'selected':''}>${y} 年</option>`).join('')}`;
const selectWrap=(contents)=>`<div class="select-wrap">${contents}${icon('down')}</div>`;
function renderShell(){
  stopTour();map?.dispose();map=null;
  const pageNames={map:'旅行地图',timeline:'旅行时间线',gallery:'回忆相册',report:'人生旅行报告'};
  root.innerHTML=`<div class="shell">
    <aside class="sidebar"><div class="brand"><img src="./favicon.svg" alt="点亮"><div><strong class="brand-name">点亮</strong><span class="brand-en">WANDERLIGHT</span></div></div><div class="nav-label">MY LITTLE WORLD</div>
    <nav aria-label="主要导航">${[['map','compass','旅行地图'],['timeline','clock','旅行时间线'],['gallery','photo','回忆相册'],['report','chart','旅行报告']].map(([p,i,label])=>`<button class="nav-link ${state.page===p?'active':''}" data-page="${p}" ${state.page===p?'aria-current="page"':''} title="${label}">${icon(i)}<span>${label}</span>${state.page===p?'<i class="nav-dot"></i>':''}</button>`).join('')}</nav>
    <div class="sidebar-lower"><div class="sidebar-quote">世界很大，<br>走过的每一步都值得收藏。<em>Collect moments, not things.</em></div><button class="nav-link" data-action="settings">${icon('settings')}<span>数据与设置</span></button><div class="profile"><div class="avatar">旅</div><div><strong>我的旅行手账</strong><small>让回忆，有迹可循</small></div>${icon('leaf')}</div></div></aside>
    <main class="main"><header class="topbar"><div class="crumb">我的世界 ${icon('chevron')} <span>${pageNames[state.page]}</span></div><div class="topbar-right"><div class="dataset-toggle" aria-label="记录来源"><button data-dataset="own" class="${state.dataset==='own'?'active':''}">我的足迹</button><button data-dataset="demo" class="${state.dataset==='demo'?'active':''}">示例足迹</button></div><span class="saved-status">${icon('lock')}${state.dataset==='demo'?'正在预览示例':'记录保存在本机'}</span><button class="icon-button mobile-settings" data-action="settings" aria-label="数据与设置">${icon('settings')}</button></div></header><div id="page-content" class="page-enter"></div><footer class="bottom-caption"><span>${state.dataset==='demo'?'示例旅行与配图用于体验 · 不计入我的记录':'每一份记忆都只属于你 · 记得定期导出备份'}</span><em>Somewhere, a new story awaits.</em></footer></main></div>`;
  const content=document.querySelector('#page-content');
  if(state.page==='map')renderMapPage(content);else if(state.page==='timeline')renderTimeline(content);else if(state.page==='gallery')renderGallery(content);else renderReport(content);
  bindImages(root);
}
function heading(eyebrow,title,subtitle,extra=''){return `<div class="heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${extra}<button class="btn primary" data-action="add">${icon('plus')}记录新旅程</button></div></div>`;}
function renderMapPage(content){
  const trips=currentTrips();if(!trips.some(t=>t.id===state.selected))state.selected=trips[0]?.id||null;
  content.innerHTML=heading('YOUR PERSONAL TRAVEL ATLAS','让回忆，有迹可循。','点亮走过的世界，收藏每一次出发。',`<button class="btn ghost" data-action="tour">${icon('play')}重温旅程</button>`)+`
    <section class="map-panel" aria-label="旅行地图"><div class="map-toolbar"><div class="map-toolbar-left"><div class="segmented" aria-label="地图范围"><button data-mode="world" class="${state.mode==='world'?'active':''}">${icon('globe')}全球</button><button data-mode="china" class="${state.mode==='china'?'active':''}">${icon('map')}中国</button></div>${selectWrap(`<select id="granularity" aria-label="地图显示粒度">${granularityOptions()}</select>`)}${selectWrap(`<select id="year-filter" aria-label="旅行年份">${yearOptions()}</select>`)}</div><div class="map-toolbar-right"><div class="segmented projection-label" id="projection-controls" ${state.mode==='china'?'hidden':''}><button data-projection="globe" class="${!state.flat?'active':''}">地球</button><button data-projection="flat" class="${state.flat?'active':''}">平面</button></div><button class="icon-button ${state.routes?'active':''}" data-action="routes" title="显示按时间连接的旅行路线" aria-label="显示旅行路线" aria-pressed="${state.routes}">${icon('compass')}</button></div></div>
    <div class="map-kicker"><small>THE WORLD IS YOUR STORY</small><h2>每一步，都算数。</h2></div><div id="map-wrap" class="map-wrap"></div><button class="btn small focus-back" id="focus-back" data-action="back-china" hidden>${icon('arrow')}返回全国</button>
    <div id="feature-card" class="feature-card"></div><div class="map-tools"><button class="icon-button" data-action="zoom-in" aria-label="放大地图" title="放大">${icon('plus')}</button><button class="icon-button" data-action="zoom-out" aria-label="缩小地图" title="缩小">${icon('minus')}</button><button class="icon-button" data-action="reset-map" aria-label="恢复默认视角" title="恢复视角">${icon('rotate')}</button><button class="icon-button" id="spin-button" data-action="spin" aria-label="自动旋转地球" title="自动旋转地球" ${state.mode==='china'||state.flat?'hidden':''}>${icon('play')}</button></div>
    ${state.dataset==='demo'?'<span class="demo-ribbon">示例足迹 · 体验你的未来旅行地图</span>':''}<div class="tour-status" id="tour-status" hidden></div><div class="map-note"><span class="legend"><i class="legend-dot"></i>已点亮</span><span class="legend"><i class="legend-outline"></i>等待探索</span><span class="map-hint">拖动探索 · 滚轮缩放 · 点击查看回忆</span></div><button class="map-attribution" data-action="sources">D3 · Natural Earth · ChinaGeoJson ↗</button></section><div class="map-summary" id="map-summary"></div>`;
  map=new TravelMap(document.querySelector('#map-wrap'),atlas,selectTrip,onRegion,(text,error)=>toast(text,error));
  map.showRoutes=state.routes;map.setView(state.mode,state.granularity,state.flat);map.update(trips,state.selected);
  document.querySelector('#map-wrap').addEventListener('cityfocus',e=>{const btn=document.querySelector('#focus-back');btn.hidden=!e.detail;document.querySelector('.map-panel').classList.toggle('city-focused',!!e.detail);if(e.detail)btn.innerHTML=`${icon('arrow')} ${h(e.detail.properties.name)} · 返回全国`;});
  document.querySelector('#map-wrap').addEventListener('spinchange',e=>{const btn=document.querySelector('#spin-button');if(btn){btn.innerHTML=icon(e.detail?'pause':'play');btn.classList.toggle('active',e.detail);btn.setAttribute('aria-pressed',String(e.detail));}});
  renderFeature();renderMapSummary();
}
function granularityOptions(){return (state.mode==='world'?[['country','国家高亮'],['city','城市光点']]:[['province','省级轮廓'],['city','市级轮廓'],['county','区县下钻']]).map(([v,label])=>`<option value="${v}" ${state.granularity===v?'selected':''}>${label}</option>`).join('');}
function renderFeature(){
  const box=document.querySelector('#feature-card');if(!box)return;
  const trip=currentTrips().find(t=>t.id===state.selected);
  if(!trip){box.innerHTML=`<div class="feature-empty">${icon('sparkle')}<h3>你的世界，<br>从下一次出发点亮。</h3><p>记录一个去过的地方，<br>让照片与回忆在地图上相遇。</p><button class="btn primary" data-action="add">${icon('plus')}点亮第一个地方</button></div>`;return;}
  const province=places.provinces.find(p=>p.id===trip.provinceId)?.name||'';
  const visits=currentTrips().filter(t=>placeKey(t)===placeKey(trip));
  box.innerHTML=`<div class="feature-image">${image(trip.photos[0])}<span class="feature-tag">${icon('pin')}${trip.demo?'示例回忆':'旅行回忆'}</span><span class="feature-image-label">A little piece of the world.</span></div><div class="feature-body"><div class="location-head"><h3>${h(trip.city.replace(/市$/,''))}</h3>${icon('pin')}</div><div class="feature-country">${h(trip.country)}${province?' · '+h(province):''}${trip.countyId?' · '+h(places.counties.find(c=>c.id===trip.countyId)?.name||''):''}</div><div class="feature-date">${icon('calendar')}${dateLabel(trip)}</div><p class="feature-note">${h(trip.note||trip.title)}</p><div class="tags">${trip.tags.slice(0,3).map(t=>`<span class="tag">${h(t)}</span>`).join('')}${visits.length>1?`<span class="tag">到访 ${visits.length} 次</span>`:''}</div><div class="feature-bottom"><span>${icon('photo')}${trip.photos.length} 张照片 · ${tripDays(trip)} 天</span><button class="text-link" data-detail="${trip.id}">打开这段回忆 ${icon('arrow')}</button></div></div>`;bindImages(box);
}
function renderMapSummary(){const s=stats();const items=state.mode==='world'?[[s.countries,'个','点亮国家 / 地区','globe'],[s.places,'座','留下足迹的城市 / 地区','pin'],[s.days,'天','在路上的时光','calendar'],[percent(s.worldPercent),'%','世界陆地点亮面积 ≈','sparkle']]:[[s.provinces,'个','点亮省级行政区','map'],[s.chineseCities,'座','点亮国内城市 / 地区','pin'],[s.photos,'张','收藏的旅行照片','photo'],[percent(state.granularity==='province'?s.provincePercent:s.chinaPercent),'%',state.granularity==='province'?'国内省级点亮面积 ≈':'国内市级点亮面积 ≈','sparkle']];document.querySelector('#map-summary').innerHTML=items.map(([v,unit,label,i])=>`<div class="summary-item"><div class="stat-icon">${icon(i)}</div><div><div class="summary-value">${v}<small>${unit}</small></div><div class="summary-label">${label}</div></div></div>`).join('');}
function setMode(mode){stopTour();state.mode=mode;state.granularity=mode==='world'?'country':'city';const trips=currentTrips();if(mode==='china'&&!trips.some(t=>t.id===state.selected&&t.countryId==='156'))state.selected=trips.find(t=>t.countryId==='156')?.id||null;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelector('#granularity').innerHTML=granularityOptions();document.querySelector('#projection-controls').hidden=mode==='china';document.querySelector('#spin-button').hidden=mode==='china'||state.flat;document.querySelector('#focus-back').hidden=true;map.setView(mode,state.granularity,state.flat);map.update(trips,state.selected);renderFeature();renderMapSummary();}
function selectTrip(id){state.selected=id;const trip=currentTrips().find(t=>t.id===id);if(!trip)return;map?.update(currentTrips(),id);map?.flyTo(trip);renderFeature();}
function onRegion(feature,mode,granularity,focus){
  if(mode==='world')openTripForm({countryId:countryKey(feature.id)});
  else if(granularity==='province')openTripForm({countryId:'156',provinceId:String(feature.id)});
  else if(granularity==='county'&&focus)openTripForm({countryId:'156',cityId:String(focus.id),countyId:String(feature.id)});
  else openTripForm({countryId:'156',cityId:String(feature.id)});
}
function toolbar(count,label){return `<div class="content-toolbar"><span>${state.dataset==='demo'?'示例 · ':''}${label} <strong>${count}</strong></span><div class="content-tools"><label class="search-bar">${icon('search')}<input id="content-search" type="search" value="${h(state.query)}" placeholder="搜索地点、回忆或标签" aria-label="搜索旅行"></label>${selectWrap(`<select id="year-filter" aria-label="旅行年份">${yearOptions()}</select>`)}</div></div>`;}
const empty=()=>`<div class="empty-state">${icon('compass')}<h2>${state.query||state.year!=='all'?'这段时光，还没有找到足迹。':'美好的故事，从一次出发开始。'}</h2><p>${state.query||state.year!=='all'?'试试其他关键词，或查看全部年份。':'记录一个旅行地点，上传一张照片，点亮属于你的世界。'}</p><button class="btn primary" data-action="${state.query||state.year!=='all'?'clear-filter':'add'}">${icon(state.query||state.year!=='all'?'rotate':'plus')}${state.query||state.year!=='all'?'查看全部旅行':'记录第一段旅程'}</button></div>`;
function renderTimeline(content){
  const trips=currentTrips().sort((a,b)=>b.start.localeCompare(a.start));
  const grouped=Object.groupBy(trips,t=>t.start.slice(0,4));
  content.innerHTML=heading('A TIMELINE OF LITTLE ADVENTURES','时间走过，回忆留下。','沿着时间，重访那些闪闪发光的日子。')+toolbar(trips.length,'段旅行')+(trips.length?Object.keys(grouped).sort().reverse().map(y=>`<div class="journey-year"><strong>${y}</strong><span></span><small>${grouped[y].length} 段回忆</small></div><div class="journey-list">${grouped[y].map(t=>`<button class="journey-row" data-detail="${t.id}">${image(t.photos[0])}<div><div class="meta">${icon('calendar')}${dateLabel(t)}</div><h3>${h(t.city)} <span class="row-title">/ ${h(t.country)}</span></h3><p class="row-title">${h(t.title)}</p><div class="tags">${t.tags.slice(0,3).map(tag=>`<span class="tag">${h(tag)}</span>`).join('')}</div></div><div class="row-end"><strong>${tripDays(t)} 天</strong>${t.photos.length} 张照片 ${icon('chevron')}</div></button>`).join('')}</div>`).join(''):empty());
}
function renderGallery(content){const trips=currentTrips().sort((a,b)=>b.start.localeCompare(a.start));content.innerHTML=heading('THE MOMENTS WE KEEP','把世界，装进相册。','一张照片，就能回到某个特别的瞬间。')+toolbar(trips.reduce((s,t)=>s+t.photos.length,0),'张旅行照片')+(trips.length?`<div class="gallery-grid">${trips.map(t=>`<button class="photo-card" data-detail="${t.id}"><div class="image-wrap">${image(t.photos[0])}<span class="image-count">${icon('photo')} ${t.photos.length}</span></div><div class="photo-card-body"><div class="location">${h(t.country)} · ${h(t.city)}</div><h3>${h(t.title)}</h3><p>${dateLabel(t)}</p></div></button>`).join('')}</div><p class="gallery-sub">${state.dataset==='demo'?'示例配图来自 Unsplash，仅用于演示；你的旅行照片会保存在本机。':'照片已自动压缩到适合浏览的尺寸；完整备份包含所有保存后的照片。'}</p>`:empty());}
function coverageRow(value,title,desc){const dash=2*Math.PI*37;return `<div class="coverage-row"><svg class="coverage-ring" viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="37"/><circle class="progress" cx="44" cy="44" r="37" stroke-dasharray="${dash}" stroke-dashoffset="${dash*(1-value/100)}"/></svg><div class="coverage-info"><strong>${percent(value)}<small>%</small></strong><p>${title}</p><span>${desc}</span></div></div>`;}
function renderReport(content){
  const trips=currentTrips(),s=stats();
  const years=[...new Set(trips.map(t=>t.start.slice(0,4)))].sort();const byYear=years.map(y=>[y,trips.filter(t=>t.start.startsWith(y)).length]);const max=Math.max(1,...byYear.map(x=>x[1]));
  const groups=groupPlaces(trips),countries=[...new Set(trips.map(t=>t.countryId))].map(id=>[countryName(id),trips.filter(t=>t.countryId===id).length]);
  const first=[...trips].sort((a,b)=>a.start.localeCompare(b.start))[0];
  content.innerHTML=heading('YOUR LIFE, IN PLACES','我的人生旅行报告。','把每一次出发，写成属于自己的年度故事。',`<button class="btn ghost" data-action="print">${icon('download')}保存报告</button>`)+toolbar(trips.length,`段旅行 · ${state.year==='all'?'全部时光':state.year+' 年'}`)+`<h1 class="report-print-title">点亮 · ${state.year==='all'?'人生':state.year+' 年'}旅行报告 ${state.dataset==='demo'?'（示例）':''}</h1>`+
    `<section class="report-hero"><div><div class="eyebrow">${state.dataset==='demo'?'DEMO TRAVEL STORY':'MY WANDERLIGHT STORY'} · ${state.year==='all'?'ALL MY JOURNEYS':state.year}</div><h2>世界的 <em>${s.places}</em> 个地方，<br>留住了我的一部分。</h2><p>${first?`从 ${first.start.replaceAll('-','.')} 的 ${h(first.city)} 出发，`:'还没有出发也没关系，'}<br>我已用 ${s.days} 天，收藏 ${s.trips} 段值得记住的旅程。</p><div class="gold-line"></div><p>走过的路，会变成心里的光。</p>${state.dataset==='demo'?'<div class="report-badge">'+icon('info')+'这是一份示例报告 · 切换「我的足迹」查看自己的总结</div>':''}</div><div class="hero-year">${state.year==='all'?'LIFE':state.year}</div></section>
    <div class="report-stat-grid">${[[s.countries,'点亮国家 / 地区','globe'],[s.places,'留下足迹的城市 / 地区','pin'],[s.days,'在路上的天数（日期去重）','calendar'],[s.photos,'收藏的旅行照片','photo']].map(([v,label,i])=>`<div class="report-stat">${icon(i)}<strong>${v}</strong><small>${label}</small></div>`).join('')}</div>
    <div class="report-grid"><section class="report-box"><h3>世界，被一点一点点亮。</h3><p class="caption">用相同的边界数据估算，重复到访只计算一次。</p>${coverageRow(s.worldPercent,'世界陆地点亮面积','已到访国家 / 地区的完整面积 · 不含南极')}${coverageRow(s.chinaPercent,'中国地图点亮面积','已到访市级行政区的完整面积')}<p class="footnote">面积占比表示到访行政区的完整陆地面积，并非实际游览面积；由简化边界按球面面积估算，仅作旅行可视化参考。国内指标始终以市级计算；仅记录城市时，不自动推断到访区县。${state.year!=='all'?'跨年旅行会在相关年份展示，旅行天数只计算本年份内的部分。':''}</p></section>
    <section class="report-box"><h3>那些出发的年份。</h3><p class="caption">每一年，都有属于自己的风景。旅行按开始年份计数。</p>${byYear.length?`<div class="bar-chart">${byYear.map(([y,count])=>`<div class="bar-col"><strong>${count} 段</strong><div class="bar" style="height:${Math.max(3,count/max*118)}px"></div><span>${y}</span></div>`).join('')}</div>`:'<div class="empty-state" style="padding:25px 10px;border:none"><p>记录旅行后，年度足迹会在这里展开。</p></div>'}<div class="visits-title">我走过的国家 / 地区</div><div class="country-chips">${countries.map(([name,count])=>`<span class="country-chip">${h(name)}<small>${count} 段旅行</small></span>`).join('')||'<p class="caption">下一次出发，从这里开始。</p>'}</div></section>
    <section class="report-box report-wide"><h3>我的旅行版图。</h3><p class="caption">${s.provinces} 个国内省级行政区 · ${s.chineseCities} 个国内城市 / 地区 · ${s.trips} 段旅程</p><div class="report-place-list">${groups.sort((a,b)=>a.country.localeCompare(b.country)||a.city.localeCompare(b.city,'zh-CN')).map(g=>`<div><span>${h(g.city)}</span><small>${h(g.country)} · ${g.visits.length} 次</small></div>`).join('')||'<p class="caption">你的第一段旅程正在等待被记录。</p>'}</div></section></div>`;
}
function openModal(contents,cls=''){modal.className=cls;modal.innerHTML=contents;if(!modal.open)modal.showModal();bindImages(modal);}
function modalHeader(title,subtitle=''){return `<div class="modal-header"><div><h2 id="modal-title">${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div><button class="icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button></div>`;}
function showDetail(id){
  stopTour();
  const trip=allTrips().find(t=>t.id===id);if(!trip)return;
  const visits=allTrips().filter(t=>placeKey(t)===placeKey(trip)).sort((a,b)=>b.start.localeCompare(a.start));
  openModal(modalHeader(trip.demo?'一段示例回忆':'旅行回忆',trip.demo?'示例记录可查看，自己的旅行可新增、编辑或删除。':'这段旅程，值得被好好收藏。')+`<div class="modal-detail-hero">${image(trip.photos[0])}<div class="modal-detail-name"><h2>${h(trip.city.replace(/市$/,''))}</h2><p>${h(trip.country)}${trip.countyId?' · '+h(places.counties.find(c=>c.id===trip.countyId)?.name||''):''}</p></div></div><div class="modal-body"><h3 class="detail-title">${h(trip.title)}</h3><div class="detail-meta"><span>${icon('calendar')}${dateLabel(trip)}</span><span>${icon('clock')}${tripDays(trip)} 天</span><span>${icon('photo')}${trip.photos.length} 张照片</span></div><p class="detail-note">${h(trip.note||'把这一刻好好收藏。')}</p><div class="tags">${trip.tags.map(t=>`<span class="tag">${h(t)}</span>`).join('')}</div><div class="detail-gallery">${trip.photos.map((p,i)=>`<button data-lightbox="${id}" data-photo-index="${i}" aria-label="放大查看第 ${i+1} 张照片">${image(p)}</button>`).join('')}</div>${trip.demo?'<p class="credit">示例图片 · Unsplash（与地点不构成真实拍摄对应关系）</p>':''}${visits.length>1?`<div class="visits-title">在这里的 ${visits.length} 次旅行</div>${visits.map(t=>`<button class="visit-button ${t.id===id?'active':''}" data-detail="${t.id}">${icon('pin')}<span>${h(t.title)}</span><small>${t.start}</small></button>`).join('')}`:''}<div class="detail-actions"><button class="btn" data-show-on-map="${id}">${icon('map')}在地图上查看</button>${trip.demo?'<button class="btn primary" data-action="add">'+icon('plus')+'记录我的旅行</button>':`<div class="form-actions"><button class="btn" data-edit="${id}">${icon('edit')}编辑</button><button class="btn danger" data-delete="${id}">${icon('trash')}删除</button></div>`}</div></div>`);
}
function showLightbox(id,index){const trip=allTrips().find(t=>t.id===id);if(!trip)return;const i=(index+trip.photos.length)%trip.photos.length;lightboxReturn=id;openModal(modalHeader(h(trip.city),h(trip.title))+image(trip.photos[i])+`<div class="lightbox-controls"><button class="btn small" data-lightbox="${id}" data-photo-index="${i-1}">上一张</button><span>${i+1} / ${trip.photos.length}</span><button class="btn small" data-lightbox="${id}" data-photo-index="${i+1}">下一张</button></div>`,'lightbox');}
function stopTour(){clearInterval(tourTimer);tourTimer=null;const el=document.querySelector('#tour-status');if(el)el.hidden=true;}
function startTour(){
  const trips=[...currentTrips()].sort((a,b)=>a.start.localeCompare(b.start));if(!trips.length){toast('先记录一段旅行，再开始重温。');return;}
  stopTour();tourIndex=0;if(state.mode!=='world')setMode('world');
  const step=()=>{if(tourIndex>=trips.length){stopTour();toast('旅程重温完毕，期待下一次出发。');return;}const t=trips[tourIndex++];selectTrip(t.id);const el=document.querySelector('#tour-status');el.hidden=false;el.innerHTML=`${icon('compass')}${tourIndex} / ${trips.length} · ${h(t.city)} <button data-action="stop-tour">结束</button>`;};step();tourTimer=setInterval(step,4200);
}

function countryOptions(current){return [...new Map(atlas.world.filter(f=>String(f.id)!=='010').map(f=>[countryKey(f.id),f])).values()].sort((a,b)=>countryName(a.id,a.properties.name).localeCompare(countryName(b.id,b.properties.name),'zh-CN')).map(f=>`<option value="${countryKey(f.id)}" ${countryKey(f.id)===current?'selected':''}>${h(countryName(f.id,f.properties.name))}</option>`).join('');}
function openTripForm(prefill={},edit=null){
  stopTour();lightboxReturn=null;formEditing=edit;formPhotos=edit?edit.photos.map(p=>({...p})):[];formLocation=null;photoBusy=false;
  const cityId=edit?.cityId||prefill.cityId||'',cityEntry=places.cities.find(c=>c.id===cityId),country=edit?.countryId||prefill.countryId||'156';
  const provinceId=edit?.provinceId||prefill.provinceId||cityEntry?.provinceId||'';
  openModal(modalHeader(edit?'编辑这段旅程':'记录一段新旅程','一个地方，一段时光，一张值得收藏的照片。')+`<div class="modal-body"><form id="trip-form"><div class="form-grid">
    <div class="field full"><label for="trip-country">国家 / 地区</label><select id="trip-country" name="countryId">${countryOptions(country)}</select></div>
    <div class="field" id="province-field"><label for="trip-province">省级行政区</label><select id="trip-province" name="provinceId"><option value="">选择省 / 自治区 / 直辖市</option>${places.provinces.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).map(p=>`<option value="${p.id}" ${p.id===provinceId?'selected':''}>${h(p.name)}</option>`).join('')}</select></div>
    <div class="field" id="city-field"><label for="trip-city">城市 / 地区</label><select id="trip-city" name="cityId"></select></div>
    <div class="field full" id="county-field"><label for="trip-county">具体区县 <span class="optional">选填 · 只点亮实际选中的区县</span></label><select id="trip-county" name="countyId"></select><small id="county-hint">不选区县时，点亮市级轮廓；不会自动点亮全市所有区县。</small></div>
    <div class="field full" id="global-city-field" hidden><label for="trip-global-city">城市名称</label><div class="field-inline"><div class="field"><input id="trip-global-city" name="globalCity" value="${h(edit?.countryId!=='156'?edit?.city||'':'')}" list="global-city-suggestions" placeholder="如 东京、大阪、巴黎" maxlength="80"><datalist id="global-city-suggestions"></datalist></div><button class="btn" type="button" data-action="geocode">${icon('pin')}定位城市</button></div><small>常见城市可离线定位；其他城市点击定位后使用 OpenStreetMap 搜索。</small></div>
    <div class="field full" id="geocode-results" hidden></div>
    <div class="field" id="lng-field" hidden><label for="trip-lng">经度</label><input id="trip-lng" name="lng" type="number" min="-180" max="180" step="any" placeholder="-180 至 180" value="${h(edit?.countryId!=='156'?edit?.coords[0]??'':'')}"></div>
    <div class="field" id="lat-field" hidden><label for="trip-lat">纬度</label><input id="trip-lat" name="lat" type="number" min="-90" max="90" step="any" placeholder="-90 至 90" value="${h(edit?.countryId!=='156'?edit?.coords[1]??'':'')}"></div>
    <div class="field"><label for="trip-start">出发日期</label><input id="trip-start" name="start" type="date" required max="${today()}" value="${edit?.start||''}"></div><div class="field"><label for="trip-end">返程日期</label><input id="trip-end" name="end" type="date" required max="${today()}" value="${edit?.end||''}"></div>
    <div class="field full"><label for="trip-title">给这段旅行起个名字</label><input id="trip-title" name="title" required maxlength="120" value="${h(edit?.title||'')}" placeholder="如 山水之间，遇见宜昌"></div>
    <div class="field full"><label for="trip-tags">旅行标签 <span class="optional">选填 · 最多 8 个</span></label><input id="trip-tags" name="tags" maxlength="240" value="${h(edit?.tags.join('，')||'')}" placeholder="山水，美食，城市漫游（用逗号分隔）"></div>
    <div class="field full"><label for="trip-note">留下一点回忆 <span class="optional">选填</span></label><textarea id="trip-note" name="note" maxlength="4000" placeholder="那天的天气、偶遇的人，或者一件想记住的小事…">${h(edit?.note||'')}</textarea></div>
    <div class="field full"><label>代表照片 <span class="optional">至少 1 张，最多 12 张 · 第一张为封面</span></label><label class="upload-zone" for="trip-photos">${icon('upload')}<strong>选择照片，把回忆留在这里</strong><small>JPEG / PNG / WebP · 单张不超过 20 MB · 自动压缩保存</small><input id="trip-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label="上传旅行照片"></label><div class="photo-previews" id="photo-previews"></div></div>
    </div><div class="form-error" id="form-error" role="alert" hidden></div><div class="form-footer"><span>${icon('lock')}照片与记录仅保存在当前浏览器</span><div class="form-actions"><button class="btn ghost" type="button" data-action="close-modal">取消</button><button class="btn primary" id="save-trip" type="submit">${icon('sparkle')}${edit?'保存这段回忆':'点亮这段旅程'}</button></div></div></form></div>`);
  updateCountryFields();updateCityOptions(cityId);updateCountyOptions(edit?.countyId||prefill.countyId||'');renderPhotoPreviews();
  if(edit?.countryId!=='156'&&edit)formLocation={coords:edit.coords,city:edit.city};
}
function updateCountryFields(){
  const cn=document.querySelector('#trip-country').value==='156';
  for(const id of ['province-field','city-field','county-field'])document.querySelector('#'+id).hidden=!cn;
  for(const id of ['global-city-field','lng-field','lat-field'])document.querySelector('#'+id).hidden=cn;
  document.querySelector('#trip-province').required=cn;document.querySelector('#trip-city').required=cn;
  for(const id of ['trip-global-city','trip-lng','trip-lat'])document.querySelector('#'+id).required=!cn;
  document.querySelector('#geocode-results').hidden=true;
  const countryId=document.querySelector('#trip-country').value;
  document.querySelector('#global-city-suggestions').innerHTML=globalCities.filter(c=>c[0]===countryId).map(c=>`<option value="${h(c[1])}"></option>`).join('');
}
function updateCityOptions(selected=''){
  const provinceId=document.querySelector('#trip-province').value,el=document.querySelector('#trip-city');
  el.innerHTML='<option value="">选择旅行城市</option>'+places.cities.filter(c=>c.provinceId===provinceId).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${h(c.name)}</option>`).join('');
  updateCountyOptions();
}
function updateCountyOptions(selected=''){
  const cityId=document.querySelector('#trip-city').value,el=document.querySelector('#trip-county');const counties=places.counties.filter(c=>c.cityId===cityId);
  el.innerHTML='<option value="">只记录城市（不指定区县）</option>'+counties.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${h(c.name)}</option>`).join('');
  document.querySelector('#county-hint').textContent=counties.length?'不选区县时，点亮市级轮廓；不会自动点亮全市所有区县。':'当前地区暂无细分区县数据，将使用已有边界显示。';
}
function renderPhotoPreviews(){const el=document.querySelector('#photo-previews');if(!el)return;el.innerHTML=formPhotos.map((p,i)=>`<div class="photo-preview">${image(p)}<button type="button" data-remove-photo="${i}" aria-label="移除第 ${i+1} 张照片">${icon('close')}</button>${i===0?'<small>封面</small>':''}</div>`).join('');bindImages(el);}
function formError(text){const el=document.querySelector('#form-error');if(el){el.textContent=text;el.hidden=!text;}else toast(text,true);}
function fillPresetCity(){const city=document.querySelector('#trip-global-city').value.trim(),countryId=document.querySelector('#trip-country').value;const preset=globalCities.find(c=>c[0]===countryId&&c[1]===city);if(preset){document.querySelector('#trip-lng').value=preset[2];document.querySelector('#trip-lat').value=preset[3];formLocation={city,coords:[preset[2],preset[3]]};return true;}return false;}
async function geocode(){
  const city=document.querySelector('#trip-global-city').value.trim(),countryId=document.querySelector('#trip-country').value;
  if(!city){formError('先输入你去过的城市名称。');return;}
  if(fillPresetCity()){formError('');toast('已使用内置坐标定位 '+city+'。');return;}
  if(Date.now()-lastGeocode<1300){formError('城市定位需要间隔一秒，请稍后再试。');return;}
  lastGeocode=Date.now();const button=modal.querySelector('[data-action="geocode"]');button.disabled=true;button.textContent='正在定位…';
  try{
    const query=city+' '+(atlas.world.find(f=>countryKey(f.id)===countryId)?.properties.name||countryName(countryId));
    let results=geocodeCache.get(query);
    if(!results){
      const response=await fetch(geocoderUrl+'?'+new URLSearchParams({limit:'5',q:query,lang:'en'}),{signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw new Error();const data=await response.json();
      const alpha2=COUNTRY_META[countryId]?.alpha2;
      results=data.features.filter(f=>!alpha2||f.properties.countrycode?.toUpperCase()===alpha2).map(f=>({lon:f.geometry.coordinates[0],lat:f.geometry.coordinates[1],display_name:[f.properties.name,f.properties.city,f.properties.state,f.properties.country].filter(Boolean).join(' · ')}));
      geocodeCache.set(query,results);
    }
    if(!document.querySelector('#trip-form')||document.querySelector('#trip-country').value!==countryId||document.querySelector('#trip-global-city').value.trim()!==city)return;
    const el=document.querySelector('#geocode-results');
    if(!results.length){formError('没有找到匹配城市。请尝试当地名称，或手动填写准确经纬度。');return;}
    el.hidden=false;el.innerHTML='<label for="geocode-select">选择正确的城市位置</label><select id="geocode-select"><option value="">请选择搜索结果</option>'+results.map(r=>`<option value="${h(r.lon)},${h(r.lat)}">${h(r.display_name)}</option>`).join('')+'</select><small>Photon 地理搜索 · © OpenStreetMap contributors；请确认地点一致。</small>';formError('');
  }catch{formError('网络定位暂时不可用。常见城市可以离线定位，也可以手动填写经纬度。');}
  finally{if(button.isConnected){button.disabled=false;button.innerHTML=icon('pin')+'定位城市';}}
}
async function saveForm(event){
  event.preventDefault();if(photoBusy){formError('照片还在处理，请稍等。');return;}
  if(!storageOK){formError('浏览器存储不可用，请退出隐私模式后刷新再保存。');return;}
  const form=event.target;if(!form.reportValidity())return;
  const data=new FormData(form),cn=data.get('countryId')==='156',cityEntry=places.cities.find(c=>c.id===data.get('cityId')),countyEntry=places.counties.find(c=>c.id===data.get('countyId'));
  try{
    if(!formPhotos.length)throw new Error('至少选择一张代表照片，让这段回忆有画面。');
    const trip=normalizeTrip({id:formEditing?.id||crypto.randomUUID(),countryId:data.get('countryId'),city:cn?cityEntry?.name:data.get('globalCity'),cityId:cn?data.get('cityId'):'',provinceId:cn?data.get('provinceId'):'',countyId:cn?data.get('countyId'):'',coords:cn?(countyEntry?.center||cityEntry?.center):[Number(data.get('lng')),Number(data.get('lat'))],start:data.get('start'),end:data.get('end'),title:data.get('title'),note:data.get('note'),tags:String(data.get('tags')).split(/[,，]/).map(s=>s.trim()).filter(Boolean),photos:formPhotos},atlas.world,places);
    const next=mergeTrips(ownTrips,[trip]),button=document.querySelector('#save-trip');button.disabled=true;button.textContent='正在保存…';
    try{await writeTrips(next);}catch(error){button.disabled=false;button.innerHTML=icon('sparkle')+'重新保存';throw error;}
    ownTrips=next;state.dataset='own';state.query='';state.year='all';state.selected=trip.id;state.page='map';rememberDataset();modal.close();renderShell();if(cn&&state.mode==='china'&&state.granularity==='county')map.focusCity(trip.cityId);else map.flyTo(trip);toast(formEditing?'回忆已更新。':'新的旅行已点亮，记得导出一份备份。');
  }catch(error){formError(error.message);}
}
async function uploadPhotos(input){
  if(!input.files.length)return;
  const remaining=12-formPhotos.length;if(input.files.length>remaining){formError(`最多上传 12 张照片，还可以选择 ${remaining} 张。`);input.value='';return;}
  const form=document.querySelector('#trip-form');photoBusy=true;const button=document.querySelector('#save-trip');button.disabled=true;button.textContent='正在处理照片…';
  try{const uploaded=[];for(const file of input.files)uploaded.push(await compressPhoto(file));if(document.querySelector('#trip-form')!==form)return;formPhotos.push(...uploaded);renderPhotoPreviews();formError('');}
  catch(error){if(document.querySelector('#trip-form')===form)formError(error.message);}
  finally{if(document.querySelector('#trip-form')===form){photoBusy=false;button.disabled=false;button.innerHTML=icon('sparkle')+(formEditing?'保存这段回忆':'点亮这段旅程');input.value='';}}
}
function exportBackup(){const payload=backupPayload(ownTrips);downloadFile(JSON.stringify(payload,null,2),`点亮旅行备份-${today()}.json`,'application/json');toast(`已导出 ${ownTrips.length} 段我的旅行及全部保存的照片。`);}
function downloadFile(contents,name,type){const url=URL.createObjectURL(new Blob([contents],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function importBackup(file){
  if(!file)return;
  try{if(file.size>100*1024*1024)throw new Error('备份超过 100 MB，请拆分后导入。');const imported=parseBackup(await file.text(),atlas.world,places);await writeTrips(mergeTrips(ownTrips,imported));ownTrips=mergeTrips(ownTrips,imported);state.dataset='own';state.year='all';state.query='';rememberDataset();if(modal.open)modal.close();renderShell();toast(`已合并导入 ${imported.length} 段旅行，原有记录已保留。`);}
  catch(error){toast(error.message||'导入失败，原记录已保留。',true);}
  finally{document.querySelector('#backup-input').value='';}
}
function deleteTrip(id){const trip=ownTrips.find(t=>t.id===id);if(!trip)return;openModal(modalHeader('删除这段回忆')+`<div class="delete-confirm"><h3>${h(trip.title)}</h3><p>将删除 ${h(trip.city)} 在 ${trip.start} 的这次旅行及其照片。这个地点的其他旅行记录会保留。<br>删除后可通过此前导出的备份恢复。</p><div class="confirm-actions"><button class="btn" data-detail="${id}">保留回忆</button><button class="btn danger" data-confirm-delete="${id}">${icon('trash')}确认删除</button></div></div>`);}
async function confirmDelete(id){try{const next=ownTrips.filter(t=>t.id!==id);await writeTrips(next);ownTrips=next;modal.close();renderShell();toast('这次旅行已删除。');}catch(error){toast(error.message,true);}}
function showSettings(sourcesOnly=false){
  openModal(modalHeader(sourcesOnly?'地图与开源资源':'数据与设置','你的记录，始终掌握在你自己手中。')+`<div class="modal-body"><p class="settings-intro">${sourcesOnly?'地图绘制、行政区边界与球面计算都使用成熟的开源资源。地图资源已本地打包，浏览时无需地图 API 密钥。':'旅行记录和照片保存在当前浏览器的 IndexedDB 中。更换设备、浏览器或网站地址时，请使用备份导入；清理浏览器数据会删除本机记录。'}</p>
    ${sourcesOnly?'':`<section class="settings-block"><h3>一份备份，留住所有记忆</h3><p>目前有 ${ownTrips.length} 段我的旅行、${ownTrips.reduce((s,t)=>s+t.photos.length,0)} 张照片。示例记录不会写入备份。导入会合并记录，相同旅行编号使用备份内容。</p><div class="form-actions"><button class="btn" data-action="export">${icon('download')}导出完整备份</button><button class="btn" data-action="import">${icon('upload')}导入备份</button></div></section><section class="settings-block"><h3>本机存储</h3><p id="storage-info">正在读取存储使用情况…</p><div class="storage-bar"><span id="storage-fill" style="width:1%"></span></div><button class="btn small" data-action="persist">${icon('lock')}请求保护本机数据</button><p style="margin-top:8px">保护请求由浏览器决定是否允许；定期备份仍然是最可靠的保留方式。</p></section>`}
    <section class="settings-block"><h3>地图与统计口径</h3><p>全球以国家 / 地区高亮，城市用光点表示。中国可查看省、市轮廓，区县在城市内展开；只有明确记录了区县才点亮区县。部分地区的细分边界尚未收录，会保留已有粒度。</p><p style="margin-top:10px">面积占比按简化边界的球面面积估算：世界指标计算到访国家 / 地区的完整面积，不含南极；国内指标计算到访市级行政区的完整面积。重复到访去重，不能理解为实际走遍的面积。</p></section>
    <section class="settings-block"><h3>致谢开源世界</h3><div class="settings-links"><a href="https://d3js.org/d3-geo" target="_blank" rel="noopener">D3 / d3-geo ↗</a><a href="https://github.com/topojson/world-atlas" target="_blank" rel="noopener">world-atlas ↗</a><a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener">Natural Earth ↗</a><a href="https://github.com/zhChuXiao/ChinaGeoJson" target="_blank" rel="noopener">ChinaGeoJson ↗</a><a href="https://github.com/Supeset/China-GeoData" target="_blank" rel="noopener">China-GeoData ↗</a></div><p class="settings-source">D3 7.9.0 · TopoJSON client 3.1.0 · world-atlas 2.0.2 · 中国数据源于 DataV.GeoAtlas，仓库快照固定于构建时。许可证与来源信息随项目保留。世界边界用于旅行示意，小岛与简化边界精度有限。</p><div class="settings-links"><a href="./licenses/d3.txt" target="_blank">D3 许可</a><a href="./licenses/ChinaGeoJson.txt" target="_blank">中国数据仓库许可</a><a href="./data/sources.json" target="_blank">完整来源清单</a></div></section><p class="settings-source" style="margin-top:20px">点亮 · Wanderlight v1.0 · 无付费地图服务。云端账户、多设备实时同步与卫星影像可作为后续扩展。</p></div>`);
  if(!sourcesOnly)navigator.storage?.estimate().then(e=>{const text=document.querySelector('#storage-info');if(!text)return;const used=(e.usage||0)/1024/1024,total=(e.quota||0)/1024/1024;text.textContent=`本网站已用约 ${used.toFixed(1)} MB${total?' · 可用配额约 '+number(total)+' MB':''}。`;document.querySelector('#storage-fill').style.width=Math.min(100,(e.usage||0)/(e.quota||1)*100)+'%';}).catch(()=>{const text=document.querySelector('#storage-info');if(text)text.textContent='当前浏览器无法提供存储配额。';});
}
function rememberDataset(){try{localStorage.setItem('wanderlight-dataset',state.dataset);}catch{}}
function closeModal(){if(lightboxReturn){const id=lightboxReturn;lightboxReturn=null;showDetail(id);}else modal.close();}
function refreshContent(){if(state.page==='map'){const trips=currentTrips();if(!trips.some(t=>t.id===state.selected))state.selected=trips[0]?.id||null;map.update(trips,state.selected);renderFeature();renderMapSummary();}else{const content=document.querySelector('#page-content');if(state.page==='timeline')renderTimeline(content);else if(state.page==='gallery')renderGallery(content);else renderReport(content);bindImages(content);}}
document.addEventListener('click',async e=>{
  const el=e.target.closest('button');if(!el||el.disabled)return;
  if(el.dataset.page){state.page=el.dataset.page;lightboxReturn=null;renderShell();return;}
  if(el.dataset.dataset){state.dataset=el.dataset.dataset;state.year='all';state.query='';state.selected=null;rememberDataset();renderShell();return;}
  if(el.dataset.mode){setMode(el.dataset.mode);return;}
  if(el.dataset.projection){stopTour();state.flat=el.dataset.projection==='flat';document.querySelectorAll('[data-projection]').forEach(b=>b.classList.toggle('active',b.dataset.projection===el.dataset.projection));document.querySelector('#spin-button').hidden=state.flat;map.setView(state.mode,state.granularity,state.flat);map.update(currentTrips(),state.selected);return;}
  if(el.dataset.detail){lightboxReturn=null;showDetail(el.dataset.detail);return;}
  if(el.dataset.lightbox){showLightbox(el.dataset.lightbox,Number(el.dataset.photoIndex));return;}
  if(el.dataset.edit){const trip=ownTrips.find(t=>t.id===el.dataset.edit);if(trip)openTripForm({},trip);return;}
  if(el.dataset.delete){deleteTrip(el.dataset.delete);return;}
  if(el.dataset.confirmDelete){confirmDelete(el.dataset.confirmDelete);return;}
  if(el.dataset.removePhoto!==undefined){formPhotos.splice(Number(el.dataset.removePhoto),1);renderPhotoPreviews();return;}
  if(el.dataset.showOnMap){state.page='map';state.query='';state.year='all';state.selected=el.dataset.showOnMap;modal.close();renderShell();map.flyTo(allTrips().find(t=>t.id===state.selected));return;}
  const action=el.dataset.action;
  if(action==='add')openTripForm();
  else if(action==='close-modal')closeModal();
  else if(action==='settings')showSettings();
  else if(action==='sources')showSettings(true);
  else if(action==='export')exportBackup();
  else if(action==='import')document.querySelector('#backup-input').click();
  else if(action==='geocode')geocode();
  else if(action==='persist'){const ok=await navigator.storage?.persist?.();toast(ok?'浏览器已允许保护本机数据；请继续定期备份。':'浏览器暂未允许保护请求；请定期导出完整备份。');}
  else if(action==='zoom-in')map.setZoom(map.zoom*1.22);
  else if(action==='zoom-out')map.setZoom(map.zoom/1.22);
  else if(action==='reset-map'){stopTour();map.reset();}
  else if(action==='back-china')map.clearFocus();
  else if(action==='spin'){if(map.reduced){toast('系统已启用减少动态效果，自动旋转已关闭。');return;}stopTour();map.setSpin(!map.spinning);}
  else if(action==='routes'){state.routes=!state.routes;map.showRoutes=state.routes;map.draw();el.classList.toggle('active',state.routes);el.setAttribute('aria-pressed',state.routes);}
  else if(action==='tour')startTour();
  else if(action==='stop-tour')stopTour();
  else if(action==='clear-filter'){state.query='';state.year='all';renderShell();}
  else if(action==='print'){if(state.page!=='report'){state.page='report';renderShell();}window.print();}
});
document.addEventListener('change',e=>{
  const id=e.target.id;
  if(id==='year-filter'){stopTour();state.year=e.target.value;refreshContent();}
  else if(id==='granularity'){stopTour();state.granularity=e.target.value;map.setView(state.mode,state.granularity,state.flat);map.update(currentTrips(),state.selected);renderMapSummary();}
  else if(id==='trip-country'){formLocation=null;document.querySelector('#trip-lng').value='';document.querySelector('#trip-lat').value='';document.querySelector('#trip-global-city').value='';updateCountryFields();}
  else if(id==='trip-province')updateCityOptions();
  else if(id==='trip-city'){updateCountyOptions();const title=document.querySelector('#trip-title');if(!title.value&&e.target.value)title.value=places.cities.find(c=>c.id===e.target.value).name+'的旅行记忆';}
  else if(id==='trip-global-city')fillPresetCity();
  else if(id==='geocode-select'&&e.target.value){const [lng,lat]=e.target.value.split(',');document.querySelector('#trip-lng').value=lng;document.querySelector('#trip-lat').value=lat;formLocation={city:document.querySelector('#trip-global-city').value,coords:[Number(lng),Number(lat)]};}
  else if(id==='trip-start'){document.querySelector('#trip-end').min=e.target.value;if(!document.querySelector('#trip-end').value)document.querySelector('#trip-end').value=e.target.value;}
  else if(id==='trip-photos')uploadPhotos(e.target);
  else if(id==='backup-input')importBackup(e.target.files[0]);
});
let searchTimer;
document.addEventListener('input',e=>{if(e.target.id==='content-search'){const value=e.target.value,position=e.target.selectionStart;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=value;refreshContent();const input=document.querySelector('#content-search');input?.focus();try{input?.setSelectionRange(position,position);}catch{}},280);}else if(e.target.id==='trip-global-city'){formLocation=null;document.querySelector('#trip-lng').value='';document.querySelector('#trip-lat').value='';}});
document.addEventListener('submit',e=>{if(e.target.id==='trip-form')saveForm(e);});
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)closeModal();}});
modal.addEventListener('cancel',e=>{if(lightboxReturn){e.preventDefault();closeModal();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTour();});
window.addEventListener('pagehide',()=>{stopTour();map?.dispose();});
async function init(){
  try{
    if(!window.d3||!window.topojson)await new Promise(r=>window.addEventListener('load',r,{once:true}));
    if(!window.d3||!window.topojson)throw new Error('本地地图引擎未加载成功。');
    const load=async file=>{const response=await fetch('./data/'+file);if(!response.ok)throw new Error('地图数据 '+file+' 加载失败。');return response.json();};
    const [world,cities,provinces,index,extra,guides]=await Promise.all(['world.json','cities.json','provinces.json','places.json','world-extra.json','china-guides.json'].map(load));
    const features=topojson.feature(world,world.objects.countries).features;
    const anonymous={'N. Cyprus':'196','Somaliland':'706','Kosovo':'383'};
    for(const f of features)if(!f.id)f.id=anonymous[f.properties.name];
    const knownCountries=new Set(Object.keys(COUNTRY_META));
    atlas={world:[...features,...extra.features].filter(f=>knownCountries.has(countryKey(f.id))),cities:cities.features,provinces:provinces.features,guides:guides.features};places=index;
    try{const config=await fetch('./config.json').then(r=>r.json());const url=new URL(config.geocoderUrl);if(url.protocol==='https:')geocoderUrl=url.href;}catch{}
    try{ownTrips=await readTrips();}catch(error){storageOK=false;toast(error.message,true);}
    try{const saved=localStorage.getItem('wanderlight-dataset');state.dataset=saved==='own'?'own':saved==='demo'?'demo':ownTrips.length?'own':'demo';}catch{state.dataset=ownTrips.length?'own':'demo';}
    renderShell();
  }catch(error){root.innerHTML=`<div class="error-screen"><h2>地图暂时无法展开。</h2><p>${h(error.message)} 请通过项目的本地服务器或已发布网址访问。</p><button class="btn primary" onclick="location.reload()">重新加载</button></div>`;}
}
init();
