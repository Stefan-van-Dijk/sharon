const titleOf = item => String(item.name ?? item.title ?? item.data?.title ?? '');
const timestamp = value => Number.isFinite(Number(value)) ? Number(value) : Date.parse(value) || 0;
export function sortList(items, {sort='alpha',order=[],distance=()=>Infinity}={}) {
  const rank=new Map(order.map((id,index)=>[id,index]));
  const alpha=(a,b)=>titleOf(a).localeCompare(titleOf(b),'nl',{sensitivity:'base'});
  return [...items].sort((a,b)=>{
    if(sort==='custom')return (rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity)||alpha(a,b);
    if(sort==='recent')return timestamp(b.updatedAt??b.createdAt)-timestamp(a.updatedAt??a.createdAt)||alpha(a,b);
    if(sort==='near')return distance(a)-distance(b)||alpha(a,b);
    return alpha(a,b);
  });
}
export function moveInOrder(ids,id,direction) {
  const result=[...new Set(ids)],index=result.indexOf(id),target=index+direction;
  if(index<0||target<0||target>=result.length||![-1,1].includes(direction))return result;
  [result[index],result[target]]=[result[target],result[index]];
  return result;
}
