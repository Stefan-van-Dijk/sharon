import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizeChain} from '../src/core/chains/ChainRecognition.js';

test('retailer names, unique search prefixes and AH aliases resolve locally',()=>{
 for(const [name,id] of [['Jumbo pas','Q2262314'],['jum','Q2262314'],['ALBERT HEIJN','Q1653985'],['AH bonuskaart','Q1653985'],['ah-to-go','Q1653985'],['Deka Markt','Q2489350'],['héMa','Q903805'],['Mijn Lidl pas','Q151954']])assert.equal(recognizeChain(name)?.id,id,name);
});
test('unknown, short, embedded and conflicting names do not create a chain link',()=>{
 for(const name of ['','a','al','he','mijn kaart','verhaal','hemapas','Jumbo HEMA','Jumbo bij AH'])assert.equal(recognizeChain(name),null,name);
});
