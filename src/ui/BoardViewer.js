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
  const first = { title: fallback.title || 'Verhaal', text: fallback.description || '', image: safeUrl(fallback.image, true) };
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
  if (!first.text) first.text = fallback.description || '';
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
  const query = new URLSearchParams({ action:'parse', pageid:String(id), prop:'text', format:'json', formatversion:'2', origin:'*' });
  const response = await fetcher(parsed.origin+'/w/api.php?'+query, {signal});
  if (!response.ok) throw Error('Wikipedia is momenteel niet bereikbaar.');
  const json = await response.json();
  if (!json.parse?.text) throw Error('Geen verhaal beschikbaar.');
  return sectionsFromWikipediaHtml(json.parse.text, feature.properties);
}
export function openBoardViewer(feature, { location, events, onNext, onClose = () => {} } = {}) {
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

  // Stable photo frame: the article scrolls underneath, never the photo.
  const photoHeader = document.createElement('div');
  photoHeader.className = 'sh-board-photo-header';
  const photo = document.createElement('img');
  photo.className = 'sh-board-photo-current';
  photo.alt = '';
  photo.decoding = 'async';
  const photoEmpty = document.createElement('span');
  photoEmpty.className = 'sh-board-photo-placeholder';
  photoEmpty.textContent = 'Geen afbeelding beschikbaar';
  photoHeader.append(photo, photoEmpty);

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
  credits.textContent = 'Tekst: Wikipedia (CC BY-SA). Afbeeldingen: Wikimedia Commons; licenties verschillen per afbeelding.';
  const footer = document.createElement('footer');
  footer.className = 'sh-board-footer';
  credits.textContent = 'Wikipedia · CC BY-SA · Wikimedia Commons';
  footer.append(credits, source);
  story.append(footer);
  scroller.append(story);

  const chapterRail = document.createElement('nav');
  chapterRail.className = 'sh-board-chapters';
  chapterRail.setAttribute('aria-label', 'Hoofdstukken');
  plate.append(photoHeader, scroller, chapterRail);
  overlay.append(deck, plate);
  plate.classList.add('is-board-entering');
  document.body.append(overlay);
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
  activate.textContent = 'Kompas';
  activate.className = 'sh-board-activate';
  compassButton.append(arrow, activate);
  const distance = document.createElement('small');
  compass.append(compassButton, distance);
  photoHeader.append(compass);
  const updateCompass = () => {
    const value = distanceBearing(gps, destination);
    distance.textContent = value
      ? (value.distance < 1000 ? Math.round(value.distance) + ' m' :
        (value.distance / 1000).toFixed(value.distance < 10000 ? 1 : 0) + ' km')
      : 'GPS onbekend';
    arrow.hidden = !value || heading === null;
    if (value && heading !== null) {
      arrow.style.transform = 'rotate(' + ((value.bearing - heading + 360) % 360) + 'deg)';
    }
    activate.hidden = heading !== null;
  };
  let currentPhoto = '';
  const selectPhoto = image => {
    const url = safeUrl(image, true);
    if (!url || url === currentPhoto) return;
    currentPhoto = url;
    photo.style.visibility = 'hidden';
    photoEmpty.hidden = false;
    photo.onload = () => {
      if (closed || currentPhoto !== url) return;
      photo.style.visibility = 'visible';
      photoEmpty.hidden = true;
    };
    photo.onerror = () => {
      if (closed || currentPhoto !== url) return;
      // Do not discard the fixed photo area on failed requests.
      photo.style.visibility = 'hidden';
      photoEmpty.hidden = false;
    };
    photo.src = url;
  };
  selectPhoto(feature.properties?.image);
  const onOrientation = event => {
    if (Number.isFinite(event.webkitCompassHeading)) heading = event.webkitCompassHeading;
    else if (event.absolute && Number.isFinite(event.alpha)) heading = (360 - event.alpha) % 360;
    else return;
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
  const switchNext = () => { if (onNext) { close(); onNext(); } };

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
    if (!onNext || transitioning || event.touches.length !== 1 ||
        event.target.closest('button,a,.sh-board-compass')) return;
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
    swipe.dx = Math.min(0, dx);
    if (event.cancelable) event.preventDefault();
    plate.classList.add('is-board-dragging');
    plate.style.transform = 'translate3d(' + swipe.dx + 'px,0,0) rotate(' +
      (swipe.dx / 65).toFixed(2) + 'deg)';
    plate.style.opacity = String(Math.max(.6, 1 + swipe.dx / 900));
    deck.style.transform = 'translate3d(' + Math.min(20, -swipe.dx * .10) + 'px,0,0)';
  }, { passive:false });
  plate.addEventListener('touchend', () => {
    if (!swipe) return;
    const dx = swipe.dx;
    swipe = null;
    plate.classList.remove('is-board-dragging');
    if (dx < -Math.min(95, plate.clientWidth * .25)) {
      transitioning = true;
      plate.classList.add('is-board-exiting');
      plate.style.transform = 'translate3d(-110vw,0,0) rotate(-9deg)';
      plate.style.opacity = '0';
      window.setTimeout(() => { if (!closed) switchNext(); }, 210);
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
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function' &&
        await DeviceOrientationEvent.requestPermission() !== 'granted') return;
      activate.textContent = 'Richting bepalen…';
    } catch {
      activate.textContent = 'Kompas niet beschikbaar';
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
    dots.forEach((dot, i) => {
      dot.setAttribute('aria-current', i === index ? 'step' : 'false');
      dot.setAttribute('aria-label', 'Hoofdstuk ' + (i + 1) + ' van ' + dots.length +
        ': ' + (chapters[i]?.querySelector('h2,h3')?.textContent || 'Verhaal'));
    });
  };
  const refreshChapter = () => {
    const threshold = scroller.getBoundingClientRect().top + 100;
    let active = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].getBoundingClientRect().top <= threshold) active = i;
    }
    setActive(active);
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

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'sh-board-chapter-dot';
    dot.title = section.title;
    dot.addEventListener('click', () => {
      scroller.scrollTo({ top: item.offsetTop - story.offsetTop, behavior: 'smooth' });
      setActive(index);
    });
    chapterRail.append(dot);
    dots.push(dot);
  }

  fetchWikipediaBoard(feature, { signal: abort.signal }).then(sections => {
    if (closed) return;
    status.remove();
    if (!sections.length) throw Error('Geen leesbare inhoud.');
    sections.forEach(addChapter);
    if (!chapters.length) addChapter({ title: feature.properties?.title || 'Verhaal', text: feature.properties?.description || 'Geen aanvullende tekst beschikbaar.', image: feature.properties?.image || '' }, 0);
    setActive(0);
    updateCompass();
  }).catch(error => {
    if (!closed) status.textContent = error.message || 'Het verhaal kan niet worden geladen.';
  });
  return close;
}
