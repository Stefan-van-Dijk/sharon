import {demoWorkspace} from '../core/skeleton/SkeletonCore.js?v=0.3.82';
import {graphConnections} from '../core/skeleton/GraphService.js?v=0.3.82';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const moduleNames={environment:'Omgeving',locations:'Locaties',cards:'Kaarten',persons:'Personen',objects:'Objecten',rides:'Ritten',tasks:'Tijd/Taken',actions:'Acties'};
export async function mountGraphInspector(host,store){
  const {enabled,data}=await demoWorkspace(store);
  if(!host.isConnected)return;
  if(!enabled){
    host.textContent='De graphinspectie is alleen beschikbaar in de testomgeving.';
    return;
  }
  let selected=data.objects[0]?.id||'';
  function draw(){
    const object=data.objects.find(o=>o.id===selected);
    const connections=object?graphConnections(data,object.id):[];
    host.innerHTML='<div class="sh-graph-inspector"><label>Object<select data-graph-object>'+
      data.objects.map(item=>'<option value="'+escapeHtml(item.id)+'" '+(item.id===selected?'selected':'')+'>'+escapeHtml(item.title)+' · '+escapeHtml(moduleNames[item.module]||item.module)+'</option>').join('')+
      '</select></label>'+
      (object?'<div class="sh-graph-summary"><strong>'+escapeHtml(object.title)+'</strong><small>'+escapeHtml(moduleNames[object.module]||object.module)+' · '+connections.length+' relaties</small><small>ID: '+escapeHtml(object.id)+'</small></div>'+
      '<div class="sh-graph-links">'+(connections.length?connections.map(link=>'<div class="sh-graph-connection"><span>'+escapeHtml(link.label)+' → <strong>'+escapeHtml(link.target.title)+'</strong><small>'+escapeHtml(moduleNames[link.target.module]||link.target.module)+'</small></span><button type="button" data-graph-jump="'+escapeHtml(link.target.id)+'" aria-label="Bekijk '+escapeHtml(link.target.title)+'">›</button></div>').join(''):'<p>Geen gekoppelde objecten.</p>')+'</div>':'')+
      '<small class="sh-graph-inspector-note">Alleen bekijken · uitsluitend testgegevens</small></div>';
    host.querySelector('[data-graph-object]')?.addEventListener('change',event=>{selected=event.target.value;draw();});
    host.querySelectorAll('[data-graph-jump]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.graphJump;draw();}));
  }
  draw();
}
