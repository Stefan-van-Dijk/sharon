import { renderCardCode } from './CardCodes.js?v=0.3.65';
import { wrapBoardSurface } from './BoardChrome.js?v=0.3.65';
import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.3.65';
import { createCardDeck } from '../core/cards/CardDeck.js?v=0.3.65';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={loyalty:'Klantenpas',membership:'Lidmaatschap',access:'Toegangspas',ticket:'Ticket',other:'Overige kaart'};

export function openCardBoard(card,{cards=[],locations=[],store,onActiveCard=()=>{},onClose=()=>{}}={}) {
  const model=createCardDeck(card,cards,locations);
  const layer=document.createElement('div');layer.className='sh-card-board-overlay';
  layer.innerHTML='<section class="sh-card-board sh-card-deck-board" role="dialog" aria-modal="true">'+
    '<div class="sh-card-board-accent" data-card-accent></div>'+
    '<div class="sh-card-media" data-card-media>'+
      '<button type="button" class="sh-board-close sh-card-media-close" data-close aria-label="Sluiten">×</button>'+
      '<div class="sh-card-board-code" data-code></div>'+
      '<div class="sh-card-media-controls">'+
        '<button type="button" class="sh-card-deck-grab" data-deck-grab aria-label="Swipe om te wisselen; houd vast om het deck te verplaatsen" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="13" height="15" rx="3"/><path d="M8 2h10a3 3 0 0 1 3 3v11M8 10h5m-5 4h5"/></svg><span data-deck-position></span></button>'+
        '<span class="sh-card-kind-badge" data-card-kind></span>'+
      '</div>'+
    '</div>'+
    '<button type="button" data-expand class="sh-card-board-handle" aria-expanded="false"><span class="sh-card-board-grip"></span><span data-hint>Meer informatie</span></button>'+
    '<div data-details class="sh-card-board-details" hidden><div class="sh-card-detail-heading"><h2 data-card-title></h2><small data-detail-position></small></div><div data-detail-rows></div></div>'+
    '</section>';
  const board=layer.querySelector('.sh-card-board'),stack=wrapBoardSurface(layer,board);
  stack.classList.add('sh-card-deck-stack');
  const code=layer.querySelector('[data-code]'),grab=layer.querySelector('[data-deck-grab]');
  let closed=false,renderedCard='',gestures=null;
  const draw=()=>{
    const state=model.state,current=state.card;
    board.setAttribute('aria-label','Kaart '+current.name);
    board.dataset.cardId=current.id;board.dataset.detailIndex=String(state.page);
    board.classList.toggle('is-expanded',state.expanded);
    const color=/^#[0-9a-f]{6}$/i.test(current.color||'')?current.color:'#489ff8';
    layer.querySelector('[data-card-accent]').style.background=color;
    layer.querySelector('[data-card-kind]').textContent=labels[current.cardKind]||labels.other;
    layer.querySelector('[data-card-title]').textContent=current.name;
    layer.querySelector('[data-details]').hidden=!state.expanded;
    layer.querySelector('[data-expand]').setAttribute('aria-expanded',String(state.expanded));
    layer.querySelector('[data-hint]').textContent=state.expanded?'Minder informatie':'Meer informatie';
    const count=state.expanded?state.pages.length:state.cards.length,index=state.expanded?state.page:state.index;
    layer.querySelector('[data-deck-position]').textContent=`${index+1} / ${count}`;
    layer.querySelector('[data-detail-position]').textContent=state.pages.length>1?`Informatie ${state.page+1} / ${state.pages.length}`:'';
    layer.querySelector('[data-detail-rows]').innerHTML=state.pages[state.page].map(field=>'<div class="sh-card-board-detail-row"><span>'+esc(field.label)+'</span><strong>'+esc(field.value)+'</strong></div>').join('');
    if(renderedCard!==current.id){
      renderedCard=current.id;
      // A separate host per card prevents a late generator from replacing the next card's code.
      const holder=document.createElement('div');code.replaceChildren(holder);
      if(current.codeValue&&current.codeFormat){
        renderCardCode(holder,current.codeFormat,current.codeValue).catch(error=>{if(!closed&&holder.isConnected)holder.textContent=error.message;});
      }else holder.textContent='Geen scanbare code opgeslagen.';
      onActiveCard(current);
    }
    gestures?.refresh();
  };
  const expand=value=>{model.expand(value);draw();};
  const swipe=direction=>{model.swipe(direction);draw();};
  const close=()=>{if(closed)return;closed=true;gestures?.dispose();window.removeEventListener('keydown',key);layer.remove();onClose();};
  const key=event=>{
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='ArrowLeft'){event.preventDefault();swipe(1);}
    if(event.key==='ArrowRight'){event.preventDefault();swipe(-1);}
    if(event.key==='ArrowUp'){event.preventDefault();expand(true);}
    if(event.key==='ArrowDown'){event.preventDefault();if(model.state.expanded)expand(false);else close();}
  };
  layer.querySelector('[data-close]').addEventListener('click',close);
  layer.querySelector('[data-expand]').addEventListener('click',()=>expand(!model.state.expanded));
  grab.addEventListener('click',()=>expand(!model.state.expanded));
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  gestures=bindBoardDeckGestures(board,stack,grab,{onSwipe:swipe,onExpand:()=>expand(true),onCollapse:()=>{if(model.state.expanded)expand(false);else close();},layoutStore:store});
  window.addEventListener('keydown',key);document.body.append(layer);draw();
  layer.querySelector('[data-close]').focus({preventScroll:true});
  return close;
}
