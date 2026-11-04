import { categoryIconSvg } from '../core/chains/ChainCategories.js?v=0.4.63';

export const MAP_DISPLAY_DEFAULTS=Object.freeze({
  showIcons:true,showNames:true,showPoints:true,clusterPoints:true,
  pointSize:5,iconSize:20,nameSize:12,readStyle:'transparent',likedStyle:'red-border'
});
const RANGES={pointSize:[2,12],iconSize:[14,32],nameSize:[10,20]};
const CHOICES={readStyle:['transparent'],likedStyle:['red-border']};
const LIMIT=(n,low,high)=>Math.max(low,Math.min(high,n));

export function normalizeMapDisplay(value={}){
  const result={...MAP_DISPLAY_DEFAULTS};
  for(const key of ['showIcons','showNames','showPoints','clusterPoints']){
    if(typeof value[key]==='boolean')result[key]=value[key];
  }
  for(const [key,[low,high]] of Object.entries(RANGES)){
    if(Number.isFinite(Number(value[key])))result[key]=LIMIT(Number(value[key]),low,high);
  }
  // Status display is fixed; older saved choices are migrated automatically.
  for(const [key,allowed] of Object.entries(CHOICES))result[key]=allowed[0];
  return result;
}

// MapLibre's setClusterOptions can acknowledge a toggle without rebuilding
// clustered tiles. Re-submit the already loaded GeoJSON to force a refresh.
// Serialize the work per source so rapid on/off/on taps finish in the right order.
const clusterUpdates=new WeakMap();
export function updateSourceClustering(map,sourceId,enabled){
  const source=map.getSource?.(sourceId);
  if(!source)return Promise.resolve(false);
  let updates=clusterUpdates.get(map);
  if(!updates){updates=new Map();clusterUpdates.set(map,updates);}
  const previous=updates.get(sourceId)||Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
    const current=map.getSource?.(sourceId);
    if(!current)return false;
    const requested={cluster:enabled,clusterRadius:38,clusterMaxZoom:15};
    const currentCluster=current.getClusterOptions?.().cluster;
    if(currentCluster===enabled)return true;
    if(typeof current.setClusterOptions==='function'&&typeof current.getData==='function'&&typeof current.setData==='function'){
      // getData keeps the entire active discovery session, including all
      // feedback states. setData forces reclustering after updating options.
      const data=await current.getData();
      await current.setClusterOptions(requested);
      await current.setData(data);
      return true;
    }
    // Compatibility for MapLibre versions without dynamic cluster options.
    if(typeof current.serialize!=='function'||typeof map.getStyle!=='function')return false;
    const config=current.serialize();
    if(config?.type!=='geojson'||!config.data)return false;
    const layers=map.getStyle()?.layers;
    if(!Array.isArray(layers))return false;
    const saved=layers.filter(layer=>layer.source===sourceId);
    const last=layers.reduce((i,layer,j)=>layer.source===sourceId?j:i,-1);
    const after=layers.slice(last+1).find(layer=>layer.source!==sourceId)?.id;
    for(const layer of [...saved].reverse())map.removeLayer(layer.id);
    map.removeSource(sourceId);
    map.addSource(sourceId,{...config,...requested});
    for(const layer of saved)map.addLayer(layer,after);
    return true;
  });
  updates.set(sourceId,task);
  return task;
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
    setPaint(id,'icon-opacity',['case',['==',['get','read'],1],0.3,1]);
  }
  for(const id of ['sharon-chain-points-names','sharon-wikipedia-names','sharon-object-point-labels','sharon-shape-label-text']){
    setLayout(id,'visibility',state.showNames?'visible':'none');
    setLayout(id,'text-size',state.nameSize);
  }
  for(const id of ['sharon-chain-points','sharon-wikipedia-points','sharon-points']){
    setPaint(id,'circle-radius',state.pointSize);
    if(id!=='sharon-points'){
      const opacity=['case',['==',['get','read'],1],0.3,1];
      setPaint(id,'circle-opacity',state.showPoints?opacity:0);
      setPaint(id,'circle-stroke-opacity',state.showPoints?['case',['==',['get','liked'],1],1,['==',['get','read'],1],0.3,1]:0);
    }else{
      setPaint(id,'circle-opacity',state.showPoints?['*',['get','opacity'],['case',['get','seen'],0.2,1]]:0);
      setPaint(id,'circle-stroke-opacity',state.showPoints?['*',['get','opacity'],['case',['get','seen'],0.2,1]]:0);
    }
  }
  const clustering=['sharon-chain-branches','sharon-wikipedia'].map(sourceId=>
    updateSourceClustering(map,sourceId,state.clusterPoints));
  for(const id of ['sharon-chain-clusters','sharon-chain-clusters-count','sharon-wikipedia-clusters','sharon-wikipedia-cluster-count']){
    setLayout(id,'visibility',state.clusterPoints?'visible':'none');
  }
  if(map.getLayer?.('sharon-wikipedia-points')){
    setPaint('sharon-wikipedia-points','circle-color','#ffffff');
    setPaint('sharon-wikipedia-points','circle-stroke-color',['case',['==',['get','liked'],1],'#d43e54','#547da0']);
    setPaint('sharon-wikipedia-points','circle-opacity',state.showPoints?['case',['==',['get','read'],1],0.3,1]:0);
    setPaint('sharon-wikipedia-points','circle-stroke-opacity',state.showPoints?['case',['==',['get','liked'],1],1,['==',['get','read'],1],0.3,1]:0);
  }
  if(map.getLayer?.('sharon-chain-points')){
    setPaint('sharon-chain-points','circle-stroke-color',['case',['==',['get','liked'],1],'#d43e54',['==',['get','status'],'possibly-closed'],'#a2aaa8','#486c65']);
  }
  return Promise.all(clustering);
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
    '<button type="button" class="sh-map-display-toggle" data-map-toggle="'+key+'" aria-pressed="false"><span class="sh-map-display-symbol" aria-hidden="true">'+mark+'</span><span>'+label+'</span></button>').join('');
  controls.innerHTML='<div class="sh-map-display-toggles">'+buttons+'</div>'+
    '<div class="sh-map-display-size-group">'+
      slider('iconSize','Markers','⌾',14,32)+
      slider('nameSize','Tekst','Aa',10,20)+'</div>'+
    '<div class="sh-map-display-sample" aria-label="Voorbeeldmarker"><span data-map-display-sample-marker><span data-map-display-sample-icon>'+categoryIconSvg('natuur',20)+'</span></span><span data-map-display-sample-name>Voorbeeldlocatie</span></div>';
  let state=normalizeMapDisplay(settings.get().mapDisplay);
  let active=true, sequence=0, saving=Promise.resolve();
  const render=()=>{
    for(const btn of controls.querySelectorAll('[data-map-toggle]')){
      const on=state[btn.dataset.mapToggle];
      btn.setAttribute('aria-pressed',String(on));
    }
    for(const input of controls.querySelectorAll('input[data-map-display]')){
      input.value=String(state[input.dataset.mapDisplay]);
      input.disabled=input.dataset.mapDisplay==='nameSize'&&!state.showNames;
    }
    for(const output of controls.querySelectorAll('[data-map-display-value]'))output.textContent=state[output.dataset.mapDisplayValue]+' px';
    const icon=controls.querySelector('[data-map-display-sample-icon]');
    const name=controls.querySelector('[data-map-display-sample-name]');
    const marker=controls.querySelector('[data-map-display-sample-marker]');
    if(icon){icon.hidden=!state.showIcons;icon.style.width=state.iconSize+'px';icon.style.height=state.iconSize+'px';}
    if(name){name.hidden=!state.showNames;name.style.fontSize=state.nameSize+'px';}
    if(marker){marker.hidden=!state.showPoints&&!state.showIcons;marker.style.display='inline-flex';marker.style.alignItems='center';marker.style.justifyContent='center';marker.style.border='2px solid #547da0';marker.style.borderRadius='50%';marker.style.background='#fff';marker.style.width=state.iconSize+'px';marker.style.height=state.iconSize+'px';}
  };
  const showTab=which=>{
    const display=which==='display';
    controls.hidden=!display;orderPanel.hidden=display;
    for(const tab of tabs)tab.setAttribute('aria-pressed',String((tab.dataset.mapTab==='display')===display));
  };
  const save=(patch)=>{
    state=normalizeMapDisplay({...state,...patch});
    render();applyMapDisplay(getMap(),state);
    const index=++sequence;
    const status=null;
    saving=saving.catch(()=>{}).then(()=>settings.update({mapDisplay:patch}));
    saving.catch(()=>{ /* Failure is handled by settings service; no status label on map. */ });
  };
  const onClick=event=>{
    const tab=event.target.closest?.('[data-map-tab]');
    if(tab&&panel.contains(tab)){showTab(tab.dataset.mapTab);return;}
    const toggle=event.target.closest?.('[data-map-toggle]');
    if(toggle&&controls.contains(toggle)){
      const key=toggle.dataset.mapToggle;
      save({[key]:!state[key]});
      return;
    }

  };
  const onInput=event=>{
    const input=event.target.closest?.('input[data-map-display]');
    if(!input||!controls.contains(input))return;
    const key=input.dataset.mapDisplay;
    const value=Number(input.value);
    if(key==='iconSize'){
      save({iconSize:value,pointSize:Math.max(2,Math.min(12,Math.round(value/4)))});
    }else save({[key]:value});
  };
  panel.addEventListener('click',onClick);
  controls.addEventListener('input',onInput);
  showTab('display');render();
  return ()=>{active=false;panel.removeEventListener('click',onClick);controls.removeEventListener('input',onInput);};
}
