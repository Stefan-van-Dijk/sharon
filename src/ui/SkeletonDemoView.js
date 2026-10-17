import { IdentifierService } from '../core/ids/IdentifierService.js';
import { renderStrip } from './Strip.js';
import { bindSwipeRows } from './SwipeRows.js';
import { SKELETON_MODULES,demoWorkspace,setDemoEnabled,saveDemoDataset,resetDemoDataset,skeletonCapabilities,applySkeletonAction,addSkeletonObject,renameSkeletonObject } from '../core/skeleton/SkeletonCore.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const titles={environment:'Omgeving',locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',rides:'Ritten',tasks:'Tijd/Taken',actions:'Acties'};
export async function mountSkeletonDemo(root,store,{initialModule='cards',fullScreen=false}={}) {
  let {enabled,data}=await demoWorkspace(store),module=initialModule,index=0,expanded=false,boardOpen=false;
  let disposed=false;
  let unbindRows=null;
  let editingId=null;
  let createOpen=false;
  const draw=()=>{
    if(disposed || !root.isConnected) return;
    unbindRows?.(); unbindRows=null;
    const list=enabled?data.objects.filter(o=>o.module===module):[];
    const current=list[Math.min(index,Math.max(0,list.length-1))];
    const caps=current?skeletonCapabilities(data,current.id):null;
    root.innerHTML=(fullScreen ? '<section class="module-view sh-skeleton-screen">' : '<div class="sh-skeleton-toggle"><label><input type="checkbox" data-demo-toggle '+(enabled?'checked':'')+'> Testgegevens gebruiken</label>'+
      '<small>Afgescheiden voorbeelden. Je eigen objecten veranderen niet.</small></div>')+
      (enabled?'<div class="sh-skeleton-workspace"><p class="sh-skeleton-label">Skeletproef · fictieve gegevens</p>'+
       (fullScreen ? '' : '<div class="sh-skeleton-modules">'+SKELETON_MODULES.map(m=>'<button type="button" data-demo-module="'+m+'" aria-pressed="'+(m===module)+'">'+titles[m]+'</button>').join('')+'</div>')+
       (fullScreen && boardOpen ? '<button type="button" data-demo-back class="sh-skeleton-back">‹ '+esc(titles[module])+'</button>' : '')+
       (fullScreen && !boardOpen ? '<div class="sh-skeleton-toolbar"><button type="button" data-demo-add aria-label="Object toevoegen">+ Toevoegen</button></div>'+
       (createOpen ? '<form data-demo-form class="sh-skeleton-editor"><label>'+ (editingId ? 'Naam aanpassen':'Nieuw object') +'<input name="title" maxlength="100" required autocomplete="off" placeholder="Naam van het object" value="'+esc(editingId ? data.objects.find(o=>o.id===editingId)?.title || '' : '')+'"></label><div><button type="button" data-demo-cancel>Annuleren</button><button type="submit">'+(editingId?'Opslaan':'Toevoegen')+'</button></div></form>' : '')+
       '<div class="sh-skeleton-object-list swipe-list" aria-label="Objecten in '+esc(titles[module])+'">'+list.map(object=>{
        const cap=skeletonCapabilities(data,object.id);
        const operation=cap.archive?'Archiveer':cap.restore?'Herstel':'Verwijder';
        return renderStrip({id:object.id,variant:'location',className:'sh-skeleton-row',title:object.title,
          subtitle:object.status==='archived'?'Gearchiveerd':'',
          actions:[{kind:'edit',label:'Bewerk'},{kind:'delete',label:operation}]});
       }).join('')+'</div>' : '')+
       (current && (!fullScreen || boardOpen)?'<div class="sh-skeleton-board">'+
       '<div class="sh-skeleton-boardslide"><button type="button" data-demo-prev aria-label="Vorig object">‹</button><div><small>'+esc(titles[module])+' · '+(index+1)+'/'+list.length+'</small><strong>'+esc(current.title)+'</strong></div><button type="button" data-demo-next aria-label="Volgend object">›</button></div>'+
       '<div class="sh-skeleton-boardbuttons"><button type="button" data-demo-expand aria-expanded="'+expanded+'">'+(expanded?'Compact Board':'Board uitbreiden')+'</button></div>'+
       (expanded?'<div class="sh-skeleton-details"><p>Status: '+esc(current.status)+'</p><p>Relaties: '+caps.related+'</p>'+
       Object.entries(current.fields||{}).map(([k,v])=>'<p>'+esc(k)+': '+esc(v)+'</p>').join('')+'</div>':'')+
       '</div></div>' : (list.length ? '' : '<p>Geen voorbeeldobjecten meer in deze module.</p>'))+
       (fullScreen?'':'<button type="button" data-demo-reset>Herstel alle voorbeeldgegevens</button>')+'</div>':'')+(fullScreen?'</section>':'');
    root.querySelector('[data-demo-toggle]')?.addEventListener('change',async e=>{
      ({enabled,data}=await setDemoEnabled(store,e.target.checked));index=0;expanded=false;draw();
    });
    root.querySelector('[data-demo-back]')?.addEventListener('click',()=>{boardOpen=false;expanded=false;draw();});
    const listRoot=root.querySelector('.sh-skeleton-object-list');
    if(listRoot) unbindRows=bindSwipeRows(listRoot,{
      onOpen:id=>{index=list.findIndex(o=>o.id===id);boardOpen=true;expanded=false;draw();},
      onEdit:id=>{editingId=id;createOpen=true;draw();root.querySelector('[data-demo-form] input')?.focus();},
      onDelete:async id=>{
        const action=['archive','restore','delete'].find(kind=>{
          try { return skeletonCapabilities(data,id)?.[kind]; } catch {return false;}
        });
        if(!action)return;
        const labels={archive:'archiveren',restore:'herstellen',delete:'verwijderen'};
        if(!confirm('Testobject '+labels[action]+'?'))return;
        try {data=applySkeletonAction(data,id,action);await saveDemoDataset(store,data);draw();}
        catch(error){alert(error.message);}
      }
    });
    root.querySelector('[data-demo-add]')?.addEventListener('click',()=>{editingId=null;createOpen=true;draw();root.querySelector('[data-demo-form] input')?.focus();});
    root.querySelector('[data-demo-cancel]')?.addEventListener('click',()=>{editingId=null;createOpen=false;draw();});
    root.querySelector('[data-demo-form]')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const title=event.currentTarget.elements.title.value.trim();
      if(!title)return;
      try {
        data=editingId ? renameSkeletonObject(data,editingId,title) :
          addSkeletonObject(data,{id:IdentifierService.create(),module,title});
        await saveDemoDataset(store,data);editingId=null;createOpen=false;draw();
      } catch(error) {alert(error.message);}
    });
    root.querySelectorAll('[data-demo-module]').forEach(b=>b.addEventListener('click',()=>{module=b.dataset.demoModule;index=0;expanded=false;boardOpen=false;draw();}));
    root.querySelector('[data-demo-prev]')?.addEventListener('click',()=>{index=(index-1+list.length)%list.length;expanded=false;draw();});
    root.querySelector('[data-demo-next]')?.addEventListener('click',()=>{index=(index+1)%list.length;expanded=false;draw();});
    root.querySelector('[data-demo-expand]')?.addEventListener('click',()=>{expanded=!expanded;draw();});
    root.querySelector('[data-demo-reset]')?.addEventListener('click',async()=>{data=await resetDemoDataset(store);index=0;expanded=false;draw();});
  };
  draw();
  return ()=>{disposed=true;unbindRows?.();};
}
