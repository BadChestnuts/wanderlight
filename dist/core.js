import { COUNTRY_META } from './countries.js';
export const APP_VERSION = 1;
export const EARTH_RADIUS_KM = 6371.0088;
export const DEMO_PHOTOS = {
  china: 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?auto=format&fit=crop&w=1400&q=85',
  japan: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1400&q=85',
  paris: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1400&q=85',
  alps: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=85',
  city: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1400&q=85',
};
export function demoTrips() {
  const trip = (id,city,countryId,coords,cityId,provinceId,start,end,title,note,photo,tags) => ({id:'demo-'+id,city,countryId,country:countryName(countryId),coords,cityId,provinceId,countyId:id==='yichang'?'420506':'',start,end,title,note,tags,photos:[{id:'demo-photo-'+id,src:photo,name:'示例照片',credit:'演示图片 · Unsplash（非真实旅行照片）'}],demo:true});
  return [
    trip('yichang','宜昌市','156',[111.326747,30.770199],'420500','420000','2026-05-01','2026-05-04','山水之间，遇见宜昌','沿着长江慢慢走，收藏江风、落日和那些不赶时间的时刻。','https://images.unsplash.com/photo-1433086966358-54859d0ed716?auto=format&fit=crop&w=1400&q=85',['山水','慢旅行']),
    trip('tokyo','东京','392',[139.6917,35.6895],'','', '2025-11-09','2025-11-14','城市的另一种节奏','从热闹的街区走进安静的小巷，记下一座城市的日常。',DEMO_PHOTOS.japan,['城市漫游']),
    trip('osaka','大阪','392',[135.5023,34.6937],'','','2025-11-15','2025-11-18','把快乐藏进街头','每条街都有新鲜故事，夜晚的灯光也成为了旅程的一部分。',DEMO_PHOTOS.city,['美食','城市漫游']),
    trip('paris','巴黎','250',[2.3522,48.8566],'','','2025-06-12','2025-06-18','塞纳河畔的金色傍晚','走过桥，坐在河边。旅行让平常的一天有了不同的颜色。',DEMO_PHOTOS.paris,['建筑','艺术']),
    trip('zurich','苏黎世','756',[8.5417,47.3769],'','','2025-06-19','2025-06-22','去山风里呼吸','湖水很蓝，山路很长，脚步终于跟上了自己的呼吸。',DEMO_PHOTOS.alps,['自然']),
    trip('chengdu','成都市','156',[104.0665,30.5723],'510100','510000','2024-10-02','2024-10-06','在成都，把生活调慢','茶馆、美食和午后的阳光。好像慢一点，也能抵达。',DEMO_PHOTOS.china,['美食','慢旅行']),
    trip('hangzhou','杭州市','156',[120.1551,30.2741],'330100','330000','2024-04-04','2024-04-06','春天写给西湖的信','一路绿意，一场细雨，把春天装进旅行相册。',DEMO_PHOTOS.china,['山水']),
    trip('beijing','北京市','156',[116.4074,39.9042],'110000','110000','2023-09-28','2023-10-03','时间走过的地方','从胡同走到城墙，在旧时光里找到新的记忆。',DEMO_PHOTOS.china,['历史','建筑']),
  ];
}
export function today() { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function countryKey(id) { return ['158','344','446'].includes(String(id)) ? '156' : String(id).padStart(3,'0'); }
export function countryName(id, fallback='') {
  const key = countryKey(id);
  if(COUNTRY_META[key])return COUNTRY_META[key].name;
  try { const n=new Intl.DisplayNames(['zh-CN'],{type:'region'}).of(key);return n!==key?n:(fallback||key); } catch { return fallback || key; }
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dayNumber(date) { return Date.parse(date+'T00:00:00Z') / 86400000; }
export function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dayNumber(date)) && new Date(dayNumber(date)*86400000).toISOString().slice(0,10)===date; }
export function tripDays(trip) { return dayNumber(trip.end)-dayNumber(trip.start)+1; }
export function travelDays(trips) {
  const intervals=trips.map(t=>[dayNumber(t.start),dayNumber(t.end)]).sort((a,b)=>a[0]-b[0]);
  let days=0, start=null, end=null;
  for(const [a,b] of intervals){if(start===null){start=a;end=b;}else if(a<=end+1){end=Math.max(end,b);}else{days+=end-start+1;start=a;end=b;}}
  return start===null?0:days+end-start+1;
}
export function placeKey(trip) { return trip.cityId ? `cn:${trip.cityId}` : `${countryKey(trip.countryId)}:${trip.city.trim().toLocaleLowerCase()}`; }
export function groupPlaces(trips) {
  const map=new Map();
  for(const trip of [...trips].sort((a,b)=>b.start.localeCompare(a.start))){const key=placeKey(trip);if(!map.has(key))map.set(key,{...trip,key,visits:[]});map.get(key).visits.push(trip);}
  return [...map.values()];
}
export function filteredTrips(trips, year='all', query='') {
  const q=query.trim().toLocaleLowerCase();
  return trips.filter(t=>(year==='all'||(t.start<=`${year}-12-31`&&t.end>=`${year}-01-01`))&&(!q||[t.city,t.country,t.title,t.note,...t.tags].join(' ').toLocaleLowerCase().includes(q)));
}
export function statistics(trips, atlas, geoArea, year='all') {
  const countries=new Set(trips.map(t=>countryKey(t.countryId)));
  const cities=new Set(trips.filter(t=>countryKey(t.countryId)==='156').map(t=>t.cityId).filter(Boolean));
  const provinces=new Set(trips.filter(t=>countryKey(t.countryId)==='156').map(t=>t.provinceId).filter(Boolean));
  const area = f => geoArea(f) * EARTH_RADIUS_KM ** 2;
  const world=atlas.world.filter(f=>String(f.id)!=='010');
  const totalWorld=world.reduce((s,f)=>s+area(f),0);
  const visitedWorld=world.filter(f=>countries.has(countryKey(f.id))).reduce((s,f)=>s+area(f),0);
  const totalChina=atlas.provinces.reduce((s,f)=>s+area(f),0);
  const visitedChina=atlas.cities.filter(f=>cities.has(String(f.id))).reduce((s,f)=>s+area(f),0);
  const visitedProvinces=atlas.provinces.filter(f=>provinces.has(String(f.id))).reduce((s,f)=>s+area(f),0);
  const intervals=year==='all'?trips:trips.map(t=>({...t,start:t.start<`${year}-01-01`?`${year}-01-01`:t.start,end:t.end>`${year}-12-31`?`${year}-12-31`:t.end}));
  return {countries:countries.size,places:groupPlaces(trips).length,provinces:provinces.size,chineseCities:cities.size,trips:trips.length,photos:trips.reduce((s,t)=>s+t.photos.length,0),days:travelDays(intervals),worldPercent:totalWorld?visitedWorld/totalWorld*100:0,chinaPercent:totalChina?visitedChina/totalChina*100:0,provincePercent:totalChina?visitedProvinces/totalChina*100:0,worldArea:visitedWorld,chinaArea:visitedChina};
}
export function normalizeTrip(input, countries, places) {
  if(!input||typeof input!=='object')throw new Error('旅行记录格式不正确。');
  const string=(key,max=1000)=>{if(typeof input[key]!=='string'||input[key].length>max)throw new Error(`旅行字段 ${key} 不正确。`);return input[key].trim();};
  const id=string('id',100);if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('旅行编号不正确。');
  const city=string('city',80),title=string('title',120),start=string('start',10),end=string('end',10),countryId=countryKey(string('countryId',10));
  if(!city||!title)throw new Error('地点与旅行标题不能为空。');
  if(!countries.some(c=>countryKey(c.id)===countryId))throw new Error('请选择有效的国家/地区。');
  if(!validDate(start)||!validDate(end)||end<start||end>today())throw new Error('旅行日期需要有效，结束日期不能早于开始日期或晚于今天。');
  if(!Array.isArray(input.coords)||input.coords.length!==2||!input.coords.every(Number.isFinite)||Math.abs(input.coords[0])>180||Math.abs(input.coords[1])>90)throw new Error('经纬度不正确。');
  const cityId=String(input.cityId||''),provinceId=String(input.provinceId||''),countyId=String(input.countyId||'');
  if(countryId==='156'){
    const cityEntry=places.cities.find(c=>c.id===cityId);
    if(!cityEntry||cityEntry.provinceId!==provinceId)throw new Error('请选择有效的中国城市及所属省份。');
    if(countyId&&!places.counties.some(c=>c.id===countyId&&c.cityId===cityId))throw new Error('区县与城市不匹配。');
  } else if(cityId||provinceId||countyId)throw new Error('境外地点不应包含中国行政区编号。');
  if(!Array.isArray(input.tags)||input.tags.length>8||!input.tags.every(t=>typeof t==='string'&&t.length<=30))throw new Error('旅行标签不正确。');
  if(!Array.isArray(input.photos)||!input.photos.length||input.photos.length>12)throw new Error('每段旅行需要 1–12 张照片。');
  const photos=input.photos.map((p,i)=>{
    if(!p||typeof p.src!=='string'||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(p.src)||p.src.length>8*1024*1024)throw new Error('备份中的照片不正确，请使用 JPEG、PNG 或 WebP 图片。');
    return {id:id+'-photo-'+i,src:p.src,name:String(p.name||'旅行照片').slice(0,100)};
  });
  return {id,city,countryId,country:countryName(countryId,countries.find(c=>countryKey(c.id)===countryId)?.properties.name),coords:[...input.coords],cityId,provinceId,countyId,start,end,title,note:typeof input.note==='string'?input.note.slice(0,4000):'',tags:[...input.tags],photos};
}
export function parseBackup(text,countries,places) {
  if(text.length>100*1024*1024)throw new Error('备份超过 100 MB，请拆分后导入。');
  let data;try{data=JSON.parse(text);}catch{throw new Error('文件不是有效的 JSON 备份。');}
  if(data.app!=='wanderlight'||data.version!==APP_VERSION||!Array.isArray(data.trips)||data.trips.length>2000)throw new Error('这不是受支持的点亮备份文件。');
  const trips=data.trips.map(t=>normalizeTrip(t,countries,places));
  if(new Set(trips.map(t=>t.id)).size!==trips.length)throw new Error('备份中包含重复的旅行编号。');
  return trips;
}
export function mergeTrips(existing,incoming) { return [...new Map([...existing,...incoming].map(t=>[t.id,t])).values()]; }
export function backupPayload(trips) { return {app:'wanderlight',version:APP_VERSION,exportedAt:new Date().toISOString(),trips:trips.filter(t=>!t.demo)}; }
export function dateLabel(trip) { return `${trip.start.replaceAll('-','.')} — ${trip.end.replaceAll('-','.')}`; }
export const percent = n => n===0 ? '0' : n<0.01 ? '< 0.01' : n.toFixed(2);
export const number = n => new Intl.NumberFormat('zh-CN').format(Math.round(n));

