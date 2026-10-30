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
    await until(()=>app.document.querySelector('[data-policy-swipe]'));
    swipe(app,app.document.querySelector('.sh-board-footer'));
    const editor=await until(()=>app.document.querySelector('.sh-board-owner-policy-overlay'));
    assert.match(editor.textContent,/Basisbereik/);
    const form=editor.querySelector('form');
    await until(()=>form.elements.baseRadius.value==='10000');
    form.elements.baseRadius.value='500';form.elements.maxRadius.value='2000';form.elements.weight.value='0.7';
    let saved;
    connection.request=async(action,input)=>{
      assert.equal(action,'information-policy');saved=input;
      return {item:{reference:input.item,counts:{liked:0},policy:input.policy,revision:1}};
    };
    form.dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
    await until(()=>!editor.isConnected);
    assert.equal(saved.item.source,'wikipedia');assert.equal(saved.item.id,'Q42');
    assert.equal(saved.policy.baseRadius,500);assert.equal(saved.context.location.lat,52);
    close();
    assert.equal(app.document.querySelector('.sh-board-overlay'),null);
  } finally {stop?.();app.close();}
});

function swipe(app,target,{dx=-130,dy=0,cancel=false}={}) {
  for (const [type,x,y] of [['touchstart',220,300],['touchmove',220+dx,300+dy],[cancel?'touchcancel':'touchend',220+dx,300+dy]]) {
    const event=new app.window.Event(type,{bubbles:true,cancelable:true});
    const touch={clientX:x,clientY:y};
    Object.defineProperties(event,{touches:{value:type==='touchstart'||type==='touchmove'?[touch]:[]},changedTouches:{value:[touch]}});
    target.dispatchEvent(event);
  }
}
async function fixture(owner=true) {
  const app=await appHarness();
  const {InformationFeedbackService}=await app.load('./src/core/information/InformationFeedbackService.js?v='+version);
  const {openBoardViewer}=await app.load('./src/ui/BoardViewer.js?v='+version);
  const service=new InformationFeedbackService(app.store,{device:async()=>({personId:'abcdefghijkl',registered:false,self:{line:owner?0:1}}),request:async()=>{throw Error('Offline');}});
  const stop=service.start(app.window);
  let next=0;
  const close=openBoardViewer({id:'Q42',geometry:{coordinates:[5,52]},properties:{wikidata:'Q42',title:'Voorbeeld',url:'https://nl.wikipedia.org/?curid=42'}},{onNext:()=>{next++;}});
  await until(()=>app.document.querySelector('[aria-label="Vind ik leuk"]:not(:disabled)'));
  if(owner) await until(()=>app.document.querySelector('[data-policy-swipe]'));
  return {app,close,get next(){return next;},dispose(){close();stop();app.close();}};
}

test('owner footer swipe opens one editor without navigating; Escape closes only editor; parent close cleans up',async()=>{
  const f=await fixture();
  try {
    const footer=f.app.document.querySelector('.sh-board-footer');
    swipe(f.app,footer);
    await new Promise(resolve=>setTimeout(resolve,30));
    assert.equal(f.next,0);
    assert.equal(f.app.document.querySelectorAll('.sh-board-owner-policy-overlay').length,1);
    swipe(f.app,footer);
    assert.equal(f.app.document.querySelectorAll('.sh-board-owner-policy-overlay').length,1);
    f.app.window.dispatchEvent(new f.app.window.KeyboardEvent('keydown',{key:'Escape'}));
    assert.equal(f.app.document.querySelector('.sh-board-owner-policy-overlay'),null);
    assert.ok(f.app.document.querySelector('.sh-board-overlay'));
    swipe(f.app,footer);
    f.close();
    assert.equal(f.app.document.querySelector('.sh-board-owner-policy-overlay'),null);
  }finally{f.dispose();}
});

test('footer ignores short, right, vertical and cancelled swipes; ordinary content still navigates',async()=>{
  const f=await fixture();
  try {
    const footer=f.app.document.querySelector('.sh-board-footer');
    for(const options of [{dx:-25},{dx:130},{dx:-10,dy:130},{cancel:true}]) swipe(f.app,footer,options);
    assert.equal(f.app.document.querySelector('.sh-board-owner-policy-overlay'),null);
    assert.equal(f.next,0);
    swipe(f.app,f.app.document.querySelector('.sh-board-story'));
    await new Promise(resolve=>setTimeout(resolve,30));
    assert.equal(f.next,1);
  }finally{f.dispose();}
});

test('non-owner has no relevance editor or owner gesture',async()=>{
  const f=await fixture(false);
  try {
    assert.equal(f.app.document.querySelector('[data-policy-swipe]'),null);
    swipe(f.app,f.app.document.querySelector('.sh-board-footer'));
    assert.equal(f.app.document.querySelector('.sh-board-owner-policy-overlay'),null);
  }finally{f.dispose();}
});

test('board footer shows category and personal feedback without community counts or connection notices',async()=>{
  const app=await appHarness();let stop,close;
  try{
    const {InformationFeedbackService}=await app.load('./src/core/information/InformationFeedbackService.js?v='+version);
    const {openBoardViewer}=await app.load('./src/ui/BoardViewer.js?v='+version);
    const service=new InformationFeedbackService(app.store,{device:async()=>({personId:'abcdefghijkl',registered:false,self:{line:1}}),request:async()=>{throw Error('Offline');}});
    stop=service.start(app.window);
    for(const local of [false,true]){
      const feature={id:'Q42',geometry:{coordinates:[5,52]},properties:{wikidata:'Q42',title:'Voorbeeld',categories:['Erfgoed'],url:'https://nl.wikipedia.org/?curid=42'}};
      close=openBoardViewer(feature,local?{localBoard:{feedbackId:'node/1',feedbackReference:{source:'openstreetmap',id:'node/1',uri:'https://www.openstreetmap.org/node/1'},title:'Winkel',category:'Boodschappen',credit:'© OpenStreetMap'}}:{});
      const like=await until(()=>app.document.querySelector('[aria-label="Vind ik leuk"]:not(:disabled)'));
      const footer=app.document.querySelector('.sh-board-footer');
      assert.equal(footer.querySelector('.sh-board-attribution .sh-board-category').textContent,local?'Boodschappen':'Erfgoed');
      app.window.dispatchEvent(new app.window.CustomEvent('sharon-information-changed',{detail:{error:true}}));
      assert.doesNotMatch(footer.textContent,/Waardering wacht op verbinding/);
      const original=service.summary;service.summary=()=>({counts:{liked:321}});
      app.window.dispatchEvent(new app.window.CustomEvent('sharon-information-changed'));
      assert.doesNotMatch(footer.textContent,/321 leuk/);
      service.summary=original;
      like.click();assert.equal(like.getAttribute('aria-pressed'),'true');
      await until(async()=>(await app.store.getAll('meta')).some(row=>row.value.state?.liked));
      assert.doesNotMatch(footer.textContent,/Opgeslagen op dit apparaat|Waardering bewaren/);
      like.click();assert.equal(like.getAttribute('aria-pressed'),'false');
      close();close=null;
    }
  }finally{close?.();stop?.();app.close();}
});
