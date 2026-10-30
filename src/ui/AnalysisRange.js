import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.4.36';
export const ANALYSIS_RANGE_KEY='sharon.boards.analysis-range.v1';
export const ANALYSIS_RANGE_EVENT='sharon-analysis-range-changed';
export function analysisRange(){
  let saved;try{saved=JSON.parse(localStorage.getItem(ANALYSIS_RANGE_KEY)||'null');}catch{}
  const meters=Number(saved?.meters);
  return {meters:Number.isFinite(meters)&&meters>=100&&meters<=20000000?meters:10000,unlimited:saved?.unlimited===true};
}
export function inAnalysisRange(point,center){
  const range=analysisRange();
  return range.unlimited||!center||!point||distanceMeters(center,point)<=range.meters;
}
export function analysisFetchRadius(){const range=analysisRange();return range.unlimited?10000:Math.min(10000,range.meters);}
export function analysisRangeLabel(){const range=analysisRange();return range.unlimited?'zonder afstandsgrens':'binnen '+(range.meters/1000).toLocaleString('nl-NL')+' km';}
export function mountAnalysisRange(root){
  const field=root.querySelector('[data-analysis-radius]'),unlimited=root.querySelector('[data-analysis-unlimited]');
  if(!field||!unlimited)return ()=>{};
  const render=()=>{const range=analysisRange();field.value=range.meters/1000;unlimited.checked=range.unlimited;field.disabled=range.unlimited;};
  const change=()=>{
    const meters=Number(field.value)*1000;
    if(!unlimited.checked&&(!Number.isFinite(meters)||meters<100||meters>20000000)){field.setCustomValidity('Kies een straal tussen 0,1 en 20.000 km.');field.reportValidity();return;}
    field.setCustomValidity('');
    const previous=analysisRange();
    try{localStorage.setItem(ANALYSIS_RANGE_KEY,JSON.stringify({meters:Number.isFinite(meters)&&meters>=100&&meters<=20000000?meters:previous.meters,unlimited:unlimited.checked}));}catch{}
    render();window.dispatchEvent(new CustomEvent(ANALYSIS_RANGE_EVENT));
  };
  field.addEventListener('change',change);unlimited.addEventListener('change',change);render();
  return ()=>{field.removeEventListener('change',change);unlimited.removeEventListener('change',change);};
}
