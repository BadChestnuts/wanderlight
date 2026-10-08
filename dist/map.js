import { countryKey, countryName, groupPlaces, icon, escapeHtml } from './core.js';
const NS='http://www.w3.org/2000/svg';
const element=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
export class TravelMap {
  constructor(container, atlas, onSelect, onRegion, onError) {
    this.container=container;this.atlas=atlas;this.onSelect=onSelect;this.onRegion=onRegion;this.onError=onError;
    this.mode='world';this.granularity='country';this.flat=false;this.rotation=[-103,-24,0];this.zoom=1;this.pan=[0,0];this.trips=[];this.selected=null;this.cityFocus=null;this.countyData=null;this.spinning=false;this.disposed=false;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.svg=element('svg',{role:'img','aria-label':'可拖动和缩放的旅行地图',tabindex:'0'});this.svg.classList.add('travel-map');
    this.svg.innerHTML=`<defs>
      <radialGradient id="ocean" cx="35%" cy="28%"><stop offset="0" stop-color="#193431"/><stop offset=".64" stop-color="#102721"/><stop offset="1" stop-color="#071612"/></radialGradient>
      <radialGradient id="shade" cx="30%" cy="25%"><stop offset="0" stop-color="#9ed7be" stop-opacity=".03"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
      <linearGradient id="lit" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c7b777"/><stop offset="1" stop-color="#897044"/></linearGradient>
      <filter id="aura" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="15"/></filter>
      <filter id="pin-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>`;
    this.aura=element('circle',{class:'earth-aura',fill:'#6cb39a',opacity:'.12',filter:'url(#aura)'});
    this.ocean=element('path',{fill:'url(#ocean)',class:'map-ocean'});
    this.graticule=element('path',{class:'graticule'});
    this.regionLayer=element('g',{class:'region-layer'});this.lineLayer=element('g',{class:'border-layer'});
    this.routeLayer=element('g',{class:'route-layer'});this.shade=element('circle',{fill:'url(#shade)','pointer-events':'none'});
    this.pinLayer=element('g',{class:'pin-layer'});this.outline=element('circle',{class:'earth-outline'});
    this.svg.append(this.aura,this.ocean,this.graticule,this.regionLayer,this.lineLayer,this.routeLayer,this.shade,this.outline,this.pinLayer);
    container.append(this.svg);
    this.tip=document.createElement('div');this.tip.className='map-tooltip';this.tip.hidden=true;container.append(this.tip);
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(container);
    this.svg.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.svg.addEventListener('pointermove',e=>this.pointerMove(e));
    this.svg.addEventListener('pointerup',e=>this.pointerUp(e));
    this.svg.addEventListener('pointercancel',()=>{this.drag=null;});
    this.svg.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*Math.exp(-e.deltaY*.001));},{passive:false});
    this.svg.addEventListener('keydown',e=>{
      if(e.target!==this.svg)return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key)){e.preventDefault();this.setSpin(false);if(e.key==='+')this.setZoom(this.zoom*1.2);else if(e.key==='-')this.setZoom(this.zoom/1.2);else if(e.key==='Home')this.reset();else if(this.mode==='world'&&!this.flat){this.rotation[0]+=e.key==='ArrowLeft'?8:e.key==='ArrowRight'?-8:0;this.rotation[1]=Math.max(-80,Math.min(80,this.rotation[1]+(e.key==='ArrowUp'?8:e.key==='ArrowDown'?-8:0)));this.draw();}else{this.pan[0]+=e.key==='ArrowLeft'?25:e.key==='ArrowRight'?-25:0;this.pan[1]+=e.key==='ArrowUp'?25:e.key==='ArrowDown'?-25:0;this.draw();}}});
    this.buildRegions();this.draw();
  }
  update(trips,selected) { this.trips=trips;this.selected=selected;this.buildRegions();this.draw(); }
  setView(mode,granularity,flat=this.flat) {
    const changed=this.mode!==mode||this.flat!==flat;
    const grainChanged=this.granularity!==granularity;
    if(granularity!=='county'&&this.cityFocus){this.cityFocus=null;this.countyData=null;this.container.dispatchEvent(new CustomEvent('cityfocus',{detail:null}));}
    this.mode=mode;this.granularity=granularity;this.flat=flat;
    this.setSpin(false);
    if(changed){this.zoom=1;this.pan=[0,0];this.cityFocus=null;this.countyData=null;}
    this.container.classList.toggle('china-view',mode==='china');
    this.container.classList.toggle('flat-view',mode==='world'&&flat);
    this.buildRegions();this.draw();
    if((changed||grainChanged)&&!this.reduced)this.svg.animate([{opacity:.4,transform:'scale(.988)'},{opacity:1,transform:'scale(1)'}],{duration:420,easing:'cubic-bezier(.2,.7,.2,1)'});
    if(mode==='china'&&granularity==='county') {
      const p=this.trips.find(t=>t.id===this.selected&&t.countryId==='156')||this.trips.find(t=>t.countryId==='156');
      if(p)this.focusCity(p.cityId);else if(!this.cityFocus)this.onError?.('请选择地图上的城市，展开它的区县。',false);
    }
  }
  async focusCity(id) {
    if(!id)return;
    const city=this.atlas.cities.find(f=>String(f.id)===String(id));if(!city)return;
    this.cityFocus=city;
    if(this.granularity==='county'){
      try{const r=await fetch(`./data/counties/${encodeURIComponent(id)}.json`);if(!r.ok)throw new Error();const data=await r.json();if(String(this.cityFocus?.id)!==String(id)||this.disposed)return;this.countyData=data;}
      catch{this.countyData=null;this.onError?.('这个城市暂未收录区县边界；市级轮廓仍可显示。',false);}
    }
    this.zoom=1;this.pan=[0,0];this.buildRegions();this.draw();
    this.container.dispatchEvent(new CustomEvent('cityfocus',{detail:city}));
  }
  clearFocus(){this.cityFocus=null;this.countyData=null;this.zoom=1;this.pan=[0,0];this.buildRegions();this.draw();this.container.dispatchEvent(new CustomEvent('cityfocus',{detail:null}));}
  buildRegions(){
    let features=this.mode==='world'?this.atlas.world:this.granularity==='province'?this.atlas.provinces:this.granularity==='county'&&this.countyData?this.countyData.features:this.atlas.cities;
    this.regions=features.map(feature=>{
      let visits=[];
      if(this.mode==='world')visits=this.trips.filter(t=>countryKey(t.countryId)===countryKey(feature.id));
      else if(this.granularity==='province')visits=this.trips.filter(t=>t.provinceId===String(feature.id));
      else if(this.granularity==='county'&&this.countyData)visits=this.trips.filter(t=>t.countyId===String(feature.id));
      else visits=this.trips.filter(t=>t.cityId===String(feature.id));
      const lit=(this.mode!=='world'||this.granularity==='country')&&visits.length;
      const path=element('path',{class:`map-region${lit?' visited':''}${lit&&visits.some(t=>t.id===this.selected)?' selected':''}`,'data-region':feature.id});
      const name=this.mode==='world'?countryName(feature.id,feature.properties.name):feature.properties.name;
      const title=element('title');title.textContent=`${name}${visits.length?` · ${visits.length} 次旅行`:' · 尚未点亮'}`;path.append(title);
      path.addEventListener('pointerenter',e=>{if(this.drag)return;this.tip.innerHTML=`<strong>${escapeHtml(name)}</strong><span>${visits.length?`${visits.length} 次旅行`:'点击查看或记录旅行'}</span>`;this.tip.hidden=false;this.placeTip(e);});
      path.addEventListener('pointermove',e=>this.placeTip(e));path.addEventListener('pointerleave',()=>this.tip.hidden=true);
      path.addEventListener('click',()=>{if(this.suppressClick)return;if(this.mode==='china'&&this.granularity==='county'&&!this.countyData){this.focusCity(String(feature.id));return;}if(visits.length)this.onSelect(visits.sort((a,b)=>b.start.localeCompare(a.start))[0].id);else this.onRegion(feature,this.mode,this.granularity,this.cityFocus);});
      return {feature,path};
    });
    this.regionLayer.replaceChildren(...this.regions.map(r=>r.path));
    this.lineLayer.replaceChildren();
    if(this.mode==='china'&&!this.cityFocus)for(const f of this.atlas.guides||[]){const p=element('path',{class:'province-border'});this.lineLayer.append(p);p.__feature=f;}
    if(this.mode==='china'&&!this.cityFocus&&this.granularity!=='province')for(const f of this.atlas.provinces){const p=element('path',{class:'province-border'});this.lineLayer.append(p);p.__feature=f;}
  }
  placeTip(e){const b=this.container.getBoundingClientRect();this.tip.style.left=Math.max(8,Math.min(b.width-190,e.clientX-b.left+14))+'px';this.tip.style.top=Math.max(8,Math.min(b.height-80,e.clientY-b.top+14))+'px';}
  projection(){
    const w=this.container.clientWidth,h=this.container.clientHeight;this.width=w;this.height=h;
    if(this.mode==='world'&&!this.flat){const radius=Math.min(w*.38,h*.425)*this.zoom;this.radius=radius;return d3.geoOrthographic().rotate(this.rotation).scale(radius).translate([w*(w>850?.405:.5),h*.51]).clipAngle(90);}
    if(this.mode==='world'){const p=d3.geoNaturalEarth1().fitExtent([[28,94],[w>850?w*.71:w-28,h-60]],{type:'Sphere'});const t=p.translate();return p.scale(p.scale()*this.zoom).translate([t[0]+this.pan[0],t[1]+this.pan[1]]);}
    const target=this.cityFocus||{type:'FeatureCollection',features:this.atlas.provinces};
    const inset=this.cityFocus?[[w*.08,95],[w*(w>850?.69:.94),h-80]]:[[24,70],[w*(w>850?.71:.96),h-52]];
    const p=d3.geoMercator().fitExtent(inset,target);const t=p.translate();return p.scale(p.scale()*this.zoom).translate([t[0]+this.pan[0],t[1]+this.pan[1]]);
  }
  draw(){
    if(this.disposed||!this.container.clientWidth)return;
    const projection=this.projection(),path=d3.geoPath(projection),w=this.width,h=this.height;
    this.proj=projection;this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const sphere=path({type:'Sphere'});this.ocean.setAttribute('d',this.mode==='china'?'':sphere);
    this.graticule.setAttribute('d',this.mode==='china'?'':path(d3.geoGraticule10()));
    const round=this.mode==='world'&&!this.flat;
    const center=projection.translate();
    for(const c of [this.aura,this.shade,this.outline]){c.style.display=round?'':'none';c.setAttribute('cx',center[0]);c.setAttribute('cy',center[1]);c.setAttribute('r',this.radius+(c===this.aura?3:0));}
    for(const r of this.regions)r.path.setAttribute('d',path(r.feature)||'');
    for(const p of this.lineLayer.children)p.setAttribute('d',path(p.__feature)||'');
    this.routeLayer.replaceChildren();
    if(this.showRoutes&&this.mode==='world'){
      const trips=[...this.trips].sort((a,b)=>a.start.localeCompare(b.start));
      for(let i=1;i<trips.length;i++){const p=element('path',{d:path({type:'LineString',coordinates:[trips[i-1].coords,trips[i].coords]})||'',class:'travel-route'});this.routeLayer.append(p);}
    }
    const groups=groupPlaces(this.trips).filter(t=>this.mode==='world'||countryKey(t.countryId)==='156');
    this.pinLayer.replaceChildren();
    const occupied=[];
    for(const place of groups){
      if(round&&d3.geoDistance(place.coords,projection.invert(center))>Math.PI/2-.015)continue;
      const pos=projection(place.coords);if(!pos||!pos.every(Number.isFinite))continue;
      if(pos[0]<-30||pos[0]>w+30||pos[1]<50||pos[1]>h-25)continue;
      const selected=place.visits.some(t=>t.id===this.selected);
      const g=element('g',{transform:`translate(${pos[0]},${pos[1]})`,class:`map-pin${selected?' active':''}`,role:'button',tabindex:'0','aria-label':`${place.city}，${place.visits.length} 次旅行`});
      const hit=element('circle',{r:17,fill:'transparent'});
      const cn=this.mode==='china';
      const glow=element('circle',{r:cn?(selected?6:4):(selected?13:8),fill:'#f8d08b',opacity:cn?'.4':'.65',filter:'url(#pin-glow)'});
      const halo=element('circle',{r:cn?(selected?6:4):(selected?11:7),class:'pin-halo'});const dot=element('circle',{r:cn?(selected?3:2.4):(selected?4.5:3.2),class:'pin-dot'});g.append(glow,halo,dot,hit);
      const labelWidth=Math.max(50,place.city.length*13+20);
      const collision=occupied.some(p=>Math.abs(p[0]-pos[0])<Math.max(p[2],labelWidth)&&Math.abs(p[1]-pos[1])<29);
      if(!collision||selected){
        const text=element('text',{x:12,y:5,class:'pin-label'});text.textContent=place.city.replace(/市$/,'');g.append(text);occupied.push([pos[0],pos[1],labelWidth]);
      }
      g.addEventListener('click',e=>{e.stopPropagation();if(!this.suppressClick)this.onSelect(place.visits[0].id);});
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();this.onSelect(place.visits[0].id);}});
      this.pinLayer.append(g);
    }
  }
  pointerDown(e){if(e.button!==0||e.target.closest('.map-pin'))return;this.setSpin(false);this.cancelFlight();this.drag={x:e.clientX,y:e.clientY,rotation:[...this.rotation],pan:[...this.pan],moved:false,pointerId:e.pointerId};this.tip.hidden=true;}
  pointerMove(e){if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>5){this.drag.moved=true;this.svg.setPointerCapture(e.pointerId);this.svg.classList.add('dragging');}
    if(this.mode==='world'&&!this.flat){this.rotation=[this.drag.rotation[0]+dx/(this.radius||300)*75,Math.max(-85,Math.min(85,this.drag.rotation[1]-dy/(this.radius||300)*75)),0];}else{this.pan=[this.drag.pan[0]+dx,this.drag.pan[1]+dy];}this.draw();}
  pointerUp(e){if(!this.drag)return;this.suppressClick=this.drag.moved;if(this.svg.hasPointerCapture(e.pointerId))this.svg.releasePointerCapture(e.pointerId);this.drag=null;this.svg.classList.remove('dragging');setTimeout(()=>this.suppressClick=false,0);}
  setZoom(z){this.zoom=Math.max(.7,Math.min(this.mode==='world'?3:10,z));this.draw();}
  cancelFlight(){if(this.flight)cancelAnimationFrame(this.flight);this.flight=null;}
  flyTo(trip){
    this.setSpin(false);this.cancelFlight();
    if(this.mode==='china'){if(this.granularity==='county')this.focusCity(trip.cityId);else{this.cityFocus=null;this.countyData=null;this.zoom=1;this.pan=[0,0];this.buildRegions();this.draw();}return;}
    if(this.flat){this.draw();return;}
    const from=[...this.rotation],to=[-trip.coords[0],-trip.coords[1],0];let delta=((to[0]-from[0]+540)%360)-180;
    const start=performance.now(),duration=this.reduced?0:850;
    const animate=now=>{const t=duration?Math.min(1,(now-start)/duration):1,k=1-(1-t)**3;this.rotation=[from[0]+delta*k,from[1]+(to[1]-from[1])*k,0];this.draw();if(t<1&&!this.disposed)this.flight=requestAnimationFrame(animate);else this.flight=null;};this.flight=requestAnimationFrame(animate);
  }
  reset(){this.cancelFlight();this.rotation=[-103,-24,0];this.zoom=1;this.pan=[0,0];if(this.cityFocus)this.clearFocus();else this.draw();}
  setSpin(value){this.spinning=value&&this.mode==='world'&&!this.flat&&!this.reduced;cancelAnimationFrame(this.spinFrame);this.container.dispatchEvent(new CustomEvent('spinchange',{detail:this.spinning}));if(!this.spinning)return;let last=0;const frame=t=>{if(!this.spinning||this.disposed)return;if(last&&t-last<60){this.spinFrame=requestAnimationFrame(frame);return;}if(last)this.rotation[0]+=(t-last)*.0025;last=t;if(!document.hidden)this.draw();this.spinFrame=requestAnimationFrame(frame);};this.spinFrame=requestAnimationFrame(frame);}
  dispose(){this.disposed=true;this.observer.disconnect();this.cancelFlight();cancelAnimationFrame(this.spinFrame);this.container.replaceChildren();}
}
