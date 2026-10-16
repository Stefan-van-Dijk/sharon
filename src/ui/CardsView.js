import { CARD_FORMATS, renderCardCode, validateCardCode } from './CardCodes.js';
import { renderStrip } from './Strip.js?v=0.2.60';
import { bindSwipeRows } from './SwipeRows.js?v=0.2.60';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.22';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const normalizeName = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const kindLabels = { loyalty: 'Klantenpas', membership: 'Lidmaatschap', access: 'Toegangspas', ticket: 'Ticket', other: 'Overige kaart' };

export async function openCardsView(outlet, { store, setTitle, headerActions }) {
  let editingId = null;
  let sort = 'alpha';
  let releaseRows = null;
  const title = value => { if (typeof setTitle === 'function') setTitle(value); };
  const header = () => { if (headerActions) headerActions.replaceChildren(); };

  async function records() {
    const all = await store.getAll('objects');
    return all.filter(item => item.type === 'card');
  }

  async function showList() {
    editingId = null;
    title('Kaarten');
    releaseRows?.();
    releaseRows = null;
    header();
    if (headerActions) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'sh-location-header-add';
      add.setAttribute('aria-label', 'Kaart toevoegen');
      add.textContent = '+';
      add.addEventListener('click', () => showForm());
      headerActions.append(add);
    }
    const cards = await records();
    cards.sort(sort === 'recent'
      ? (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
      : (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'nl'));
    outlet.innerHTML = `
      <section class="module-view locations-view sh-card-view">
        <div class="sh-locations-sort" aria-label="Kaarten sorteren">
          <button type="button" data-card-sort="recent" ${sort === 'recent' ? 'aria-pressed="true"' : ''}>Recent</button>
          <button type="button" data-card-sort="alpha" ${sort === 'alpha' ? 'aria-pressed="true"' : ''}>A–Z</button>
        </div>
        <div class="sh-locations-list swipe-list" data-card-list>
          ${cards.length ? cards.map(card => renderStrip({
            id: card.id,
            className: 'sh-location-strip',
            surfaceClassName: 'sh-location-row',
            variant: 'location',
            ariaLabel: card.name,
            leadingHtml: '<span class="sh-location-kind" aria-hidden="true">▤</span>',
            bodyHtml: '<span class="sh-location-copy"><strong>' + escapeHtml(card.name) + '</strong><small>' + (kindLabels[card.cardKind] || 'Overige kaart') + '</small></span>',
            trailingHtml: '<span class="sh-location-chevron" aria-hidden="true">›</span>',
            actions: [{ kind: 'delete', label: 'Verwijder' }]
          })).join('') : '<p class="empty-state">Nog geen kaarten. Voeg een kaart toe om te beginnen.</p>'}
        </div>
      </section>`;
    releaseRows = bindSwipeRows(outlet.querySelector('[data-card-list]'), {
      onOpen: id => showDetail(id),
      onDelete: async id => {
        const card = await store.get('objects', id);
        if (!card || card.type !== 'card' || !confirm('Wil je deze kaart verwijderen?')) return;
        await store.delete('objects', id);
        await showList();
      }
    });
    outlet.querySelectorAll('[data-card-sort]').forEach(button =>
      button.addEventListener('click', () => { sort = button.dataset.cardSort; showList(); }));
  }

  async function showDetail(id) {
    const card = await store.get('objects', id);
    if (!card || card.type !== 'card') return showList();
    releaseRows?.(); releaseRows = null;
    title('Kaart'); header();
    if (headerActions) {
      const edit = document.createElement('button');
      edit.type = 'button'; edit.className = 'sh-location-header-save';
      edit.textContent = 'Bewerk'; edit.addEventListener('click', () => showForm(id));
      headerActions.append(edit);
    }
    const fields = Array.isArray(card.fields) ? card.fields : [];
    outlet.innerHTML = `
      <section class="module-view sh-card-view sh-location-detail-view">
        <button type="button" data-card-back style="background:none;border:0;color:#777;padding:12px 0 22px">‹ Kaarten</button>
        <div style="border-top:1px solid #ececef;padding:28px 0">
          <p style="font-size:13px;color:#888">${kindLabels[card.cardKind] || 'Overige kaart'}</p>
          <h2 style="font-size:30px;font-weight:350">${escapeHtml(card.name)}</h2>
        </div>
        ${card.codeValue ? `<div data-card-code style="padding:18px;background:white"></div><details><summary>Code-inhoud</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(card.codeValue)}</pre></details>` : ''}
        <button type="button" data-card-share style="border:1px solid #ddd;background:white;padding:14px;margin:14px 0">Kaartgegevens als QR-code</button>
        <div data-card-share-output></div>
        ${card.cardNumber ? `<div style="padding:18px 0;border-top:1px solid #ececef"><small>Kaartnummer</small><p>${escapeHtml(card.cardNumber)}</p></div>` : ''}
        ${fields.map(field => `<div style="padding:18px 0;border-top:1px solid #ececef"><small>${escapeHtml(field.label)}</small><p style="overflow-wrap:anywhere">${escapeHtml(field.value)}</p></div>`).join('')}
        ${!card.cardNumber && !fields.length ? '<p style="color:#888">Nog geen eigen informatie. Tik op Bewerk om gegevens toe te voegen.</p>' : ''}
      </section>`;
    const codeHost = outlet.querySelector('[data-card-code]');
    if (codeHost) renderCardCode(codeHost, card.codeFormat || 'QR_CODE', card.codeValue).catch(error => { codeHost.textContent = error.message; });
    outlet.querySelector('[data-card-share]').addEventListener('click', async () => {
      const payload = JSON.stringify({kind:'sharon-card',version:1,name:card.name,cardKind:card.cardKind || 'other',
        cardNumber:card.cardNumber || '',color:card.color || '#489ff8',codeFormat:card.codeFormat || '',
        codeValue:card.codeValue || '',fields:Array.isArray(card.fields) ? card.fields : []});
      const output = outlet.querySelector('[data-card-share-output]');
      try { await renderCardCode(output, 'QR_CODE', payload); }
      catch(error) { output.textContent = error.message; }
    });
    outlet.querySelector('[data-card-back]').addEventListener('click', showList);
  }

  async function showForm(id = null) {
    const card = id ? await store.get('objects', id) : null;
    if (id && (!card || card.type !== 'card')) return showList();
    editingId = card?.id || null;
    title(card ? 'Kaart aanpassen' : 'Nieuwe kaart');
    releaseRows?.();
    releaseRows = null;
    header();
    const locations = (await store.getAll('objects')).filter(item => item.type === 'location' && !item.deletedAt);
    outlet.innerHTML = `
      <section class="module-view sh-card-view sh-location-dialog">
        <form data-card-form class="sh-card-form">
          <div class="sh-location-question">
          <h2 class="sh-location-question-title">Hoe heet deze kaart?</h2>
          <label for="card-name" style="display:block;font-size:13px;color:#777;margin-bottom:10px">Naam van de winkel of organisatie</label>
          <input id="card-name" name="name" maxlength="100" autocomplete="organization" required
            value="${escapeHtml(card?.name || '')}"
            placeholder="Bijvoorbeeld Jumbo" style="width:100%;border:0;border-bottom:1px solid #d6d6da;border-radius:0;padding:10px 0;font-size:21px;background:transparent;outline:none">
          <label for="card-kind" style="display:block;margin-top:26px;font-size:13px;color:#777">Soort kaart</label>
          <select name="cardKind" id="card-kind" style="width:100%;height:48px;border:0;border-bottom:1px solid #ddd;background:#fff;font-size:18px">
            ${Object.entries(kindLabels).map(([key,label]) => `<option value="${key}" ${(card?.cardKind || "other") === key ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <label for="card-number" style="display:block;margin-top:24px;font-size:13px;color:#777">Kaartnummer (optioneel)</label>
          <input id="card-number" name="cardNumber" maxlength="200" value="${escapeHtml(card?.cardNumber || "")}" placeholder="Nummer op de pas" style="width:100%;height:48px;border:0;border-bottom:1px solid #ddd;background:transparent;font-size:18px">
          <label for="card-color" style="display:block;margin-top:24px;font-size:13px;color:#777">Herkenningskleur</label>
          <input id="card-color" name="color" type="color" value="${/^#[0-9a-f]{6}$/i.test(card?.color || "") ? card.color : "#489ff8"}">
          <label for="card-format" style="display:block;margin-top:24px;font-size:13px;color:#777">Codetype</label>
          <select id="card-format" name="codeFormat" style="display:block;width:100%;height:46px;border:0;border-bottom:1px solid #ddd"><option value="">Geen code</option>
            ${Object.entries(CARD_FORMATS).map(([value,label]) => `<option value="${value}" ${(card?.codeFormat || "") === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
          <label for="card-value" style="display:block;margin-top:24px;font-size:13px;color:#777">Code-inhoud</label>
          <textarea id="card-value" name="codeValue" maxlength="2000" autocapitalize="off" spellcheck="false" rows="3" style="display:block;width:100%;border:1px solid #ddd;border-radius:8px;padding:12px">${escapeHtml(card?.codeValue || "")}</textarea>
          <div data-card-code-preview style="margin-top:12px;background:#fff"></div>
          <label for="card-location" style="display:block;margin-top:24px;font-size:13px;color:#777">Locatie</label>
          <select id="card-location" name="locationId" style="display:block;width:100%;height:46px;border:0;border-bottom:1px solid #ddd"><option value="">Zonder locatie</option>
            ${locations.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === card?.locationId ? "selected" : ""}>${escapeHtml(item.data?.title || "Locatie")}</option>`).join("")}
          </select>
          <p style="margin-top:28px;font-size:15px">Eigen informatie</p>
          <div data-card-fields></div>
          <button type="button" data-add-card-field style="border:0;background:none;padding:12px 0">+ Informatieveld toevoegen</button>
          <p data-card-error role="alert" style="min-height:22px;color:#ad3030;font-size:13px"></p>
          </div>
          <div class="sh-location-simple-footer"><div class="sh-location-simple-footer-inner">
            <button type="button" data-cancel class="story-text-action" style="background:none;border:0">Annuleren</button>
            <button type="submit" class="sh-location-simple-submit">Opslaan</button>
          </div></div>
          ${card ? '<button type="button" data-delete style="margin-top:10px;background:none;border:0;color:#a33">Kaart verwijderen</button>' : ''}
        </form>
      </section>`;
    const form = outlet.querySelector('[data-card-form]');
    const input = form.elements.name;
    const fieldHost = form.querySelector('[data-card-fields]');
    const addField = (label = '', value = '') => {
      if (fieldHost.children.length >= 30) return;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:12px 0';
      row.innerHTML = '<input data-field-label maxlength="80" placeholder="Veldnaam" aria-label="Veldnaam" style="min-width:0;width:40%;padding:12px 2px;border:0;border-bottom:1px solid #ddd">' +
        '<input data-field-value maxlength="1000" placeholder="Inhoud" aria-label="Inhoud" style="min-width:0;width:50%;padding:12px 2px;border:0;border-bottom:1px solid #ddd">' +
        '<button type="button" aria-label="Veld verwijderen" style="border:0;background:none;font-size:22px">×</button>';
      row.querySelector('[data-field-label]').value = label;
      row.querySelector('[data-field-value]').value = value;
      row.querySelector('button').addEventListener('click', () => row.remove());
      fieldHost.append(row);
    };
    (Array.isArray(card?.fields) ? card.fields : []).forEach(field => addField(field.label, field.value));
    form.querySelector('[data-add-card-field]').addEventListener('click', () => addField());
    const previewHost = form.querySelector('[data-card-code-preview]');
    let previewGeneration = 0;
    const updateCodePreview = async () => {
      const generation = ++previewGeneration, format = form.elements.codeFormat.value;
      const value = form.elements.codeValue.value;
      previewHost.replaceChildren();
      if (!format || !value) return;
      try { await renderCardCode(previewHost, format, value); }
      catch(error) { if (generation === previewGeneration) previewHost.textContent = error.message; }
    };
    form.elements.codeFormat.addEventListener('change', updateCodePreview);
    form.elements.codeValue.addEventListener('input', updateCodePreview);
    updateCodePreview();
    input.focus();
    form.querySelector('[data-cancel]').addEventListener('click', () => card ? showDetail(card.id) : showList());
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const name = normalizeName(input.value);
      const error = form.querySelector('[data-card-error]');
      if (!name) { error.textContent = 'Vul eerst een naam in.'; return; }
      const format = form.elements.codeFormat.value, value = form.elements.codeValue.value;
      if (format || value) {
        try {
          validateCardCode(format, value);
          await renderCardCode(document.createElement('div'), format, value);
        } catch (cause) { error.textContent = cause.message; return; }
      }
      const now = new Date().toISOString();
      const record = {
        ...(card || {}),
        id: card?.id || IdentifierService.create(),
        type: 'card',
        name,
        cardKind: form.elements.cardKind.value,
        color: form.elements.color.value,
        codeFormat: format,
        codeValue: value,
        locationId: form.elements.locationId.value || null,
        cardNumber: form.elements.cardNumber.value.trim(),
        fields: [...fieldHost.children].map(row => ({label: row.querySelector('[data-field-label]').value.trim(), value: row.querySelector('[data-field-value]').value.trim()})).filter(field => field.label && field.value),
        createdAt: card?.createdAt || now,
        updatedAt: now
      };
      try {
        await store.put('objects', record);
        await showDetail(record.id);
      } catch {
        error.textContent = 'Opslaan is niet gelukt. Probeer het opnieuw.';
      }
    });
    const remove = form.querySelector('[data-delete]');
    if (remove) remove.addEventListener('click', async () => {
      if (!confirm('Wil je deze kaart verwijderen?')) return;
      await store.delete('objects', card.id);
      await showList();
    });
  }

  await showList();
}
