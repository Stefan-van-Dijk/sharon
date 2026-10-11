import { focusTextField } from './TextInputFocus.js?v=0.1.95';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.1.95';
import { mountLocationArea } from './LocationAreaPreview.js?v=0.1.95';

export function keyboardInset(viewport, layoutHeight) {
  if (!viewport || !Number.isFinite(layoutHeight)) return 0;
  return Math.max(0, Math.round(layoutHeight - Number(viewport.offsetTop || 0) - Number(viewport.height || 0)));
}

export function nearbyKnownLocations(point, known = [], accuracy = 0) {
  if (!Number.isFinite(Number(point?.lat)) || !Number.isFinite(Number(point?.lng))) return [];
  return known.filter(place => place.address && place.coordinates)
    .map(place => ({
      ...place,
      meters: distanceBetween(point, place.coordinates)
    }))
    .filter(place => place.meters <= Math.max(75, Math.min(200, Number(place.radiusM || 100) + Number(accuracy || 0))))
    .sort((a, b) => a.meters - b.meters);
}

const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);
const clampRadius = n => Math.min(2000, Math.max(20, Math.round(Number(n) || 100) / 10 * 10));
const finitePoint = point => point && Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng))
  ? { lat: Number(point.lat), lng: Number(point.lng) } : null;

/**
 * Short question / answer at the start, followed by one directly editable overview.
 * The existing form, its GPS tools and its save handler are not replaced.
 */
