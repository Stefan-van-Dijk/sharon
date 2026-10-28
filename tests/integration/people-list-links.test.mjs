import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const path=name=>'./src/'+name+'.js?v='+version;
const peers=[{personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna'},
  {personId:'BetaUser0001',chatId:'BetaChat0001',name:'Bram'}];
const input=(app,field,value)=>{field.value=value;field.dispatchEvent(new app.window.Event('input',{bubbles:true}));};
const submit=(app,form)=>form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
async function seed(app){
  const {ConnectionService}=await app.load(path('core/connection/ConnectionService'));
  const service=new ConnectionService(app.store),device=await service.device();
  await service.rememberSelf({personId:device.personId,networkId:'Network00001',line:1});
  await app.store.setMeta('connection.contacts.log-json.v1',peers);
  await app.store.put('objects',{id:'Message00001',type:'chat-message',chatId:peers[1].chatId,createdAt:200});
  app.window.fetch=async(_,options)=>{
    assert.equal(JSON.parse(options.body).action,'contacts');
    return {ok:true,json:async()=>({contacts:peers})};
  };
}

test('Personen: zoeken, Recent, A–Z, eigen volgorde en voorkeur bewaren zonder chatgedrag te verliezen',async t=>{
  const app=await appHarness();await seed(app);
  const {openPeopleView}=await app.load(path('ui/PeopleView'));
  const root=app.document.createElement('main');app.document.body.append(root);
  let cleanup; t.after(()=>{cleanup?.();app.close();});
  const open=()=>cleanup=openPeopleView(root,{store:app.store,settings:{get:()=>({profile:{name:'Test'}})}});
  open();
  const ready=()=>until(()=>root.querySelector('[data-list-sort="recent"]:not(:disabled)')&&root.querySelector('[data-swipe-row]'));
  await ready();
  root.querySelector('[data-list-sort="recent"]').click();
  await until(()=>root.querySelector('[data-swipe-row]')?.dataset.swipeRow===peers[1].personId);
  await ready();root.querySelector('[data-list-sort="alpha"]').click();
  await until(()=>root.querySelector('[data-swipe-row]')?.dataset.swipeRow===peers[0].personId);
  await ready();root.querySelector('[data-list-sort="custom"]').click();
  const handle=await until(()=>root.querySelector('[data-list-drag="BetaUser0001"]:not(:disabled)'));
  handle.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}));
  await until(()=>root.querySelector('[data-swipe-row]')?.dataset.swipeRow===peers[1].personId);
  input(app,root.querySelector('[data-list-search]'),'ANNA');
  assert.equal(root.querySelector('[data-swipe-row="BetaUser0001"]').closest('[data-list-item]').hidden,true);
  input(app,root.querySelector('[data-list-search]'),'Onbekend');
  assert.equal(root.querySelector('[data-search-empty]').hidden,false);
  cleanup();open();await ready();
  assert.equal(root.querySelector('[data-list-sort="custom"]').getAttribute('aria-pressed'),'true');
  assert.equal(root.querySelector('[data-swipe-row]').dataset.swipeRow,peers[1].personId);
  assert.ok(root.querySelector('[data-contact-unread]'));
  assert.deepEqual(app.errors,[]);
});

test('Kaarten en Locaties: meerdere bestaande personen kiezen, annuleren, bewaren, hernoemen en ontkoppelen',async t=>{
  const app=await appHarness();t.after(()=>app.close());await seed(app);
  // Linking itself must not contact the server.
  app.window.fetch=async()=>{throw Error('Onverwacht netwerkverzoek');};
  await app.store.put('objects',{id:'LinkedCard01',type:'card',name:'Mijn kaart',personIds:peers.map(p=>p.personId)});
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[data-swipe-row="LinkedCard01"] [data-swipe-edit]'))).click();
  const form=await until(()=>app.document.querySelector('[data-card-form][data-card-ready="true"]'));
  assert.equal(form.querySelector('[data-person-id]'),null);
  submit(app,form);
  await until(()=>app.document.querySelector('.sh-card-board-overlay'));
  app.window.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'Escape'}));
  app.document.querySelector('[data-brand-control]').click();
  (await until(()=>app.document.querySelector('.module-list [data-module="locations"]'))).click();
  (await until(()=>app.document.querySelector('[data-swipe-row="TestPlace001"] [data-swipe-edit]'))).click();
  const locationForm=await until(()=>app.document.querySelector('[data-location-form] [data-person-id]')?.closest('form'));
  locationForm.querySelector('[data-person-id="AlphaUser001"]').click();submit(app,locationForm);
  await until(async()=>(await app.store.get('objects','TestPlace001'))?.personIds?.length===1);
  const {ConnectionService}=await app.load(path('core/connection/ConnectionService'));
  await new ConnectionService(app.store).editContact('AlphaUser001','Nieuwe naam');
  // Read inverse links by stable person identifier after a rename.
  const {openPeopleView}=await app.load(path('ui/PeopleView'));
  const root=app.document.createElement('main');app.document.body.append(root);
  app.window.fetch=async()=>({ok:true,json:async()=>({contacts:peers})});
  const stop=openPeopleView(root,{store:app.store,settings:{get:()=>({profile:{name:'Test'}})}});t.after(stop);
  (await until(()=>root.querySelector('[data-swipe-row="AlphaUser001"] [data-swipe-edit]:not(:disabled)'))).click();
  await until(()=>root.querySelector('[data-contact-links]')?.textContent.includes('Mijn kaart'));
  assert.match(root.querySelector('[data-contact-links]').textContent,/Persoonlijke plek/);
  (await until(()=>app.document.querySelector('[data-swipe-row="identity"] [data-swipe-edit]'))).click();
  const again=await until(()=>app.document.querySelector('[data-location-form] [data-person-id]')?.closest('form'));
  assert.equal(again.querySelector('[data-person-id="AlphaUser001"]').checked,true);
  assert.match(again.querySelector('[data-person-options]').textContent,/Nieuwe naam/);
  again.querySelector('[data-person-id="AlphaUser001"]').click();submit(app,again);
  await until(async()=>(await app.store.get('objects','TestPlace001'))?.personIds?.length===0);
  assert.deepEqual(Array.from((await app.store.get('objects','LinkedCard01')).personIds).sort(),peers.map(p=>p.personId).sort());
  assert.deepEqual(app.errors,[]);
});

test('testomgeving: kaartbewerking toont geen persoonkeuze en behoudt bestaande relaties',async t=>{
  const app=await appHarness({demo:true});t.after(()=>app.close());await seed(app);
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="cards"]'))).click();
  (await until(()=>app.document.querySelector('[data-swipe-row="DemoCard0001"] [data-swipe-edit]'))).click();
  const form=await until(()=>app.document.querySelector('[data-card-form][data-card-ready="true"]'));
  assert.equal(form.querySelector('[data-person-id]'),null);submit(app,form);
  await until(()=>app.document.querySelector('.sh-card-board-overlay'));
  assert.equal((await app.store.get('meta','connection.contacts.log-json.v1')).value[0].personId,'AlphaUser001');
  assert.deepEqual(app.errors,[]);
});