export const icons = {
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a16 16 0 0 1 0 18 16 16 0 0 1 0-18Z"/>',
  compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
  map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15"/>',
  chart:'<path d="M4 3v17h17M8 15v-5M13 15V6M18 15v-8"/>',
  photo:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6L3 21"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron:'<path d="m9 5 7 7-7 7"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  sparkle:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4M18 5h4"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  rotate:'<path d="M20 7V3l-4 4a8 8 0 1 0 4 9M20 3h-5"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  minus:'<path d="M5 12h14"/>',
  edit:'<path d="m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  leaf:'<path d="M20 3S3 2 3 13a8 8 0 0 0 8 8C22 21 20 3 20 3ZM3 21l12-12"/>',
  heart:'<path d="M20 4a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-6 6 8 17 8 17S26 10 20 4Z"/>',
};
export function icon(name,cls='') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.globe}</svg>`; }

let dbPromise;
export function openDB() {
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open('wanderlight',1);
    req.onupgradeneeded=()=>req.result.createObjectStore('records',{keyPath:'id'});
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>{dbPromise=null;reject(new Error('浏览器存储无法打开，请退出隐私模式后重试。'));};
  });
  return dbPromise;
}
export async function readTrips() {
  const db=await openDB();return new Promise((resolve,reject)=>{const req=db.transaction('records','readonly').objectStore('records').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('无法读取旅行记录。'));});
}
export async function writeTrips(trips) {
  const db=await openDB();return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');
    store.clear();trips.forEach(t=>store.put(t));
    tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(new Error('保存失败，可能是浏览器存储空间不足。原记录仍保留，请导出备份后重试。'));
  });
}
export async function compressPhoto(file) {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请上传 JPEG、PNG 或 WebP 图片。');
  if(file.size>20*1024*1024)throw new Error('单张照片不能超过 20 MB。');
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('这张图片无法读取，请重新选择。'));i.src=url;});
    const scale=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return {id:crypto.randomUUID(),name:file.name,src:canvas.toDataURL('image/jpeg',.85)};
  }finally{URL.revokeObjectURL(url);}
}
