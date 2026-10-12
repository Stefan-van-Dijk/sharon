import { sharonWordmark } from './Brand.js?v=0.1.42';
import { focusTextField } from './TextInputFocus.js?v=0.1.93';
import { environmentStyle } from './EnvironmentStyle.js?v=0.2.02';
import { loadSharonRenderer, createSharonMap } from './SharonMapRuntime.js?v=0.2.02';

const PLACE_TYPES = [
  { id: 'home', label: 'Thuis' },
  { id: 'work', label: 'Werk' },
  { id: 'customer', label: 'Klant' },
  { id: 'family', label: 'Familie' },
  { id: 'other', label: 'Anders' }
];

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
    ? [`Mag ik iets laten zien, ${name}?`, 'Ik begin met waar je nu bent.']
    : ['Mag ik iets laten zien?', 'Ik begin met waar je nu bent.'];

  await typeParagraphs(copy, intro, { reducedMotion });

  const detected = await detectPlace(stage, { location, geocoder });
  caret.hidden = true;

  const place = await choosePlace(stage, {
    detected,
    geocoder
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
    kindLabel: PLACE_TYPES.find(item => item.id === kind)?.label || 'Plek'
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

async function choosePlace(stage, { detected, geocoder }) {
  if (!detected) return searchOtherPlace(stage, geocoder);

  renderPlace(stage, detected, { showQuestion: true });
  const preview = await mountSuggestedPlaceMap(stage, detected);
  const selectedPoint = () => ({ ...detected, ...preview.point });

  return new Promise(resolve => {
    stage.addEventListener('click', async event => {
      const current = event.target.closest('[data-use-current]');
      if (current) {
        preview.dispose();
        const selected = selectedPoint();
        if (preview.changed && geocoder?.reverse) {
          try { Object.assign(selected, await geocoder.reverse(selected)); } catch {}
        }
        resolve(selected);
        return;
      }

      const other = event.target.closest('[data-other-place]');
      if (other) {
        preview.dispose();
        const selected = await searchOtherPlace(stage, geocoder, selectedPoint());
        resolve(selected);
      }
    }, { once: false });
  });
}

async function mountSuggestedPlaceMap(stage, initial) {
  const host = stage.querySelector('[data-story-location-map]');
  const arrows = stage.querySelector('[data-story-location-arrows]');
  let point = { lat: Number(initial.lat), lng: Number(initial.lng) };
  let changed = false;
  let disposed = false;
  let map = null;
  let marker = null;
  const showPosition = () => {
    const coordinates = stage.querySelector('.place-coordinates');
    if (coordinates) coordinates.textContent = formatCoordinates(point);
    marker?.setLngLat([point.lng, point.lat]);
    map?.easeTo({ center: [point.lng, point.lat], duration: 160 });
  };
  const setPoint = next => {
    if (disposed || !Number.isFinite(next.lat) || !Number.isFinite(next.lng)) return;
    point = next;
    changed = true;
    showPosition();
  };
  arrows?.addEventListener('click', event => {
    const direction = event.target.closest('[data-move]')?.dataset.move;
    if (!direction) return;
    const latStep = 2 / 111320;
    const lngStep = 2 / (111320 * Math.max(0.01, Math.cos(point.lat * Math.PI / 180)));
    setPoint({
      lat: Math.max(-90, Math.min(90, point.lat + (direction === 'north' ? latStep : direction === 'south' ? -latStep : 0))),
      lng: Math.max(-180, Math.min(180, point.lng + (direction === 'east' ? lngStep : direction === 'west' ? -lngStep : 0)))
    });
  });
  try {
    const lib = await loadSharonRenderer();
    if (disposed || !host?.isConnected) return { get point() { return point; }, get changed() { return changed; }, dispose() {} };
    map = createSharonMap(lib, {
      container: host, style: environmentStyle,
      center: [point.lng, point.lat], zoom: 18,
      interactive: true, dragPan: true, scrollZoom: true,
      touchZoomRotate: true, doubleClickZoom: true,
      dragRotate: false, pitchWithRotate: false, maxPitch: 0,
      attributionControl: { compact: true }
    });
    map.touchZoomRotate?.disableRotation?.();
    if (lib.Marker) {
      const pin = document.createElement('div');
      pin.className = 'sh-location-map-pin';
      marker = new lib.Marker({ element: pin, anchor: 'center', draggable: false })
        .setLngLat([point.lng, point.lat]).addTo(map);
    }
    map.on('click', event => {
      if (event.lngLat) setPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });
  } catch (error) {
    if (host) host.textContent = 'Kaart tijdelijk niet beschikbaar. Gebruik de pijltjes.';
  }
  return {
    get point() { return point; },
    get changed() { return changed; },
    dispose() { disposed = true; marker?.remove(); map?.remove(); }
  };
}

function renderPlace(stage, place, { showQuestion = false } = {}) {
  const coordinates = formatCoordinates(place);
  const hasAddress = Boolean(place.line1 || place.line2);

  stage.innerHTML = `
    ${showQuestion ? '<div class="story-location-map" data-story-location-map aria-label="Locatie op de kaart"></div><div class="story-location-arrows" data-story-location-arrows aria-label="GPS-positie bijstellen"><button type="button" data-move="west" aria-label="2 meter west">←</button><button type="button" data-move="north" aria-label="2 meter noord">↑</button><button type="button" data-move="south" aria-label="2 meter zuid">↓</button><button type="button" data-move="east" aria-label="2 meter oost">→</button></div><p class="story-location-tip">Tik op de kaart voor een precieze plek, of gebruik de pijltjes (2 m per stap).</p>' : ''}
    <div class="detected-place">
      <div class="place-coordinates">${escapeHtml(coordinates)}</div>
      ${hasAddress ? `
        <div class="place-address">
          ${place.line1 ? `<div>${escapeHtml(place.line1)}</div>` : ''}
          ${place.line2 ? `<div>${escapeHtml(place.line2)}</div>` : ''}
        </div>
        <div class="place-source">Adres via OpenStreetMap</div>
      ` : '<div class="story-note">Geen adres gevonden bij deze coördinaten.</div>'}
    </div>

    ${showQuestion ? `
      <div class="place-confirm">
        <p>Klopt deze positie?</p>
        <div class="story-actions">
          <button type="button" class="story-primary-action" data-use-current>Deze positie gebruiken</button>
          <button type="button" class="story-text-action" data-other-place>Andere plek kiezen</button>
        </div>
      </div>
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
  renderPlace(stage, place);

  const question = document.createElement('div');
  question.className = 'place-type';
  question.innerHTML = `
    <p>Wat voor plek is dit?</p>
    <div class="place-type-options">
      ${PLACE_TYPES.map(type => `
        <button type="button" data-place-type="${type.id}">${type.label}</button>
      `).join('')}
    </div>
  `;

  stage.append(question);

  return new Promise(resolve => {
    stage.addEventListener('click', event => {
      const type = event.target.closest('[data-place-type]');
      if (type) resolve(type.dataset.placeType);
    });
  });
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
