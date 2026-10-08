import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'../dist');
const get=async u=>{const r=await fetch(u,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error(r.status+' '+u);return r.json();};
const [codes,zh,detail]=await Promise.all([
 get('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/codes.json'),
 get('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/langs/zh.json'),
 get('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json'),
]);
const meta={};for(const [a2,a3,num]of codes){const n=zh.countries[a2];meta[num]={name:Array.isArray(n)?n[0]:n,alpha2:a2};}
meta['383']={name:'科索沃',alpha2:'XK'};
await writeFile(resolve(root,'countries.js'),'// ISO 3166-1 names from i18n-iso-countries 7.14.0 (MIT).\nexport const COUNTRY_META = '+JSON.stringify(meta)+';\n');
const context=vm.createContext({});vm.runInContext(await readFile(resolve(root,'vendor/topojson.min.js'),'utf8'),context);
const world=JSON.parse(await readFile(resolve(root,'data/world.json'),'utf8'));
const existing=new Set(context.topojson.feature(world,world.objects.countries).features.map(f=>String(f.id)));
const extra=context.topojson.feature(detail,detail.objects.countries).features.filter(f=>f.id&&!existing.has(String(f.id)));
await writeFile(resolve(root,'data/world-extra.json'),JSON.stringify({type:'FeatureCollection',features:extra}));
const sources=JSON.parse(await readFile(resolve(root,'data/sources.json'),'utf8'));
const provinceData=JSON.parse(await readFile(resolve(root,'data/provinces.json'),'utf8'));
const guides=provinceData.features.filter(f=>!/^\d{6}$/.test(f.id));
provinceData.features=provinceData.features.filter(f=>/^\d{6}$/.test(f.id));
await writeFile(resolve(root,'data/provinces.json'),JSON.stringify(provinceData));
if(guides.length)await writeFile(resolve(root,'data/china-guides.json'),JSON.stringify({type:'FeatureCollection',features:guides}));
const places=JSON.parse(await readFile(resolve(root,'data/places.json'),'utf8'));
places.provinces=places.provinces.filter(p=>/^\d{6}$/.test(p.id));
await writeFile(resolve(root,'data/places.json'),JSON.stringify(places));
sources.counts.provinces=provinceData.features.length;
sources.world.supplement='Natural Earth 1:50m small-country boundaries';sources.countryNames={url:'https://github.com/michaelwittig/node-i18n-iso-countries',version:'7.14.0',license:'MIT'};
await writeFile(resolve(root,'data/sources.json'),JSON.stringify(sources,null,2));
const license=await fetch('https://cdn.jsdelivr.net/npm/i18n-iso-countries@7.14.0/LICENSE');if(!license.ok)throw new Error('Missing country-name license');await writeFile(resolve(root,'licenses/i18n-iso-countries.txt'),await license.text());
console.log('Country names:',Object.keys(meta).length,'Extra small-country polygons:',extra.length);
