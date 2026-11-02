import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appHarness, until } from '../helpers/app-harness.mjs';
const version=JSON.parse(readFileSync('package.json')).version;

test('Tiqets uses the shared Board viewer with partner link and credit, without Wikipedia requests or feedback', async () => {
  const app=await appHarness();
  try {
    const {tiqetsFeatures,tiqetsBoard}=await app.load('./src/ui/TiqetsSource.js?v='+version);
    const {openBoardViewer}=await app.load('./src/ui/BoardViewer.js?v='+version);
    const features=tiqetsFeatures([{
      id:'123',title:'Museumticket',summary:'Informatie over dit museum.',
      geolocation:{lat:52,lng:5},sale_status:'available',venue:{id:'99',name:'Museum'},
      product_url:'https://www.tiqets.com/nl/ticket-p123/?partner=sharon',images:[{
        large:'https://cdn.tiqets.com/photo.jpg',credit:'Fotograaf',alt_text:'Foto van het museum'
      }]
    }]).features;
    const close=openBoardViewer(features[0],{sourceBoard:tiqetsBoard(features[0])});
    const source=app.document.querySelector('.sh-board-source');
    assert.equal(source.textContent,'T');
    assert.match(source.href,/partner=sharon/);
    assert.match(source.rel,/sponsored/);
    assert.match(source.getAttribute('aria-label'),/affiliatelink/);
    assert.match(app.document.querySelector('.sh-board-attribution').textContent,/Fotograaf/);
    assert.match(app.document.querySelector('.sh-board-story').textContent,/Informatie over dit museum/);
    assert.equal(app.document.querySelector('.sh-board-feedback'),null);
    assert.equal(app.requests.length,0);
    const keys=Object.keys(app.window.localStorage);
    assert.ok(!keys.some(key=>key.includes('wiki.feedback')||key.includes('tiqets')));
    close();
    assert.equal(app.document.querySelector('.sh-board-overlay'),null);
  } finally {app.close();}
});

test('saving from a Tiqets board is visible in Cards and preserves later ticket-code enrichment', async () => {
  const app=await appHarness();
  try {
    const {tiqetsFeatures,tiqetsBoard}=await app.load('./src/ui/TiqetsSource.js?v='+version);
    const {openBoardViewer}=await app.load('./src/ui/BoardViewer.js?v='+version);
    const {openCardBoard}=await app.load('./src/ui/CardBoard.js?v='+version);
    const {openCardsView}=await app.load('./src/ui/CardsView.js?v='+version);
    const feature=tiqetsFeatures([{
      id:'123',title:'Museumticket',sale_status:'available',geolocation:{lat:52,lng:5},
      venue:{id:'99',name:'Museum'},product_url:'https://www.tiqets.com/nl/ticket-p123/?partner=sharon'
    }]).features[0];
    const sourceBoard=tiqetsBoard(feature,{store:app.store});
    const close=openBoardViewer(feature,{sourceBoard});
    app.document.querySelector('.sh-board-save-card').click();
    await until(()=>app.document.querySelector('.sh-board-save-card')?.textContent==='Bewaard bij Kaarten');
    let objects=await app.store.getAll('objects');
    const card=objects.find(item=>item.type==='card'&&item.reference?.productId==='123');
    assert.ok(card);
    assert.equal(card.codeValue,'');
    assert.equal(objects.find(item=>item.id===card.locationId).data.title,'Museum');
    close();
    const closeCard=openCardBoard(card,{cards:[card],locations:objects.filter(item=>item.type==='location'),store:app.store});
    assert.match(app.document.querySelector('[data-code]').textContent,/Nog geen toegangsbewijs/);
    assert.match(app.document.querySelector('.sh-ticket-source-link').href,/partner=sharon/);
    closeCard();
    const outlet=app.document.createElement('section');
    const headerActions=app.document.createElement('div');
    app.document.body.append(outlet,headerActions);
    const cleanup=await openCardsView(outlet,{
      store:app.store,location:{latest:null},events:{on:()=>()=>{}},setTitle:()=>{},headerActions
    });
    assert.match(outlet.textContent,/Museumticket/);
    assert.match(outlet.textContent,/Verwijzing/);
    const enriched={...card,codeFormat:'QR_CODE',codeValue:'gekocht-ticket'};
    await app.store.put('objects',enriched);
    await sourceBoard.onSave(0);
    objects=await app.store.getAll('objects');
    assert.equal(objects.filter(item=>item.type==='card').length,1);
    assert.equal(objects.find(item=>item.id===card.id).codeValue,'gekocht-ticket');
    cleanup?.();
  } finally {app.close();}
});
