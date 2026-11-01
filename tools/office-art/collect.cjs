const fs=require('node:fs');
const p=require('./finish.cjs');
const sourceFile='docs/art-review/sources.json';
const sources=JSON.parse(fs.readFileSync(sourceFile));sources.objects||=[];
for(const file of fs.readdirSync('docs/art-review/receipts')){const r=JSON.parse(fs.readFileSync('docs/art-review/receipts/'+file));if(r.id==='violet')continue;if(r.id){if(sources.characters[r.id]!==r.source){sources.characters[r.id]=r.source;p.finishCharacter(r.id,r.source);console.log('Finished '+r.id);}}else{if(!sources.objects.some(s=>s.file===r.file&&s.source===r.source)){sources.objects=sources.objects.filter(s=>s.file!==r.file);sources.objects.push(r);p.finishObject(r);console.log('Finished '+r.file);}}}
fs.writeFileSync(sourceFile,JSON.stringify(sources,null,2)+'\n');
