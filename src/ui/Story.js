import { sharonWordmark } from './Brand.js?v=0.1.42';
import { focusTextField } from './TextInputFocus.js?v=0.1.93';
import { environmentStyle } from './EnvironmentStyle.js?v=0.2.02';
import { loadSharonRenderer, createSharonMap } from './SharonMapRuntime.js?v=0.2.02';

import { LOCATION_GROUPS, LOCATION_TYPES, locationType } from '../core/location/LocationTypeRegistry.js?v=0.2.07';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function runStory(root, {
  name = '',
  location,
  geocoder
} = {}) {
  root.innerHTML = `
    <section class="story-layer" aria-label="Start met Sharon">
      <header class="story-brand" aria-label="Sharon">
        ${sharonWordmark({ mode: 'sharon', className: 'story-brand-vector', label: 'Sharon' })}
        <button type="button" class="story-save-position" data-use-current aria-label="Deze positie gebruiken" title="Deze positie gebruiken" hidden>✓</button>
      </header>

      <div class="story-content">
        <div class="story-copy" data-story-copy aria-live="polite"></div>
        <span class="type-caret" data-type-caret aria-hidden="true"></span>
        <div class="story-stage" data-story-stage></div>
      </div>
    </section>
  `;

  const copy = root.querySelector('[data-story-copy]');
  const caret = root.querySelector('[data-type-caret]');
  const stage = root.querySelector('[data-story-stage]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const intro = name
    ? [`Mag ik je iets laten zien, ${name}?`]
    : ['Mag ik je iets laten zien?'];

  await typeParagraphs(copy, intro, { reducedMotion });

  const detected = await detectPlace(stage, { location, geocoder });
  caret.hidden = true;

  const place = await choosePlace(stage, {
    detected,
    geocoder,
    location
  });

  const kind = await choosePlaceType(stage, place);

  stage.innerHTML = '';
  caret.hidden = false;
  copy.innerHTML = '';

  await typeParagraphs(copy, [
    'Goed. Sharon kan deze plek later herkennen.',
    'Bij herkenning kunnen triggers worden geactiveerd.',
    'Daarbij kan Sharon het moment combineren met eerdere keuzes en vastleggingen.'
  ], { reducedMotion });

  caret.hidden = true;

  stage.innerHTML = `
    <button type="button" class="story-continue" data-story-continue>Opslaan</button>
  `;

  await waitForClick(stage, '[data-story-continue]');

  return {
    place,
    kind,
    kindLabel: locationType(kind)?.label || 'Plek'
  };
}

async function detectPlace(stage, { location, geocoder }) {
  stage.innerHTML = `
    <div class="place-detecting">
      <span class="place-pulse" aria-hidden="true"></span>
      <span>Locatie controleren</span>
    </div>
  `;

  let point = null;

  try {
    point = await location.checkNow({
      reason: 'onboarding-place',
      maxAgeMs: 0,
      highAccuracy: true,
      browserMaxAgeMs: 0,
      timeoutMs: 10_000
    });

    if (point?.accuracy > 80) {
      await sleep(60);
      point = await location.checkNow({
        reason: 'onboarding-place-refine',
        maxAgeMs: 0,
        highAccuracy: true,
        browserMaxAgeMs: 0,
        timeoutMs: 10_000
      }).catch(() => point);
    }
  } catch (error) {
    stage.innerHTML = `
      <p class="story-note">Ik kon je huidige locatie niet bepalen.</p>
      <button type="button" class="story-text-action" data-other-place>Andere plek kiezen</button>
    `;
    await waitForClick(stage, '[data-other-place]');
    return null;
  }

  let address = null;
  try {
    address = await geocoder.reverse(point);
  } catch {}

  return {
    ...point,
    ...(address || {})
  };
}

async function choosePlace(stage, { detected, geocoder, location }) {
  let selected = detected;
  if (!selected) selected = await searchOtherPlace(stage, geocoder);
  if (!selected) return null;

  renderPlace(stage, selected, { showQuestion: true });
  const save = stage.closest('.story-layer')?.querySelector('[data-use-current]');
  if (save) save.hidden = false;
  const preview = await mountSuggestedPlaceMap(stage, selected, { geocoder, location });
  return new Promise(resolve => {
    const finish = async () => {
      if (save) save.hidden = true;
      const result = await preview.getSelected();
      preview.dispose();
      resolve(result);
    };
    save?.addEventListener('click', finish, { once: true });
  });
}

async function mountSuggestedPlaceMap(stage, initial, { geocoder, location }) {
  const host = stage.querySelector('[data-story-location-map]');
  const arrows = stage.querySelector('[data-story-location-arrows]');
  const gpsButton = stage.querySelector('[data-story-gps]');
  const editButton = stage.querySelector('[data-story-edit-address]');
  const editor = stage.querySelector('[data-story-address-editor]');
  const searchInput = editor?.querySelector('input');
  const status = stage.querySelector('[data-story-map-status]');
  let selected = { ...initial };
  let point = { lat: Number(initial.lat), lng: Number(initial.lng) };
  let disposed = false, requestId = 0, map = null, marker = null, lookupTimer = null, pendingLookup = null;
  const setStatus = message => { if (status) status.textContent = message; };
  const display = () => {
    const coordinates = stage.querySelector('.place-coordinates');
    if (coordinates) coordinates.textContent = formatCoordinates(point);
    const address = stage.querySelector('.place-address');
    if (address) {
      address.replaceChildren();
      for (const line of [selected.line1, selected.line2].filter(Boolean)) {
        const div = document.createElement('div');
        div.textContent = line;
        address.append(div);
      }
      if (!address.childElementCount) address.textContent = 'Adres onbekend';
    }
    marker?.setLngLat([point.lng, point.lat]);
    map?.easeTo({ center: [point.lng, point.lat], duration: 160 });
  };
  const lookupAddress = async token => {
    if (!geocoder?.reverse || disposed || token !== requestId) return;
    const lookupPoint = { ...point };
    setStatus('Adres bepalen…');
    try {
      const result = await geocoder.reverse(lookupPoint);
      if (disposed || token !== requestId) return;
      if (result?.line1 || result?.line2) {
        selected = { ...selected, ...result, ...lookupPoint };
        display();
        setStatus('');
      } else {
        setStatus('Geen adres gevonden voor deze positie. Coördinaten zijn wel bijgewerkt.');
      }
    } catch {
      if (token === requestId) setStatus('Adres ophalen mislukt. Probeer de positie opnieuw te selecteren.');
    }
  };
  const updatePoint = async (next, address = null) => {
    if (disposed || !Number.isFinite(Number(next?.lat)) || !Number.isFinite(Number(next?.lng))) return;
    const token = ++requestId;
    clearTimeout(lookupTimer);
    point = { lat: Number(next.lat), lng: Number(next.lng) };
    selected = { ...selected, ...point, accuracy: 0,
      line1: address?.line1 || '', line2: address?.line2 || '' };
    display();
    if (address) {
      selected = { ...selected, ...address, ...point };
      display();
      setStatus('');
      return;
    }
    setStatus('Adres bepalen…');
    pendingLookup = new Promise(resolve => {
      lookupTimer = setTimeout(() => {
        const work = lookupAddress(token);
        Promise.resolve(work).finally(resolve);
      }, 650);
    });
  };
  arrows?.addEventListener('click', event => {
    const direction = event.target.closest('[data-move]')?.dataset.move;
    if (!direction) return;
    const latStep = 2 / 111320;
    const lngStep = 2 / (111320 * Math.max(0.01, Math.cos(point.lat * Math.PI / 180)));
    void updatePoint({
      lat: Math.max(-90, Math.min(90, point.lat + (direction === 'north' ? latStep : direction === 'south' ? -latStep : 0))),
      lng: Math.max(-180, Math.min(180, point.lng + (direction === 'east' ? lngStep : direction === 'west' ? -lngStep : 0)))
    });
  });
  gpsButton?.addEventListener('click', async () => {
    gpsButton.disabled = true;
    setStatus('Huidige locatie bepalen…');
    try {
      const gps = await location.checkNow({
        reason: 'onboarding-recenter', maxAgeMs: 0, highAccuracy: true,
        browserMaxAgeMs: 0, timeoutMs: 10000
      });
      if (!disposed && gps) await updatePoint(gps);
    } catch { if (!disposed) setStatus('Huidige locatie niet beschikbaar.'); }
    finally { gpsButton.disabled = false; }
  });
  editButton?.addEventListener('click', () => {
    editor.hidden = !editor.hidden;
    editButton.setAttribute('aria-expanded', String(!editor.hidden));
    if (!editor.hidden) {
      searchInput.value = [selected.line1, selected.line2].filter(Boolean).join(', ');
      focusTextField(searchInput);
    }
  });
  editor?.addEventListener('submit', async event => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) return;
    const button = editor.querySelector('button');
    button.disabled = true;
    setStatus('Adres zoeken…');
    try {
      const results = await geocoder.search(query);
      const match = results?.find(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
      if (match) {
        await updatePoint(match, match);
        editor.hidden = true;
        editButton.setAttribute('aria-expanded', 'false');
        setStatus('');
      } else setStatus('Adres niet gevonden. Probeer een vollediger adres.');
    } catch { setStatus('Adres zoeken is tijdelijk niet beschikbaar.'); }
    finally { button.disabled = false; }
  });
  try {
    const lib = await loadSharonRenderer();
    if (!disposed && host?.isConnected) {
      map = createSharonMap(lib, {
        container: host, style: environmentStyle, center: [point.lng, point.lat], zoom: 18,
        interactive: true, dragPan: true, scrollZoom: true, touchZoomRotate: true,
        doubleClickZoom: true, dragRotate: false, pitchWithRotate: false,
        maxPitch: 0, attributionControl: { compact: true }
      });
      map.touchZoomRotate?.disableRotation?.();
      if (lib.Marker) {
        const pin = document.createElement('div');
        pin.className = 'sh-location-map-pin';
        marker = new lib.Marker({ element: pin, anchor: 'center', draggable: false })
          .setLngLat([point.lng, point.lat]).addTo(map);
      }
      map.on('click', event => {
        if (event.lngLat) void updatePoint({ lat: event.lngLat.lat, lng: event.lngLat.lng });
      });
    }
  } catch { setStatus('Kaart tijdelijk niet beschikbaar. Gebruik de pijltjes of het adres.'); }
  return {
    async getSelected() {
      clearTimeout(lookupTimer);
      if (pendingLookup) await lookupAddress(requestId);
      return { ...selected, ...point };
    },
    dispose() { disposed = true; ++requestId; clearTimeout(lookupTimer); marker?.remove(); map?.remove(); }
  };
}

