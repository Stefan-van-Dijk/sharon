// Wikipedia articles are read into plain text/image data; never inject article HTML.
const wikiHosts = /^[a-z-]+\.wikipedia\.org$/i;
const imageHosts = /^(?:upload\.wikimedia\.org)$/i;
function safeUrl(value, image = false) {
  try {
    const url = new URL(value, 'https://nl.wikipedia.org');
    if (url.protocol !== 'https:' || !(image ? imageHosts : wikiHosts).test(url.hostname)) return '';
    if (image && /\.(svg|gif)(?:$|\?)/i.test(url.pathname)) return '';
    return url.href;
  } catch { return ''; }
}
export function distanceBearing(start, end) {
  if (!start || !end) return null;
  const values = [start.lat, start.lng, end.lat, end.lng].map(Number);
  if (values.some(x => !Number.isFinite(x))) return null;
  const [la, lo, lb, ln] = values.map(x => x * Math.PI / 180);
  const delta = ln-lo;
  const y = Math.sin(delta)*Math.cos(lb);
  const x = Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(delta);
  const hav = Math.sin((lb-la)/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(delta/2)**2;
  return { distance: 12742000*Math.asin(Math.min(1,Math.sqrt(hav))),
    bearing: (Math.atan2(y,x)*180/Math.PI+360)%360 };
}
export function sectionsFromWikipediaHtml(html, fallback = {}) {
  const first = { title: fallback.title || 'Verhaal', text: '', image: safeUrl(fallback.image, true) };
  if (typeof DOMParser === 'undefined') return [{ ...first, text: fallback.description || '' }];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('.mw-parser-output') || doc.body;
  const sections = [first];
  let current = first, count = 0;
  for (const el of root.querySelectorAll('h2,h3,p,figure,.thumb')) {
    if (el.closest('table,nav,aside,.reflist,.reference')) continue;
    if (el.matches('h2,h3')) {
      const title = el.textContent.replace(/\[.*?\]/g,'').trim();
      if (/^(referenties|bronnen|externe links|references|notes|see also)$/i.test(title)) break;
      if (!title || sections.length >= 15) continue;
      current = { title, text: '', image: '' };
      sections.push(current);
    } else if (el.matches('p')) {
      const paragraph = el.textContent.replace(/\[\d+[a-z]?\]/gi,'').replace(/\s+/g,' ').trim();
      if (paragraph.length < 35 || count++ >= 55) continue;
      current.text += (current.text ? '\n\n' : '') + paragraph;
    } else if (!current.image) {
      const img = el.querySelector('img');
      const src = safeUrl(img?.getAttribute('src') || '', true);
      if (src) current.image = src;
    }
  }
  if (!first.text) first.text = fallback.description || '';
  return sections.filter(x => x.text || x.image);
}
export async function fetchWikipediaBoard(feature, { signal, fetcher = fetch } = {}) {
  const article = safeUrl(feature?.properties?.url);
  if (!article) throw Error('Geen Wikipedia-artikel gevonden.');
  const parsed = new URL(article);
  const id = Number(parsed.searchParams.get('curid'));
  if (!Number.isSafeInteger(id) || id <= 0) throw Error('Ongeldig Wikipedia-artikel.');
  const query = new URLSearchParams({ action:'parse', pageid:String(id), prop:'text', format:'json', formatversion:'2', origin:'*' });
  const response = await fetcher(parsed.origin+'/w/api.php?'+query, {signal});
  if (!response.ok) throw Error('Wikipedia is momenteel niet bereikbaar.');
  const json = await response.json();
  if (!json.parse?.text) throw Error('Geen verhaal beschikbaar.');
  return sectionsFromWikipediaHtml(json.parse.text, feature.properties);
}
export function openBoardViewer(feature, { location, events, onNext } = {}) {
  const abort = new AbortController();
  let closed = false, heading = null, gps = location?.latest || null;
  const coords = feature?.geometry?.coordinates;
  const destination = coords?.length === 2 ? {lat:coords[1],lng:coords[0]} : null;
  const overlay = document.createElement('section');
  overlay.className='sh-board-overlay';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Verhaal');
  const header = document.createElement('header');
  header.className='sh-board-header';
  const back = document.createElement('button');
  back.type='button'; back.textContent='‹'; back.setAttribute('aria-label','Sluit verhaal');
  const brand = document.createElement('strong'); brand.textContent='Boards';
  header.append(back,brand);
  const scroller = document.createElement('div'); scroller.className='sh-board-scroller';
  const list = document.createElement('article'); list.className='sh-board-story';
  const status=document.createElement('p'); status.textContent='Verhaal laden…'; list.append(status);
  const source=document.createElement('a'); source.textContent='Lees op Wikipedia ↗';
  source.href=safeUrl(feature?.properties?.url);
  source.target='_blank'; source.rel='noopener noreferrer'; source.className='sh-board-source';
  const credits=document.createElement('small');
  credits.textContent='Tekst: Wikipedia (CC BY-SA). Afbeeldingen: Wikimedia Commons; licenties verschillen per afbeelding.';
  list.append(source,credits); scroller.append(list); overlay.append(header,scroller);
  document.body.append(overlay);
  const compasses=[];
  const update=()=>{
    const result=distanceBearing(gps,destination);
    for(const c of compasses) {
      c.distance.textContent=result?(result.distance < 1000?Math.round(result.distance)+' m':(result.distance/1000).toFixed(result.distance<10000?1:0)+' km'):'GPS onbekend';
      c.arrow.hidden=!result || heading===null;
      if(result && heading!==null)c.arrow.style.transform='rotate('+((result.bearing-heading+360)%360)+'deg)';
      c.activate.hidden=heading!==null;
    }
  };
  const orient=e=>{
    if(Number.isFinite(e.webkitCompassHeading))heading=e.webkitCompassHeading;
    else if(e.absolute && Number.isFinite(e.alpha))heading=(360-e.alpha)%360;
    else return;
    update();
  };
  window.addEventListener('deviceorientation',orient,{passive:true});
  window.addEventListener('deviceorientationabsolute',orient,{passive:true});
  const unsub=events?.on?.('location.changed',e=>{gps=e.detail;update();});
  const key=e=>{if(e.key==='Escape')close();};
  window.addEventListener('keydown',key);
  const close=()=>{
    if(closed)return;
    closed=true;abort.abort();unsub?.();window.removeEventListener('keydown',key);
    window.removeEventListener('deviceorientation',orient);
    window.removeEventListener('deviceorientationabsolute',orient);
    overlay.remove();
  };
  back.addEventListener('click',close);
  async function permission(){
    try{
      if(typeof DeviceOrientationEvent!=='undefined' && typeof DeviceOrientationEvent.requestPermission==='function'){
        if(await DeviceOrientationEvent.requestPermission()!=='granted')return;
      }
      for(const c of compasses)c.activate.textContent='Richting bepalen…';
    }catch{for(const c of compasses)c.activate.textContent='Kompas niet beschikbaar';}
  }
  function renderSection(section,index){
    const item=document.createElement('section');item.className='sh-board-chapter';
    const imageFrame=document.createElement('div');imageFrame.className='sh-board-image';
    if(section.image){
      const img=document.createElement('img');img.src=section.image;img.alt=section.title;
      img.loading=index?'lazy':'eager';imageFrame.append(img);
    }
    const compass=document.createElement('div');compass.className='sh-board-compass';
    const activate=document.createElement('button');activate.type='button';activate.setAttribute('aria-label','Kompas activeren');
    const arrow=document.createElement('span');arrow.textContent='➤';arrow.className='sh-board-arrow';
    const label=document.createElement('span');label.textContent='Kompas';label.className='sh-board-activate';
    activate.append(arrow,label);activate.addEventListener('click',permission);
    const distance=document.createElement('small');compass.append(activate,distance);
    imageFrame.append(compass);compasses.push({arrow,activate:label,distance});
    const title=document.createElement(index?'h3':'h2');title.textContent=section.title;
    const text=document.createElement('p');text.textContent=section.text;
    item.append(imageFrame,title,text);list.insertBefore(item,source);
  }
  fetchWikipediaBoard(feature,{signal:abort.signal}).then(chapters=>{
    if(closed)return;
    status.remove();
    if(!chapters.length)throw Error('Geen leesbare inhoud.');
    chapters.forEach(renderSection);
    update();
  }).catch(error=>{if(!closed)status.textContent=error.message;});
  return close;
}
