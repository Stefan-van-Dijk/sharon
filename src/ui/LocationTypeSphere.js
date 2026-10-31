import { LOCATION_GROUPS, locationType, locationIcon } from '../core/location/LocationTypeRegistry.js?v=0.4.45';

// Shared spherical taxonomy for first onboarding and location editing.
export function mountLocationTypeSphere(graph, { selectedType = null, onSelect = () => {} } = {}) {
  graph.replaceChildren();
  const sphere = document.createElement('div');
  sphere.className = 'story-sphere-surface';
  const lines = document.createElementNS('http://www.w3.org/2000/svg','svg');
  lines.classList.add('story-sphere-lines');
  lines.setAttribute('viewBox','0 0 1000 1000');
  lines.setAttribute('preserveAspectRatio','none');
  sphere.append(lines);
  graph.append(sphere);
  const phi = Math.PI * (3 - Math.sqrt(5));
  const normalize = p => { const n=Math.hypot(...p);return p.map(v=>v/n); };
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot = (a,b) => a.reduce((v,x,i)=>v+x*b[i],0);
  const nodes = [];
  let active = null, selected = selectedType || null, yaw = .15, pitch = -.12, zoom = 1;
  const makeNode = (label,kind,point,onSelect) => {
    const button = document.createElement('button');
    button.type='button';
    button.className='story-sphere-node story-sphere-'+kind;
    button.textContent=label;
    button.setAttribute('aria-label',label);
    button.addEventListener('click',onSelect);
    sphere.append(button);
    const node={button,point,kind};
    nodes.push(node);
    return node;
  };
  const groups=LOCATION_GROUPS.map((group,i)=>{
    const y=1-(i+.5)*2/LOCATION_GROUPS.length;
    const r=Math.sqrt(1-y*y),a=phi*i*1.7;
    const p=[r*Math.cos(a),y,r*Math.sin(a)];
    const tangent=normalize(cross(p,[0,1,0]));
    const up=normalize(cross(tangent,p));
    const entry={group,point:p,children:[]};
    entry.node=makeNode(group.label,'group',p,()=>{
      active=active===group.id?null:group.id;
      if(!active){selected=null;onSelect(null,null);}
      if(active)orientTo(p);
      render();
    });
    const types=group.types.map(locationType).filter(Boolean);
    types.forEach((type,j)=>{
      const theta=2*Math.PI*j/types.length+(i%2)*.4;
      const spread=types.length===1?.32:.44;
      const childPoint=normalize(p.map((v,k)=>v*Math.cos(spread)+Math.sin(spread)*(tangent[k]*Math.cos(theta)+up[k]*Math.sin(theta))));
      const node=makeNode(locationIcon(type.id),'child',childPoint,()=>{
        const deselect=selected===type.id;
        active=deselect?null:group.id;
        selected=deselect?null:type.id;
        onSelect(selected,selected?type.label:null);
        if(!deselect)orientTo(p);
        render();
      });
      node.type=type;
      const icon = document.createElement('span');
      icon.className='story-sphere-icon';
      icon.textContent=locationIcon(type.id);
      const label=document.createElement('span');
      label.className='story-sphere-label';
      label.textContent=type.label;
      node.button.replaceChildren(icon,label);
      entry.children.push(node);
    });
    return entry;
  });
  function orientTo(p) {
    yaw=Math.atan2(-p[0],p[2]);
    const z=p[2]*Math.cos(yaw)-p[0]*Math.sin(yaw);
    pitch=Math.atan2(p[1],z);
  }
  function project(point) {
    const [x,y,z]=point;
    const xx=x*Math.cos(yaw)+z*Math.sin(yaw);
    const zz=z*Math.cos(yaw)-x*Math.sin(yaw);
    const yy=y*Math.cos(pitch)-zz*Math.sin(pitch);
    const depth=y*Math.sin(pitch)+zz*Math.cos(pitch);
    return {x:xx,y:yy,depth};
  }
  function render() {
    const w=sphere.clientWidth||320,h=sphere.clientHeight||320;
    const radius=Math.min(w,h)*.37*zoom;
    const coords=new Map();
    const focused=groups.find(g=>g.group.id===active);
    for(const entry of groups){
      for(const node of [entry.node,...entry.children]){
        const p=project(node.point);
        const isFocus=entry===focused;
        const size=node.kind==='group'? (isFocus?1.18:focused?.80:1.00) : (isFocus?1.53:focused?.48:.78);
        const depthSize=.78+.22*(p.depth+1)/2;
        const scale=size*depthSize;
        coords.set(node,{x:w/2+p.x*radius,y:h/2-p.y*radius,scale,depth:p.depth,focus:isFocus});
      }
    }
    // Separate projected points without changing their underlying spherical coordinates.
    const all=[...coords.entries()];
    for(let step=0;step<24;step++){
      for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
        const [na,a]=all[i],[nb,b]=all[j];
        const ra=(na.kind==='group'?45:31)*a.scale;
        const rb=(nb.kind==='group'?38:31)*b.scale;
        const min=ra+rb+9;
        let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
        if(dist>=min)continue;
        if(dist<.001){dx=Math.cos(i*2.4+j);dy=Math.sin(i*2.4+j);dist=1;}
        const move=(min-dist)*.52;
        const ux=dx/dist,uy=dy/dist;
        a.x-=ux*move;a.y-=uy*move;b.x+=ux*move;b.y+=uy*move;
      }
      for(const [,p] of all){p.x=Math.max(48,Math.min(w-48,p.x));p.y=Math.max(48,Math.min(h-48,p.y));}
    }
    lines.replaceChildren();
    for(const entry of groups){
      const a=coords.get(entry.node);
      for(const child of entry.children){
        const b=coords.get(child);
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',a.x/w*1000);line.setAttribute('y1',a.y/h*1000);
        line.setAttribute('x2',b.x/w*1000);line.setAttribute('y2',b.y/h*1000);
        line.setAttribute('stroke-opacity',entry===focused?.42:.15);
        lines.append(line);
      }
    }
    for(const [node,p] of all){
      node.button.style.left=p.x+'px';
      node.button.style.top=p.y+'px';
      node.button.style.setProperty('--sphere-scale',p.scale.toFixed(3));
      node.button.style.opacity=String(Math.max(.48,.83+p.depth*.16));
      node.button.style.zIndex=String(Math.round(100+p.depth*20)+(p.focus?40:0));
      node.button.classList.toggle('is-active',node.kind==='group'&&focused?.node===node);
      node.button.classList.toggle('is-selected',node.type?.id===selected);
      node.button.classList.toggle('is-focused',p.focus);
      if(node.kind==='group')node.button.setAttribute('aria-pressed',String(focused?.node===node));
      if(node.kind==='child')node.button.setAttribute('aria-pressed',String(node.type?.id===selected));
      if(node.kind==='child')node.button.title=node.type.label;
    }
  }
  const contacts=new Map();
  let gesture=null,ignoreClick=false;
  graph.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    contacts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    // Pointer capture on the parent steals the synthetic click from node buttons on iOS.
    // Capture only a drag that starts on the empty sphere surface.
    if (!e.target.closest('.story-sphere-node')) graph.setPointerCapture?.(e.pointerId);
    if(contacts.size===1)gesture={x:e.clientX,y:e.clientY,moved:false};
    if(contacts.size===2){
      const [a,b]=[...contacts.values()];
      gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,pinch:true};
    }
  });
  graph.addEventListener('pointermove',e=>{
    if(!contacts.has(e.pointerId))return;
    const prev=contacts.get(e.pointerId);
    contacts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(contacts.size===2){
      const [a,b]=[...contacts.values()];
      if(!gesture?.pinch)gesture={distance:Math.hypot(a.x-b.x,a.y-b.y),zoom,pinch:true};
      zoom=Math.max(.75,Math.min(1.25,gesture.zoom*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,gesture.distance)));
      ignoreClick=true;render();return;
    }
    if(!gesture||gesture.pinch)return;
    if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>7)gesture.moved=true;
    if(!gesture.moved)return;
    ignoreClick=true;
    yaw+=(e.clientX-prev.x)*.008;
    pitch=Math.max(-1.35,Math.min(1.35,pitch+(e.clientY-prev.y)*.008));
    render();
  });
  const finish=e=>{
    contacts.delete(e.pointerId);
    if(contacts.size<2)gesture=null;
    if(ignoreClick)setTimeout(()=>{ignoreClick=false;},120);
  };
  graph.addEventListener('pointerup',finish);
  graph.addEventListener('pointercancel',finish);
  graph.addEventListener('click',e=>{if(ignoreClick){e.preventDefault();e.stopPropagation();}},true);
  if (selected) {
    const initial = groups.find(entry => entry.group.types.includes(selected));
    if (initial) { active = initial.group.id; orientTo(initial.point); }
  }
  render();
  return { refresh: render, get value() { return selected; } };
}
