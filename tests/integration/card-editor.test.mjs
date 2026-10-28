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
 const kind=form.querySelector('[data-kind-toggle]'),options=form.querySelector('[data-kind-options]'),chain=form.querySelector('[data-chain-link]');
 assert.ok(options.compareDocumentPosition(chain)&app.window.Node.DOCUMENT_POSITION_FOLLOWING);
 kind.click();assert.equal(options.hidden,false);form.querySelector('[data-kind="membership"]').click();assert.equal(options.hidden,true);
 assert.equal(form.querySelector('[data-kind-done]'),null);const color=form.elements.color;
 for(const [background,foreground] of [['#000000','rgb(255, 255, 255)'],['#ffffff','rgb(0, 0, 0)'],['#e51c00','rgb(255, 255, 255)'],['#ffff00','rgb(0, 0, 0)']]){
   color.value=background;color.dispatchEvent(new app.window.Event('input',{bubbles:true}));
   assert.equal(kind.style.color,foreground);assert.equal(kind.style.backgroundColor,background==='#000000'?'rgb(0, 0, 0)':background==='#ffffff'?'rgb(255, 255, 255)':background==='#e51c00'?'rgb(229, 28, 0)':'rgb(255, 255, 0)');
 }

 assert.equal(form.querySelector('.sh-card-preview [data-code-type-toggle]'),null);form.querySelector('[data-code-type-toggle]').click();
 assert.equal(form.querySelector('[data-code-options]').hidden,false);form.querySelector('[data-code-option="QR_CODE"]').click();assert.equal(form.querySelector('[data-code-options]').hidden,true);
 assert.equal(form.querySelector('[data-person-links]'),null);assert.equal(form.querySelector('[data-extra-panel]').hidden,true);
 assert.equal(form.querySelector('[data-field-preset="Website"]').hidden,true);
 form.querySelector('[data-extra-toggle]').click();form.querySelector('[data-field-preset="Notities"]').click();
 form.elements.codeFormat.value='';
 const notes=form.querySelector('textarea[data-field-value]');notes.value='Nieuwe notitie';notes.dispatchEvent(new app.window.Event('input',{bubbles:true}));
 assert.equal(form.querySelector('[data-extra-panel]').hidden,true);assert.equal(form.querySelector('[data-field-preset="Notities"]').hidden,true);
 let asked=false;app.window.confirm=()=>{asked=true;return false;};header.querySelector('[data-card-cancel]').click();assert.equal(asked,true);assert.equal(form.isConnected,true);
 header.querySelector('[type="submit"]').click();
 await until(()=>app.document.querySelector('[data-card-list]'));
 assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
 assert.equal(header.querySelector('.sh-card-form-actions'),null);
 const saved=await app.store.get('objects','EditorCard01');assert.deepEqual(Array.from(saved.personIds),['LegacyUser01']);
 assert.equal(saved.fields.length,4);assert.equal(saved.fields[1].value,'oude-website');assert.equal(saved.fields[3].value,'Nieuwe notitie');assert.deepEqual(app.errors,[]);
});
