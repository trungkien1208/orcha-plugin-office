// Artwork invariants beyond the requested size/baseline checklist.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const p=require('./finish.cjs'),{PNG}=require('pngjs');
const manifest=JSON.parse(fs.readFileSync(p.ROOT+'/manifest.json')),errors=[],notes=[];let checks=0;
function check(ok,message){checks++;if(!ok)errors.push(message);}
const allowed=new Set(p.palette.map(c=>p.rgb(c).join())),gold=p.rgb('#ffb020').join();
const changed=execFileSync('git',['diff','--name-only','--','packages/web/public/office']).toString().trim().split('\n');
const added=execFileSync('git',['ls-files','--others','--exclude-standard','packages/web/public/office']).toString().trim().split('\n');
const files=[...new Set([...changed,...added])].filter(f=>f.endsWith('.png'));
const manifestString=JSON.stringify(manifest),layouts=Object.values(manifest.layout.animations),imageCache=new Map();
for(const file of files){const rel=file.replace('packages/web/public/office/',''),im=p.read(file);imageCache.set(rel,im);check(manifestString.includes('office/'+rel),rel+' missing manifest reference');
 let off=0,alpha=0,cloth=0;const goldAllowed=['ui/marker-needs.png','ui/hp-fill.png','ui/favicon-needs-32.png'].includes(rel);
 for(let i=0;i<im.data.length;i+=4){const c=Array.from(im.data.subarray(i,i+3)).join(),a=im.data[i+3];if(a!==0&&a!==255)alpha++;if(a&&!allowed.has(c)&&!(goldAllowed&&c===gold))off++;if(rel.endsWith('-polo.png')&&a&&!['208,208,208','160,160,160','112,112,112'].includes(c))cloth++;}
 check(alpha===0,rel+' has nonbinary alpha: '+alpha);check(off===0,rel+' has nonpalette pixels: '+off);check(cloth===0,rel+' has noncloth tint pixels: '+cloth);
 const layout=layouts.find(l=>l.sheet==='office/'+rel);check(Boolean(layout),rel+' missing sheet layout');if(layout){check(layout.frame.width*layout.columns===im.width&&layout.frame.height*layout.rows===im.height,rel+' layout dimensions mismatch');
  const seen=[];for(let n=0;n<layout.count;n++){const cell=p.crop(im,n%layout.columns*layout.frame.width,Math.floor(n/layout.columns)*layout.frame.height,layout.frame.width,layout.frame.height);const empty=!p.bbox(cell);if(rel.includes('icons-ui-')&&n>=40)check(empty,rel+' spare icon '+n+' must be transparent');else if(!rel.endsWith('-polo.png'))check(!empty,rel+' frame '+n+' is empty');seen.push(PNG.sync.write(cell).toString('base64'));}if(layout.count>1&&!rel.endsWith('-polo.png'))check(new Set(seen).size>1,rel+' has no animated/grid variation');
 }
}
for(const [id,skin]of Object.entries(manifest.characters.skins)){
 const sheet=p.read('packages/web/public/'+skin.sheet),mask=p.read('packages/web/public/'+skin.polo);check(sheet.width===192&&sheet.height===792,id+' worker size');check(mask.width===192&&mask.height===792,id+' mask size');
 let mismatch=0;for(let i=0;i<mask.data.length;i+=4)if(mask.data[i+3]&&!mask.data.subarray(i,i+4).equals(sheet.data.subarray(i,i+4)))mismatch++;check(!mismatch,id+' mask/base mismatch '+mismatch);
 for(const [file,im]of [[skin.sheet,sheet],[skin.polo,mask]]){const old=PNG.sync.read(execFileSync('git',['show','HEAD:packages/web/public/'+file]));check(p.crop(im,0,0,192,648).data.equals(p.crop(old,0,0,192,648).data),file+' modified original rows 1–9');}
}
const oldManifest=JSON.parse(execFileSync('git',['show','HEAD:packages/web/public/office/manifest.json']));
function keep(old,current,at='manifest'){for(const [k,v]of Object.entries(old)){check(k in current,at+'.'+k+' removed');if(v&&typeof v==='object'&&!Array.isArray(v)&&current[k])keep(v,current[k],at+'.'+k);else if(typeof v==='string'&&v.startsWith('office/'))check(v===current[k],at+'.'+k+' path changed');}}keep(oldManifest,manifest);
check(manifest.characters.frame.rows===11,'worker row metadata');check(manifest.characters.bouncer.rows===10,'HR row metadata');check(manifest.layout.iconsUi.order.length===42,'UI icon order');
for(const section of ['a','b','c','d'])check(fs.existsSync('docs/art-review/round6-'+section+'.png'),'Missing contact sheet '+section);
const result={checks,errors,changedPngs:files.length,workers:Object.keys(manifest.characters.skins).length,layouts:layouts.length,notes};fs.writeFileSync('docs/art-review/round6-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(checks+' art checks, '+errors.length+' errors; '+files.length+' changed/new PNGs; '+layouts.length+' registered layouts');for(const e of errors)console.error('  ✗ '+e);process.exit(errors.length?1:0);
