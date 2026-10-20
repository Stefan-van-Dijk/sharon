import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appHarness } from '../helpers/app-harness.mjs';
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
