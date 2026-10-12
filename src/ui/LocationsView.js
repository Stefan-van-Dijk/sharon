import { locationIcon } from '../core/location/LocationTypeRegistry.js?v=0.2.38';
import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.2.38';
import { bindSwipeRows } from './SwipeRows.js?v=0.2.38';
import { enhanceLocationEditor } from './LocationOnboardingFlow.js?v=0.2.38';
import { mountLocationArea } from './LocationAreaPreview.js?v=0.2.38';
import { typeLocationConclusion } from './LocationConclusion.js?v=0.2.38';
import { renderLocationSentence, distanceSituation, resolveSentenceVariants, addLocationVariant, updateGroupVariant, setLocationVariantExcluded, removeLocationVariant, removeGroupVariant, addGlobalVariant, removeGlobalVariant, setGroupVariantExcluded, setGlobalVariantExcluded } from './LocationSentenceLibrary.js?v=0.2.38';
import {
  LOCATION_TYPES, addressText, ownCoordinates, parentIdOf,
  locationMap, resolveLocation, isDescendant, pathForLocation, orderedLocations
} from '../core/location/LocationHierarchy.js?v=0.2.38';

const PREF_KEY = 'locations.preferences';
const TYPES = new Map(LOCATION_TYPES);
const DEFAULT_RADIUS = 100;

