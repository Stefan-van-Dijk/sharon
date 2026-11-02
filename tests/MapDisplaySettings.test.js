import test from 'node:test';
import assert from 'node:assert/strict';
import { SettingsService } from '../src/core/settings/SettingsService.js';
const store=()=>{
  const data=new Map();
  return {async get(_,key){return data.get(key)},async put(_,record){data.set(record.key,structuredClone(record))}};
};
test('default map display belongs to user settings and is mutable',async()=>{
  const db=store(),bus={emit(){}};
  const a=new SettingsService(db,bus);await a.load();
  assert.deepEqual(a.get().mapDisplay,{showIcons:true,showNames:true,clusterPoints:true,pointSize:5,readStyle:'subtle',likedStyle:'heart'});
  await a.update({mapDisplay:{showIcons:false,pointSize:8}});
  const b=new SettingsService(db,bus);await b.load();
  assert.equal(b.get().mapDisplay.showIcons,false);
  assert.equal(b.get().mapDisplay.pointSize,8);
  assert.equal(b.get().mapDisplay.showNames,true);
});
