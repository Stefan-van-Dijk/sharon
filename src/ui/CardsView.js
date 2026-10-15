import { renderStrip } from './Strip.js?v=0.2.60';
import { bindSwipeRows } from './SwipeRows.js?v=0.2.60';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.21';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const normalizeName = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const compareName = value => normalizeName(value).toLocaleLowerCase('nl-NL');

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
            bodyHtml: '<span class="sh-location-copy"><strong>' + escapeHtml(card.name) + '</strong></span>',
            trailingHtml: '<span class="sh-location-chevron" aria-hidden="true">›</span>',
            actions: [{ kind: 'delete', label: 'Verwijder' }]
          })).join('') : '<p class="empty-state">Nog geen kaarten. Voeg een kaart toe om te beginnen.</p>'}
        </div>
      </section>`;
    releaseRows = bindSwipeRows(outlet.querySelector('[data-card-list]'), {
      onOpen: id => showForm(id),
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

  async function showForm(id = null) {
    const card = id ? await store.get('objects', id) : null;
    if (id && (!card || card.type !== 'card')) return showList();
    editingId = card?.id || null;
    title(card ? 'Kaart aanpassen' : 'Nieuwe kaart');
    releaseRows?.();
    releaseRows = null;
    header();
    outlet.innerHTML = `
      <section class="module-view sh-card-view sh-location-dialog">
        <form data-card-form class="sh-card-form">
          <div class="sh-location-question">
          <h2 class="sh-location-question-title">Hoe heet deze kaart?</h2>
          <label for="card-name" style="display:block;font-size:13px;color:#777;margin-bottom:10px">Naam van de winkel of organisatie</label>
          <input id="card-name" name="name" maxlength="100" autocomplete="organization" required
            value="${escapeHtml(card?.name || '')}"
            placeholder="Bijvoorbeeld Jumbo" style="width:100%;border:0;border-bottom:1px solid #d6d6da;border-radius:0;padding:10px 0;font-size:21px;background:transparent;outline:none">
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
    input.focus();
    form.querySelector('[data-cancel]').addEventListener('click', showList);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const name = normalizeName(input.value);
      const error = form.querySelector('[data-card-error]');
      if (!name) { error.textContent = 'Vul eerst een naam in.'; return; }
      const all = await records();
      if (all.some(item => item.id !== editingId && compareName(item.name) === compareName(name))) {
        error.textContent = 'Deze kaart bestaat al in je verzameling.';
        return;
      }
      const now = new Date().toISOString();
      const record = {
        ...(card || {}),
        id: card?.id || IdentifierService.create(),
        type: 'card',
        name,
        createdAt: card?.createdAt || now,
        updatedAt: now
      };
      try {
        await store.put('objects', record);
        await showList();
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
