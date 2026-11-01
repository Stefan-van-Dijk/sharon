import { SHOP_CATEGORIES, shopCategory } from '../core/chains/ChainCategories.js?v=0.4.52';
import { placeKey } from './PlaceFeedback.js?v=0.4.52';
export const CHAIN_FILTER_KEY='sharon.source.chains.filters.v1';
export const SHOP_STATUSES={read:['☑','Gelezen'],liked:['♡','Leuk'],hidden:['◌','Verborgen'],disliked:['♧','Niet leuk']};
const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{return {};}};
export function shopFeedback(item){return read('sharon.place.feedback.v1:'+placeKey(item));}
export function shopMatches(item, categories, statuses, catalog){
  const state=shopFeedback(item);
  if(!categories.size&&!statuses.size)return !state.hidden;
  const categoryMatch=!state.hidden&&categories.has(shopCategory(item,catalog));
  const statusMatch=[...statuses].some(status=>status==='hidden'?state.hidden:!state.hidden&&state[status]);
  return categoryMatch||statusMatch;
}
export function mountChainFilters(root,{getItems,getCatalog,onChange}){
  const saved=read(CHAIN_FILTER_KEY);
  const categories=new Set((Array.isArray(saved.categories)?saved.categories:[]).filter(key=>Object.hasOwn(SHOP_CATEGORIES,key)));
  const statuses=new Set((Array.isArray(saved.statuses)?saved.statuses:[]).filter(key=>Object.hasOwn(SHOP_STATUSES,key)));
  const panel=root.querySelector('[data-chain-categories]'),statusPanel=root.querySelector('[data-chain-statuses]');
  const listeners=[];
  const add=(container,key,label,attribute)=>{
    if(!container)return;
    const button=document.createElement('button');button.type='button';button.setAttribute(attribute,key);
    const name=document.createElement('span');name.className='environment-category-name';name.textContent=label;
    const count=document.createElement('b');name.append(' ',count);const detail=document.createElement('small');
    button.append(name,detail);container.append(button);
    const selected=attribute==='data-chain-category'?categories:statuses;
    const click=()=>{selected.has(key)?selected.delete(key):selected.add(key);try{localStorage.setItem(CHAIN_FILTER_KEY,JSON.stringify({categories:[...categories],statuses:[...statuses]}));}catch{}onChange();};
    button.addEventListener('click',click);listeners.push(()=>button.removeEventListener('click',click));
  };
  for(const [key,label] of Object.entries(SHOP_CATEGORIES))add(panel,key,label,'data-chain-category');
  for(const [key,[icon,label]] of Object.entries(SHOP_STATUSES)){add(statusPanel,key,icon,'data-chain-status-filter');const button=statusPanel?.querySelector('[data-chain-status-filter="'+key+'"]');if(button){button.setAttribute('aria-label',label);button.title=label;}}
  const update=()=>{
    const items=getItems(),catalog=getCatalog();
    const available=root.querySelector('[data-chain-available]');if(available)available.textContent=items.length+' beschikbaar';
    const groups=Object.fromEntries(Object.keys(SHOP_CATEGORIES).map(key=>[key,{total:0,read:0,liked:0,hidden:0,disliked:0}]));
    const totals={read:0,liked:0,hidden:0,disliked:0};
    for(const item of items){const group=groups[shopCategory(item,catalog)],state=shopFeedback(item);group.total++;for(const key of Object.keys(totals))if(state[key]){group[key]++;totals[key]++;}}
    for(const button of root.querySelectorAll('[data-chain-category]')){
      const key=button.dataset.chainCategory,group=groups[key];button.setAttribute('aria-pressed',String(categories.has(key)));
      button.querySelector('b').textContent=group.total||'';
      const detail=button.querySelector('small');detail.textContent=Object.entries(SHOP_STATUSES).filter(([key])=>group[key]).map(([key,[icon]])=>icon+' '+group[key]).join('   ');detail.hidden=!detail.textContent;
    }
    for(const button of root.querySelectorAll('[data-chain-status-filter]')){
      const key=button.dataset.chainStatusFilter;button.setAttribute('aria-pressed',String(statuses.has(key)));button.querySelector('b').textContent=totals[key]||'';
      button.hidden=!totals[key]&&!statuses.has(key);
    }
    root.querySelector('[data-chain-toggle]')?.classList.toggle('has-active-filters',categories.size+statuses.size>0);
  };
  return {matches:item=>shopMatches(item,categories,statuses,getCatalog()),update,destroy(){listeners.forEach(off=>off());}};
}
