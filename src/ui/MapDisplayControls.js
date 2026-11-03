import { categoryIconSvg } from '../core/chains/ChainCategories.js?v=0.4.60';

export const MAP_DISPLAY_DEFAULTS=Object.freeze({
  showIcons:true,showNames:true,showPoints:true,clusterPoints:true,
  pointSize:5,iconSize:20,nameSize:12,readStyle:'subtle',likedStyle:'heart'
});
const RANGES={pointSize:[2,12],iconSize:[14,32],nameSize:[10,20]};
const CHOICES={readStyle:['subtle','ring','check','none'],likedStyle:['heart','accent','ring','none']};
const LIMIT=(n,low,high)=>Math.max(low,Math.min(high,n));

export function normalizeMapDisplay(value={}){
  const result={...MAP_DISPLAY_DEFAULTS};
  for(const key of ['showIcons','showNames','showPoints','clusterPoints']){
    if(typeof value[key]==='boolean')result[key]=value[key];
  }
  for(const [key,[low,high]] of Object.entries(RANGES)){
    if(Number.isFinite(Number(value[key])))result[key]=LIMIT(Number(value[key]),low,high);
  }
  for(const [key,allowed] of Object.entries(CHOICES)){
    if(allowed.includes(value[key]))result[key]=value[key];
  }
  return result;
}

// Retain the loaded GeoJSON and every existing layer when MapLibre cannot update
// clustering in place. This avoids losing the user's current discovery session.
export function updateSourceClustering(map, sourceId, enabled){
  const source=map.getSource?.(sourceId);
  if(!source)return false;
  const requested={cluster:enabled,clusterRadius:38,clusterMaxZoom:15};
  if(source.serialize?.()?.cluster===enabled)return true;
  if(typeof source.setClusterOptions==='function'){
    source.setClusterOptions(requested);
    return true;
  }
  if(typeof source.serialize!=='function'||typeof map.getStyle!=='function')return false;
  const config=source.serialize();
  if(config?.type!=='geojson'||!config.data||!Array.isArray(map.getStyle()?.layers))return false;
  const ordered=map.getStyle().layers;
  const saved=ordered.filter(layer=>layer.source===sourceId);
  const last=ordered.reduce((index,layer,i)=>layer.source===sourceId?i:index,-1);
  const after=ordered.slice(last+1).find(layer=>layer.source!==sourceId)?.id;
  try{
    for(const layer of [...saved].reverse())map.removeLayer(layer.id);
    map.removeSource(sourceId);
    map.addSource(sourceId,{...config,...requested});
    for(const layer of saved)map.addLayer(layer,after);
    return true;
  }catch{
    // Never silently pretend that the source changed; the live preview still
    // reflects the user's preference and it is persisted for a fresh map load.
    return false;
  }
}

// Update existing source styling without reopening Omgeving or re-fetching boards.
export function applyMapDisplay(map, value){
  if(!map)return;
  const state=normalizeMapDisplay(value);
  const setLayout=(id,key,v)=>{if(map.getLayer?.(id))map.setLayoutProperty?.(id,key,v);};
  const setPaint=(id,key,v)=>{if(map.getLayer?.(id))map.setPaintProperty?.(id,key,v);};
  for(const id of ['sharon-chain-points-icons','sharon-wikipedia-icons']){
    setLayout(id,'visibility',state.showIcons?'visible':'none');
    setLayout(id,'icon-size',state.iconSize/24);
  }
  for(const id of ['sharon-chain-points-names','sharon-wikipedia-names','sharon-object-point-labels','sharon-shape-label-text']){
    setLayout(id,'visibility',state.showNames?'visible':'none');
    setLayout(id,'text-size',state.nameSize);
  }
  for(const id of ['sharon-chain-points','sharon-wikipedia-points','sharon-points']){
    setPaint(id,'circle-radius',state.pointSize);
    if(id!=='sharon-points'){
      setPaint(id,'circle-opacity',state.showPoints?1:0);
      setPaint(id,'circle-stroke-opacity',state.showPoints?1:0);
    }else{
      setPaint(id,'circle-opacity',state.showPoints?['*',['get','opacity'],['case',['get','seen'],0.2,1]]:0);
      setPaint(id,'circle-stroke-opacity',state.showPoints?['*',['get','opacity'],['case',['get','seen'],0.2,1]]:0);
    }
  }
  for(const sourceId of ['sharon-chain-branches','sharon-wikipedia']){
    updateSourceClustering(map,sourceId,state.clusterPoints);
  }
  for(const id of ['sharon-chain-clusters','sharon-chain-clusters-count','sharon-wikipedia-clusters','sharon-wikipedia-cluster-count']){
    setLayout(id,'visibility',state.clusterPoints?'visible':'none');
  }
  if(map.getLayer?.('sharon-wikipedia-points')){
    setPaint('sharon-wikipedia-points','circle-color',['case',['==',['get','read'],1],'#c6cdd1','#ffffff']);
    setPaint('sharon-wikipedia-points','circle-stroke-color',['case',['==',['get','liked'],1],state.likedStyle==='none'?'#547da0':'#b75b68','#547da0']);
    setPaint('sharon-wikipedia-points','circle-opacity',state.showPoints?(state.readStyle==='subtle'?['case',['==',['get','read'],1],0.42,1]:1):0);
  }
}

