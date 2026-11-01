const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const p=require('./finish.cjs');
const {cast,skins,expected,manifest}=require('./catalog.cjs');
const errors=[],checks=[];function check(ok,label){checks.push({check:label,passed:!!ok});if(!ok)errors.push(label);}
const hex=c=>'#'+c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
const listed=[];function walk(v){if(typeof v==='string'&&v.startsWith('office/')&&v.endsWith('.png'))listed.push(v.slice(7));else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(manifest);
const refs=new Set(listed),actual=[];function files(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){if(f.isDirectory())files(path.join(dir,f.name));else if(f.name.endsWith('.png'))actual.push(path.relative(p.ROOT,path.join(dir,f.name)));}}files(p.ROOT);
check(Object.keys(manifest.characters.skins).join()===skins.join(),'All 23 exact skin IDs in manifest');
check(JSON.stringify(manifest.characters.cast)===JSON.stringify(cast),'Default cast contains the exact 16 IDs in requested order');
check(!JSON.stringify(manifest).includes('violet'),'Violet absent from manifest');
const snapshot='docs/art-review/before-actions/characters';
function sameOutsideRevision(old,current,file){for(let y=0;y<old.height;y++)for(let x=0;x<old.width;x++){const f=Math.floor(y/72)*4+Math.floor(x/48);const allowed=old.width===192&&(file==='boss.png'?[36,37].includes(f):[20,21].includes(f));if(!allowed&&p.get(old,x,y).join()!==p.get(current,x,y).join())return false;}return true;}
for(const file of fs.readdirSync(snapshot)){const full=path.join(p.ROOT,'characters',file),old=p.read(path.join(snapshot,file));if(fs.existsSync(full))check(sameOutsideRevision(old,p.read(full),file),'Preserved original pixels outside authorized standing-hand revision '+file);else check(false,'Preserved original pixels '+file);}
const polishSnapshot='docs/art-review/before-polish/characters';
for(const file of fs.readdirSync(polishSnapshot)){const old=p.read(path.join(polishSnapshot,file)),current=p.read(path.join(p.ROOT,'characters',file));check(sameOutsideRevision(old,current,file),'Only requested attention/baton frames revised '+file);}
check(manifest.characters.frame.rows===9&&manifest.characters.bossRows===10,'Worker rows=9; bossRows=10');
for(const file of Object.keys(expected))check(refs.has(file),'Manifest references '+file);
for(const file of actual)check(file in expected&&refs.has(file),'No uncatalogued PNG '+file);
const palette=new Set(p.palette),greys=new Set(['#d0d0d0','#a0a0a0','#707070']);
let opaquePixels=0,maskPixels=0;
for(const [file,[w,h]]of Object.entries(expected)){
 const full=path.join(p.ROOT,file),exists=fs.existsSync(full);check(exists,'Exists '+file);if(!exists)continue;const im=p.read(full);check(im.width===w&&im.height===h,'Exact size '+file);
 let bad=0,aa=0,gold=0,maskBad=0,alpha0=0,nonempty=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=p.get(im,x,y);if(c[3]!==0&&c[3]!==255)aa++;if(!c[3]){alpha0++;continue;}nonempty++;const col=hex(c);if(col==='#ffb020'){gold++;if(file!=='ui/marker-needs.png')bad++;}else if(!palette.has(col))bad++;if(file.endsWith('-polo.png')&&!greys.has(col))maskBad++;}
 opaquePixels+=nonempty;check(nonempty>0,'Nonempty '+file);check(aa===0,'Binary alpha / no edge AA '+file);check(bad===0,'Palette and gold reservation '+file);
 if(file==='ui/marker-needs.png')check(gold>0,'Needs marker uses gold');
 if(!file.startsWith('tiles/'))check(alpha0>0,'Transparent background '+file);
 if(file.endsWith('-polo.png')){maskPixels+=nonempty;check(maskBad===0,'Only three tint greys '+file);const base=p.read(full.replace('-polo.png','.png'));let mismatch=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p.get(im,x,y)[3]&&p.get(im,x,y).join()!==p.get(base,x,y).join())mismatch++;check(!mismatch,'Mask exactly matches base '+file);}
}
if(fs.existsSync(path.join(p.ROOT,'objects/monitor.png'))){const mon=p.read(path.join(p.ROOT,'objects/monitor.png'));let filled=0;for(let y=4;y<16;y++)for(let x=4;x<28;x++)if(p.get(mon,x,y)[3])filled++;check(!filled,'Monitor screen rectangle x4 y4 w24 h12 fully transparent');}
const cctv=p.read(path.join(p.ROOT,'objects/cctv.png'));let ledChanges=0,redLed=false;for(let y=0;y<16;y++)for(let x=0;x<16;x++){const a=p.get(cctv,x,y),b=p.get(cctv,x+16,y);if(a.join()!==b.join()){ledChanges++;redLed||=hex(a)==='#c8322f'&&hex(b)==='#2a2f38';}}check(ledChanges===1&&redLed,'CCTV keeps its shape and toggles one red LED');
const night=p.read(path.join(p.ROOT,'objects/window-night.png'));let flickerPixels=0,unchangedGeometry=true;for(let y=0;y<48;y++)for(let x=0;x<96;x++){const a=p.get(night,x,y),b=p.get(night,x+96,y);if(a.join()!==b.join()){flickerPixels++;unchangedGeometry&&=['#6a4bd8','#e0559c','#3fd2e8'].includes(hex(a))&&a[3]===b[3];}}check(flickerPixels>0&&unchangedGeometry,'Night window flickers only neon pixels; geometry stays fixed');
const hashes={front:new Set(),back:new Set()};
for(const id of [...skins,'boss']){const full=path.join(p.ROOT,`characters/${id}.png`);if(!fs.existsSync(full))continue;const sheet=p.read(full);let allFrames=true,feet=true,allMasks=true;const mask=id==='boss'?null:p.read(full.replace('.png','-polo.png'));
 const total=id==='boss'?40:36;
 for(let f=0;f<total;f++){const frame=p.crop(sheet,(f%4)*48,Math.floor(f/4)*72,48,72),b=p.bbox(frame);allFrames&&=!!b;feet&&=!!b&&b[1]+b[3]===72;if(mask&&!(f===33&&!['robot','crt-bot'].includes(id))){const m=p.crop(mask,(f%4)*48,Math.floor(f/4)*72,48,72);allMasks&&=!!p.bbox(m);}}
 check(allFrames,total+' occupied cells '+id);check(feet,'Every frame bottom aligned to y71 '+id);if(mask)check(allMasks,'Polo mask in all cloth-bearing cells '+id);
 if(id!=='boss')check([20,21].every(f=>{const b=p.bbox(p.crop(sheet,f%4*48,Math.floor(f/4)*72,48,72));return b&&b[3]>=64;}),'Full-height standing hand pose '+id);
 if(cast.includes(id))for(const [view,f]of [['front',13],['back',12]])hashes[view].add(crypto.createHash('sha256').update(p.crop(sheet,(f%4)*48,Math.floor(f/4)*72,48,72).data).digest('hex'));
}
check(hashes.front.size===16,'16 distinct front sprite images');check(hashes.back.size===16,'16 distinct back sprite images');
// All desk surfaces have identical horizontal bands across joins; only the intentional privacy panel can differ.
const segments=['l','m','r'].map(s=>p.read(path.join(p.ROOT,`objects/bench-${s}.png`)));let joins=true;for(let y=26;y<=36;y++)for(const [a,b]of [[0,1],[1,1],[1,2]])joins&&=p.get(segments[a],31,y).join()===p.get(segments[b],0,y).join();
// End caps are expected navy. Compare interior repeat seams separately from caps.
let middle=true;for(let y=26;y<=36;y++)middle&&=p.get(segments[1],31,y).join()===p.get(segments[1],0,y).join();check(middle,'Repeat bench middle surface has no seam at x31→x0');
check(joins,'Left cap, repeat and right cap share continuous surface and front-edge bands');
check(manifest.layout.handUp.standing&&manifest.ui.fxSleep==='office/ui/fx-sleep.png','Standing hand and animated sleep FX are declared');
const sleep=p.read(path.join(p.ROOT,'ui/fx-sleep.png'));check([0,1,2].every(f=>p.bbox(p.crop(sleep,f*16,0,16,24))),'All three ZZZ animation frames are populated');
const result={passed:errors.length===0,expectedPngs:Object.keys(expected).length,actualPngs:actual.length,opaquePixels,maskPixels,checks:checks.length,errors,notes:['Native icons use a 7×2 grid:112×32 and224×64.','Window:2×96×48 =192×48. Gong:3×64×48 =192×48.','Bench-tag-polo is an additional mask for the tinted tag face.','Visual cast and assembled-bench review is separate from structural checks.'],details:checks};
fs.mkdirSync('docs/art-review',{recursive:true});fs.writeFileSync('docs/art-review/validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,details:undefined},null,2));process.exitCode=errors.length?1:0;
