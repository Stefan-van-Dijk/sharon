import { getPrivateWebSources, addPrivateWebSource, removePrivateWebSource } from '../core/location/LocationWebSources.js?v=0.2.87';

// A location owns one address Board and any number of private source Boards.
// This surface does not create a second map instance.
export function openLocationDeck({ store, objects, selected, onClose, onLocation, map }) {
  const locations = objects.filter(item => item.type === 'location' && !item.deletedAt && item.data?.coordinates);
  const initial = locations.findIndex(item => String(item.id) === String(selected.properties?.id));
  let index = initial, page = 0, expanded = false, sources = [], disposed = false, imageUrl = '';
  let loadSequence = 0;
  const IMAGE_KEY = 'location.board.image.v1:';
  if (index < 0) return () => {};
  const surface = document.createElement('section');
  surface.className = 'sh-location-deck';
  surface.setAttribute('aria-label','Locatiekaarten');
  surface.style.cssText = 'position:fixed;z-index:10020;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,430px);max-height:76dvh;overflow:auto;border-radius:22px;background:rgba(252,252,252,.96);box-shadow:0 16px 50px #0003;border:1px solid #ddd;backdrop-filter:blur(18px);padding:17px;color:#222;touch-action:pan-y';
  document.body.append(surface);
  let startX = null;
  surface.addEventListener('touchstart', e => { if (!e.target.closest('input,button,a')) startX = e.touches[0].clientX; }, {passive:true});
  surface.addEventListener('touchend', e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX; startX = null;
    if (Math.abs(dx) < 55) return;
    if (expanded) { page = Math.max(0,Math.min(sources.length,page+(dx<0?1:-1))); render(); }
    else changeLocation(dx<0?1:-1);
  }, {passive:true});
  const el = (tag, text, css='') => { const node=document.createElement(tag); node.textContent=text; if(css)node.style.cssText=css; return node; };
  const button = (text, action) => { const node=el('button',text,'border:1px solid #ddd;background:#fff;border-radius:16px;padding:8px 12px;color:inherit;cursor:pointer'); node.type='button';node.addEventListener('click',action);return node; };
  const current = () => locations[index];
  const load = async () => {
    const sequence=++loadSequence, id=current().id;
    const [nextSources, imageRecord]=await Promise.all([getPrivateWebSources(store,id),store.get('meta',IMAGE_KEY+id)]);
    if(disposed || sequence!==loadSequence)return;
    sources=nextSources;imageUrl=typeof imageRecord?.value==='string'?imageRecord.value:'';render();
  };
  const changeLocation = delta => { index=(index+delta+locations.length)%locations.length;page=0;expanded=false;onLocation?.(current());load(); };
  const render = () => {
    if (disposed) return;
    surface.replaceChildren();
    const item=current(), data=item.data||{}, coords=data.coordinates||{};
    const bar=el('div','','display:flex;align-items:center;justify-content:space-between;gap:8px');
    const deckButton=button(expanded?'▤ Deck sluiten':'▤ Deck',()=>{expanded=!expanded;page=0;render();});
    deckButton.style.cssText+=';transition:all .35s ease;order:'+(expanded?'0':'2');
    bar.append(deckButton,el('small',expanded?'DECK':'LOCATIE','letter-spacing:.12em;opacity:.55'),button('✕',()=>{disposed=true;surface.remove();onClose?.();}));
    surface.append(bar);
    const imageFrame=el('div','','position:relative;height:clamp(125px,22vh,210px);margin:12px -4px;border-radius:15px;overflow:hidden;background:linear-gradient(140deg,#c5d3c8,#dce3d6 40%,#b9cdd2 41%,#e8e4d5 65%,#a5b8a9)');
    const img=document.createElement('img');img.alt='Afbeelding van de locatie';img.style.cssText='width:100%;height:100%;object-fit:cover';
    if(imageUrl) img.src=imageUrl;
    else {
      // Use the existing map as an image if the renderer permits canvas capture.
      try { const snapshot=map?.getCanvas()?.toDataURL('image/png'); if(snapshot)img.src=snapshot; } catch {}
    }
    if(img.src)imageFrame.append(img);
    const imageTools=el('div','','position:absolute;right:8px;bottom:8px;display:flex;gap:6px');
    const imageButton=button('Afbeelding',async()=>{
      const value=window.prompt('URL van een afbeelding (https://)',imageUrl);
      if(value===null)return;
      if(value.trim() && (!/^https:\/\/[^\s]+$/i.test(value.trim()) || value.length>2048)) {window.alert('Gebruik een geldige https:// afbeelding-URL.');return;}
      imageUrl=value.trim();await store.put('meta',{key:IMAGE_KEY+current().id,value:imageUrl});render();
    });
    imageTools.append(imageButton);imageFrame.append(imageTools);surface.append(imageFrame);
    if (!expanded || page===0) {
      surface.append(el('div',(data.type||data.locationType||'📍')+'  '+(data.name||data.title||'Locatie'),'font-size:21px;font-weight:600;margin:12px 0 4px'));
      const address=data.address;
      surface.append(el('div',typeof address==='string'?address:(address?.formatted||[address?.street,address?.houseNumber,address?.city].filter(Boolean).join(' ')||'Geen adres ingesteld'),'font-size:13px;opacity:.7;margin-bottom:12px'));
    } else {
      const source=sources[page-1];
      surface.append(el('h3',new URL(source.url).hostname,'margin:16px 0 8px'));
      const link=el('a',source.url,'display:block;overflow-wrap:anywhere;color:#375f86;font-size:13px;margin-bottom:16px');
      link.href=source.url;link.target='_blank';link.rel='noopener noreferrer';surface.append(link);
      surface.append(button('Open webpagina ↗',()=>window.open(source.url,'_blank','noopener,noreferrer')));
      surface.append(button('Verwijder koppeling',async()=>{await removePrivateWebSource(store,item.id,source.id);page=0;await load();}));
    }
    const actions=el('div','','display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:15px;flex-wrap:wrap');
    if(expanded){
      actions.append(button('‹',()=>{page=(page-1+sources.length+1)%(sources.length+1);render();}));
      actions.append(el('small',(page+1)+' / '+(sources.length+1),'opacity:.65'));
      actions.append(button('›',()=>{page=(page+1)%(sources.length+1);render();}));
      actions.append(button('+ Website',()=>{surface.querySelector('input[type=url]')?.focus();}));
      const form=document.createElement('form');form.style.cssText='display:flex;gap:6px;width:100%;margin-top:8px';
      const input=document.createElement('input');input.type='url';input.required=true;input.placeholder='https://website.nl';input.setAttribute('aria-label','Webpagina URL');input.style.cssText='min-width:0;flex:1;padding:10px;border:1px solid #ddd;border-radius:12px';
      const add=button('+ URL',()=>{});add.type='submit';form.append(input,add);
      const status=el('small','','color:#a33;width:100%');
      form.addEventListener('submit',async e=>{e.preventDefault();try{await addPrivateWebSource(store,item.id,input.value);page=0;await load();}catch(error){status.textContent=error.message;}});
      actions.append(form,status);
    }else{
      actions.append(button('‹ Locatie',()=>changeLocation(-1)));
      actions.append(el('small',(sources.length+1)+' Board'+(sources.length?'s':''),'opacity:.65'));
      actions.append(button('Locatie ›',()=>changeLocation(1)));
    }
    surface.append(actions);
  };
  load();
  return () => {disposed=true;surface.remove();};
}
