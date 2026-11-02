import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsService } from '../src/core/settings/SettingsService.js';

function memoryStore(initial = null) {
  const items = new Map(initial ? [['app', {key:'app',value:initial}]] : []);
  return {
    async get(table,key) { assert.equal(table,'settings'); return items.get(key); },
    async put(table,record) { assert.equal(table,'settings'); items.set(record.key,structuredClone(record)); }
  };
}
function service(store) {
  return new SettingsService(store, {emit(){}});
}

test('personal map display defaults are available without saved preferences', async () => {
  const settings=service(memoryStore());
  await settings.load();
  assert.deepEqual(settings.get().mapDisplay,{
    showIcons:true,showNames:true,clusterPoints:true,pointSize:5,
    readStyle:'subtle',likedStyle:'heart'
  });
});

test('map preferences persist and do not override other user settings', async () => {
  const store=memoryStore({profile:{name:'Test'},mapDisplay:{showIcons:false,pointSize:9}});
  const settings=service(store);
  await settings.load();
  assert.equal(settings.get().mapDisplay.showIcons,false);
  assert.equal(settings.get().mapDisplay.showNames,true);
  await settings.update({mapDisplay:{likedStyle:'accent',showNames:false}});
  const restored=service(store);
  await restored.load();
  assert.equal(restored.get().profile.name,'Test');
  assert.deepEqual(restored.get().mapDisplay,{
    showIcons:false,showNames:false,clusterPoints:true,pointSize:9,
    readStyle:'subtle',likedStyle:'accent'
  });
});

test('get returns a defensive copy of map preferences',async()=>{
  const settings=service(memoryStore());
  await settings.load();
  settings.get().mapDisplay.pointSize=100;
  assert.equal(settings.get().mapDisplay.pointSize,5);
});
