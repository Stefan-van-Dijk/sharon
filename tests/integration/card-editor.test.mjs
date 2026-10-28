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
 const expectedIcon=form.querySelector('[data-kind-icon]').innerHTML,expectedColor=kind.style.color,expectedBackground=kind.style.backgroundColor;
 header.querySelector('[type="submit"]').click();
 await until(()=>app.document.querySelector('[data-card-list]'));
 assert.equal(app.document.querySelector('.sh-card-board-overlay'),null);
 assert.equal(header.querySelector('.sh-card-form-actions'),null);
 const saved=await app.store.get('objects','EditorCard01');assert.deepEqual(Array.from(saved.personIds),['LegacyUser01']);
 assert.equal(saved.fields.length,4);assert.equal(saved.fields[1].value,'oude-website');assert.equal(saved.fields[3].value,'Nieuwe notitie');
 const listIcon=root.querySelector('.sh-strip-icon');assert.equal(app.window.getComputedStyle(listIcon.querySelector('svg')).stroke,'currentColor');assert.equal(listIcon.innerHTML,expectedIcon);assert.equal(listIcon.style.color,expectedColor);assert.equal(listIcon.style.backgroundColor,expectedBackground);
 const {openCardBoard}=await app.load('./src/ui/CardBoard.js');const closeBoard=openCardBoard(saved,{store:app.store});
 const badge=app.document.querySelector('[data-card-kind]');assert.equal(badge.innerHTML,expectedIcon);assert.equal(badge.style.color,expectedColor);assert.equal(badge.style.backgroundColor,expectedBackground);closeBoard();
 const {openCardShare}=await app.load('./src/ui/CardSharing.js');const closeShare=openCardShare(saved,{store:app.store});
 const share=app.document.querySelector('[data-share-item-icon]');assert.equal(share.innerHTML,expectedIcon);assert.equal(share.style.color,expectedColor);assert.equal(share.style.backgroundColor,expectedBackground);closeShare();
 assert.deepEqual(app.errors,[]);
});

test('visual choice groups are exclusive, toggle closed, and preview both QR and barcode',async t=>{
 const app=await appHarness();t.after(()=>app.close());
 const {readFileSync}=await import('node:fs');
 app.window.eval(readFileSync('vendor/qrcode-2.0.4.js','utf8'));app.window.eval(readFileSync('vendor/jsbarcode-3.12.1.min.js','utf8'));
 const {openCardsView}=await app.load('./src/ui/CardsView.js');
 const root=app.document.createElement('main'),header=app.document.createElement('div');app.document.body.append(root,header);
 const stop=await openCardsView(root,{store:app.store,headerActions:header});t.after(stop);header.querySelector('[aria-label="Kaart toevoegen"]').click();
 const form=await until(()=>root.querySelector('[data-card-ready="true"]'));
 const panels=['[data-kind-options]','[data-code-options]','[data-extra-panel]'];
 const triggers=['[data-kind-toggle]','[data-code-type-toggle]','[data-extra-toggle]'];
 for(let i=0;i<triggers.length;i++){form.querySelector(triggers[i]).click();assert.deepEqual(panels.map(p=>form.querySelector(p).hidden),panels.map((_,n)=>n!==i));}
 form.querySelector(triggers[2]).click();assert.ok(panels.every(p=>form.querySelector(p).hidden));
 const value=form.elements.codeValue,preview=form.querySelector('.sh-card-preview');
 value.value='日本語のQRコード';value.dispatchEvent(new app.window.Event('input',{bubbles:true}));
 await until(()=>preview.querySelector('svg'));assert.equal(preview.dataset.previewType,'qr');assert.equal(preview.querySelector('svg').getAttribute('preserveAspectRatio'),'xMidYMid meet');assert.equal(app.window.getComputedStyle(preview.querySelector('svg')).height,'190px');
 value.value='8712345678906';value.dispatchEvent(new app.window.Event('input',{bubbles:true}));
 await until(()=>preview.dataset.previewType==='barcode'&&preview.querySelector('svg'));assert.equal(app.window.getComputedStyle(preview.querySelector('svg')).height,'100px');
 form.querySelector(triggers[1]).click();assert.equal(form.querySelector('[data-code-option="EAN8"]').hidden,true);assert.equal(form.querySelector('[data-code-option="EAN13"]').hidden,false);
 form.querySelector('[data-code-option="CODE128"]').click();assert.ok(panels.every(p=>form.querySelector(p).hidden));assert.deepEqual(app.errors,[]);
});
