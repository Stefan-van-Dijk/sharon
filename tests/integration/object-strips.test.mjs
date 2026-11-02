import test from 'node:test';
import assert from 'node:assert/strict';
import {appHarness,until} from '../helpers/app-harness.mjs';
function pointer(app,target,type,x,y=200){
  const event=new app.window.Event(type,{bubbles:true,cancelable:true});
  Object.assign(event,{pointerId:1,pointerType:'touch',button:0,clientX:x,clientY:y});target.dispatchEvent(event);return event;
}
function swipe(app,row,left=true){
  const surface=row.querySelector('[data-swipe-surface]');
  pointer(app,surface,'pointerdown',left?300:100);pointer(app,surface,'pointermove',left?100:300);pointer(app,surface,'pointerup',left?100:300);
}
test('all object modules share the Cards strip and swipe semantics; rebinding cleans up',async t=>{
  const app=await appHarness();let stop;t.after(()=>{stop?.();app.close();});
  const {renderObjectStrip}=await app.load('./src/ui/ObjectStrip.js');
  const {bindSwipeRows}=await app.load('./src/ui/SwipeRows.js');
  const root=app.document.createElement('div');app.document.body.append(root);
  const modules=['cards','locations','persons','objects','rides','tasks','actions','environment'];
  root.innerHTML=modules.map(module=>renderObjectStrip({id:module,module,title:module})).join('');
  const actions=[];const options={onOpen:id=>actions.push('open:'+id),onEdit:id=>actions.push('edit:'+id),onDelete:id=>actions.push('delete:'+id)};
  stop=bindSwipeRows(root,options);
  for(const module of modules){
    const row=root.querySelector(`[data-swipe-row="${module}"]`),surface=row.querySelector('[data-swipe-surface]');
    assert.ok(row.classList.contains('sh-strip--accent'));assert.ok(row.querySelector('.sh-strip-icon svg'));
    surface.click();assert.equal(actions.at(-1),'open:'+module);
    swipe(app,row);assert.ok(row.classList.contains('is-actions-open'));
    const count=actions.length;surface.click();assert.equal(actions.length,count);assert.equal(row.classList.contains('is-actions-open'),true,'synthetic click after swipe is ignored');
    // Let the swipe click guard expire before testing a fresh interaction.
    await new Promise(resolve=>setTimeout(resolve,15));
    surface.click();assert.equal(row.classList.contains('is-actions-open'),false);
    swipe(app,row);row.querySelector('[data-swipe-edit]').click();assert.equal(actions.at(-1),'edit:'+module);
    row.querySelector('[data-swipe-delete]').click();assert.equal(actions.at(-1),'delete:'+module);
  }
  const first=root.querySelector('[data-swipe-row]'),surface=first.querySelector('[data-swipe-surface]');
  swipe(app,first);const second=root.querySelectorAll('[data-swipe-row]')[1];swipe(app,second);
  assert.equal(first.classList.contains('is-actions-open'),false);assert.ok(second.classList.contains('is-actions-open'));
  swipe(app,second,false);assert.equal(second.classList.contains('is-actions-open'),false);
  pointer(app,surface,'pointerdown',300);pointer(app,surface,'pointermove',150);pointer(app,surface,'pointercancel',150);
  assert.equal(first.classList.contains('is-actions-open'),false);
  pointer(app,surface,'pointerdown',100);const right=pointer(app,surface,'pointermove',230);pointer(app,surface,'pointerup',230);
  assert.equal(right.defaultPrevented,false,'closed strip leaves rightward navigation alone');
  pointer(app,surface,'pointerdown',200);const vertical=pointer(app,surface,'pointermove',205,300);pointer(app,surface,'pointerup',205,300);
  assert.equal(vertical.defaultPrevented,false,'vertical scrolling remains native');
  stop();stop=bindSwipeRows(root,options);const before=actions.length;surface.click();assert.equal(actions.length,before+1);
  stop();const after=actions.length;surface.click();assert.equal(actions.length,after);
  assert.deepEqual(app.errors,[]);
});

test('location strip edits directly and keeps nested locations and drag handles',async t=>{
  const app=await appHarness();t.after(()=>app.close());
  await app.store.put('objects',{id:'StripParent1',type:'location',data:{title:'Centrum',color:'#aa5500'}});
  await app.store.put('objects',{id:'StripChild01',type:'location',data:{title:'Winkel',parentId:'StripParent1'}});
  await app.boot();(await until(()=>app.document.querySelector('[data-module="locations"]'))).click();
  const row=await until(()=>app.document.querySelector('[data-swipe-row="StripChild01"]'));
  assert.ok(row.classList.contains('sh-object-strip'));assert.ok(row.querySelector('.sh-strip-icon'));
  assert.equal(app.document.querySelector('[data-swipe-row="StripParent1"] [data-swipe-surface]').style.getPropertyValue('--strip-accent'),'#aa5500');
  swipe(app,row);assert.ok(row.classList.contains('is-actions-open'));row.querySelector('[data-swipe-edit]').click();
  const form=await until(()=>app.document.querySelector('[data-location-form]'));
  assert.equal(form.elements.title.value,'Winkel');
  assert.equal((await app.store.get('objects','StripChild01')).data.parentId,'StripParent1');
  assert.deepEqual(app.errors,[]);
});
