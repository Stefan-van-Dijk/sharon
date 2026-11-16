import {bindNotesBoard} from './ShopPairing.js?v=0.4.95';
import {renderListControls} from './ListControls.js?v=0.4.95';
import {renderObjectStrip} from './ObjectStrip.js?v=0.4.95';
import {sortList} from '../core/storage/ListOrder.js?v=0.4.95';
import {wrapBoardSurface} from './BoardChrome.js?v=0.4.95';
import {bindBoardDeckGestures} from './BoardDeckGestures.js?v=0.4.95';

// Same board shell and people strips as card sharing; grants stay list-specific.
export function openListShare(list,{store,api,onOpen,onClose=()=>{}}){
 const previous=document.activeElement,layer=document.createElement('div');layer.className='sh-card-share-overlay';
 layer.innerHTML='<section class="sh-card-share-dialog sh-share-board sh-list-share" role="dialog" aria-modal="true" aria-label="Lijst delen" tabindex="-1" data-card-board><div class="sh-share-fixed sh-card-media" data-card-media><button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button><header class="sh-notes-brand"><strong class="sh-notes-wordmark">ShopList.</strong><h2></h2></header><button type="button" class="sh-card-deck-grab" data-deck-grab aria-label="Deelboard verplaatsen"><span data-deck-start aria-hidden="true"></span>Deel lijst</button><button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van informatie aanpassen"></button></div><div class="sh-share-board-info"><div data-share-toolbar></div><label class="sh-list-share-role">Toegang voor geselecteerde personen<select aria-label="Toegang"><option value="read">Bekijken</option><option value="write">Bewerken</option><option value="">Toegang intrekken</option></select></label><div data-share-people></div><button type="button" data-share-send disabled>Deel met geselecteerde personen</button><p role="status">Contacten laden…</p></div></section>';
 const surface=layer.firstElementChild,stack=wrapBoardSurface(layer,surface);stack.classList.add('sh-share-zone-stack');surface.querySelector('h2').textContent=list.name;
 const toolbar=layer.querySelector('[data-share-toolbar]');toolbar.innerHTML=renderListControls({placeholder:'Zoek persoon',sort:'alpha'});toolbar.querySelector('[data-list-sort="custom"]').remove();
 const search=toolbar.querySelector('input'),people=layer.querySelector('[data-share-people]'),send=layer.querySelector('[data-share-send]'),role=layer.querySelector('select'),status=layer.querySelector('[role=status]');
 let disposed=false,busy=false,contacts=[],members={},sort='alpha',gestures,releaseHeader;
 const categoryBox=document.createElement('fieldset');categoryBox.className='sh-list-share-categories';categoryBox.innerHTML='<legend>Deel de hele lijst of gekozen categorieën</legend>';
 const scopeSelect=document.createElement('select');scopeSelect.setAttribute('aria-label','Inhoud delen');scopeSelect.innerHTML='<option value="all">Hele lijst</option><option value="categories">Gekozen categorieën · bekijken</option>';
 const categoryChoices=document.createElement('div');categoryChoices.hidden=true;categoryBox.append(scopeSelect,categoryChoices);role.closest('label').before(categoryBox);
 const categoryScope=()=>scopeSelect.value==='categories'?[...categoryChoices.querySelectorAll('input:checked')].map(x=>x.value):null;
 const updateScope=()=>{categoryChoices.hidden=scopeSelect.value!=='categories';if(scopeSelect.value==='categories')role.value='read';role.disabled=busy||scopeSelect.value==='categories';paint();};
 scopeSelect.onchange=updateScope;categoryChoices.onchange=updateScope;const selected=new Set();
 const close=()=>{if(disposed)return;disposed=true;gestures?.dispose();releaseHeader?.();layer.remove();previous?.focus();onClose();};
 function paint(){
  if(disposed)return;people.replaceChildren();const q=search.value.trim().toLocaleLowerCase('nl');
  for(const c of sortList(contacts.map(c=>({...c,id:c.personId})),{sort}).filter(c=>c.name.toLocaleLowerCase('nl').includes(q))){
   const row=document.createElement('div');row.className='sh-share-person-row';row.innerHTML=renderObjectStrip({module:'persons',id:c.personId,title:c.name,subtitle:members[c.personId]==='write'?'Kan bewerken':members[c.personId]==='read'?'Kan bekijken':'Nog niet gedeeld',actions:[],trailingHtml:'<span aria-hidden="true">'+(selected.has(c.personId)?'✓':'+')+'</span>'});
   const button=row.querySelector('[data-swipe-surface]');button.setAttribute('aria-pressed',String(selected.has(c.personId)));button.disabled=busy;button.onclick=()=>{selected.has(c.personId)?selected.delete(c.personId):selected.add(c.personId);paint();};people.append(row);
  }
  if(!people.children.length){const empty=document.createElement('p');empty.textContent=contacts.length?'Geen passende personen.':'Verbind eerst een persoon in Sharon.';people.append(empty);}
  send.disabled=busy||!selected.size||(categoryScope()!==null&&!categoryScope().length);role.disabled=busy||scopeSelect.value==='categories';scopeSelect.disabled=busy;categoryChoices.querySelectorAll('input').forEach(x=>x.disabled=busy);send.textContent=(role.value?'Deel met geselecteerde personen':'Trek toegang in')+(selected.size?' ('+selected.size+')':'');
 }
 search.oninput=paint;role.onchange=paint;toolbar.querySelectorAll('[data-list-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.listSort;toolbar.querySelectorAll('[data-list-sort]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));paint();});
 send.onclick=async()=>{if(busy||!selected.size)return;busy=true;const grant=role.value||null,ids=[...selected],categories=categoryScope();paint();let completed=0;try{for(const id of ids){if(disposed)break;await api.share(list.id,id,grant,...(categories===null?[]:[categories]));members[id]=grant;selected.delete(id);completed++;}if(!disposed)status.textContent=grant?'Toegang bijgewerkt voor '+completed+' personen.':'Toegang ingetrokken voor '+completed+' personen.';}catch(e){if(!disposed)status.textContent=completed+' bijgewerkt. '+e.message+' Niet-bijgewerkte personen blijven geselecteerd.';}finally{busy=false;paint();}};
layer.onclick=e=>{if(e.target===layer)close();};layer.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const focusable=[...surface.querySelectorAll('button,input,select')].filter(x=>!x.disabled&&!x.hidden);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===surface)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
 document.body.append(layer);releaseHeader=bindNotesBoard(surface,surface.querySelector('header'),close,{shop:true,onOpen,gestures:false});gestures=bindBoardDeckGestures(stack,{onClose:close,layoutStore:store,layoutKey:'sharing.board.layout',onGrabSearch:()=>search.focus()});surface.focus();
 (async()=>{try{const response=await api.read(list.id);if(disposed)return;if(response.role!=='owner'){status.textContent='Alleen de eigenaar kan deze lijst delen.';return;}members={...response.list.members};
 for(const c of response.list.payload?.categories||[]){const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.value=c.id;label.append(check,document.createTextNode(c.name));categoryChoices.append(label);}
 scopeSelect.options[1].disabled=response.categorySharing!==true||!categoryChoices.children.length;
 contacts=await api.connection.contacts();if(disposed)return;status.textContent='Selecteer personen en kies hun toegang.';paint();}catch(e){if(!disposed)status.textContent=e.message;}})();
 return close;
}
