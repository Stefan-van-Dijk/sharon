import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const sw=fs.readFileSync('service-worker.js','utf8');
const match=sw.match(/const BUILD\s*=\s*['"]([^'"]+)['"]/);
if(!match)throw Error('Service worker BUILD ontbreekt');
const version=match[1];
const checks=[
  ['index.html',html],
  ['src/main.js',fs.readFileSync('src/main.js','utf8')],
  ['src/app.js',fs.readFileSync('src/app.js','utf8')],
  ['service-worker.js',sw]
];
for(const [name,code] of checks){
  if(!code.includes('?v='+version))throw Error(name+' mist huidige versie '+version);
}
console.log('PWA-versie '+version+' komt overeen in kernbestanden.');
