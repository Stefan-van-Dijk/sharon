import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sealInvitation,unsealInvitation} from '../src/core/connection/InvitationReference.js';
import {connectionLink,parseConnectionLink} from '../src/core/connection/ConnectionService.js';
test('compact contact QR has an identifier and secret; only the correct key opens the invitation',async()=>{
  const invitation={v:1,kind:'invite',networkId:'Network00001',token:'a'.repeat(43),expiresAt:Date.now()+86400000};
  const sealed=await sealInvitation(invitation),reference={kind:'reference',id:'InviteRef001',key:sealed.key};
  const link=connectionLink(reference);
  assert.ok(link.length<130);assert.ok(!link.includes(invitation.token));
  assert.deepEqual(parseConnectionLink(link),reference);
  assert.deepEqual(await unsealInvitation(reference,sealed.payload),invitation);
  assert.ok(!JSON.stringify(sealed.payload).includes(invitation.networkId));
  const other=await sealInvitation(invitation);
  await assert.rejects(unsealInvitation({...reference,key:other.key},sealed.payload));
  const changed={...sealed.payload,data:(sealed.payload.data[0]==='a'?'b':'a')+sealed.payload.data.slice(1)};
  await assert.rejects(unsealInvitation(reference,changed));
  assert.deepEqual(parseConnectionLink(connectionLink(invitation)),invitation);
});

test('new contact QR serializes only the twelve-character identifier',()=>{
  const code={kind:'code',id:'ContactCode1'};
  assert.equal(connectionLink(code),'ContactCode1');
  assert.deepEqual(parseConnectionLink('  ContactCode1  '),code);
  assert.throws(()=>connectionLink({kind:'code',id:'short'}));
  const context={module:{exports:{}},exports:{}};
  vm.runInNewContext(readFileSync('vendor/qrcode-2.0.4.js','utf8'),context);
  const qr=context.module.exports(0,'M');qr.addData(connectionLink(code),'Byte');qr.make();
  assert.equal(qr.getModuleCount(),21,'bare ID fits the simplest QR size');
});
