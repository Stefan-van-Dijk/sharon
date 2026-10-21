import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatMonitor,chatRefreshDelay} from '../src/core/connection/ChatMonitor.js';
function fixture(){
 let now=0,calls=[],read=0,messages=[],delayed=null;
 const listeners=new Map();
 const doc={hidden:false,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 const contacts=[{chatId:'Chat00000001',personId:'Peer00000001',name:'Gast'}];
 const service={
  device:async()=>({registered:true,personId:'Self00000001',self:{line:1}}),
  contacts:async()=>{calls.push('contacts');return contacts;},
  cachedMessages:async()=>[...messages],
  sync:async id=>{calls.push(id);if(delayed)await delayed;return [...messages];},
  markRead:async(_,shown)=>{read=Math.max(read,...shown.filter(m=>m.senderId!=='Self00000001').map(m=>m.seq),0);},
  unreadState:async()=>({contacts:contacts.map(c=>({...c,unread:messages.filter(m=>m.seq>read&&m.senderId!=='Self00000001').length})),total:messages.filter(m=>m.seq>read&&m.senderId!=='Self00000001').length}),
  resetNetwork:async()=>{messages=[];read=0;}
 };
 const monitor=new ChatMonitor(service,{clock:()=>now,documentObject:doc,setTimer:()=>1,clearTimer:()=>{}});
 return {monitor,calls,doc,service,setNow:n=>{now=n;},receive:()=>messages.push({id:'Message00001',seq:1,delivery:'sent',senderId:'Peer00000001'}),delay:p=>{delayed=p;},visibility:hidden=>{doc.hidden=hidden;listeners.get('visibilitychange')();}};
}
test('chat cadence backs off at one and five minutes and sending restores five seconds',async()=>{
 assert.deepEqual([chatRefreshDelay(0),chatRefreshDelay(59999),chatRefreshDelay(60000),chatRefreshDelay(300000)],[5000,5000,15000,30000]);
 const f=fixture(),m=f.monitor;m.start();
 const leave=m.watchChat('Chat00000001',{onMessages(){}});
 await m.refreshActive();assert.equal(f.calls.length,1);
 f.setNow(4999);await m.tick();assert.equal(f.calls.length,1);
 f.setNow(5000);await m.tick();assert.equal(f.calls.length,2);
 f.setNow(60000);await m.tick();assert.equal(m.nextChat,75000);
 f.setNow(300000);await m.tick();assert.equal(m.nextChat,330000);
 m.activity();await m.refreshActive();assert.equal(m.nextChat,305000);
 leave();m.stop();
});
test('outside Chat the inbox is checked once a minute and opening marks only incoming messages as read',async()=>{
 const f=fixture(),m=f.monitor;m.start();f.receive();
 f.setNow(59999);await m.tick();assert.equal(f.calls.length,0);
 f.setNow(60000);await m.tick();assert.deepEqual(f.calls,['contacts','Chat00000001']);assert.equal(m.state.total,1);
 const leave=m.watchChat('Chat00000001',{onMessages(){}});await m.refreshActive();assert.equal(m.state.total,0);
 leave();f.setNow(119999);await m.tick();assert.equal(f.calls.length,3);
 f.setNow(120000);await m.tick();assert.equal(f.calls.length,5);m.stop();
});
test('a hidden window stops polling, an in-flight reply is not marked read, and returning refreshes immediately',async()=>{
 const f=fixture(),m=f.monitor;m.start();let shown=0;
 m.watchChat('Chat00000001',{onMessages(){shown++;}});f.receive();
 let release;f.delay(new Promise(r=>{release=r;}));
 const refresh=m.refreshActive();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 f.visibility(true);release();await refresh;
 assert.equal(shown,0);await m.refreshUnread();assert.equal(m.state.total,1);
 f.setNow(600000);await m.tick();const before=f.calls.length;
 f.delay(null);f.visibility(false);if(m.flight)await m.flight;
 assert.ok(f.calls.length>before);assert.equal(shown,1);assert.equal(m.state.total,0);m.stop();
});
test('polls never overlap and leaving a chat prevents a late reply from clearing its unread status',async()=>{
 const f=fixture(),m=f.monitor;m.start();let shown=0;
 const leave=m.watchChat('Chat00000001',{onMessages(){shown++;}});f.receive();
 let release;f.delay(new Promise(r=>{release=r;}));
 const refresh=m.refreshActive();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 f.setNow(60000);await m.tick();assert.equal(f.calls.length,1);
 leave();release();await refresh;assert.equal(shown,0);await m.refreshUnread();assert.equal(m.state.total,1);m.stop();
});
