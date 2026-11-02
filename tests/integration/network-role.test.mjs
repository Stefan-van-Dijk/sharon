import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appHarness,until} from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;
async function setup(t,line){
 const app=await appHarness();t.after(()=>app.close());
 const {ConnectionService}=await app.load('./src/core/connection/ConnectionService.js?v='+version);
 const service=new ConnectionService(app.store),device=await service.device();
 if(line!==undefined)await service.rememberSelf({personId:device.personId,networkId:'Network00001',line});
 const {openSettings}=await app.load('./src/ui/SettingsView.js?v='+version);
 const root=app.document.createElement('main');app.document.body.append(root);
 const stop=openSettings(root,{store:app.store,settings:{get:()=>({profile:{name:'Stefan'}})},install:{getState:()=>({})},events:{on:()=>()=>{}}});t.after(stop);
 await until(()=>!root.querySelector('[data-role-label]').textContent.includes('ophalen'));
 return {app,root,service,device};
}
test('network owner role is visible, distinguishes cache from server confirmation and exposes no token',async t=>{
 const {app,root,device}=await setup(t,0);
 assert.equal(root.querySelector('[data-role-label]').textContent,'Jouw rol: Beheerder');
 assert.match(root.querySelector('[data-role-confirmation]').textContent,/Laatst bekende/);
 assert.ok(!root.innerHTML.includes(device.deviceToken));
 app.window.fetch=async(_,options)=>{const input=JSON.parse(options.body);assert.equal(input.action,'self');return {ok:true,json:async()=>({self:{personId:device.personId,networkId:'Network00001',line:0}})};};
 root.querySelector('[data-check-role]').click();await until(()=>root.querySelector('[data-role-confirmation]').textContent==='Door de server bevestigd.');
});
test('name grants no rights: invited member and disconnected installation do not show administrator',async t=>{
 const member=await setup(t,1);assert.equal(member.root.querySelector('[data-role-label]').textContent,'Jouw rol: Deelnemer');
 const local=await setup(t);assert.equal(local.root.querySelector('[data-role-label]').textContent,'Niet verbonden met een netwerk');
 assert.equal(local.root.querySelector('[data-check-role]').disabled,true);
});
test('checking a cached role handles revoked access and connection failure honestly',async t=>{
 const {app,root,device}=await setup(t,0);
 app.window.fetch=async()=>{throw new TypeError('Offline');};
 root.querySelector('[data-check-role]').click();await until(()=>root.querySelector('[data-role-confirmation]').textContent.includes('Niet te controleren'));
 assert.match(root.querySelector('[data-role-label]').textContent,/Beheerder/);
 app.window.fetch=async()=>({ok:true,json:async()=>({self:{personId:device.personId,networkId:'Network00001',line:null}})});
 root.querySelector('[data-check-role]').click();await until(()=>root.querySelector('[data-role-label]').textContent==='Nog geen netwerktoegang');
 assert.equal((await app.store.get('meta','connection.device.log-json.v1')).value.self.line,null);
});
