import { CARD_NAME_QUESTIONS } from './CardQuestions.js';
import { buildCardPayload, parseCardPayload } from './CardPayload.js';
import { mountCardScanner } from './CardScanner.js';
import { CARD_FORMATS, renderCardCode, validateCardCode } from './CardCodes.js';
import { renderStrip } from './Strip.js?v=0.2.60';
import { bindSwipeRows } from './SwipeRows.js?v=0.2.60';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.23';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const normalizeName = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const kindLabels = { loyalty: 'Klantenpas', membership: 'Lidmaatschap', access: 'Toegangspas', ticket: 'Ticket', other: 'Overige kaart' };

export async function openCardsView(outlet, { store, setTitle, headerActions }) {
  let editingId = null;
  let stopScanner = null;
  let sort = 'alpha';
  let releaseRows = null;
  const title = value => { if (typeof setTitle === 'function') setTitle(value); };
  const header = () => { if (headerActions) headerActions.replaceChildren(); };

  async function records() {
    const all = await store.getAll('objects');
    return all.filter(item => item.type === 'card');
  }

  async function showList() {
    stopScanner?.(); stopScanner = null;
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
    const locationItems = (await store.getAll('objects')).filter(item => item.type === 'location' && !item.deletedAt);
    cards.sort(sort === 'recent'
      ? (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
      : (a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'nl'));
    outlet.innerHTML = `
      <section class="module-view locations-view sh-card-view">
        <div style="display:flex;gap:10px;margin-bottom:18px"><button type="button" data-card-scan style="flex:1;border:0;background:#111;color:#fff;min-height:46px">Code scannen</button><button type="button" data-card-create style="flex:1;border:1px solid #ddd;background:white;min-height:46px">+ Nieuwe kaart</button></div>
        <label style="display:block;font-size:13px;color:#888;margin-bottom:18px">Zoeken<input data-card-search type="search" placeholder="Kaart zoeken" style="display:block;width:100%;height:42px;border:0;border-bottom:1px solid #ddd;background:transparent"></label>
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
            bodyHtml: '<span class="sh-location-copy"><strong>' + escapeHtml(card.name) + '</strong><small>' + (kindLabels[card.cardKind] || 'Overige kaart') + (card.locationId ? ' · ' + escapeHtml(locationItems.find(loc => loc.id === card.locationId)?.data?.title || 'Locatie niet beschikbaar') : '') + '</small></span>',
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
    outlet.querySelector('[data-card-scan]').addEventListener('click', showScanner);
    outlet.querySelector('[data-card-create]').addEventListener('click', () => showForm());
    outlet.querySelector('[data-card-search]').addEventListener('input', event => {
      const q = event.target.value.trim().toLocaleLowerCase('nl');
      outlet.querySelectorAll('[data-card-list] [data-swipe-row]').forEach(row => {
        const card = cards.find(item => item.id === row.dataset.swipeRow);
        row.hidden = Boolean(q) && !String(card?.name || '').toLocaleLowerCase('nl').includes(q)
          && !String(card?.codeValue || '').toLocaleLowerCase('nl').includes(q);
      });
    });
    outlet.querySelectorAll('[data-card-sort]').forEach(button =>
      button.addEventListener('click', () => { sort = button.dataset.cardSort; showList(); }));
  }

  function showScanner() {
    title('Code scannen');
    header();
    releaseRows?.(); releaseRows = null;
    stopScanner?.();
    stopScanner = mountCardScanner(outlet, {
      onClose: showList,
      onResult: async result => {
        stopScanner = null;
        const existing = (await records()).filter(item => item.codeValue === result.value && item.codeFormat === result.format);
        if (existing.length === 1) return showDetail(existing[0].id);
        const shared = result.format === 'QR_CODE' ? parseCardPayload(result.value) : null;
        return showForm(null, shared || result);
      }
    });
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
      const payload = buildCardPayload(card);
      const output = outlet.querySelector('[data-card-share-output]');
      try { await renderCardCode(output, 'QR_CODE', payload); }
      catch(error) { output.textContent = error.message; }
    });
    outlet.querySelector('[data-card-back]').addEventListener('click', showList);
  }

  async function showForm(id = null, scanned = null) {
    const imported = scanned?.name ? scanned : null;
    const card = id ? await store.get('objects', id) : null;
    if (id && (!card || card.type !== 'card')) return showList();
    editingId = card?.id || null;
    title(card ? 'Kaart aanpassen' : 'Nieuwe kaart');
    releaseRows?.();
    releaseRows = null;
    header();
    const locations = (await store.getAll('objects')).filter(item => item.type === 'location' && !item.deletedAt);
    const chosenKind = card?.cardKind || imported?.cardKind || 'loyalty';
    const chosenColor = card?.color || imported?.color || '#489ff8';
    outlet.innerHTML = `
      <section class="module-view sh-card-view sh-card-compact">
        <form data-card-form class="sh-card-form">
          <div class="sh-card-head">
            <h2 class="sh-card-question" data-card-question aria-live="polite">Hoe heet deze kaart?</h2>
            <input type="color" name="color" aria-label="Herkenningskleur" title="Herkenningskleur" value="${/^#[0-9a-f]{6}$/i.test(chosenColor) ? chosenColor : "#489ff8"}">
          </div>
          <div class="sh-card-name-row">
            <input id="card-name" name="name" maxlength="100" autocomplete="organization" required aria-label="Naam van de kaart" placeholder="Naam van je kaart" value="${escapeHtml(card?.name || imported?.name || "")}">
            <button type="button" data-kind-toggle aria-label="Soort pas kiezen" aria-expanded="false"><span data-kind-icon></span></button>
          </div>
          <div class="sh-card-kind-options" data-kind-options hidden>
            ${Object.entries(kindLabels).map(([key,label]) => `<button type="button" data-kind="${key}" aria-pressed="${chosenKind === key}">${escapeHtml(label)}</button>`).join("")}
          </div>
          <input type="hidden" name="cardKind" value="${escapeHtml(chosenKind)}">
          <div class="sh-card-section">
            <div class="sh-card-section-head"><strong>Code</strong><div class="sh-card-code-switch">
              <button type="button" data-code-family="QR" aria-label="QR-code kiezen">▦ QR</button>
              <button type="button" data-code-family="BAR" aria-label="Barcode kiezen">▥ Barcode</button>
            </div></div>
            <div class="sh-card-code-options" data-code-options hidden>
              ${Object.entries(CARD_FORMATS).map(([value,label]) => `<button type="button" data-code-option="${value}">${escapeHtml(label)}</button>`).join("")}
            </div>
            <div class="sh-card-preview" data-card-code-preview aria-live="polite"><span>Je code verschijnt hier zodra je inhoud invoert.</span></div>
            <label for="card-value">Inhoud van de code</label>
            <textarea id="card-value" name="codeValue" maxlength="2000" autocapitalize="off" spellcheck="false" rows="2" placeholder="Scan een code of vul de inhoud in">${escapeHtml(card?.codeValue || scanned?.codeValue || scanned?.value || "")}</textarea>
            <input type="hidden" name="codeFormat" value="${escapeHtml(card?.codeFormat || scanned?.codeFormat || scanned?.format || "")}">
            <p data-code-hint class="sh-card-hint">QR of barcode wordt automatisch gekozen.</p>
          </div>
          <div class="sh-card-section">
            <div class="sh-card-section-head"><strong>Eigen informatie</strong><button type="button" data-add-card-field>+ Toevoegen</button></div>
            <div data-card-fields></div>
            <details class="sh-card-extra"><summary>Zichtbaar pasnummer toevoegen</summary>
              <input name="cardNumber" maxlength="200" aria-label="Zichtbaar pasnummer" placeholder="Alleen als dit afwijkt van de code" value="${escapeHtml(card?.cardNumber || imported?.cardNumber || "")}">
            </details>
          </div>
          <div class="sh-card-section">
            <label for="card-location">Locatie</label>
            <select id="card-location" name="locationId"><option value="">Zonder locatie</option>
              ${locations.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === card?.locationId ? "selected" : ""}>${escapeHtml(item.data?.title || "Locatie")}</option>`).join("")}
            </select>
          </div>
          <p data-card-error role="alert" class="sh-card-error"></p>
          <div class="sh-location-simple-footer"><div class="sh-location-simple-footer-inner">
            <button type="submit" class="sh-location-simple-submit">Akkoord</button>
          </div></div>
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
    (Array.isArray(card?.fields || imported?.fields) ? (card?.fields || imported?.fields) : []).forEach(field => addField(field.label, field.value));
    form.querySelector('[data-add-card-field]').addEventListener('click', () => addField());
    const formKind = form.elements.cardKind;
    const icons = {loyalty:'▤',membership:'♧',access:'⚿',ticket:'▧',other:'◇'};
    const kindToggle = form.querySelector('[data-kind-toggle]');
    const kindOptions = form.querySelector('[data-kind-options]');
    const updateKind = () => { form.querySelector('[data-kind-icon]').textContent = icons[formKind.value] || '◇'; };
    updateKind();
    kindToggle.addEventListener('click', () => { kindOptions.hidden = !kindOptions.hidden; kindToggle.setAttribute('aria-expanded', String(!kindOptions.hidden)); });
    form.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
      formKind.value = button.dataset.kind; kindOptions.hidden = true;
      kindToggle.setAttribute('aria-expanded', 'false'); updateKind();
      form.querySelectorAll('[data-kind]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    }));
    const questions = CARD_NAME_QUESTIONS;
    const question = form.querySelector('[data-card-question]');
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
    question.textContent = '';
    let qIndex = 0, questionTimer = null;
    const typeQuestion = () => {
      if (!question.isConnected) return;
      question.textContent = selectedQuestion.slice(0, ++qIndex);
      if (qIndex < selectedQuestion.length) questionTimer = setTimeout(typeQuestion, 28);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) question.textContent = selectedQuestion;
    else typeQuestion();
    const previewHost = form.querySelector('[data-card-code-preview]');
    const codeOptions = form.querySelector('[data-code-options]');
    const formatInput = form.elements.codeFormat, valueInput = form.elements.codeValue;
    const compatible = (format, value) => { if (!value) return true; try { validateCardCode(format, value); return true; } catch { return false; } };
    const guessFormat = value => {
      if (!value) return '';
      if (/^[0-9]{13}$/.test(value) && compatible('EAN13', value)) return 'EAN13';
      if (/^[0-9]{8}$/.test(value) && compatible('EAN8', value)) return 'EAN8';
      return /^[\x20-\x7e]{1,80}$/.test(value) ? 'CODE128' : 'QR_CODE';
    };
    let manuallySelected = Boolean(card?.codeFormat || scanned?.codeFormat || scanned?.format);
    let previewGeneration = 0;
    const updateCodePreview = async () => {
      const value = valueInput.value, generation = ++previewGeneration;
      if (!manuallySelected || !compatible(formatInput.value, value)) { formatInput.value = guessFormat(value); manuallySelected = false; }
      const format = formatInput.value;
      previewHost.replaceChildren();
      if (!value) previewHost.textContent = 'Je code verschijnt hier zodra je inhoud invoert.';
      else if (format) { try { await renderCardCode(previewHost, format, value); }
        catch(error) { if (generation === previewGeneration) previewHost.textContent = error.message; } }
      form.querySelector('[data-code-hint]').textContent = format ? CARD_FORMATS[format] : 'Voer de code-inhoud in.';
      form.querySelectorAll('[data-code-option]').forEach(button => {
        const valid = compatible(button.dataset.codeOption, value);
        button.disabled = !valid;
        button.setAttribute('aria-pressed', String(button.dataset.codeOption === format));
      });
      form.querySelectorAll('[data-code-family]').forEach(button =>
        button.setAttribute('aria-pressed', String(format && (button.dataset.codeFamily === 'QR' ? format === 'QR_CODE' : format !== 'QR_CODE'))));
    };
    form.querySelectorAll('[data-code-family]').forEach(button => button.addEventListener('click', () => {
      codeOptions.hidden = !codeOptions.hidden;
      form.querySelectorAll('[data-code-option]').forEach(option => {
        option.hidden = button.dataset.codeFamily === 'QR' ? option.dataset.codeOption !== 'QR_CODE' : option.dataset.codeOption === 'QR_CODE';
      });
      updateCodePreview();
    }));
    form.querySelectorAll('[data-code-option]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      formatInput.value = button.dataset.codeOption; manuallySelected = true;
      codeOptions.hidden = true; updateCodePreview();
    }));
    valueInput.addEventListener('input', updateCodePreview);
    updateCodePreview();
    // Going back discards the editor and returns to the card overview.
    const backHandler = event => { if (!outlet.contains(form)) return; event.preventDefault(); clearTimeout(questionTimer); showList(); };
    form.addEventListener('sharon:navigate-back', backHandler);
    input.focus();
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
      if (format && value) {
        const duplicate = (await records()).find(item => item.id !== editingId &&
          item.codeFormat === format && item.codeValue === value &&
          String(item.locationId || '') === String(form.elements.locationId.value || ''));
        if (duplicate) {
          error.textContent = 'Deze code is voor deze locatie al opgeslagen als ' + duplicate.name + '.';
          return;
        }
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
