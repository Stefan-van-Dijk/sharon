import { analysisRange, saveAnalysisRange, validCenter, ANALYSIS_RANGE_EVENT } from './AnalysisRange.js?v=0.4.38';
const EMPTY={type:'FeatureCollection',features:[]};
export function analysisZoneGeoJSON(range){
  if(!validCenter(range.center))return EMPTY;
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
// Fit into the largest uncovered rectangle beside the settings sheet.
export function analysisZonePadding(view, sheet){
  if(!view?.width||!view?.height||!sheet?.width||!sheet?.height)return 40;
  const width=view.width,height=view.height;
  const left=Math.max(0,Math.min(width,sheet.left-view.left)),right=Math.max(0,Math.min(width,sheet.right-view.left));
  const top=Math.max(0,Math.min(height,sheet.top-view.top)),bottom=Math.max(0,Math.min(height,sheet.bottom-view.top));
  if(right<=left||bottom<=top)return 40;
  const spaces=[{x:0,y:0,w:width,h:top},{x:0,y:bottom,w:width,h:height-bottom},{x:0,y:0,w:left,h:height},{x:right,y:0,w:width-right,h:height}];
  const space=spaces.filter(s=>s.w>=80&&s.h>=80).sort((a,b)=>b.w*b.h-a.w*a.h)[0];
  if(!space)return 24;
  return {left:space.x+24,right:width-space.x-space.w+24,top:space.y+24,bottom:height-space.y-space.h+24};
}
export function mountAnalysisZone(map,root){
  const source='sharon-analysis-zone';
  map.addSource(source,{type:'geojson',data:EMPTY});
  map.addLayer({id:source+'-fill',type:'fill',source,filter:['==',['get','kind'],'zone'],paint:{'fill-color':'#8052a0','fill-opacity':0.07}});
  map.addLayer({id:source+'-line',type:'line',source,filter:['==',['get','kind'],'zone'],paint:{'line-color':'#8052a0','line-width':2,'line-dasharray':[4,3]}});
  map.addLayer({id:source+'-center',type:'circle',source,filter:['==',['get','kind'],'center'],paint:{'circle-radius':5,'circle-color':'#8052a0','circle-stroke-color':'#fff','circle-stroke-width':2}});
  const render=()=>map.getSource(source)?.setData(analysisZoneGeoJSON(analysisRange()));
  const anchor=()=>{const point=map.getCenter();if(validCenter(point))saveAnalysisRange({center:{lng:point.lng,lat:point.lat}});};
  const click=event=>{
    if(event.target.closest('[data-analysis-recenter]'))anchor();
    if(event.target.closest('[data-analysis-fit]')){
      const range=analysisRange(),polygon=analysisZoneGeoJSON(range).features.find(feature=>feature.geometry.type==='Polygon');
      if(polygon){const ring=polygon.geometry.coordinates[0],xs=ring.map(point=>point[0]),ys=ring.map(point=>point[1]);map.fitBounds?.([[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)]],{padding:analysisZonePadding(map.getContainer?.().getBoundingClientRect(),root.querySelector('[data-board-order-sheet]:not([hidden])')?.getBoundingClientRect()),duration:400,maxZoom:18,retainPadding:false});}
    }
    if(event.target.closest('[data-board-order-settings]')&&!root.querySelector('[data-board-order-sheet]')?.hidden)anchor();
  };
  window.addEventListener(ANALYSIS_RANGE_EVENT,render);root.addEventListener('click',click);
  if(!analysisRange().center)anchor();else render();
  return ()=>{window.removeEventListener(ANALYSIS_RANGE_EVENT,render);root.removeEventListener('click',click);for(const suffix of ['center','line','fill'])if(map.getLayer?.(source+'-'+suffix))map.removeLayer(source+'-'+suffix);if(map.getSource(source))map.removeSource?.(source);};
}
