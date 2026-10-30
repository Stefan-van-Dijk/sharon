import { analysisRange, saveAnalysisRange, validCenter, ANALYSIS_RANGE_EVENT, ANALYSIS_PREVIEW_EVENT, ANALYSIS_VISIBILITY_EVENT, ANALYSIS_RANGE_KEY } from './AnalysisRange.js?v=0.4.40';
const EMPTY={type:'FeatureCollection',features:[]};
export function analysisZoneGeoJSON(range){
  if(range.visible===false||!validCenter(range.center))return EMPTY;
  const {lat,lng}=range.center;
  const features=[{type:'Feature',properties:{kind:'center'},geometry:{type:'Point',coordinates:[lng,lat]}}];
  if(!range.unlimited&&range.meters>0){
    const rad=Math.PI/180,phi=lat*rad,lambda=lng*rad,angle=range.meters/6371008.8,ring=[];
    for(let i=0;i<=128;i++){
      const bearing=i*2*Math.PI/128;
      const y=Math.asin(Math.sin(phi)*Math.cos(angle)+Math.cos(phi)*Math.sin(angle)*Math.cos(bearing));
      const x=lambda+Math.atan2(Math.sin(bearing)*Math.sin(angle)*Math.cos(phi),Math.cos(angle)-Math.sin(phi)*Math.sin(y));
      ring.push([x/rad,y/rad]);
    }
    ring[ring.length-1]=[...ring[0]];
    features.unshift({type:'Feature',properties:{kind:'zone'},geometry:{type:'Polygon',coordinates:[ring]}});
  }
  return {type:'FeatureCollection',features};
}
export function analysisVisibleRect(map,root){
  const view=map.getContainer?.()?.getBoundingClientRect();if(!view?.width||!view?.height)return null;
  let spaces=[{x:0,y:0,w:view.width,h:view.height}];
  for(const node of root.querySelectorAll('[data-board-order-sheet]:not([hidden]),[data-map-readout],.environment-map-top-actions')){
    const r=node.getBoundingClientRect();if(!r.width||!r.height)continue;
    const l=Math.max(0,r.left-view.left),t=Math.max(0,r.top-view.top),right=Math.min(view.width,r.right-view.left),bottom=Math.min(view.height,r.bottom-view.top);
    spaces=spaces.flatMap(s=>{
      const x=Math.max(s.x,l),y=Math.max(s.y,t),x2=Math.min(s.x+s.w,right),y2=Math.min(s.y+s.h,bottom);
      if(x>=x2||y>=y2)return [s];
      return [{x:s.x,y:s.y,w:s.w,h:y-s.y},{x:s.x,y:y2,w:s.w,h:s.y+s.h-y2},{x:s.x,y:s.y,w:x-s.x,h:s.h},{x:x2,y:s.y,w:s.x+s.w-x2,h:s.h}];
    }).filter(s=>s.w>=60&&s.h>=60);
  }
  const free=spaces.sort((a,b)=>b.w*b.h-a.w*a.h)[0];return free?{...free,width:view.width,height:view.height}:null;
}
export function mountAnalysisZone(map,root){
  const source='sharon-analysis-zone';
  map.addSource(source,{type:'geojson',data:EMPTY});
  map.addLayer({id:source+'-fill',type:'fill',source,filter:['==',['get','kind'],'zone'],paint:{'fill-color':'#8052a0','fill-opacity':0.07}});
  map.addLayer({id:source+'-line',type:'line',source,filter:['==',['get','kind'],'zone'],paint:{'line-color':'#8052a0','line-width':2,'line-dasharray':[4,3]}});
  map.addLayer({id:source+'-center',type:'circle',source,filter:['==',['get','kind'],'center'],paint:{'circle-radius':5,'circle-color':'#8052a0','circle-stroke-color':'#fff','circle-stroke-width':2}});
  const render=()=>{
    const range=analysisRange();map.getSource(source)?.setData(analysisZoneGeoJSON(range));
    const button=root.querySelector('[data-analysis-fit]');if(button){
      button.setAttribute('aria-pressed',String(range.visible));const label=range.visible?'Verberg analysecirkel':'Toon analysecirkel';button.setAttribute('aria-label',label);button.title=label;
      button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="1.5"/>'+(!range.visible?'<path d="M3 3l18 18"/>':'')+'</svg>';
    }
  };
  const fit=()=>{
    const range=analysisRange();if(!range.center||range.unlimited)return;
    const free=analysisVisibleRect(map,root),padding=free?{left:free.x+20,right:free.width-free.x-free.w+20,top:free.y+20,bottom:free.height-free.y-free.h+20}:40;
    const polygon=analysisZoneGeoJSON({...range,visible:true}).features.find(feature=>feature.geometry.type==='Polygon');
    if(polygon){const ring=polygon.geometry.coordinates[0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);map.fitBounds?.([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding,duration:0,maxZoom:18,retainPadding:false});}
    else map.easeTo?.({center:[range.center.lng,range.center.lat],zoom:18,offset:free?[free.x+free.w/2-free.width/2,free.y+free.h/2-free.height/2]:[0,0],duration:0});
  };
  const preview=()=>{render();fit();};
  const anchor=()=>{const free=analysisVisibleRect(map,root),point=free&&map.unproject?map.unproject([free.x+free.w/2,free.y+free.h/2]):map.getCenter();if(validCenter(point)){saveAnalysisRange({center:{lng:point.lng,lat:point.lat}});fit();}};
  const click=event=>{
    if(event.target.closest('[data-analysis-recenter]'))anchor();
    if(event.target.closest('[data-analysis-fit]')){
      const range=analysisRange();
      try{localStorage.setItem(ANALYSIS_RANGE_KEY,JSON.stringify({...range,visible:!range.visible}));}catch{}
      window.dispatchEvent(new CustomEvent(ANALYSIS_VISIBILITY_EVENT));
    }
    if(event.target.closest('[data-board-order-settings]')&&!root.querySelector('[data-board-order-sheet]')?.hidden)anchor();
  };
  for(const event of [ANALYSIS_RANGE_EVENT,ANALYSIS_VISIBILITY_EVENT])window.addEventListener(event,render);window.addEventListener(ANALYSIS_PREVIEW_EVENT,preview);root.addEventListener('click',click);
  if(!analysisRange().center)anchor();else render();
  return ()=>{for(const event of [ANALYSIS_RANGE_EVENT,ANALYSIS_VISIBILITY_EVENT])window.removeEventListener(event,render);window.removeEventListener(ANALYSIS_PREVIEW_EVENT,preview);root.removeEventListener('click',click);for(const suffix of ['center','line','fill'])if(map.getLayer?.(source+'-'+suffix))map.removeLayer(source+'-'+suffix);if(map.getSource(source))map.removeSource?.(source);};
}