export async function openLocationsView(root, {
  store, location, geocoder, events, initialLocationId = '', setTitle = () => {}, headerActions = null
}) {
  let objects = [], locations = [], byId = new Map();
  let prefs = (await store.get('meta', PREF_KEY))?.value || { sort: 'alpha', order: [] };
  let sentenceLibrary = (await store.get('meta', 'locations.sentenceLibrary'))?.value || {};
  let lastSentence = '';
  let unbindSwipes = null;
  let releaseEditor = null;

  async function reload() {
    objects = await store.getAll('objects');
    locations = objects.filter(item => item.type === 'location' && !item.deletedAt);
    byId = locationMap(locations);
  }
  await reload();

  async function list(status = '') {
    releaseEditor?.();
    releaseEditor = null;
    setTitle('Locaties');
    unbindSwipes?.();
    if (headerActions) {
      headerActions.replaceChildren();
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'sh-location-header-add';
      add.setAttribute('data-create-location', '');
      add.setAttribute('aria-label', 'Locatie toevoegen');
      add.textContent = '+';
      add.addEventListener('click', () => edit(null));
      headerActions.append(add);
    }
    const rows = orderedLocations(locations, prefs.sort, prefs.order);
    root.innerHTML = `
      <section class="module-view locations-view">
        ${!headerActions ? `<div class="sh-locations-toolbar"><span>Locaties</span><button type="button" data-create-location>+</button></div>` : ""}
        <div class="sh-locations-sort" aria-label="Locaties sorteren">
          <button type="button" data-sort="recent" ${prefs.sort === 'recent' ? 'aria-pressed="true"' : ''}>Recent</button>
          <button type="button" data-sort="alpha" ${prefs.sort === 'alpha' ? 'aria-pressed="true"' : ''}>A–Z</button>
          <button type="button" data-sort="custom" ${prefs.sort === 'custom' ? 'aria-pressed="true"' : ''}>Eigen</button>
        </div>
        <div class="sh-locations-list swipe-list" data-swipe-list>
          ${rows.length ? rows.map(({ item, depth }, index) => {
            const effective = resolveLocation(item, byId);
            const own = addressText(item.data?.address);
            const parent = byId.get(parentIdOf(item));
            const secondary = own || (parent ? 'Onder ' + (parent.data?.title || 'locatie') : effective.address)
              || (effective.coordinates ? formatCoordinates(effective.coordinates) : 'Geen adres of GPS');
            const custom = prefs.sort === 'custom';
            return `<div class="sh-location-node" style="--nest:${Math.min(depth, 8)}" data-node="${escapeAttribute(item.id)}">
              <div class="swipe-row" data-swipe-row="${escapeAttribute(item.id)}">
                <div class="swipe-actions">
                  <button type="button" class="swipe-action-delete" data-swipe-delete>Verwijder</button>
                </div>
                <button type="button" class="clean-row swipe-surface sh-location-row" data-swipe-surface>
                  <span class="sh-location-kind" aria-hidden="true">${locationIcon(item.data?.kind)}</span>
                  <span class="sh-location-copy">
                    <strong>${escapeHtml(item.data?.title || 'Locatie')}</strong>
                    <small>${escapeHtml(secondary)}</small>
                  </span>
                  <span class="sh-location-chevron" aria-hidden="true">›</span>
                </button>
              </div>
              ${custom ? `<div class="sh-location-order"><button type="button" data-move="${escapeAttribute(item.id)}" data-direction="-1" aria-label="Omhoog">↑</button><button type="button" data-move="${escapeAttribute(item.id)}" data-direction="1" aria-label="Omlaag">↓</button></div>` : ''}
              </div>`;
          }).join('') : '<p class="empty-state">Nog geen locaties. Voeg een plaats toe om te beginnen.</p>'}
        </div>
        <p class="sh-location-feedback" role="status" data-list-status>${escapeHtml(status)}</p>
      </section>
    `;

    root.querySelector('[data-create-location]')?.addEventListener('click', () => edit(null));
    unbindSwipes = bindSwipeRows(root.querySelector('[data-swipe-list]'), {
      onOpen: id => detail(byId.get(id)),
      onDelete: id => removeLocation(id)
    });
    root.querySelectorAll('[data-sort]').forEach(button => button.addEventListener('click', async () => {
      prefs.sort = button.dataset.sort;
      if (prefs.sort === 'custom' && !prefs.order?.length) prefs.order = locations.map(item => item.id);
      await savePrefs();
      list();
    }));
    root.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', async () => {
      const id = button.dataset.move;
      const parentId = parentIdOf(byId.get(id));
      const siblings = orderedLocations(locations, 'custom', prefs.order).map(x => x.item)
        .filter(x => parentIdOf(x) === parentId).map(x => x.id);
      const index = siblings.indexOf(id), to = index + Number(button.dataset.direction);
      if (index < 0 || to < 0 || to >= siblings.length) return;
      const other = siblings[to];
      const all = [...new Set([...(prefs.order || []), ...locations.map(x => x.id)])];
      const i = all.indexOf(id), j = all.indexOf(other);
      [all[i], all[j]] = [all[j], all[i]];
      prefs.order = all;
      await savePrefs();
      list();
    }));
  }

  async function savePrefs() {
    await store.put('meta', { key: PREF_KEY, value: prefs });
  }

  async function removeLocation(id) {
    const item = byId.get(id);
    if (!item) return;
    if (locations.some(child => parentIdOf(child) === id)) {
      list('Verplaats of verwijder eerst de onderliggende locaties.');
      return;
    }
    if (!confirm(`“${item.data?.title || 'Locatie'}” verwijderen?`)) return;
    const now = Date.now();
    await store.put('objects', { ...item, updatedAt: now, deletedAt: now });
    for (const action of objects.filter(x => x.type === 'location-action' && !x.deletedAt && x.data?.locationId === id)) {
      await store.put('objects', { ...action, updatedAt: now, deletedAt: now, data: { ...action.data, enabled: false } });
    }
    events.emit('location.deleted', { id });
    await reload();
    list('Locatie verwijderd.');
  }

  async function detail(item) {
    if (!item) return list();
    releaseEditor?.(); releaseEditor = null;
    headerActions?.replaceChildren();
    unbindSwipes?.(); unbindSwipes = null;
    setTitle('Locatie');
    const effective = resolveLocation(item, byId);
    const point = effective.coordinates;
    const title = item.data?.title || 'Locatie';
    const kind = item.data?.kind || 'other';
    const kindLabel = TYPES.get(kind) || 'Andere plek';
    const sentence = renderLocationSentence({
      name: title, typeLabel: kindLabel, typeId: kind, locationId: item.id,
      point, current: location?.latest, radiusM: radius(item.data?.radiusM),
      library: sentenceLibrary, lastSentence
    });
    lastSentence = sentence;
    root.innerHTML = `
      <section class="module-view sh-location-detail-view sh-location-reference">
        <div class="sh-location-editor-nav"><button type="button" data-back>‹ Locaties</button><span>${escapeHtml(pathForLocation(item, byId))}</span></div>
        <div class="swipe-list sh-location-detail-swipes sh-location-reference-page" data-detail-swipes>
          <div class="swipe-row" data-swipe-row="identity" data-double-swipe>
            <div class="swipe-actions sh-location-double-actions"><button type="button" class="swipe-action-edit" data-swipe-edit>Bewerk</button><button type="button" class="swipe-action-secondary" data-swipe-secondary aria-label="Zinnenbibliotheek" title="Zinnenbibliotheek"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h12a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 1V5.5Z"/><path d="M7 9h9M7 12.5h7M7 16h5"/></svg></button></div>
            <button type="button" class="swipe-surface sh-location-detail-identity sh-location-reference-heading" data-swipe-surface aria-label="Naam en type bewerken door te vegen">
              <h2 data-detail-conclusion></h2>
            </button>
          </div>
          <div class="swipe-row" data-swipe-row="place">
            <div class="swipe-actions"><button type="button" class="swipe-action-edit" data-swipe-edit>Bewerk</button></div>
            <button type="button" class="swipe-surface sh-location-detail-place sh-location-reference-address" data-swipe-surface aria-label="Locatiegegevens bewerken door te vegen">
              <span class="sh-location-reference-marker" aria-hidden="true">⌖</span><span class="sh-location-reference-place-copy"><strong>${escapeHtml(effective.address || 'Geen adres vastgelegd')}</strong>
              <small>${escapeHtml(point ? formatCoordinates(point) : 'Geen GPS-positie')}</small></span>
            </button>
          </div>
        </div>
        <div class="sh-location-reference-map-panel sh-location-detail-map-panel">
          <div class="sh-radius-map-host sh-location-reference-map" data-detail-map></div>
        </div>
      </section>`;
    root.querySelector('[data-back]').addEventListener('click', () => list());
    const heading = root.querySelector('[data-detail-conclusion]');
    typeLocationConclusion(heading, sentence, {
      reducedMotion: Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    });
    let detailMap = null;
    if (point) {
      detailMap = mountLocationArea(root.querySelector('[data-detail-map]'), {
        getPoint: () => point,
        getRadius: () => radius(item.data?.radiusM),
        getAccuracy: () => 0
      });
      detailMap?.setPositionEditable?.(false);
      void detailMap?.update?.();
    }
    unbindSwipes = bindSwipeRows(root.querySelector('[data-detail-swipes]'), {
      onEdit: id => edit(item, '', false, id),
      onSecondary: id => { if (id === 'identity') void sentenceEditor(item); }
    });
    releaseEditor = () => detailMap?.destroy?.();
  }

  async function sentenceEditor(item) {
    releaseEditor?.(); releaseEditor = null;
    unbindSwipes?.(); unbindSwipes = null;
    headerActions?.replaceChildren();
    setTitle('Zinnenbibliotheek');
    const kind = item.data?.kind || 'other';
    const name = item.data?.title || 'Locatie';
    const effective = resolveLocation(item, byId);
    let state = distanceSituation(effective.coordinates, location?.latest, radius(item.data?.radiusM)).state;
    if (state === 'unknown') state = 'here';
    const stateNames = { here: 'Op de locatie', near: 'In de buurt', away: 'Verder weg' };
    root.innerHTML = `<section class="module-view sh-sentence-editor">
      <div class="sh-location-editor-nav"><button type="button" data-back>‹ Locatie</button><span>${escapeHtml(name)}</span></div>
      <h2 data-sentence-intro aria-live="off"></h2>
      <div data-sentence-reveal hidden><p>Gebruik [Naam], [Type] en [Afstand] om een zin passend te maken.</p>
      <label class="clean-field"><span>Afstandssituatie</span><select data-sentence-state>
        ${Object.entries(stateNames).map(([key, label]) => `<option value="${key}" ${state === key ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      <div data-sentence-variants></div>
      <form data-sentence-add>
        <label class="clean-field"><span>Nieuwe zin</span><textarea name="template" rows="3" maxlength="300" required placeholder="Je bent bij [Naam] — [Type]."></textarea></label>
        <button class="primary-line-action" type="submit">Zin toevoegen</button>
      </form>
      <p role="status" data-sentence-status></p></div>
    </section>`;
    const intro = root.querySelector('[data-sentence-intro]');
    const introText = 'Zo praat ik over ' + name + '. Hier kun je mijn zinnen aanpassen of me iets nieuws leren.';
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const reveal = root.querySelector('[data-sentence-reveal]');
    const revealSections = [...reveal.children];
    if (reducedMotion) {
      intro.textContent = introText;
      reveal.hidden = false;
    } else {
      const stopIntro = typeLocationConclusion(intro, introText, { reducedMotion, speed: 32 });
      const estimatedMs = [...introText].reduce((ms, ch) => ms + (/[.,:]/.test(ch) ? 100 : ch === ' ' ? 12 : 32), 0) + 120;
      window.setTimeout(() => {
        if (!intro.isConnected) return;
        reveal.hidden = false;
        revealSections.forEach((section, index) => {
          section.classList.add('sh-sentence-enter');
          section.style.animationDelay = (index * 110) + 'ms';
        });
      }, estimatedMs);
    }
    const stateInput = root.querySelector('[data-sentence-state]');
    const variantsHost = root.querySelector('[data-sentence-variants]');
    root.querySelector('[data-back]').addEventListener('click', () => detail(item));
    const form = root.querySelector('[data-sentence-add]');
    const textarea = form.elements.template;
    // Applicability is changed exclusively from the status control on each row.
    const submitButton = form.querySelector('[type="submit"]');
    const label = form.querySelector('label span');
    const status = root.querySelector('[data-sentence-status]');
    let editing = null;
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Annuleer'; cancel.hidden = true;
    submitButton.after(cancel);
    const resetForm = () => {
      editing = null; textarea.value = '';
      label.textContent = 'Nieuwe zin'; submitButton.textContent = 'Zin toevoegen';
      cancel.hidden = true;
    };
    cancel.addEventListener('click', resetForm);
    const beginEdit = (template, scope, situation) => {
      editing = { template, scope, situation, copy: scope === 'default' };
      textarea.value = template;
      label.textContent = scope === 'default' ? 'Nieuwe zin op basis van standaardzin' : 'Zin aanpassen';
      submitButton.textContent = scope === 'default' ? 'Nieuwe zin toevoegen' : 'Wijziging opslaan';
      cancel.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      textarea.focus({ preventScroll: true });
      ensureInputVisible();
    };
    const ensureInputVisible = () => {
      if (!textarea.isConnected || document.activeElement !== textarea) return;
      const viewport = window.visualViewport;
      const viewportBottom = (viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight);
      const rect = textarea.getBoundingClientRect();
      const availableBottom = viewportBottom - 24;
      if (rect.bottom > availableBottom || rect.top < 90) {
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    textarea.addEventListener('focus', () => {
      requestAnimationFrame(ensureInputVisible);
      setTimeout(ensureInputVisible, 280);
    });
    window.visualViewport?.addEventListener('resize', ensureInputVisible);
    window.visualViewport?.addEventListener('scroll', ensureInputVisible);
    const persist = async () => {
      await store.put('meta', { key: 'locations.sentenceLibrary', value: sentenceLibrary });
    };
    let unbindSentenceSwipes = null;
    const iconButton = (symbol, text, handler) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-sentence-icon-action';
      const graphic = document.createElement('span');
      graphic.setAttribute('aria-hidden', 'true');
      graphic.textContent = symbol;
      const caption = document.createElement('small');
      caption.textContent = text;
      button.append(graphic, caption);
      button.setAttribute('aria-label', text);
      button.title = text;
      button.addEventListener('click', event => { event.stopPropagation(); handler(event); });
      return button;
    };
    const scopes = {
      global: ['◎','Overal van toepassing'],
      group: ['▣','Voor deze groep'],
      location: ['⌖','Voor deze locatie'],
      excludedGroup: ['⊘','Uitgesloten voor deze groep'],
      excludedLocation: ['⊖','Uitgesloten voor deze locatie'],
      excludedGlobal: ['⊗','Overal uitgesloten']
    };
    const draw = () => {
      unbindSentenceSwipes?.();
      unbindSentenceSwipes = null;
      const situation = stateInput.value;
      const local = sentenceLibrary.locations?.[item.id]?.added?.[situation] || [];
      const group = sentenceLibrary.groups?.[kind]?.[situation] || [];
      const global = sentenceLibrary.global?.[situation] || [];
      const localExcluded = sentenceLibrary.locations?.[item.id]?.excluded?.[situation] || [];
      const groupExcluded = sentenceLibrary.groupExcluded?.[kind]?.[situation] || [];
      const globalExcluded = sentenceLibrary.globalExcluded?.[situation] || [];
      const visible = resolveSentenceVariants({ state:situation, typeId:kind, locationId:item.id, library:sentenceLibrary });
      const all = [...new Set([...visible,...localExcluded,...groupExcluded,...globalExcluded])];
      variantsHost.replaceChildren();
      const rows = new Map();
      const persistAndDraw = async () => { await persist(); draw(); };
      for (const [index,template] of all.entries()) {
        const source = local.includes(template) ? 'location' : group.includes(template) ? 'group' : global.includes(template) ? 'global' : 'default';
        const excludedStatus = globalExcluded.includes(template) ? 'excludedGlobal' : localExcluded.includes(template) ? 'excludedLocation' : groupExcluded.includes(template) ? 'excludedGroup' : '';
        const statusKey = excludedStatus || (source === 'default' ? 'global' : source);
        const row = document.createElement('div');
        row.className = 'swipe-row sh-sentence-swipe-row';
        if (excludedStatus) row.classList.add('sh-sentence-inactive');
        row.dataset.swipeRow = String(index);
        if (source === 'default') row.setAttribute('data-swipe-single', '');
        const actions = document.createElement('div');
        actions.className = 'swipe-actions';
        const editAction = iconButton('✎', source === 'default' ? 'Kopieer' : 'Bewerk', () => beginEdit(template,source,situation));
        editAction.dataset.swipeEdit = '';
        actions.append(editAction);
        if (source !== 'default') {
          const deleteAction = iconButton('⌫','Verwijder',async () => {
            if (!window.confirm('Zelfgemaakte zin verwijderen?')) return;
            if (source === 'location') sentenceLibrary = removeLocationVariant(sentenceLibrary,item.id,situation,template);
            else if (source === 'group') sentenceLibrary = removeGroupVariant(sentenceLibrary,kind,situation,template);
            else sentenceLibrary = removeGlobalVariant(sentenceLibrary,situation,template);
            await persistAndDraw();
          });
          deleteAction.dataset.swipeDelete = '';
          actions.append(deleteAction);
        }
        const surface = document.createElement('div');
        surface.className = 'swipe-surface sh-sentence-row-surface';
        surface.dataset.swipeSurface = '';
        const dot = document.createElement('i');
        dot.className = 'sh-sentence-dot';
        if (source !== 'default') dot.classList.add('sh-sentence-green');
        const sentenceText = document.createElement('span');
        sentenceText.className = 'sh-sentence-text';
        sentenceText.textContent = template;
        const badge = iconButton(scopes[statusKey][0],scopes[statusKey][1],() => {
          const open = surface.querySelector('.sh-sentence-scope-choices');
          if (open) { open.remove(); return; }
          variantsHost.querySelectorAll('.sh-sentence-scope-choices').forEach(el=>el.remove());
          const menu = document.createElement('div');
          menu.className = 'sh-sentence-scope-choices';
          const choices = source === 'default'
            ? [
                ['global','Overal van toepassing'],
                ['excludedLocation','Uitsluiten voor deze locatie'],
                ['excludedGroup','Uitsluiten voor deze groep'],
                ['excludedGlobal','Overal uitsluiten']
              ]
            : [
                ['location','Voor deze locatie'],['group','Voor deze groep'],['global','Overal van toepassing'],
                ['excludedLocation','Uitsluiten voor deze locatie'],['excludedGroup','Uitsluiten voor deze groep'],['excludedGlobal','Overal uitsluiten']
              ];
          for (const [key,text] of choices) {
            menu.append(iconButton(scopes[key][0],text,async () => {
              // Each choice defines exactly one effective status; no extra row.
              sentenceLibrary = setLocationVariantExcluded(sentenceLibrary,item.id,situation,template,false);
              sentenceLibrary = setGroupVariantExcluded(sentenceLibrary,kind,situation,template,false);
              sentenceLibrary = setGlobalVariantExcluded(sentenceLibrary,situation,template,false);
              if (key === 'excludedLocation') sentenceLibrary = setLocationVariantExcluded(sentenceLibrary,item.id,situation,template,true);
              if (key === 'excludedGroup') sentenceLibrary = setGroupVariantExcluded(sentenceLibrary,kind,situation,template,true);
              if (key === 'excludedGlobal') sentenceLibrary = setGlobalVariantExcluded(sentenceLibrary,situation,template,true);
              // Changing applicability moves an authored variant instead of duplicating it.
              // Sharon's built-in defaults remain immutable and universally sourced.
              if (key === 'location' || key === 'group' || key === 'global') {
                if (source !== 'default' && source !== key) {
                  if (source === 'location') sentenceLibrary = removeLocationVariant(sentenceLibrary,item.id,situation,template);
                  else if (source === 'group') sentenceLibrary = removeGroupVariant(sentenceLibrary,kind,situation,template);
                  else sentenceLibrary = removeGlobalVariant(sentenceLibrary,situation,template);
                }
                if (source !== 'default') {
                  if (key === 'location') sentenceLibrary = addLocationVariant(sentenceLibrary,item.id,situation,template);
                  else if (key === 'group') sentenceLibrary = updateGroupVariant(sentenceLibrary,kind,situation,template);
                  else sentenceLibrary = addGlobalVariant(sentenceLibrary,situation,template);
                }
              }
              await persistAndDraw();
            }));
          }
          surface.append(menu);
        });
        badge.classList.add('sh-sentence-status-button');
        badge.setAttribute('aria-expanded','false');
        surface.append(dot,sentenceText,badge);
        row.append(actions,surface);
        variantsHost.append(row);
        rows.set(String(index),{template,source,situation});
      }
      unbindSentenceSwipes = bindSwipeRows(variantsHost,{
        // A tap on the sentence is inert; only the revealed swipe action edits/copies.
        onEdit:id => {
          const data=rows.get(id);
          if(data)beginEdit(data.template,data.source,data.situation);
        }
      });
    };
    stateInput.addEventListener('change', () => { resetForm(); draw(); });
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const template=textarea.value.trim();
      if(!template)return;
      const target=editing && editing.scope !== 'default' ? editing.scope : 'global';
      const situation=editing?.situation || stateInput.value;
      if(editing && editing.template === template) {
        status.textContent = 'Geen wijziging in de zin.';
        return;
      }
      if(editing) {
        const old=editing;
        if(old.scope==='location') sentenceLibrary=removeLocationVariant(sentenceLibrary,item.id,situation,old.template);
        if(old.scope==='group') sentenceLibrary=removeGroupVariant(sentenceLibrary,kind,situation,old.template);
        if(old.scope==='global' && target==='global') sentenceLibrary=removeGlobalVariant(sentenceLibrary,situation,old.template);
        // A standard sentence is a copy source, never deactivate it on edit.
        if(old.scope==='global' && target!=='global') {
          sentenceLibrary=setLocationVariantExcluded(sentenceLibrary,item.id,situation,old.template,true);
          if(target==='group') sentenceLibrary=setGroupVariantExcluded(sentenceLibrary,kind,situation,old.template,true);
        }
      }
      if(target==='global') sentenceLibrary=addGlobalVariant(sentenceLibrary,situation,template);
      else if(target==='group') sentenceLibrary=updateGroupVariant(sentenceLibrary,kind,situation,template);
      else sentenceLibrary=addLocationVariant(sentenceLibrary,item.id,situation,template);
      await persist();
      status.textContent=editing && !editing.copy?'Zin aangepast.':'Zin toegevoegd.';
      resetForm();draw();
    });
    draw();
  }

  async function edit(item = null, selectedParent = '', useGps = false, editMode = '') {
    releaseEditor?.();
    releaseEditor = null;
    headerActions?.replaceChildren();
    unbindSwipes?.();
    unbindSwipes = null;
    const isNew = !item;
    const original = item?.data || {};
    const initialParent = isNew ? selectedParent : parentIdOf(item);
    const excluded = new Set(locations.filter(candidate => item && isDescendant(candidate.id, item.id, byId)).map(x => x.id));
    const choices = locations.filter(x => x.id !== item?.id && !excluded.has(x.id));
    const effective = item ? resolveLocation(item, byId) : resolveLocation(byId.get(initialParent), byId);
    const own = ownCoordinates(item);
    const locationAction = objects.find(x => x.type === 'location-action' && !x.deletedAt && x.data?.locationId === item?.id);
    const trigger = locationAction?.data || {};
    let pickedAddress = null;
    setTitle(isNew ? 'Nieuwe locatie' : (editMode === 'place' ? 'Plek aanpassen' : editMode === 'identity' ? 'Naam en type' : 'Locatie'));
    const coordinateInput = (coordinate) => coordinate == null ? '' : String(coordinate);

    root.innerHTML = `
      <section class="module-view location-editor-view">
        <div class="sh-location-editor-nav"><button type="button" data-back>‹ Locaties</button><span>${isNew ? 'Toevoegen' : escapeHtml(pathForLocation(item, byId))}</span></div>
        <form class="location-form" data-location-form>
          <label class="clean-field"><span>Naam</span><input type="text" name="title" maxlength="80" required value="${escapeAttribute(original.title || '')}" placeholder="Naam van de plek"></label>
          <label class="clean-field"><span>Onder locatie</span>
            <select name="parentId"><option value="">Geen · hoofdlocatie</option>${choices.map(x => `<option value="${escapeAttribute(x.id)}" ${x.id === initialParent ? 'selected' : ''}>${escapeHtml(pathForLocation(x, byId))}</option>`).join('')}</select>
          </label>
          <div class="sh-location-group">
            <label class="clean-field"><span>Adres (optioneel)</span><input name="address" type="text" maxlength="300" value="${escapeAttribute(addressText(original.address))}" placeholder="Straat, huisnummer, plaats"></label>
            <div class="sh-location-tools"><button type="button" data-lookup>Zoek GPS bij adres</button><button type="button" data-reverse>Zoek adres bij GPS</button></div>
            <small class="sh-location-note" data-inherit-address>${!addressText(original.address) && effective?.address ? 'Zonder eigen adres: ' + escapeHtml(effective.address) : 'Iedere locatie mag een eigen adres hebben.'}</small>
          </div>
          <div class="sh-location-group">
            <div class="sh-location-inline-header"><span>GPS-coördinaten (optioneel)</span><button type="button" data-current-gps>Gebruik huidige GPS</button></div>
            <div class="sh-location-coordinates">
              <label class="clean-field"><span>Breedtegraad</span><input name="lat" type="number" inputmode="decimal" step="any" min="-90" max="90" value="${escapeAttribute(coordinateInput(own?.lat))}" placeholder="52.00000"></label>
              <label class="clean-field"><span>Lengtegraad</span><input name="lng" type="number" inputmode="decimal" step="any" min="-180" max="180" value="${escapeAttribute(coordinateInput(own?.lng))}" placeholder="6.00000"></label>
            </div>
            <small class="sh-location-note">${!own && effective?.coordinates ? 'Zonder eigen GPS: positie van bovenliggende locatie (' + escapeHtml(formatCoordinates(effective.coordinates)) + ').' : 'GPS kan handmatig of via je huidige positie worden ingevuld.'}</small>
          </div>
          <label class="clean-field"><span>Type</span>
            <select name="kind">${LOCATION_TYPES.map(([id, title]) => `<option value="${id}" ${(original.kind || 'other') === id ? 'selected' : ''}>${title}</option>`).join('')}</select>
          </label>
          <label class="clean-field"><span>Rit delen</span>
            <select name="shareRide">
              <option value="never" ${(original.shareRide || 'never') === 'never' ? 'selected' : ''}>Nooit</option>
              <option value="ask" ${original.shareRide === 'ask' ? 'selected' : ''}>Vraag mij</option>
              <option value="always" ${original.shareRide === 'always' ? 'selected' : ''}>Altijd</option>
            </select>
            <small class="sh-location-note">Wordt benut zodra de rittenmodule in Sharon actief is.</small>
          </label>
          <label class="clean-field radius-field"><span>Herkenningsstraal</span><div><input name="radiusM" type="number" min="20" max="2000" step="10" value="${radius(original.radiusM)}"><em>meter</em></div></label>
          <section class="clean-section">
            <div class="section-heading"><span>Melding bij binnenkomst</span><label class="mini-switch"><input name="triggerEnabled" type="checkbox" ${trigger.enabled ? 'checked' : ''}><span></span></label></div>
            <label class="clean-field trigger-message"><span>Tekst melding</span><input name="triggerMessage" maxlength="160" value="${escapeAttribute(trigger.message || 'Je bent bij ' + (original.title || 'deze plek') + '.')}" /></label>
            <p class="clean-help">Een melding verschijnt pas wanneer Sharon eerst buiten en vervolgens binnen de straal meet. Er wordt geen extra GPS-volgsysteem gestart.</p>
          </section>
          <div class="location-check"><button class="text-action" type="button" data-check-distance>Controleer afstand</button><span data-distance-status></span></div>
          <p class="sh-location-feedback" data-editor-status role="status"></p>
          <button type="submit" class="primary-line-action">${isNew ? 'Voeg locatie toe' : 'Bewaar locatie'}</button>
        </form>
        ${item ? `<div class="sh-location-secondary-actions">
          <button type="button" class="sh-location-add-child" data-add-child>+ Sublocatie toevoegen</button>
          <button type="button" class="sh-location-merge-button" data-open-merge>Samenvoegen…</button>
        </div>
        <div class="sh-location-merge" data-merge-panel hidden>
          <label class="clean-field"><span>Samenvoegen met</span><select data-merge-other>
            ${locations.filter(x => x.id !== item.id).map(x => `<option value="${escapeAttribute(x.id)}">${escapeHtml(pathForLocation(x, byId))}</option>`).join('')}
          </select></label>
          <label class="clean-field"><span>Welke locatie blijft bestaan?</span><select data-merge-keep>
            <option value="current">Deze locatie</option><option value="other">De geselecteerde locatie</option>
          </select></label>
          <p class="clean-help">Onderliggende locaties en verwijzingen gaan mee. Samenvoegen van een locatie met haar eigen (sub)locatie is niet mogelijk.</p>
          <button type="button" class="primary-line-action" data-merge-confirm>Samenvoegen</button>
        </div>` : ''}
      </section>
    `;

    const form = root.querySelector('[data-location-form]');
    const status = root.querySelector('[data-editor-status]');
    const setStatus = msg => { status.textContent = msg; };
    root.querySelector('[data-back]').addEventListener('click', () => list());
    root.querySelector('[data-add-child]')?.addEventListener('click', () => edit(null, item.id));
    root.querySelector('[data-open-merge]')?.addEventListener('click', () => {
      const panel = root.querySelector('[data-merge-panel]');
      panel.hidden = !panel.hidden;
    });
    root.querySelector('[data-merge-confirm]')?.addEventListener('click', async () => {
      const otherId = root.querySelector('[data-merge-other]').value;
      const keepOther = root.querySelector('[data-merge-keep]').value === 'other';
      try {
        if (!otherId) throw Error('Geen tweede locatie beschikbaar.');
        await mergeLocations(item.id, otherId, keepOther);
      } catch (error) { setStatus(error.message); }
    });
    root.querySelector('[data-current-gps]').addEventListener('click', async () => {
      const button = root.querySelector('[data-current-gps]');
      button.disabled = true;
      setStatus('GPS wordt bepaald…');
      try {
        const pos = await location.checkNow({ reason: 'location-editor', maxAgeMs: 0, highAccuracy: true, browserMaxAgeMs: 0 });
        if (!form.isConnected) return;
        form.elements.lat.value = pos.lat;
        form.elements.lng.value = pos.lng;
        form.elements.lat.dispatchEvent(new Event('input', { bubbles: true }));
        form.dispatchEvent(new CustomEvent('sh-location-accuracy', {
          detail: { accuracy: pos.accuracy, point: { lat: pos.lat, lng: pos.lng } }
        }));
        setStatus(`GPS ingesteld · nauwkeurigheid ±${Math.round(pos.accuracy)} m`);
      } catch (error) { setStatus(error.message); }
      finally { button.disabled = false; }
    });
    root.querySelector('[data-lookup]').addEventListener('click', async () => {
      const address = form.elements.address.value.trim();
      if (!address) return setStatus('Vul eerst een adres in.');
      if (!geocoder) return setStatus('Adreszoeken is nog niet beschikbaar.');
      setStatus('Adres wordt opgezocht…');
      try {
        const found = (await geocoder.search(address))[0];
        if (!found) return setStatus('Adres niet gevonden.');
        if (!form.isConnected) return;
        form.elements.lat.value = found.lat;
        form.elements.lng.value = found.lng;
        form.elements.lat.dispatchEvent(new Event('input', { bubbles: true }));
        pickedAddress = null;
        setStatus('GPS ingevuld vanuit het gevonden adres. Controleer de positie.');
      } catch (error) { setStatus(error.message); }
    });
    root.querySelector('[data-reverse]').addEventListener('click', async () => {
      const lat = readNumber(form.elements.lat.value), lng = readNumber(form.elements.lng.value);
      if (lat === null || lng === null) return setStatus('Vul eerst beide GPS-coördinaten in.');
      if (!geocoder) return setStatus('Adreszoeken is nog niet beschikbaar.');
      setStatus('Adres wordt opgezocht…');
      try {
        const result = await geocoder.reverse({ lat, lng });
        if (!result || !form.isConnected) return;
        pickedAddress = { street: result.street, number: result.number, postcode: result.postcode, city: result.city };
        form.elements.address.value = addressText(pickedAddress);
        form.elements.address.dispatchEvent(new Event('input', { bubbles: true }));
        setStatus('Adres overgenomen. Controleer en bewaar de locatie.');
      } catch (error) { setStatus(error.message); }
    });
    root.querySelector('[data-check-distance]').addEventListener('click', async () => {
      const lat = readNumber(form.elements.lat.value), lng = readNumber(form.elements.lng.value);
      const parent = byId.get(form.elements.parentId.value);
      const target = lat !== null && lng !== null ? { lat, lng } : resolveLocation(parent, byId).coordinates;
      if (!target) return setStatus('Nog geen eigen of geërfde GPS-positie.');
      setStatus('Afstand controleren…');
      try {
        const point = await location.checkNow({ reason: 'location-distance', maxAgeMs: 0, highAccuracy: true, browserMaxAgeMs: 0 });
        if (!form.isConnected) return;
        const meters = Math.round(distanceBetween(point, target));
        setStatus(`${meters} m afstand · ${meters <= radius(form.elements.radiusM.value) ? 'binnen' : 'buiten'} herkenningsstraal`);
      } catch (error) { setStatus(error.message); }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      const saveButton = form.querySelector('[type="submit"]');
      saveButton.disabled = true;
      try {
        const values = new FormData(form);
        const title = String(values.get('title') || '').trim();
        const parentId = String(values.get('parentId') || '');
        const text = String(values.get('address') || '').trim();
        const lat = readNumber(values.get('lat')), lng = readNumber(values.get('lng'));
        if (!title) throw Error('Geef de locatie een naam.');
        if ((lat === null) !== (lng === null)) throw Error('Vul beide GPS-coördinaten in of laat beide leeg.');
        if (lat !== null && (Math.abs(lat) > 90 || Math.abs(lng) > 180)) throw Error('Ongeldige GPS-coördinaten.');
        if (parentId && (!byId.has(parentId) || (item && isDescendant(parentId, item.id, byId)))) throw Error('Kies een geldige bovenliggende locatie.');
        const now = Date.now();
        const savedId = item?.id || crypto.randomUUID();
        const oldAddress = addressText(original.address);
        const address = text === oldAddress ? (original.address || {}) :
          (pickedAddress && text === addressText(pickedAddress) ? pickedAddress : (text ? { text } : {}));
        const saved = {
          ...(item || { id: savedId, externalId: null, type: 'location', schemaVersion: 1, createdAt: now, deletedAt: null }),
          updatedAt: now,
          data: {
            ...original, title, parentId, address,
            coordinates: lat === null ? null : { lat, lng },
            kind: String(values.get('kind') || 'other'),
            shareRide: String(values.get('shareRide') || 'never'),
            radiusM: radius(values.get('radiusM'))
          }
        };
        await store.put('objects', saved);
        const enabled = values.get('triggerEnabled') === 'on';
        if (locationAction || enabled) {
          await store.put('objects', {
            ...(locationAction || { id: crypto.randomUUID(), externalId: null, type: 'location-action', schemaVersion: 1, createdAt: now, deletedAt: null }),
            updatedAt: now,
            data: {
              ...(locationAction?.data || {}), locationId: savedId, event: 'enter', enabled,
              message: String(values.get('triggerMessage') || '').trim() || `Je bent bij ${title}.`,
              state: null
            }
          });
          events.emit('location-action.updated', { locationId: savedId, enabled });
        }
        events.emit(item ? 'location.updated' : 'location.created', { id: savedId });
        await reload();
        await list('Locatie bewaard.');
      } catch (error) {
        setStatus(error.message);
      } finally { saveButton.disabled = false; }
    });
    const knownLocations = choices.filter(candidate => resolveLocation(candidate, byId).address)
      .map(candidate => {
        const effective = resolveLocation(candidate, byId);
        return {
          id: candidate.id, title: candidate.data?.title || 'Locatie',
          address: effective.address, coordinates: effective.coordinates,
          radiusM: radius(candidate.data?.radiusM)
        };
      });
    const savedLocations = choices.map(candidate => {
      const effective = resolveLocation(candidate, byId);
      return {
        id: candidate.id, title: candidate.data?.title || 'Locatie',
        coordinates: effective.coordinates, radiusM: radius(candidate.data?.radiusM)
      };
    });
    releaseEditor = enhanceLocationEditor(root, {
      isNew, editMode, useGps, location, geocoder, events, knownLocations, savedLocations,
      initialParent, onOpenExisting: id => detail(byId.get(id)), saveInHeader: false
    });

  }


  async function mergeLocations(currentId, otherId, keepOther) {
    const current = byId.get(currentId), other = byId.get(otherId);
    if (!current || !other || current.id === other.id) throw Error('Kies twee verschillende locaties.');
    if (isDescendant(current.id, other.id, byId) || isDescendant(other.id, current.id, byId)) {
      throw Error('Verplaats de locaties eerst: een locatie kan niet met haar eigen sublocatie worden samengevoegd.');
    }
    const keep = keepOther ? other : current;
    const remove = keepOther ? current : other;
    if (!confirm(`“${remove.data.title}” samenvoegen met “${keep.data.title}”? Alle onderliggende locaties worden behouden.`)) return;
    const now = Date.now();
    const ownKeep = ownCoordinates(keep), ownRemove = ownCoordinates(remove);
    const updatedKeep = {
      ...keep, updatedAt: now,
      data: {
        ...keep.data,
        address: addressText(keep.data.address) ? keep.data.address : (remove.data.address || {}),
        coordinates: ownKeep || ownRemove,
        kind: (keep.data.kind || 'other') !== 'other' ? keep.data.kind : (remove.data.kind || 'other'),
        shareRide: (keep.data.shareRide || 'never') !== 'never' ? keep.data.shareRide : (remove.data.shareRide || 'never')
      }
    };
    await store.put('objects', updatedKeep);
    const hasKeepAction = objects.some(x => x.type === 'location-action' && !x.deletedAt && x.data?.locationId === keep.id);
    for (const record of objects) {
      if (record.deletedAt || record.id === remove.id || record.id === keep.id) continue;
      const data = record.data || {};
      let next = data;
      if (record.type === 'location' && parentIdOf(record) === remove.id) {
        next = { ...next, parentId: keep.id };
      }
      if (data.locationId === remove.id) {
        if (record.type === 'location-action' && hasKeepAction) {
          await store.put('objects', { ...record, updatedAt: now, deletedAt: now, data: { ...data, enabled: false } });
          continue;
        }
        next = { ...next, locationId: keep.id, ...(record.type === 'location-action' ? { state: null } : {}) };
      }
      if (next !== data) await store.put('objects', { ...record, updatedAt: now, data: next });
    }
    await store.put('objects', { ...remove, updatedAt: now, deletedAt: now });
    events.emit('location.updated', { id: keep.id });
    events.emit('location.deleted', { id: remove.id, mergedInto: keep.id });
    await reload();
    await list('Locaties samengevoegd.');
  }

  if (initialLocationId && byId.has(initialLocationId)) await edit(byId.get(initialLocationId));
  else await list();
  return () => { unbindSwipes?.(); releaseEditor?.(); };
}

function radius(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.max(20, Math.min(2000, Math.round(n))) : DEFAULT_RADIUS;
}
function readNumber(value) {
  if (value == null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function formatCoordinates(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
    ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : '—';
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]);
}
function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>"']/g, char =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
