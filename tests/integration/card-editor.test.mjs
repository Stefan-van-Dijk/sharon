import test from 'node:test';
import assert from 'node:assert/strict';
import {appHarness,until} from '../helpers/app-harness.mjs';

test('card editor uses header actions and one optional-field picker without losing legacy data',async t=>{
 const app=await appHarness();t.after(()=>app.close());
 await app.store.put('objects',{id:'EditorCard01',type:'card',name:'Oude pas',personIds:['LegacyUser01'],fields:[{label:'Keten',value:'Oude keten'},{label:'Link',value:'oude-website'},{label:'Overige paskenmerken',value:'Behouden'}]});
 const {openCardsView}=await app.load('./src/ui/CardsView.js');const root=app.document.createElement('main'),header=app.document.createElement('div');app.document.body.append(root,header);
 const stop=await openCardsView(root,{store:app.store,headerActions:header});t.after(stop);
 root.querySelector('[data-swipe-edit]').click();const form=await until(()=>root.querySelector('[data-card-ready="true"]'));
 assert.equal(root.querySelector('[data-card-cancel]'),null);assert.equal(header.querySelector('[type="submit"]').getAttribute('form'),form.id);
 assert.equal(form.querySelector('[data-person-links]'),null);assert.equal(form.querySelector('[data-extra-panel]').hidden,true);
 assert.equal(form.querySelector('[data-field-preset="Website"]').hidden,true);
 form.querySelector('[data-extra-toggle]').click();form.querySelector('[data-field-preset="Notities"]').click();
 const notes=form.querySelector('textarea[data-field-value]');notes.value='Nieuwe notitie';notes.dispatchEvent(new app.window.Event('input',{bubbles:true}));
 assert.equal(form.querySelector('[data-extra-panel]').hidden,true);assert.equal(form.querySelector('[data-field-preset="Notities"]').hidden,true);
 let asked=false;app.window.confirm=()=>{asked=true;return false;};header.querySelector('[data-card-cancel]').click();assert.equal(asked,true);assert.equal(form.isConnected,true);
 header.querySelector('[type="submit"]').click();
 await until(()=>app.document.querySelector('.sh-card-board-overlay'));
 assert.equal(header.querySelector('.sh-card-form-actions'),null);
 const saved=await app.store.get('objects','EditorCard01');assert.deepEqual(Array.from(saved.personIds),['LegacyUser01']);
 assert.equal(saved.fields.length,4);assert.equal(saved.fields[1].value,'oude-website');assert.equal(saved.fields[3].value,'Nieuwe notitie');assert.deepEqual(app.errors,[]);
});
