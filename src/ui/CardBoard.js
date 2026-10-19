import { renderCardCode } from './CardCodes.js?v=0.3.66';
import { wrapBoardSurface } from './BoardChrome.js?v=0.3.66';
import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.3.66';
import { createCardDeck,cardDistanceLabel } from '../core/cards/CardDeck.js?v=0.3.66';
import { cardSymbol } from './CardSymbols.js?v=0.3.66';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={loyalty:'Klantenpas',membership:'Lidmaatschap',access:'Toegangspas',ticket:'Ticket',other:'Overige kaart'};

export function openCardBoard(card,{cards=[],locations=[],store,location,events,onActiveCard=()=>{},onClose=()=>{}}={}) {
  const model=createCardDeck(card,cards,locations);
  const layer=document.createElement('div');layer.className='sh-card-board-overlay';
  const nodes=model.state.boards.map(entry=>{
    const current=entry.card,kind=labels[current.cardKind]||labels.other;
    const board=document.createElement('section');board.className='sh-card-board sh-card-deck-board';board.dataset.cardBoard='';
    board.dataset.cardId=current.id;board.dataset.detailIndex=String(entry.page);
    board.setAttribute('aria-label','Kaart '+current.name);
    board.innerHTML='<div class="sh-card-board-accent" data-card-accent></div>'+
      '<button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button>'+
      '<div class="sh-card-media sh-board-photo-header" data-card-media>'+
        '<button type="button" class="sh-board-close sh-card-media-close" data-close aria-label="Sluiten">×</button>'+
        '<div class="sh-card-board-code" data-code></div>'+
        '<button type="button" class="sh-card-deck-grab sh-board-compass" data-deck-grab aria-label="Swipe naar rechts om de boards te verzamelen en sleep daarna het deck" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="3"/><path d="M7 3h10a3 3 0 0 1 3 3v11"/></svg><span data-distance></span></button>'+
        '<span class="sh-card-kind-badge sh-board-photo-source" data-card-kind role="img" aria-label="'+esc(kind)+'" title="'+esc(kind)+'">'+cardSymbol(current.cardKind)+'</span>'+
      '</div>'+
      '<button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van codevlak en informatie aanpassen"></button>'+
      '<div data-details class="sh-card-board-details sh-board-scroller"><div class="sh-card-detail-heading"><h2 data-card-title>'+esc(current.name)+'</h2></div>'+
      entry.rows.map(field=>'<div class="sh-card-board-detail-row"><span>'+esc(field.label)+'</span><strong>'+esc(field.value)+'</strong></div>').join('')+'</div>'+
      '<nav class="sh-card-board-navigation" aria-label="Boards"><button type="button" data-previous aria-label="Vorig board">‹</button><span data-deck-position></span><button type="button" data-next aria-label="Volgend board">›</button></nav>';
    board.querySelector('[data-card-accent]').style.background=/^#[0-9a-f]{6}$/i.test(current.color||'')?current.color:'#489ff8';
    return board;
  });
  const stack=wrapBoardSurface(layer,nodes[0]);stack.classList.add('sh-card-deck-stack','sh-card-zone-stack');
  stack.querySelector('.sh-board-deck').remove();stack.append(...nodes.slice(1));
  let closed=false,renderedCard='',gestures=null;
  const renderCode=(board,current)=>{
    if(board.dataset.codeReady)return;board.dataset.codeReady='true';
    const holder=document.createElement('div');board.querySelector('[data-code]').append(holder);
    if(current.codeValue&&current.codeFormat)renderCardCode(holder,current.codeFormat,current.codeValue).catch(error=>{if(!closed&&holder.isConnected)holder.textContent=error.message;});
    else holder.textContent='Geen scanbare code opgeslagen.';
  };
  const distances=()=>nodes.forEach((node,index)=>{
    node.querySelector('[data-distance]').textContent=cardDistanceLabel(model.state.boards[index].card,locations,location?.latest);
  });
  const draw=()=>{
    const state=model.state;
    nodes.forEach((node,index)=>{
      const offset=index-state.boardIndex,active=offset===0;
      node.hidden=offset<0||offset>2;node.inert=!active;node.setAttribute('aria-hidden',String(!active));
      if(active){node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');}
      else {node.removeAttribute('role');node.removeAttribute('aria-modal');}
      node.dataset.depth=String(offset);node.style.zIndex=String(3-offset);
      node.querySelector('[data-deck-position]').textContent=`${index+1} / ${nodes.length}`;
      node.querySelector('[data-previous]').disabled=index===0;node.querySelector('[data-next]').disabled=index===nodes.length-1;
      if(offset>=0&&offset<=2)renderCode(node,state.boards[index].card);
    });
    distances();
    if(renderedCard!==state.card.id){renderedCard=state.card.id;onActiveCard(state.card);}
    gestures?.refresh();
  };
  const swipe=direction=>{
    const focused=nodes[model.state.boardIndex].contains(document.activeElement),state=model.swipe(direction);draw();
    if(focused)nodes[state.boardIndex].querySelector('[data-close]').focus({preventScroll:true});
  };
  const close=()=>{if(closed)return;closed=true;gestures?.dispose();offLocation?.();clearInterval(distanceTimer);window.removeEventListener('keydown',key);layer.remove();onClose();};
  const key=event=>{
    if(event.defaultPrevented)return;
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='ArrowLeft'){event.preventDefault();swipe(1);}
    if(event.key==='ArrowRight'){event.preventDefault();swipe(-1);}
  };
  nodes.forEach(node=>{
    node.querySelector('[data-close]').addEventListener('click',close);
    node.querySelector('[data-previous]').addEventListener('click',()=>swipe(-1));
    node.querySelector('[data-next]').addEventListener('click',()=>swipe(1));
  });
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  gestures=bindBoardDeckGestures(stack,{onSwipe:swipe,onClose:close,layoutStore:store});
  const offLocation=events?.on('location.changed',distances);
  // Refresh the label's age without requesting any GPS measurements.
  const distanceTimer=setInterval(distances,15_000);
  window.addEventListener('keydown',key);document.body.append(layer);draw();
  nodes[model.state.boardIndex].querySelector('[data-close]').focus({preventScroll:true});
  return close;
}
