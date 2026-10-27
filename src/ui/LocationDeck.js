import { placeKey, activePlace } from './PlaceFeedback.js?v=0.4.18';
import { openBoardViewer } from './BoardViewer.js?v=0.4.18';
import { getPrivateWebSources, addPrivateWebSource } from '../core/location/LocationWebSources.js?v=0.4.18';

const IMAGE_KEY = 'location.board.image.v1:';
export function openLocationDeck({store, objects, selected, onClose, onLocation, map, location, events}) {
  const places = objects.filter(item => item.type === 'location' && !item.deletedAt && item.data?.coordinates);
  let index = places.findIndex(item => String(item.id) === String(selected.properties?.id));
  if (index < 0) {
    const [lng, lat] = selected.geometry?.coordinates || [];
    index = places.findIndex(item => Math.abs(Number(item.data.coordinates.lng) - Number(lng)) < 0.00001 && Math.abs(Number(item.data.coordinates.lat) - Number(lat)) < 0.00001);
  }
  if (index < 0) return () => {};
  let expanded = false, page = 0, sources = [], image = '', closeViewer = null, disposed = false, replacing = false, sequence = 0;
  const current = () => places[index];
  const addressText = data => typeof data.address === 'string' ? data.address :
    [data.address?.street, data.address?.houseNumber, data.address?.postalCode, data.address?.city].filter(Boolean).join(' ');
  const placeholder = (point) => {
    // An illustrative map-like placeholder, not a claimed geographical map.
    const lat=Number(point?.lat)||0, lng=Number(point?.lng)||0;
    const shiftX=Math.round(Math.abs(lng*37))%110, shiftY=Math.round(Math.abs(lat*29))%95;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 430">
      <rect width="720" height="430" fill="#e9e5d9"/>
      <path d="M0 95 L720 175 M0 310 L720 260 M180 0 L240 430 M480 0 L440 430" fill="none" stroke="#f9f7f1" stroke-width="31"/>
      <path d="M0 95 L720 175 M0 310 L720 260 M180 0 L240 430 M480 0 L440 430" fill="none" stroke="#c3c6bd" stroke-width="2"/>
      <path d="M${70+shiftX} 0 Q${180+shiftX} 190 ${110+shiftX} 430" stroke="#a7c5c8" stroke-width="68" fill="none"/>
      <path d="M${70+shiftX} 0 Q${180+shiftX} 190 ${110+shiftX} 430" stroke="#d6e5df" stroke-width="2" fill="none"/>
      <path d="M315 0 V430 M575 0 V430 M0 370 H720 M0 45 H720" stroke="#c5c7b8" stroke-width="3" fill="none" stroke-dasharray="6 9"/>
      <circle cx="365" cy="212" r="32" fill="#fff" opacity=".8"/><circle cx="365" cy="212" r="13" fill="#587d85" stroke="#fff" stroke-width="5"/>
      <text x="360" y="385" font-family="sans-serif" font-size="17" fill="#687b77" text-anchor="middle">Sharon · locatie</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  };
  const complete = id => { try {localStorage.setItem('sharon.board.lesson.v2.'+id,'done');}catch{} };
  const show = async () => {
    const ticket = ++sequence, item = current();
    // A missing optional source/image must never prevent the location Board from opening.
    const [links, record] = await Promise.all([
      getPrivateWebSources(store,item.id).catch(() => []),
      store.get('meta',IMAGE_KEY+item.id).catch(() => null)
    ]);
    if (disposed || ticket !== sequence) return;
    sources = links;
    image = typeof record?.value === 'string' ? record.value : '';
    if (!image) {
      try { image = map?.getCanvas()?.toDataURL('image/png') || ''; } catch { image = ''; }
      if (!image) image = placeholder(item.data?.coordinates);
    }
    const data = item.data || {}, point = data.coordinates;
    activePlace(point);
    const source = expanded && page > 0 ? sources[page-1] : null;
    const title = source ? new URL(source.url).hostname : String(data.name || data.title || 'Locatie');
    const feature = {type:'Feature',geometry:{type:'Point',coordinates:[Number(point.lng),Number(point.lat)]},
      properties:{title,url:source?.url || '',image}};
    replacing = true;
    closeViewer?.();
    replacing = false;
    closeViewer = openBoardViewer(feature,{
      location, events,
      localBoard:{
        feedbackId:placeKey(item),
        feedbackReference:data.sourceRef?{source:'openstreetmap',id:data.sourceRef,uri:'https://www.openstreetmap.org/'+data.sourceRef}:null,
        title, type:source ? 'Webpagina' : String(data.locationType || data.type || 'Locatie'),
        address:source ? source.url : addressText(data),
        website:source?.url || '', image,
        toggle:()=>{complete('deck');expanded=!expanded;page=0;show();},
        addLink:async()=>{
          const url=window.prompt('Koppel een website aan deze locatie (https://)');
          if(url===null)return;
          try {await addPrivateWebSource(store,item.id,url);complete('link');expanded=true;page=0;show();}
          catch(error){window.alert(error.message);}
        },
        setImage:async()=>{
          const saved=await store.get('meta',IMAGE_KEY+item.id);
          const url=window.prompt('Afbeelding-URL (https://)',typeof saved?.value==='string'?saved.value:'');
          if(url===null)return;
          if(url.trim() && !/^https:\/\/[^\s]+$/i.test(url.trim())){window.alert('Gebruik een https://-URL');return;}
          await store.put('meta',{key:IMAGE_KEY+item.id,value:url.trim()});if(url.trim())complete('image');show();
        }
      },
      onNext:()=>{
        complete('swipe');
        if(expanded){page=(page+1)%(sources.length+1);}
        else {index=(index+1)%places.length;onLocation?.(current());}
        show();
      },
      onPrevious:()=>{
        complete('swipe');
        if(expanded){page=(page+sources.length)%(sources.length+1);}
        else {index=(index-1+places.length)%places.length;onLocation?.(current());}
        show();
      },
      onClose:()=>{if(replacing)return;closeViewer=null;disposed=true;activePlace();onClose?.();}
    });
  };
  show().catch(error => {
    console.error('Sharon locatie-Board kon niet openen', error);
    const notice = document.createElement('div');
    notice.setAttribute('role','alert');
    notice.style.cssText = 'position:fixed;z-index:2147483647;left:16px;right:16px;bottom:24px;padding:14px 18px;border-radius:14px;background:#fff;color:#222;box-shadow:0 8px 35px #0003';
    notice.textContent = 'Locatie-Board kon niet openen: ' + (error?.message || 'onbekende fout');
    document.body.append(notice);
    window.setTimeout(() => notice.remove(), 9000);
  });
  return ()=>{disposed=true;++sequence;closeViewer?.();activePlace();};
}
