import { focusTextField } from './TextInputFocus.js?v=0.1.93';

// An onboarding-like presentation for the existing location form.
// Fields, save handlers, address lookup and GPS controls remain in LocationsView.
const QUESTIONS = [
  'Waar ligt deze plek?',
  'Hoe zullen we deze plek noemen?',
  'Waar hoort deze plek bij?',
  'Wat voor plek is dit?',
  'Hoe wil je deze plek gebruiken?',
  'Klopt alles zo?'
];

const esc = value => String(value ?? '').replace(/[&<>]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;'
})[character]);

export function enhanceLocationEditor(root, { isNew = false, skipInitialFocus = false } = {}) {
  const page = root.querySelector('.location-editor-view');
  const form = page?.querySelector('[data-location-form]');
  if (!page || !form || form.dataset.guided === '1') return;
  form.dataset.guided = '1';
  page.classList.add('sh-location-guided');

  const nav = page.querySelector('.sh-location-editor-nav');
  nav.classList.add('sh-location-guided-nav');
  const counter = document.createElement('small');
  counter.className = 'sh-location-guided-count';
  nav.append(counter);

  const field = selector => form.querySelector(selector)?.closest('label');
  const name = field('[name="title"]');
  const parent = field('[name="parentId"]');
  const address = form.querySelector('.sh-location-group');
  const gps = form.querySelectorAll('.sh-location-group')[1];
  const type = field('[name="kind"]');
  const share = field('[name="shareRide"]');
  const radius = field('[name="radiusM"]');
  const trigger = form.querySelector('.clean-section');
  const distance = form.querySelector('.location-check');
  const status = form.querySelector('[data-editor-status]');
  const save = form.querySelector('[type="submit"]');
  const extra = page.querySelector('.sh-location-secondary-actions');
  const merge = page.querySelector('[data-merge-panel]');

  const flow = document.createElement('div');
  flow.className = 'sh-location-guided-flow';
  flow.innerHTML = '<div class="story-content sh-location-guided-content">' +
    '<div class="story-copy sh-location-guided-question" aria-live="polite"><p></p></div>' +
    '<span class="type-caret sh-location-guided-caret" aria-hidden="true"></span>' +
    '<div class="story-stage sh-location-guided-stage"></div>' +
    '<div class="story-actions sh-location-guided-actions">' +
    '<button type="button" class="story-text-action" data-guided-prev>Terug</button>' +
    '<button type="button" class="story-primary-action" data-guided-next>Verder</button>' +
    '</div></div><div class="sh-location-guided-progress" role="progressbar" aria-label="Voortgang" aria-valuemin="1" aria-valuemax="6"><span></span></div>';

  form.prepend(flow);
  const stage = flow.querySelector('.sh-location-guided-stage');
  const scenes = QUESTIONS.map((question, index) => {
    const scene = document.createElement('section');
    scene.className = 'sh-location-guided-scene';
    scene.dataset.guidedStep = String(index);
    scene.hidden = index !== 0;
    stage.append(scene);
    return scene;
  });

  // Keep inputs in their original form; the wizard never creates a second data model.
  [address, gps].forEach(element => { if (element) scenes[0].append(element); });
  if (name) scenes[1].append(name);
  if (parent) scenes[2].append(parent);
  if (type) scenes[3].append(type);
  [share, radius, trigger, distance].forEach(element => {
    if (element) scenes[4].append(element);
  });

  const summary = document.createElement('div');
  summary.className = 'sh-location-guided-summary detected-place';
  summary.setAttribute('data-guided-summary', '');
  scenes[5].append(summary);
  // Extra actions are only offered on the review step for existing locations.
  if (extra) scenes[5].append(extra);
  if (merge) scenes[5].append(merge);
  if (status) flow.querySelector('.sh-location-guided-actions').before(status);

  // Preserve the original submit button and its existing submit handler.
  save.classList.add('sh-location-guided-submit');
  flow.querySelector('.sh-location-guided-actions').append(save);

  const typeSelect = type?.querySelector('select');
  if (typeSelect) {
    type.hidden = true;
    const choices = document.createElement('div');
    choices.className = 'place-type-options sh-location-guided-types';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', 'Type locatie');
    for (const option of typeSelect.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.textContent;
      button.dataset.kind = option.value;
      button.addEventListener('click', () => {
        typeSelect.value = option.value;
        syncTypeChoices();
      });
      choices.append(button);
    }
    scenes[3].append(choices);
    const syncTypeChoices = () => {
      for (const button of choices.querySelectorAll('[data-kind]')) {
        const selected = button.dataset.kind === typeSelect.value;
        button.setAttribute('aria-pressed', String(selected));
        button.textContent = typeSelect.options.namedItem?.(button.dataset.kind)?.textContent ||
          Array.from(typeSelect.options).find(option => option.value === button.dataset.kind)?.textContent || button.dataset.kind;
        if (selected) button.textContent += '  ✓';
      }
    };
    syncTypeChoices();
  }

  // Hints use the same understated copy as the original story.
  const hint = (scene, message, prepend = false) => {
    const p = document.createElement('p');
    p.className = 'story-note sh-location-guided-hint';
    p.textContent = message;
    if (prepend) scene.prepend(p);
    else scene.append(p);
  };
  hint(scenes[0], 'Gebruik je huidige GPS-positie of zoek een ander adres. Beide mogen ook leeg blijven.', true);
  hint(scenes[2], 'Ook een sublocatie kan weer eigen sublocaties bevatten.');
  hint(scenes[4], 'Sharon gebruikt hiervoor alleen de centrale locatievoorziening.');

  let step = 0;
  let animation = 0;
  const questionEl = flow.querySelector('.sh-location-guided-question p');
  const previous = flow.querySelector('[data-guided-prev]');
  const next = flow.querySelector('[data-guided-next]');
  const progress = flow.querySelector('.sh-location-guided-progress');
  const onReducedMotion = () => typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  async function showQuestion(question) {
    const token = ++animation;
    questionEl.textContent = '';
    if (onReducedMotion()) {
      questionEl.textContent = question;
      return;
    }
    for (let index = 0; index < question.length; index += 1) {
      if (token !== animation || !questionEl.isConnected) return;
      questionEl.textContent += question[index];
      await new Promise(resolve => setTimeout(resolve, question[index] === ' ' ? 8 : 16));
    }
  }

  function renderSummary() {
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const parentId = String(data.get('parentId') || '');
    const selectedParent = parent?.querySelector('select')?.selectedOptions?.[0];
    const parentText = parentId ? (selectedParent?.textContent || '') : 'Hoofdlocatie';
    const addressText = String(data.get('address') || '').trim();
    const lat = String(data.get('lat') || '').trim();
    const lng = String(data.get('lng') || '').trim();
    const gpsText = lat && lng ? Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5) : 'Overnemen van bovenliggende locatie (indien beschikbaar)';
    const typeText = typeSelect?.selectedOptions?.[0]?.textContent || 'Overig';
    const enabled = data.get('triggerEnabled') === 'on';
    summary.innerHTML =
      '<strong>' + esc(title || 'Locatie') + '</strong>' +
      '<p class="sh-location-guided-summary-type">' + esc(typeText) + ' · ' + esc(parentText) + '</p>' +
      '<div class="place-coordinates">' + esc(gpsText) + '</div>' +
      '<div class="place-address">' + esc(addressText || 'Geen eigen adres') + '</div>' +
      '<p class="story-note">Herkenningsstraal ' + esc(data.get('radiusM') || '100') +
      ' meter · Melding ' + (enabled ? 'aan' : 'uit') + '</p>';
  }

  function validateCurrent() {
    if (step === 1 && !String(form.elements.title.value || '').trim()) {
      form.elements.title.focus();
      const statusEl = flow.querySelector('[data-editor-status]');
      if (statusEl) statusEl.textContent = 'Geef de locatie eerst een naam.';
      return false;
    }
    if (step === 0) {
      const lat = String(form.elements.lat?.value || '').trim();
      const lng = String(form.elements.lng?.value || '').trim();
      if (Boolean(lat) !== Boolean(lng)) {
        const statusEl = flow.querySelector('[data-editor-status]');
        if (statusEl) statusEl.textContent = 'Vul beide GPS-coördinaten in of laat beide leeg.';
        return false;
      }
      if ((lat && (!Number.isFinite(Number(lat)) || Math.abs(Number(lat)) > 90)) ||
          (lng && (!Number.isFinite(Number(lng)) || Math.abs(Number(lng)) > 180))) {
        const statusEl = flow.querySelector('[data-editor-status]');
        if (statusEl) statusEl.textContent = 'Controleer de GPS-coördinaten.';
        return false;
      }
    }
    return true;
  }

  function show(nextStep, { focus = true } = {}) {
    const lastStep = step;
    step = Math.max(0, Math.min(QUESTIONS.length - 1, nextStep));
    scenes.forEach((scene, index) => { scene.hidden = index !== step; });
    counter.textContent = (isNew ? 'Toevoegen' : 'Aanpassen') + ' · ' + (step + 1) + ' / ' + QUESTIONS.length;
    previous.hidden = step === 0;
    next.hidden = step === QUESTIONS.length - 1;
    save.hidden = step !== QUESTIONS.length - 1;
    progress.setAttribute('aria-valuenow', String(step + 1));
    progress.querySelector('span').style.width = ((step + 1) / QUESTIONS.length * 100) + '%';
    if (status) status.textContent = '';
    if (step === QUESTIONS.length - 1) renderSummary();
    form.closest('.app-view')?.scrollTo({ top: 0, behavior: 'auto' });
    // Focus before any await/animation: iOS can open the keyboard during
    // the same tap on Verder/Terug, rather than requiring a second tap.
    if (focus) {
      const target = step === 0 ? scenes[0].querySelector('[name="address"]')
        : step === 1 ? scenes[1].querySelector('[name="title"]') : null;
      if (target) {
        focusTextField(target);
      } else if (lastStep !== step && form.contains(document.activeElement)) {
        // Choice/review steps should not leave a text keyboard covering the options.
        document.activeElement?.blur?.();
      }
    }
    showQuestion(QUESTIONS[step]);
  }

  // Prevent implicit form submission before the review step (e.g. Enter on iPhone).
  form.addEventListener('submit', event => {
    if (step === QUESTIONS.length - 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (validateCurrent()) show(step + 1);
  }, true);
  form.addEventListener('keydown', event => {
    if (step === QUESTIONS.length - 1 || event.key !== 'Enter') return;
    const input = event.target;
    if (input?.matches?.('[name="address"]')) {
      event.preventDefault();
      root.querySelector('[data-lookup]')?.click();
    } else if (input?.matches?.('[name="title"]')) {
      event.preventDefault();
      if (validateCurrent()) show(step + 1);
    }
  }, true);

  previous.addEventListener('click', () => show(step - 1));
  next.addEventListener('click', () => {
    if (validateCurrent()) show(step + 1);
  });
  name?.querySelector('input')?.addEventListener('keydown', event => {
    if (step === 1 && event.key === 'Enter') {
      event.preventDefault();
      if (validateCurrent()) show(2);
    }
  });

  show(0, { focus: !skipInitialFocus });
}
