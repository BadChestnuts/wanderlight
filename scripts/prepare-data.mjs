import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import vm from 'node:vm';
const root = resolve(import.meta.dirname, '../dist');
await mkdir(resolve(root, 'vendor'), {recursive:true});
await mkdir(resolve(root, 'data/counties'), {recursive:true});
await mkdir(resolve(root, 'licenses'), {recursive:true});
const download = async (url, json = false) => {
  if(url.startsWith('https://raw.githubusercontent.com/')) {
    const parts=url.replace('https://raw.githubusercontent.com/','').split('/');
    url=`https://cdn.jsdelivr.net/gh/${parts[0]}/${parts[1]}@${parts[2]}/${parts.slice(3).join('/')}`;
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(encodeURI(url), {signal:AbortSignal.timeout(45000)});
      if (!response.ok) throw new Error(`${response.status}: ${url}`);
      return json ? await response.json() : await response.text();
    } catch (error) { if (attempt === 2) throw error; }
  }
};
const vendor = [
 ['d3.min.js','https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js'],
 ['topojson.min.js','https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js'],
];
for (const [file,url] of vendor) await writeFile(resolve(root,'vendor',file), await download(url));
const context = vm.createContext({});
vm.runInContext(await readFile(resolve(root,'vendor/d3.min.js'),'utf8'), context);
const d3 = context.d3;
function simplify(points, tolerance = 0.012) {
  if (points.length < 8) return points;
  const sq = tolerance * tolerance;
  const distance = (p,a,b) => {
    let x=a[0], y=a[1], dx=b[0]-x, dy=b[1]-y;
    if (dx || dy) { const t=((p[0]-x)*dx+(p[1]-y)*dy)/(dx*dx+dy*dy); if(t>1){x=b[0];y=b[1];}else if(t>0){x+=dx*t;y+=dy*t;} }
    return (p[0]-x)**2+(p[1]-y)**2;
  };
  const recurse=(first,last,out)=>{let max=sq,index=0;for(let i=first+1;i<last;i++){const d=distance(points[i],points[first],points[last]);if(d>max){max=d;index=i;}}if(max>sq){if(index-first>1)recurse(first,index,out);out.push(points[index]);if(last-index>1)recurse(index,last,out);}};
  const result=[points[0]];recurse(0,points.length-1,result);result.push(points.at(-1));
  return result.length >= 4 ? result : points;
}
function normalize(feature) {
  const g=feature.geometry;
  if(!g || !['Polygon','MultiPolygon'].includes(g.type)) return null;
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  g.coordinates=polygons.map(p=>p.map((r,index)=>{
    const ring=simplify(r).map(x=>x.map(v=>Math.round(v*10000)/10000));
    const area=d3.geoArea({type:'Polygon',coordinates:[ring]});
    if ((index===0 && area>2*Math.PI) || (index>0 && area<2*Math.PI)) ring.reverse();
    return ring;
  }));
  if(g.type==='Polygon')g.coordinates=g.coordinates[0];
  const p=feature.properties;
  feature.id=String(p.adcode);
  feature.properties={name:p.name,adcode:String(p.adcode),parent:String(p.parent?.adcode||''),center:p.center||p.centroid||d3.geoCentroid(feature),level:p.level};
  return feature;
}
const sources=await Promise.all([
 download('https://api.github.com/repos/zhChuXiao/ChinaGeoJson/commits/master',true),
 download('https://api.github.com/repos/zhChuXiao/ChinaGeoJson/contents/province',true),
 download('https://api.github.com/repos/zhChuXiao/ChinaGeoJson/contents/citys',true),
 download('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json',true),
]);
const [commit, provinceFiles, cityFiles, world]=sources;
const ref=commit.sha;
const base=`https://raw.githubusercontent.com/zhChuXiao/ChinaGeoJson/${ref}`;
await writeFile(resolve(root,'data/world.json'),JSON.stringify(world));
const provinceRef='5822c4c0a0bdfd73327f9454976c8661bfd6ad9f';
const provincesRaw=await download(`https://raw.githubusercontent.com/Supeset/China-GeoData/${provinceRef}/geojson/china_province_full.geojson`,true);
const provinces=provincesRaw.features.map(normalize).filter(Boolean);
await writeFile(resolve(root,'data/provinces.json'),JSON.stringify({type:'FeatureCollection',features:provinces}));
const cities=new Map();
const countyBuckets=new Map();
const countyIndex=[];
let progress=0;
async function queue(items, task, concurrency=8){let next=0;await Promise.all(Array.from({length:concurrency},async()=>{while(next<items.length){const item=items[next++];await task(item);}}));}
await queue(provinceFiles.filter(x=>x.name.endsWith('.json')),async file=>{
  const data=await download(`${base}/province/${file.name}`,true);
  for(const feature of data.features){const f=normalize(feature);if(!f)continue;if(f.properties.level==='district')continue;cities.set(f.id,f);}
});
// Municipalities count as cities and retain their full province outline.
for(const p of provinces)if(['110000','120000','310000','500000','810000','820000'].includes(p.id))cities.set(p.id,structuredClone(p));
await queue(cityFiles.filter(x=>x.name.endsWith('.json')),async file=>{
  const data=await download(`${base}/citys/${file.name}`,true);
  const features=data.features.map(normalize).filter(Boolean);
  if(!features.length)return;
  let parent=features[0].properties.parent;
  if(['110100','120100','310100','500100','500200'].includes(parent))parent=parent.slice(0,2)+'0000';
  // A city's file contains its counties; directly administered county files are skipped here.
  if(cities.has(parent)){
    if(!countyBuckets.has(parent))countyBuckets.set(parent,new Map());
    const bucket=countyBuckets.get(parent);
    for(const f of features)bucket.set(f.id,f);
    for(const f of features)countyIndex.push({id:f.id,name:f.properties.name,cityId:parent,center:f.properties.center});
  }
  progress++;if(progress%50===0)console.log(`Prepared ${progress} city boundary files`);
});
for(const [parent,bucket] of countyBuckets)await writeFile(resolve(root,`data/counties/${parent}.json`),JSON.stringify({type:'FeatureCollection',features:[...bucket.values()]}));
await writeFile(resolve(root,'data/cities.json'),JSON.stringify({type:'FeatureCollection',features:[...cities.values()]}));
const index={provinces:provinces.map(f=>({id:f.id,name:f.properties.name,center:f.properties.center})),cities:[...cities.values()].map(f=>({id:f.id,name:f.properties.name,provinceId:f.id.slice(0,2)+'0000',center:f.properties.center})),counties:[...new Map(countyIndex.map(c=>[c.id,c])).values()]};
await writeFile(resolve(root,'data/places.json'),JSON.stringify(index));
await writeFile(resolve(root,'data/sources.json'),JSON.stringify({generated:'2026-10-08',china:{url:'https://github.com/zhChuXiao/ChinaGeoJson',commit:ref,upstream:'DataV.GeoAtlas',license:'MIT (repository)'},provinces:{url:'https://github.com/Supeset/China-GeoData',commit:provinceRef,license:'MIT'},world:{url:'https://github.com/topojson/world-atlas',version:'2.0.2',upstream:'Natural Earth 1:110m',license:'ISC / public-domain data'},counts:{provinces:provinces.length,cities:cities.size,counties:index.counties.length}},null,2));
for(const [file,url] of [
 ['d3.txt','https://raw.githubusercontent.com/d3/d3/v7.9.0/LICENSE'],
 ['topojson-client.txt','https://raw.githubusercontent.com/topojson/topojson-client/v3.1.0/LICENSE'],
 ['world-atlas.txt','https://raw.githubusercontent.com/topojson/world-atlas/master/LICENSE'],
 ['ChinaGeoJson.txt',`${base}/LICENSE`],
 ['China-GeoData.txt',`https://raw.githubusercontent.com/Supeset/China-GeoData/${provinceRef}/LICENSE`],
])await writeFile(resolve(root,'licenses',file),await download(url));
console.log(JSON.stringify({provinces:provinces.length,cities:cities.size,counties:index.counties.length,source:ref}));
