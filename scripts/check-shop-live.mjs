// Opt-in live check: uses exactly one small public area, never an entire city.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ChainBrowse} from '../src/core/chains/ChainBrowse.js';
const execute=promisify(execFile),calls=[];
const fetcher=async(url,options={})=>{
 const start=performance.now();calls.push({url});
 const args=['-sS','--max-time','30','-w','\n%{http_code}','-H','Origin: https://stefan-van-dijk.github.io','-H','Referer: https://stefan-van-dijk.github.io/sharon/'];
 for(const [key,value] of Object.entries(options.headers||{}))args.push('-H',key+': '+value);
 if(options.body)args.push('--data',options.body);
 args.push(url);
 try{const {stdout}=await execute('curl',args,{signal:options.signal,maxBuffer:5000000});const cut=stdout.lastIndexOf('\n'),status=Number(stdout.slice(cut+1));return {ok:status>=200&&status<300,status,json:async()=>JSON.parse(stdout.slice(0,cut))};}
 finally{calls.at(-1).ms=Math.round(performance.now()-start);}
};
const browse=new ChainBrowse({useAreaStorage:true,fetcher});
const start=performance.now();
const result=await browse.area([2.35,48.856,2.352,48.858]);
if(!result.points.length)throw Error('No shops returned for the Paris test cell');
const first=result.points[0],detail=await browse.detail(first);
if(detail.sourceRef!==first.sourceRef)throw Error('Detail identity changed');
console.log(JSON.stringify({points:result.points.length,truncated:result.truncated,ms:Math.round(performance.now()-start),examples:result.points.slice(0,5).map(p=>({name:p.name,sourceRef:p.sourceRef})),detailAvailable:Boolean(detail),calls},null,2));
