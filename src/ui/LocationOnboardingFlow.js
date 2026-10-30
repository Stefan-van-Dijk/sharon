import { mountLocationTypeSphere } from './LocationTypeSphere.js?v=0.4.37';
import { focusTextField } from './TextInputFocus.js?v=0.4.37';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.4.37';
import { mountLocationArea } from './LocationAreaPreview.js?v=0.4.37';
import { locationConclusion, typeLocationConclusion } from './LocationConclusion.js?v=0.4.37';

export function keyboardInset(viewport, layoutHeight) {
  if (!viewport || !Number.isFinite(layoutHeight)) return 0;
  return Math.max(0, Math.round(layoutHeight - Number(viewport.offsetTop || 0) - Number(viewport.height || 0)));
}

// A proposal, not a forced hierarchy: nearby saved addresses are ranked
// first and the user can always choose a different parent or a main location.
export function nearbyKnownLocations(point, known = [], accuracy = 0) {
  if (!Number.isFinite(Number(point?.lat)) || !Number.isFinite(Number(point?.lng))) return [];
  return known.filter(item => item.address && item.coordinates)
    .map(item => ({ ...item, meters: distanceBetween(point, item.coordinates) }))
    .filter(item => item.meters <= Math.max(75, Math.min(200, Number(item.radiusM || 100) + Number(accuracy || 0))))
    .sort((a, b) => a.meters - b.meters);
}
export function suggestedParents(point, places = [], selectedId = '') {
  const ranked = places.filter(place => place.address)
    .map(place => ({
      ...place,
      meters: point && place.coordinates ? distanceBetween(point, place.coordinates) : Infinity
    }))
    .sort((a, b) => a.meters - b.meters || String(a.title).localeCompare(String(b.title), 'nl'));
  const selected = ranked.find(item => item.id === selectedId);
  return [selected, ...ranked].filter((item, index, list) =>
    item && list.findIndex(other => other?.id === item.id) === index).slice(0, 3);
}
const validPoint = point => {
  const lat = Number(point?.lat), lng = Number(point?.lng);
  return point?.lat != null && point?.lng != null &&
    String(point.lat).trim() !== '' && String(point.lng).trim() !== '' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

// A nearby match is a suggestion, never an automatic merge or replacement.
export function existingLocationAtGps(point, savedLocations = [], accuracy = 0) {
  const gps = validPoint(point);
  if (!gps) return null;
  const margin = Math.max(45, Math.min(90, (Number(accuracy) || 0) + 20));
  return savedLocations
    .filter(item => validPoint(item.coordinates))
    .map(item => ({ ...item, meters: distanceBetween(gps, item.coordinates) }))
    .filter(item => item.meters <= Math.min(Math.max(35, Number(item.radiusM) || 100), margin))
    .sort((a, b) => a.meters - b.meters)[0] || null;
}

// Match against actual recognition radii, without changing the chosen parent.
export function parentCandidatesWithinRadius(point, places = []) {
  const gps = validPoint(point);
  if (!gps) return [];
  return places.filter(place => place.id && validPoint(place.coordinates))
    .map(place => {
      const meters = distanceBetween(gps, place.coordinates);
      const radiusM = Number(place.radiusM);
      return { ...place, meters, radiusM: Number.isFinite(radiusM) && radiusM > 0 ? radiusM : 100 };
    })
    .filter(place => place.meters <= place.radiusM)
    .sort((a,b) => a.radiusM - b.radiusM || a.meters - b.meters);
}

export function enhanceLocationEditor(root, {
  isNew = false, editMode = '', location, geocoder, useGps = false,
  knownLocations = [], savedLocations = [], initialParent = '', onModeChange = () => {}, saveInHeader = false,
  onOpenExisting = () => {}, events = null
} = {}) {
  const page = root.querySelector('.location-editor-view');
  const form = page?.querySelector('[data-location-form]');
  if (!form || form.dataset.guided === '1') return () => {};
  form.dataset.guided = '1';
  page.classList.add('sh-location-reference');
  const nav = page.querySelector('.sh-location-editor-nav');
  nav?.classList.add('sh-location-reference-nav');

  const nameLabel = form.elements.title.closest('label');
  const parentLabel = form.elements.parentId.closest('label');
  const typeLabel = form.elements.kind.closest('label');
  const shareLabel = form.elements.shareRide.closest('label');
  const radiusLabel = form.elements.radiusM.closest('label');
  const addressGroup = form.querySelectorAll('.sh-location-group')[0];
  const coordinatesGroup = form.querySelectorAll('.sh-location-group')[1];
  const gpsButton = coordinatesGroup.querySelector('[data-current-gps]');
  const triggerGroup = form.querySelector('.clean-section');
  const distanceGroup = form.querySelector('.location-check');
  const status = form.querySelector('[data-editor-status]');
  const nativeSave = form.querySelector('[type="submit"]');
  const extras = page.querySelector('.sh-location-secondary-actions');
  const merge = page.querySelector('[data-merge-panel]');
  const typeSelect = form.elements.kind;
  const parentSelect = form.elements.parentId;
  // An existing location must never suggest itself as a nearby parent.
  // Also exclude its descendants, which cannot legally become its parent.
  const descendants = new Set();
  if (!isNew && location?.id) {
    descendants.add(location.id);
    let previousSize;
    do {
      previousSize = descendants.size;
      for (const candidate of knownLocations) {
        if (descendants.has(candidate.parentId || candidate.data?.parentId)) descendants.add(candidate.id);
      }
    } while (descendants.size !== previousSize);
  }
  const eligible = knownLocations.filter(candidate => !descendants.has(candidate.id));
  const byId = new Map(eligible.map(item => [item.id, item]));
  let disposed = false, mapView = null, accuracy = 0, geocodeRequest = 0;
  let addressEditing = false, addressManuallyEdited = false, lastLookupAddress = '';
  let selectedExisting = null;
  let stopTyping = () => {};
  let previousConclusion = '';
  let stageMessage = '';
  let stageButton = null;

  // The reference image is a single page, not an onboarding questionnaire.
  const view = document.createElement('div');
  view.className = 'sh-location-reference-page';
  view.innerHTML = '<div class="sh-location-reference-heading">' +
      '<h2 data-location-conclusion aria-live="off"></h2>' +
    '</div>' +
    '<div class="sh-location-reference-existing" data-existing-location hidden>' +
      '<span data-existing-copy></span><button type="button" data-open-existing>Open bestaande locatie</button>' +
    '</div>' +
    '<section class="sh-location-parent-proposal" data-parent-proposal hidden>' +
      '<p class="sh-location-parent-help">Hoort deze plek bij een bestaande locatie?</p>' +
      '<div data-parent-proposal-options></div>' +
      '<button type="button" data-parent-other class="sh-location-parent-other">Andere locatie kiezen</button>' +
      '<div data-parent-manual hidden></div>' +
    '</section>' +
    '<div class="sh-location-reference-name" data-name-slot></div>' +
    '<button type="button" class="sh-location-reference-step-back" data-type-back hidden>‹ Naam aanpassen</button>' +
    '<div class="sh-location-reference-place">' +
      '<div class="sh-onboarding-place-caption">Je bent nu op:</div>' +
      '<button type="button" class="sh-location-reference-address" data-address-toggle aria-expanded="false">' +
        '<span class="sh-location-reference-marker" aria-hidden="true">⌖</span>' +
        '<span class="sh-location-reference-place-copy"><strong data-address-text>Geen adres geselecteerd</strong>' +
          '<small data-coordinates-text></small></span>' +
        '<span class="sh-location-reference-chevron" aria-hidden="true">›</span>' +
      '</button>' +
      '<div class="sh-location-reference-address-fields" data-address-fields hidden></div>' +
    '</div>' +
    '<p class="sh-onboarding-position-question" data-position-question>Klopt deze positie of wil je het aanpassen?</p>' +
    '<div class="sh-location-reference-map-panel">' +
      '<div class="sh-radius-map-host sh-location-reference-map" data-radius-map></div>' +
      '<div class="sh-location-reference-map-controls" data-map-controls></div>' +
      '<span class="sh-location-reference-map-hint" data-map-hint hidden>Sleep de pin of tik op de kaart.</span>' +
    '</div>' +
    '<div class="sh-onboarding-adjustment" data-place-adjustment>' +
      '<div class="story-location-arrows" aria-label="GPS-positie bijstellen">' +
        '<button type="button" data-sh-move="west" aria-label="2 meter west">←</button>' +
        '<button type="button" data-sh-move="north" aria-label="2 meter noord">↑</button>' +
        '<button type="button" data-sh-move="south" aria-label="2 meter zuid">↓</button>' +
        '<button type="button" data-sh-move="east" aria-label="2 meter oost">→</button>' +
      '</div>' +
      '<p class="story-location-tip">Tik op de kaart of verplaats de positie met 2 meter per stap.</p>' +
    '</div>' +
    '<div class="sh-location-reference-section" data-parent-section>' +
      '<h3>Onderdeel van <small data-parent-hint></small></h3>' +
      '<div class="sh-location-reference-chips" data-parent-chips></div>' +
      '<div class="sh-location-reference-parent-more" data-parent-more hidden></div>' +
    '</div>' +
    '<div class="sh-location-reference-section">' +
      '<h3>Wat voor plek is dit?</h3>' +
      '<div class="sh-location-reference-chips sh-location-reference-types" data-type-chips></div>' +
    '</div>' +
    '<div data-more-fields hidden></div>' +
    '<div data-location-editor-actions hidden></div>' +
    '<div class="sh-location-reference-status" data-status-slot></div>' +
    '<div class="sh-location-reference-bottom-save" data-bottom-save></div>';
  form.prepend(view);

  view.querySelector('[data-name-slot]').append(nameLabel);
  view.querySelector('[data-address-fields]').append(addressGroup);
  const coordinateDetails = document.createElement('details');
  coordinateDetails.className = 'sh-location-reference-coordinates-edit';
  coordinateDetails.innerHTML = '<summary>GPS-coördinaten handmatig aanpassen</summary>';
  coordinateDetails.append(coordinatesGroup);
  view.querySelector('[data-address-fields]').append(coordinateDetails);
  const mapControls = view.querySelector('[data-map-controls]');
  const positionButton = document.createElement('button');
  positionButton.type = 'button';
  positionButton.className = 'sh-location-reference-position-toggle';
  positionButton.textContent = '✎';
  positionButton.setAttribute('aria-label', 'Adres aanpassen');
  positionButton.title = 'Adres aanpassen';
  positionButton.setAttribute('aria-pressed', 'false');
  mapControls.append(gpsButton);
  gpsButton.textContent = '⌖';
  gpsButton.setAttribute('aria-label', 'Huidige GPS-positie');
  gpsButton.title = 'Huidige GPS-positie';
  gpsButton.hidden = false;
  const headingEdit = view.querySelector('[data-address-toggle]');
  headingEdit.parentElement.append(positionButton);
  // The complete hierarchy picker stays available under the secondary details.
  view.querySelector('[data-more-fields]').prepend(parentLabel);
  typeLabel.hidden = true;
  view.querySelector('[data-more-fields]').append(
    typeLabel, radiusLabel, shareLabel, triggerGroup, distanceGroup);
  radiusLabel.hidden = true; // Original numeric value is still what gets saved.
  const actionsSlot = view.querySelector('[data-location-editor-actions]');
  if (extras) actionsSlot.append(extras);
  if (merge) actionsSlot.append(merge);
  view.querySelector('[data-status-slot]').append(status);
  nativeSave.classList.add('sh-location-reference-save');
  view.querySelector('[data-bottom-save]').append(nativeSave);
  nativeSave.hidden = Boolean(saveInHeader);

  // Prevent the visually hidden select from blocking its original selection.
  const parentOptions = Array.from(parentSelect.options);
  for (const option of parentOptions) {
    const existingParent = !isNew && option.value === parentSelect.value;
    if (option.value && !byId.has(option.value) && !existingParent) option.disabled = true;
  }
  if (isNew && initialParent && byId.has(initialParent)) parentSelect.value = initialParent;

  const addressText = view.querySelector('[data-address-text]');
  const coordinatesText = view.querySelector('[data-coordinates-text]');
  const addressFields = view.querySelector('[data-address-fields]');
  const addressToggle = view.querySelector('[data-address-toggle]');
  const typeChips = view.querySelector('[data-type-chips]');
  const parentChips = view.querySelector('[data-parent-chips]');
  const parentSection = view.querySelector('[data-parent-section]');
  const actionsSlotForStage = view.querySelector('[data-location-editor-actions]');
  const mapHint = view.querySelector('[data-map-hint]');
  const conclusionElement = view.querySelector('[data-location-conclusion]');
  const existingNotice = view.querySelector('[data-existing-location]');
  const existingCopy = view.querySelector('[data-existing-copy]');
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  let positionEditing = false;
  const nameSlot = view.querySelector('[data-name-slot]');
  const hierarchyPanel = view.querySelector('[data-parent-proposal]');
  const hierarchyOptions = view.querySelector('[data-parent-proposal-options]');
  const manualParent = view.querySelector('[data-parent-manual]');
  let manualParentOpen = false;
  const guided = isNew || editMode === 'identity' || editMode === 'place';
  const typeSection = typeChips.closest('.sh-location-reference-section');

  function updateConclusion(animate = false) {
    const value = locationConclusion(
      form.elements.title.value, currentPoint(), location?.latest, form.elements.radiusM.value
    );
    if (guided && view.dataset.stage) return;
    if (value === previousConclusion) return;
    previousConclusion = value;
    stopTyping();
    conclusionElement.setAttribute('aria-label', value);
    stopTyping = typeLocationConclusion(conclusionElement, value, {
      reducedMotion: !animate || reducedMotion
    });
  }
  const mapHost = view.querySelector('[data-radius-map]');
  const statusNode = status;

  function currentPoint() {
    return validPoint({
      lat: form.elements.lat.value,
      lng: form.elements.lng.value
    }) || byId.get(parentSelect.value)?.coordinates || null;
  }
  function updateExistingNotice(point = validPoint({
    lat: form.elements.lat.value, lng: form.elements.lng.value
  })) {
    selectedExisting = isNew ? existingLocationAtGps(point, savedLocations, accuracy) : null;
    existingNotice.hidden = !selectedExisting;
    if (selectedExisting) {
      existingCopy.textContent = 'GPS-check: mogelijk al opgeslagen als “' +
        selectedExisting.title + '” (' + Math.round(selectedExisting.meters) + ' m verder).';
    }
  }
  view.querySelector('[data-open-existing]').addEventListener('click', () => {
    if (selectedExisting) onOpenExisting(selectedExisting.id);
  });
  function syncText() {
    const typed = String(form.elements.address.value || '').trim();
    const parent = byId.get(parentSelect.value);
    const text = typed || parent?.address || 'Tik om een adres in te voeren';
    addressText.textContent = text;
    const point = currentPoint();
    coordinatesText.textContent = point ? point.lat.toFixed(5) + ', ' + point.lng.toFixed(5) : 'Nog geen GPS-positie';
    if (isNew && view.dataset.stage === 'place') setNewLocationStage('place', false);
    else updateConclusion();
  }
  function changeInput(field, value) {
    field.value = String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function syncMap() {
    if (disposed) return;
    syncText();
    updateExistingNotice();
    if (!mapView) {
      mapView = mountLocationArea(mapHost, {
        getPoint: currentPoint,
        getRadius: () => Number(form.elements.radiusM.value),
        getAccuracy: () => accuracy,
        onRadiusChange: radius => {
          // Map zoom, not a separate slider, controls the stored radius.
          form.elements.radiusM.value = String(radius);
        },
        onPointChange: point => {
          if (!point || disposed) return;
          changeInput(form.elements.lat, point.lat.toFixed(7));
          changeInput(form.elements.lng, point.lng.toFixed(7));
          accuracy = 0; // A manually positioned pin is not an accuracy measurement.
          addressManuallyEdited = false;
          lastLookupAddress = '';
          ++geocodeRequest;
          syncText();
          renderParents();
          void reversePoint(point);
        }
      });
    }
    if (guided && (isNew || editMode === 'place')) mapView.setPositionEditable?.(true);
    void mapView.update();
  }
  function setAddressEditing(editing, focus = false) {
    addressEditing = editing;
    addressFields.hidden = !editing;
    addressToggle.setAttribute('aria-expanded', String(editing));
    addressToggle.querySelector('.sh-location-reference-chevron').textContent = editing ? '⌃' : '›';
    if (focus) focusTextField(form.elements.address);
    if (!editing) void lookupAddress();
  }
  async function lookupAddress() {
    const text = String(form.elements.address.value || '').trim();
    if (!text || !geocoder?.search || disposed || text === lastLookupAddress) return;
    lastLookupAddress = text;
    const myRequest = ++geocodeRequest;
    statusNode.textContent = 'GPS bij adres zoeken…';
    try {
      const results = await geocoder.search(text);
      if (disposed || myRequest !== geocodeRequest || !form.isConnected) return;
      const first = results?.find(p => validPoint(p));
      if (!first) {
        statusNode.textContent = 'Geen GPS gevonden bij dit adres. Controleer het adres.';
        return;
      }
      accuracy = 0;
      changeInput(form.elements.lat, first.lat);
      changeInput(form.elements.lng, first.lng);
      syncMap();
      renderParents();
      statusNode.textContent = 'GPS automatisch gevonden bij het adres. Controleer de positie.';
    } catch {
      if (!disposed && myRequest === geocodeRequest) {
        lastLookupAddress = '';
        statusNode.textContent = 'GPS bij adres niet beschikbaar. Probeer het opnieuw.';
      }
    }
  }
  async function reversePoint(point) {
    if (!geocoder?.reverse || disposed) return;
    const request = ++geocodeRequest;
    try {
      const result = await geocoder.reverse(point);
      if (disposed || request !== geocodeRequest || !form.isConnected) return;
      const a = [result?.street, result?.number].filter(Boolean).join(' ');
      const b = [result?.postcode, result?.city].filter(Boolean).join(' ');
      const text = [a || result?.line1, b || result?.line2].filter(Boolean).join(', ');
      if (text && !addressManuallyEdited) {
        changeInput(form.elements.address, text);
        syncText();
      }
    } catch { /* Map point is still valid without reverse geocoding. */ }
  }
  function createChip(value, label, selected, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sh-location-reference-chip';
    button.textContent = label;
    button.value = value;
    button.setAttribute('aria-pressed', String(selected));
    button.addEventListener('click', onClick);
    return button;
  }
  let typeSphere = null;
  function renderTypes() {
    if (typeSphere) return;
    typeChips.classList.add('story-location-graph', 'story-sphere');
    typeChips.setAttribute('aria-label', 'Draaibare cirkel voor locatietypen');
    typeSphere = mountLocationTypeSphere(typeChips, {
      selectedType: typeSelect.value,
      onSelect: id => {
        if (!id) return;
        typeSelect.value = id;
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  function renderParents() {
    const chosen = parentSelect.value;
    const point = currentPoint();
    const near = nearbyKnownLocations(point, eligible, accuracy);
    const selected = eligible.find(item => item.id === chosen);
    const suggestions = [selected, ...near].filter((item, index, list) =>
      item && list.findIndex(other => other?.id === item.id) === index).slice(0, 2);
    // For an isolated location we do not expose an unnecessary 'Hoofdlocatie'
    // choice. A parent can still be selected under 'Meer instellingen'.
    parentSection.hidden = suggestions.length === 0 && !chosen;
    const hint = view.querySelector('[data-parent-hint]');
    hint.textContent = near.length ? '· in de buurt' : '';
    parentChips.replaceChildren();
    if (parentSection.hidden) return;
    parentChips.append(createChip('', 'Hoofdlocatie', !chosen, () => {
      parentSelect.value = '';
      renderParents();
      syncMap();
    }));
    for (const entry of suggestions) {
      parentChips.append(createChip(entry.id, entry.title,
        chosen === entry.id, () => {
          parentSelect.value = entry.id;
          renderParents();
          syncMap();
        }));
    }
    if (eligible.length > suggestions.length) {
      parentChips.append(createChip('other', 'Andere…', false, () => {
        moreSettings.open = true;
        parentLabel.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        parentSelect.focus();
      }));
    }
  }

  // Default map interaction is navigation/zoom only. The saved GPS point is
  // protected until the user explicitly opts into editing.
  // The first onboarding map is directly adjustable: tap the map or use 2m arrows.
  // Its address edit control remains separate from the editable pin.
  positionButton.addEventListener('click', event => {
    event.stopPropagation();
    setAddressEditing(!addressEditing, !addressEditing);
  });
  view.querySelectorAll('[data-sh-move]').forEach(button => button.addEventListener('click', () => {
    const point = currentPoint();
    if (!point) return;
    const metres = 2;
    const latStep = metres / 111320;
    const lngStep = metres / (111320 * Math.max(0.01, Math.cos(point.lat * Math.PI / 180)));
    const direction = button.dataset.shMove;
    const next = {
      lat: point.lat + (direction === 'north' ? latStep : direction === 'south' ? -latStep : 0),
      lng: point.lng + (direction === 'east' ? lngStep : direction === 'west' ? -lngStep : 0)
    };
    changeInput(form.elements.lat, next.lat.toFixed(7));
    changeInput(form.elements.lng, next.lng.toFixed(7));
    addressManuallyEdited = false;
    ++geocodeRequest;
    syncMap();
    renderParents();
    void reversePoint(next);
  }));
  form.elements.title.addEventListener('input', () => updateConclusion());
  form.elements.address.addEventListener('input', () => {
    if (addressEditing) {
      addressManuallyEdited = true;
      lastLookupAddress = '';
      ++geocodeRequest; // An earlier result must never replace a newer typed address.
    }
    syncText();
  });
  // Search only after the user commits the address (blur, Enter, or closing the editor).
  // The public Nominatim service forbids per-keystroke autocomplete.
  form.elements.address.addEventListener('change', () => { void lookupAddress(); });
  form.elements.address.addEventListener('keydown', event => {
    if (event.key === 'Enter' && addressEditing) {
      event.preventDefault();
      form.elements.address.blur();
      setAddressEditing(false);
    }
  });
  addressToggle.addEventListener('click', () => setAddressEditing(!addressEditing, !addressEditing));
  parentSelect.addEventListener('change', () => { renderParents(); syncMap(); });
  [form.elements.lat, form.elements.lng].forEach(field =>
    field.addEventListener('input', () => { syncMap(); renderParents(); }));
  gpsButton.addEventListener('click', () => {
    // Existing LocationsView handler performs the actual GPS check.
    addressManuallyEdited = false;
    ++geocodeRequest;
  });
  const unsubscribeLocation = events?.on?.('location.changed', () => updateConclusion());
  form.addEventListener('sh-location-accuracy', event => {
    accuracy = Number(event.detail?.accuracy) || 0;
    updateConclusion();
    updateExistingNotice();
    mapView?.refresh();
    if (event.detail?.point && !addressManuallyEdited) void reversePoint(event.detail.point);
  });
  const triggerSwitch = triggerGroup?.querySelector('[name="triggerEnabled"]');
  triggerSwitch?.addEventListener('change', event => {
    if (event.currentTarget.checked) focusTextField(form.elements.triggerMessage);
  });

  async function checkSavedPlaceOnStart() {
    // Share the app-wide GPS reading rather than starting a second location watcher.
    if (!isNew || !location?.checkNow) return;
    try {
      const point = await location.checkNow({
        reason: 'new-location', maxAgeMs: 120_000, highAccuracy: true,
        browserMaxAgeMs: 30_000, timeoutMs: 8_000
      });
      if (disposed || !form.isConnected || !validPoint(point)) return;
      accuracy = Number(point.accuracy) || 0;
      // A sublocation may intentionally inherit its parent's position.
      // Never replace an address or GPS point already entered by the user.
      if (!initialParent && !String(form.elements.address.value).trim() &&
        !validPoint({ lat: form.elements.lat.value, lng: form.elements.lng.value }) &&
        !positionEditing) {
        changeInput(form.elements.lat, point.lat);
        changeInput(form.elements.lng, point.lng);
        form.dispatchEvent(new CustomEvent('sh-location-accuracy', {
          detail: { accuracy, point: { lat: point.lat, lng: point.lng } }
        }));
        syncMap();
      }
      updateExistingNotice(validPoint({
        lat: form.elements.lat.value, lng: form.elements.lng.value
      }) || point);
    } catch { /* GPS permission may be unavailable: address entry remains usable. */ }
  }

  function matchingParentChoices() {
    const matches = parentCandidatesWithinRadius(currentPoint(), eligible);
    const current = parentSelect.value && byId.get(parentSelect.value);
    return [current, ...matches].filter((place, i, all) =>
      place && all.findIndex(other => other?.id === place.id) === i);
  }
  function needsHierarchyChoice() {
    // Suggest a relationship only when a known location's recognition radius overlaps this point.
    // An existing parent remains saved, but does not by itself trigger the question.
    return parentCandidatesWithinRadius(currentPoint(), eligible).length > 0;
  }
  function renderHierarchyChoice() {
    const choices = matchingParentChoices();
    hierarchyOptions.replaceChildren();
    const add = (value, title, help) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-location-parent-choice';
      const strong = document.createElement('strong');
      strong.textContent = title;
      const small = document.createElement('small');
      small.textContent = help;
      button.append(strong, small);
      button.setAttribute('aria-pressed', String(parentSelect.value === value));
      button.addEventListener('click', () => {
        parentSelect.value = value;
        renderParents();
        if (editMode !== 'place') setNewLocationStage('name');
        else setNewLocationStage('parent', false);
      });
      hierarchyOptions.append(button);
    };
    for (const place of choices.slice(0,4)) {
      add(place.id, 'Onder ' + (place.title || 'deze locatie'),
        'Binnen herkenningsstraal' + (Number.isFinite(place.meters) ? ' · ' + Math.round(place.meters) + ' m verder' : ''));
    }
    add('', 'Zelfstandige locatie', 'Niet onder een andere locatie');
  }
  view.querySelector('[data-parent-other]').addEventListener('click', () => {
    manualParentOpen = !manualParentOpen;
    manualParent.hidden = !manualParentOpen;
    if (manualParentOpen) manualParent.append(parentLabel);
    else view.querySelector('[data-more-fields]').prepend(parentLabel);
    view.querySelector('[data-parent-other]').textContent = manualParentOpen
      ? 'Verberg andere locaties' : 'Andere locatie kiezen';
    if (view.dataset.stage === 'parent') setNewLocationStage('parent', false);
  });
  // The shared shell asks the active editor to navigate one guided step back.
  // Only leave the editor when its first step is already visible.
  const onNavigateBack = event => {
    if (!guided) return;
    const stage = view.dataset.stage;
    const previous = stage === 'type' ? 'name'
      : stage === 'name' ? (isNew ? (needsHierarchyChoice() ? 'parent' : 'place') : null)
      : stage === 'parent' ? 'place' : null;
    if (!previous) return;
    event.preventDefault();
    setNewLocationStage(previous, false);
  };
  view.addEventListener('sharon:navigate-back', onNavigateBack);
  function setNewLocationStage(stage, animate = true) {
    if (!guided) return;
    view.dataset.stage = stage;
    const placeReady = Boolean(currentPoint());
    hierarchyPanel.hidden = stage !== 'parent';
    if (stage === 'parent') renderHierarchyChoice();
    if (stage !== 'parent' && manualParentOpen) {
      manualParentOpen = false;
      manualParent.hidden = true;
      view.querySelector('[data-more-fields]').prepend(parentLabel);
      view.querySelector('[data-parent-other]').textContent = 'Andere locatie kiezen';
    }
    // Keep the name and the circular type picker on separate pages.
    nameSlot.hidden = stage !== 'name';
    const typeBack = view.querySelector('[data-type-back]');
    typeBack.hidden = stage !== 'type';
    typeSection.hidden = stage !== 'type';
    if (stage === 'type') requestAnimationFrame(() => typeSphere?.refresh());
    parentSection.hidden = true;
    // Secondary location actions remain reachable when editing the place,
    // without reviving the obsolete "Meer instellingen" accordion.
    actionsSlotForStage.hidden = stage !== 'parent' || isNew || editMode !== 'place';
    nativeSave.hidden = (isNew || editMode === 'identity' ? stage !== 'type' : editMode === 'place' ? true : false) || Boolean(saveInHeader);
    if (editMode === 'place') nativeSave.textContent = 'Bevestig locatie';
    const placeBlock = view.querySelector('.sh-location-reference-place');
    const mapBlock = view.querySelector('.sh-location-reference-map-panel');
    placeBlock.hidden = stage !== 'place';
    mapBlock.hidden = stage !== 'place';
    view.querySelector('[data-position-question]').hidden = stage !== 'place';
    view.querySelector('[data-place-adjustment]').hidden = stage !== 'place';
    existingNotice.hidden = stage !== 'place' || !selectedExisting;
    const message = stage === 'parent' ? 'Hoort deze plek bij een locatie die ik al ken?'
      : stage === 'place'
      ? (isNew ? 'Mag ik je iets laten zien?' : 'Waar ligt deze plek precies?')
      : stage === 'name'
        ? (isNew ? 'Hoe wil je deze plek noemen?' : 'Hoe wil je deze plek voortaan noemen?')
        : 'Wat is ' + (form.elements.title.value.trim() || 'deze plek') + ' voor jou?';
    if (message !== stageMessage) {
      stageMessage = message;
      stopTyping();
      conclusionElement.setAttribute('aria-label', message);
      stopTyping = typeLocationConclusion(conclusionElement, message, { reducedMotion: !animate || reducedMotion, speed: 30 });
    }
    if (stageButton) {
      stageButton.hidden = stage === 'type' || (stage === 'parent' && !manualParentOpen && editMode !== 'place') || (!isNew && editMode !== 'identity' && editMode !== 'place');
      stageButton.disabled = stage === 'place' ? !placeReady : stage === 'name' ? !form.elements.title.value.trim() : false;
      stageButton.textContent = stage === 'place' ? (needsHierarchyChoice() ? 'Verder naar relatie' : editMode === 'place' ? 'Bevestig locatie' : 'Verder naar naam') : stage === 'parent' && editMode === 'place' ? 'Bewaar relatie' : 'Verder';
    }
    if ((stage === 'name' || stage === 'type') && animate && stage === 'name') focusTextField(form.elements.title);
  }
  function advanceNewLocationStage() {
    if (!isNew && editMode !== 'identity' && editMode !== 'place') return;
    const stage = view.dataset.stage || 'place';
    if (stage === 'place' && (currentPoint() || editMode === 'place')) {
      if (needsHierarchyChoice()) setNewLocationStage('parent');
      else if (editMode === 'place') form.requestSubmit();
      else setNewLocationStage('name');
    }
    else if (stage === 'parent' && editMode === 'place') form.requestSubmit();
    else if (stage === 'parent') setNewLocationStage('name');
    else if (stage === 'name' && form.elements.title.value.trim()) setNewLocationStage('type');
  }
  if (isNew || editMode === 'identity' || editMode === 'place') {
    stageButton = document.createElement('button');
    stageButton.type = 'button';
    stageButton.className = 'primary-line-action';
    stageButton.dataset.locationNext = '';
    view.querySelector('[data-bottom-save]').prepend(stageButton);
    stageButton.addEventListener('click', advanceNewLocationStage);
    view.querySelector('[data-type-back]').addEventListener('click', () => setNewLocationStage('name', false));
    form.elements.title.addEventListener('input', () => {
      if (view.dataset.stage === 'name') setNewLocationStage('name', false);
      // Title is never edited on the type page.
    });
    form.elements.title.addEventListener('keydown', event => {
      if (event.key === 'Enter' && view.dataset.stage === 'name') {
        event.preventDefault();
        advanceNewLocationStage();
      }
    });
  }

  onModeChange('details');
  renderTypes();
  renderParents();
  updateConclusion(!isNew);
  syncText();
  syncMap();
  if (guided) setNewLocationStage(isNew || editMode === 'place' ? 'place' : 'name');
  if (useGps && !isNew) gpsButton.click();
  else if (isNew) void checkSavedPlaceOnStart();

  function cleanup() {
    view.removeEventListener('sharon:navigate-back', onNavigateBack);
    disposed = true;
    stopTyping();
    if (typeof unsubscribeLocation === 'function') unsubscribeLocation();
    ++geocodeRequest;
    mapView?.dispose();
    mapView = null;
  }
  return cleanup;
}
