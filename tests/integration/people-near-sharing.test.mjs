import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const modulePath=name=>'./src/'+name+'.js?v='+version;
const contacts=[{personId:'AlphaUser001',chatId:'AlphaChat001',name:'Anna'},{personId:'BetaUser0001',chatId:'BetaChat0001',name:'Bram'},{personId:'GammaUser001',chatId:'GammaChat001',name:'Cato'}];
async function seed(app) {
  const {ConnectionService}=await app.load(modulePath('core/connection/ConnectionService'));
  const service=new ConnectionService(app.store),device=await service.device();
  await service.rememberSelf({personId:device.personId,networkId:'Network00001',line:0});
  await app.store.setMeta('connection.contacts.log-json.v1',contacts);
  return {service,device};
}
test('Personen Dichtbij uses the nearest linked place, inherited GPS, search by place, and unknown places last',async t=>{
  const app=await appHarness();t.after(()=>app.close());await seed(app);
  await app.store.put('objects',{id:'FarPlace0001',type:'location',personIds:['AlphaUser001'],data:{title:'Ver weg',coordinates:{lat:53,lng:6}}});
  await app.store.put('objects',{id:'NearPlace001',type:'location',data:{title:'Centrum',coordinates:{lat:52,lng:5}}});
  await app.store.put('objects',{id:'ChildPlace01',type:'location',personIds:['BetaUser0001'],data:{title:'Winkel',parentId:'NearPlace001'}});
  app.window.fetch=async()=>({ok:true,json:async()=>({contacts})});
  const {openPeopleView}=await app.load(modulePath('ui/PeopleView'));
  const root=app.document.createElement('main');app.document.body.append(root);
  let checks=0;
  const stop=openPeopleView(root,{store:app.store,settings:{get:()=>({profile:{name:'Zelf'}})},location:{checkNow:async options=>{checks++;assert.equal(options.highAccuracy,false);return {lat:52,lng:5};}}});t.after(stop);
  (await until(()=>root.querySelector('[data-list-sort="near"]:not(:disabled)'))).click();
  await until(()=>root.querySelector('[data-swipe-row]')?.dataset.swipeRow==='BetaUser0001');
  assert.equal(checks,1);
  assert.deepEqual([...root.querySelectorAll('[data-swipe-row]')].map(r=>r.dataset.swipeRow),['BetaUser0001','AlphaUser001','GammaUser001']);
  const search=root.querySelector('[data-list-search]');search.value='Winkel';search.dispatchEvent(new app.window.Event('input'));
  assert.equal(root.querySelector('[data-swipe-row="BetaUser0001"]').closest('[data-list-item]').hidden,false);
  assert.equal(root.querySelector('[data-swipe-row="AlphaUser001"]').closest('[data-list-item]').hidden,true);
  assert.deepEqual(app.errors,[]);
});
test('a card is sent only to selected contacts and retry uses the same message identifier',async t=>{
  const app=await appHarness();t.after(()=>app.close());const {device}=await seed(app);
  let fail=true,seen=[];
  app.window.fetch=async(_,options)=>{
    const input=JSON.parse(options.body);assert.equal(input.action,'send');seen.push(input);
    if(fail)throw new TypeError('Offline');
    return {ok:true,json:async()=>({message:{id:input.id,chatId:input.chatId,senderId:device.personId,text:input.text,seq:1,at:1000}})};
  };
  const {openCardShare}=await app.load(modulePath('ui/CardSharing'));
  const stop=openCardShare({id:'PrivateCard1',name:'Mijn pas',personIds:['GammaUser001'],locationId:'PrivatePlace',cardKind:'loyalty',codeFormat:'',codeValue:'',fields:[]},{store:app.store});t.after(stop);
  const box=await until(()=>app.document.querySelector('[data-share-person="BetaUser0001"]'));box.click();
  app.document.querySelector('[data-share-send]').click();
  await until(()=>app.document.querySelector('[data-share-status]')?.textContent.includes('niet beschikbaar'));
  assert.equal(seen.length,1);assert.equal(seen[0].chatId,'BetaChat0001');
  assert.ok(!seen[0].text.includes('PrivateCard1'));assert.ok(!seen[0].text.includes('GammaUser001'));assert.ok(!seen[0].text.includes('PrivatePlace'));
  fail=false;app.document.querySelector('[data-share-send]').click();
  await until(()=>app.document.querySelector('[data-share-status]')?.textContent.includes('Kaart verstuurd'));
  assert.equal(seen.length,2);assert.equal(seen[0].id,seen[1].id);
  assert.equal(app.document.querySelector('[data-share-send]').disabled,true);
  const {saveReceivedCard}=await app.load(modulePath('ui/CardSharing'));
  const message={id:'Received0001',text:seen[1].text};
  const id=await saveReceivedCard(app.store,message);
  assert.equal(await saveReceivedCard(app.store,message),id);
  assert.equal((await app.store.get('objects',id)).name,'Mijn pas');
  assert.equal((await app.store.get('objects',id)).personIds,undefined);
  assert.deepEqual(app.errors,[]);
});

test('received card appears as a card in chat and can be saved without exposing raw payload',async t=>{
  const app=await appHarness();t.after(()=>app.close());await seed(app);
  const {buildCardPayload}=await app.load(modulePath('ui/CardPayload'));
  const text=buildCardPayload({name:'Gedeelde pas',cardKind:'loyalty',codeFormat:'',codeValue:'',fields:[]});
  await app.store.put('objects',{id:'Received0001',type:'chat-message',chatId:'AlphaChat001',senderId:'AlphaUser001',text,seq:1,at:1000,delivery:'sent'});
  app.window.fetch=async(_,options)=>({ok:true,json:async()=>JSON.parse(options.body).action==='contacts'?{contacts}:{messages:[]}});
  const {openPeopleView}=await app.load(modulePath('ui/PeopleView'));
  const root=app.document.createElement('main');app.document.body.append(root);
  const stop=openPeopleView(root,{store:app.store,settings:{get:()=>({profile:{name:'Zelf'}})}});t.after(stop);
  (await until(()=>root.querySelector('[data-swipe-row="AlphaUser001"] [data-swipe-surface]:not(:disabled)'))).click();
  const save=await until(()=>root.querySelector('[data-save-shared-card]:not(:disabled)'));
  assert.match(root.querySelector('[data-messages]').textContent,/Kaart · Gedeelde pas/);
  assert.ok(!root.querySelector('[data-messages]').textContent.includes('sharon-card'));
  save.click();
  await until(async()=>(await app.store.getAll('objects')).some(o=>o.type==='card'&&o.name==='Gedeelde pas'));
  assert.deepEqual(app.errors,[]);
});
