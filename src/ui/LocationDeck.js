import { openBoardViewer } from './BoardViewer.js?v=0.2.89';
import { getPrivateWebSources, addPrivateWebSource } from '../core/location/LocationWebSources.js?v=0.2.89';

const IMAGE_KEY = 'location.board.image.v1:';
export function openLocationDeck({store, objects, selected, onClose, onLocation, map, location, events}) {
  const places = objects.filter(item => item.type === 'location' && !item.deletedAt && item.data?.coordinates);
  let index = places.findIndex(item => String(item.id) === String(selected.properties?.id));
  if (index < 0) return () => {};
  let expanded = false, page = 0, sources = [], image = '', closeViewer = null, disposed = false, sequence = 0;
  const current = () => places[index];
  const addressText = data => typeof data.address === 'string' ? data.address :
    [data.address?.street, data.address?.houseNumber, data.address?.postalCode, data.address?.city].filter(Boolean).join(' ');
  const show = async () => {
    const ticket = ++sequence, item = current();
    const [links, record] = await Promise.all([getPrivateWebSources(store,item.id),store.get('meta',IMAGE_KEY+item.id)]);
    if (disposed || ticket !== sequence) return;
    sources = links;
    image = typeof record?.value === 'string' ? record.value : '';
    const data = item.data || {}, point = data.coordinates;
    const source = expanded && page > 0 ? sources[page-1] : null;
    const title = source ? new URL(source.url).hostname : String(data.name || data.title || 'Locatie');
    const feature = {type:'Feature',geometry:{type:'Point',coordinates:[Number(point.lng),Number(point.lat)]},
      properties:{title,url:source?.url || '',image}};
    closeViewer?.();
    closeViewer = openBoardViewer(feature,{
      location, events,
      localBoard:{
        title, type:source ? 'Webpagina' : String(data.locationType || data.type || 'Locatie'),
        address:source ? source.url : addressText(data),
        website:source?.url || '', image,
        toggle:()=>{expanded=!expanded;page=0;show();},
        addLink:async()=>{
          const url=window.prompt('Koppel een website aan deze locatie (https://)');
          if(url===null)return;
          try {await addPrivateWebSource(store,item.id,url);expanded=true;page=0;show();}
          catch(error){window.alert(error.message);}
        },
        setImage:async()=>{
          const url=window.prompt('Afbeelding-URL (https://)',image);
          if(url===null)return;
          if(url.trim() && !/^https:\/\/[^\s]+$/i.test(url.trim())){window.alert('Gebruik een https://-URL');return;}
          await store.put('meta',{key:IMAGE_KEY+item.id,value:url.trim()});show();
        }
      },
      onNext:()=>{
        if(expanded){page=(page+1)%(sources.length+1);}
        else {index=(index+1)%places.length;onLocation?.(current());}
        show();
      },
      onPrevious:()=>{
        if(expanded){page=(page+sources.length)%(sources.length+1);}
        else {index=(index-1+places.length)%places.length;onLocation?.(current());}
        show();
      },
      onClose:()=>{closeViewer=null;disposed=true;onClose?.();}
    });
  };
  show();
  return ()=>{disposed=true;++sequence;closeViewer?.();};
}
