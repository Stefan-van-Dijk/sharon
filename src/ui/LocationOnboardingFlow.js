import { focusTextField } from './TextInputFocus.js?v=0.1.98';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.1.98';
import { mountLocationArea } from './LocationAreaPreview.js?v=0.1.98';

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

export function enhanceLocationEditor(root, {
  isNew = false, location, geocoder, useGps = false,
  knownLocations = [], initialParent = '', onModeChange = () => {}, saveInHeader = false
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
  let addressEditing = false, addressManuallyEdited = false;

  // The reference image is a single page, not an onboarding questionnaire.
  const view = document.createElement('div');
  view.className = 'sh-location-reference-page';
  view.innerHTML = '<div class="sh-location-reference-heading">' +
      '<h2>Is dit de plek?</h2>' +
      '<p>Controleer of de locatie klopt en pas aan indien nodig.</p>' +
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
      '<span class="sh-location-reference-map-hint">Versleep de pin om de positie aan te passen</span>' +
    '</div>' +
    '<div class="sh-location-reference-radius">' +
      '<label for="shReferenceRadius">Herkenningsstraal <strong data-radius-value>100 m</strong></label>' +
      '<input type="range" id="shReferenceRadius" min="20" max="2000" step="10" data-radius-range>' +
      '<div class="sh-location-reference-scale"><span>20 m</span><span>2.000 m</span></div>' +
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
  view.querySelector('[data-map-controls]').append(gpsButton);
  gpsButton.textContent = '⌖ Mijn locatie';
  view.querySelector('[data-parent-more]').append(parentLabel);
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
  const parentMore = view.querySelector('[data-parent-more]');
  const radiusRange = view.querySelector('[data-radius-range]');
  const radiusValue = view.querySelector('[data-radius-value]');
  const mapHost = view.querySelector('[data-radius-map]');
  const statusNode = status;

  function currentPoint() {
    return validPoint({
      lat: form.elements.lat.value,
      lng: form.elements.lng.value
    }) || byId.get(parentSelect.value)?.coordinates || null;
  }
  function syncText() {
    const typed = String(form.elements.address.value || '').trim();
    const parent = byId.get(parentSelect.value);
    const text = typed || parent?.address || 'Tik om een adres in te voeren';
    addressText.textContent = text;
    const point = currentPoint();
    coordinatesText.textContent = point ? point.lat.toFixed(5) + ', ' + point.lng.toFixed(5) : 'Nog geen GPS-positie';
  }
  function changeInput(field, value) {
    field.value = String(value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function syncMap() {
    if (disposed) return;
    syncText();
    if (!mapView) {
      mapView = mountLocationArea(mapHost, {
        getPoint: currentPoint,
        getRadius: () => Number(form.elements.radiusM.value),
        getAccuracy: () => accuracy,
        onPointChange: point => {
          if (!point || disposed) return;
          changeInput(form.elements.lat, point.lat.toFixed(7));
          changeInput(form.elements.lng, point.lng.toFixed(7));
          accuracy = 0; // A manually positioned pin is not an accuracy measurement.
          addressManuallyEdited = false;
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
    if (!text || !geocoder?.search || disposed) return;
    const myRequest = ++geocodeRequest;
    try {
      const results = await geocoder.search(text);
      if (disposed || myRequest !== geocodeRequest || !form.isConnected) return;
      const first = results?.find(p => validPoint(p));
      if (!first) return;
      changeInput(form.elements.lat, first.lat);
      changeInput(form.elements.lng, first.lng);
      syncMap();
      renderParents();
    } catch { /* Existing name/address remains editable offline. */ }
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
  function renderTypes() {
    typeChips.replaceChildren();
    for (const option of typeSelect.options) {
      typeChips.append(createChip(option.value, option.textContent,
        typeSelect.value === option.value, () => {
          typeSelect.value = option.value;
          renderTypes();
        }));
    }
  }
  function renderParents() {
    const chosen = parentSelect.value;
    const suggestions = suggestedParents(currentPoint(), eligible, chosen);
    const hint = view.querySelector('[data-parent-hint]');
    hint.textContent = suggestions[0]?.meters < 300
      ? '· in de buurt' : '';
    parentChips.replaceChildren();
    parentChips.append(createChip('', 'Hoofdlocatie', !chosen, () => {
      parentSelect.value = '';
      renderParents();
      syncMap();
    }));
    for (const entry of suggestions.slice(0, 2)) {
      parentChips.append(createChip(entry.id, entry.title,
        chosen === entry.id, () => {
          parentSelect.value = entry.id;
          renderParents();
          syncMap();
        }));
    }
    const remaining = eligible.length > 2;
    parentMore.hidden = !remaining && !chosen;
    if (remaining) {
      parentChips.append(createChip('other', 'Andere…', false, () => {
        parentMore.hidden = !parentMore.hidden;
        if (!parentMore.hidden) parentSelect.focus();
      }));
    }
    const nativeChoice = parentSelect.selectedOptions[0];
    if (chosen && !suggestions.slice(0, 2).some(x => x.id === chosen)) {
      parentMore.hidden = false;
      if (nativeChoice) {
        parentChips.append(createChip(chosen, nativeChoice.textContent, true, () => {
          parentMore.hidden = !parentMore.hidden;
        }));
      }
    }
  }

  radiusRange.value = form.elements.radiusM.value || '100';
  radiusValue.textContent = radiusRange.value + ' m';
  radiusRange.addEventListener('input', () => {
    changeInput(form.elements.radiusM, radiusRange.value);
    radiusValue.textContent = radiusRange.value + ' m';
    syncMap();
  });
  form.elements.radiusM.addEventListener('input', () => {
    radiusRange.value = form.elements.radiusM.value;
    radiusValue.textContent = radiusRange.value + ' m';
    syncMap();
  });
  form.elements.address.addEventListener('input', () => {
    if (addressEditing) addressManuallyEdited = true;
    syncText();
  });
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
  });
  form.addEventListener('sh-location-accuracy', event => {
    accuracy = Number(event.detail?.accuracy) || 0;
    mapView?.refresh();
    if (event.detail?.point && !addressManuallyEdited) void reversePoint(event.detail.point);
  });
  const triggerSwitch = triggerGroup?.querySelector('[name="triggerEnabled"]');
  triggerSwitch?.addEventListener('change', event => {
    if (event.currentTarget.checked) focusTextField(form.elements.triggerMessage);
  });

  // Retain all existing handlers, IDs, nested-location relationships and saving.
  onModeChange('details');
  renderTypes();
  renderParents();
  syncText();
  syncMap();
  if (useGps) gpsButton.click();

  function cleanup() {
    disposed = true;
    ++geocodeRequest;
    mapView?.dispose();
    mapView = null;
  }
  return cleanup;
}
