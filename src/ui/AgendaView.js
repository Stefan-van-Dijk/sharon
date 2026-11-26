import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.5.08';
import { availablePeople } from './PersonLinks.js?v=0.5.08';
import { TimeRegister, referenceKey } from '../core/time/TimeRegister.js?v=0.5.08';

function localTargets(records) {
  const targets = new Map();
  for (const record of records) {
    if (record.deletedAt || record.archivedAt || record.status === 'archived' ||
        !['location', 'person', 'note'].includes(record.type)) continue;
    const id = record.externalId || record.id;
    if (typeof id !== 'string' || !IdentifierService.isValid(id)) continue;
    const reference = { source: 'sharon', id, class: record.type };
    targets.set(referenceKey(reference), {
      reference, title: record.name || record.data?.title || record.title || id
    });
  }
  return targets;
}

function label(extent) {
  if (extent.kind === 'date-range') {
    return extent.start === extent.end ? extent.start : extent.start + ' t/m ' + extent.end;
  }
  const format = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' });
  if (extent.kind === 'instant') return format.format(new Date(extent.at));
  return format.format(new Date(extent.start)) + ' – ' + format.format(new Date(extent.end));
}

export async function openAgendaView(host, { store, edit = false }) {
  const register = new TimeRegister(store);
  host.innerHTML = `
    <section class="module-view">
      <p role="status" data-agenda-status></p>
      <ul data-agenda-list></ul>
    </section>
  `;
  const section = host.firstElementChild;
  const list = section.querySelector('[data-agenda-list]');
  const status = section.querySelector('[data-agenda-status]');
  let targets;

  async function render() {
    const records = await store.getAll('objects');
    const people = await availablePeople(store);
    targets = localTargets([...records, ...people.map(person => ({
      type: 'person', id: person.id, name: person.name
    }))]);
    const entries = await register.list();
    list.replaceChildren();
    for (const entry of entries) {
      const { target, extent } = entry.data;
      const row = document.createElement('li');
      const name = targets.get(referenceKey(target))?.title ?? target.id;
      row.textContent = name + ' · ' + label(extent) + ' ';
      if (edit) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Verwijder tijdkoppeling';
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try {
            await register.remove(entry.id);
            await render();
          } catch (error) {
            status.textContent = error.message;
            remove.disabled = false;
          }
        });
        row.append(remove);
      }
      list.append(row);
    }
    status.textContent = entries.length ? '' : 'Er zijn nog geen tijdkoppelingen.';
  }

  try {
    await render();
  } catch (error) {
    status.textContent = error.message;
    return;
  }
  if (!edit || !targets.size) {
    const hint = document.createElement('p');
    hint.textContent = edit ? 'Voeg eerst een notitie, persoon of locatie toe.' :
      'Voeg tijdkoppelingen toe via Tijd.';
    section.prepend(hint);
    return;
  }

  const form = document.createElement('form');
  form.innerHTML = `
    <label>Object <select name="target" required></select></label>
    <label>Soort <select name="kind">
      <option value="date-range">Periode in dagen</option>
      <option value="instant">Tijdstip</option>
      <option value="interval">Tijdvak</option>
    </select></label>
    <label><span data-start-label></span> <input name="start" required></label>
    <label data-end-label><span></span> <input name="end"></label>
    <p data-time-hint hidden>Gebruik een datum en tijd met UTC-offset, bijvoorbeeld 2026-11-26T19:00:00+01:00.</p>
    <button type="submit">Koppel aan tijd</button>
  `;
  section.prepend(form);
  const { target, kind, start, end } = form.elements;
  const button = form.querySelector('button');
  for (const [key, item] of targets) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = item.title + ' (' + item.reference.class + ')';
    target.append(option);
  }
  const endLabel = form.querySelector('[data-end-label]');
  const updateFields = () => {
    const dates = kind.value === 'date-range';
    const instant = kind.value === 'instant';
    form.querySelector('[data-start-label]').textContent = instant ? 'Tijdstip' : (dates ? 'Begindatum' : 'Begintijd');
    endLabel.firstElementChild.textContent = dates ? 'Einddatum (inclusief)' : 'Eindtijd';
    endLabel.hidden = instant;
    end.required = !instant;
    start.type = end.type = dates ? 'date' : 'text';
    form.querySelector('[data-time-hint]').hidden = dates;
  };
  kind.addEventListener('change', updateFields);
  updateFields();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    try {
      await register.create(targets.get(target.value).reference, {
        kind: kind.value, at: start.value, start: start.value, end: end.value
      });
      start.value = end.value = '';
      await render();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
}
