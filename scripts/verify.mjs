import {readFile,stat,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');
for(const name of ['app.js','map.js','core.js','countries.js']){
  const result=spawnSync(process.execPath,['--check',resolve(root,'dist',name)],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
for(const name of ['index.html','style.css','favicon.svg','config.json','vendor/d3.min.js','vendor/topojson.min.js','data/world.json','data/world-extra.json','data/cities.json','data/provinces.json','data/places.json','data/china-guides.json','data/sources.json'])await stat(resolve(root,'dist',name));
const entry=await readFile(resolve(root,'dist/index.html'),'utf8');
if(!entry.includes('./app.js')||!entry.includes('./style.css'))throw new Error('Expected relative asset paths for static hosting');
const files=await readdir(resolve(root,'dist/data/counties'));
console.log(`Verified buildless static app: ${files.length} local county boundary files. No build or package installation required.`);
