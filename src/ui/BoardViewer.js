import { informationFeedback } from '../core/information/InformationFeedbackService.js?v=0.4.52';
import { informationReference, wikipediaReference } from '../core/information/InformationItem.js?v=0.4.52';
import { createBoardDeck } from './BoardChrome.js?v=0.4.52';
// Wikipedia articles are read into plain text/image data; never inject article HTML.
const wikiHosts = /^[a-z-]+\.wikipedia\.org$/i;
const imageHosts = /^(?:upload\.wikimedia\.org)$/i;
export function safeUrl(value, image = false) {
  try {
    const raw = String(value || '');
    // MediaWiki sometimes emits root-relative thumb URLs from upload.wikimedia.org.
    const normalized = image && raw.startsWith('/wikipedia/')
      ? 'https://upload.wikimedia.org' + raw
      : raw.startsWith('//') ? 'https:' + raw : raw;
    const url = new URL(normalized, 'https://nl.wikipedia.org');
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
  const extractImage = node => {
    const img = node.matches?.('img') ? node : node.querySelector?.('img');
    if (!img) return '';
    const width = Number(img.getAttribute('width') || img.naturalWidth || 0);
    if (width && width < 95) return '';
    return safeUrl(img.getAttribute('src') || img.getAttribute('data-src') || '', true);
  };
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
      const src = extractImage(img);
      if (src) current.image = src;
    }
  }
  if (!sections.some(section => section.text.trim().length >= 30)) first.text = fallback.description || '';
  // Some articles keep photos in infoboxes or galleries rather than inside
  // the corresponding chapter. Reuse those existing article images in order.
  const used = new Set(sections.map(section => section.image).filter(Boolean));
  const extras = [];
  for (const img of root.querySelectorAll('img')) {
    const url = extractImage(img);
    const width = Number(img.getAttribute('width')) || 0;
    if (url && width >= 100 && !used.has(url)) {
      extras.push(url);
      used.add(url);
    }
  }
  for (const section of sections) {
    if (!section.image && extras.length) section.image = extras.shift();
  }
  return sections.filter((x, i) => (x.text && x.text.trim().length >= 30) || (i === 0 && Boolean(x.image)));

}
export async function fetchWikipediaBoard(feature, { signal, fetcher = fetch } = {}) {
  const article = safeUrl(feature?.properties?.url);
  if (!article) throw Error('Geen Wikipedia-artikel gevonden.');
  const parsed = new URL(article);
  const id = Number(parsed.searchParams.get('curid'));
  if (!Number.isSafeInteger(id) || id <= 0) throw Error('Ongeldig Wikipedia-artikel.');
  const query = new URLSearchParams({ action:'parse', pageid:String(id), prop:'text|images', format:'json', formatversion:'2', origin:'*' });
  const response = await fetcher(parsed.origin+'/w/api.php?'+query, {signal});
  if (!response.ok) throw Error('Wikipedia is momenteel niet bereikbaar.');
  const json = await response.json();
  if (!json.parse?.text) throw Error('Geen verhaal beschikbaar.');
  const sections = sectionsFromWikipediaHtml(json.parse.text, feature.properties);
  // Wikipedia's image list is more complete than the thumbnail markup. Resolve
  // image filenames through imageinfo into real, browser-accessible URLs.
  const titles = (json.parse.images || []).filter(name =>
    /\.(?:jpe?g|png|webp)$/i.test(name) && !/^(?:icon|logo|flag|coat of arms|commons-logo|wikimedia)/i.test(name)
  ).slice(0, 16).map(name => 'File:' + name);
  if (titles.length) {
    try {
      const params = new URLSearchParams({ action:'query', format:'json', formatversion:'2',
        origin:'*', prop:'imageinfo', iiprop:'url|size', iiurlwidth:'1100', titles: titles.join('|') });
      const imagesResponse = await fetcher(parsed.origin + '/w/api.php?' + params, { signal });
      if (imagesResponse.ok) {
        const images = await imagesResponse.json();
        const available = (images.query?.pages || [])
          .map(page => page.imageinfo?.[0])
          .filter(info => !info?.width || (info.width >= 240 && info.height >= 140))
          .map(info => safeUrl(info?.thumburl || info?.url, true))
          .filter(Boolean);
        const distinct = [...new Set(available)];
        // Wikipedia may have no lead thumbnail, but usable article photographs.
        if (!sections[0]?.image && distinct.length) sections[0].image = distinct.shift();
        // The hero keeps the relevant picture from discovery when possible;
        // later sections receive additional photographs from the same article.
        const taken = new Set(sections.map(s => s.image).filter(Boolean));
        const unused = distinct.filter(url => !taken.has(url));
        for (let i = 0; i < sections.length; i++) {
          if (i === 0 && sections[i].image) continue;
          if (unused.length) sections[i].image = unused.shift();
        }
        // If the article has one long section but multiple photos, distribute
        // the text into consecutive reading segments tied to those images.
        if (sections.length === 1 && unused.length && sections[0].text.length > 900) {
          const text = sections[0].text;
          const chunks = text.split(/\n\n+/).filter(Boolean);
          if (chunks.length >= 3) {
            const count = Math.min(1 + unused.length, 6, chunks.length);
            sections[0].text = chunks.slice(0, Math.ceil(chunks.length/count)).join('\n\n');
            let position = Math.ceil(chunks.length/count);
            for (let n = 1; n < count; n++) {
              const end = n === count-1 ? chunks.length : position + Math.ceil(chunks.length/count);
              sections.push({ title: sections[0].title + ' · vervolg', text: chunks.slice(position,end).join('\n\n'), image: unused.shift() || '' });
              position = end;
            }
          }
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error;
      // Images are enrichment: never lose the readable story when this fails.
      console.warn('Wikipedia extra afbeeldingen niet beschikbaar', error?.message);
    }
  }
  return sections;
}
const boardCache = new Map();
// Compass preference survives Board changes, not browser restarts.
let boardCompassEnabled = false;
export function preloadWikipediaBoard(feature) {
  const key = safeUrl(feature?.properties?.url);
  if (!key) return Promise.resolve([]);
  if (!boardCache.has(key)) {
    const task = fetchWikipediaBoard(feature).then(sections => {
      // Warm the first images without downloading the entire article gallery.
      if (typeof Image !== 'undefined') {
        const images = [...new Set([feature?.properties?.image, ...sections.slice(0, 3).map(section => section.image)]
          .map(value => safeUrl(value, true)).filter(Boolean))].slice(0, 3);
        images.forEach(src => { const preview = new Image(); preview.src = src; });
      }
      return sections;
    }).catch(error => { boardCache.delete(key); throw error; });
    boardCache.set(key, task);
    if (boardCache.size > 6) boardCache.delete(boardCache.keys().next().value);
  }
  return boardCache.get(key);
}
export function articleProgressDotCount(wordCount) {
  return Math.max(2, Math.min(13, Math.ceil(Math.max(1, Number(wordCount) || 1) / 180)));
}
export function openBoardViewer(feature, { location, events, onNext, onPrevious, onLayout = () => {}, onClose = () => {}, localBoard = null, sourceBoard = null } = {}) {
  const abort = new AbortController();
  const isLocal = Boolean(localBoard);
  const external = !isLocal && sourceBoard;
  const externalUrl = value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; }
    catch { return ''; }
  };
  let closePolicyEditor = () => {};
  let closed = false, heading = null, gps = location?.latest || null;
  const coords = feature?.geometry?.coordinates;
  const destination = coords?.length === 2 ? {lat: coords[1], lng: coords[0]} : null;

  const overlay = document.createElement('section');
  overlay.className = 'sh-board-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Verhaal over ' + (feature.properties?.title || 'deze plek'));

  // The map remains visible behind the transparent backdrop. The staggered
  // cards behind the reader are visual hints, never duplicate map instances.
  const deck = createBoardDeck();

  const plate = document.createElement('div');
  plate.className = 'sh-board-plate';
  const layoutKey = 'sharon.board.layout.v1';
  const defaults = { map: 32, photo: 26, side: 'center', x: 50, y: 32, height: 65 };
  let layout = { ...defaults };
  try { layout = { ...defaults, ...JSON.parse(localStorage.getItem(layoutKey) || '{}') }; } catch {}
  const applyLayout = () => {
    const map = Math.max(12, Math.min(62, Number(layout.map) || defaults.map));
    const photo = Math.max(14, Math.min(48, Number(layout.photo) || defaults.photo));
    plate.style.setProperty('--sh-board-map-space', map + 'vh');
    plate.style.setProperty('--sh-board-photo-size', photo + 'vh');
    plate.style.setProperty('--sh-board-position-x', Math.max(5, Math.min(95, Number(layout.x) || 50)) + '%');
    plate.style.setProperty('--sh-board-position-y', Math.max(8, Math.min(75, Number(layout.y) || 32)) + 'vh');
    deck.style.setProperty('--sh-board-position-x', Math.max(5, Math.min(95, Number(layout.x) || 50)) + '%');
    deck.style.setProperty('--sh-board-position-y', Math.max(8, Math.min(75, Number(layout.y) || 32)) + 'vh');
    // Inline positions override legacy responsive CSS and move the whole deck.
    const y = Math.max(8, Math.min(75, Number(layout.y) || 32)) + 'vh';
    plate.style.top = y;
    deck.style.top = y;
    // Preserve the reader's height while dragging: both edges move together.
    // The previous fixed bottom edge made the handle behave like a height sizer.
    const viewportHeight = window.innerHeight;
    const actualTop = viewportHeight * Math.max(8, Math.min(75, Number(layout.y) || defaults.y)) / 100;
    const availableHeight = Math.max(160, viewportHeight - actualTop - 8);
    const height = Math.min(Math.max(180, viewportHeight * (Number(layout.height) || defaults.height) / 100), availableHeight) + 'px';
    plate.style.height = height;
    deck.style.height = height;
    plate.style.bottom = 'auto';
    deck.style.bottom = 'auto';
    if (window.innerWidth >= 760) {
      const x = Math.max(15, Math.min(85, Number(layout.x) || 50)) + '%';
      plate.style.left = x;
      deck.style.left = x;
      plate.style.right = 'auto';
      deck.style.right = 'auto';
    }
    plate.dataset.boardSide = ['left','right','top','bottom'].includes(layout.side) ? layout.side : 'center';
  };
  const notifyLayout = () => onLayout(plate.getBoundingClientRect(), deck.getBoundingClientRect());
  const saveLayout = () => {
    try { localStorage.setItem(layoutKey, JSON.stringify(layout)); } catch {}
    applyLayout();
    notifyLayout();
  };
  applyLayout();
  requestAnimationFrame(notifyLayout);

  // Stable photo frame: the article scrolls underneath, never the photo.
  const mapSizer = document.createElement('button');
  mapSizer.type = 'button';
  mapSizer.className = 'sh-board-resizer sh-board-map-resizer';
  mapSizer.setAttribute('aria-label', 'Hoogte van kaart en leesveld aanpassen');
  mapSizer.title = 'Sleep om kaart en leesveld te verdelen';

  const photoHeader = document.createElement('div');
  photoHeader.className = 'sh-board-photo-header';
  const photo = document.createElement('img');
  photo.className = 'sh-board-photo-current';
  photo.alt = '';
  photo.decoding = 'async';
  photo.hidden = true;
  photo.style.display = 'none';
  const photoEmpty = document.createElement('span');
  photoEmpty.className = 'sh-board-photo-placeholder';
  photoEmpty.textContent = feature.properties?.title || 'Verhaal';
  const incomingPhoto = document.createElement('img');
  incomingPhoto.className = 'sh-board-photo-current sh-board-photo-incoming';
  incomingPhoto.alt = '';
  incomingPhoto.decoding = 'async';
  incomingPhoto.hidden = true;
  incomingPhoto.style.display = 'none';
  photoHeader.append(photo, incomingPhoto, photoEmpty);

  const photoSizer = document.createElement('button');
  photoSizer.type = 'button';
  photoSizer.className = 'sh-board-resizer sh-board-photo-resizer';
  photoSizer.setAttribute('aria-label', 'Hoogte van afbeelding en tekst aanpassen');
  photoSizer.title = 'Sleep om afbeelding en tekst te verdelen';

  const scroller = document.createElement('div');
  scroller.className = 'sh-board-scroller';
  const story = document.createElement('article');
  story.className = 'sh-board-story';
  const status = document.createElement('p');
  status.className = 'sh-board-loading';
  status.textContent = 'Verhaal laden…';
  story.append(status);
  const source = document.createElement('a');
  source.textContent = external ? sourceBoard.badge : isLocal ? '↗' : 'W';
  source.href = external ? externalUrl(sourceBoard.url) : isLocal ? (localBoard.website || '#') : safeUrl(feature?.properties?.url);
  source.target = '_blank';
  source.rel = external ? 'noopener noreferrer sponsored' : 'noopener noreferrer';
  source.className = 'sh-board-source';
  source.setAttribute('aria-label', external ? 'Open ' + sourceBoard.label + ' · affiliatelink' : 'Open oorspronkelijk Wikipedia-artikel');
  source.title = external ? sourceBoard.label + ' · affiliatelink' : isLocal ? 'Open website' : 'Open Wikipedia';
  if (isLocal && !localBoard.website) source.hidden = true;
  const credits = document.createElement('small');
  credits.textContent = external ? sourceBoard.label + ' · affiliatelink' : isLocal ? (localBoard.credit || 'Locatie · Sharon') : 'CC BY-SA';
  if (isLocal && externalUrl(localBoard.creditUrl)) {
    const link=document.createElement('a');link.className='sh-source-credit';
    link.href=externalUrl(localBoard.creditUrl);link.target='_blank';link.rel='noopener noreferrer';
    link.textContent=localBoard.credit;link.title=localBoard.creditDescription||localBoard.credit;
    link.setAttribute('aria-label',link.title+' · bron en licentie bekijken');credits.replaceChildren(link);
  }
  if (!isLocal && !external) { credits.title = 'Wikipedia-tekst: CC BY-SA. Foto’s: Wikimedia Commons; controleer per afbeelding de maker en licentie.'; credits.setAttribute('aria-label',credits.title); }
  const footer = document.createElement('footer');
  footer.className = 'sh-board-footer';
  const attribution = document.createElement('div');
  attribution.className = 'sh-board-attribution';
  attribution.append(credits);
  if (!isLocal && !external) {
    const names = Array.isArray(feature?.properties?.categories) ? feature.properties.categories : [];
    const categoryText = names.join(' ').toLowerCase();
    const groups = [];
    if (/monument|histor|erfgoed|kasteel|kerk|archeolog|oorlog|geschiedenis/.test(categoryText)) groups.push('Erfgoed');
    if (/gebouw|architect|brug|toren|bouwwerk|constructie/.test(categoryText)) groups.push('Bouwwerken');
    if (/natuur|bos|park|rivier|meer|landschap|flora|fauna/.test(categoryText)) groups.push('Natuur');
    if (/kunst|museum|cultuur|theater|beeld|muziek/.test(categoryText)) groups.push('Cultuur');
    if (/spoor|station|weg|vervoer|haven|infrastructuur|kanaal/.test(categoryText)) groups.push('Vervoer');
    const category = document.createElement('small');
    category.className = 'sh-board-category';
    category.textContent = groups.length ? groups.join(' · ') : 'Overig';
    category.title = names.join(' · ') || 'Geen Wikipedia-categorie beschikbaar';
    attribution.append(category);
  }
  if (isLocal || external) {
    const label = isLocal ? (localBoard.category || localBoard.type || 'Locatie') : sourceBoard.category;
    if (label) {
      const category = document.createElement('small');
      category.className = 'sh-board-category';
      category.textContent = label;
      category.title = label;
      attribution.append(category);
    }
  }
  footer.append(attribution);
  const savedSections = new Set();
  let savingSection = null;
  let saveButton = null;
  if (external && typeof sourceBoard.onSave === 'function') {
    saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'sh-board-save-card';
    saveButton.textContent = 'Bewaar bij Kaarten';
    const saveStatus = document.createElement('small');
    saveStatus.setAttribute('role','status');
    saveButton.addEventListener('click', async () => {
      const index = activeChapter;
      if (savingSection !== null) return;
      savingSection = index; saveButton.disabled = true;
      saveStatus.textContent = '';
      try {
        await sourceBoard.onSave(index);
        savedSections.add(index);
        if (!closed) saveStatus.textContent = 'Bewaard. Voeg na aankoop je ticketcode toe bij Kaarten.';
      } catch {
        if (!closed) saveStatus.textContent = 'Opslaan is niet gelukt. Probeer opnieuw.';
      } finally {
        savingSection = null;
        if (!closed) {
          saveButton.disabled = savedSections.has(activeChapter);
          saveButton.textContent = savedSections.has(activeChapter) ? 'Bewaard bij Kaarten' : 'Bewaar bij Kaarten';
        }
      }
    });
    footer.append(saveButton,saveStatus);
  }
  if ((!isLocal && !external) || localBoard?.feedbackId) {
    const articleId = localBoard?.feedbackId || String(feature?.properties?.wikidata || feature?.id || feature?.properties?.url || '');
    const feedbackKey = (isLocal?'sharon.place.feedback.v1:':'sharon.wiki.feedback.v1:') + articleId;
    const feedbackEvent=isLocal?'sharon-place-feedback-changed':'sharon-wiki-feedback-changed';
    const information = informationFeedback();
    let reference = null;
    try { reference = isLocal ? (localBoard.feedbackReference?informationReference(localBoard.feedbackReference):null) : wikipediaReference(feature); } catch {}
    const syncStatus = document.createElement('small');
    syncStatus.setAttribute('role','status');syncStatus.hidden=true;
    syncStatus.style.cssText = 'font-size:11px;line-height:1.3;max-width:150px';
    let feedback = {read:false, liked:false, disliked:false, hidden:false, category:''};
    try { feedback = {...feedback, ...JSON.parse(localStorage.getItem(feedbackKey) || '{}')}; } catch {}
    const actions = document.createElement('div');
    actions.className = 'sh-board-feedback';
    actions.style.cssText = 'display:flex;gap:2px;align-items:center;margin:0';
    const readButton = document.createElement('button');
    const likeButton = document.createElement('button');
    const hideButton = document.createElement('button');
    const dislikeButton = document.createElement('button');
    const square = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/>';
    const heart = '<svg viewBox="0 0 24 24" width="21" height="21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
    for (const button of [readButton,likeButton,dislikeButton,hideButton]) {
      button.type = 'button';
      button.style.cssText = 'display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:10px;background:transparent;color:#697580;padding:7px;cursor:pointer;touch-action:manipulation';
    }
    const renderFeedback = () => {
      readButton.innerHTML = square + (feedback.read ? '<path d="m7.5 12 3 3 6-6"/>' : '') + '</svg>';
      dislikeButton.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V2H6.8a2 2 0 0 0-1.9 1.4L2.5 11a2 2 0 0 0 1.9 2.6H9l-1 6.1a2 2 0 0 0 2.6 2.1L17 14ZM17 3h4v11h-4"/></svg>';
      dislikeButton.setAttribute('aria-label',feedback.disliked ? 'Niet leuk verwijderen' : 'Niet leuk');
      dislikeButton.title = dislikeButton.getAttribute('aria-label');
      dislikeButton.setAttribute('aria-pressed',String(feedback.disliked));
      dislikeButton.style.color = feedback.disliked ? '#9b6271' : '#88949e';
      hideButton.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c5.4 0 9.3 4.5 10 7a12.5 12.5 0 0 1-3.1 4.5M6.1 6.2A12.4 12.4 0 0 0 2 12c.7 2.5 4.6 7 10 7a10 10 0 0 0 4.1-.9"/></svg>';
      hideButton.setAttribute('aria-label',feedback.hidden ? (isLocal?'Toon deze locatie weer op de kaart':'Toon dit artikel weer op de kaart') : (isLocal?'Verberg deze locatie op de kaart':'Verberg dit artikel op de kaart'));
      hideButton.title = hideButton.getAttribute('aria-label');
      hideButton.setAttribute('aria-pressed',String(feedback.hidden));
      hideButton.style.color = feedback.hidden ? '#334e63' : '#88949e';
      likeButton.innerHTML = heart.replace('<svg ', '<svg fill="' + (feedback.liked ? 'currentColor' : 'none') + '" ');
      readButton.setAttribute('aria-label',feedback.read ? 'Markering gelezen verwijderen' : 'Markeer als gelezen');
      likeButton.setAttribute('aria-label',feedback.liked ? 'Hartje verwijderen' : 'Vind ik leuk');
      readButton.title = readButton.getAttribute('aria-label');
      likeButton.title = likeButton.getAttribute('aria-label');
      readButton.setAttribute('aria-pressed',String(feedback.read));
      likeButton.setAttribute('aria-pressed',String(feedback.liked));
      readButton.style.color = feedback.read ? '#334e63' : '#88949e';
      likeButton.style.color = feedback.liked ? '#b75b68' : '#88949e';
    };
    const persistFeedback = () => {
      try { localStorage.setItem(feedbackKey,JSON.stringify(feedback)); } catch {}
      window.dispatchEvent(new CustomEvent(feedbackEvent,{detail:{id:articleId,...feedback}}));
      renderFeedback();
      if (information && reference) {
        information.set(reference, feedback).then(() => {
          if (!closed){syncStatus.textContent='';syncStatus.hidden=true;}
        }).catch(() => { if (!closed){syncStatus.hidden=false;syncStatus.textContent = 'Bewaren mislukt. Probeer opnieuw.';} });
      }
    };
    readButton.addEventListener('click', () => { feedback.read = !feedback.read; persistFeedback(); });
    likeButton.addEventListener('click', () => { feedback.liked = !feedback.liked; if(feedback.liked) feedback.disliked = false; persistFeedback(); });
    dislikeButton.addEventListener('click', () => { feedback.disliked = !feedback.disliked; if(feedback.disliked) feedback.liked = false; persistFeedback(); });
    hideButton.addEventListener('click', () => { feedback.hidden = !feedback.hidden; persistFeedback(); });
    renderFeedback();
    actions.append(readButton,likeButton,dislikeButton,hideButton);
    footer.append(actions);
    if (information && reference) {
      footer.classList.add('has-information-feedback');
      syncStatus.className = 'sh-information-status';
      footer.append(syncStatus);
      const buttons = [readButton,likeButton,dislikeButton,hideButton];
      buttons.forEach(button => { button.disabled = true; });
      information.open(reference, feedback).then(row => {
        if (closed) return;
        feedback = {...feedback, ...row.state};
        try { localStorage.setItem(feedbackKey, JSON.stringify(feedback)); } catch {}
        window.dispatchEvent(new CustomEvent(feedbackEvent,{detail:{id:articleId,...feedback}}));
        renderFeedback();
      }).catch(() => { if (!closed){syncStatus.hidden=false;syncStatus.textContent = 'Bewaren mislukt. Probeer opnieuw.';} })
        .finally(() => buttons.forEach(button => { button.disabled = false; }));
      information.load([reference]).catch(() => {});
      information.canManage().then(owner => {
        if (!owner || closed) return;
        // Personal management action: keep the board itself focused on content.
        const openPolicyEditor = () => {
          if (closed) return;
          closePolicyEditor();
          const previousFocus = document.activeElement;
          const overlay = document.createElement('div');
          overlay.className = 'sh-board-owner-policy-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.35);display:grid;place-items:center;padding:20px';
          overlay.innerHTML = '<section role="dialog" aria-modal="true" aria-label="Relevantie beheren" style="background:var(--card-bg,#fff);color:var(--text-color,#222);border-radius:18px;max-width:340px;width:100%;padding:20px;box-sizing:border-box;box-shadow:0 16px 50px #0003"><header style="display:flex;align-items:center;justify-content:space-between;gap:10px"><strong>Relevantie</strong><button type="button" data-policy-close aria-label="Sluiten">✕</button></header><p style="font-size:13px;opacity:.7">Alleen zichtbaar voor beheerders.</p><form style="display:grid;gap:12px"><label>Basisbereik (m)<input name="baseRadius" type="number" min="0" max="100000" step="1" required style="width:100%"></label><label>Maximum (m)<input name="maxRadius" type="number" min="0" max="100000" step="1" required style="width:100%"></label><label>Waardering (0–1)<input name="weight" type="number" min="0" max="1" step="0.1" required style="width:100%"></label><button type="submit">Bewaren</button><small role="status"></small></form></section>';
          const dialog = overlay.querySelector('[role="dialog"]');
          const form = overlay.querySelector('form'), status = overlay.querySelector('[role="status"]');
          const policy = information.summary(reference)?.policy || {baseRadius:10000,maxRadius:10000,weight:0.5};
          for (const key of ['baseRadius','maxRadius','weight']) form.elements[key].value = policy[key];
          const closeEditor = () => {
            overlay.remove();
            window.removeEventListener('keydown', onKey, true);
            if (closePolicyEditor === closeEditor) closePolicyEditor = () => {};
            if (previousFocus?.isConnected) previousFocus.focus();
          };
          closePolicyEditor = closeEditor;
          const onKey = event => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            closeEditor();
          };
          overlay.querySelector('[data-policy-close]').addEventListener('click', closeEditor);
          overlay.addEventListener('click', event => { if (event.target === overlay) closeEditor(); });
          window.addEventListener('keydown', onKey, true);
          form.addEventListener('submit', async event => {
            event.preventDefault();
            const next = Object.fromEntries(['baseRadius','maxRadius','weight'].map(key => [key,Number(form.elements[key].value)]));
            if (next.baseRadius > next.maxRadius) { status.textContent = 'Basisbereik moet binnen het maximum vallen.'; return; }
            const save = form.querySelector('[type="submit"]'); save.disabled = true;
            try {
              await information.setPolicy(reference,next,{title:String(feature.properties?.title || '').slice(0,500),categories:feature.properties?.categories || [],location:destination});
              status.textContent = 'Bewaard.';
              closeEditor();
            } catch { status.textContent = 'Bewaren mislukt. Controleer je verbinding.'; }
            finally { save.disabled = false; }
          });
          document.body.append(overlay);
          dialog.querySelector('[data-policy-close]').focus();
        };
        // The whole footer owns this gesture; it must never reach deck navigation.
        footer.dataset.policySwipe = 'true';
        let start = null, suppressClickUntil = 0;
        footer.addEventListener('click', event => {
          if (Date.now() < suppressClickUntil) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }, true);
        const horizontal = (dx, dy) => Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5;
        footer.addEventListener('touchstart', event => {
          event.stopPropagation();
          start = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null;
        }, {passive:true});
        footer.addEventListener('touchmove', event => {
          event.stopPropagation();
          if (!start || event.touches.length !== 1) { start = null; return; }
          const touch = event.touches[0];
          if (horizontal(touch.clientX-start.x,touch.clientY-start.y) && event.cancelable) event.preventDefault();
        }, {passive:false});
        footer.addEventListener('touchend', event => {
          event.stopPropagation();
          if (!start || !event.changedTouches.length) return;
          const dx = event.changedTouches[0].clientX-start.x, dy = event.changedTouches[0].clientY-start.y;
          start = null;
          if (dx < -65 && Math.abs(dy) < 35 && horizontal(dx,dy)) {
            event.preventDefault();
            suppressClickUntil = Date.now() + 400;
            openPolicyEditor();
          }
        }, {passive:false});
        footer.addEventListener('touchcancel', () => { start = null; });
        let pointer = null;
        footer.addEventListener('pointerdown', event => {
          if (event.pointerType === 'touch' || event.button !== 0) return;
          pointer = {id:event.pointerId,x:event.clientX,y:event.clientY};
        });
        footer.addEventListener('pointermove', event => {
          if (!pointer || pointer.id !== event.pointerId) return;
          if (horizontal(event.clientX-pointer.x,event.clientY-pointer.y)) {
            footer.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          }
        });
        footer.addEventListener('pointerup', event => {
          if (!pointer || pointer.id !== event.pointerId) return;
          const dx=event.clientX-pointer.x, dy=event.clientY-pointer.y;
          pointer = null;
          if (footer.hasPointerCapture?.(event.pointerId)) footer.releasePointerCapture(event.pointerId);
          if (dx < -65 && Math.abs(dy) < 35 && horizontal(dx,dy)) {
            event.preventDefault();
            suppressClickUntil = Date.now() + 400;
            openPolicyEditor();
          }
        });
        footer.addEventListener('pointercancel', () => { pointer = null; });
        footer.addEventListener('lostpointercapture', () => { pointer = null; });
      }).catch(() => {});
    }
  }
  // One unobtrusive source badge inside the photo; no duplicate bottom link.
  source.classList.add('sh-board-photo-source');
  if (!isLocal || localBoard.save) photoHeader.append(source);
  if (isLocal) {
    const controls = story.querySelector('.sh-local-controls');
    if (controls) story.append(controls);
  }
  // Footer must be mounted before insertBefore can use it as a reference node.
  story.append(footer);
  if (isLocal && !localBoard.save) {
    const lessons = [
      ['swipe','Swipe horizontaal om een andere locatie te bekijken.'],
      ['deck','Open Deck om de extra bronnen van deze plek te bekijken.'],
      ['image','Je kunt een eigen afbeelding aan deze locatie koppelen.'],
      ['link','Koppel een website om informatie bij deze locatie te bewaren.']
    ];
    const lessonKey = id => 'sharon.board.lesson.v2.' + id;
    const lesson = lessons.find(([id]) => {
      try { return localStorage.getItem(lessonKey(id)) !== 'done'; } catch { return true; }
    });
    if (lesson) {
      const [id, message] = lesson;
      const tip = document.createElement('div');
      tip.className = 'sh-local-board-intro';
      const line = document.createElement('span');
      const dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.textContent = 'Overslaan';
      tip.append(line,dismiss);
      story.insertBefore(tip, story.querySelector('.sh-local-controls') || footer);
      let cursor = 0;
      const type = () => {
        if (closed || !tip.isConnected) return;
        line.textContent = message.slice(0,++cursor);
        if (cursor < message.length) window.setTimeout(type, 28);
      };
      dismiss.addEventListener('click', () => {
        try {localStorage.setItem(lessonKey(id),'done');}catch{}
        tip.remove();
      });
      type();
    }
  }
  const textGlass = document.createElement('div');
  textGlass.className = 'sh-board-text-glass';
  textGlass.setAttribute('aria-hidden', 'true');
  scroller.append(textGlass);
  scroller.append(story);

  const chapterRail = document.createElement('nav');
  chapterRail.className = 'sh-board-chapters';
  chapterRail.setAttribute('aria-label', 'Hoofdstukken');
  const moveHandle = document.createElement('button');
  moveHandle.type = 'button';
  moveHandle.className = 'sh-board-move-handle';
  moveHandle.setAttribute('aria-label', 'Verplaats Board');
  moveHandle.title = 'Sleep om Board te verplaatsen';
  plate.append(moveHandle, mapSizer, photoHeader, photoSizer, scroller, chapterRail);
  overlay.append(deck, plate);
  plate.classList.add('is-board-entering');
  document.body.append(overlay);

  // Both dividers resize immediately. Hold either for two seconds to lock
  // Board and deck into a movable unit, indicated by a temporary outline.
  let gesture = null;
  const cards = [...deck.querySelectorAll('.sh-board-deck-card')];
  const motion = [plate, deck, ...cards];
  const resetStack = () => {
    for (const el of motion) {
      el.style.transition = 'transform 240ms ease, box-shadow 240ms ease, filter 240ms ease';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.filter = '';
    }
  };
  const liftStack = () => {
    // Keep the front card fixed relative to the pointer; only the cards behind it lift.
    plate.style.boxShadow = '0 24px 58px rgba(0,0,0,.23)';
    deck.style.filter = 'drop-shadow(0 12px 18px rgba(0,0,0,.12))';
    cards.forEach((card, i) => {
      card.style.transition = 'transform 220ms ease, box-shadow 220ms ease';
      card.style.transform = 'translate(' + (-3 - i * 2) + 'px,' + (-3 - i * 2) + 'px)';
    });
  };
  const clearGesture = () => {
    if (!gesture) return;
    gesture = null;
    plate.classList.remove('is-board-moving-together');
    deck.classList.remove('is-board-moving-together');
    resetStack();
    window.removeEventListener('pointermove', onGestureMove);
    window.removeEventListener('pointerup', onGestureEnd);
    window.removeEventListener('pointercancel', onGestureEnd);
  };
  const onGestureMove = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (gesture.mode === 'pending' && Math.hypot(dx,dy) > 9) {
      if (gesture.kind === 'compass' && dx > 22 && dx > Math.abs(dy) * 1.2) {
        gesture.mode = 'move';
        plate.classList.add('is-board-moving-together');
        deck.classList.add('is-board-moving-together');
        liftStack();
        // Anchor at the activation point, preventing a jump when switching modes.
        gesture.x = event.clientX;
        gesture.y = event.clientY;
        gesture.startX = Number(layout.x) || defaults.x;
        gesture.startY = Number(layout.y) || defaults.y;
        if (navigator.vibrate) navigator.vibrate(15);
      } else if (gesture.kind !== 'compass' && Math.abs(dy) > Math.abs(dx)) {
        gesture.mode = 'resize';
      }
    }
    if (gesture.mode === 'move') {
      if (window.innerWidth >= 760) layout.x = Math.max(15, Math.min(85,
        gesture.startX + (event.clientX - gesture.x) / window.innerWidth * 100));
      layout.y = Math.max(8, Math.min(75,
        gesture.startY + (event.clientY - gesture.y) / window.innerHeight * 100));
    } else if (gesture.mode === 'resize') {
      const delta = (event.clientY - gesture.lastY) / window.innerHeight * 100;
      if (gesture.kind === 'map') {
        const oldY = Number(layout.y) || defaults.y;
        const newY = Math.max(8, Math.min(75, oldY + delta));
        const applied = newY - oldY;
        layout.y = newY;
        layout.height = Math.max(20, Math.min(90, (Number(layout.height) || defaults.height) - applied));
      } else {
        layout.photo = Math.max(14, Math.min(48, (Number(layout.photo) || defaults.photo) + delta));
      }
    }
    gesture.lastY = event.clientY;
    if (gesture.mode !== 'pending') { applyLayout(); notifyLayout(); }
    if (event.cancelable) event.preventDefault();
  };
  const onGestureEnd = event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    clearGesture();
    saveLayout();
  };
  const beginGesture = (handle, kind, event) => {
    if (event.button !== undefined && event.button !== 0) return;
    clearGesture();
    try { handle.setPointerCapture(event.pointerId); } catch {}
    gesture = { id:event.pointerId, kind, mode:'pending', x:event.clientX,
      y:event.clientY, lastY:event.clientY,
      startX:Number(layout.x) || defaults.x, startY:Number(layout.y) || defaults.y };
    window.addEventListener('pointermove', onGestureMove, { passive:false });
    window.addEventListener('pointerup', onGestureEnd);
    window.addEventListener('pointercancel', onGestureEnd);
    event.preventDefault();
  };
  mapSizer.style.touchAction = 'none';
  photoSizer.style.touchAction = 'none';
  mapSizer.addEventListener('pointerdown', event => beginGesture(mapSizer, 'map', event));
  photoSizer.addEventListener('pointerdown', event => beginGesture(photoSizer, 'photo', event));
  // The former third handle is not needed; the two dividers own both actions.
  moveHandle.hidden = true;
  moveHandle.style.display = 'none';
  mapSizer.title = 'Sleep verticaal om de hoogte van de Board aan te passen';
  mapSizer.setAttribute('aria-description', 'Sleep verticaal om de hoogte van de Board aan te passen');
  photoSizer.title = 'Sleep verticaal om de afbeeldingshoogte aan te passen';
  mapSizer.addEventListener('keydown', event => {
    if (!['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    layout.y = Math.max(8, Math.min(75, layout.y + (event.key === 'ArrowDown' ? 2 : -2)));
    saveLayout();
  });
  photoSizer.addEventListener('keydown', event => {
    if (!['ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    layout.photo = Math.max(14, Math.min(48, layout.photo + (event.key === 'ArrowDown' ? 2 : -2)));
    saveLayout();
  });
  // On wider screens a double tap/click on the map divider cycles the reader
  // from centred to left and right, leaving the map visible alongside it.
  mapSizer.addEventListener('dblclick', () => {
    const order = ['center','left','right','top','bottom'];
    layout.side = order[(order.indexOf(layout.side) + 1) % order.length];
    saveLayout();
  });
  mapSizer.setAttribute('aria-label', 'Kaartpositie wijzigen met dubbelklik; versleep om kaartgrootte aan te passen');
  requestAnimationFrame(() => {
    if (!closed && plate.isConnected) plate.classList.remove('is-board-entering');
  });

  const compass = document.createElement('div');
  compass.className = 'sh-board-compass';
  const compassButton = document.createElement('button');
  compassButton.type = 'button';
  compassButton.setAttribute('aria-label', 'Kompas activeren');
  const arrow = document.createElement('span');
  arrow.className = 'sh-board-arrow';
  arrow.textContent = '➤';
  const activate = document.createElement('span');
  activate.textContent = 'Richting';
  activate.className = 'sh-board-activate';
  compassButton.append(arrow, activate);
  const distance = document.createElement('small');
  compass.append(compassButton, distance);
  compass.classList.add('is-distance-only');
  photoHeader.append(compass);
  compass.style.touchAction = 'none';
  compass.addEventListener('pointerdown', event => beginGesture(compass, 'compass', event));
  if (isLocal && localBoard.save) {
    const controls=document.createElement('div');controls.className='sh-local-controls';
    const save=document.createElement('button');save.type='button';save.textContent='Bewaar bij Locaties';
    save.addEventListener('click',async()=>{save.disabled=true;try{await localBoard.save();save.textContent='Bewaard bij Locaties';}catch{save.textContent='Probeer opnieuw';save.disabled=false;}});
    controls.append(save);story.append(controls);
  }
  if (isLocal && !localBoard.save) {
    const deckControl = document.createElement('button');
    deckControl.type = 'button';
    deckControl.className = 'sh-local-deck-control';
    deckControl.textContent = '▤ Deck';
    deckControl.setAttribute('aria-label','Locatiedeck openen of sluiten');
    deckControl.addEventListener('click', () => localBoard.toggle?.());
    const localControls = document.createElement('div');
    localControls.className = 'sh-local-controls';
    localControls.append(deckControl);

    const imageControl = document.createElement('button');
    imageControl.type = 'button';
    imageControl.className = 'sh-local-image-control';
    imageControl.textContent = '▧';
    imageControl.setAttribute('aria-label','Afbeelding koppelen of wijzigen');
    imageControl.addEventListener('click', () => localBoard.setImage?.());
    localControls.append(imageControl);

    source.href = '#';
    source.removeAttribute('target');
    source.hidden = false;
    source.textContent = '+';
    source.title = 'Webpagina aan locatie koppelen';
    source.setAttribute('aria-label','Webpagina aan locatie koppelen');
    localControls.append(source);
    story.append(localControls);
    source.addEventListener('click', event => {
      event.preventDefault();
      localBoard.addLink?.();
    });
  }
  let compassEnabled = boardCompassEnabled;
  const updateCompass = () => {
    const value = distanceBearing(gps, destination);
    distance.textContent = value
      ? (value.distance < 1000 ? Math.round(value.distance) + ' m' :
        (value.distance / 1000).toFixed(value.distance < 10000 ? 1 : 0) + ' km')
      : 'GPS onbekend';
    arrow.hidden = !compassEnabled || !value || heading === null;
    compass.classList.toggle('is-distance-only', !compassEnabled || heading === null);
    compassButton.setAttribute('aria-pressed', String(compassEnabled));
    if (value && heading !== null) {
      arrow.style.transform = 'rotate(' + ((value.bearing - heading + 360) % 360) + 'deg)';
    }
    activate.hidden = heading !== null;
  };
  let currentPhoto = '';
  let pendingPhoto = '';
  let imageRevision = 0;
  let photoAnimation = null;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const selectPhoto = image => {
    const url = external ? (sourceBoard.resolveImage?.(image) || '') : safeUrl(image, true);
    if (!url || url === currentPhoto || url === pendingPhoto) return;
    const revision = ++imageRevision;
    pendingPhoto = url;
    const preload = new Image();
    preload.onload = () => {
      if (closed || revision !== imageRevision) return;
      pendingPhoto = '';
      if (photoAnimation) { photoAnimation.cancel(); photoAnimation = null; }
      if (reducedMotion || !currentPhoto) {
        photo.src = url;
        photo.hidden = false;
        photo.style.display = 'block';
        incomingPhoto.hidden = true;
        incomingPhoto.style.display = 'none';
        currentPhoto = url;
        photoEmpty.hidden = true;
        return;
      }
      // Crossfade after loading; never reveal an empty media frame.
      incomingPhoto.src = url;
      incomingPhoto.hidden = false;
      incomingPhoto.style.display = 'block';
      photoEmpty.hidden = true;
      const previous = currentPhoto;
      currentPhoto = url;
      photoAnimation = incomingPhoto.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 430, easing: 'ease-in-out', fill: 'forwards' }
      );
      photoAnimation.onfinish = () => {
        if (closed || currentPhoto !== url) return;
        photo.src = url;
        photo.hidden = false;
        photo.style.display = 'block';
        incomingPhoto.hidden = true;
        incomingPhoto.style.display = 'none';
        photoAnimation = null;
      };
    };
    preload.onerror = () => {
      if (closed || revision !== imageRevision) return;
      pendingPhoto = '';
      if (!currentPhoto) photoEmpty.hidden = false;
    };
    preload.src = url;
  };
  if (isLocal) {
    if (localBoard.image) {
      photo.src = localBoard.image;
      photo.hidden = false;
      photo.style.display = 'block';
      photoEmpty.hidden = true;
      photo.onerror = () => { photo.hidden = true; photo.style.display = 'none'; photoEmpty.hidden = false; };
    }
  } else selectPhoto(feature.properties?.image);
  const onOrientation = event => {
    if (!compassEnabled) return;
    if (Number.isFinite(event.webkitCompassHeading)) heading = event.webkitCompassHeading;
    else if (event.absolute && Number.isFinite(event.alpha)) heading = (360 - event.alpha) % 360;
    else return;
    activate.textContent = 'Richting';
    updateCompass();
  };
  window.addEventListener('deviceorientation', onOrientation, { passive: true });
  window.addEventListener('deviceorientationabsolute', onOrientation, { passive: true });
  const unsubscribe = events?.on?.('location.changed', event => {
    gps = event.detail;
    updateCompass();
  });

  const onKey = event => { if (event.key === 'Escape') close(); };
  window.addEventListener('keydown', onKey);
  const close = () => {
    if (closed) return;
    closed = true;
    abort.abort();
    closePolicyEditor();
    unsubscribe?.();
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('deviceorientation', onOrientation);
    window.removeEventListener('deviceorientationabsolute', onOrientation);
    scroller.removeEventListener('scroll', refreshChapter);
    overlay.remove();
    onClose();
  };
  const switchTo = direction => {
    const action = direction === 'next' ? onNext : onPrevious;
    if (action) { action(); }
  };

  // Interactive deck: the active card follows the finger. Vertical reading
  // remains native; only after a horizontal direction lock do we prevent scroll.
  let swipe = null;
  let transitioning = false;
  const resetDeck = () => {
    plate.style.transform = '';
    plate.style.transformOrigin = '';
    deck.style.transform = '';
    plate.style.opacity = '';
    plate.classList.remove('is-board-dragging');
  };
  plate.addEventListener('touchstart', event => {
    if ((!onNext && !onPrevious) || transitioning || event.touches.length !== 1 ||
        event.target.closest('button,a,.sh-board-compass,.sh-board-move-handle')) return;
    const t = event.touches[0];
    swipe = { x:t.clientX, y:t.clientY, dx:0, direction:null };
  }, { passive:true });
  plate.addEventListener('touchmove', event => {
    if (!swipe || event.touches.length !== 1 || transitioning) return;
    const t = event.touches[0], dx = t.clientX - swipe.x;
    const dy = t.clientY - swipe.y;
    if (!swipe.direction) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
      if (Math.abs(dx) < 12) return;
      swipe.direction = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'horizontal' : 'vertical';
    }
    if (swipe.direction !== 'horizontal') return;
    swipe.dx = dx < 0 && !onNext ? 0 : dx > 0 && !onPrevious ? 0 : dx;
    if (event.cancelable) event.preventDefault();
    plate.classList.add('is-board-dragging');
    plate.style.transformOrigin = '50% 50%';
    plate.style.transform = (window.innerWidth >= 760 ? 'translateX(-50%) ' : '') + 'translate3d(' + swipe.dx + 'px,0,0) rotate(' +
      Math.max(-3, Math.min(3, swipe.dx / Math.max(100, plate.clientWidth) * 5)).toFixed(2) + 'deg)';
    plate.style.opacity = String(Math.max(.6, 1 + swipe.dx / 900));
    // Keep the stack anchored: only the front story card moves during a swipe.
    deck.style.transform = '';
  }, { passive:false });
  plate.addEventListener('touchend', () => {
    if (!swipe) return;
    const dx = swipe.dx;
    swipe = null;
    plate.classList.remove('is-board-dragging');
    const threshold = Math.min(95, plate.clientWidth * .25);
    if ((dx < -threshold && onNext) || (dx > threshold && onPrevious)) {
      transitioning = true;
      const direction = dx < 0 ? 'next' : 'previous';
      plate.classList.add('is-board-exiting');
      plate.style.transformOrigin = '50% 50%';
      plate.style.transform = (window.innerWidth >= 760 ? 'translateX(-50%) ' : '') + (direction === 'next'
        ? 'translate3d(-65%,0,0) rotate(-3deg)'
        : 'translate3d(65%,0,0) rotate(3deg)');
      plate.style.opacity = '0';
      window.setTimeout(() => { if (!closed) switchTo(direction); }, 210);
    } else resetDeck();
  }, { passive:true });
  plate.addEventListener('touchcancel', () => { swipe = null; resetDeck(); }, { passive:true });
  // Pull down from the fixed photo to dismiss without blocking text scrolling.
  let dismiss = null;
  photoHeader.addEventListener('touchstart', event => {
    if (event.touches.length !== 1 || event.target.closest('button')) return;
    const t = event.touches[0];
    dismiss = { x:t.clientX, y:t.clientY, dy:0 };
  }, { passive:true });
  photoHeader.addEventListener('touchmove', event => {
    if (!dismiss || event.touches.length !== 1 || transitioning) return;
    const t = event.touches[0], dx = t.clientX - dismiss.x;
    const dy = t.clientY - dismiss.y;
    if (Math.abs(dx) > Math.max(18, dy)) { dismiss = null; return; }
    if (dy < 8) return;
    dismiss.dy = Math.min(220, dy);
    if (event.cancelable) event.preventDefault();
    plate.classList.add('is-board-dragging');
    plate.style.transform = 'translate3d(0,' + dismiss.dy + 'px,0)';
    plate.style.opacity = String(Math.max(.65, 1 - dismiss.dy / 600));
  }, { passive:false });
  photoHeader.addEventListener('touchend', () => {
    if (!dismiss) return;
    const dy = dismiss.dy;
    dismiss = null;
    plate.classList.remove('is-board-dragging');
    if (dy > 100) {
      transitioning = true;
      plate.classList.add('is-board-exiting');
      plate.style.transform = 'translate3d(0,110vh,0)';
      plate.style.opacity = '0';
      window.setTimeout(() => { if (!closed) close(); }, 220);
    } else resetDeck();
  }, { passive:true });
  photoHeader.addEventListener('touchcancel', () => {
    dismiss = null; resetDeck();
  }, { passive:true });


  async function requestCompass() {
    if (compassEnabled) {
      compassEnabled = false;
      boardCompassEnabled = false;
      heading = null;
      activate.textContent = 'Richting';
      updateCompass();
      return;
    }
    if (typeof DeviceOrientationEvent === 'undefined') {
      activate.textContent = 'Geen kompas';
      return;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function' &&
        await DeviceOrientationEvent.requestPermission() !== 'granted') return;
      if (closed) return;
      compassEnabled = true;
      boardCompassEnabled = true;
      activate.textContent = 'Wachten…';
      updateCompass();
    } catch {
      activate.textContent = 'Niet beschikbaar';
    }
  }

  compassButton.addEventListener('click', requestCompass);
  const chapters = [];
  const chapterImages = [];
  const dots = [];
  let activeChapter = -1;
  const setActive = index => {
    if (saveButton) {
      saveButton.disabled = savingSection !== null || savedSections.has(index);
      saveButton.textContent = savedSections.has(index) ? 'Bewaard bij Kaarten' : 'Bewaar bij Kaarten';
    }
    if (external) {
      const section = sourceBoard.sections[index] || {};
      source.href = externalUrl(section.url || sourceBoard.url);
      const imageSection = section.image ? section : sourceBoard.sections.slice(0, index + 1).reverse().find(item => item.image);
      credits.textContent = [sourceBoard.label + ' · affiliatelink', imageSection?.imageCredit].filter(Boolean).join(' · ');
      photo.alt = imageSection?.imageAlt || '';
      incomingPhoto.alt = imageSection?.imageAlt || '';
    }
    if (index !== activeChapter) {
      activeChapter = index;
      const chosen = chapterImages[index] ||
        chapterImages.slice(0, index + 1).reverse().find(Boolean) ||
        feature.properties?.image;
      selectPhoto(chosen);
    }
    refreshProgress();
  };
  const refreshProgress = () => {
    const total = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    const progress = Math.min(1, Math.max(0, scroller.scrollTop / total));
    const current = Math.min(dots.length-1, Math.floor(progress * dots.length));
    dots.forEach((dot, i) => dot.setAttribute('aria-current', i === current ? 'step' : 'false'));
  };
  const buildProgress = sections => {
    chapterRail.replaceChildren();
    dots.length = 0;
    const words = sections.reduce((sum, section) => sum + String(section.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
    const count = articleProgressDotCount(words);
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'sh-board-chapter-dot';
      const fraction = count === 1 ? 0 : i/(count-1);
      dot.setAttribute('aria-label', 'Ga naar ' + Math.round(fraction*100) + '% van het artikel');
      dot.addEventListener('click', () => {
        scroller.scrollTo({ top: fraction * Math.max(0,scroller.scrollHeight-scroller.clientHeight), behavior:'smooth' });
      });
      dots.push(dot);
      chapterRail.append(dot);
    }
    refreshProgress();
  };
  const refreshChapter = () => {
    const threshold = scroller.getBoundingClientRect().top + 100;
    let active = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].getBoundingClientRect().top <= threshold) active = i;
    }
    setActive(active);
    refreshProgress();
  };
  scroller.addEventListener('scroll', refreshChapter, { passive: true });

  function addChapter(section, index) {
    const item = document.createElement('section');
    item.className = 'sh-board-chapter';
    chapterImages.push(section.image || '');
    const title = document.createElement(index ? 'h3' : 'h2');
    title.textContent = section.title;
    const paragraph = document.createElement('p');
    paragraph.textContent = section.text;
    item.append(title, paragraph);
    story.insertBefore(item, footer);
    chapters.push(item);


  }

  if (isLocal) {
    status.remove();
    const sections = [{ title: localBoard.title || 'Locatie', text: [localBoard.type, localBoard.address, localBoard.description].filter(Boolean).join('\n'), image: '' }];
    sections.forEach(addChapter);
    buildProgress(sections);
    setActive(0);
  } else if (external) {
    status.remove();
    const sections = sourceBoard.sections || [];
    sections.forEach(addChapter);
    buildProgress(sections);
    setActive(0);
    updateCompass();
  } else preloadWikipediaBoard(feature).then(sections => {
    if (closed) return;
    status.remove();
    if (!sections.length) throw Error('Geen leesbare inhoud.');
    sections.forEach(addChapter);
    buildProgress(sections);
    if (!chapters.length) addChapter({ title: feature.properties?.title || 'Verhaal', text: feature.properties?.description || 'Geen aanvullende tekst beschikbaar.', image: feature.properties?.image || '' }, 0);
    setActive(0);
    updateCompass();
  }).catch(error => {
    if (closed) return;
    status.remove();
    // The map discovery response already carries a summary. Keep a readable
    // Board even when Wikipedia's full article endpoint is unavailable.
    addChapter({
      title: feature.properties?.title || 'Verhaal',
      text: feature.properties?.description || 'De uitgebreide tekst is tijdelijk niet beschikbaar.',
      image: feature.properties?.image || ''
    }, 0);
    buildProgress([{ text: feature.properties?.description || '' }]);
    setActive(0);
    updateCompass();
    console.warn('Sharon Board: Wikipedia-artikel tijdelijk niet beschikbaar', error?.message);
  });
  return close;
}
