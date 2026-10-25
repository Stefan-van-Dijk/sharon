import { ConnectionService } from '../core/connection/ConnectionService.js?v=0.4.03';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Read the local contact cache only. Linking never publishes or invites anyone.
export async function availablePeople(store) {
  const contacts = await new ConnectionService(store).contacts({offline:true});
  const local = (await store.getAll('objects')).filter(item => item.type === 'person' && !item.deletedAt);
  return [...new Map([...local.map(item => ({id:item.id,name:item.name || item.data?.title || 'Persoon'})),
    ...contacts.map(item => ({id:item.personId,name:item.name}))].map(item => [item.id,item])).values()]
    .sort((a,b) => a.name.localeCompare(b.name,'nl',{sensitivity:'base'}));
}

// The editor owns this selection; cancel leaves the saved object untouched.
export async function mountPersonLinks(host, {store,personIds=[]}) {
  const people = await availablePeople(store);
  const selected = new Set(personIds);
  if (!host.isConnected) return () => [...selected];
  host.innerHTML = '<details class="sh-person-links" '+(selected.size?'open':'')+'><summary>Personen koppelen</summary>'+
    '<p class="clean-help">Alleen voor jouw eigen overzicht.</p>'+
    '<label class="clean-field"><span>Zoek een persoon</span><input type="search" data-person-search aria-label="Zoek een persoon" autocomplete="off"></label>'+
    '<div data-person-options></div><p data-person-empty hidden>Geen personen gevonden.</p></details>';
  const options = host.querySelector('[data-person-options]');
  function paint() {
    const query=host.querySelector('[data-person-search]').value.trim().toLocaleLowerCase('nl');
    const choices=[...people,...[...selected].filter(id=>!people.some(p=>p.id===id)).map(id=>({id,name:'Contact niet beschikbaar'}))];
    const visible=choices.filter(p=>p.name.toLocaleLowerCase('nl').includes(query));
    options.innerHTML=visible.map(p=>'<label class="sh-person-choice"><input type="checkbox" data-person-id="'+esc(p.id)+'" '+(selected.has(p.id)?'checked':'')+'><span>'+esc(p.name)+'</span></label>').join('');
    host.querySelector('[data-person-empty]').hidden=Boolean(visible.length);
    if(!choices.length)host.querySelector('[data-person-empty]').textContent='Nog geen contacten. Voeg eerst iemand toe bij Personen.';
    options.querySelectorAll('[data-person-id]').forEach(input=>input.addEventListener('change',()=>{
      if(input.checked)selected.add(input.dataset.personId);else selected.delete(input.dataset.personId);
    }));
  }
  host.querySelector('[data-person-search]').addEventListener('input',paint);
  paint();
  return () => [...selected];
}
