// Deterministic, local-only suggestions for linking existing objects in the test workspace.
// Context never becomes a stored relation until the user explicitly confirms it.
export const CONTEXT_CASES = Object.freeze([
  {id:'from-object',label:'Vanuit dit object'},
  {id:'at-place',label:'Bij een bekende locatie'},
  {id:'on-ride',label:'Tijdens een rit'}
]);
const defaults = {
  actions:{persons:'related-to',locations:'at-location',tasks:'tracks-time',rides:'related-to',cards:'related-to'},
  tasks:{persons:'related-to',locations:'at-location',actions:'related-to',rides:'related-to'},
  rides:{locations:'destination',persons:'related-to',actions:'related-to'},
  cards:{locations:'usable-at',persons:'related-to'},
  persons:{locations:'related-to',actions:'related-to',rides:'related-to',cards:'owns'},
  locations:{persons:'related-to',actions:'related-to',rides:'destination',cards:'related-to'}
};
export function suggestConnections(data,sourceId,{caseId='from-object',search='',focusId=''}={}) {
  const source=data.objects.find(o=>o.id===sourceId);
  if(!source) return [];
  const query=String(search).trim().toLocaleLowerCase('nl');
  const linked=new Set(data.relations.filter(r=>r.from===sourceId||r.to===sourceId).map(r=>r.from===sourceId?r.to:r.from));
  const focus=data.objects.find(o=>o.id===focusId);
  const possible=data.objects.filter(o=>o.id!==sourceId && o.status!=='archived' && (!query || o.title.toLocaleLowerCase('nl').includes(query) || o.module.toLocaleLowerCase('nl').includes(query)));
  const connected=new Set();
  for(const relation of data.relations) if(relation.from===sourceId||relation.to===sourceId) connected.add(relation.from===sourceId?relation.to:relation.from);
  return possible.map(candidate=>{
    let score=0;const reasons=[];
    const defaultPredicate=defaults[source.module]?.[candidate.module] || 'related-to';
    if(defaults[source.module]?.[candidate.module]) {score+=15;reasons.push('Past bij deze module');}
    if(linked.has(candidate.id)) {score-=40;reasons.push('Al verbonden');}
    if(candidate.id===focusId) {score+=100;reasons.unshift('Expliciet gekozen context');}
    if(caseId==='at-place' && candidate.module==='locations') {score+=45;reasons.unshift('Herkende plek (testscenario)');}
    if(caseId==='on-ride' && candidate.module==='rides') {score+=45;reasons.unshift('Actieve rit (testscenario)');}
    if(caseId==='on-ride' && candidate.module==='persons' && focus?.module==='rides' &&
       data.relations.some(r=>(r.from===focus.id && r.to===candidate.id)||(r.to===focus.id && r.from===candidate.id))) {
      score+=35;reasons.unshift('Gekoppeld aan gekozen rit');
    }
    if(query && candidate.title.toLocaleLowerCase('nl').startsWith(query)) score+=20;
    return {object:candidate,score,reason:reasons[0]||'Bestaand object',predicate:defaultPredicate,linked:connected.has(candidate.id)};
  }).sort((a,b)=>b.score-a.score||a.object.title.localeCompare(b.object.title,'nl'));
}
