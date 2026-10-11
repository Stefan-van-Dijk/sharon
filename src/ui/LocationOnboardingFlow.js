import { focusTextField } from './TextInputFocus.js?v=0.1.94';

// The location form remains the source of truth. Only its presentation changes:
// one simple opening choice, followed by a fully editable detected/manual place.
export function keyboardInset(viewport, layoutHeight) {
  if (!viewport || !Number.isFinite(layoutHeight)) return 0;
  const bottom = Number(viewport.offsetTop || 0) + Number(viewport.height || 0);
  if (!Number.isFinite(bottom)) return 0;
  return Math.max(0, Math.round(layoutHeight - bottom));
}

export function enhanceLocationEditor(root, {
  isNew = false, location, geocoder, useGps = false
} = {}) {
  const page = root.querySelector('.location-editor-view');
  const form = page?.querySelector('[data-location-form]');
  if (!page || !form || form.dataset.guided === '1') return () => {};
  form.dataset.guided = '1';
  page.classList.add('sh-location-simple');
  const nav = page.querySelector('.sh-location-editor-nav');
  nav.classList.add('sh-location-simple-nav');
  const fields = {
    name: form.querySelector('[name="title"]')?.closest('label'),
    parent: form.querySelector('[name="parentId"]')?.closest('label'),
    address: form.querySelectorAll('.sh-location-group')[0],
    gps: form.querySelectorAll('.sh-location-group')[1],
    kind: form.querySelector('[name="kind"]')?.closest('label'),
    share: form.querySelector('[name="shareRide"]')?.closest('label'),
    radius: form.querySelector('[name="radiusM"]')?.closest('label'),
    trigger: form.querySelector('.clean-section'),
    distance: form.querySelector('.location-check'),
    status: form.querySelector('[data-editor-status]'),
    save: form.querySelector('[type="submit"]')
  };
  const extra = page.querySelector('.sh-location-secondary-actions');
  const merge = page.querySelector('[data-merge-panel]');

  const wrapper = document.createElement('div');
  wrapper.className = 'sh-location-simple-layout';
  wrapper.innerHTML = '<section class="sh-location-simple-start" data-location-start>' +
    '<div class="story-copy sh-location-simple-question"><p>Welke plek?</p></div>' +
    '<p class="story-note">Kies je huidige locatie of geef zelf een naam op.</p>' +
    '<button type="button" class="sh-location-simple-current" data-location-detect>' +
      '<span class="sh-location-simple-position-symbol" aria-hidden="true">⌖</span>' +
      '<span>Gebruik huidige locatie</span><span aria-hidden="true">›</span></button>' +
    '<span class="sh-location-simple-or">of</span>' +
    '<div data-location-name-slot></div>' +
    '<p class="sh-location-simple-detect-status" data-location-detect-status role="status"></p>' +
    '</section>' +
    '<section class="sh-location-simple-details" data-location-details hidden>' +
    '<div class="story-copy sh-location-simple-question"><p>Controleer deze plek.</p></div>' +
    '<div class="detected-place sh-location-simple-preview" data-location-preview aria-live="polite"></div>' +
    '<div data-location-detail-name></div>' +
    '<div data-location-detail-fields></div>' +
    '<div data-location-detail-extra></div>' +
    '</section>' +
    '<div class="sh-location-simple-footer" data-location-footer>' +
    '<div class="sh-location-simple-footer-inner">' +
    '<button type="button" class="story-text-action" data-location-back hidden>Terug</button>' +
    '<button type="button" class="story-primary-action" data-location-continue>Verder</button>' +
    '</div></div>';
  form.prepend(wrapper);

  const start = wrapper.querySelector('[data-location-start]');
  const details = wrapper.querySelector('[data-location-details]');
  const footer = wrapper.querySelector('[data-location-footer]');
  const next = wrapper.querySelector('[data-location-continue]');
  const back = wrapper.querySelector('[data-location-back]');
  const detect = wrapper.querySelector('[data-location-detect]');
  const detectionStatus = wrapper.querySelector('[data-location-detect-status]');
  const preview = wrapper.querySelector('[data-location-preview]');
  const nameSlot = wrapper.querySelector('[data-location-name-slot]');
  const detailName = wrapper.querySelector('[data-location-detail-name]');
  const detailFields = wrapper.querySelector('[data-location-detail-fields]');
  const detailExtra = wrapper.querySelector('[data-location-detail-extra]');
  const status = fields.status;
  const save = fields.save;
  let showingDetails = false;
  let detecting = false;
  let destroyed = false;
  let foundAccuracy = null;

  nameSlot.append(fields.name);
  [
    fields.parent, fields.address, fields.gps, fields.kind,
    fields.share, fields.radius, fields.trigger, fields.distance
  ].forEach(element => { if (element) detailFields.append(element); });
  if (extra) detailExtra.append(extra);
  if (merge) detailExtra.append(merge);
  if (status) detailExtra.before(status);
  save.classList.add('sh-location-simple-submit');
  footer.querySelector('.sh-location-simple-footer-inner').append(save);

  function updatePreview() {
    if (destroyed) return;
    const addr = String(form.elements.address.value || '').trim();
    const lat = String(form.elements.lat.value || '').trim();
    const lng = String(form.elements.lng.value || '').trim();
    const coordinates = lat && lng
      ? Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5)
      : 'Geen eigen GPS-positie';
    preview.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'place-address';
    heading.textContent = addr || 'Geen eigen adres';
    const coords = document.createElement('div');
    coords.className = 'place-coordinates';
    coords.textContent = coordinates + (foundAccuracy == null ? '' : ' · ±' + foundAccuracy + ' m');
    preview.append(coords, heading);
  }

  const setStatus = text => { if (status) status.textContent = text; };
  function updateFooter() {
    next.hidden = showingDetails;
    back.hidden = !showingDetails || !isNew;
    save.hidden = !showingDetails;
  }
  function showDetails({ focusName = false } = {}) {
    showingDetails = true;
    start.hidden = true;
    details.hidden = false;
    detailName.prepend(fields.name);
    updateFooter();
    updatePreview();
    setStatus('');
    page.closest('.app-view')?.scrollTo({ top: 0, behavior: 'auto' });
    if (focusName) focusTextField(form.elements.title);
    else if (form.contains(document.activeElement)) document.activeElement.blur();
  }
  function showStart() {
    showingDetails = false;
    nameSlot.append(fields.name);
    start.hidden = false;
    details.hidden = true;
    updateFooter();
    setStatus('');
    focusTextField(form.elements.title);
  }

  function continueManually() {
    if (detecting) return;
    const title = String(form.elements.title.value || '').trim();
    if (!title) {
      detectionStatus.textContent = 'Geef deze plek eerst een naam.';
      focusTextField(form.elements.title);
      return;
    }
    showDetails();
  }

  async function useCurrentPosition() {
    if (detecting) return;
    if (!location?.checkNow) {
      detectionStatus.textContent = 'Locatiebepaling is niet beschikbaar. Vul zelf een naam in.';
      return;
    }
    detecting = true;
    detect.disabled = true;
    detectionStatus.textContent = 'Locatie controleren…';
    form.elements.title.blur();
    try {
      const point = await location.checkNow({
        reason: 'location-editor', maxAgeMs: 0, highAccuracy: true,
        browserMaxAgeMs: 0, timeoutMs: 10_000
      });
      if (destroyed || !form.isConnected) return;
      form.elements.lat.value = point.lat;
      form.elements.lng.value = point.lng;
      foundAccuracy = Number.isFinite(point.accuracy) ? Math.round(point.accuracy) : null;
      detectionStatus.textContent = 'Positie gevonden.';
      if (!form.elements.title.value.trim()) form.elements.title.value = 'Huidige locatie';
      showDetails();
      setStatus('Positie gevonden. Adres wordt gecontroleerd…');
      // Show the coordinates immediately; reverse geocoding may be slow.
      if (geocoder?.reverse) {
        try {
          const addr = await geocoder.reverse(point);
          if (destroyed || !form.isConnected) return;
          if (addr) {
            const line1 = addr.line1 || [addr.street, addr.number].filter(Boolean).join(' ');
            const line2 = addr.line2 || [addr.postcode, addr.city].filter(Boolean).join(' ');
            const formatted = [line1, line2].filter(Boolean).join(', ');
            if (formatted && !form.elements.address.value.trim()) {
              form.elements.address.value = formatted;
            }
            if (form.elements.title.value === 'Huidige locatie') {
              form.elements.title.value = String(line1 || addr.city || 'Huidige locatie').slice(0, 80);
            }
          }
        } catch {
          // GPS remains usable if geocoding fails.
        }
      }
      if (!destroyed && form.isConnected) {
        updatePreview();
        setStatus('Controleer de gegevens en pas ze eventueel aan.');
      }
    } catch (error) {
      if (!destroyed) detectionStatus.textContent = error?.message || 'Locatie kon niet worden bepaald.';
    } finally {
      detecting = false;
      if (detect.isConnected) detect.disabled = false;
    }
  }

  // Keep a conventional submit action; pressing Enter in the first text field
  // advances, while Enter on the details view uses normal form validation.
  form.addEventListener('submit', event => {
    if (showingDetails) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    continueManually();
  }, true);
  form.elements.title.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !showingDetails) {
      event.preventDefault();
      continueManually();
    }
  });
  detect.addEventListener('click', () => { useCurrentPosition(); });
  next.addEventListener('click', continueManually);
  back.addEventListener('click', showStart);
  ['title', 'address', 'lat', 'lng'].forEach(name =>
    form.elements[name]?.addEventListener('input', () => {
      if (name === 'lat' || name === 'lng') foundAccuracy = null;
      updatePreview();
    }));
  fields.trigger?.querySelector('[name="triggerEnabled"]')?.addEventListener('change', event => {
    if (event.currentTarget.checked) {
      focusTextField(fields.trigger.querySelector('[name="triggerMessage"]'));
    }
  });

  // A visual viewport shrinks when iOS opens its keyboard. A fixed footer
  // is lifted into the visible part of the screen on resize AND scroll.
  const viewport = window.visualViewport;
  const adjustFooter = () => {
    if (destroyed || !footer.isConnected) return;
    const inset = keyboardInset(viewport, window.innerHeight);
    footer.style.setProperty('--sh-keyboard-inset', inset + 'px');
  };
  viewport?.addEventListener('resize', adjustFooter);
  viewport?.addEventListener('scroll', adjustFooter);
  window.addEventListener('resize', adjustFooter);
  adjustFooter();

  function cleanup() {
    destroyed = true;
    viewport?.removeEventListener('resize', adjustFooter);
    viewport?.removeEventListener('scroll', adjustFooter);
    window.removeEventListener('resize', adjustFooter);
  }

  if (isNew) {
    updateFooter();
    // Do not raise the keyboard until the user elects to type. The GPS option
    // remains fully visible on the opening screen.
    if (useGps) useCurrentPosition();
  } else {
    // Editing immediately shows every saved value; no six-step questionnaire.
    showDetails();
  }
  return cleanup;
}
