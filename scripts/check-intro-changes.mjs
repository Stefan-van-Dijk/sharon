import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Include shared startup, storage, location and styles: changes there can break onboarding.
export function affectsIntro(path) {
 return /^(index\.html|package(-lock)?\.json|src\/(main\.js|app\.js|core\/|modules\/ModuleRegistry\.js)|src\/ui\/(Boot|Story|Brand|TextInputFocus|Viewport|Location|SharonMapRuntime|EnvironmentStyle|Shell)|tests\/(intro\/|helpers\/app-harness\.mjs|location-onboarding-flow\.test\.js|text-input-focus\.test\.js)|scripts\/(build-site|release-assets|check-intro-changes)\.mjs|\.github\/workflows\/sharon-checks\.yml)/.test(path);
}
export function introChanged(base,head='HEAD') {
 if(!/^[a-f0-9]{40}$/.test(base||'')||/^0+$/.test(base))return true;
 const git=args=>execFileSync('git',args,{encoding:'utf8'});
 const paths=git(['diff','--name-only',base,head]).trim().split('\n').filter(affectsIntro);
 const normalize=text=>text.replace(/\?v=\d+\.\d+\.\d+/g,'?v=VERSION');
 return paths.some(path=>{
   // Missing/added files always require the intro round.
   try{return normalize(git(['show',base+':'+path]))!==normalize(git(['show',head+':'+path]));}catch{return true;}
 });
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
 const changed=introChanged(process.env.INTRO_BASE_SHA);
 if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`changed=${changed}\n`);
 console.log(changed?'Introcontrole uitvoeren: introductie of afhankelijkheden gewijzigd.':'Introcontrole overslaan: introductie en afhankelijkheden ongewijzigd.');
}
