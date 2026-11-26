import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mountAccountSettings} from '../src/ui/AccountSettings.js';

test('settings verifies a mailbox and saves a server-approved organization selection', async () => {
  const dom = new JSDOM('<details></details>');
  const {window} = dom;
  const previous = {document:globalThis.document, FormData:globalThis.FormData, Option:globalThis.Option};
  Object.assign(globalThis,{document:window.document,FormData:window.FormData,Option:window.Option});
  try {
    const personId = 'Account12345';
    const organization = {id:'Organisatie1',name:'Bouwgroep',role:'viewer'};
    const calls = [];
    const metadata = new Map();
    const host = document.querySelector('details');
    const service = {
      store:{
        get: async (table,key) => metadata.has(key) ? {key,value:metadata.get(key)} : undefined,
        setMeta: async (key,value) => metadata.set(key,value)
      },
      accountRequest: async (action,input) => {
        calls.push([action,input]);
        switch (action) {
          case 'account-self': return {account:{personId,emails:[],organizations:[organization]}};
          case 'account-email-start': return {challengeId:'Challenge123'};
          case 'account-email-verify': return {emails:[{email:'mail@example.com'}]};
          case 'organization-select': return {organization};
          default: throw Error('Onverwachte aanvraag');
        }
      }
    };
    const tick = () => new Promise(resolve=>setImmediate(resolve));
    const submit = async (selector,name,value) => {
      const form = host.querySelector(selector);
      form.elements[name].value = value;
      form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
      await tick();
    };
    mountAccountSettings(host,service);
    host.open = true;
    host.dispatchEvent(new window.Event('toggle'));
    await tick();
    assert.equal(host.querySelector('[data-account-body]').hidden,false);
    assert.equal(host.querySelector('[data-account-person]').textContent,personId);
    const proof = host.querySelector('[data-email-verify]');
    assert.equal(proof.hidden,true);
    await submit('[data-email-start]','email','mail@example.com');
    assert.equal(proof.hidden,false);
    await submit('[data-email-verify]','code','proof');
    assert.deepEqual(calls.find(([action])=>action==='account-email-verify')[1],{challengeId:'Challenge123',code:'proof'});
    assert.equal(proof.hidden,true);
    assert.match(host.querySelector('[data-account-emails]').textContent,/mail@example\.com/);

    await submit('[data-organization-select]','organization',organization.id);
    assert.equal(metadata.get('account.organization.v1.'+personId),organization.id);
    assert.equal(host.querySelector('[data-organization-admin]').hidden,true);
    await submit('[data-organization-select]','organization','');
    assert.equal(metadata.get('account.organization.v1.'+personId),null);
  } finally {
    Object.assign(globalThis,previous);
    window.close();
  }
});
