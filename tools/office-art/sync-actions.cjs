const fs=require('node:fs'),p=require('./finish.cjs'),{appendBoss,appendWorker}=require('./append-actions.cjs');
const {skins}=require('./catalog.cjs');
let count=0;for(const id of skins){const file='docs/art-review/actions/'+id+'-zap.json';if(fs.existsSync(file)&&p.read(p.ROOT+'/characters/'+id+'.png').height===576){appendWorker(JSON.parse(fs.readFileSync(file)));console.log('Appended '+id);count++;}}
const boss='docs/art-review/actions/boss-gags.json';if(fs.existsSync(boss)&&p.read(p.ROOT+'/characters/boss.png').height===576){appendBoss(JSON.parse(fs.readFileSync(boss)));console.log('Appended boss');}
const ready=skins.filter(id=>p.read(p.ROOT+'/characters/'+id+'.png').height===648);console.log(JSON.stringify({newlyAppended:count,ready:ready.length,total:skins.length,pending:skins.filter(id=>!ready.includes(id))}));
