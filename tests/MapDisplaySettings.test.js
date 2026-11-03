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
  assert.deepEqual(a.get().mapDisplay,{showIcons:true,showNames:true,clusterPoints:true,pointSize:5,iconSize:20,nameSize:12,showPoints:true,readStyle:'transparent',likedStyle:'red-border'});
  await a.update({mapDisplay:{showIcons:false,pointSize:8,iconSize:26,nameSize:16,showPoints:false}});
  const b=new SettingsService(db,bus);await b.load();
  assert.equal(b.get().mapDisplay.showIcons,false);
  assert.equal(b.get().mapDisplay.pointSize,8);
  assert.equal(b.get().mapDisplay.showNames,true);
  assert.equal(b.get().mapDisplay.iconSize,26);
  assert.equal(b.get().mapDisplay.nameSize,16);
  assert.equal(b.get().mapDisplay.showPoints,false);
});
