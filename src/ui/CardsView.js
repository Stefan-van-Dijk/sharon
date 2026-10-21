import { parseConnectionLink } from '../core/connection/ConnectionService.js?v=0.3.75';
import { renderListControls, bindListControls, renderOrderControls } from './ListControls.js?v=0.3.75';
import { sortList, moveInOrder, moveToPosition } from '../core/storage/ListOrder.js?v=0.3.75';
import { resolveLocation } from '../core/location/LocationHierarchy.js?v=0.3.75';
import { openCardBoard } from './CardBoard.js?v=0.3.75';
import { CARD_NAME_QUESTIONS } from './CardQuestions.js?v=0.3.75';
import { buildCardPayload, parseCardPayload } from './CardPayload.js?v=0.3.75';
import { mountCardScanner } from './CardScanner.js?v=0.3.75';
import { CARD_FORMATS, renderCardCode, validateCardCode } from './CardCodes.js?v=0.3.75';
import { renderStrip } from './Strip.js?v=0.3.75';
import { renderObjectStrip } from './ObjectStrip.js?v=0.3.75';
import { bindSwipeRows } from './SwipeRows.js?v=0.3.75';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.75';
import { cardSymbol } from './CardSymbols.js?v=0.3.75';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const normalizeName = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const kindLabels = { loyalty: 'Klantenpas', membership: 'Lidmaatschap', access: 'Toegangspas', ticket: 'Ticket', other: 'Overige kaart' };


