import { distanceMeters } from '../core/location/GeographicBranchIndex.js?v=0.4.55';
export const ANALYSIS_RANGE_KEY='sharon.boards.analysis-range.v1';
export const ANALYSIS_PREVIEW_EVENT='sharon-analysis-preview-changed';
export const ANALYSIS_VISIBILITY_EVENT='sharon-analysis-visibility-changed';
export const ANALYSIS_RANGE_EVENT='sharon-analysis-range-changed';
export const validCenter=point=>Number.isFinite(point?.lat)&&Number.isFinite(point?.lng)&&Math.abs(point.lat)<=90&&Math.abs(point.lng)<=180;
export function saveAnalysisRange(patch,preview=false){
  try{localStorage.setItem(ANALYSIS_RANGE_KEY,JSON.stringify({...analysisRange(),...patch}));}catch{}
  globalThis.window?.dispatchEvent(new CustomEvent(preview?ANALYSIS_PREVIEW_EVENT:ANALYSIS_RANGE_EVENT));
}
export function analysisRange(){
  return {meters:10000,unlimited:true,visible:false,center:null};
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
    field.value=range.unlimited?201:range.meters/1000;
    field.setAttribute('aria-valuetext',label);if(output)output.textContent=label;
  };
  const input=(preview=true)=>{
    const value=Number(field.value);if(!Number.isFinite(value)||value<0||value>201)return;
    saveAnalysisRange({meters:Math.min(value,200)*1000,unlimited:value===201},preview);render();
  };
  const preview=()=>input(true),commit=()=>input(false);
  field.addEventListener('input',preview);field.addEventListener('change',commit);
  window.addEventListener(ANALYSIS_RANGE_EVENT,render);window.addEventListener(ANALYSIS_PREVIEW_EVENT,render);render();
  return ()=>{field.removeEventListener('input',preview);field.removeEventListener('change',commit);window.removeEventListener(ANALYSIS_RANGE_EVENT,render);window.removeEventListener(ANALYSIS_PREVIEW_EVENT,render);};
}
