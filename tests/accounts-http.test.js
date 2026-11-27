import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('Account HTTP endpoints enforce app exchange keys and the authenticated Shop owner',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'sharon-account-http-'));
 await mkdir(join(directory,'log/api'),{recursive:true});
 await copyFile('server/connections.php',join(directory,'log/api/connections.php'));
 const listener=createServer();
 await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
 const port=listener.address().port;
 await new Promise(resolve=>listener.close(resolve));
 const key='k'.repeat(43);
 const child=spawn('php',['-d','sendmail_path=/bin/false','-S','127.0.0.1:'+port,'-t',directory],{
  env:{...process.env,SHARON_ACCOUNT_MAIL_FROM:'accounts@example.test',SHARON_EVENTLINE_KEY:key},stdio:'ignore'
 });
 let stopped=false;
 child.once('exit',()=>{stopped=true;});
 t.after(async()=>{
  if(!stopped){child.kill();await new Promise(resolve=>child.once('exit',resolve));}
  await rm(directory,{recursive:true,force:true});
 });
 const endpoint='http://127.0.0.1:'+port+'/log/api/connections.php';
 let ready=false;
 for(let attempt=0;attempt<100;attempt++){
  try{await fetch(endpoint);ready=true;break;}catch{
   if(stopped)break;
   await new Promise(resolve=>setTimeout(resolve,20));
  }
 }
 assert(ready,'PHP account endpoint did not start');
 const request=async(action,input={},headers={})=>{
  const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',...headers},
   body:JSON.stringify({protocol:'sharon-network-v1',action,...input})});
  return {status:response.status,body:await response.json()};
 };
 const credentials={email:'http@example.test',password:'Http-password-123'};
 const registration=await request('account-register',credentials);
 assert.deepEqual(registration,{status:200,body:{ok:true}});
 const state=JSON.parse(await readFile(join(directory,'log/private/connections/network-v1.json'),'utf8'));
 const code=Object.values(state.accountMail)[0].code;
 assert(!JSON.stringify(registration).includes(code));
 assert.equal((await request('account-verify',{...credentials,code})).status,200);
 const device={personId:'HttpPerson01',deviceToken:'d'.repeat(43),name:'HTTP user'};
 const login=await request('account-login',{...credentials,...device});
 assert.equal(login.status,200);
 const session={'X-Sharon-Account-Token':login.body.sessionToken};
 const auth={...session,'X-Log-Access-Token':device.deviceToken};
 assert.equal((await request('shop-pair-list',{}, {'X-Log-Access-Token':device.deviceToken})).status,401);
 assert.equal((await request('shop-pair-list',{},auth)).status,200);
 const ticket=(await request('account-app-code',{app:'eventline'},session)).body.code;
 const exchange={app:'eventline',code:ticket};
 assert.equal((await request('account-app-redeem',exchange)).status,403);
 const claims=await request('account-app-redeem',exchange,{'X-Sharon-App-Key':key});
 assert.equal(claims.status,200);
 assert.equal(claims.body.account.email,credentials.email);
 assert.equal(claims.body.account.personId,device.personId);
 assert(!JSON.stringify(claims).includes(device.deviceToken));
 assert(!JSON.stringify(claims).includes(login.body.sessionToken));
 assert.equal((await request('account-app-redeem',exchange,{'X-Sharon-App-Key':key})).status,403);
 await request('account-logout',{},session);
 assert.equal((await request('shop-pair-list',{},auth)).status,401);
 assert.equal((await request('account-status',{},session)).body.account,null);
});
