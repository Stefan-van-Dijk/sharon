import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {appHarness,until} from '../helpers/app-harness.mjs';

const version=JSON.parse(readFileSync('package.json')).version;
const servicePath='./src/core/connection/ConnectionService.js?v='+version;
async function server(t) {
  const dir=mkdtempSync(join(tmpdir(),'sharon-connection-'));
  const env={...process.env,PHP_CLI_SERVER_WORKERS:'4'};
  mkdirSync(join(dir,'api'));mkdirSync(join(dir,'private'));
  copyFileSync('server/connections.php',join(dir,'api/connections.php'));
  const publishKey='fixture-publication-key-not-for-production';
  writeFileSync(join(dir,'private/publish-secret.php'),'<?php const LOG_PUBLISH_KEY='+JSON.stringify(publishKey)+';');
  const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const port=socket.address().port;await new Promise(r=>socket.close(r));
  const processHandle=spawn('php',['-S','127.0.0.1:'+port,'-t',join(dir,'api')],{
    env,stdio:'ignore',detached:true
  });
  const endpoint='http://127.0.0.1:'+port+'/connections.php';
  t.after(()=>{
    try{process.kill(-processHandle.pid,'SIGTERM');}catch{}
    rmSync(dir,{recursive:true,force:true});
  });
  for(let i=0;i<100;i++) {
    try {
      if((await fetch(endpoint)).status===422) {
        const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Log-Publish-Key':publishKey},
          body:JSON.stringify({protocol:'sharon-network-v1',action:'start'})});
        const result=await response.json();assert.equal(response.status,200);
        const startLink='https://stefan-van-dijk.github.io/sharon/#connect='+Buffer.from(JSON.stringify(result.invitation)).toString('base64url');
        return {endpoint,startLink,dir,publishKey};
      }
    } catch{}
    await new Promise(r=>setTimeout(r,30));
  }
  throw Error('PHP connection server did not start');
}
function attach(app,endpoint) {
  app.window.TextEncoder=TextEncoder;
  app.window.fetch=async(url,options)=>{
    assert.equal(String(url),'https://sharon.life/log/api/connections.php');
    assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    // JSDOM's AbortSignal belongs to another realm; the production URL stays fixed.
    return fetch(endpoint,{...options,signal:undefined});
  };
}
function submit(app,selector) {
  app.document.querySelector(selector).dispatchEvent(new app.window.Event('submit',{bubbles:true,cancelable:true}));
}
test('two isolated installations bootstrap, bind an invitation, chat, retry a lost reply and reconnect',async t=>{
  const {endpoint,startLink,dir,publishKey}=await server(t);
  const owner=await appHarness(),guest=await appHarness();
  t.after(()=>{owner.close();guest.close();});
  attach(owner,endpoint);attach(guest,endpoint);
  const ownerModule=await owner.load(servicePath),guestModule=await guest.load(servicePath);
  const a=new ownerModule.ConnectionService(owner.store),b=new guestModule.ConnectionService(guest.store);
  const simultaneous=await Promise.all([a.device(),new ownerModule.ConnectionService(owner.store).device()]);
  assert.equal(simultaneous[0].personId,simultaneous[1].personId);
  assert.equal(simultaneous[0].deviceToken,simultaneous[1].deviceToken);
  const ownerSelf=await a.activate(ownerModule.parseConnectionLink(startLink),'Stefan');
  assert.equal(ownerSelf.line,0);
  await b.register('Gast <script>inert</script>');
  const guestDevice=await b.device();
  const invitation=await a.invite(guestDevice.personId);
  const link=ownerModule.connectionLink(invitation);
  await b.setPending(guestModule.parseConnectionLink(link));
  const {openPeopleView}=await guest.load('./src/ui/PeopleView.js?v='+version);
  const host=guest.document.createElement('main');guest.document.body.append(host);
  const cleanup=openPeopleView(host,{store:guest.store,settings:{get:()=>({profile:{name:'Gast'}})}});
  t.after(cleanup);
  const accept=await until(()=>host.querySelector('[data-accept]'));
  assert.equal(host.querySelector('[data-person-id]').textContent,guestDevice.personId);
  assert.equal((await b.device()).self.line,null,'QR has not silently granted access');
  accept.click();
  await until(()=>host.querySelector('[data-connection-state]')?.textContent.includes('lijn 1'));
  await until(()=>host.querySelector('[data-contacts] button')&&!host.querySelector('[data-contacts] button').disabled);
  assert.equal(await b.pending(),null);
  host.querySelector('[data-contacts] button').click();
  const form=await until(()=>host.querySelector('[data-message-form]'));
  await until(()=>!form.querySelector('button').disabled);
  form.elements.message.value='Hallo Stefan';
  submit(guest,'[data-message-form]');
  await until(()=>host.querySelector('[data-messages]')?.textContent.includes('Verstuurd'));
  const contact=(await a.contacts())[0];assert.equal(contact.personId,guestDevice.personId);
  let messages=await a.sync(contact.chatId);
  assert.equal(messages[0].text,'Hallo Stefan');
  const normalFetch=owner.window.fetch;
  let loseReply=true;
  owner.window.fetch=async(url,opts)=>{
    const result=await normalFetch(url,opts);
    if(JSON.parse(opts.body).action==='send'&&loseReply) {loseReply=false;throw new TypeError('reply lost');}
    return result;
  };
  await assert.rejects(a.send(contact.chatId,'Antwoord'),/server is niet beschikbaar/);
  const pending=(await a.cachedMessages(contact.chatId)).find(m=>m.delivery==='pending');
  assert.ok(pending);
  await a.send(contact.chatId,'',pending.id);
  messages=await b.sync(contact.chatId);
  assert.equal(messages.filter(m=>m.text==='Antwoord').length,1);
  assert.equal((await a.cachedMessages(contact.chatId)).find(m=>m.id===pending.id).delivery,'sent');
  const reloaded=new ownerModule.ConnectionService(owner.store);
  assert.equal((await reloaded.refreshSelf()).personId,ownerSelf.personId);
  assert.equal((await reloaded.device()).deviceToken,simultaneous[0].deviceToken);
  await assert.rejects(reloaded.activate(invitation,'Stefan'),/andere identiteit/);
  const third=await appHarness();t.after(()=>third.close());attach(third,endpoint);
  const thirdModule=await third.load(servicePath),c=new thirdModule.ConnectionService(third.store);
  await c.register('Derde');
  const thirdInvite=await a.invite((await c.device()).personId);
  await c.activate(thirdInvite,'Derde');
  await assert.rejects(c.sync(contact.chatId),/chat is niet toegankelijk/);
  await b.send(contact.chatId,'Nog niet opgehaald');
  await a.send(contact.chatId,'Nieuw eigen bericht');
  assert.ok((await a.sync(contact.chatId)).some(message=>message.text==='Nog niet opgehaald'),
    'acknowledging an outgoing message must not skip unseen incoming messages');
  // A peer's chosen message ID cannot overwrite a local non-message object.
  const incoming=await b.send(contact.chatId,'Nieuw bericht');
  await owner.store.put('objects',{id:incoming.id,type:'location',data:{title:'Bewaren'}});
  const cleanOwner=new ownerModule.ConnectionService(owner.store);
  await assert.rejects(cleanOwner.sync(contact.chatId),/conflicterende identiteit/);
  assert.equal((await owner.store.get('objects',incoming.id)).type,'location');
  assert.deepEqual(owner.errors,[]);assert.deepEqual(guest.errors,[]);
  assert.equal(guest.document.querySelector('script[src="x"]'),null);
});
test('HTTP boundary rejects hostile origins and oversize bodies; concurrent final invitations reserve only one place',async t=>{
  const {endpoint,startLink,dir,publishKey}=await server(t);
  const app=await appHarness();t.after(()=>app.close());attach(app,endpoint);
  const m=await app.load(servicePath),s=new m.ConnectionService(app.store);
  await s.activate(m.parseConnectionLink(startLink),'Eigenaar');
  const own=await s.device();
  const wrongKey=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Log-Publish-Key':'wrong-key'},
    body:JSON.stringify({protocol:'sharon-network-v1',action:'start'})});
  assert.equal(wrongKey.status,401);assert.equal((await wrongKey.json()).error,'invalid_publish_key');
  const post=(data,token=own.deviceToken)=>fetch(endpoint,{method:'POST',headers:{
    'Content-Type':'application/json','X-Log-Access-Token':token},body:JSON.stringify({protocol:'sharon-network-v1',...data})});
  assert.equal((await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'https://stefan-van-dijk.github.io',
    'Access-Control-Request-Headers':'x-log-access-token,x-log-publish-key,content-type'}})).status,204);
  assert.equal((await post({action:'self',padding:'x'.repeat(17000)})).status,413);
  assert.equal((await post({action:'self'},'x'.repeat(43))).status,401);
  const legacyId='LegacyChat01';
  const legacyToken='legacy-owner-access-token-with-entropy',memberToken='legacy-member-access-token-with-entropy';
  const legacy=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Log-Access-Token':legacyToken},
    body:JSON.stringify({action:'create',id:legacyId,ownerPersonId:'LegacyOwn001',memberPersonId:'LegacyMem001',memberToken,payload:{v:1,data:'opaque-encrypted-content'}})});
  assert.equal(legacy.status,200);
  const legacyPath=join(dir,'private/connections',legacyId+'.json'),original=readFileSync(legacyPath,'utf8');
  const legacyGet=await fetch(endpoint+'?id='+legacyId,{headers:{'X-Log-Access-Token':legacyToken}});
  assert.equal(legacyGet.status,200);assert.equal((await legacyGet.json()).payload.data,'opaque-encrypted-content');
  const targets=[];
  for(let i=0;i<2;i++) {
    const p={personId:'Candidate00'+i,deviceToken:(i?'b':'a').repeat(43),name:'Kandidaat'};
    assert.equal((await post({action:'register',...p})).status,200);
    targets.push({...p,invite:await s.invite(p.personId)});
  }
  // Populate a quiescent test fixture, leaving one historical place.
  const path=join(dir,'private/connections/network-v1.json');
  const state=JSON.parse(readFileSync(path));
  for(let i=0;i<99;i++) {
    const id='Filler'+String(i).padStart(6,'0'),relationId='Grant'+String(i).padStart(7,'0');
    state.people[id]={id,name:'Test',tokenHash:createHash('sha256').update('fixture'+i).digest('hex')};
    state.relations[relationId]={id:relationId,type:'grants-access',fromId:own.personId,toId:id,status:i===0?'revoked':'active'};
  }
  writeFileSync(path,JSON.stringify(state));
  const results=await Promise.all(targets.map(p=>post({action:'accept',...p.invite},p.deviceToken)));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const rejected=await results.find(r=>r.status===409).json();assert.equal(rejected.error,'capacity');
  assert.equal(readFileSync(legacyPath,'utf8'),original,'network claims must not overwrite Log connection files');
  const final=JSON.parse(readFileSync(path));
  assert.equal(Object.values(final.relations).filter(r=>r.type==='grants-access').length,100);
  assert.equal(Object.values(final.relations).filter(r=>r.type==='chat').length,1);
});
test('opening and leaving People sends no request and a pending link is stripped before storage',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  const m=await app.load(servicePath);
  const token='a'.repeat(43),payload={v:1,kind:'bootstrap',networkId:'Network00001',token,expiresAt:Date.now()+10000};
  const link=m.connectionLink(payload);
  const order=[];
  let stored;
  const fakeStore={put:async(_,row)=>{order.push('store');stored=row;}};
  const fakeLocation={href:link,hash:new URL(link).hash,pathname:'/sharon/',search:''};
  const fakeHistory={state:{},replaceState:()=>order.push('strip')};
  assert.equal(await m.captureConnectionLink(fakeStore,fakeLocation,fakeHistory),true);
  assert.deepEqual(order,['strip','store']);assert.equal(stored.value.token,token);
  assert.throws(()=>m.parseConnectionLink(link.replace('stefan-van-dijk.github.io','evil.test')),/Ongeldige/);
  await app.boot();
  (await until(()=>app.document.querySelector('[data-module="people"]'))).click();
  await until(()=>app.document.querySelector('[data-register]'));
  app.document.querySelector('[data-brand-control]').click();
  await until(()=>app.document.querySelector('.home-view'));
  assert.deepEqual(app.requests,[]);
  assert.deepEqual(app.errors,[]);
});

