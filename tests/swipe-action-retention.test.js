import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {renderObjectStrip} from '../src/ui/ObjectStrip.js';
import {bindSwipeRows} from '../src/ui/SwipeRows.js';

// Touch browsers may dispatch a compatibility click after pointerup. Its timing
// must not determine whether the action tray remains reachable.
test('delayed compatibility click after a swipe preserves archive and delete actions',async()=>{
 const dom=new JSDOM('<main></main>');const container=dom.window.document.querySelector('main');
 container.innerHTML=renderObjectStrip({id:'list',title:'Boodschappen',actions:[{kind:'secondary',label:'Archiveren'},{kind:'delete',label:'Verwijderen'}]});
 let archived=0,deleted=0,opened=0;
 const release=bindSwipeRows(container,{onSecondary:()=>archived++,onDelete:()=>deleted++,onOpen:()=>opened++});
 const surface=container.querySelector('[data-swipe-surface]'),row=surface.parentElement;
 const pointer=(type,x)=>{const e=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:20});surface.dispatchEvent(e);};
 try{
  pointer('pointerdown',220);pointer('pointermove',100);pointer('pointerup',100);
  assert(row.classList.contains('is-actions-open'));
  await new Promise(resolve=>setTimeout(resolve,120));
  surface.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));
  assert(row.classList.contains('is-actions-open'),'the compatibility click must not close the tray');
  container.querySelector('[data-swipe-secondary]').click();assert.equal(archived,1);assert.equal(opened,0);
  pointer('pointerdown',220);pointer('pointermove',100);pointer('pointerup',100);
  container.querySelector('[data-swipe-delete]').click();assert.equal(deleted,1);assert.equal(opened,0);
  pointer('pointerdown',100);pointer('pointerup',100);surface.click();
  assert(!row.classList.contains('is-actions-open'),'a new intentional tap closes the tray');
  pointer('pointerdown',100);pointer('pointerup',100);surface.click();assert.equal(opened,1);
  pointer('pointerdown',220);pointer('pointermove',100);pointer('pointerup',100);
  surface.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter'}));surface.click();
  assert(!row.classList.contains('is-actions-open'),'keyboard activation remains available after a gesture');
 }finally{release();dom.window.close();}
});
