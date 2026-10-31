import { renderListControls, bindListControls, renderOrderControls } from './ListControls.js?v=0.4.44';
import { sortList, moveInOrder, moveToPosition } from '../core/storage/ListOrder.js?v=0.4.44';
import { suggestConnections, CONTEXT_CASES } from '../core/skeleton/ContextSuggestions.js?v=0.4.44';
import {RELATION_TYPES,graphConnections,graphNeighborhood,addGraphRelation,removeGraphRelation} from '../core/skeleton/GraphService.js?v=0.4.44';
import { IdentifierService } from '../core/ids/IdentifierService.js?v=0.4.44';
import { renderObjectStrip } from './ObjectStrip.js?v=0.4.44';
import { bindSwipeRows } from './SwipeRows.js?v=0.4.44';
import { SKELETON_MODULES,demoWorkspace,setDemoEnabled,saveDemoDataset,resetDemoDataset,skeletonCapabilities,applySkeletonAction,addSkeletonObject,renameSkeletonObject } from '../core/skeleton/SkeletonCore.js?v=0.4.44';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const titles={environment:'Omgeving',locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',rides:'Ritten',tasks:'Tijd/Taken',actions:'Acties'};
export async function mountSkeletonDemo(root,store,{initialModule='cards',fullScreen=false,onTitleChange=()=>{}}={}) {
  let {enabled,data}=await demoWorkspace(store),module=initialModule,index=0,expanded=false,boardOpen=false;
  const listPrefs=(await store.get('meta','skeleton.list.preferences'))?.value || {};
  const queries={};
  const objectsFor=kind=>sortList(data.objects.filter(object=>object.module===kind),listPrefs[kind]||{});
  let disposed=false;
  let unbindRows=null;
  let releaseOrder=null;
  let editingId=null;
  let createOpen=false;
  let relationEditId=null;
  let contextCase='from-object';
  let contextFocus='';
  let connectionQuery='';
  let chosenTarget='';
  const objectHistory=[];
  const stepBack=()=>{
    if(createOpen){createOpen=false;editingId=null;draw();return true;}
    if(expanded){expanded=false;draw();return true;}
    if(objectHistory.length){const previous=objectHistory.pop();module=previous.module;index=previous.index;boardOpen=previous.boardOpen;expanded=previous.expanded;draw();return true;}
    if(boardOpen){boardOpen=false;draw();return true;}
    return false;
  };
  const onNavigateBack=event=>{if(stepBack())event.preventDefault();};
  root.addEventListener('sharon:navigate-back',onNavigateBack,true);
  const draw=()=>{
    if(disposed || !root.isConnected) return;
    releaseOrder?.();releaseOrder=null;
    unbindRows?.(); unbindRows=null;
    if(fullScreen)onTitleChange(titles[module]);
    const list=enabled?objectsFor(module):[];
    const preference=listPrefs[module]||{sort:'alpha',order:[]};
    const current=list[Math.min(index,Math.max(0,list.length-1))];
    const caps=current?skeletonCapabilities(data,current.id):null;
    const links=current?graphConnections(data,current.id):[];
    root.innerHTML=(fullScreen ? '<section class="module-view sh-skeleton-screen">' : '<div class="sh-skeleton-toggle"><label><input type="checkbox" data-demo-toggle '+(enabled?'checked':'')+'> Testgegevens gebruiken</label>'+
      '<small>Afgescheiden voorbeelden. Je eigen objecten veranderen niet.</small></div>')+
      (enabled?'<div class="sh-skeleton-workspace"><p class="sh-skeleton-label">Skeletproef · fictieve gegevens</p>'+
       (fullScreen ? '' : '<div class="sh-skeleton-modules">'+SKELETON_MODULES.map(m=>'<button type="button" data-demo-module="'+m+'" aria-pressed="'+(m===module)+'">'+titles[m]+'</button>').join('')+'</div>')+
       (fullScreen && boardOpen ? '<button type="button" data-demo-back class="sh-skeleton-back">‹ '+esc(titles[module])+'</button>' : '')+
       (fullScreen && !boardOpen ? '<div class="sh-skeleton-toolbar"><button type="button" data-demo-add aria-label="Object toevoegen">+ Toevoegen</button></div>'+
       (createOpen ? '<form data-demo-form class="sh-skeleton-editor"><label>'+ (editingId ? 'Naam aanpassen':'Nieuw object') +'<input name="title" maxlength="100" required autocomplete="off" placeholder="Naam van het object" value="'+esc(editingId ? data.objects.find(o=>o.id===editingId)?.title || '' : '')+'"></label><div><button type="button" data-demo-cancel>Annuleren</button><button type="submit">'+(editingId?'Opslaan':'Toevoegen')+'</button></div></form>' : '')+
       (editingId ? '<div class="sh-skeleton-graph-edit"><strong>Extra informatie bij '+esc(data.objects.find(o=>o.id===editingId)?.title)+'</strong>'+
       graphConnections(data,editingId).map(link=>'<div class="sh-skeleton-graph-link"><span>'+esc(link.target.title)+' · '+esc(link.label)+'</span><button type="button" data-graph-remove="'+esc(link.relationId)+'" aria-label="Relatie verwijderen">×</button></div>').join('')+
       '<form data-graph-add class="sh-context-connect"><strong>Verbinden</strong><small>Kies wat hierbij hoort. Je kunt dit ook later doen.</small>'+
       '<label>Zoek iemand, een plek of een voorwerp<input data-context-search type="search" placeholder="Begin met typen…" value="'+esc(connectionQuery)+'" autocomplete="off"></label>'+
       '<div data-context-results></div><p data-context-relation class="sh-context-relation" hidden></p>'+
       '<input name="predicate" type="hidden" value="related-to">'+
       '<input name="to" type="hidden" value="'+esc(chosenTarget)+'"><button type="submit" '+(!chosenTarget?'disabled':'')+'>Verbinding bevestigen</button></form></div>' : '')+
       (!boardOpen ? renderListControls({placeholder:'Zoek in '+titles[module],query:queries[module]||'',sort:preference.sort}) : '')+
       '<div class="sh-skeleton-object-list swipe-list" aria-label="Objecten in '+esc(titles[module])+'">'+
       (list.length<3 && !boardOpen ? '<button type="button" class="sh-module-example" data-module-example><span>Voorbeeld · '+esc(titles[module])+'</span><small>Zo ontdek je wat je hier kunt vastleggen en verbinden</small></button><p class="sh-module-example-guide" data-example-copy hidden>Maak een '+esc(titles[module]).toLowerCase()+' aan zonder verplichte koppelingen. Verbind later met andere modules.</p>' : '')+
       list.map(object=>{
        const cap=skeletonCapabilities(data,object.id);
        const operation=cap.archive?'Archiveer':cap.restore?'Herstel':'Verwijder';
        return '<div data-list-item>'+renderObjectStrip({id:object.id,module,className:'sh-skeleton-row',title:object.title,
          accentColor:object.fields?.color || object.color,
          subtitle:object.status==='archived'?'Gearchiveerd':'',
          actions:[{kind:'edit',label:'Bewerk'},{kind:'delete',label:operation}]})+(preference.sort==='custom'?renderOrderControls(object.id):'')+'</div>';
       }).join('')+'</div>' : '')+
       (current && (!fullScreen || boardOpen)?'<div class="sh-skeleton-board">'+
       '<div class="sh-skeleton-boardslide"><button type="button" data-demo-prev aria-label="Vorig object">‹</button><div><small>'+esc(titles[module])+'</small><strong>'+esc(current.title)+'</strong></div><button type="button" data-demo-next aria-label="Volgend object">›</button></div>'+
       '<div class="sh-skeleton-boardbuttons"><button type="button" data-demo-expand aria-expanded="'+expanded+'">'+(expanded?'Compact Board':'Board uitbreiden')+'</button></div>'+
       (expanded?'<div class="sh-skeleton-details"><p>Status: '+esc(current.status)+'</p><h3>Relaties</h3>'+
       (links.length?[...new Set(links.map(link=>link.target.module))].map(kind=>'<h4 class="sh-related-heading">'+esc(titles[kind]||kind)+'</h4>'+links.filter(link=>link.target.module===kind).map(link=>'<button type="button" class="sh-skeleton-relation" data-demo-relation="'+esc(link.target.id)+'"><strong>'+esc(link.target.title)+'</strong><span>'+esc(link.label)+'</span></button>').join('')).join(''):'<p>Geen gekoppelde objecten</p>')+
       Object.entries(current.fields||{}).map(([k,v])=>'<p>'+esc(k)+': '+esc(v)+'</p>').join('')+'</div>':'')+
       '</div>' : (list.length ? '' : '<p>Geen voorbeeldobjecten meer in deze module.</p>'))+
       (fullScreen?'':'<button type="button" data-demo-reset>Herstel alle voorbeeldgegevens</button>')+'</div>':'')+(fullScreen?'</section>':'');
    const applySearch=()=>{
      const query=(queries[module]||'').trim().toLocaleLowerCase('nl');
      root.querySelectorAll('.sh-skeleton-object-list [data-swipe-row]').forEach(row=>{
        const object=data.objects.find(item=>item.id===row.dataset.swipeRow);
        row.closest('[data-list-item]').hidden=Boolean(query)&&!String(object?.title||'').toLocaleLowerCase('nl').includes(query);
      });
    };
    applySearch();
    releaseOrder=bindListControls(root,{
      onSearch:value=>{queries[module]=value;applySearch();},
      onSort:async sort=>{
        listPrefs[module]={...preference,sort,order:sort==='custom'&&!preference.order?.length?list.map(item=>item.id):preference.order};
        await store.put('meta',{key:'skeleton.list.preferences',value:listPrefs});index=0;draw();
      },
      onMoveTo:async(id,targetId,after)=>{
        listPrefs[module]={...preference,order:moveToPosition(list.map(item=>item.id),id,targetId,after)};
        await store.put('meta',{key:'skeleton.list.preferences',value:listPrefs});draw();
      },
      onMove:async(id,direction)=>{
        listPrefs[module]={...preference,order:moveInOrder(list.map(item=>item.id),id,direction)};
        await store.put('meta',{key:'skeleton.list.preferences',value:listPrefs});draw();
      }
    });
    const example = root.querySelector('[data-module-example]');
    const exampleCopy = root.querySelector('[data-example-copy]');
    if(example && exampleCopy) {
      let down=null;
      const toggle=()=>{ exampleCopy.hidden = !exampleCopy.hidden; };
      example.addEventListener('click',toggle);
      example.addEventListener('touchstart',e=>{down={x:e.touches[0].clientX,y:e.touches[0].clientY};},{passive:true});
      example.addEventListener('touchend',e=>{
        if(!down)return;
        const dx=e.changedTouches[0].clientX-down.x,dy=e.changedTouches[0].clientY-down.y;
        down=null;
        if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3){e.preventDefault();toggle();}
      },{passive:false});
    }
    root.querySelector('[data-demo-toggle]')?.addEventListener('change',async e=>{
      ({enabled,data}=await setDemoEnabled(store,e.target.checked));index=0;expanded=false;draw();
    });
    // Downward gesture closes the Board completely; horizontal Back retains navigation history.
    const board=root.querySelector('.sh-skeleton-board');
    let boardTouch=null;
    board?.addEventListener('touchstart',event=>{
      if(event.touches.length!==1)return;
      boardTouch={x:event.touches[0].clientX,y:event.touches[0].clientY};
    },{passive:true});
    board?.addEventListener('touchend',event=>{
      if(!boardTouch || event.changedTouches.length!==1)return;
      const dx=event.changedTouches[0].clientX-boardTouch.x;
      const dy=event.changedTouches[0].clientY-boardTouch.y;
      boardTouch=null;
      if(dy>70 && Math.abs(dy)>Math.abs(dx)*1.4){
        expanded=false;boardOpen=false;objectHistory.length=0;draw();
      }
    },{passive:true});
    board?.addEventListener('touchcancel',()=>{boardTouch=null;});
    root.querySelector('[data-demo-back]')?.addEventListener('click',stepBack);
    root.querySelectorAll('[data-demo-relation]').forEach(button=>button.addEventListener('click',()=>{
      const target=data.objects.find(o=>o.id===button.dataset.demoRelation);
      if(!target)return;
      objectHistory.push({module,index,boardOpen,expanded});
      module=target.module;index=objectsFor(module).findIndex(o=>o.id===target.id);
      expanded=false;boardOpen=true;draw();
    }));
    const listRoot=root.querySelector('.sh-skeleton-object-list');
    if(listRoot) unbindRows=bindSwipeRows(listRoot,{
      onOpen:id=>{index=list.findIndex(o=>o.id===id);boardOpen=true;expanded=false;draw();},
      onEdit:id=>{editingId=id;createOpen=true;contextCase='from-object';contextFocus='';connectionQuery='';chosenTarget='';draw();root.querySelector('[data-demo-form] input')?.focus();},
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
    root.querySelectorAll('[data-graph-remove]').forEach(button=>button.addEventListener('click',async()=>{
      try{data=removeGraphRelation(data,button.dataset.graphRemove);await saveDemoDataset(store,data);draw();}
      catch(error){alert(error.message);}
    }));
    const connectionForm=root.querySelector('[data-graph-add]');
    if(connectionForm) {
      const paint=()=>{
        const results=suggestConnections(data,editingId,{search:connectionQuery}).filter(r=>!r.linked).slice(0,12);
        const box=connectionForm.querySelector('[data-context-results]');
        if(!results.some(r=>r.object.id===chosenTarget))chosenTarget='';
        box.innerHTML=results.map(r=>'<button type="button" class="sh-context-result" data-connect-target="'+esc(r.object.id)+'" aria-pressed="'+(chosenTarget===r.object.id)+'"><strong>'+esc(r.object.title)+'</strong><small>'+esc(titles[r.object.module]||r.object.module)+' · '+(r.linked?'Al verbonden':esc(r.reason))+'</small></button>').join('') || '<p>Geen bestaande onderdelen gevonden.</p>';
        box.querySelectorAll('[data-connect-target]').forEach(b=>b.addEventListener('click',()=>{
          chosenTarget=b.dataset.connectTarget;
          const selected=results.find(r=>r.object.id===chosenTarget);
          connectionForm.elements.to.value=chosenTarget;
          connectionForm.elements.predicate.value=selected?.predicate || 'related-to';
          const relation=connectionForm.querySelector('[data-context-relation]');
          relation.hidden=false;
          relation.textContent='Koppeling: '+(RELATION_TYPES[selected?.predicate]?.label || 'is verbonden met')+' '+selected.object.title;
          connectionForm.querySelector('[type=submit]').disabled=false;
          paint();
        }));
        connectionForm.elements.to.value=chosenTarget;
        connectionForm.querySelector('[data-context-relation]').hidden=!chosenTarget;
        connectionForm.querySelector('[type=submit]').disabled=!chosenTarget;
      };
      connectionForm.querySelector('[data-context-search]').addEventListener('input',e=>{
        connectionQuery=e.target.value;paint();
      });
      paint();
    }
    root.querySelector('[data-graph-add]')?.addEventListener('submit',async event=>{
      event.preventDefault();const fields=new FormData(event.currentTarget);
      try {
        data=addGraphRelation(data,{id:IdentifierService.create(),from:editingId,to:String(fields.get('to')),type:String(fields.get('predicate'))});
        await saveDemoDataset(store,data);draw();
      } catch(error){alert(error.message);}
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
  return ()=>{disposed=true;unbindRows?.();releaseOrder?.();root.removeEventListener('sharon:navigate-back',onNavigateBack,true);};
}