test('existing publication key creates a one-use start code through People and is never stored or shared',async t=>{
  const {endpoint,publishKey}=await server(t);
  const app=await appHarness();t.after(()=>app.close());attach(app,endpoint);
  const sent=[];
  const request=app.window.fetch;
  app.window.fetch=async(url,options)=>{sent.push({action:JSON.parse(options.body).action,headers:options.headers});return request(url,options);};
  const {openPeopleView}=await app.load('./src/ui/PeopleView.js?v='+version);
  const host=app.document.createElement('main');app.document.body.append(host);
  const cleanup=openPeopleView(host,{store:app.store,settings:{get:()=>({profile:{name:'Eigenaar'}})}});t.after(cleanup);
  (await until(()=>host.querySelector('[data-owner-start-button]'))).click();
  const form=await until(()=>host.querySelector('[data-owner-start]'));
  await until(()=>!form.querySelector('button').disabled);
  form.elements.key.value=publishKey;
  submit(app,'[data-owner-start]');
  assert.equal(form.elements.key.value,'');
  const accept=await until(()=>host.querySelector('[data-accept]'));
  await until(()=>!accept.disabled);accept.click();
  await until(()=>host.querySelector('[data-connection-state]')?.textContent==='Eigen installatie geactiveerd.');
  const stored=JSON.stringify(await app.store.getAll('meta'));
  assert.ok(!stored.includes(publishKey));
  assert.ok(!host.innerHTML.includes(publishKey));
  assert.equal(sent.find(r=>r.action==='start').headers['X-Log-Publish-Key'],publishKey);
  assert.ok(sent.filter(r=>r.action!=='start').every(r=>!r.headers['X-Log-Publish-Key']));
  const module=await app.load(servicePath),service=new module.ConnectionService(app.store);
  await assert.rejects(service.start(publishKey),/al geactiveerd/);
  assert.deepEqual(app.errors,[]);
});

test('switching to the Log JSON relay preserves the local identity but requires new server admission',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  const old={personId:'PersonOld001',deviceToken:'a'.repeat(43),registered:true,self:{line:0,networkId:'OldNetwork01'}};
  await app.store.setMeta('connection.device.v1',old);
  const module=await app.load(servicePath),service=new module.ConnectionService(app.store);
  const device=await service.device();
  assert.equal(device.personId,old.personId);assert.equal(device.deviceToken,old.deviceToken);
  assert.equal(device.registered,false);assert.equal(device.self,null);
  assert.equal((await new module.ConnectionService(app.store).device()).personId,old.personId);
  assert.deepEqual(app.requests,[]);
});
