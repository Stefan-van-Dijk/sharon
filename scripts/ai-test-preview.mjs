import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {buildSite} from './build-site.mjs';

// Separate disposable build; no shortcut is added to the production application.
export function buildAiTestPreview(root=process.cwd(), {lat=51.22111,lng=4.39971}={}) {
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) throw Error('Ongeldige testcoördinaten');
  const output=resolve(root,'.ai-test-site');
  buildSite(root,output);
  const version=JSON.parse(readFileSync(resolve(root,'package.json'))).version;
  const mainPath=resolve(output,'src/main.js');
  const main=readFileSync(mainPath,'utf8').replace("if ('serviceWorker' in navigator)","if (false)");
  writeFileSync(mainPath,main);
  const bootPath=resolve(output,'src/ui/Boot.js');
  const boot=readFileSync(bootPath,'utf8');
  const start=boot.indexOf('export async function runReturningIntro('), end=boot.indexOf('\nasync function waitUntil',start);
  if(start<0||end<0) throw Error('Teststart kan begroeting niet isoleren');
  writeFileSync(bootPath,boot.slice(0,start)+'export async function runReturningIntro() {}\n'+boot.slice(end));
  writeFileSync(resolve(output,'ai-test-start.js'),`
import {ObjectStore} from './src/core/storage/ObjectStore.js?v=${version}';
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname)) throw Error('Teststart vereist localhost');
const store=await new ObjectStore().open();
if(!await store.get('settings','app')) {
  await store.put('settings',{key:'app',value:{profile:{name:'AI-testprofiel'},onboarding:{storySeen:true}}});
}
Object.defineProperty(navigator,'geolocation',{configurable:true,value:{
  getCurrentPosition(success){queueMicrotask(()=>success({coords:{latitude:${lat},longitude:${lng},accuracy:10,altitude:null,speed:null,heading:null},timestamp:Date.now()}));}
}});
const badge=document.createElement('aside');
badge.textContent='AI-testomgeving · fictieve GPS: ${lat}, ${lng}';
badge.style.cssText='position:fixed;top:0;left:0;z-index:2147483647;background:#ffe58a;color:#111;font:12px sans-serif;padding:3px;pointer-events:none';
document.body.append(badge);
await import('./src/main.js?v=${version}');
`);
  const indexPath=resolve(output,'index.html');
  writeFileSync(indexPath,readFileSync(indexPath,'utf8').replace(`./src/main.js?v=${version}`,'./ai-test-start.js'));
  // Modified test files must never advertise a valid production release manifest.
  writeFileSync(resolve(output,'release.json'),JSON.stringify({testOnly:true}));
  return output;
}

export function serveAiTestPreview(output,port=4174) {
  const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.css':'text/css'};
  const server=createServer((req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      if(pathname==='/service-worker.js') {res.writeHead(404);res.end();return;}
      const path=resolve(output,'.'+(pathname==='/'?'/index.html':pathname));
      if(!path.startsWith(output+'/')) throw Error('Invalid path');
      const data=readFileSync(path), ext=path.slice(path.lastIndexOf('.'));
      res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404);res.end();}
  });
  return server.listen(port,'127.0.0.1');
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2).map(Number);
  const output=buildAiTestPreview(process.cwd(),args.length?{lat:args[0],lng:args[1]}:{});
  const server=serveAiTestPreview(output);
  server.on('listening',()=>console.log('AI-testomgeving: http://127.0.0.1:4174 · fictief profiel en GPS · intro overgeslagen'));
}
