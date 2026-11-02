// Converts opt-in local Sharon objects to map-only geometry.
// No private object payloads, notes, tracks or sharing secrets leave IndexedDB.
const GEO_TYPES = new Set(['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon']);
const MAX_VERTICES_PER_OBJECT = 10000;

function coordinatePair(input) {
  if (!Array.isArray(input) || input.length < 2 ||
      input[0] == null || input[1] == null || input[0] === '' || input[1] === '') return null;
  const lng = Number(input[0]);
  const lat = Number(input[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) ||
      lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function countAndValidateCoordinates(value, depth, state) {
  if (depth === 0) {
    state.vertices++;
    return state.vertices <= MAX_VERTICES_PER_OBJECT && Boolean(coordinatePair(value));
  }
  return Array.isArray(value) && value.length > 0 &&
    value.every(child => countAndValidateCoordinates(child, depth - 1, state));
}

export function validMapGeometry(geometry) {
  if (!geometry || !GEO_TYPES.has(geometry.type)) return false;
  const depth = {
    Point: 0, MultiPoint: 1, LineString: 1,
    MultiLineString: 2, Polygon: 2, MultiPolygon: 3
  }[geometry.type];
  if (!countAndValidateCoordinates(geometry.coordinates, depth, { vertices: 0 })) return false;
  if (geometry.type === 'LineString' && geometry.coordinates.length < 2) return false;
  if (geometry.type === 'Polygon' && !geometry.coordinates.every(ring => ring.length >= 4)) return false;
  return true;
}

function pointForObject(item) {
  const coord = item.data?.coordinates || item.coordinates;
  if (!coord || coord.lng == null || coord.lat == null ||
      coord.lng === '' || coord.lat === '') return null;
  const pair = coordinatePair([coord.lng, coord.lat]);
  return pair ? { type: 'Point', coordinates: pair } : null;
}

export function environmentFeatureForObject(item) {
  if (!item || item.deletedAt || !item.id) return null;
  const location = item.type === 'location';
  const mapObject = item.data?.environment?.visible === true || item.data?.showOnMap === true;
  if (!location && !mapObject) return null;

  const candidate = item.data?.environment?.geometry ||
    item.data?.geometry || item.data?.geojson?.geometry;
  const geometry = validMapGeometry(candidate) ? candidate :
    location ? pointForObject(item) : null;
  if (!geometry || !validMapGeometry(geometry)) return null;

  const presentation = item.data?.environment || {};
  const color = /^#[0-9a-f]{6}$/i.test(presentation.color) ? presentation.color : '#262629';
  const opacity = typeof presentation.opacity === 'number' && Number.isFinite(presentation.opacity)
    ? Math.max(0, Math.min(1, presentation.opacity)) : 1;
  const title = String(item.data?.title || item.data?.name || (location ? 'Locatie' : 'Object'));
  return {
    type: 'Feature',
    geometry,
    properties: {
      id: String(item.id),
      externalId: String(item.externalId || ''),
      title: title.slice(0, 180),
      kind: String(item.type || 'object').slice(0, 50),
      color, opacity, seen: presentation.seen === true,
      sourceId: String(item.data?.environment?.sourceId || '').slice(0, 160)
    }
  };
}

export function environmentGeoJSON(objects) {
  return {
    type: 'FeatureCollection',
    features: (Array.isArray(objects) ? objects : [])
      .map(environmentFeatureForObject)
      .filter(Boolean)
  };
}


// Project a label chord through the polygon's centroid, parallel to its longest
// boundary edge. A polygon title is only shown when the chord fits on screen.
export function environmentShapeLabels(features, project, unproject, minimumFontPx = 12) {
  const labels=[];
  for(const feature of features || []) {
    const g=feature.geometry, title=String(feature.properties?.title || '').trim();
    if(!title || !['Polygon','MultiPolygon'].includes(g?.type)) continue;
    const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    for(const rings of polygons){
      const ring=rings?.[0];
      if(!ring || ring.length<4)continue;
      const points=ring.map(pair=>project(pair));
      if(points.some(p=>!Number.isFinite(p?.x)||!Number.isFinite(p?.y)))continue;
      let edge=null;
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1],length=Math.hypot(b.x-a.x,b.y-a.y);
        if(!edge||length>edge.length)edge={a,b,length};
      }
      if(!edge||edge.length<minimumFontPx*3)continue;
      const cx=points.slice(0,-1).reduce((n,p)=>n+p.x,0)/(points.length-1);
      const cy=points.slice(0,-1).reduce((n,p)=>n+p.y,0)/(points.length-1);
      const dx=(edge.b.x-edge.a.x)/edge.length,dy=(edge.b.y-edge.a.y)/edge.length;
      const intersections=[];
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1];
        const ax=a.x-cx,ay=a.y-cy,bx=b.x-a.x,by=b.y-a.y;
        const det=dx*by-dy*bx;
        if(Math.abs(det)<0.00001)continue;
        const t=(ax*by-ay*bx)/det;
        const u=(ax*dy-ay*dx)/det;
        if(u>=0&&u<=1)intersections.push(t);
      }
      intersections.sort((a,b)=>a-b);
      let best=null;
      for(let i=0;i<intersections.length-1;i++){
        const a=intersections[i],b=intersections[i+1],distance=b-a;
        if(distance<minimumFontPx*3)continue;
        const mx=cx+(a+b)/2*dx,my=cy+(a+b)/2*dy;
        let inside=false;
        for(let j=0,k=points.length-2;j<points.length-1;k=j++){
          const p=points[j],q=points[k];
          if((p.y>my)!==(q.y>my)&&mx<(q.x-p.x)*(my-p.y)/(q.y-p.y)+p.x)inside=!inside;
        }
        if(inside&&(!best||distance>best.distance))best={a,b,distance};
      }
      // Conservative width estimate avoids small unreadable or overflowing text.
      if(!best||best.distance<title.length*minimumFontPx*0.64+minimumFontPx*2)continue;
      const a={x:cx+best.a*dx,y:cy+best.a*dy},b={x:cx+best.b*dx,y:cy+best.b*dy};
      labels.push({type:'Feature',geometry:{type:'LineString',coordinates:[a,b].map(p=>unproject(p))},properties:{title}});
      break;
    }
  }
  return labels;
}
