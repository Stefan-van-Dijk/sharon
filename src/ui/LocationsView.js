import { distanceBetween } from '../core/location/LocationTriggerService.js?v=0.1.91';
import { bindSwipeRows } from './SwipeRows.js?v=0.1.90';
import {
  LOCATION_TYPES, addressText, ownCoordinates, parentIdOf,
  locationMap, resolveLocation, isDescendant, pathForLocation, orderedLocations
} from '../core/location/LocationHierarchy.js?v=0.1.91';

const PREF_KEY = 'locations.preferences';
const TYPES = new Map(LOCATION_TYPES);
const DEFAULT_RADIUS = 100;

export async function openLocationsView(root, {
  store, location, geocoder, events, initialLocationId = '', setTitle = () => {}
}) {
  let objects = [], locations = [], byId = new Map();
  let prefs = (await store.get('meta', PREF_KEY))?.value || { sort: 'alpha', order: [] };
  let unbindSwipes = null;

  async function reload() {
    objects = await store.getAll('objects');
    locations = objects.filter(item => item.type === 'location' && !item.deletedAt);
    byId = locationMap(locations);
  }
  await reload();

  async function list(status = '') {
    setTitle('Locaties');
    unbindSwipes?.();
    const rows = orderedLocations(locations, prefs.sort, prefs.order);
    root.innerHTML = `
      <section class="module-view locations-view">
        <div class="sh-locations-toolbar">
          <button type="button" data-create-location>+ Locatie</button>
          <button type="button" data-create-current>Huidige positie</button>
        </div>
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
                  <button type="button" class="swipe-action-edit" data-swipe-edit>Bewerk</button>
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
        <div class="sh-locations-transfer">
          <label class="sh-location-file">Importeer uit Log<input type="file" accept=".json,application/json" data-import hidden></label>
          <button type="button" data-export>Exporteer</button>
        </div>
        <p class="sh-location-feedback" role="status" data-list-status>${escapeHtml(status)}</p>
      </section>
    `;

    root.querySelector('[data-create-location]').addEventListener('click', () => edit(null));
    root.querySelector('[data-create-current]').addEventListener('click', () => edit(null, '', true));
    unbindSwipes = bindSwipeRows(root.querySelector('[data-swipe-list]'), {
      onOpen: id => edit(byId.get(id)),
      onEdit: id => edit(byId.get(id)),
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
    root.querySelector('[data-import]').addEventListener('change', async event => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      try {
        const count = await importLogLocations(JSON.parse(await file.text()));
        await reload();
        list(count ? `${count} locaties geïmporteerd.` : 'Geen nieuwe locaties gevonden.');
      } catch (error) {
        root.querySelector('[data-list-status]').textContent = error.message;
      }
    });
    root.querySelector('[data-export]').addEventListener('click', () => exportLocations());
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

  async function edit(item = null, selectedParent = '', useGps = false) {
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
    setTitle(isNew ? 'Nieuwe locatie' : 'Locatie');
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
    if (useGps) root.querySelector('[data-current-gps]').click();
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

  async function importLogLocations(bundle) {
    const source = bundle?.locations ||
      bundle?.kilometer?.locations ||
      bundle?.data?.locations ||
      bundle?.recovery?.sources?.kilometers?.data?.locations ||
      bundle?.recovery?.sources?.kilometer?.data?.locations ||
      bundle?.source_data?.kilometer?.data?.locations;
    if (!Array.isArray(source)) throw Error('Geen Log-locaties aangetroffen in dit JSON-bestand.');
    if (!source.length) return 0;
    if (!confirm(`${source.length} locaties uit Log toevoegen? Bestaande locaties blijven behouden; eerder geïmporteerde worden overgeslagen.`)) return 0;
    const ids = new Map();
    const existing = new Map(locations.filter(x => x.data?.logSourceId || x.data?.importSourceId || (bundle.app === 'sharon' && x.id))
      .map(x => [String(x.data?.logSourceId || x.data?.importSourceId || x.id), x.id]));
    for (const row of source) {
      if (!row || typeof row !== 'object') continue;
      const sourceId = String(row.id || '');
      if (sourceId) ids.set(sourceId, existing.get(sourceId) || crypto.randomUUID());
    }
    let count = 0;
    for (const row of source) {
      if (!row || typeof row !== 'object' || !row.id || existing.has(String(row.id))) continue;
      const now = Date.now();
      const lat = readNumber(row.lat), lng = readNumber(row.lng);
      const coords = lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
      const obj = {
        id: ids.get(String(row.id)), externalId: null, type: 'location', schemaVersion: 1,
        createdAt: now, updatedAt: now, deletedAt: null,
        data: {
          title: String(row.name || row.address || 'Locatie').slice(0, 80),
          parentId: ids.get(String(row.parentId || '')) || '',
          address: row.address ? { text: String(row.address) } : {},
          coordinates: coords,
          kind: TYPES.has(row.type) ? row.type : 'other',
          shareRide: ['never', 'ask', 'always'].includes(row.shareRide) ? row.shareRide : 'never',
          radiusM: DEFAULT_RADIUS,
          importSourceId: String(row.id),
          importApp: bundle.app === 'sharon' ? 'sharon' : 'log',
          ...(bundle.app === 'sharon' ? {} : { logSourceId: String(row.id) })
        }
      };
      await store.put('objects', obj);
      count++;
    }
    if (count) events.emit('location.imported', { count });
    return count;
  }

  function exportLocations() {
    const data = locations.map(item => ({
      id: item.id, name: item.data?.title || '', parentId: parentIdOf(item),
      address: addressText(item.data?.address),
      ...ownCoordinates(item), type: item.data?.kind || 'other',
      shareRide: item.data?.shareRide || 'never'
    }));
    const blob = new Blob([JSON.stringify({ app: 'sharon', locations: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sharon-locaties.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (initialLocationId && byId.has(initialLocationId)) await edit(byId.get(initialLocationId));
  else await list();
  return () => unbindSwipes?.();
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
function locationIcon(type) {
  return ({ home: '⌂', work: '▣', business: '◇', private: '○', other: '·' })[type] || '·';
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
