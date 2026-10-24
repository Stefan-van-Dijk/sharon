export const placeKey = item => item.sourceRef || item.data?.sourceRef || 'location:'+item.id;
export const placeFeedbackKey = id => 'sharon.place.feedback.v1:'+id;
export function placeHidden(item){try{return JSON.parse(localStorage.getItem(placeFeedbackKey(placeKey(item)))||'{}').hidden===true;}catch{return false;}}
export function activePlace(point=null){window.dispatchEvent(new CustomEvent('sharon-place-board-active',{detail:{point}}));}
export function mountPlacePulse(map){
 const source='sharon-active-place',layer=source+'-pulse';let frame=null;
 map.addSource(source,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
 map.addLayer({id:layer,type:'circle',source,paint:{'circle-radius':8,'circle-color':'#486c65','circle-opacity':.35,'circle-stroke-width':2,'circle-stroke-color':'#486c65'}});
 const stop=()=>{cancelAnimationFrame(frame);frame=null;};
 const change=event=>{stop();const p=event.detail?.point;map.getSource(source)?.setData({type:'FeatureCollection',features:p?[{type:'Feature',geometry:{type:'Point',coordinates:[Number(p.lng),Number(p.lat)]},properties:{}}]:[]});
  const pulse=()=>{map.setPaintProperty(layer,'circle-opacity',.18+.32*(1+Math.sin(performance.now()/300))/2);frame=requestAnimationFrame(pulse);};
  if(p&&!matchMedia('(prefers-reduced-motion: reduce)').matches)frame=requestAnimationFrame(pulse);
 };
 window.addEventListener('sharon-place-board-active',change);
 return ()=>{stop();window.removeEventListener('sharon-place-board-active',change);};
}
