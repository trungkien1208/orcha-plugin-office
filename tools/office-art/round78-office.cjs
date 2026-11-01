// Generated Cozy Office sprites finished at the exact consumer frame sizes.
const fs=require('node:fs'),r=require('./round78.cjs'),s=require('./round78-scenes.cjs');
const {p,asset,put,flush,contact,existing,R,box,line,poly,oval,disc,text,clear}=r;
const {blank,copy,crop,sample,read,get,set,bbox,rgb}=p;
const prefix='theme-office/';
function clean(im){for(let i=0;i<im.data.length;i+=4)if(im.data[i+3]<245)im.data[i+3]=0;return im;}
function fit(raw,w,h,margin=1){const b=bbox(raw);if(!b)throw Error('Empty generated object');let im=crop(raw,...b);let z=Math.min((w-margin*2)/im.width,(h-margin)/im.height);im=p.outline(s.lock(sample(im,Math.max(1,Math.round(im.width*z)),Math.max(1,Math.round(im.height*z))),[],true));let out=blank(w,h);copy(im,out,Math.floor((w-im.width)/2),h-im.height);return out;}
function orderedBounds(raw,count,cols){const groups=p.componentBounds(raw).slice(0,count).sort((a,b)=>(a.y0+a.h/2)-(b.y0+b.h/2));if(groups.length!==count)throw Error('Expected '+count+' sprite silhouettes, found '+groups.length);const out=[];for(let row=0;row<count/cols;row++)out.push(...groups.slice(row*cols,row*cols+cols).sort((a,b)=>a.x0-b.x0));return out;}
function object(source,file,w,h,n=1,cols=n,rows=1){const raw=clean(read(s.src+source+'.png')),bounds=source==='office-cat'?orderedBounds(raw,12,4):null;
 return asset(prefix+file,w,h,(im,f)=>{let b=bounds?.[f];let c=b?crop(raw,b.x0,b.y0,b.w,b.h):crop(raw,Math.round(f%cols*raw.width/cols),Math.round(Math.floor(f/cols)*raw.height/rows),Math.round(raw.width/cols),Math.round(raw.height/rows));if(['office-window','office-bench-pack','office-boxes'].includes(source)){const bb=bbox(c);c=p.outline(s.lock(sample(crop(c,...bb),im.width-2,im.height-2),[],true));copy(c,im,1,2);}else copy(fit(c,im.width,im.height),im,0,0);},n,cols,rows);
}
function wood(im,base='skin'){R(im,0,0,im.width,im.height,base);for(let y=0;y<im.height;y+=8){line(im,0,y,im.width-1,y,'skinD');line(im,0,y+1,im.width-1,y+1,'cream');for(let x=(y%16?16:0);x<im.width;x+=32)line(im,x,y,x,y+7,'skinD');}for(let j=0;j<im.width*im.height/80;j++){let x=(j*19+3)%im.width,y=(j*13+3)%im.height;line(im,x,y,Math.min(im.width-1,x+3+j%4),y,j%2?'skinD':'skin');}}
function nativeFloor(){
 asset(prefix+'tiles/floor.png',32,32,im=>wood(im));
 asset(prefix+'tiles/aisle.png',32,32,im=>{R(im,0,0,32,32,'cream');for(let y=0;y<32;y++)for(let x=0;x<32;x++)if((x+y)%4===0)R(im,x,y,1,1,'grout');R(im,1,0,2,32,'skirt');R(im,29,0,2,32,'skirt');for(let y=0;y<32;y+=4){R(im,4,y,1,2,'skinD');R(im,27,y+2,1,2,'skinD');}});
 asset(prefix+'tiles/wall.png',96,96,im=>{R(im,0,0,96,96,'cream');R(im,0,0,96,1,'o');R(im,0,1,96,1,'white');R(im,0,79,96,1,'skinD');R(im,0,80,96,15,'skin');R(im,0,81,96,2,'cream');R(im,0,92,96,3,'skinD');R(im,0,95,96,1,'o');for(let x=4;x<96;x+=19){line(im,x,86,x+8,86,'skinD');line(im,x+3,89,x+11,89,'skinD');}});
 r.m.layout.officeWall={left:16,right:16,top:16,bottom:32};
 asset(prefix+'objects/banner.png',256,32,im=>{line(im,0,3,255,3,'brown');for(let j=0;j<12;j++){let x=5+j*21;poly(im,[[x,4],[x+17,4],[x+16,23+j%2*3],[x+8,29],[x,24]],j%3===0?'skirt':j%3===1?'cream':'panel');line(im,x+2,6,x+15,6,'white');line(im,x+14,8,x+14,23,'edge');} // blank pennants, text supplied by the app
 });
 asset(prefix+'ui/tag-closed.png',64,16,im=>{line(im,10,0,12,4,'brown');line(im,54,0,52,4,'brown');box(im,1,4,62,12,'skin');R(im,3,5,58,1,'cream');R(im,3,14,58,1,'skinD');text(im,'CLOSED',20,8,'brown');for(const x of [5,58])R(im,x,9,1,1,'o');});
}
function openingDoor(){let door=existing(prefix+'objects/door.png');asset(prefix+'objects/door-open.png',128,64,(im,f)=>{if(!f){copy(door,im,0,0);return;}box(im,2,1,28,63,'brown');box(im,5,4,22,58,'monitor');R(im,5,57,22,5,'skin');R(im,5,59,22,1,'cream');let w=[26,19,11,3][f];let panel=crop(door,5,3,22,59);panel=sample(panel,w,59);copy(panel,im,5,3);line(im,4,2,4,63,'cream');line(im,28,2,28,63,'skinD');line(im,5+w,3,5+w,61,'o');R(im,5+w-2,34,1,3,'cream');},4);}
const objects=[
 ['office-window','objects/window-day.png',192,48,2],
 ['office-poster','objects/poster-recruit.png',48,32],
 ['office-door','objects/door.png',32,64],
 ['office-boss-office','objects/boss-office.png',192,96],
 ['office-plant','objects/plant.png',32,48],
 ['office-plant-hanging','objects/plant-hanging.png',32,48],
 ['office-bookshelf','objects/bookshelf.png',64,64],
 ['office-whiteboard','objects/whiteboard.png',96,48],
 ['office-coffee-machine','objects/coffee-machine.png',64,48,2],
 ['office-desk-lamp','objects/desk-lamp.png',16,24],
 ['office-rug','objects/rug.png',128,64],
 ['office-sofa','objects/sofa.png',96,48],
 ['office-coffee-table','objects/coffee-table.png',48,32],
 ['office-cat','characters/office-cat.png',128,96,12,4,3],
 ['office-bench-pack','objects/bench-pack.png',576,64,4],
 ['office-boxes','objects/boxes.png',288,48,2],
];
function floor(partial=false){
 nativeFloor();
 for(const name of ['city-day','city-dusk'])if(fs.existsSync(s.src+name+'.png'))put(prefix+'background/'+name+'.png',s.scene(name,768,224,[],true));
 for(const args of objects){if(partial&&!fs.existsSync(s.src+args[0]+'.png'))continue;object(...args);}
 if(fs.existsSync(s.src+'office-door.png'))openingDoor();
 if(fs.existsSync(s.src+'office-hr.png'))character('office-hr','bouncer');else if(!partial)throw Error('HR image source missing');
 r.m.themes.office.objects.plantDead='office/'+prefix+'objects/plant.png';
 r.m.themes.office.objects.kpiBoard='office/'+prefix+'objects/whiteboard.png';
 flush();if(!partial)contact('r8-batch4');
}
function character(source,name){
 const raw=clean(read(s.src+source+'.png')),out=blank(192,720),bounds=orderedBounds(raw,40,4);
 // Segment each known row before resizing; no frame can borrow pixels from its neighbour.
 for(let f=0;f<40;f++){
  const b=bounds[f];let c=crop(raw,b.x0,b.y0,b.w,b.h);
  if(name==='boss'&&f>=12&&f<36){
   // The generated action rows end at the hips. Keep their original faces,
   // cardigan, hands and props; extend with the generated walking legs.
   if(f===16||f===17){clear(c,0,0,18,c.height);const bb=bbox(c);c=crop(c,...bb);}
   let sum=0,n=0;for(let y=c.height-6;y<c.height;y++)for(let x=0;x<c.width;x++)if(get(c,x,y)[3]){sum+=x;n++;}
   const hip=sum/n,scale=.34,body=crop(c,0,0,c.width,c.height-12),bodySmall=p.outline(s.lock(sample(body,Math.round(body.width*scale),Math.round(body.height*scale)),[],true));
   const legFrame=r.cell(out,(f===16||f===17)?4:0),legs=crop(legFrame,14,54,20,18),height=bodySmall.height+14,y=72-height,dx=Math.round(24-hip*scale);
   copy(legs,out,f%4*48+14,Math.floor(f/4)*72+54);copy(bodySmall,out,f%4*48+dx,Math.floor(f/4)*72+y);
  }else{c=fit(c,46,58);copy(c,out,f%4*48+1,Math.floor(f/4)*72+14);}
 }
 put(prefix+'characters/'+name+'.png',out,40,4,10);
 const base=name==='boss'?r.m.characters.boss:r.m.characters.bouncer;
 r.m.layout.animations[name==='boss'?'officeBoss':'officeBouncer'].poses=base?.animations||r.m.characters.animations;
 return out;
}
function ui(){
 asset(prefix+'ui/logo.png',64,64,im=>{poly(im,[[10,2],[53,2],[61,10],[61,53],[53,61],[10,61],[2,53],[2,10]],'skirt');poly(im,[[11,5],[52,5],[58,11],[58,52],[52,58],[11,58],[5,52],[5,11]],'cream');line(im,13,10,50,10,'skinD');text(im,'EASY',16,18,'skirt',2);text(im,'JOB',20,33,'brown',2);line(im,13,50,50,50,'skinD');for(const x of [10,52]){line(im,x,25,x,39,'skirt');poly(im,[[x,30],[x-4,26],[x-5,29],[x,34]],'skirt');poly(im,[[x,35],[x+4,30],[x+5,33],[x,39]],'skirt');}});
 asset(prefix+'ui/favicon-32.png',32,32,im=>{poly(im,[[6,1],[25,1],[31,7],[31,25],[25,31],[6,31],[1,25],[1,7]],'skirt');box(im,4,4,24,24,'cream');text(im,'E',7,8,'skirt',3);text(im,'J',19,16,'brown',2);});
 r.actionIcons(true);
 asset(prefix+'ui/map-frame.png',96,96,im=>{R(im,0,0,96,96,'skin');clear(im,12,12,72,72);for(const y of [3,6,89,92]){line(im,8,y,87,y,'skinD');line(im,14,y-1,69,y-1,'cream');}for(const x of [3,6,89,92]){line(im,x,9,x,86,'skinD');line(im,x-1,20,x-1,68,'cream');}for(const [x,y,a,b]of [[0,0,11,11],[95,0,84,11],[0,95,11,84],[95,95,84,84]])line(im,x,y,a,b,'brown');line(im,1,1,94,1,'cream');line(im,1,1,1,94,'cream');line(im,11,11,84,11,'brown');line(im,11,11,11,84,'brown');line(im,84,12,84,84,'cream');line(im,12,84,84,84,'cream');line(im,0,95,95,95,'o');line(im,95,0,95,95,'o');for(const [x,y]of [[4,4],[89,4],[4,89],[89,89]])R(im,x,y,1,1,'brown');const plant=sample(existing(prefix+'objects/plant-hanging.png'),21,32);copy(plant,im,0,0);});
 r.m.layout.officeMapFrame={left:24,right:24,top:24,bottom:24};
 asset(prefix+'ui/bg-paper.png',128,128,im=>{R(im,0,0,128,128,'wall');for(let y=0;y<128;y++)for(let x=0;x<128;x++){if((x%8===0&&y%2===0)||(y%8===0&&x%2===0))R(im,x,y,1,1,'desk');}});
 asset(prefix+'ui/header-trim.png',64,12,im=>{for(let x=0;x<64;x++){let y=5+Math.round(Math.sin(x*Math.PI/32)*2);R(im,x,y,1,1,'skirt');}for(let x=0;x<64;x+=8){let y=5+Math.round(Math.sin(x*Math.PI/32)*2);poly(im,[[x,y],[x+3,y-4],[x+6,y-4],[x+4,y-1]],'skirt');poly(im,[[x+2,y+1],[x+4,y+4],[x+7,y+4],[x+5,y+1]],'alt');}});
 asset(prefix+'ui/panel-frame.png',48,48,im=>{poly(im,[[4,0],[43,0],[47,4],[47,43],[43,47],[4,47],[0,43],[0,4]],'skirt');poly(im,[[5,1],[42,1],[46,5],[46,42],[42,46],[5,46],[1,42],[1,5]],'wall');clear(im,8,8,32,32);R(im,5,2,38,1,'white');R(im,2,5,1,38,'white');R(im,5,45,38,1,'grout');R(im,45,5,1,38,'grout');});
 r.m.layout.officePanelFrame={left:8,right:8,top:8,bottom:8};
 const labels=[['TEA','BREAK'],['GOOD','VIBES'],['FOCUS'],['TEAM'],['CAM 01'],['EMPLOYEE','OF THE','MONTH']];
 asset(prefix+'ui/sticker-set.png',192,32,(im,f)=>{if(f===5){r.awardSticker(im,true);return;}poly(im,[[5,1],[27,1],[31,5],[31,26],[27,30],[5,30],[1,26],[1,5]],f%2?'cream':'wall');line(im,7,4,25,4,'skirt');labels[f].forEach((t,j)=>text(im,t,Math.floor((32-t.length*4)/2),f===4?5:10+j*6,'brown'));if(f===4){box(im,5,16,21,10,'panel');box(im,8,14,7,3,'skirt');let h=blank(16,16);r.heart(h);copy(sample(h,9,9),im,12,16);}if(f===2){line(im,6,22,26,22,'skirt');R(im,14,7,4,1,'skirt');}},6);
 asset(prefix+'ui/fx-crack.png',48,16,(im,f)=>{let x=8,y=8;for(let j=0;j<3;j++){let dx=3+f*2+j*2;line(im,x-dx,y-3-j,x-dx-1,y+j,'skirt');line(im,x+dx,y-3-j,x+dx+1,y+j,'skirt');}R(im,7,1,2,2,f===1?'cream':'panel');},3);
 asset(prefix+'ui/fx-zap.png',48,16,(im,f)=>{for(const [x,y,z]of [[7,6,3+f%2],[12,12,2],[2,12,1]])poly(im,[[x,y-z],[x+1,y-1],[x+z,y],[x+1,y+1],[x,y+z],[x-1,y+1],[x-z,y],[x-1,y-1]],f===1?'white':'cream');},3);
 const boss=character('office-boss','boss');
 // Portrait uses the generated manager portrait, preserving the matching outfit and hair.
 object('office-boss-portrait','characters/boss-portrait.png',64,64);
 put(prefix+'gate/lobby-day.png',s.scene('office-lobby',640,360,[],true));
 const gateRaw=read(s.src+'office-gate-open.png');asset(prefix+'gate/gate-open.png',768,192,(im,f)=>copy(s.lock(sample(crop(gateRaw,f*gateRaw.width/4,0,gateRaw.width/4,gateRaw.height),192,192),[],true),im,0,0),4);
 flush();contact('r8-batch5');
}
if(require.main===module){if(process.argv[2]==='J')floor();if(process.argv[2]==='partial')floor(true);if(process.argv[2]==='K')ui();}
module.exports={clean,fit,object,wood,floor,character,ui};
