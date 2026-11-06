import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {resolve} from 'node:path';

test('PHP transport sends POST, decodes gzip, bounds errors and falls back only on method rejection',async t=>{
 const requests=[];
 const server=createServer((req,res)=>{
  let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
   requests.push({method:req.method,url:req.url,body});
   if(req.url.startsWith('/reject')){res.writeHead(406);res.end('Rejected');return;}
   if(req.url.startsWith('/method')&&req.method==='POST'){res.writeHead(405);res.end();return;}
   const data=JSON.stringify({elements:[]});
   if(req.url.startsWith('/gzip')){res.writeHead(200,{'Content-Encoding':'gzip'});res.end(gzipSync(data));return;}
   res.end(data);
  });
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 async function download(path,streams=false){
  const code=`define('SHARON_CHAINS_LIBRARY_ONLY',true);require ${JSON.stringify(resolve('server/chains.php'))};try{echo world_shop_download('[out:json];node(123);out;',${JSON.stringify(base+path)});}catch(Throwable $e){echo $e->getMessage();exit(2);}`;
  return new Promise((resolve,reject)=>{
   const child=spawn('php',[...(streams?['-d','disable_functions=curl_init']:[]),'-r',code]);let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',status=>resolve({status,out,err}));
  });
 }
 for(const streams of [false,true]){
  requests.length=0;const result=await download('/ok',streams);
  assert.equal(result.status,0,result.err);assert.deepEqual(JSON.parse(result.out),{elements:[]});assert.equal(requests[0].method,'POST');assert.equal(new URLSearchParams(requests[0].body).get('data'),'[out:json];node(123);out;');assert.equal(requests[0].url,'/ok');
  requests.length=0;assert.equal((await download('/method',streams)).status,0);assert.deepEqual(requests.map(r=>r.method),['POST','GET']);
  requests.length=0;const blocked=await download('/reject',streams);assert.equal(blocked.status,2);assert.equal(blocked.out,'http_406');assert.equal(requests.length,1);
 }
 const zipped=await download('/gzip');assert.equal(zipped.status,0);assert.deepEqual(JSON.parse(zipped.out),{elements:[]});
});
