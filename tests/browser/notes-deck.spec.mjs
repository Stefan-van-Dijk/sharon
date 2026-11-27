import {test,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';
let server,base;
const root=resolve('.');
const styles=readFileSync('index.html','utf8').match(/<style>([\s\S]*?)<\/style>/)[1];
test.beforeAll(async()=>{
 server=createServer((req,res)=>{
  const name=new URL(req.url,'http://local').pathname;
  if(name==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main></main>');return;}
  const file=resolve(root,'.'+name);
  if(!file.startsWith(root+sep)||!existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type','text/javascript');res.end(readFileSync(file));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
});
test.afterAll(async()=>{if(server)await new Promise(r=>server.close(r));});
test('notes deck is sized, draggable and expands to viewport before returning to swipe navigation',async({page})=>{
 await page.goto(base+'/fixture.html');await page.addStyleTag({content:styles});
 await page.evaluate(async()=>{
  const {openNotesDeck}=await import('/src/ui/NotesDeck.js');
  const metadata=new Map();
  window.stopNotes=openNotesDeck({items:()=>[{id:'one',title:'Eerste notitie'},{id:'two',title:'Tweede lijst',linked:true}],id:'one',store:{get:async(_,key)=>metadata.get(key),put:async(_,record)=>metadata.set(record.key,record)},render:(row,{body})=>{body.textContent=(row.title+'\n').repeat(100);}});
 });
 const surface=page.locator('.sh-notes-deck .sh-notes-board'),heading=surface.locator('h2'),grab=surface.locator('[data-deck-grab]');
 await expect(surface).toBeVisible();await expect(grab).toBeVisible();
 const rect=await surface.boundingBox(),viewport=page.viewportSize();expect(rect.width).toBeGreaterThan(250);expect(rect.height).toBeGreaterThan(250);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.y+rect.height).toBeLessThanOrEqual(viewport.height);
 expect(await grab.evaluate(el=>getComputedStyle(el).touchAction)).toBe('none');
 const g=await grab.boundingBox();await page.mouse.move(g.x+g.width/2,g.y+g.height/2);await page.mouse.down();await page.mouse.move(g.x+g.width/2+40,g.y+g.height/2,{steps:5});
 await expect(page.locator('.is-card-deck-lifted')).toBeVisible();await page.mouse.move(g.x+g.width/2+40,g.y+g.height/2-40,{steps:5});await page.mouse.up();
 const moved=await surface.boundingBox();expect(moved.y).toBeLessThan(rect.y-20);
 await surface.locator('[data-notes-fullscreen]').click();await expect(page.locator('.sh-notes-deck')).toHaveClass(/is-fullscreen/);
 const full=await surface.boundingBox();expect(full.x).toBeCloseTo(0,0);expect(full.y).toBeCloseTo(0,0);expect(full.width).toBeCloseTo(viewport.width,0);expect(full.height).toBeCloseTo(viewport.height,0);
 async function swipeHeading(){const h=await heading.boundingBox();await page.mouse.move(h.x+h.width*.8,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width*.2,h.y+h.height/2,{steps:8});await page.mouse.up();}
 await swipeHeading();await expect(heading).toHaveText('Eerste notitie');
 await surface.locator('[data-notes-fullscreen]').click();await swipeHeading();await expect(heading).toHaveText('Tweede lijst');
 await page.evaluate(()=>window.stopNotes());await expect(surface).toHaveCount(0);
});
test('archive recovery follows the items and restores a saved note',async({page})=>{
 await page.goto(base+'/fixture.html');await page.addStyleTag({content:styles});
 await page.evaluate(async()=>{
  const {openNotesView}=await import('/src/ui/NotesView.js');
  const records=new Map([['old',{id:'old',type:'note',name:'Oude notitie',archivedAt:123,data:{body:'Bewaard'}}]]);
  window.stopNotes=await openNotesView(document.querySelector('main'),{store:{get:async()=>undefined,getAll:async()=>[...records.values()],put:async(_,record)=>records.set(record.id,record)},api:{index:async()=>({lists:[]})}});
 });
 const slot=page.locator('.sh-notes-archive-slot');
 await expect(slot).toBeVisible();await expect(page.locator('[data-notes-mode]')).toHaveCount(0);
 const rows=await page.locator('.swipe-list').boundingBox(),archive=await slot.boundingBox();expect(archive.y).toBeGreaterThanOrEqual(rows.y+rows.height);
 await page.locator('[data-notes-archive]').click();
 await page.locator('[data-swipe-surface]').click();await page.getByRole('dialog').getByRole('button',{name:'Terugzetten',exact:true}).click();
 await expect(slot).toBeHidden();await expect(page.locator('.swipe-list')).toContainText('Oude notitie');await expect(page.locator('dialog')).toHaveCount(0);
});

test('embedded Shop fills the screen behind the Sharon logo and restores the board on return',async({page})=>{
 await page.goto(base+'/fixture.html');await page.addStyleTag({content:styles});
 await page.evaluate(async()=>{
  const {openNotesDeck}=await import('/src/ui/NotesDeck.js');const metadata=new Map();
  window.stopNotes=openNotesDeck({items:()=>[{id:'shop',title:'Deze week',linked:true}],id:'shop',store:{get:async(_,key)=>metadata.get(key),put:async(_,record)=>metadata.set(record.key,record)},render:(_, {body,fullscreen})=>{
   if(fullscreen){const frame=document.createElement('iframe');frame.className='sh-shop-app';frame.title='ShopList';frame.srcdoc='<h1>ShopList</h1><p>Deze week</p>';body.append(frame);}else body.textContent='Bewaarde lijst';
  }});
 });
 const board=page.locator('.sh-notes-board'),toggle=board.locator('[data-notes-fullscreen]');
 const before=await board.boundingBox();await expect(toggle).toBeHidden();await board.locator('.sh-notes-app-source').click();
 const frame=await page.locator('.sh-shop-app').boundingBox(),viewport=page.viewportSize();
 expect(frame.x).toBeCloseTo(0,0);expect(frame.y).toBeCloseTo(0,0);
 expect(frame.width).toBeCloseTo(viewport.width,0);expect(frame.height).toBeCloseTo(viewport.height,0);
 await expect(toggle).toHaveAccessibleName('Terug naar Sharon');
 await expect(toggle.locator('img')).toBeVisible();
 const logo=await toggle.boundingBox();
 expect(logo.x).toBeLessThanOrEqual(16);expect(logo.y).toBeLessThanOrEqual(16);
 await expect(board.locator('.sh-notes-app-source')).toBeHidden();
 await toggle.click();await expect(page.locator('.sh-shop-app')).toHaveCount(0);
 await expect.poll(async()=>Math.abs((await board.boundingBox()).height-before.height)).toBeLessThan(2);
});
