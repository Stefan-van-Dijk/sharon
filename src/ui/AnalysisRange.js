import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.4.37';
export const ANALYSIS_RANGE_KEY='sharon.boards.analysis-range.v1';
export const ANALYSIS_RANGE_EVENT='sharon-analysis-range-changed';
export const validCenter=point=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180;
export function saveAnalysisRange(patch){
  try{localStorage.setItem(ANALYSIS_RANGE_KEY,JSON.stringify({...analysisRange(),...patch}));}catch{}
  globalThis.window?.dispatchEvent(new CustomEvent(ANALYSIS_RANGE_EVENT));
}
export function analysisRange(){
  let saved;try{saved=JSON.parse(localStorage.getItem(ANALYSIS_RANGE_KEY)||'null');}catch{}
  const meters=Number(saved?.meters);
  return {meters:Number.isFinite(meters)&&meters>=0&&meters<=500000?meters:10000,unlimited:saved?.unlimited===true||meters>500000,center:validCenter(saved?.center)?{lat:saved.center.lat,lng:saved.center.lng}:null};
}
export function inAnalysisRange(point,center){
  const range=analysisRange();center=range.center||center;
  return range.unlimited||!center||!point||distanceMeters(center,point)<=range.meters;
}
export function analysisFetchRadius(){const range=analysisRange();return range.unlimited?10000:Math.max(100,Math.min(10000,Math.round(range.meters)));}
export function analysisRangeLabel(){const range=analysisRange();return range.unlimited?'zonder afstandsgrens':'binnen '+(range.meters/1000).toLocaleString('nl-NL')+' km';}
export function mountAnalysisRange(root){
  const field=root.querySelector('[data-analysis-radius]'),output=root.querySelector('[data-analysis-radius-value]');
  if(!field)return ()=>{};
  const render=()=>{
    const range=analysisRange(),label=range.unlimited?'∞ · Onbeperkt':range.meters/1000+' km';
    field.value=range.unlimited?501:range.meters/1000;
    field.setAttribute('aria-valuetext',label);if(output)output.textContent=label;
  };
  const input=()=>{
    const value=Number(field.value);if(!Number.isFinite(value)||value<0||value>501)return;
    saveAnalysisRange({meters:Math.min(value,500)*1000,unlimited:value===501});render();
  };
  field.addEventListener('input',input);field.addEventListener('change',input);
  window.addEventListener(ANALYSIS_RANGE_EVENT,render);render();
  return ()=>{field.removeEventListener('input',input);field.removeEventListener('change',input);window.removeEventListener(ANALYSIS_RANGE_EVENT,render);};
}