function renderPlace(stage, place, { showQuestion = false } = {}) {
  stage.innerHTML = `
    <div class="detected-place story-address-block">
      <div class="story-address-heading">
        <div><div class="story-address-label">Je bent nu op:</div>
          <div class="place-address">
            ${place.line1 ? `<div>${escapeHtml(place.line1)}</div>` : ''}
            ${place.line2 ? `<div>${escapeHtml(place.line2)}</div>` : ''}
            ${!place.line1 && !place.line2 ? '<div>Adres onbekend</div>' : ''}
          </div>
          <div class="place-coordinates">${escapeHtml(formatCoordinates(place))}</div>
        </div>
        ${showQuestion ? '<button type="button" class="story-address-edit" data-story-edit-address aria-expanded="false" aria-label="Adres aanpassen" title="Adres aanpassen">✎</button>' : ''}
      </div>
      ${showQuestion ? '<form class="story-address-editor" data-story-address-editor hidden><input type="search" aria-label="Adres invoeren" placeholder="Straat, huisnummer en plaats" required><button type="submit">Zoeken</button></form>' : ''}
    </div>
    ${showQuestion ? `
      <p class="story-position-question">Klopt deze positie of wil je het aanpassen?</p>
      <div class="story-location-map-wrap">
        <div class="story-location-map" data-story-location-map aria-label="Locatie op de kaart"></div>
        <button type="button" class="story-map-gps" data-story-gps aria-label="Huidige locatie" title="Huidige locatie">⌖</button>
      </div>
      <div class="story-location-arrows" data-story-location-arrows aria-label="GPS-positie bijstellen">
        <button type="button" data-move="west" aria-label="2 meter west">←</button>
        <button type="button" data-move="north" aria-label="2 meter noord">↑</button>
        <button type="button" data-move="south" aria-label="2 meter zuid">↓</button>
        <button type="button" data-move="east" aria-label="2 meter oost">→</button>
      </div>
      <p class="story-location-tip">Tik op de kaart of verplaats de positie met 2 meter per stap.</p>
      <p class="story-map-status" data-story-map-status role="status"></p>
    ` : ''}
  `;
}

