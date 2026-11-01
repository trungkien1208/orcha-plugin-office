// Replace only the award cell; verify the first five stickers stay pixel-identical.
const fs=require('node:fs'),assert=require('node:assert/strict'),{PNG}=require('pngjs');
const r=require('./round78.cjs'),{p,R,text,awardSticker}=r;
const {blank,read,save,set,get,crop,copy,sample}=p;
const sheets=[];
for(const office of [false,true]){
 const file=(office?'theme-office/':'')+'ui/sticker-set.png';
 const before=read(p.ROOT+'/'+file),out=crop(before,0,0,192,32),award=blank(32,32);
 assert.equal(before.width,192);assert.equal(before.height,32);awardSticker(award,office);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++)set(out,160+x,y,get(award,x,y));
 assert.deepEqual(crop(out,0,0,160,32).data,crop(before,0,0,160,32).data);
 assert.notDeepEqual(crop(out,160,0,32,32).data,crop(before,160,0,32,32).data);
 save(out,file);sheets.push({office,im:out});
 console.log(file+': 192x32; first five stickers unchanged; award reads STAR / STAFF');
}
const review=blank(800,440);R(review,0,0,800,440,'wall');
text(review,'STICKER FIX / NATIVE AND 4X NEAREST',16,12,'o',2);
for(let i=0;i<2;i++){
 const {office,im}=sheets[i],y=42+i*196;
 text(review,office?'COZY OFFICE':'COMPOUND',16,y,'o',2);
 copy(im,review,16,y+20);copy(sample(im,768,128),review,16,y+56);
}
fs.writeFileSync('docs/art-review/stickers-fix.png',PNG.sync.write(review));
