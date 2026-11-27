import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {ObjectStore} from '../src/core/storage/ObjectStore.js';
import {agendaLinksKey} from '../src/core/storage/ObjectRelations.js';

test('A linked location is archived and final removal unlinks its local references', async () => {
 globalThis.indexedDB=new IDBFactory();
 const store=await new ObjectStore().open();
 const parent={id:'SharedPlace1',type:'location',data:{title:'Locatie'}};
 const child={id:'ChildPlace01',type:'location',data:{parentId:parent.id,title:'Onderlocatie'}};
 const card={id:'Card',type:'card',locationId:parent.id,personIds:['KeepPerson']};
 const ref={source:'sharon',class:'location',id:parent.id};
 const other={source:'other',class:'location',id:parent.id};
 const pure={id:'note',type:'note',data:{body:parent.id}};
 const entries=[parent,child,card,pure,{id:'time',type:'time-entry',data:{target:ref}},
  {id:'action',type:'location-action',data:{locationId:parent.id}}];
 for(const row of entries)await store.put('objects',row);
 await store.put('meta',{key:agendaLinksKey,value:[{connections:[ref,other]}]});
 assert.equal((await store.removalActions([parent,pure],entries)).get(parent.id),'archive');
 assert.equal(await store.removeLocalObject(pure.id),'delete');
 await assert.rejects(store.removeLocalObject(parent.id,{permanent:true}),/Archiveer/);
 assert.equal(await store.removeLocalObject(parent.id),'archive');
 assert.deepEqual(await store.get('objects',card.id),card);
 assert.equal(await store.removeLocalObject(parent.id,{permanent:true}),'delete');
 assert.equal(await store.get('objects',parent.id),undefined);
 assert.deepEqual(await store.get('objects',card.id),{...card,locationId:null});
 assert.deepEqual(await store.get('objects',child.id),{...child,data:{...child.data,parentId:null}});
 assert.equal(await store.get('objects','time'),undefined);
 assert.equal(await store.get('objects','action'),undefined);
 assert.deepEqual((await store.get('meta',agendaLinksKey)).value,[{connections:[other]}]);
});