export async function openCardsView(outlet, { store, location, events, setTitle, headerActions, onConnection, initialScan=null }) {
  let editingId = null;
  let stopScanner = null;
  let closeBoard = null;
  let prefs = (await store.get('meta', 'cards.list.preferences'))?.value || {sort:'alpha',order:[]};
  let sort = prefs.sort || 'alpha';
  let query = '';
  let deckIds = [];
  let nearPosition = location?.latest ? {latitude:location.latest.lat,longitude:location.latest.lng} : null;
  if (sort === 'near' && !nearPosition) sort = 'alpha';
  const savePrefs = () => store.put('meta', {key:'cards.list.preferences',value:{...prefs,sort}});
  let releaseRows = null;
  let releaseOrder = null;
  const title = value => { if (typeof setTitle === 'function') setTitle(value); };
  const header = () => { if (headerActions) headerActions.replaceChildren(); };

  async function records() {
    const all = await store.getAll('objects');
    return all.filter(item => item.type === 'card' && !item.deletedAt && !item.archivedAt && item.status !== 'archived');
  }

  async function showList() {
    releaseOrder?.(); releaseOrder = null;
    closeBoard?.(); closeBoard = null;
    stopScanner?.(); stopScanner = null;
    editingId = null;
    title('Kaarten');
    releaseRows?.();
    releaseRows = null;
    header();
    const cards = await records();
    const locationItems = (await store.getAll('objects')).filter(item => item.type === 'location' && !item.deletedAt);
    const locationLookup = new Map(locationItems.map(item => [String(item.id),item]));
    const coordinateOf = card => {
      const coordinates = resolveLocation(locationLookup.get(String(card.locationId)), locationLookup).coordinates;
      return coordinates ? { latitude: coordinates.lat, longitude: coordinates.lng } : null;
    };
    const distance = card => {
      const point = coordinateOf(card);
      if (!nearPosition || !point) return Infinity;
      const phi = Math.PI / 180;
      const dy = (point.latitude - nearPosition.latitude) * phi;
      const dx = (point.longitude - nearPosition.longitude) * phi;
      const a = Math.sin(dy/2)**2 + Math.cos(nearPosition.latitude*phi)*Math.cos(point.latitude*phi)*Math.sin(dx/2)**2;
      return 12742000 * Math.asin(Math.min(1,Math.sqrt(a)));
    };
    cards.splice(0,cards.length,...sortList(cards,{sort,order:prefs.order,distance}));
    // Expose Add only when the asynchronous list load can no longer replace its form.
    if (headerActions) {
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'sh-location-header-add';
      add.setAttribute('aria-label', 'Kaart toevoegen');
      add.textContent = '+';
      add.addEventListener('click', () => showForm());
      headerActions.append(add);
    }
    outlet.innerHTML = `
      <section class="module-view locations-view sh-card-view">
        ${renderListControls({placeholder:'Zoek een kaart',query,sort,near:true,cardHooks:true})}
        <p data-card-sort-status class="sh-card-sort-status" role="status"></p>
        <div class="sh-locations-list swipe-list" data-card-list>
          ${cards.length ? cards.map((card,index) => '<div class="sh-list-item" data-list-item>' + renderObjectStrip({
            id: card.id,
            className: 'sh-location-strip sh-card-swipe-row',
            surfaceClassName: 'sh-location-row',
            variant: 'location',
            ariaLabel: card.name,
            accentColor: /^#[0-9a-f]{6}$/i.test(card.color || '') ? card.color : '#489ff8',
            iconHtml: cardSymbol(card.cardKind),
            bodyHtml: '<span class="sh-location-copy"><strong>' + escapeHtml(card.name) + '</strong><small>' + (kindLabels[card.cardKind] || 'Overige kaart') + (card.reference && !card.codeValue ? ' · Verwijzing' : '') + (card.locationId ? ' · ' + escapeHtml(locationItems.find(loc => loc.id === card.locationId)?.data?.title || 'Locatie niet beschikbaar') : '') + '</small></span>',
            trailingHtml: '<span class="sh-location-chevron" aria-hidden="true">›</span>',
            actions: [{ kind: 'edit', label: 'Bewerk' }, { kind: 'delete', label: 'Verwijder' }],
            doubleSwipe: false
          }) + (sort==='custom' ? renderOrderControls(card.id,{first:index===0,last:index===cards.length-1}) : '') + '</div>').join('') : '<p class="empty-state">Nog geen kaarten. Voeg een kaart toe om te beginnen.</p>'}
        </div>
      </section>`;
    releaseRows = bindSwipeRows(outlet.querySelector('[data-card-list]'), {
      onOpen: id => showDetail(id),
      onEdit: id => showForm(id),
      onDelete: async id => {
        const card = await store.get('objects', id);
        if (!card || card.type !== 'card' || !confirm('Wil je deze kaart verwijderen?')) return;
        await store.delete('objects', id);
        await showList();
      }
    });
    const applySearch = () => {
      const q=query.trim().toLocaleLowerCase('nl');
      deckIds = [];
      outlet.querySelectorAll('[data-card-list] [data-swipe-row]').forEach(row=>{
        const card=cards.find(item=>item.id===row.dataset.swipeRow);
        const place=locationItems.find(item=>item.id===card?.locationId);
        const text=[card?.name,card?.codeValue,place?.data?.title].join(' ').toLocaleLowerCase('nl');
        row.closest('[data-list-item]').hidden=Boolean(q)&&!text.includes(q);
        if (!row.closest('[data-list-item]').hidden) deckIds.push(card.id);
      });
    };
    applySearch();
    releaseOrder = bindListControls(outlet,{
      onSearch:value=>{query=value;applySearch();},
      onSort:async mode=>{
        if(mode==='near'){
          const status=outlet.querySelector('[data-card-sort-status]');
          if(!cards.some(card=>coordinateOf(card))){status.textContent='Koppel eerst een kaart aan een locatie om op afstand te sorteren.';return;}
          try {
            const point=await location.checkNow({reason:'cards-near',maxAgeMs:60_000,highAccuracy:false});
            nearPosition={latitude:point.lat,longitude:point.lng};
            if(!status.isConnected)return;
          } catch {if(status.isConnected)status.textContent='Locatietoegang nodig om kaarten op afstand te sorteren.';return;}
        }
        if(mode==='custom'&&!prefs.order?.length)prefs.order=cards.map(card=>card.id);
        sort=mode;await savePrefs();await showList();
      },
      onMoveTo:async(id,targetId,after)=>{
        prefs.order=moveToPosition(cards.map(card=>card.id),id,targetId,after);
        await savePrefs();await showList();
      },
      onMove:async(id,direction)=>{
        prefs.order=moveInOrder(cards.map(card=>card.id),id,direction);
        await savePrefs();await showList();
      }
    });
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
        if(onConnection && /#connect=/.test(result.value)) {
          const invitation=parseConnectionLink(result.value);
          await store.put('meta',{key:'connection.pending.log-json.v1',value:invitation});
          return onConnection();
        }
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
    const locations = (await store.getAll('objects')).filter(item => item.type === 'location' && !item.deletedAt);
    closeBoard?.();
    const available = new Map((await records()).map(item => [item.id,item]));
    const cards = deckIds.map(key => available.get(key)).filter(Boolean);
    closeBoard = openCardBoard(card, { cards, locations, store, location, events, onClose: () => { closeBoard = null; } });
  }

  async function showQuestionLibrary(cardId = null, kind = 'loyalty') {
    releaseRows?.(); releaseRows = null;
    title('Zinnenbibliotheek');
    header();
    const saved = await store.get('meta', 'cards.nameQuestions.' + kind);
    let phrases = Array.isArray(saved?.value) ? saved.value.filter(value => typeof value === 'string' && value.trim()).slice(0, 40) : [...CARD_NAME_QUESTIONS];
    outlet.innerHTML = `
      <section class="module-view sh-sentence-editor sh-card-sentence-editor">
        <div class="sh-location-editor-nav"><button type="button" data-question-back>‹ Kaart</button><span>${escapeHtml(kindLabels[kind] || 'Kaarten')}</span></div>
        <h2 data-question-library-intro>Zo praat ik over jouw kaarten. Hier kun je mijn zinnen aanpassen of me iets nieuws leren.</h2>
        <p class="clean-help">Veeg een regel naar links om die te bewerken of te verwijderen.</p>
        <div data-question-rows class="swipe-list"></div>
        <form data-question-form>
          <label class="clean-field"><span data-question-label>Nieuwe zin</span>
            <textarea name="phrase" rows="2" maxlength="300" required placeholder="Hoe heet deze kaart?"></textarea>
          </label>
          <div class="sh-card-question-actions">
            <button type="button" data-question-cancel hidden>Annuleren</button>
            <button type="submit" class="primary-line-action" data-question-submit>Zin toevoegen</button>
          </div>
        </form>
        <p data-question-status role="status"></p>
      </section>`;
    const rows = outlet.querySelector('[data-question-rows]');
    const form = outlet.querySelector('[data-question-form]');
    const status = outlet.querySelector('[data-question-status]');
    const textarea = form.elements.phrase;
    let editing = -1, unbind = null;
    const back = () => { unbind?.(); return showForm(cardId); };
    outlet.querySelector('[data-question-back]').addEventListener('click', back);
    const persist = async () => store.put('meta', {key:'cards.nameQuestions.' + kind, value:phrases});
    const reset = () => {
      editing = -1; form.reset();
      form.querySelector('[data-question-label]').textContent = 'Nieuwe zin';
      form.querySelector('[data-question-submit]').textContent = 'Zin toevoegen';
      form.querySelector('[data-question-cancel]').hidden = true;
    };
    form.querySelector('[data-question-cancel]').addEventListener('click', reset);
    const draw = () => {
      unbind?.(); unbind = null;
      rows.innerHTML = phrases.map((phrase, index) => renderStrip({
        id: String(index), variant:'location', surfaceClassName:'sh-location-row',
        bodyHtml:'<span class="sh-location-copy"><strong>' + escapeHtml(phrase) + '</strong></span>',
        actions:[{kind:'edit',label:'Bewerk'},{kind:'delete',label:'Verwijder'}],
        doubleSwipe:true
      })).join('');
      unbind = bindSwipeRows(rows, {
        onEdit: id => {
          editing = Number(id);
          textarea.value = phrases[editing];
          form.querySelector('[data-question-label]').textContent = 'Zin aanpassen';
          form.querySelector('[data-question-submit]').textContent = 'Wijziging opslaan';
          form.querySelector('[data-question-cancel]').hidden = false;
          textarea.focus();
        },
        onDelete: async id => {
          if (phrases.length <= 1) { status.textContent = 'Er moet minimaal één zin blijven staan.'; return; }
          phrases.splice(Number(id),1);
          try { await persist(); reset(); draw(); status.textContent = 'Zin verwijderd.'; }
          catch { status.textContent = 'Verwijderen is niet gelukt.'; }
        }
      });
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const value = textarea.value.trim();
      if (!value) return;
      if (phrases.some((phrase,index) => index !== editing && phrase.toLocaleLowerCase('nl') === value.toLocaleLowerCase('nl'))) {
        status.textContent = 'Deze zin bestaat al.'; return;
      }
      const next = [...phrases];
      if (editing >= 0) next[editing] = value;
      else if (next.length < 40) next.push(value);
      else { status.textContent = 'Maximaal 40 zinnen.'; return; }
      try { await store.put('meta',{key:'cards.nameQuestions.' + kind,value:next}); phrases = next; reset(); draw(); status.textContent = 'Zin opgeslagen.'; }
      catch { status.textContent = 'Opslaan is niet gelukt.'; }
    });
    draw();
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
          <div class="sh-card-unified sh-card-swipe-line" data-unified-line data-swipe-short="Type en kleur" data-swipe-long="Zinnenbibliotheek" aria-label="Veeg links voor kaarttype; verder links voor zinnenbibliotheek">
            <button type="button" data-kind-toggle aria-label="Soort pas en kleur kiezen" aria-expanded="false"><span data-kind-icon></span></button>
            <div class="sh-card-unified-input">
              <span data-card-question class="sh-card-question" aria-hidden="true">Hoe heet deze kaart?</span>
              <input id="card-name" name="name" maxlength="100" autocomplete="organization" required aria-label="Naam van de kaart" placeholder="" value="${escapeHtml(card?.name || imported?.name || "")}">
            </div>
          </div>
          <div class="sh-card-kind-options" data-kind-options hidden>
            <label class="sh-card-color-picker" aria-label="Herkenningskleur aanpassen" title="Herkenningskleur aanpassen"><span class="sh-card-color-swatch" data-card-color-swatch></span><input type="color" name="color" aria-label="Herkenningskleur" value="${/^#[0-9a-f]{6}$/i.test(chosenColor) ? chosenColor : "#489ff8"}"></label>
            ${Object.entries(kindLabels).map(([key,label]) => `<button type="button" data-kind="${key}" aria-pressed="${chosenKind === key}"><span data-kind-choice-icon="${key}"></span>${escapeHtml(label)}</button>`).join("")}
            <button type="button" data-kind-done class="sh-card-kind-done">Klaar</button>
          </div>
          <input type="hidden" name="cardKind" value="${escapeHtml(chosenKind)}">
          <div class="sh-card-section">

            <div class="sh-card-code-options" data-code-options hidden>
              ${Object.entries(CARD_FORMATS).map(([value,label]) => `<button type="button" data-code-option="${value}">${escapeHtml(label)}</button>`).join("")}
            </div>
            <button type="button" class="sh-card-preview" data-code-type-toggle aria-label="Codetype kiezen" aria-expanded="false"><span data-card-code-preview>Je code verschijnt hier zodra je inhoud invoert.</span><span class="sh-card-preview-label"><span data-code-icon></span><span data-code-label>QR / Barcode</span>⌄</span></button>

            <div class="sh-card-code-entry" data-code-swipe>

            <textarea id="card-value" name="codeValue" maxlength="2000" autocapitalize="off" spellcheck="false" rows="2" placeholder="Scan een code of vul de inhoud in">${escapeHtml(card?.codeValue || scanned?.codeValue || scanned?.value || "")}</textarea>
              <button type="button" data-editor-scan aria-label="Scan de code van deze pas met de camera" title="Code scannen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="24" height="24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3M7 12h10M9 9v6m6-6v6"/></svg>
              </button>
            </div>
            <input type="hidden" name="codeFormat" value="${escapeHtml(card?.codeFormat || scanned?.codeFormat || scanned?.format || "")}">

          </div>
          <div class="sh-card-form-actions">
            <button type="button" data-card-cancel>Annuleren</button>
            <button type="submit" class="sh-card-form-save">Kaart toevoegen</button>
          </div>
          <div class="sh-card-section sh-card-more">
            <button type="button" data-extra-toggle class="sh-card-extra-toggle" aria-expanded="${Boolean((card?.fields || imported?.fields)?.length || card?.cardNumber || imported?.cardNumber || card?.locationId)}"><span>Extra informatie aanvullen</span><span aria-hidden="true">＋</span></button>
            <div data-extra-panel ${((card?.fields || imported?.fields)?.length || card?.cardNumber || imported?.cardNumber || card?.locationId) ? "" : "hidden"}>
              <div class="sh-card-extras-choices">
                ${['Overige paskenmerken','Keten','Link','Notities'].map(label => `<button type="button" data-field-preset="${label}">${label}</button>`).join('')}
                <button type="button" data-add-card-field>+ Eigen veld</button>
                <button type="button" data-extra-number>Zichtbaar pasnummer</button>
                <button type="button" data-extra-location>Locatie koppelen</button>
              </div>
              <div data-card-fields></div>
              <div data-number-field ${card?.cardNumber || imported?.cardNumber ? "" : "hidden"}>
                <label for="card-number">Zichtbaar pasnummer</label>
                <input id="card-number" name="cardNumber" maxlength="200" placeholder="Alleen als dit afwijkt van de code" value="${escapeHtml(card?.cardNumber || imported?.cardNumber || "")}">
              </div>
              <div data-location-field ${card?.locationId ? "" : "hidden"}>
                <label for="card-location">Locatie</label>
                <select id="card-location" name="locationId"><option value="">Zonder locatie</option>
                  ${locations.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === card?.locationId ? "selected" : ""}>${escapeHtml(item.data?.title || "Locatie")}</option>`).join("")}
                </select>
              </div>
            </div>
          </div>
          <p data-card-error role="alert" class="sh-card-error"></p>
          
        </form>
      </section>`;
    const form = outlet.querySelector('[data-card-form]');
    form.querySelector('[data-card-cancel]').addEventListener('click', showList);
    if (card) form.querySelector('.sh-card-form-save').textContent = 'Wijzigingen opslaan';
    const setTyping = () => {
      const active = document.activeElement;
      form.classList.toggle('is-typing', active === form.elements.name || active === form.elements.codeValue);
    };
    form.addEventListener('focusin', setTyping);
    form.addEventListener('focusout', () => setTimeout(() => { if (form.isConnected) setTyping(); }, 0));
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
    const extraPanel = form.querySelector('[data-extra-panel]');
    const extraToggle = form.querySelector('[data-extra-toggle]');
    const openExtras = () => { extraPanel.hidden = false; extraToggle.setAttribute('aria-expanded', 'true'); };
    extraToggle.addEventListener('click', () => {
      extraPanel.hidden = !extraPanel.hidden;
      extraToggle.setAttribute('aria-expanded', String(!extraPanel.hidden));
    });
    form.querySelector('[data-add-card-field]').addEventListener('click', () => { openExtras(); addField(); });
    form.querySelectorAll('[data-field-preset]').forEach(button => button.addEventListener('click', () => {
      openExtras(); addField(button.dataset.fieldPreset);
    }));
    form.querySelector('[data-extra-number]').addEventListener('click', () => {
      openExtras(); form.querySelector('[data-number-field]').hidden = false; form.elements.cardNumber.focus();
    });
    form.querySelector('[data-extra-location]').addEventListener('click', () => {
      openExtras(); form.querySelector('[data-location-field]').hidden = false; form.elements.locationId.focus();
    });
    const formKind = form.elements.cardKind;
    const icons = {
      loyalty: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
      membership: '<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/>',
      access: '<circle cx="8" cy="9" r="4"/><path d="M11 12 21 22m-3-3 2-2m-5-1 2-2"/>',
      ticket: '<path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M12 5v14" stroke-dasharray="2 2"/>',
      other: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 9h8M8 13h6"/>'
    };
    const kindToggle = form.querySelector('[data-kind-toggle]');
    const kindOptions = form.querySelector('[data-kind-options]');
    form.querySelectorAll('[data-kind-choice-icon]').forEach(element => {
      element.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' + (icons[element.dataset.kindChoiceIcon] || icons.other) + '</svg>';
    });
    const updateKind = () => {
      form.querySelector('[data-kind-icon]').innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        (icons[formKind.value] || icons.other) + '</svg>';
    };
    const colorInput = form.elements.color;
    const swatch = form.querySelector('[data-card-color-swatch]');
    const updateSwatch = () => { swatch.style.backgroundColor = colorInput.value;
      kindToggle.style.backgroundColor = colorInput.value + '26'; };
    colorInput.addEventListener('input', updateSwatch);
    updateSwatch();
    updateKind();
    const toggleKindOptions = () => {
      kindOptions.hidden = !kindOptions.hidden;
      kindToggle.setAttribute('aria-expanded', String(!kindOptions.hidden));
    };
    kindToggle.addEventListener('click', toggleKindOptions);
    form.querySelectorAll('[data-kind]').forEach(button => button.addEventListener('click', () => {
      formKind.value = button.dataset.kind; updateKind();
      form.querySelectorAll('[data-kind]').forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    }));
    form.querySelector('[data-kind-done]').addEventListener('click', () => { kindOptions.hidden = true; kindToggle.setAttribute('aria-expanded', 'false'); });
    const dictionaryKey = 'cards.nameQuestions.' + formKind.value;
    const configured = await store.get('meta', dictionaryKey);
    const legacy = await store.get('meta','cards.nameQuestions');
    const questions = Array.isArray(configured?.value) && configured.value.length
      ? configured.value : (Array.isArray(legacy?.value) && legacy.value.length ? legacy.value : CARD_NAME_QUESTIONS);
    const question = form.querySelector('[data-card-question]');
    const inputWrap = form.querySelector('.sh-card-unified-input');
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
    question.textContent = '';
    let qIndex = 0, questionTimer = null;
    const typeQuestion = () => {
      if (!question.isConnected) return;
      question.textContent = selectedQuestion.slice(0, ++qIndex);
      if (qIndex < selectedQuestion.length) questionTimer = setTimeout(typeQuestion, 28);
    };
    const syncName = () => inputWrap.classList.toggle('has-name', Boolean(input.value || document.activeElement === input));
    input.addEventListener('input', syncName);
    input.addEventListener('focus', syncName);
    input.addEventListener('blur', syncName);
    syncName();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) question.textContent = selectedQuestion;
    else typeQuestion();
    const openQuestionEditor = () => { clearTimeout(questionTimer); showQuestionLibrary(id, formKind.value); };
    const line = form.querySelector('[data-unified-line]');
    const bindEditorSwipe = (element, shortAction, longAction) => {
      let pointer = null;
      const reset = () => {
        element.style.removeProperty('--sh-card-swipe');
        element.removeAttribute('data-swipe-depth');
        pointer = null;
      };
      element.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        pointer = {id:event.pointerId,x:event.clientX,y:event.clientY};
      });
      element.addEventListener('pointermove', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
        if (dx >= 0 || Math.abs(dx) < Math.abs(dy)*1.2) { element.style.removeProperty('--sh-card-swipe'); return; }
        element.style.setProperty('--sh-card-swipe', Math.max(-155, dx) + 'px');
        element.setAttribute('data-swipe-depth', dx < -125 ? 'long' : 'short');
      }, {passive:true});
      element.addEventListener('pointerup', event => {
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;
        reset();
        if (dx < -45 && Math.abs(dx) > Math.abs(dy)*1.2) {
          if (dx < -125) longAction();
          else shortAction();
        }
      });
      element.addEventListener('pointercancel', reset);
    };
    bindEditorSwipe(line, () => { if(kindOptions.hidden) toggleKindOptions(); }, openQuestionEditor);
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

      form.querySelectorAll('[data-code-option]').forEach(button => {
        const valid = compatible(button.dataset.codeOption, value);
        button.disabled = !valid;
        button.setAttribute('aria-pressed', String(button.dataset.codeOption === format));
      });
      form.querySelector('[data-code-icon]').innerHTML = format === 'QR_CODE'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14v3h3v4M20 14v2M14 20h2M20 19v2"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M3 5v14M6 5v14M10 5v14M13 5v14M15 5v14M19 5v14M22 5v14"/></svg>';
      form.querySelector('[data-code-label]').textContent = format ? CARD_FORMATS[format] : 'QR / Barcode';
    };
    const codeToggle = form.querySelector('[data-code-type-toggle]');
    codeToggle.addEventListener('click', () => {
      codeOptions.hidden = !codeOptions.hidden;
      codeToggle.setAttribute('aria-expanded', String(!codeOptions.hidden));
      updateCodePreview();
    });
    form.querySelectorAll('[data-code-option]').forEach(button => button.addEventListener('click', () => {
      if (button.disabled) return;
      formatInput.value = button.dataset.codeOption; manuallySelected = true;
      codeOptions.hidden = true; codeToggle.setAttribute('aria-expanded','false'); updateCodePreview();
    }));
    valueInput.addEventListener('input', updateCodePreview);
    updateCodePreview();
    // Going back discards the editor and returns to the card overview.
    const backHandler = event => { if (!outlet.contains(form)) return; event.preventDefault(); clearTimeout(questionTimer); showList(); };
    form.addEventListener('sharon:navigate-back', backHandler);
    // Keep the sentence visible on entry; focus only after an explicit tap.
    const scannerButton = form.querySelector('[data-editor-scan]');
    const openEditorScanner = (photoFirst = false) => {
      const overlay = document.createElement('div');
      overlay.className = 'sh-card-editor-scanner-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Code van kaart scannen');
      document.body.append(overlay);
      let cleanup = () => {};
      const close = () => { cleanup(); overlay.remove(); };
      const stop = mountCardScanner(overlay, {
        autoStart: !photoFirst, photoFirst,
        onClose: close,
        onResult: result => {
          close();
          form.elements.codeFormat.value = result.format;
          form.elements.codeValue.value = result.value;
          form.elements.codeValue.dispatchEvent(new Event('input', { bubbles:true }));
        }
      });
      cleanup = stop;
    };
    scannerButton.addEventListener('click', () => openEditorScanner());
    const swipeArea = form.querySelector('[data-code-swipe]');
    bindEditorSwipe(swipeArea, () => openEditorScanner(), () => openEditorScanner(true));
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

  if(initialScan) {
    const existing=(await records()).find(item=>item.codeValue===initialScan.value&&item.codeFormat===initialScan.format);
    if(existing)await showDetail(existing.id);
    else await showForm(null,(initialScan.format==='QR_CODE'?parseCardPayload(initialScan.value):null)||initialScan);
  } else await showList();
  return () => { closeBoard?.(); stopScanner?.(); releaseRows?.(); releaseOrder?.(); header(); };
}
