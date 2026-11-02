import fs from 'node:fs';
import path from 'node:path';
const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())walk(p);
    else if(entry.name.endsWith('.js'))files.push(p);
  }
}
walk('src');
const missing=[];
for(const file of files){
  const code=fs.readFileSync(file,'utf8');
  const pattern=/\b(?:import|export)\s+(?:[^'"]*?\s+from\s*)?['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for(const match of code.matchAll(pattern)){
    const spec=match[1]||match[2];
    if(!spec.startsWith('.'))continue;
    const target=path.resolve(path.dirname(file),decodeURIComponent(spec.split('?')[0]));
    if(!fs.existsSync(target))missing.push(file+' -> '+spec);
  }
}
if(missing.length){console.error('Ontbrekende modules:\n'+missing.join('\n'));process.exitCode=1;}
else console.log('Alle relatieve modulepaden bestaan.');
