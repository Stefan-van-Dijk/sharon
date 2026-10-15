import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.3.19';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const normalizeName = value => String(value ?? '').trim().replace(/\s+/g, ' ');
const compareName = value => normalizeName(value).toLocaleLowerCase('nl-NL');

export async function openCardsView(outlet, { store, setTitle, headerActions }) {
  let editingId = null;
  const title = value => { if (typeof setTitle === 'function') setTitle(value); };
  const header = () => { if (headerActions) headerActions.replaceChildren(); };

  async function records() {
    const all = await store.getAll('objects');
    return all.filter(item => item.type === 'card').sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'nl'));
  }

  async function showList() {
    editingId = null;
    title('Kaarten');
    header();
    const cards = await records();
    outlet.innerHTML = `
      <section class="module-view" style="padding:20px 0 40px">
        <p style="color:#74747a;font-size:14px;margin:0 0 24px">
          Bewaar je klanten- en spaarpassen op één plek.
        </p>
        <button type="button" data-create-card style="width:100%;border:1px solid #171717;border-radius:10px;background:#171717;color:white;padding:15px;text-align:left">+ Kaart toevoegen</button>
        <div style="margin-top:24px" data-card-list>
          ${cards.length ? cards.map(card => `
            <button type="button" data-card-id="${escapeHtml(card.id)}" style="display:flex;align-items:center;justify-content:space-between;width:100%;border:0;border-bottom:1px solid #e9e9ec;background:transparent;padding:18px 2px;text-align:left;color:inherit">
              <span>${escapeHtml(card.name)}</span><span aria-hidden="true" style="color:#999">›</span>
            </button>`).join('') : '<p style="color:#89898e;font-size:14px">Je hebt nog geen kaarten toegevoegd.</p>'}
        </div>
      </section>`;
    outlet.querySelector('[data-create-card]').addEventListener('click', () => showForm());
    outlet.querySelectorAll('[data-card-id]').forEach(button =>
      button.addEventListener('click', () => showForm(button.dataset.cardId)));
  }

  async function showForm(id = null) {
    const card = id ? await store.get('objects', id) : null;
    if (id && (!card || card.type !== 'card')) return showList();
    editingId = card?.id || null;
    title(card ? 'Kaart aanpassen' : 'Nieuwe kaart');
    header();
    outlet.innerHTML = `
      <section class="module-view" style="padding:22px 0 44px">
        <form data-card-form>
          <label for="card-name" style="display:block;font-size:13px;color:#777;margin-bottom:10px">Naam van de winkel of organisatie</label>
          <input id="card-name" name="name" maxlength="100" autocomplete="organization" required
            value="${escapeHtml(card?.name || '')}"
            placeholder="Bijvoorbeeld Jumbo" style="width:100%;border:0;border-bottom:1px solid #d6d6da;border-radius:0;padding:10px 0;font-size:21px;background:transparent;outline:none">
          <p data-card-error role="alert" style="min-height:22px;color:#ad3030;font-size:13px"></p>
          <p style="font-size:13px;color:#777;line-height:1.5">We bewaren de naam zoals je hem invoert. Een koppeling met een officiële organisatie en OpenStreetMap voegen we later toe.</p>
          <button type="submit" style="width:100%;margin-top:18px;background:#171717;border:0;border-radius:10px;padding:15px;color:white">Opslaan</button>
          <button type="button" data-cancel style="width:100%;margin-top:10px;background:none;border:0;padding:14px;color:#777">Annuleren</button>
          ${card ? '<button type="button" data-delete style="width:100%;margin-top:12px;background:none;border:0;padding:14px;color:#ad3030">Kaart verwijderen</button>' : ''}
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