const toggles=[
  ['showIcons','Iconen','⌾'],
  ['showNames','Namen','Aa'],
  ['showPoints','Punten','○'],
  ['clusterPoints','Bundelen','⁙']
];
const slider=(key,label,mark,min,max)=>
  '<label class="sh-map-display-size"><span class="sh-map-display-symbol" aria-hidden="true">'+mark+'</span><span>'+label+'</span><input type="range" data-map-display="'+key+'" min="'+min+'" max="'+max+'" step="1"><output data-map-display-value="'+key+'"></output></label>';

export function mountMapDisplayControls(root, {settings,getMap=()=>null}={}){
  const panel=root.querySelector('[data-board-order-sheet]');
  if(!panel||!settings)return ()=>{};
  const orderPanel=panel.querySelector('[data-map-order-content]');
  const controls=panel.querySelector('[data-map-display-controls]');
  const tabs=[...panel.querySelectorAll('[data-map-tab]')];
  if(!controls||!orderPanel)return ()=>{};
  const buttons=toggles.map(([key,label,mark])=>
    '<label class="sh-map-display-toggle"><span class="sh-map-display-symbol" aria-hidden="true">'+mark+'</span><span>'+label+'</span><input type="checkbox" data-map-display="'+key+'"></label>').join('');
  controls.innerHTML='<p class="sh-map-display-hint">Bekijk het effect direct op de kaart.</p>'+
    '<div class="sh-map-display-toggles">'+buttons+'</div>'+
    '<div class="sh-map-display-size-group"><small>Grootte</small>'+
      slider('iconSize','Iconen','⌾',14,32)+
      slider('nameSize','Namen','Aa',10,20)+
      slider('pointSize','Punten','○',2,12)+'</div>'+
    '<div class="sh-map-display-preview"><small>Categorieën · voorbeeld</small><div class="sh-map-display-icons">'+
      ['food','erfgoed','cultuur','home','groceries','natuur'].map(key=>'<span>'+categoryIconSvg(key,20)+'</span>').join('')+
    '</div><div class="sh-map-display-sample"><span data-map-display-sample-icon>'+categoryIconSvg('natuur',20)+'</span><span data-map-display-sample-name>Voorbeeldlocatie</span><span data-map-display-sample-point>●</span></div></div>'+
    '<div class="sh-map-display-states"><label>Gelezen <select data-map-display="readStyle"><option value="subtle">Subtiel</option><option value="ring">Open cirkel</option><option value="check">Vinkje</option><option value="none">Geen onderscheid</option></select></label>'+
      '<label>Leuk gevonden <select data-map-display="likedStyle"><option value="heart">Hartje</option><option value="accent">Accentkleur</option><option value="ring">Buitenring</option><option value="none">Geen onderscheid</option></select></label></div>'+
    '<small class="sh-map-display-feedback" role="status" data-map-display-status>Alleen op dit apparaat opgeslagen</small>';
  let state=normalizeMapDisplay(settings.get().mapDisplay);
  let active=true, sequence=0, saving=Promise.resolve();
  const render=()=>{
    for(const input of controls.querySelectorAll('[data-map-display]')){
      const value=state[input.dataset.mapDisplay];
      if(input.type==='checkbox')input.checked=value;
      else input.value=String(value);
    }
    for(const output of controls.querySelectorAll('[data-map-display-value]'))output.textContent=state[output.dataset.mapDisplayValue]+' px';
    const icon=controls.querySelector('[data-map-display-sample-icon]');
    const name=controls.querySelector('[data-map-display-sample-name]');
    const point=controls.querySelector('[data-map-display-sample-point]');
    if(icon){icon.hidden=!state.showIcons;icon.style.width=state.iconSize+'px';}
    if(name){name.hidden=!state.showNames;name.style.fontSize=state.nameSize+'px';}
    if(point){point.hidden=!state.showPoints;point.style.fontSize=state.pointSize*2+'px';}
  };
  const showTab=which=>{
    const display=which==='display';
    controls.hidden=!display;orderPanel.hidden=display;
    for(const tab of tabs)tab.setAttribute('aria-pressed',String((tab.dataset.mapTab==='display')===display));
  };
  const onClick=event=>{const tab=event.target.closest?.('[data-map-tab]');if(tab&&panel.contains(tab))showTab(tab.dataset.mapTab);};
  const onInput=event=>{
    const input=event.target.closest?.('[data-map-display]');
    if(!input||!controls.contains(input))return;
    const key=input.dataset.mapDisplay;
    const raw=input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value;
    state=normalizeMapDisplay({...state,[key]:raw});
    render();applyMapDisplay(getMap(),state);
    const index=++sequence;
    const status=controls.querySelector('[data-map-display-status]');
    if(status)status.textContent='Direct toegepast · opslaan…';
    const savedValue=state[key];
    saving=saving.catch(()=>{}).then(()=>settings.update({mapDisplay:{[key]:savedValue}}));
    saving.then(()=>{
      if(active&&index===sequence)controls.querySelector('[data-map-display-status]').textContent='Opgeslagen · meteen zichtbaar';
    }).catch(()=>{
      if(active&&index===sequence)controls.querySelector('[data-map-display-status]').textContent='Opslaan mislukt';
    });
  };
  panel.addEventListener('click',onClick);
  controls.addEventListener('input',onInput);
  showTab('display');render();
  return ()=>{active=false;panel.removeEventListener('click',onClick);controls.removeEventListener('input',onInput);};
}
