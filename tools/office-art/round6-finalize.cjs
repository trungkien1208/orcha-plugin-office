// Register legacy sheets without changing their existing consumer-facing keys.
const fs=require('node:fs'),{execFileSync}=require('node:child_process');
const r=require('./round6.cjs'),p=r.p;
const oldFrames={
 'objects/window-night.png':[96,48,2,2,1],'objects/gong.png':[64,48,3,3,1],
 'objects/cctv.png':[16,16,2,2,1],'ui/marker-needs.png':[16,24,2,2,1],
 'ui/icons-16.png':[16,16,14,7,2],'ui/icons-32.png':[32,32,14,7,2],
 'ui/fx-sleep.png':[16,24,3,3,1],'ui/fx-poof.png':[32,32,3,3,1],
 'ui/fx-smoke.png':[32,32,3,3,1], 'characters/boss.png':[48,72,40,4,10]
};
for(const name of ['stars','jolt','heart','crack','zap'])oldFrames['ui/fx-'+name+'.png']=[16,16,3,3,1];
const refs=new Set();function walk(v){if(typeof v==='string'&&v.startsWith('office/')&&v.endsWith('.png'))refs.add(v.slice(7));else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(r.m);
for(const file of refs){if(Object.values(r.m.layout.animations).some(v=>v.sheet==='office/'+file))continue;const im=r.existing(file);r.register(file,...(oldFrames[file]||[im.width,im.height,1,1,1]));}
r.saveManifest();
const sourceDir='docs/art-review/round6-sources';
fs.writeFileSync(sourceDir+'/README.md',`# Round 6 source art\n\nThe built-in image_gen tool generated bouncer.png and the three compound panoramas. Production finishing uses pngjs in tools/office-art/round6.cjs, the same native sampling, palette locking and 1px contour workflow used in Rounds 1–2. The worker extensions preserve the first nine rows and articulate the existing cast artwork; modular props, UI glyphs and effect loops are drawn on the native grid. No image-generation API or CLI was used.\n\nRun sections A, B, C, D in order, followed by round6-finalize.cjs and round6-validate.cjs. Contact sheets are docs/art-review/round6-{a,b,c,d}.png.\n\nThe live checklist consolidated three separate action icons into act-icons.png during production, reducing its checker total from 106 to 104. The original three files are delivered as compatibility assets as well.\n`);
console.log('Registered '+Object.keys(r.m.layout.animations).length+' sprite layouts; all legacy paths retained');
