import { mountLocationTypeSphere } from './LocationTypeSphere.js?v=0.2.46';
import { focusTextField } from './TextInputFocus.js?v=0.2.20';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.2.20';
import { mountLocationArea } from './LocationAreaPreview.js?v=0.2.20';
import { locationConclusion, typeLocationConclusion } from './LocationConclusion.js?v=0.2.20';

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
  const eligible = knownLocations.filter(item => item.address);
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
    '<div class="sh-location-reference-name" data-name-slot></div>' +
    '<div class="sh-location-reference-place">' +
      '<button type="button" class="sh-location-reference-address" data-address-toggle aria-expanded="false">' +
        '<span class="sh-location-reference-marker" aria-hidden="true">⌖</span>' +
        '<span class="sh-location-reference-place-copy"><strong data-address-text>Geen adres geselecteerd</strong>' +
          '<small data-coordinates-text></small></span>' +
        '<span class="sh-location-reference-chevron" aria-hidden="true">›</span>' +
      '</button>' +
      '<div class="sh-location-reference-address-fields" data-address-fields hidden></div>' +
    '</div>' +
    '<div class="sh-location-reference-map-panel">' +
      '<div class="sh-radius-map-host sh-location-reference-map" data-radius-map></div>' +
      '<div class="sh-location-reference-map-controls" data-map-controls></div>' +
      '<span class="sh-location-reference-map-hint" data-map-hint hidden>Sleep de pin of tik op de kaart.</span>' +
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
    '<details class="sh-location-reference-more" data-more>' +
      '<summary>Meer instellingen</summary>' +
      '<div data-more-fields></div>' +
    '</details>' +
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
  positionButton.textContent = 'Positie wijzigen';
  positionButton.setAttribute('aria-pressed', 'false');
  mapControls.append(positionButton);
  mapControls.append(gpsButton);
  gpsButton.textContent = '⌖ Mijn locatie';
  gpsButton.hidden = true;
  // The complete hierarchy picker stays available under the secondary details.
  view.querySelector('[data-more-fields]').prepend(parentLabel);
  typeLabel.hidden = true;
  view.querySelector('[data-more-fields]').append(
    typeLabel, radiusLabel, shareLabel, triggerGroup, distanceGroup);
  radiusLabel.hidden = true; // Original numeric value is still what gets saved.
  if (extras) view.querySelector('[data-more-fields]').append(extras);
  if (merge) view.querySelector('[data-more-fields]').append(merge);
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
  const moreSettings = view.querySelector('[data-more]');
  const mapHint = view.querySelector('[data-map-hint]');
  const conclusionElement = view.querySelector('[data-location-conclusion]');
  const existingNotice = view.querySelector('[data-existing-location]');
  const existingCopy = view.querySelector('[data-existing-copy]');
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  let positionEditing = false;
  const nameSlot = view.querySelector('[data-name-slot]');
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
  positionButton.addEventListener('click', () => {
    positionEditing = !positionEditing;
    mapView?.setPositionEditable(positionEditing);
    gpsButton.hidden = !positionEditing;
    positionButton.textContent = positionEditing ? 'Gereed' : 'Positie wijzigen';
    positionButton.setAttribute('aria-pressed', String(positionEditing));
    mapHint.hidden = !positionEditing;
  });
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

  function setNewLocationStage(stage, animate = true) {
    if (!guided) return;
    view.dataset.stage = stage;
    const placeReady = Boolean(currentPoint());
    nameSlot.hidden = stage !== 'name' && stage !== 'type';
    typeSection.hidden = stage !== 'type';
    if (stage === 'type') requestAnimationFrame(() => typeSphere?.refresh());
    parentSection.hidden = true;
    moreSettings.hidden = stage !== 'type';
    nativeSave.hidden = (isNew || editMode === 'identity' ? stage !== 'type' : false) || Boolean(saveInHeader);
    const placeBlock = view.querySelector('.sh-location-reference-place');
    const mapBlock = view.querySelector('.sh-location-reference-map-panel');
    placeBlock.hidden = stage !== 'place';
    mapBlock.hidden = stage !== 'place';
    existingNotice.hidden = stage !== 'place' || !selectedExisting;
    const message = stage === 'place'
      ? (isNew ? (placeReady ? 'Ik heb deze plek gevonden. Klopt de locatie?' : 'Waar wil je deze plek vastleggen?') : 'Welke positie wil je aanpassen?')
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
      stageButton.hidden = stage === 'type' || (!isNew && editMode !== 'identity');
      stageButton.disabled = stage === 'place' ? !placeReady : stage === 'name' ? !form.elements.title.value.trim() : false;
      stageButton.textContent = stage === 'place' ? 'Bevestig locatie' : 'Verder';
    }
    if ((stage === 'name' || stage === 'type') && animate && stage === 'name') focusTextField(form.elements.title);
  }
  function advanceNewLocationStage() {
    if (!isNew && editMode !== 'identity') return;
    const stage = view.dataset.stage || 'place';
    if (stage === 'place' && currentPoint()) setNewLocationStage('name');
    else if (stage === 'name' && form.elements.title.value.trim()) setNewLocationStage('type');
  }
  if (isNew || editMode === 'identity') {
    stageButton = document.createElement('button');
    stageButton.type = 'button';
    stageButton.className = 'primary-line-action';
    stageButton.dataset.locationNext = '';
    view.querySelector('[data-bottom-save]').prepend(stageButton);
    stageButton.addEventListener('click', advanceNewLocationStage);
    form.elements.title.addEventListener('input', () => {
      if (view.dataset.stage === 'name') setNewLocationStage('name', false);
      else if (view.dataset.stage === 'type') setNewLocationStage('type', false);
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
    disposed = true;
    stopTyping();
    if (typeof unsubscribeLocation === 'function') unsubscribeLocation();
    ++geocodeRequest;
    mapView?.dispose();
    mapView = null;
  }
  return cleanup;
}
