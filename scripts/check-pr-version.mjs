import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const base=process.argv[2];
if(!/^[a-f0-9]{40}$/.test(base||''))throw Error('Geef de volledige base commit-SHA mee.');
const changed=execFileSync('git',['diff','--name-only',base,'HEAD'],{encoding:'utf8'}).trim().split('\n');
if(changed.some(path=>/^(src\/|assets\/|vendor\/|server\/|index\.html$|service-worker\.js$|manifest\.webmanifest$)/.test(path))){
  const previous=JSON.parse(execFileSync('git',['show',`${base}:package.json`],{encoding:'utf8'})).version;
  const current=JSON.parse(readFileSync('package.json')).version;
  const a=current.split('.').map(Number),b=previous.split('.').map(Number);
  const first=a.findIndex((value,index)=>value!==b[index]);
  if(first<0||a[first]<=b[first])throw Error(`App gewijzigd zonder hogere versie: ${previous} → ${current}`);
  console.log(`Appversie verhoogd: ${previous} → ${current}`);
}else console.log('Geen appwijziging: versieverhoging niet vereist.');
