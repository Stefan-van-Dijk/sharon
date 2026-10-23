import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;

test('Wikipedia heart and retract use the shared durable queue, and owner can set relevance',async()=>{
  const app=await appHarness();let stop;
  try {
    const {InformationFeedbackService}=await app.load('./src/core/information/InformationFeedbackService.js?v='+version);
    const {openBoardViewer}=await app.load('./src/ui/BoardViewer.js?v='+version);
    const device={personId:'abcdefghijkl',registered:false,self:{line:0}};
    const connection={device:async()=>device,request:async()=>{throw Error('Offline');}};
    const service=new InformationFeedbackService(app.store,connection);
    stop=service.start(app.window);
    const feature={id:'Q42',geometry:{coordinates:[5,52]},properties:{wikidata:'Q42',title:'Voorbeeld',categories:['Erfgoed'],url:'https://nl.wikipedia.org/?curid=42',description:'Een korte tekst.'}};
    const close=openBoardViewer(feature);
    const like=await until(()=>app.document.querySelector('[aria-label="Vind ik leuk"]:not(:disabled)'));
    like.click();
    await until(async()=> (await app.store.getAll('meta')).some(row=>row.value.state?.liked));
    assert.equal(like.getAttribute('aria-pressed'),'true');
    like.click();
    await until(async()=> (await app.store.getAll('meta')).some(row=>row.value.state?.liked===false && row.value.state?.opened));
    assert.equal(like.getAttribute('aria-pressed'),'false');
    const editor=await until(()=>app.document.querySelector('.sh-board-footer details'));
    assert.match(editor.textContent,/Basisbereik/);
    editor.open=true;
    const form=editor.querySelector('form');
    await until(()=>form.elements.baseRadius.value==='10000');
    form.elements.baseRadius.value='500';form.elements.maxRadius.value='2000';form.elements.weight.value='0.7';
    let saved;
    connection.request=async(action,input)=>{
      assert.equal(action,'information-policy');saved=input;
      return {item:{reference:input.item,counts:{liked:0},policy:input.policy,revision:1}};
    };
    form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
    await until(()=>editor.querySelector('[role="status"]').textContent==='Relevantie opgeslagen.');
    assert.equal(saved.item.source,'wikipedia');assert.equal(saved.item.id,'Q42');
    assert.equal(saved.policy.baseRadius,500);assert.equal(saved.context.location.lat,52);
    close();
    assert.equal(app.document.querySelector('.sh-board-overlay'),null);
  } finally {stop?.();app.close();}
});
