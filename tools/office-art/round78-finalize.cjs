// Preserve the public keys, repair the old theme/layout collisions, and audit production art.
const fs=require('node:fs'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const r=require('./round78.cjs'),{p,m,camel}=r;
const before=JSON.parse(execFileSync('git',['show','HEAD:packages/web/public/office/manifest.json']));
for(const [key,meta]of Object.entries(m.layout.animations)){
 if(!meta.sheet.includes('/theme-office/')||key.startsWith('office'))continue;
 if(before.layout.animations[key]){m.layout.animations[key]=before.layout.animations[key];continue;}
 const canonical=m.layout.animations['office'+key[0].toUpperCase()+key.slice(1)];
 if(canonical)m.layout.animations[key]={...canonical};
}
// Replacement keys follow the Compound object's consumer key. Retain old aliases.
m.themes.office.objects.plantDead=m.themes.office.objects.plant;
m.themes.office.objects.windowNight=m.themes.office.objects.windowDay;
m.themes.office.objects.kpiBoard=m.themes.office.objects.whiteboard;
m.themes.office.objects.cityDay=m.themes.office.backgrounds.cityDay;
m.themes.office.objects.cityDusk=m.themes.office.backgrounds.cityDusk;
m.layout.officeActIcons={...m.layout.actIcons,sheet:m.themes.office.ui.actIcons};
if(m.layout.animations.officeOfficeCat)m.layout.animations.officeCat={...m.layout.animations.officeOfficeCat};
m.layout.animations.officeCat.poses={walk:[0,1,2,3],sitGroom:[4,5,6,7],sleep:[8,9,10,11]};
m.layout.animations.officeBouncer.poses={...m.characters.bouncer.animations};
m.layout.animations.officeBoss.poses={...m.characters.boss.animations};
m.layout.animations.officeBoss.replacements={idleWalkie:'coffee-mug',newspaper:'pause-card',whipCrack:'hand-bell',zapper:'sparkle-wand'};
fs.writeFileSync(p.ROOT+'/manifest.json',JSON.stringify(m,null,2)+'\n');
const checklist=fs.readFileSync('docs/asset-checklist.md','utf8'),entries=[];
let gate=false;for(const line of checklist.split('\n')){if(line.startsWith('## Fixes to Round 6'))gate=true;if(line.startsWith('## Manifest'))gate=false;const a=line.match(/^- \[[ x]\] `([^`]+)` (\d+)×(\d+)/);if(a&&gate)entries.push({file:a[1],width:+a[2],height:+a[3]});}
// These were in the task's starting checklist; keep validating them even if
// another working session prunes a live checklist entry during production.
for(const [file,width,height]of [['ui/bg-concrete.png',128,128],['ui/bg-metal.png',128,52],['theme-office/ui/bg-paper.png',128,128]])if(!entries.some(e=>e.file===file))entries.push({file,width,height});
const errors=[],audit=[];
const refs=[];function walk(v){if(typeof v==='string'&&v.startsWith('office/')&&v.endsWith('.png'))refs.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(m);
for(const ref of new Set(refs))if(!fs.existsSync('packages/web/public/'+ref))errors.push('Missing manifest path: '+ref);
for(const e of entries){
 const im=p.read(p.ROOT+'/'+e.file),sha=crypto.createHash('sha256').update(fs.readFileSync(p.ROOT+'/'+e.file)).digest('hex');
 if(im.width!==e.width||im.height!==e.height)errors.push('Wrong size: '+e.file);
 const metadata=Object.entries(m.layout.animations).filter(([,v])=>v.sheet==='office/'+e.file);
 if(!metadata.length)errors.push('Missing animation layout: '+e.file);
 for(const [key,v]of metadata){if(v.frame.width*v.columns!==im.width||v.frame.height*v.rows!==im.height||v.count>v.columns*v.rows)errors.push('Invalid frame layout: '+key);for(const frames of Object.values(v.poses||{}))if(frames.some(f=>f<0||f>=v.count))errors.push('Pose outside atlas: '+key);}
 const rejected='docs/art-review/rejected-r7r8/'+e.file;
 if(fs.existsSync(rejected)&&fs.readFileSync(rejected).equals(fs.readFileSync(p.ROOT+'/'+e.file)))errors.push('Unreplaced rejected art: '+e.file);
 const colors=new Set(),alpha=new Set();for(let i=0;i<im.data.length;i+=4){alpha.add(im.data[i+3]);if(im.data[i+3])colors.add('#'+[...im.data.subarray(i,i+3)].map(n=>n.toString(16).padStart(2,'0')).join(''));}
 if([...alpha].some(a=>a!==0&&a!==255))errors.push('Soft alpha: '+e.file);
 const allowed=new Set([...p.palette,'#ffb020','#2fae6c']);for(const c of colors)if(!allowed.has(c))errors.push('Off palette '+c+': '+e.file);
 audit.push({...e,sha256:sha,colors:colors.size,layouts:metadata.map(([k])=>k),replacedRejected:fs.existsSync(rejected)});
}
const report={files:audit.length,errors,audit};fs.writeFileSync('docs/art-review/round78-validation.json',JSON.stringify(report,null,2)+'\n');
if(errors.length){console.error(errors.join('\n'));process.exit(1);}console.log('Validated '+audit.length+' gated files: exact sizes, palette, hard alpha, manifest paths and layouts; all rejected counterparts replaced. Human approvals untouched.');
