import { mountChainZonePanel } from './ChainZonePanel.js?v=0.4.42';
import { renderCardCode } from './CardCodes.js?v=0.4.42';
import { wrapBoardSurface } from './BoardChrome.js?v=0.4.42';
import { bindBoardDeckGestures } from './BoardDeckGestures.js?v=0.4.42';
import { createCardDeck,cardDistanceLabel } from '../core/cards/CardDeck.js?v=0.4.42';
import { cardSymbol, applyCardAppearance } from './CardSymbols.js?v=0.4.42';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={loyalty:'Klantenpas',membership:'Lidmaatschap',access:'Toegangspas',ticket:'Ticket',other:'Overige kaart'};

export function openCardBoard(card,{cards=[],locations=[],store,location,events,onActiveCard=()=>{},onEdit=null,onClose=()=>{}}={}) {
  const model=createCardDeck(card,cards,locations);
  const layer=document.createElement('div');layer.className='sh-card-board-overlay';
  const nodes=model.state.boards.map(entry=>{
    const current=entry.card,kind=labels[current.cardKind]||labels.other;
    const board=document.createElement('section');board.className='sh-card-board sh-card-deck-board';board.dataset.cardBoard='';
    board.tabIndex=-1;
    board.dataset.codeType=current.codeValue&&current.codeFormat?(current.codeFormat==='QR_CODE'?'qr':'barcode'):'empty';
    board.dataset.cardId=current.id;board.dataset.detailIndex=String(entry.page);
    board.setAttribute('aria-label','Kaart '+current.name);
    board.innerHTML='<div class="sh-card-board-accent" data-card-accent></div>'+
      '<div class="sh-card-media sh-board-photo-header" data-card-media>'+
        '<button type="button" class="sh-board-resizer" data-deck-size="board" aria-label="Hoogte van board aanpassen"></button>'+
        '<h2 class="sh-card-face-title" data-card-title>'+esc(current.name)+'</h2>'+
        '<div class="sh-card-board-code" data-code></div>'+
        '<span class="sh-card-location-pin" data-card-location-pin role="img" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>'+
        '<button type="button" class="sh-card-deck-grab sh-board-compass" data-deck-grab aria-label="Swipe naar rechts om de boards te verzamelen en sleep daarna het deck" aria-pressed="false"><span data-deck-start aria-hidden="true"></span><span data-distance></span><svg data-deck-icon viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="7" width="13" height="14" rx="3"/><path d="M7 3h10a3 3 0 0 1 3 3v11"/></svg></button>'+
        '<span class="sh-card-kind-badge sh-board-photo-source" data-card-kind role="img" aria-label="'+esc(kind)+'" title="'+esc(kind)+'">'+cardSymbol(current.cardKind)+'</span>'+
      '<button type="button" class="sh-board-resizer" data-deck-size="media" aria-label="Hoogte van codevlak en informatie aanpassen"></button>'+
      '</div>'+
      '<div data-details class="sh-card-board-details sh-board-scroller"><div class="sh-card-detail-heading"></div>'+
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
    const appearance=applyCardAppearance(board.querySelector('[data-card-kind]'),current.color);
    board.querySelector('[data-card-accent]').style.background=appearance.background;
    board.querySelector('[data-card-title]').title=current.name;
    const media=board.querySelector('[data-card-media]');media.style.setProperty('--card-face-color',appearance.background);media.style.setProperty('--card-face-ink',appearance.foreground);
    const linked=locations.find(item=>item.id===current.locationId&&!item.deletedAt&&!item.archivedAt&&item.status!=='archived');
    const pin=board.querySelector('[data-card-location-pin]');pin.hidden=!linked;
    if(linked){pin.setAttribute('aria-label','Locatie: '+(linked.data?.title||'Gekoppelde locatie'));pin.title=pin.getAttribute('aria-label');}

    return board;
  });
  const stack=wrapBoardSurface(layer,nodes[0]);stack.classList.add('sh-card-deck-stack','sh-card-zone-stack');
  stack.querySelector('.sh-board-deck').remove();stack.append(...nodes.slice(1));
  let closed=false,renderedCard='',gestures=null;
  const fitTitles=()=>nodes.forEach(node=>{
    if(node.dataset.codeType!=='qr'||node.hidden)return;
    const title=node.querySelector('[data-card-title]'),media=node.querySelector('[data-card-media]');
    if(media.clientHeight>120)title.style.width=(media.clientHeight-120)+'px';
    let fontSize=15;title.style.fontSize=fontSize+'px';
    if(media.clientWidth>0&&media.clientHeight>120){
      const maxBand=(media.clientWidth-Math.min(120,media.clientHeight-88))/2-8;
      while(Math.max(title.scrollHeight,title.offsetHeight)+24>maxBand&&fontSize>10){fontSize-=0.5;title.style.fontSize=fontSize+'px';}
    }
    const bandPx=Math.max(66,Math.ceil(Math.max(title.scrollHeight,title.offsetHeight))+24),band=bandPx+'px';
    title.style.left=(bandPx/2)+'px';
    if(media.style.getPropertyValue('--qr-title-band')!==band)media.style.setProperty('--qr-title-band',band);
    // An explicit square avoids WebKit's circular percentage/aspect-ratio grid sizing.
    const size=Math.floor(Math.min(media.clientWidth-2*(bandPx+8),media.clientHeight-88));
    if(size>0&&media.style.getPropertyValue('--card-qr-size')!==size+'px')media.style.setProperty('--card-qr-size',size+'px');
  });
  const titleObserver=window.ResizeObserver?new window.ResizeObserver(fitTitles):null;
  nodes.forEach(node=>{titleObserver?.observe(node.querySelector('[data-card-title]'));titleObserver?.observe(node.querySelector('[data-card-media]'));});
  window.addEventListener('resize',fitTitles);
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
    else {
      const message=document.createElement('span');message.textContent=current.reference?'Nog geen toegangsbewijs. Voeg na aankoop je ticketcode toe.':'Nog geen code opgeslagen';holder.append(message);
      if(onEdit){const add=document.createElement('button');add.type='button';add.textContent='Code toevoegen';add.dataset.addCardCode='';add.addEventListener('click',()=>{close();onEdit(current.id);});holder.append(add);}
    }
  };
  const distances=()=>nodes.forEach((node,index)=>{
    const current=model.state.boards[index].card,label=cardDistanceLabel(current,locations,location?.latest);
    const text=label===current.name?'':label.startsWith(current.name+' · ')?label.slice(current.name.length+3):label;
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
    gestures?.refresh();fitTitles();
  };
  const swipe=direction=>{
    const focused=nodes[model.state.boardIndex].contains(document.activeElement),state=model.swipe(direction);draw();
    if(focused)nodes[state.boardIndex].focus({preventScroll:true});
  };
  const close=()=>{if(closed)return;closed=true;titleObserver?.disconnect();window.removeEventListener('resize',fitTitles);stopChainPanel?.();gestures?.dispose();offLocation?.();clearInterval(distanceTimer);window.removeEventListener('keydown',key);layer.remove();onClose();};
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
