import { mountChainZonePanel } from './ChainZonePanel.js?v=0.3.93';
import { openCardShare } from './CardSharing.js?v=0.3.93';
import { renderCardCode } from './CardCodes.js?v=0.3.93';
import { wrapBoardSurface } from './BoardChrome.js?v=0.3.93';
import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.3.93';
import { createCardDeck,cardDistanceLabel } from '../core/cards/CardDeck.js?v=0.3.93';
import { cardSymbol } from './CardSymbols.js?v=0.3.93';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={loyalty:'Klantenpas',membership:'Lidmaatschap',access:'Toegangspas',ticket:'Ticket',other:'Overige kaart'};

export function openCardBoard(card,{cards=[],locations=[],store,location,events,onActiveCard=()=>{},onClose=()=>{}}={}) {
  const model=createCardDeck(card,cards,locations);
  const layer=document.createElement('div');layer.className='sh-card-board-overlay';
  const nodes=model.state.boards.map(entry=>{
    const current=entry.card,kind=labels[current.cardKind]||labels.other;
    const board=document.createElement('section');board.className='sh-card-board sh-card-deck-board';board.dataset.cardBoard='';
    board.tabIndex=-1;
    board.dataset.codeType=current.codeFormat==='QR_CODE'?'qr':current.codeFormat?'barcode':'empty';
    board.dataset.cardId=current.id;board.dataset.detailIndex=String(entry.page);
    board.setAttribute('aria-label','Kaart '+current.name);
    board.innerHTML='<div class="sh-card-board-accent" data-card-accent></div>'+
      '<div class="sh-card-media sh-board-photo-header" data-card-media>'+
        '<button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button>'+
        '<div class="sh-card-board-code" data-code></div>'+
        '<button type="button" class="sh-card-deck-grab sh-board-compass" data-deck-grab aria-label="Swipe naar rechts om de boards te verzamelen en sleep daarna het deck" aria-pressed="false"><span data-deck-start aria-hidden="true"></span><span data-distance></span><svg data-deck-icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="3"/><path d="M7 3h10a3 3 0 0 1 3 3v11"/></svg></button>'+
        '<span class="sh-card-kind-badge sh-board-photo-source" data-card-kind role="img" aria-label="'+esc(kind)+'" title="'+esc(kind)+'">'+cardSymbol(current.cardKind)+'</span>'+
      '<button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van codevlak en informatie aanpassen"></button>'+
      '</div>'+
      '<div data-details class="sh-card-board-details sh-board-scroller"><div class="sh-card-detail-heading"><h2 data-card-title>'+esc(current.name)+'</h2></div>'+
      entry.rows.map(field=>'<div class="sh-card-board-detail-row"><span>'+esc(field.label)+'</span><strong>'+esc(field.value)+'</strong></div>').join('')+'</div>';
    if (current.reference?.url) {
      try {
        const url = new URL(current.reference.url);
        if (url.protocol === 'https:' && !url.username && !url.password) {
          const source = document.createElement('a');
          source.href = url.href;
          source.target = '_blank';
          source.rel = 'noopener noreferrer sponsored';
          source.className = 'sh-ticket-source-link';
          source.textContent = 'Bekijk op ' + (current.reference.label || 'de bron') + ' ↗';
          source.title = 'Affiliatelink';
          board.querySelector('.sh-card-detail-heading').append(source);
        }
      } catch {}
    }
    board.querySelector('[data-card-accent]').style.background=/^#[0-9a-f]{6}$/i.test(current.color||'')?current.color:'#489ff8';
    return board;
  });
  const stack=wrapBoardSurface(layer,nodes[0]);stack.classList.add('sh-card-deck-stack','sh-card-zone-stack');
  stack.querySelector('.sh-board-deck').remove();stack.append(...nodes.slice(1));
  let closed=false,renderedCard='',gestures=null,closeShare=null;
  if(store)nodes.forEach((board,index)=>{
    const button=document.createElement('button');button.type='button';button.dataset.shareCard='';button.className='sh-card-share-button';button.textContent='Deel met personen';
    button.addEventListener('click',()=>{closeShare?.();closeShare=openCardShare(model.state.boards[index].card,{store,onClose:()=>{closeShare=null;button.focus();}});});
    board.querySelector('.sh-card-detail-heading').append(button);
  });
  let activeChainPanel=-1,stopChainPanel=null;
  const ensureChainPanel=index=>{
    if(activeChainPanel===index)return;
    stopChainPanel?.();stopChainPanel=null;activeChainPanel=index;
    const current=model.state.boards[index].card;
    if(!store||!current.chainId)return;
    let panel=nodes[index].querySelector('[data-chain-panel]');
    if(!panel){panel=document.createElement('div');panel.dataset.chainPanel='';nodes[index].querySelector('[data-details]').append(panel);}
    stopChainPanel=mountChainZonePanel(panel,{card:current,store,location,events});
  };
  const renderCode=(board,current)=>{
    if(board.dataset.codeReady)return;board.dataset.codeReady='true';
    const holder=document.createElement('div');board.querySelector('[data-code]').append(holder);
    if(current.codeValue&&current.codeFormat)renderCardCode(holder,current.codeFormat,current.codeValue,{fullWidth:true}).catch(error=>{if(!closed&&holder.isConnected)holder.textContent=error.message;});
    else holder.textContent=current.reference ? 'Nog geen toegangsbewijs. Voeg na aankoop je ticketcode toe.' : 'Geen scanbare code opgeslagen.';
  };
  const distances=()=>nodes.forEach((node,index)=>{
    const text=cardDistanceLabel(model.state.boards[index].card,locations,location?.latest);
    node.querySelector('[data-distance]').textContent=text;
    node.querySelector('[data-distance]').hidden=!text;
    node.querySelector('[data-deck-start]').hidden=Boolean(text);
    node.querySelector('[data-deck-grab]').classList.toggle('is-without-location',!text);
    node.querySelector('[data-deck-icon]').toggleAttribute('hidden',Boolean(text));
    node.querySelector('[data-deck-grab]').setAttribute('aria-label',(text?text+'. ':'')+'Swipe naar rechts om de boards te verzamelen en sleep daarna het deck');
  });
  const draw=()=>{
    const state=model.state;
    nodes.forEach((node,index)=>{
      const offset=(index-state.boardIndex+nodes.length)%nodes.length,active=offset===0;
      node.hidden=offset>2;node.inert=!active;node.setAttribute('aria-hidden',String(!active));
      if(active){node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');}
      else {node.removeAttribute('role');node.removeAttribute('aria-modal');}
      node.dataset.depth=String(offset);node.style.zIndex=String(3-offset);
      if(offset>=0&&offset<=2)renderCode(node,state.boards[index].card);
    });
    ensureChainPanel(state.boardIndex);
    distances();
    if(renderedCard!==state.card.id){renderedCard=state.card.id;onActiveCard(state.card);}
    gestures?.refresh();
  };
  const swipe=direction=>{
    const focused=nodes[model.state.boardIndex].contains(document.activeElement),state=model.swipe(direction);draw();
    if(focused)nodes[state.boardIndex].focus({preventScroll:true});
  };
  const close=()=>{if(closed)return;closed=true;stopChainPanel?.();closeShare?.();gestures?.dispose();offLocation?.();clearInterval(distanceTimer);window.removeEventListener('keydown',key);layer.remove();onClose();};
  const key=event=>{
    if(event.defaultPrevented||document.querySelector('.sh-card-share-overlay'))return;
    if(event.key==='Escape'){event.preventDefault();close();}
    if(event.key==='ArrowLeft'){event.preventDefault();swipe(1);}
    if(event.key==='ArrowRight'){event.preventDefault();swipe(-1);}
  };
  layer.addEventListener('click',event=>{if(event.target===layer)close();});
  layer.addEventListener('sharon:close-board',close);
  gestures=bindBoardDeckGestures(stack,{onSwipe:swipe,onClose:close,layoutStore:store});
  const offLocation=events?.on('location.changed',distances);
  // Refresh the label's age without requesting any GPS measurements.
  const distanceTimer=setInterval(distances,15_000);
  window.addEventListener('keydown',key);document.body.append(layer);draw();
  nodes[model.state.boardIndex].focus({preventScroll:true});
  return close;
}
