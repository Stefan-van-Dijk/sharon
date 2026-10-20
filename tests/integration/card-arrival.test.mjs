import test from 'node:test';
import assert from 'node:assert/strict';
import { appHarness, until, dismissCardBoard } from '../helpers/app-harness.mjs';
const pause=()=>new Promise(resolve=>setTimeout(resolve,25));
async function setup(t, {multiple=false,blocked=false}={}) {
  const app=await appHarness();
  await app.store.put('objects',{id:'ArrivalPlace',type:'location',data:{title:'Winkel',coordinates:{lat:52,lng:6},radiusM:100}});
  await app.store.put('objects',{id:'ArrivalCard1',type:'card',name:'Mijn pas',locationId:'ArrivalPlace'});
  if(multiple)await app.store.put('objects',{id:'ArrivalCard2',type:'card',name:'Tweede pas',locationId:'ArrivalPlace'});
  const {EventBus}=await app.load('./src/core/events/EventBus.js');
  const {mountCardArrival}=await app.load('./src/ui/CardArrival.js');
  const events=new EventBus(), location={latest:{lat:52,lng:6,accuracy:10,at:Date.now()}};
  let busy=blocked, cleanup=mountCardArrival({store:app.store,location,events,canOpen:()=>!busy});
  t.after(()=>{cleanup();app.close();});
  return {...app,events,location,setBusy:value=>{busy=value;},remount(){cleanup();cleanup=mountCardArrival({store:app.store,location,events,canOpen:()=>!busy});}};
}
test('pas opent vanzelf, blijft na sluiten dicht, en opent na bevestigd vertrek opnieuw',async t=>{
  const app=await setup(t);
  await dismissCardBoard(app);
  app.events.emit('location.changed',app.location.latest);await pause();
  assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
  app.remount();await pause();
  assert.equal(app.document.querySelector('.sh-card-board-overlay'),null,'sluiten blijft bewaard bij herstart van de controller');
  // Poor GPS must not count as departure and re-arm the popup.
  app.location.latest={...app.location.latest,accuracy:500,at:Date.now()};app.events.emit('location.changed');await pause();
  app.location.latest={...app.location.latest,accuracy:10,at:Date.now()};app.events.emit('location.changed');await pause();
  assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
  app.location.latest={...app.location.latest,lat:53,at:Date.now()};app.events.emit('location.changed');
  await until(async()=>(await app.store.get('meta','cards.context.visit')).value.length===0);
  app.location.latest={...app.location.latest,lat:52,at:Date.now()};app.events.emit('location.changed');
  await until(()=>app.document.querySelector('[aria-label="Kaart Mijn pas"]'));
  assert.deepEqual(app.errors,[]);
});
test('meerdere passende pasjes geven één keuzevenster, kiezen opent één pas',async t=>{
  const app=await setup(t,{multiple:true});
  const choice=await until(()=>app.document.querySelector('[aria-label="Kies een pas"]'));
  assert.equal(choice.querySelectorAll('[data-arrival-choice]').length,2);
  choice.querySelector('[data-arrival-choice="ArrivalCard2"]').click();
  await until(()=>app.document.querySelector('[aria-label="Kaart Tweede pas"]'));
  assert.equal(app.document.querySelectorAll('.sh-card-board-overlay').length,1);
  // The selected pass stays part of the location's deck.
  app.window.dispatchEvent(new app.window.KeyboardEvent('keydown',{key:'ArrowRight'}));
  assert.ok(app.document.querySelector('[aria-label="Kaart Mijn pas"]'));
  app.location.latest={...app.location.latest,lat:53,at:Date.now()};app.events.emit('location.changed');
  await until(()=>!app.document.querySelector('.sh-card-board-overlay'));
  assert.deepEqual(app.errors,[]);
});
test('popup wordt uitgesteld tijdens invoer en verschijnt zodra de module klaar is',async t=>{
  const app=await setup(t,{blocked:true});await pause();
  assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
  app.setBusy(false);app.events.emit('cards.context.check');
  await until(()=>app.document.querySelector('[aria-label="Kaart Mijn pas"]'));
  app.location.latest={...app.location.latest,at:Date.now()-120001};app.events.emit('location.changed');
  await until(()=>!app.document.querySelector('.sh-card-board-overlay'));
});
