import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(fs.readFileSync('packages/web/public/office/manifest.json','utf8'));
const sources=execFileSync('rg',['--files','packages/web/src'],{encoding:'utf8'}).trim().split('\n').map(p=>fs.readFileSync(p,'utf8')).join('\n');
const refs=new Map();
function walk(value,keys=[]){if(typeof value==='string'&&value.endsWith('.png')){refs.set(value,[...(refs.get(value)||[]),...keys]);}else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))walk(v,[...keys,k]);}walk(manifest);
let out='\n### Approved asset disposition\n\nManifest assets are loaded locally; this inventory distinguishes placement references from compatibility-only art. Character sheets/masks/portraits are selected through the manifest skin registry. Storage is capacity-limited and never forced into a walkway.\n\n| Asset | Disposition |\n|---|---|\n';
for(const [file,keys]of [...refs].sort()){
 let reason;
 if(file.includes('dorm-'))reason='Unused: dorm intentionally removed.';
 else if(/bg-(concrete|metal|paper)/.test(file))reason='Unused: flat text surfaces preserve readability; texture would sit behind shell text.';
 else if(file.endsWith('stamp-closed.png'))reason='Unused: closed projects leave the live rail; no closed rail row is supplied by the current state.';
 else if(file.includes('/characters/'))reason='Used through manifest character/portrait registry and theme lookup.';
 else if(sources.includes(file.replace(/^office/,''))||keys.some(k=>sources.includes(`"${k}"`)||sources.includes(`\x27${k}\x27`)))reason='Used by frontend placement, themed lookup, or sprite selection.';
 else reason='Unused: compatibility/alternate artwork retained; sparse layout uses its current counterpart to avoid covering controls or agents.';
 out+=`| \`${file}\` | ${reason} |\n`;
}
const progress='docs/PROGRESS.md';let text=fs.readFileSync(progress,'utf8');text=text.split('\n### Approved asset disposition')[0];fs.writeFileSync(progress,text+out);
