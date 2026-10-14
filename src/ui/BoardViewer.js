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
export function openBoardViewer(feature, { location, events, onNext, onPrevious, onLayout = () => {}, onClose = () => {} } = {}) {
  const abort = new AbortController();
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
  const deck = document.createElement('div');
  deck.className = 'sh-board-deck';
  deck.setAttribute('aria-hidden', 'true');
  for (let n = 1; n <= 2; n++) {
    const card = document.createElement('div');
    card.className = 'sh-board-deck-card sh-board-deck-card-' + n;
    deck.append(card);
  }

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
  source.textContent = 'W';
  source.href = safeUrl(feature?.properties?.url);
  source.target = '_blank';
  source.rel = 'noopener noreferrer';
  source.className = 'sh-board-source';
  source.setAttribute('aria-label', 'Open oorspronkelijk Wikipedia-artikel');
  source.title = 'Open Wikipedia';
  const credits = document.createElement('small');
  credits.textContent = 'Tekst: Wikipedia · CC BY-SA. Foto’s: Wikimedia Commons; controleer per afbeelding de maker en licentie.';
  const footer = document.createElement('footer');
  footer.className = 'sh-board-footer';
  footer.append(credits);
  // One unobtrusive source badge inside the photo; no duplicate bottom link.
  source.classList.add('sh-board-photo-source');
  photoHeader.append(source);
  story.append(footer);
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
      el.style.transition = 'transform 420ms cubic-bezier(.2,1.25,.35,1), box-shadow 420ms ease, filter 420ms ease';
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.filter = '';
    }
  };
  const clearGesture = () => {
    if (!gesture) return;
    window.clearTimeout(gesture.timer);
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
    if (gesture.mode === 'pending' && Math.hypot(dx, dy) > 8) {
      window.clearTimeout(gesture.timer);
      gesture.mode = 'resize';
      resetStack();
    }
    if (gesture.mode === 'move') {
      if (window.innerWidth >= 760) layout.x = Math.max(15, Math.min(85,
        gesture.startX + dx / window.innerWidth * 100));
      layout.y = Math.max(8, Math.min(75,
        gesture.startY + dy / window.innerHeight * 100));
    } else if (gesture.mode === 'resize') {
      const delta = (event.clientY - gesture.lastY) / window.innerHeight * 100;
      if (gesture.kind === 'map') {
        // The top divider moves the Board's upper edge: expose more or less map.
        const oldY = Number(layout.y) || defaults.y;
        const newY = Math.max(8, Math.min(75, oldY + delta));
        const applied = newY - oldY;
        layout.y = newY;
        // Keep the lower edge stationary: change height opposite to the top edge.
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
    gesture = { id:event.pointerId, kind, mode:'pending', x:event.clientX,
      y:event.clientY, lastY:event.clientY,
      startX:Number(layout.x) || defaults.x, startY:Number(layout.y) || defaults.y, timer:null };
    const id = event.pointerId;
    // Physical pickup: the shadows rise and the offset cards slide under
    // the reader over the full two-second hold, not only at the end.
    plate.style.transition = 'transform 2000ms ease-in-out, box-shadow 2000ms ease-in-out';
    deck.style.transition = 'transform 2000ms ease-in-out, filter 2000ms ease-in-out';
    plate.style.transform = 'scale(1.03) translateY(-4px)';
    plate.style.boxShadow = '0 28px 65px rgba(0,0,0,.24), 0 9px 24px rgba(0,0,0,.12)';
    deck.style.transform = 'scale(1.03) translateY(-4px)';
    deck.style.filter = 'drop-shadow(0 16px 22px rgba(0,0,0,.12))';
    cards.forEach((card, i) => {
      card.style.transition = 'transform 2000ms ease-in-out';
      card.style.transform = 'translate(' + ((i + 1) * -7) + 'px, ' + ((i + 1) * -7) + 'px) rotate(' + ((i + 1) * -.8) + 'deg)';
    });
    gesture.timer = window.setTimeout(() => {
      if (!gesture || gesture.id !== id || gesture.mode !== 'pending') return;
      gesture.mode = 'move';
      plate.classList.add('is-board-moving-together');
      deck.classList.add('is-board-moving-together');
      // The completed lifted stack now follows the pointer.
      if (navigator.vibrate) navigator.vibrate(25);
    }, 2000);
    window.addEventListener('pointermove', onGestureMove, { passive:false });
    window.addEventListener('pointerup', onGestureEnd);
    window.addEventListener('pointercancel', onGestureEnd);
    event.preventDefault();
  };
  mapSizer.addEventListener('pointerdown', event => beginGesture(mapSizer, 'map', event));
  photoSizer.addEventListener('pointerdown', event => beginGesture(photoSizer, 'photo', event));
  // The former third handle is not needed; the two dividers own both actions.
  moveHandle.hidden = true;
  moveHandle.style.display = 'none';
  mapSizer.title = 'Sleep voor kaartgrootte; houd 2 seconden vast om alles te verplaatsen';
  photoSizer.title = 'Sleep voor afbeeldingsgrootte; houd 2 seconden vast om alles te verplaatsen';
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
    const url = safeUrl(image, true);
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
  selectPhoto(feature.properties?.image);
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
    if (action) { close(); action(); }
  };

  // Interactive deck: the active card follows the finger. Vertical reading
  // remains native; only after a horizontal direction lock do we prevent scroll.
  let swipe = null;
  let transitioning = false;
  const resetDeck = () => {
    plate.style.transform = '';
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
    plate.style.transform = 'translate3d(' + swipe.dx + 'px,0,0) rotate(' +
      (swipe.dx / 65).toFixed(2) + 'deg)';
    plate.style.opacity = String(Math.max(.6, 1 + swipe.dx / 900));
    deck.style.transform = 'translate3d(' + Math.max(-20, Math.min(20, -swipe.dx * .10)) + 'px,0,0)';
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
      plate.style.transform = direction === 'next'
        ? 'translate3d(-110vw,0,0) rotate(-9deg)'
        : 'translate3d(110vw,0,0) rotate(9deg)';
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

  preloadWikipediaBoard(feature).then(sections => {
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