async function searchOtherPlace(stage, geocoder, fallback = null) {
  stage.innerHTML = `
    <form class="place-search" data-place-search>
      <label for="storyPlaceSearch">Welke plek wil je gebruiken?</label>
      <div class="place-search-line">
        <input id="storyPlaceSearch" name="query" type="search" autocomplete="street-address" enterkeyhint="search" required>
        <button type="submit">Zoek</button>
      </div>
    </form>
    <div class="place-results" data-place-results></div>
    ${fallback ? '<button type="button" class="story-text-action place-back" data-use-detected>Gebruik huidige plek</button>' : ''}
  `;

  const form = stage.querySelector('[data-place-search]');
  const results = stage.querySelector('[data-place-results]');
  focusTextField(form.querySelector('input[name="query"]'));

  return new Promise(resolve => {
    if (fallback) {
      stage.querySelector('[data-use-detected]').addEventListener('click', () => resolve(fallback));
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const query = String(new FormData(form).get('query') || '').trim();
      if (!query) return;

      const button = form.querySelector('button');
      button.disabled = true;
      results.innerHTML = '<p class="story-note">Plek zoeken…</p>';

      try {
        const matches = await geocoder.search(query);

        if (!matches.length) {
          results.innerHTML = '<p class="story-note">Geen plek gevonden.</p>';
          return;
        }

        results.innerHTML = matches.map((place, index) => `
          <button type="button" class="place-result" data-place-result="${index}">
            <span>
              ${place.line1 ? `<strong>${escapeHtml(place.line1)}</strong>` : ''}
              ${place.line2 ? `<small>${escapeHtml(place.line2)}</small>` : ''}
            </span>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M7.5 4.5 13 10l-5.5 5.5"/>
            </svg>
          </button>
        `).join('') + '<div class="place-source">Zoeken via OpenStreetMap</div>';

        results.querySelectorAll('[data-place-result]').forEach(item => {
          item.addEventListener('click', () => {
            resolve(matches[Number(item.dataset.placeResult)]);
          });
        });
      } catch (error) {
        results.innerHTML = `<p class="story-note">${escapeHtml(error.message)}</p>`;
      } finally {
        button.disabled = false;
      }
    });
  });
}

