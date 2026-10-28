import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
const servicePath='./src/core/connection/ConnectionService.js?v='+version;
test('new invitation QR and clipboard contain only the twelve-character contact ID',async t=>{
  const app=await appHarness();let stop;t.after(()=>{stop?.();app.close();});
  const {ConnectionService}=await app.load(servicePath),service=new ConnectionService(app.store),device=await service.device();
  await service.rememberSelf({personId:device.personId,networkId:'Network00001',line:0});
  const actions=[];let encoded='',copied='';
  app.window.qrcode=()=>({addData:value=>{encoded=value;},make(){},createSvgTag:()=>'<svg viewBox="0 0 21 21"></svg>'});
  Object.defineProperty(app.window.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
  app.window.fetch=async(_,options)=>{
    const input=JSON.parse(options.body);actions.push(input.action);
    const data=input.action==='contacts'?{contacts:[]}:input.action==='invite-code'?{id:'ContactCode1'}:
      {invitation:{v:1,kind:'invite',networkId:'Network00001',token:'a'.repeat(43),expiresAt:Date.now()+86400000}};
    return {ok:true,json:async()=>data};
  };
  const {openPeopleView}=await app.load('./src/ui/PeopleView.js?v='+version);
  const root=app.document.createElement('main');app.document.body.append(root);
  stop=openPeopleView(root,{store:app.store,settings:{get:()=>({profile:{name:'Zelf'}})}});
  (await until(()=>root.querySelector('[data-list-sort]:not(:disabled)')&&root.querySelector('[data-invite]'))).click();
  await until(()=>encoded||root.querySelector('[data-status]:not([hidden])')?.textContent);
  assert.equal(encoded,'ContactCode1',root.querySelector('[data-status]')?.textContent);
  (await until(()=>root.querySelector('[data-copy-invite]:not(:disabled)'))).click();
  await until(()=>copied);assert.equal(copied,encoded);
  assert.ok(actions.includes('invite-code'));assert.ok(!actions.includes('invitation-publish'));
  assert.deepEqual(app.errors,[]);
});

for(const contact of [false,true])test('central camera distinguishes a bare contact ID from a normal twelve-character card QR: '+contact,async t=>{
  const app=await appHarness();t.after(()=>app.close());
  app.window.HTMLMediaElement.prototype.pause=function(){};
  app.window.URL.createObjectURL=()=> 'blob:code-test';app.window.URL.revokeObjectURL=()=>{};
  const value=contact?'ContactCode1':'NormalCard01',actions=[];
  let personId;
  app.window.ZXing={DecodeHintType:{POSSIBLE_FORMATS:1,TRY_HARDER:2},BarcodeFormat:{QR_CODE:0,0:'QR_CODE'},
    BrowserMultiFormatReader:class{async decodeFromImageUrl(){return {getBarcodeFormat:()=>0,getText:()=>value};}reset(){}}};
  app.window.fetch=async(_,options)=>{
    const input=JSON.parse(options.body);actions.push(input.action);let data;
    if(input.action==='invite-code-check')data={valid:contact};
    else if(input.action==='share-check')data={valid:false};
    else if(input.action==='register'){personId=input.personId;data={self:{personId,networkId:'Network00001',line:null}};}
    else if(input.action==='accept-code'){assert.equal(input.id,value);assert.equal(input.token,undefined);data={self:{personId,networkId:'Network00001',line:1},contact:{personId:'OtherUser001',chatId:'ChatWith0001',name:'Afzender'}};}
    else if(input.action==='contacts')data={contacts:[{personId:'OtherUser001',chatId:'ChatWith0001',name:'Afzender'}]};
    else if(input.action==='messages')data={messages:[]};else throw Error(input.action);
    return {ok:true,json:async()=>data};
  };
  await app.boot();(await until(()=>app.document.querySelector('[data-module="codes"]'))).click();
  const photo=await until(()=>app.document.querySelector('[data-scan-photo]'));
  Object.defineProperty(photo,'files',{value:[new app.window.File(['test'],'code.png',{type:'image/png'})]});
  photo.dispatchEvent(new app.window.Event('change',{bubbles:true}));
  if(contact){
    await until(()=>app.document.querySelector('[data-message-form]'));
    assert.ok(actions.includes('accept-code'));assert.ok(!actions.includes('invitation-resolve'));
  }else{
    await until(()=>app.document.querySelector('[name="codeValue"]')?.value===value);
    await until(()=>app.document.querySelector('[data-card-form][data-card-ready="true"]'));
    assert.equal(app.document.querySelector('[data-person-links]'),null);
    assert.ok(actions.includes('share-check'));assert.ok(!actions.includes('register'));assert.ok(!actions.includes('accept-code'));
  }
  assert.equal((await app.store.getAll('objects')).filter(o=>o.type==='card').length,0);
  assert.deepEqual(app.errors,[]);
});
