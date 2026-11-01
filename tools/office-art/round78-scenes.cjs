const fs=require('node:fs'),{PNG}=require('pngjs');
const r=require('./round78.cjs'),{p,asset,put,flush,contact,existing,R,box,line,poly,oval,text,clear,wire,heart,bolt}=r;
const {blank,read,crop,copy,sample,get,set,rgb}=p;
const src='docs/art-review/round78-sources/';
function lock(im,extra=[],office=false){const cs=[...p.colours,...extra.map(rgb)];for(let i=0;i<im.data.length;i+=4){if(im.data[i+3]<160){im.data[i+3]=0;continue;}let c=[...im.data.subarray(i,i+3)];if(office&&c[1]>c[0]*1.03&&c[1]>c[2]*1.07&&Math.max(...c)-Math.min(...c)>20){const light=c[0]*.21+c[1]*.72+c[2]*.07;c=rgb(light>166?'#c9d8d4':light>118?'#bfcfcb':light>62?'#8fa3a0':'#2f3a4f');}else c=p.nearest(c,cs);im.data.set([...c,255],i);}return im;}
function scene(name,w,h,extra=[],office=false){return lock(sample(read(src+name+'.png'),w,h),extra,office);}
function stamp(im,label,color='red',scale=3){poly(im,[[4,5],[im.width-8,2],[im.width-2,8],[im.width-3,im.height-7],[im.width-9,im.height-2],[3,im.height-4],[1,im.height-9]],color);box(im,7,7,im.width-14,im.height-14,color);box(im,10,10,im.width-20,im.height-20,color);line(im,12,12,im.width-14,12,'cream');line(im,12,im.height-13,im.width-14,im.height-13,'cream');const tw=label.length*4*scale;text(im,label,Math.floor((im.width-tw)/2),Math.floor((im.height-5*scale)/2),'cream',scale);for(let i=0;i<im.width/3;i++){let x=5+i*23%(im.width-10),y=5+i*13%(im.height-10);R(im,x,y,1,1,i%2?(color==='red'?'redD':'grout'):color);}}
function landing(){
 put('landing/hero.png',scene('hero',960,360));
 let floor=scene('feature-floor',240,160);copy(crop(existing('ui/marker-needs.png'),0,0,16,24),floor,132,16);put('landing/feature-floor.png',floor);
 put('landing/feature-chat.png',scene('feature-chat',240,160));
 let hp=scene('feature-hp',240,160,['#2fae6c']);
 // Replace the generated meters with the exact native UI vocabulary.
 box(hp,82,9,42,8,'night');box(hp,82,21,42,7,'night');R(hp,84,11,37,4,'#2fae6c');R(hp,84,23,30,3,'cyan');for(let x=89;x<122;x+=6){R(hp,x,11,1,4,'o');R(hp,x,23,1,3,'o');}put('landing/feature-hp.png',hp);
 put('landing/feature-hr.png',scene('feature-hr',240,160));
 asset('landing/wordmark.png',320,80,im=>stamp(im,'EASY JOB','red',8));
 const og=blank(1200,630);R(og,0,0,1200,630,'night');copy(sample(existing('landing/hero.png'),1200,450),og,0,0);let wm=sample(existing('landing/wordmark.png'),640,160);copy(wm,og,280,398);text(og,'RUN YOUR AI AGENTS LIKE A COMPOUND BOSS',152,582,'cream',6);put('landing/og-image.png',og);
 asset('landing/divider-wire.png',64,16,im=>wire(im));
 asset('landing/bg-tile.png',64,64,im=>{R(im,0,0,64,64,'night');for(let j=0;j<64;j+=16){R(im,0,j,64,1,'o');for(let x=(j%32?16:0);x<64;x+=32){R(im,x,j,1,16,'o');R(im,x+3,j+3,2,1,'monitor');}}});
 const app=existing('ui/logo.png');R(app,10,14,45,37,'red');text(app,'E',12,16,'cream',6);text(app,'J',36,27,'cream',5);
 for(const [file,size]of [['app-icon-192',192],['app-icon-512',512],['apple-touch-180',180]])put('ui/'+file+'.png',sample(app,size,size));flush();
}
function gate(){
 let im=scene('gate-night',640,360);put('gate/gate-night.png',im);
 // Independently generated animation source, one square panel per opening state.
 const raw=read(src+'gate-open.png');
 asset('gate/gate-open.png',768,192,(im,f)=>{copy(lock(sample(crop(raw,Math.round(f*raw.width/4),0,Math.round(raw.width/4),raw.height),192,192)),im,0,0);},4);
 asset('gate/badge-card.png',160,100,im=>{poly(im,[[5,1],[154,1],[159,6],[159,93],[153,99],[6,99],[1,94],[1,6]],'wall');box(im,62,5,36,7,'edge');R(im,65,7,30,3,'night');R(im,3,17,154,8,'red');text(im,'EASY JOB / STAFF',12,19,'cream');box(im,8,30,40,40,'panel');oval(im,28,43,7,7,'wall');poly(im,[[15,66],[17,55],[22,52],[34,52],[39,55],[41,66]],'wall');line(im,59,40,145,40,'o');line(im,59,55,138,55,'skirt');text(im,'NAME',59,33,'skirt');text(im,'TEAM',59,48,'skirt');for(let x=12;x<146;x+=3){const h=10+(x*7%3);R(im,x,77,(x%7===0?2:1),h,'o');}text(im,'000  /  EASY JOB',45,92,'hi');});
 asset('gate/stamp-approved.png',128,48,im=>{stamp(im,'APPROVED','skirt',3); // status green from the canonical style guide
  for(let i=0;i<im.data.length;i+=4){const c=im.data.subarray(i,i+3);if(c[0]===143&&c[1]===163&&c[2]===160)im.data.set([47,174,108],i);}
 });
 asset('gate/stamp-denied.png',128,48,im=>stamp(im,'DENIED','red',4));
 asset('gate/loading-frame.png',96,16,im=>{box(im,1,2,94,12,'hi');R(im,3,3,90,1,'panel');box(im,4,5,88,7,'night');for(const x of [2,93]){R(im,x,5,1,7,'edge');R(im,x,4,1,1,'wall');}});
 asset('gate/loading-fill.png',16,8,im=>{R(im,0,0,16,8,'cream');for(let y=0;y<8;y++)for(let x=0;x<16;x++)if((x+y)%16<7)R(im,x,y,1,1,'o');R(im,0,0,16,1,'edge');});
 asset('gate/turnstile-anim.png',256,64,(im,f)=>{const source=read(src+'turnstile.png');copy(lock(sample(crop(source,Math.round(f*source.width/4),0,Math.round(source.width/4),source.height),64,64)),im,0,0);},4);
 r.m.layout.gateLoading={left:6,right:6,top:5,bottom:4};flush();
}
if(require.main===module){if(process.argv[2]==='G')landing();if(process.argv[2]==='H'){gate();contact('r7-batch3',[...Object.values(r.m.landing),...Object.values(r.m.gate),'office/ui/app-icon-192.png','office/ui/app-icon-512.png','office/ui/apple-touch-180.png'].map(s=>s.replace(/^office\//,'')));}}
module.exports={src,scene,lock,stamp,landing,gate};
