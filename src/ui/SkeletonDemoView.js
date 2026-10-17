import { SKELETON_MODULES,demoWorkspace,setDemoEnabled,saveDemoDataset,resetDemoDataset,skeletonCapabilities,applySkeletonAction } from '../core/skeleton/SkeletonCore.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const titles={environment:'Omgeving',locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',rides:'Ritten',tasks:'Tijd/Taken',actions:'Acties'};
export async function mountSkeletonDemo(root,store,{initialModule='cards',fullScreen=false}={}) {
  let {enabled,data}=await demoWorkspace(store),module=initialModule,index=0,expanded=false,boardOpen=false;
  let disposed=false;
  const draw=()=>{
    if(disposed || !root.isConnected) return;
    const list=enabled?data.objects.filter(o=>o.module===module):[];
    const current=list[Math.min(index,Math.max(0,list.length-1))];
    const caps=current?skeletonCapabilities(data,current.id):null;
    root.innerHTML=(fullScreen ? '<section class="module-view sh-skeleton-screen">' : '<div class="sh-skeleton-toggle"><label><input type="checkbox" data-demo-toggle '+(enabled?'checked':'')+'> Testgegevens gebruiken</label>'+
      '<small>Afgescheiden voorbeelden. Je eigen objecten veranderen niet.</small></div>')+
      (enabled?'<div class="sh-skeleton-workspace"><p class="sh-skeleton-label">Skeletproef · fictieve gegevens</p>'+
       (fullScreen ? '' : '<div class="sh-skeleton-modules">'+SKELETON_MODULES.map(m=>'<button type="button" data-demo-module="'+m+'" aria-pressed="'+(m===module)+'">'+titles[m]+'</button>').join('')+'</div>')+
       (fullScreen && boardOpen ? '<button type="button" data-demo-back class="sh-skeleton-back">‹ '+esc(titles[module])+'</button>' : '')+
       (fullScreen && !boardOpen?'<div class="sh-skeleton-object-list" aria-label="Objecten in '+esc(titles[module])+'">'+list.map((object,n)=>'<button type="button" data-demo-select="'+n+'" aria-pressed="'+(n===index)+'"><strong>'+esc(object.title)+'</strong><span>›</span></button>').join('')+'</div>':'')+
       (current && (!fullScreen || boardOpen)?'<div class="sh-skeleton-board">'+
       '<div class="sh-skeleton-boardslide"><button type="button" data-demo-prev aria-label="Vorig object">‹</button><div><small>'+esc(titles[module])+' · '+(index+1)+'/'+list.length+'</small><strong>'+esc(current.title)+'</strong></div><button type="button" data-demo-next aria-label="Volgend object">›</button></div>'+
       '<div class="sh-skeleton-boardbuttons"><button type="button" data-demo-expand aria-expanded="'+expanded+'">'+(expanded?'Compact Board':'Board uitbreiden')+'</button></div>'+
       (expanded?'<div class="sh-skeleton-details"><p>Status: '+esc(current.status)+'</p><p>Relaties: '+caps.related+'</p>'+
       Object.entries(current.fields||{}).map(([k,v])=>'<p>'+esc(k)+': '+esc(v)+'</p>').join('')+'</div>':'')+
       '<div class="sh-skeleton-actions"><button type="button" data-demo-edit>Bewerk naam</button>'+
       (caps.delete?'<button type="button" data-demo-lifecycle="delete">Verwijder</button>':'')+
       (caps.archive?'<button type="button" data-demo-lifecycle="archive">Archiveer</button>':'')+
       (caps.restore?'<button type="button" data-demo-lifecycle="restore">Herstel</button>':'')+
       '</div></div>':'<p>Geen voorbeeldobjecten meer in deze module.</p>')+
       (fullScreen?'':'<button type="button" data-demo-reset>Herstel alle voorbeeldgegevens</button>')+'</div>':'')+(fullScreen?'</section>':'');
    root.querySelector('[data-demo-toggle]')?.addEventListener('change',async e=>{
      ({enabled,data}=await setDemoEnabled(store,e.target.checked));index=0;expanded=false;draw();
    });
    root.querySelector('[data-demo-back]')?.addEventListener('click',()=>{boardOpen=false;expanded=false;draw();});
    root.querySelectorAll('[data-demo-select]').forEach(b=>b.addEventListener('click',()=>{index=Number(b.dataset.demoSelect);boardOpen=true;expanded=false;draw();}));
    root.querySelectorAll('[data-demo-module]').forEach(b=>b.addEventListener('click',()=>{module=b.dataset.demoModule;index=0;expanded=false;boardOpen=false;draw();}));
    root.querySelector('[data-demo-prev]')?.addEventListener('click',()=>{index=(index-1+list.length)%list.length;expanded=false;draw();});
    root.querySelector('[data-demo-next]')?.addEventListener('click',()=>{index=(index+1)%list.length;expanded=false;draw();});
    root.querySelector('[data-demo-expand]')?.addEventListener('click',()=>{expanded=!expanded;draw();});
    root.querySelector('[data-demo-edit]')?.addEventListener('click',async()=>{
      const name=prompt('Nieuwe naam van het voorbeeldobject',current.title);
      if(name===null || !name.trim()) return;
      data.objects.find(o=>o.id===current.id).title=name.trim().slice(0,100);
      await saveDemoDataset(store,data);draw();
    });
    root.querySelectorAll('[data-demo-lifecycle]').forEach(b=>b.addEventListener('click',async()=>{
      const action=b.dataset.demoLifecycle;
      if(!confirm('Alleen testgegevens: '+action+'?'))return;
      data=applySkeletonAction(data,current.id,action);
      await saveDemoDataset(store,data);index=0;expanded=false;draw();
    }));
    root.querySelector('[data-demo-reset]')?.addEventListener('click',async()=>{data=await resetDemoDataset(store);index=0;expanded=false;draw();});
  };
  draw();
  return ()=>{disposed=true;};
}