async function choosePlaceType(stage, place) {
  stage.innerHTML = '<div class="place-type"><p>Wat voor plek is dit?</p><p class="story-graph-hint">Tik op een thema om de bijbehorende plekken te vergroten. Kies daarna rechtstreeks een plek.</p><div class="story-location-graph" data-location-graph aria-label="Interactieve locatiecategorieën"></div></div>';
  const graph = stage.querySelector('[data-location-graph]');
  let active = null;
  const render = () => {
    graph.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'story-graph-board';
    const center = document.createElement('div');
    center.className = 'story-graph-center';
    center.textContent = 'Mijn plek';
    board.append(center);
    const count = LOCATION_GROUPS.length;
    LOCATION_GROUPS.forEach((group, i) => {
      const angle = -Math.PI / 2 + 2 * Math.PI * i / count;
      const focused = active === group.id;
      const muted = active && !focused;
      const x = 50 + 32 * Math.cos(angle), y = 48 + 30 * Math.sin(angle);
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'story-graph-node story-graph-group' + (focused ? ' is-active' : '') + (muted ? ' is-muted' : '');
      node.textContent = group.label;
      node.style.left = x + '%';
      node.style.top = y + '%';
      node.setAttribute('aria-pressed', String(focused));
      node.addEventListener('click', () => { active = focused ? null : group.id; render(); });
      board.append(node);
      const members = group.types.map(id => locationType(id)).filter(Boolean);
      members.forEach((type, j) => {
        const sub = document.createElement('button');
        sub.type = 'button';
        sub.className = 'story-graph-node story-graph-type' + (focused ? ' is-expanded' : '') + (muted ? ' is-muted' : '');
        sub.title = type.label;
        sub.setAttribute('aria-label', type.label);
        const radius = focused ? 17 : 9;
        const spread = (j - (members.length - 1) / 2) * (focused ? .56 : .45);
        const a = angle + spread;
        const sx = x + radius * Math.cos(a);
        const sy = y + radius * Math.sin(a);
        sub.style.left = Math.max(8,Math.min(92,sx)) + '%';
        sub.style.top = Math.max(6,Math.min(94,sy)) + '%';
        const symbol = document.createElement('span');
        symbol.className = 'story-graph-symbol';
        symbol.textContent = locationGlyph(type.icon);
        const label = document.createElement('span');
        label.className = 'story-graph-label';
        label.textContent = type.label;
        sub.append(symbol,label);
        sub.addEventListener('click', () => { graph.dispatchEvent(new CustomEvent('location-type-selected',{detail:type.id})); });
        board.append(sub);
      });
    });
    graph.append(board);
  };
  render();
  return new Promise(resolve => graph.addEventListener('location-type-selected', e => resolve(e.detail), { once: true }));
}
function locationGlyph(icon) {
  return ({
    house:'⌂', users:'♧', 'user-round':'◉', 'bed-double':'▤',
    briefcase:'▣', handshake:'◇', 'hard-hat':'▰', 'building-2':'▥',
    parking:'P', fuel:'⛽', 'train-front':'▦', basket:'▧',
    'shopping-bag':'▢', utensils:'♨', coffee:'☕', activity:'◈',
    'graduation-cap':'▱', 'heart-pulse':'♡', 'map-pin':'⌖'
  })[icon] || '•';
}

async function typeParagraphs(container, lines, { reducedMotion = false } = {}) {
  for (const line of lines) {
    const paragraph = document.createElement('p');
    container.append(paragraph);

    if (reducedMotion) {
      paragraph.textContent = line;
    } else {
      await typeLine(paragraph, line);
      await sleep(line.length > 45 ? 330 : 250);
    }
  }
}

async function typeLine(element, text) {
  for (let index = 0; index < text.length; index += 1) {
    element.textContent += text[index];

    const character = text[index];
    let delay = 27;

    if (character === '.' || character === ',' || character === ':') delay = 105;
    if (character === ' ') delay = 17;

    await sleep(delay);
  }
}

function waitForClick(root, selector) {
  return new Promise(resolve => {
    root.querySelector(selector)?.addEventListener('click', resolve, { once: true });
  });
}

function formatCoordinates(place) {
  const lat = Number(place?.lat);
  const lng = Number(place?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;'
  })[character]);
}