export function enhanceLocationEditor(root, {
  isNew = false, location, geocoder, useGps = false,
  knownLocations = [], initialParent = '', onModeChange = () => {},
  saveInHeader = false
} = {}) {
  const page = root.querySelector('.location-editor-view');
  const form = page?.querySelector('[data-location-form]');
  if (!page || !form || form.dataset.guided === '1') return () => {};
  form.dataset.guided = '1';
  page.classList.add('sh-location-dialog');
  page.querySelector('.sh-location-editor-nav')?.classList.add('sh-location-dialog-nav');

  const field = name => form.elements[name]?.closest('label');
  const nameField = field('title');
  const parentField = field('parentId');
  const addressField = form.querySelectorAll('.sh-location-group')[0];
  const coordsField = form.querySelectorAll('.sh-location-group')[1];
  const kindField = field('kind');
  const rideField = field('shareRide');
  const radiusField = field('radiusM');
  const triggerField = form.querySelector('.clean-section');
  const distanceField = form.querySelector('.location-check');
  const statusField = form.querySelector('[data-editor-status]');
  const saveButton = form.querySelector('[type="submit"]');
  const extras = page.querySelector('.sh-location-secondary-actions');
  const merge = page.querySelector('[data-merge-panel]');
  const eligible = knownLocations.filter(item => item.address);
  let mode = isNew ? 'start' : 'details';
  let disposed = false;
  let detecting = false;
  let gpsAccuracy = 0;
  let mapPreview = null;
  let activeCandidates = [];
  let chosenParentId = initialParent || '';
  let addressTouched = false;
  let nameTouched = false;
  let programmaticChange = false;

  const box = document.createElement('div');
  box.className = 'sh-location-dialog-content';
  box.innerHTML = '<section class="sh-location-question" data-question>' +
    '<p class="sh-location-question-title" data-question-title></p>' +
    '<div data-question-actions></div><p class="story-note" data-question-feedback role="status"></p>' +
    '</section>' +
    '<section class="sh-location-review" data-review hidden>' +
      '<p class="sh-location-question-title">Klopt deze plek?</p>' +
      '<div data-review-fields></div>' +
      '<div class="sh-radius-editor" data-radius-editor>' +
        '<label for="shLocationRadius">Herkenningsgebied <span data-radius-value></span></label>' +
        '<input id="shLocationRadius" type="range" min="20" max="2000" step="10" data-radius-range aria-label="Herkenningsstraal in meter">' +
        '<div class="sh-radius-map-host" data-radius-map></div>' +
        '<p class="story-note">De rand vervaagt door GPS-onzekerheid. De ingestelde straal blijft de richtwaarde voor herkenning.</p>' +
      '</div><div data-review-more></div>' +
    '</section>' +
    '<nav class="sh-location-question-footer" data-footer>' +
      '<button type="button" class="story-text-action" data-question-back>Terug</button>' +
      '<button type="button" class="story-primary-action" data-question-next>Verder</button>' +
    '</nav>';
  form.prepend(box);

  const question = box.querySelector('[data-question]');
  const title = box.querySelector('[data-question-title]');
  const questionActions = box.querySelector('[data-question-actions]');
  const feedback = box.querySelector('[data-question-feedback]');
  const review = box.querySelector('[data-review]');
  const reviewFields = box.querySelector('[data-review-fields]');
  const reviewMore = box.querySelector('[data-review-more]');
  const footer = box.querySelector('[data-footer]');
  const back = box.querySelector('[data-question-back]');
  const next = box.querySelector('[data-question-next]');
  const radiusRange = box.querySelector('[data-radius-range]');
  const radiusValue = box.querySelector('[data-radius-value]');
  const radiusHost = box.querySelector('[data-radius-map]');

  // Same form controls and one source of truth, with address shown exactly once.
  reviewFields.append(nameField, addressField, parentField, kindField, coordsField);
  const gpsSummary = document.createElement('div');
  gpsSummary.className = 'sh-location-gps-summary';
  gpsSummary.setAttribute('data-gps-summary', '');
  coordsField.before(gpsSummary);
  const coordDetails = document.createElement('details');
  coordDetails.className = 'sh-location-coordinate-details';
  coordDetails.innerHTML = '<summary>GPS-coördinaten aanpassen</summary>';
  coordsField.replaceWith(coordDetails);
  coordDetails.append(coordsField);
  // Native radius input stays in the form for existing persistence & trigger logic.
  radiusField.classList.add('sh-radius-original-field');
  reviewMore.append(radiusField, rideField, triggerField, distanceField);
  if (extras) reviewMore.append(extras);
  if (merge) reviewMore.append(merge);
  if (statusField) reviewMore.append(statusField);
  saveButton.classList.add('sh-location-dialog-native-save');
  reviewMore.append(saveButton);

  const knownById = new Map(eligible.map(x => [x.id, x]));
  const validParent = id => Boolean(knownById.get(id));
  // Creating a sublocation is only possible beneath an already selected
  // saved address. Parent options without any known address are disabled.
  for (const option of Array.from(form.elements.parentId.options)) {
    if (option.value && !validParent(option.value)) option.disabled = true;
  }
  if (isNew && !validParent(initialParent)) form.elements.parentId.value = '';
  parentField.hidden = !eligible.length;
  const change = (field, value) => {
    if (String(field.value || '') !== String(value ?? '')) {
      field.value = value ?? '';
      programmaticChange = true;
      try { field.dispatchEvent(new Event('input', { bubbles: true })); }
      finally { programmaticChange = false; }
    }
  };
  function currentPoint() {
    const own = finitePoint({ lat: form.elements.lat.value, lng: form.elements.lng.value });
    // Blank fields must not silently resolve to [0,0].
    if (String(form.elements.lat.value).trim() && String(form.elements.lng.value).trim()) return own;
    const parent = knownById.get(form.elements.parentId.value);
    return parent?.coordinates || null;
  }
  function syncCoordinates() {
    const point = currentPoint();
    gpsSummary.textContent = point
      ? point.lat.toFixed(5) + ', ' + point.lng.toFixed(5) +
        (gpsAccuracy ? ' · GPS ±' + Math.round(gpsAccuracy) + ' m' : '')
      : 'Geen GPS-positie gekozen';
    radiusHost.hidden = !point;
    if (point && mode === 'details') startMap();
  }
  function setStatus(message) {
    if (statusField) statusField.textContent = message || '';
  }
  function notify(modeValue) {
    onModeChange(modeValue);
  }

  const questionButton = (text, dataset, subtle = false) =>
    '<button type="button" class="sh-location-answer' + (subtle ? ' is-subtle' : '') +
    '" data-answer="' + esc(dataset) + '">' + esc(text) + '<span aria-hidden="true">›</span></button>';

  function showStart() {
    if (disposed) return;
    mode = 'start';
    notify(mode);
    review.hidden = true; question.hidden = false;
    footer.hidden = false; back.hidden = true; next.hidden = false;
    title.textContent = 'Waar ligt deze plek?';
    questionActions.replaceChildren();
    questionActions.innerHTML =
      questionButton('Gebruik huidige locatie', 'gps') +
      '<div class="sh-location-or">of</div>' +
      '<label class="clean-field sh-location-question-name"><span>Naam van de plek</span></label>' +
      (eligible.length ? questionButton('Bestaande locatie kiezen', 'existing', true) : '');
    questionActions.querySelector('.sh-location-question-name').append(nameField.querySelector('input'));
    // Keep the label and its input in the original form, avoiding duplicate fields.
    feedback.textContent = '';
    next.textContent = 'Verder';
    next.hidden = false;
    form.closest('.app-view')?.scrollTo({ top: 0, behavior: 'auto' });
  }

  function showDecision(candidates) {
    if (disposed) return;
    mode = 'decision';
    notify(mode);
    activeCandidates = candidates?.length ? candidates.filter(x => validParent(x.id)) : eligible;
    review.hidden = true; question.hidden = false;
    footer.hidden = false; back.hidden = false; next.hidden = true;
    const first = activeCandidates[0];
    title.textContent = first && activeCandidates.length === 1
      ? 'Hoort deze plek bij ' + first.title + '?'
      : 'Is dit een sublocatie?';
    questionActions.innerHTML =
      '<p class="story-note">Een sublocatie hoort bij een bestaande locatie met een adres.</p>' +
      (activeCandidates.length ? '<div class="sh-location-known-list">' +
        activeCandidates.map(x => questionButton('Sublocatie van ' + x.title, 'parent:' + x.id)).join('') +
        '</div>' : '<p class="story-note">Er zijn nog geen locaties met een adres.</p>') +
      questionButton('Nieuwe hoofdlocatie', 'main', true);
    feedback.textContent = '';
    form.closest('.app-view')?.scrollTo({ top: 0, behavior: 'auto' });
  }

  function setParent(id) {
    const validId = validParent(id) ? id : '';
    chosenParentId = validId;
    change(form.elements.parentId, validId);
    parentField.hidden = !eligible.length;
  }

  function showDetails({ focusName = false } = {}) {
    if (disposed) return;
    if (mode === 'start') {
      const typedName = questionActions.querySelector('.sh-location-question-name input');
      if (typedName && typedName !== form.elements.title) return;
    }
    if (!nameField.contains(form.elements.title)) nameField.append(form.elements.title);
    mode = 'details';
    notify(mode);
    question.hidden = true; review.hidden = false; footer.hidden = true;
    radiusRange.value = String(form.elements.radiusM.value || 100);
    radiusValue.textContent = radiusRange.value + ' m';
    syncCoordinates();
    form.closest('.app-view')?.scrollTo({ top: 0, behavior: 'auto' });
    if (focusName) focusTextField(form.elements.title);
    else if (form.contains(document.activeElement)) document.activeElement.blur();
  }

  async function startMap() {
    if (disposed || mapPreview || !currentPoint()) return;
    mapPreview = mountLocationArea(radiusHost, {
      getPoint: currentPoint,
      getRadius: () => Number(form.elements.radiusM.value),
      getAccuracy: () => gpsAccuracy
    });
    await mapPreview.update();
  }

  function handleAnswer(answer) {
    if (answer === 'gps') { useCurrentPosition(); return; }
    if (answer === 'existing') { showDecision(eligible); return; }
    if (answer === 'main') { setParent(''); showDetails({ focusName: !form.elements.title.value.trim() }); return; }
    if (answer.startsWith('parent:')) {
      const parentId = answer.slice(7);
      if (!validParent(parentId)) { feedback.textContent = 'Kies een bestaande locatie met adres.'; return; }
      setParent(parentId);
      showDetails({ focusName: !form.elements.title.value.trim() });
    }
  }

  async function useCurrentPosition() {
    if (detecting || disposed) return;
    detecting = true;
    feedback.textContent = 'Locatie bepalen…';
    const pressed = question.querySelector('[data-answer="gps"]');
    if (pressed) pressed.disabled = true;
    form.elements.title.blur();
    try {
      const point = await location.checkNow({
        reason: 'location-editor', maxAgeMs: 0, highAccuracy: true,
        browserMaxAgeMs: 0, timeoutMs: 10_000
      });
      if (disposed || !form.isConnected) return;
      gpsAccuracy = Number(point.accuracy) || 0;
      change(form.elements.lat, point.lat);
      change(form.elements.lng, point.lng);
      if (!nameTouched && !form.elements.title.value.trim()) change(form.elements.title, 'Huidige locatie');
      // Contextual sublocation prompt only when a known addressed place is nearby.
      const near = nearbyKnownLocations(point, eligible, gpsAccuracy);
      if (near.length) showDecision(near);
      else showDetails();
      if (geocoder?.reverse) {
        // Do not hold the UI while the address service is responding.
        try {
          const result = await geocoder.reverse(point);
          if (disposed || !form.isConnected || !result) return;
          const line1 = result.line1 || [result.street, result.number].filter(Boolean).join(' ');
          const line2 = result.line2 || [result.postcode, result.city].filter(Boolean).join(' ');
          const full = [line1, line2].filter(Boolean).join(', ');
          if (full && !addressTouched && !form.elements.address.value.trim()) {
            change(form.elements.address, full);
          }
          if (!nameTouched && form.elements.title.value === 'Huidige locatie') {
            change(form.elements.title, String(line1 || result.city || 'Huidige locatie').slice(0, 80));
          }
          syncCoordinates();
        } catch {}
      }
    } catch (error) {
      if (!disposed) feedback.textContent = error.message || 'De locatie kon niet worden bepaald.';
    } finally {
      detecting = false;
      if (pressed?.isConnected) pressed.disabled = false;
    }
  }

  function continueManual() {
    if (!String(form.elements.title.value || '').trim()) {
      feedback.textContent = 'Hoe noem je deze plek?';
      focusTextField(form.elements.title);
      return;
    }
    setParent(validParent(chosenParentId) ? chosenParentId : '');
    showDetails();
  }

  // Enter on the first question moves to editing, not to premature saving.
  form.addEventListener('submit', event => {
    if (mode === 'details') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (mode === 'start') continueManual();
  }, true);
  form.elements.title.addEventListener('keydown', event => {
    if (event.key === 'Enter' && mode === 'start') {
      event.preventDefault();
      continueManual();
    }
  });
  question.addEventListener('click', event => {
    const target = event.target.closest('[data-answer]');
    if (target) handleAnswer(target.dataset.answer);
  });
  next.addEventListener('click', continueManual);
  back.addEventListener('click', showStart);
  form.elements.title.addEventListener('input', () => { if (!programmaticChange) nameTouched = true; });
  form.elements.address.addEventListener('input', () => { if (!programmaticChange) addressTouched = true; });
  ['lat','lng','parentId'].forEach(field =>
    form.elements[field]?.addEventListener('input', () => { syncCoordinates(); mapPreview?.update(); }));
  radiusRange.addEventListener('input', () => {
    change(form.elements.radiusM, radiusRange.value);
    radiusValue.textContent = radiusRange.value + ' m';
    mapPreview?.refresh();
  });
  form.elements.radiusM.addEventListener('input', () => {
    radiusRange.value = String(clampRadius(form.elements.radiusM.value));
    radiusValue.textContent = radiusRange.value + ' m';
    mapPreview?.refresh();
  });
  const triggerSwitch = triggerField?.querySelector('[name="triggerEnabled"]');
  triggerSwitch?.addEventListener('change', event => {
    if (event.currentTarget.checked) focusTextField(form.elements.triggerMessage);
  });
  // The top-right button becomes the sole save action when available.
  if (saveInHeader) saveButton.hidden = true;

  const viewport = window.visualViewport;
  const resize = () => {
    if (disposed || !footer.isConnected) return;
    footer.style.setProperty('--sh-keyboard-inset', keyboardInset(viewport, window.innerHeight) + 'px');
  };
  viewport?.addEventListener('resize', resize);
  viewport?.addEventListener('scroll', resize);
  window.addEventListener('resize', resize);
  resize();

  function cleanup() {
    disposed = true;
    viewport?.removeEventListener('resize', resize);
    viewport?.removeEventListener('scroll', resize);
    window.removeEventListener('resize', resize);
    mapPreview?.dispose();
    mapPreview = null;
  }
  if (!isNew) showDetails();
  else if (initialParent && validParent(initialParent)) showDecision([knownById.get(initialParent)]);
  else if (useGps) { showStart(); useCurrentPosition(); }
  else showStart();

  return cleanup;
}
