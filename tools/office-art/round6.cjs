// Final-batch native-grid finishing. Uses the same pngjs renderer as Rounds 1–2.
// Run a section with: node tools/office-art/round6.cjs A
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {PNG}=require('pngjs'),p=require('./finish.cjs');
const {blank,get,set,copy,crop,read,save,rgb}=p;
const C={o:'#2f3a4f',floor:'#c9d8d4',alt:'#bfcfcb',grout:'#aebdb9',wall:'#e3ece9',skirt:'#8fa3a0',desk:'#dfe5e4',edge:'#9aa8ad',panel:'#b7c4c8',black:'#2a2f38',hi:'#444b57',monitor:'#3b4560',red:'#c8322f',redD:'#9e2522',cream:'#fff3c4',white:'#ffffff',night:'#1d2747',cyan:'#3fd2e8',purple:'#6a4bd8',pink:'#e0559c',skin:'#f3c9a5',skinD:'#c98f6a',brown:'#8d5a3b',g:'#d0d0d0',gm:'#a0a0a0',gd:'#707070',gold:'#ffb020'};
const colors=Object.fromEntries(Object.entries(C).map(([k,v])=>[k,rgb(v)]));
const col=c=>colors[c]||rgb(c);
function R(im,x,y,w,h,c){x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)set(im,i,j,col(c));}
function box(im,x,y,w,h,c){R(im,x,y,w,h,'o');if(w>2&&h>2)R(im,x+1,y+1,w-2,h-2,c);}
function line(im,x,y,a,b,c='o'){x=Math.round(x);y=Math.round(y);a=Math.round(a);b=Math.round(b);let dx=Math.abs(a-x),sx=x<a?1:-1,dy=-Math.abs(b-y),sy=y<b?1:-1,e=dx+dy;for(;;){set(im,x,y,col(c));if(x===a&&y===b)break;const e2=2*e;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}
function disc(im,x,y,rx,ry,c){for(let j=-ry;j<=ry;j++)for(let i=-rx;i<=rx;i++)if(i*i/(rx*rx)+j*j/(ry*ry)<=1)set(im,Math.round(x+i),Math.round(y+j),col(c));}
function oval(im,x,y,rx,ry,c){disc(im,x,y,rx,ry,'o');disc(im,x,y,rx-1,ry-1,c);}
function poly(im,pts,c){const ys=pts.map(v=>v[1]);for(let y=Math.min(...ys);y<=Math.max(...ys);y++){const xs=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y))xs.push(xi+(y-yi)*(xj-xi)/(yj-yi));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2)for(let x=Math.ceil(xs[i]);x<=Math.floor(xs[i+1]);x++)set(im,x,y,col(c));}for(let i=0;i<pts.length;i++)line(im,...pts[i],...pts[(i+1)%pts.length],'o');}
function clear(im,x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)set(im,i,j,[0,0,0,0]);}
const fontText=fs.readFileSync('docs/art-review/scene.js','utf8').match(/const FONT=(\{[^;]+\});/)[1];
const FONT=vm.runInNewContext('('+fontText+')');
function text(im,t,x,y,c='o',s=1){for(const ch of t.toUpperCase()){FONT[ch]?.forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')R(im,x+i*s,y+j*s,s,s,c);}));x+=4*s;}}
function pseudo(im,x,y,w,rows,c='o'){for(let j=0;j<rows;j++)for(let k=0;k<Math.floor(w/5);k++){let n=(j*17+k*7)%4;R(im,x+k*5,y+j*4,2+n%2,1,c);if(n===0)R(im,x+k*5+1,y+j*4+1,1,1,c);}}
function rotate(im,angle,dx=0,dy=0){const out=blank(im.width,im.height),c=Math.cos(angle),s=Math.sin(angle);for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const xx=x-im.width/2-dx,yy=y-im.height/2-dy;set(out,x,y,get(im,Math.round(xx*c+yy*s+im.width/2),Math.round(-xx*s+yy*c+im.height/2)));}return out;}
function flip(im){const out=blank(im.width,im.height);for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)set(out,x,y,get(im,im.width-1-x,y));return out;}
const manifestPath=p.ROOT+'/manifest.json',m=JSON.parse(fs.readFileSync(manifestPath));
m.layout.animations||={};const delivered=[];
function register(file,fw,fh,count=1,columns=count,rows=1){const [folder,name]=file.split('/'),key=name.slice(0,-4).replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase());
 if(folder==='objects'||folder==='ui'||folder==='tiles')m[folder][key]='office/'+file;
 if(folder==='background'){m.backgrounds[key]='office/'+file;}
 m.layout.animations[key]={sheet:'office/'+file,frame:{width:fw,height:fh},count,frames:count,columns,rows};delivered.push(file);
}
function asset(file,w,h,draw,count=1,columns=count,rows=1){const fw=w/columns,fh=h/rows,out=blank(w,h);for(let f=0;f<count;f++){const cell=blank(fw,fh);draw(cell,f);copy(cell,out,f%columns*fw,Math.floor(f/columns)*fh);}save(out,file);register(file,fw,fh,count,columns,rows);return out;}
function existing(file){return read(p.ROOT+'/'+file);}
function cell(im,f,w=48,h=72,cols=4){return crop(im,f%cols*w,Math.floor(f/cols)*h,w,h);}
function saveManifest(){fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n');}
function flame(im,x,y,h,phase){const w=8+phase%3;poly(im,[[x-w,y],[x-w-2,y-7],[x-w+2,y-15],[x-5,y-h+9],[x-2,y-h],[x+2,y-h+8],[x+7,y-h+4],[x+6,y-12],[x+w,y-17],[x+w+2,y-6],[x+w-1,y]],'red');poly(im,[[x-w+3,y-2],[x-5,y-12],[x-3,y-h+13],[x+1,y-h+21],[x+3,y-10],[x+6,y-15],[x+6,y-2]],'skinD');poly(im,[[x-3,y-2],[x-4,y-8],[x,y-16],[x+3,y-6],[x+2,y-2]],'cream');}
function smoke(im,x,y,r,light='edge'){oval(im,x,y,r,Math.max(3,Math.round(r*.7)),light);oval(im,x-r+3,y+1,Math.max(3,r-2),Math.max(3,Math.round(r*.55)),light);R(im,x-3,y-r*.4,5,1,'panel');}
function bench(im,y=36,collapse=0){for(let i=0;i<4;i++){const x=7+i*33,dy=collapse*(i%2?3:1);box(im,x,y+dy,31,9,collapse>1?'hi':'desk');R(im,x+1,y+dy+6,29,2,'edge');if(collapse<3){box(im,x+5,y-20+dy*2,23,17,'monitor');box(im,x+7,y-18+dy*2,19,11,collapse?'night':'cyan');if(!collapse){R(im,x+9,y-16,10,1,'white');R(im,x+9,y-13,14,1,'white');}box(im,x+14,y-3+dy*2,4,3,'edge');}line(im,x+4,y+9+dy,x+4+collapse*3,y+23,'o');line(im,x+27,y+9+dy,x+27-collapse*3,y+23,'o');box(im,x+5,y+2+dy,14,3,'panel');} }
function ash(im,f){poly(im,[[3,42],[10,38],[21,37],[30,32],[51,33],[60,27],[78,30],[91,34],[110,33],[123,38],[140,40],[136,45],[14,46]],'hi');for(let i=0;i<17;i++){const x=12+i*7,y=37+(i*3)%8;R(im,x,y,3+i%4,1,i%2?'edge':'black');}poly(im,[[25,35],[23,22],[29,21],[34,34]],'black');poly(im,[[82,32],[81,23],[101,25],[98,34]],'black');line(im,37,36,57,33,'o');line(im,103,39,119,34,'o');for(let i=0;i<8;i++)R(im,15+i*15,39+i%3,2,1,(i+f)%3?'redD':'cream');}
function sectionA(){
 const source=read('docs/art-review/round6-sources/bouncer.png'),out=blank(192,720),groups=p.componentBounds(source).slice(0,40).sort((a,b)=>a.y0-b.y0),bounds=[];
 if(groups.length!==40)throw Error('Expected 40 HR source silhouettes');
 for(let row=0;row<10;row++)bounds.push(...groups.slice(row*4,row*4+4).sort((a,b)=>a.x0-b.x0));
 for(let f=0;f<40;f++){const b=bounds[f];
  let art=crop(source,b.x0,b.y0,b.w,b.h);const hh=f>=32&&f<=34?62:56,ww=Math.min(44,Math.round(art.width/art.height*hh));art=p.outline(p.paletteLock(p.sample(art,ww,hh)));
  if([0,1,2,3,12,13,14,15,24,25,26,27,35,38,39].includes(f)){const x=Math.min(ww-12,Math.floor(ww/2));box(art,x,26,11,9,'white');text(art,'HR',x+2,28,'o');}
  copy(art,out,f%4*48+Math.floor((48-ww)/2),Math.floor(f/4)*72+72-hh);
 }
 save(out,'characters/bouncer.png');m.characters.bouncer={...m.characters.bouncer,rows:10,columns:4,animations:{walkDown:[0,1,2,3],walkLeft:[4,5,6,7],walkUp:[8,9,10,11],reach:[12,13,14,15],grabLeft:[16,17],grabRight:[18,19],carryLeft:[20,21,22,23],carryDown:[24,25,26,27],carryUp:[28,29,30,31],toss:[32,33,34],dustOff:[36,37],spare:[35,38,39]}};register('characters/bouncer.png',48,72,40,4,10);
 m.characters.frame.rows=11;Object.assign(m.characters.animations,{lifted:[36,37],struggle:[38,39],carriedDown:[40,41],tossed:[42,43]});delete m.characters.animations.carried;
 for(const id of Object.keys(m.characters.skins)){
  const src=existing('characters/'+id+'.png'),mask=existing('characters/'+id+'-polo.png'),sheet=blank(192,792),polo=blank(192,792);copy(crop(src,0,0,192,648),sheet,0,0);copy(crop(mask,0,0,192,648),polo,0,0);
  const side=cell(src,5),sideM=cell(mask,5),front=cell(src,13),frontM=cell(mask,13);
  // Keep each worker's existing head, chest, lanyard and tail. Rebuild only articulated limbs.
  for(let n=0;n<8;n++){
   const face=n===4||n===5,orig=face?front:side,om=face?frontM:sideM,b=p.bbox(orig),body=blank(48,72),bm=blank(48,72),lift=n<4?7:8;
   const yHip=b[1]+Math.floor(b[3]*.72),xMid=Math.floor(b[0]+b[2]/2),headEnd=b[1]+Math.floor(b[3]*.43),skinSamples=[];
   for(let yy=b[1];yy<headEnd;yy++)for(let xx=b[0];xx<b[0]+b[2];xx++){const c=get(orig,xx,yy);if(c[3]&&['246,210,178','243,201,165','226,176,137','201,143,106','141,90,59'].includes(c.slice(0,3).join()))skinSamples.push(c);}
   const sk=skinSamples[Math.floor(skinSamples.length/2)]||col('skin');
   // Torso/head are translated as one unit, preserving masks pixel-for-pixel.
   copy(crop(orig,0,0,48,yHip+1),body,0,-lift);copy(crop(om,0,0,48,yHip+1),bm,0,-lift);
   const hip=yHip-lift;
   const leg=(x,dir,delta)=>{poly(body,[[x-3,hip-1],[x+3,hip-1],[x+3+dir*2,hip+10],[x+dir*6,hip+17+delta],[x-4+dir*6,hip+16+delta],[x-3+dir*2,hip+9]],'monitor');box(body,x-5+dir*6,hip+14+delta,8,4,'black');};
   if(face){leg(xMid-5,-1,n%2?1:-1);leg(xMid+5,1,n%2?-1:1);}else{leg(xMid-3,n===2?-2:0,n%2?2:0);leg(xMid+3,n===3?2:1,n%2?-3:2);}
   const shoulder=headEnd-lift+3;
   for(const sign of [-1,1]){const x=xMid+sign*8,handX=xMid+sign*(face?15:12),handY=shoulder-(n%2?10:7);poly(body,[[x,shoulder+2],[x+sign*4,shoulder+3],[handX+sign*2,handY],[handX-sign*2,handY-2]],'g');poly(bm,[[x,shoulder+2],[x+sign*4,shoulder+3],[handX+sign*2,handY],[handX-sign*2,handY-2]],'g');oval(body,handX,handY-2,3,3,'skin');for(let yy=handY-4;yy<=handY;yy++)for(let xx=handX-2;xx<=handX+2;xx++)if(get(body,xx,yy)[3]&&get(body,xx,yy).slice(0,3).join()!==col('o').join())set(body,xx,yy,sk);}
   // Tint layers contain cloth only; contours remain on the base.
   for(let yy=0;yy<72;yy++)for(let xx=0;xx<48;xx++){const v=get(bm,xx,yy);if(v[3]){if(v.slice(0,3).join()===col('o').join())set(bm,xx,yy,[0,0,0,0]);else set(body,xx,yy,v);}}
   let frame=body,frameM=bm;if(n>=6){const a=n===6?-.78:2.28;frame=rotate(body,a,0,-2);frameM=rotate(bm,a,0,-2);}
   copy(frame,sheet,n%4*48,648+Math.floor(n/4)*72);copy(frameM,polo,n%4*48,648+Math.floor(n/4)*72);
  }
  save(sheet,'characters/'+id+'.png');save(polo,'characters/'+id+'-polo.png');register('characters/'+id+'.png',48,72,44,4,11);register('characters/'+id+'-polo.png',48,72,44,4,11);
 }
 asset('objects/door-open.png',128,64,(im,f)=>{box(im,3,0,26,64,'edge');box(im,5,3,22,59,'night');if(f===0||f===3){copy(existing('objects/door.png'),im,f===3?1:0,0);if(f===3){line(im,0,10,2,14,'cream');line(im,29,12,31,8,'cream');}}else{const w=f===1?12:4;poly(im,[[5,3],[5+w,7],[5+w,59],[5,62]],'panel');line(im,7,7,7,57,'white');R(im,5+w-2,32,1,3,'o');R(im,6+w,59,19-w,2,'skirt');}},4);
 asset('objects/chair-spin.png',128,32,(im,f)=>{const src=existing(f%2?'objects/chair-front.png':'objects/chair-back.png');copy(f===2?flip(src):src,im,0,0);if(f===1||f===3){const small=p.sample(src,15,32);clear(im,0,0,32,32);copy(small,im,f===1?6:10,0);}line(im,1,10+f,4,8+f,'edge');line(im,28,21-f,31,18-f,'edge');},4);
 asset('ui/fx-dust.png',128,32,(im,f)=>{const points=[[8,24,5],[16,20,7],[24,23,5]];for(const [x,y,r]of points)smoke(im,x+(f-1)*(x<16?-1:1),y-f*3,Math.max(3,r-f),f%2?'wall':'panel');if(f>1){R(im,2,20-f*4,2,1,'edge');R(im,28,17-f*3,2,1,'edge');}},4);
 asset('ui/fx-shoe.png',16,16,im=>{poly(im,[[5,5],[9,4],[11,9],[14,10],[15,13],[2,14],[1,11],[4,10]],'black');line(im,3,12,13,12,'edge');R(im,6,7,3,1,'white');R(im,7,9,3,1,'white');});
 asset('ui/marker-out.png',32,16,(im,f)=>{box(im,0,3-f,16,11,'red');text(im,'OUT',2,6-f,'cream');},2);
 asset('objects/bench-ignite.png',576,64,(im,f)=>{bench(im,36);for(let j=0;j<=f;j++)flame(im,22+j*29,46,12+f*4,(f+j)%3);for(let j=0;j<5;j++){const x=20+(j*19+f*9)%105,y=6+(j*13+f*7)%25;line(im,x,y,x+2,y+2,'cream');}},4);
 asset('objects/bench-fire.png',864,80,(im,f)=>{bench(im,51);for(let j=0;j<5;j++)smoke(im,15+j*27,13+(j+f)%3*4,10,'hi');for(let j=0;j<8;j++)flame(im,10+j*17,64,32+(j*7+f*9)%25,j+f);},6);
 asset('objects/bench-collapse.png',576,64,(im,f)=>{if(f<3)bench(im,33+f*2,f+1);else ash(im,f);for(let j=0;j<3;j++)smoke(im,24+j*42,45-f*2,5+f,'panel');for(let j=0;j<3-f;j++)flame(im,26+j*44,51,14-f*2,f+j);},4);
 asset('objects/bench-ash.png',288,48,ash,2);
 asset('ui/fx-smoke-column.png',192,96,(im,f)=>{for(let j=0;j<5;j++)smoke(im,24+Math.round(Math.sin(j+f)*6),83-j*17+(f%2)*2,8+j,'hi');for(let j=0;j<4;j++)R(im,17+(j*7+f*3)%18,75-j*18,3,1,'edge');},4);
 asset('ui/fx-embers.png',96,32,(im,f)=>{for(let j=0;j<6;j++){const x=3+(j*7+f*5)%26,y=28-(j*9+f*6)%25;R(im,x,y,1,3,j%2?'red':'cream');R(im,x-1,y+2,3,1,'skinD');}},3);
 asset('objects/fire-alarm.png',32,16,(im,f)=>{box(im,3,3,10,12,'edge');oval(im,8,7,4,4,f?'redD':'red');R(im,6,5,2,1,f?'red':'cream');R(im,5,13,6,1,'black');if(!f){line(im,1,3,0,1,'red');line(im,14,3,15,1,'red');}},2);
 asset('objects/extinguisher.png',16,32,im=>{box(im,4,9,9,21,'red');R(im,5,11,2,16,'pink');box(im,6,5,5,5,'edge');R(im,8,3,6,2,'black');line(im,7,6,2,8);line(im,2,8,2,24);box(im,6,17,5,7,'cream');R(im,7,19,3,1,'red');R(im,3,30,11,1,'o');});
 asset('ui/tag-burnt.png',64,16,im=>{poly(im,[[1,4],[9,3],[12,5],[19,3],[33,4],[42,2],[47,5],[61,4],[63,13],[56,12],[49,14],[24,12],[18,14],[2,12]],'hi');R(im,8,7,45,4,'gd');for(let j=0;j<8;j++)R(im,5+j*7,6+j%4,2,1,'edge');});
}

function stageIcon(im,n,active=true){const c=active?'cyan':'edge';
 if(n===0){box(im,2,2,12,9,'white');poly(im,[[4,10],[7,10],[4,14]],'white');for(let j=0;j<3;j++)R(im,4+j*3,6,1,1,'o');}
 if(n===1){box(im,1,2,14,12,'night');line(im,3,5,6,7,c);line(im,6,7,3,9,c);R(im,8,10,4,1,'white');}
 if(n===2){poly(im,[[6,1],[10,1],[10,6],[14,13],[13,15],[3,15],[2,13],[6,6]],'wall');R(im,5,10,7,3,c);R(im,7,3,2,4,'panel');R(im,6,11,1,1,'white');}
 if(n===3){oval(im,7,6,5,5,'wall');line(im,10,10,14,14);line(im,11,10,15,14);line(im,5,6,6,7,'skirt');line(im,6,7,9,4,'skirt');}
 if(n===4){oval(im,8,8,7,7,'skirt');line(im,4,8,7,11,'white');line(im,7,11,12,5,'white');}
}
function sectionB(){
 asset('ui/hp-bar.png',32,8,im=>{box(im,0,0,32,8,'black');R(im,2,2,28,4,'night');R(im,2,1,28,1,'edge');R(im,2,6,28,1,'hi');R(im,30,2,1,4,'panel');});m.layout.hpBar={left:3,right:3,top:2,bottom:2,fill:{x:4,y:2,width:24,height:4}};
 asset('ui/hp-fill.png',24,12,(im,f)=>{const c=['skirt','gold','red'][f];R(im,0,0,24,4,c);R(im,0,0,24,1,['wall','cream','pink'][f]);R(im,0,3,24,1,['grout','skinD','redD'][f]);},3,1,3);
 asset('ui/select-marker.png',32,16,(im,f)=>{poly(im,[[3,2-f],[12,2-f],[12,6-f],[15,6-f],[8,13-f],[1,6-f],[3,6-f]],'cyan');line(im,4,3-f,11,3-f,'white');},2);
 asset('ui/select-ring.png',128,24,(im,f)=>{const x=32,y=13;disc(im,x,y,30,9,'o');disc(im,x,y,28,7,'cyan');disc(im,x,y,25,5,'o');for(let yy=0;yy<24;yy++)for(let xx=0;xx<64;xx++)if(((xx-x)**2/(24*24)+(yy-y)**2/(4*4))<1)set(im,xx,yy,[0,0,0,0]);for(let j=0;j<8;j++){const a=j*Math.PI/4+f*.15,lineX=Math.round(x+Math.cos(a)*29),lineY=Math.round(y+Math.sin(a)*8);R(im,lineX,lineY,2,1,'white');}},2);
 asset('ui/name-plate.png',24,12,im=>{poly(im,[[2,0],[21,0],[23,2],[23,9],[21,11],[2,11],[0,9],[0,2]],'wall');R(im,2,9,20,1,'panel');});m.layout.namePlate={left:4,right:4,top:3,bottom:3};
 asset('objects/team-sign-hanging.png',96,32,im=>{for(const x of [14,80]){line(im,x,0,x,10);for(let y=1;y<10;y+=3){box(im,x-1,y,3,3,'panel');}}box(im,0,10,96,20,'edge');box(im,3,13,90,14,'g');R(im,4,25,88,1,'gm');for(const x of [2,93])for(const y of [12,27])R(im,x,y,1,1,'white');R(im,6,30,84,1,'o');});m.layout.teamSignHanging={left:18,right:18,top:14,bottom:6,tint:{x:4,y:14,width:88,height:12}};
 asset('ui/fx-bubble-stage.png',80,16,(im,f)=>stageIcon(im,f),5);
}

function screw(im,x,y){R(im,x,y,2,2,'o');R(im,x,y,1,1,'white');}
function vent(im,x,y,w,n){for(let j=0;j<n;j++){R(im,x,y+j*3,w,1,'o');R(im,x,y+j*3+1,w,1,'panel');}}
function tube(im,f=0){box(im,0,3,64,11,'edge');R(im,3,5,58,1,'wall');for(const y of [7,10]){box(im,5,y,54,3,f===2?'panel':f===1?'wall':'white');R(im,7,y+1,49,1,f===2?'edge':f===1?'panel':'wall');}for(const x of [2,60])R(im,x,5,2,7,'hi');}
function fan(im,f,size=48){const s=size/48,cx=size/2,cy=21*s;box(im,cx-3,cy+14*s,6,9*s,'edge');box(im,cx-13*s,size-6,26*s,4,'hi');oval(im,cx,cy,17*s,17*s,'panel');
 for(let j=0;j<4;j++){const a=(j*Math.PI/2)+(f?Math.PI/4:0),coords=[[2,-2],[11,-7],[13,-3],[8,4],[2,3]].map(([x,y])=>[Math.round(cx+(x*Math.cos(a)-y*Math.sin(a))*s),Math.round(cy+(x*Math.sin(a)+y*Math.cos(a))*s)]);poly(im,coords,'skirt');}
 for(let r=6*s;r<17*s;r+=5*s){for(let a=0;a<Math.PI*2;a+=.06)set(im,Math.round(cx+Math.cos(a)*r),Math.round(cy+Math.sin(a)*r),col('edge'));}for(let j=0;j<8;j++){const a=j*Math.PI/4;line(im,cx,cy,cx+Math.cos(a)*16*s,cy+Math.sin(a)*16*s,'o');}oval(im,cx,cy,3*s,3*s,'hi');R(im,cx-1,cy-1,2,1,'white');}
function sectionC(){
 for(const name of ['compound-night','compound-night-2','compound-dusk']){
  let raw=read('docs/art-review/round6-sources/'+name+'.png'),b=p.bbox(raw);raw=crop(raw,...b);let art=p.outline(p.paletteLock(p.sample(raw,768,224)));save(art,'background/'+name+'.png');register('background/'+name+'.png',768,224);
 }
 asset('objects/razor-wire.png',64,16,im=>{line(im,0,13,63,13,'edge');line(im,0,4,63,4,'skirt');for(let x=0;x<64;x+=16){for(let a=0;a<Math.PI*2;a+=.08){const px=Math.round(x+8+Math.cos(a)*10),py=Math.round(8+Math.sin(a)*6);set(im,px,py,col('o'));if(a<Math.PI)set(im,px,py-1,col('panel'));}for(const [a,b]of [[3,3],[12,11]]){line(im,x+a-2,b-2,x+a+2,b+2,'edge');line(im,x+a+2,b-2,x+a-2,b+2,'o');}}});
 asset('objects/wall-lamp.png',32,32,(im,f)=>{box(im,6,1,5,29,'edge');poly(im,[[5,4],[12,4],[15,9],[2,9]],'hi');box(im,3,9,11,13,f?'skin':'cream');R(im,5,10,2,9,'white');line(im,4,16,12,16);line(im,8,9,8,21);box(im,2,22,13,3,'hi');},2);
 asset('objects/searchlight.png',512,64,(im,f)=>{const tip=16+f*30;for(let y=4;y<59;y++)for(let x=5;x<124;x++){const mid=10+(tip-10)*(59-y)/55,half=(59-y)*.45;if(Math.abs(x-mid)<half&&(x+y)%4===0)set(im,x,y,col('wall'));}poly(im,[[5,62],[8,51],[14,51],[18,62]],'hi');poly(im,[[7,51],[4,46],[16,41],[20,47]],'edge');line(im,7,46,17,43,'cream');},4);
 asset('objects/neon-sign.png',288,32,(im,f)=>{box(im,0,2,96,28,'night');line(im,4,6,91,6,f===1?'purple':'pink');line(im,4,26,91,26,'purple');text(im,'CASINO',12,11,f===2?'purple':'cyan',3);for(const x of [3,91]){R(im,x,9,2,13,f===1?'pink':'cyan');}R(im,43,30,3,2,'o');R(im,78,30,3,2,'o');},3);
 asset('objects/water-tank.png',32,48,im=>{for(const x of [6,24])box(im,x,32,3,16,'edge');oval(im,16,32,13,5,'edge');box(im,3,10,27,23,'panel');R(im,4,11,4,20,'wall');R(im,25,11,3,20,'edge');for(const y of [16,26])line(im,4,y,28,y,'edge');oval(im,16,10,13,5,'desk');oval(im,16,7,6,2,'edge');box(im,24,28,8,4,'edge');line(im,29,31,29,41);});
 asset('objects/satellite-dish.png',32,48,im=>{box(im,14,27,4,17,'edge');box(im,5,44,24,4,'hi');poly(im,[[3,6],[7,3],[26,17],[27,24],[21,31],[13,30],[7,24],[3,15]],'panel');poly(im,[[4,6],[10,7],[24,18],[25,24],[20,27],[12,25],[7,18]],'wall');line(im,10,25,27,9,'o');box(im,25,7,6,5,'hi');R(im,5,9,2,8,'white');});
 asset('objects/tangled-cables.png',32,48,im=>{box(im,1,0,30,10,'hi');box(im,4,3,6,4,'panel');for(let j=0;j<5;j++){const x=6+j*5;line(im,x,10,x+(j%2?3:-2),20+j*2,'o');line(im,x+(j%2?3:-2),20+j*2,3+j*5,34-j*2,'o');line(im,3+j*5,34-j*2,27-j*3,40+j,'o');line(im,27-j*3,40+j,7+j*3,45,'edge');}box(im,21,17,7,12,'edge');R(im,23,20,3,1,'red');});
 for(let v=1;v<=3;v++)asset('objects/banner-hanging-'+v+'.png',32,96,im=>{line(im,4,0,4,9);line(im,27,0,27,9);box(im,1,6,30,5,'brown');poly(im,[[4,11],[27,11],[27,90],[16,95],[4,90]],'red');R(im,24,12,3,78,'redD');line(im,6,13,6,88,'cream');line(im,23,13,23,88,'cream');for(let j=0;j<6;j++){const y=19+j*11;R(im,11,y,10,1,'cream');R(im,14+(v+j)%3,y-2,1,8,'cream');R(im,10,y+4,9,1,'cream');R(im,19-(j+v)%3,y+2,1,6,'cream');}R(im,14,91,4,1,'cream');});
 asset('objects/banner-wide-2.png',256,32,im=>{poly(im,[[0,3],[255,3],[250,15],[255,29],[0,29],[5,16]],'red');R(im,6,24,244,4,'redD');line(im,9,6,246,6,'cream');for(let j=0;j<24;j++){const x=10+j*10;R(im,x,11,6,1,'cream');R(im,x+2,10,1,11,'cream');R(im,x,16,6,1,'cream');R(im,x+5,13,1,8,'cream');}line(im,9,26,246,26,'cream');});
 for(const [n,kind]of ['kpi','target','team'].entries())asset('objects/poster-'+kind+'.png',32,48,im=>{box(im,1,0,30,47,'cream');R(im,2,1,28,8,'red');text(im,['KPI','100','TEAM'][n],n===2?8:10,3,'cream');if(n===0){line(im,7,34,7,15);line(im,7,34,26,34);for(let j=0;j<4;j++)R(im,10+j*4,29-j*4,3,5+j*4,j%2?'skirt':'red');line(im,10,24,24,12,'red');}else if(n===1){for(let r=11;r>=3;r-=4)oval(im,16,24,r,r,r%2?'red':'wall');line(im,18,22,28,12);poly(im,[[27,11],[28,16],[24,12]],'red');}else{for(let j=0;j<6;j++){const x=7+j%3*8,y=16+Math.floor(j/3)*12;oval(im,x,y,3,3,'skin');box(im,x-3,y+4,7,6,j%2?'monitor':'skirt');}}pseudo(im,6,39,21,2,'hi');screw(im,2,1);});
 asset('objects/tv-leaderboard.png',384,64,(im,f)=>{box(im,0,1,192,58,'black');box(im,4,5,184,49,'night');R(im,7,8,178,9,'red');text(im,'TOP TEAMS - DAILY KPI',13,10,'cream');for(let j=0;j<4;j++){const y=21+j*8;text(im,String(j+1),11,y,'cream');R(im,23,y,35,2,'panel');R(im,67,y,82-j*16,4,j===f?'cyan':'skirt');text(im,String(98-j*7),166,y,'wall');}R(im,92,59,8,3,'hi');R(im,79,62,35,2,'edge');R(im,181,56,2,1,'red');},2);
 asset('objects/ceiling-light.png',64,16,im=>tube(im));
 asset('objects/light-pool.png',96,64,im=>{for(let y=6;y<58;y++)for(let x=4;x<92;x++){const d=(x-48)**2/(44*44)+(y-33)**2/(25*25);if(d<1&&(x+y)%4===0&&(d<.7||(x+y*3)%8===0))set(im,x,y,col('wall'));}});
 asset('objects/tube-broken.png',192,16,(im,f)=>{tube(im,f);R(im,7,8,6,1,'hi');line(im,8,7,11,12,'o');if(f===0)R(im,16,8,37,1,'white');},3);
 asset('objects/bulb-bare.png',32,32,(im,f)=>{line(im,8,0,8,12);box(im,5,12,7,5,'edge');oval(im,8,22,6,7,f?'skin':'cream');line(im,6,21,8,24,'skinD');line(im,8,24,10,21,'skinD');R(im,7,25,2,3,'edge');R(im,4,18,2,4,f?'cream':'white');},2);
 asset('objects/stain-damp.png',64,32,im=>{poly(im,[[5,3],[20,1],[25,5],[37,3],[44,6],[58,5],[63,15],[56,18],[59,26],[47,28],[33,24],[21,30],[13,24],[2,24],[4,15],[0,9]],'grout');for(let j=0;j<23;j++)R(im,5+(j*17)%53,6+(j*11)%19,2,1,'skirt');line(im,18,15,17,27,'skirt');line(im,43,15,45,26,'skirt');});
 asset('objects/crack-wall.png',64,32,im=>{const pts=[[4,1],[17,7],[23,6],[32,15],[39,14],[48,25],[62,30]];for(let j=1;j<pts.length;j++){line(im,...pts[j-1],...pts[j],'o');line(im,pts[j-1][0],pts[j-1][1]+1,pts[j][0],pts[j][1]+1,'wall');}line(im,32,15,29,28);line(im,29,28,22,31);line(im,39,14,45,9);line(im,45,9,43,1);line(im,17,7,14,19);});
 asset('objects/notice-board.png',64,48,im=>{box(im,0,0,64,48,'brown');box(im,3,3,58,42,'skinD');for(let j=0;j<5;j++){const x=6+j%3*18,y=6+Math.floor(j/3)*20;box(im,x,y,15,18,'cream');R(im,x+6,y+1,2,2,'red');pseudo(im,x+2,y+5,11,3,'hi');}text(im,'RULES',23,40,'cream');screw(im,1,1);screw(im,60,44);});
 for(const kind of ['wear','dirty','cracked'])asset('tiles/floor-'+kind+'.png',32,32,im=>{copy(existing('tiles/floor.png'),im,0,0);if(kind==='cracked'){line(im,3,1,13,12,'skirt');line(im,13,12,11,19,'o');line(im,11,19,22,30,'skirt');line(im,11,19,1,24,'skirt');line(im,14,12,24,10,'skirt');}else{for(let j=0;j<(kind==='dirty'?30:12);j++){const x=2+(j*7)%28,y=2+(j*13)%28;R(im,x,y,kind==='dirty'?2:4,1,kind==='dirty'?'skirt':'grout');}}});
 asset('objects/floor-tape.png',32,8,im=>{R(im,0,0,32,8,'cream');for(let x=-8;x<40;x+=12)poly(im,[[x,7],[x+6,0],[x+11,0],[x+5,7]],'o');R(im,0,0,32,1,'o');R(im,0,7,32,1,'o');});
 asset('objects/leak-bucket.png',32,24,(im,f)=>{poly(im,[[2,12],[14,12],[12,23],[4,23]],'edge');oval(im,8,12,6,2,'panel');line(im,2,13,4,8,'o');line(im,4,8,12,8,'o');line(im,12,8,14,13,'o');R(im,5,15,2,6,'wall');poly(im,[[8,1+f*5],[6,5+f*5],[8,7+f*5],[10,5+f*5]],'cyan');if(f)line(im,6,12,10,12,'white');},2);
 asset('objects/fan-rusty.png',96,48,(im,f)=>{fan(im,f);for(const [x,y]of [[14,10],[32,13],[23,32],[12,43]])R(im,x,y,2,2,'brown');},2);
 asset('objects/generator.png',96,48,(im,f)=>{box(im,3,10,40,33,'hi');box(im,6,13,34,26,'skirt');R(im,7,14,32,2,'wall');box(im,8,18,16,17,'black');vent(im,10,20,12,5);box(im,28,18,9,12,'edge');oval(im,32,23,3,3,'cream');R(im,29,32,2,2,f?'redD':'red');box(im,1,40,7,6,'black');box(im,37,40,7,6,'black');box(im,12,5,23,6,'edge');box(im,17,2,12,4,'hi');box(im,40,24,7,17,'redD');R(im,42,25,3,2,'red');line(im,8,12,7-f,6,'o');if(f)line(im,1,16,0,12,'edge');},2);
 asset('objects/extension-mess.png',32,16,im=>{line(im,0,2,12,2);line(im,12,2,15,8);line(im,15,8,26,8);line(im,30,14,22,14);line(im,22,14,18,9);box(im,3,6,20,6,'wall');for(let j=0;j<4;j++){R(im,6+j*4,8,1,2,'o');R(im,8+j*4,8,1,2,'o');}R(im,20,7,2,2,'red');box(im,24,1,6,5,'panel');line(im,28,6,29,13);});
 asset('objects/locker-row.png',96,64,im=>{box(im,0,0,96,62,'edge');for(let j=0;j<4;j++){const x=2+j*23;box(im,x,2,22,58,'panel');R(im,x+1,3,2,55,'wall');R(im,x+19,3,2,55,'edge');vent(im,x+5,7,12,3);box(im,x+5,21,12,6,'wall');text(im,String(j+1),x+9,22);box(im,x+16,31,3,8,'hi');R(im,x+6,50,10,1,'edge');screw(im,x+3,56);}R(im,3,62,6,2,'o');R(im,87,62,6,2,'o');});
 asset('objects/shrine.png',64,48,(im,f)=>{box(im,3,12,26,34,'redD');poly(im,[[0,13],[5,7],[16,2],[27,7],[31,13]],'red');R(im,5,11,22,1,'cream');box(im,7,17,18,24,'brown');oval(im,16,23,5,6,'cream');poly(im,[[12,27],[20,27],[23,36],[9,36]],'skin');R(im,14,22,1,1,'o');R(im,18,22,1,1,'o');box(im,1,42,30,5,'red');oval(im,6,30,3,4,f?'red':'redD');oval(im,26,30,3,4,f?'redD':'red');box(im,12,37,9,5,'edge');for(const x of [14,17,19])line(im,x,36,x,31,'brown');R(im,16,29,1,1,'red');},2);
 asset('objects/money-counter-table.png',96,48,im=>{box(im,2,22,92,10,'brown');R(im,3,23,90,2,'skinD');box(im,8,32,5,16,'brown');box(im,83,32,5,16,'brown');for(let j=0;j<4;j++){const x=6+j*13;box(im,x,16-j%2*3,12,7,'skirt');R(im,x+4,17-j%2*3,3,5,'cream');R(im,x+1,20-j%2*3,10,1,'wall');}box(im,59,6,30,17,'edge');box(im,62,4,24,6,'hi');box(im,64,1,20,5,'skirt');R(im,70,2,4,3,'cream');box(im,62,11,11,5,'night');text(im,'99',64,11,'cyan');vent(im,77,12,9,2);box(im,62,20,25,5,'hi');R(im,67,21,14,1,'wall');});
 asset('objects/supervisor-podium.png',48,48,im=>{box(im,1,36,46,12,'edge');R(im,3,37,42,2,'wall');poly(im,[[7,18],[40,18],[37,38],[10,38]],'monitor');poly(im,[[3,15],[38,10],[45,18],[9,24]],'desk');line(im,9,23,44,18,'edge');box(im,15,10,15,11,'wall');R(im,19,8,7,3,'hi');pseudo(im,18,13,10,2,'edge');box(im,34,10,5,7,'red');});
 asset('objects/turnstile.png',64,48,im=>{box(im,3,15,15,30,'edge');box(im,44,15,16,30,'edge');poly(im,[[3,15],[8,10],[22,10],[18,17]],'wall');poly(im,[[44,15],[49,10],[63,10],[60,17]],'wall');box(im,5,18,10,6,'night');R(im,7,20,6,2,'cyan');line(im,16,26,47,29,'o');line(im,16,27,47,30,'panel');line(im,31,29,31,43,'o');line(im,32,29,33,43,'panel');line(im,31,29,23,19,'o');R(im,47,18,9,3,'red');R(im,6,42,10,2,'hi');});
 asset('objects/stacked-chairs.png',32,64,im=>{const ch=existing('objects/chair-front.png');for(let j=0;j<3;j++){const art=crop(ch,0,0,32,28);copy(art,im,0,30-j*14);}line(im,7,43,4,63);line(im,24,43,28,63);});
 asset('objects/water-jugs.png',32,64,im=>{for(let j=0;j<3;j++){const x=j===2?17:7,y=36-j*16;box(im,x+2,y,7,4,'monitor');poly(im,[[x+1,y+4],[x+9,y+4],[x+12,y+8],[x+12,y+24],[x-2,y+24],[x-2,y+8]],'panel');R(im,x,y+8,3,13,'wall');R(im,x+8,y+9,2,14,'edge');R(im,x-1,y+15,12,1,'edge');} });
 asset('objects/printer-big.png',32,64,im=>{box(im,2,26,28,37,'edge');R(im,3,27,26,3,'wall');box(im,4,34,24,11,'desk');R(im,7,36,17,1,'edge');box(im,4,48,24,11,'desk');R(im,7,50,17,1,'edge');copy(p.sample(existing('objects/printer.png'),32,45),im,0,0);R(im,3,61,5,3,'o');R(im,24,61,5,3,'o');});
 asset('objects/server-rack.png',32,64,im=>{box(im,1,0,30,64,'black');R(im,2,1,28,2,'edge');for(let j=0;j<5;j++){const y=6+j*11;box(im,4,y,24,10,'hi');vent(im,7,y+2,11,2);R(im,21,y+3,2,2,j%2?'cyan':'red');R(im,24,y+3,1,2,'skirt');R(im,7,y+7,10,1,'edge');}for(const x of [2,29])for(let y=5;y<60;y+=7)R(im,x,y,1,1,'panel');});
 asset('objects/plant-dead.png',32,48,im=>{poly(im,[[7,33],[26,33],[23,47],[10,47]],'brown');box(im,6,31,21,5,'skinD');line(im,16,31,15,9,'brown');line(im,16,20,26,13,'brown');line(im,16,24,5,19,'brown');poly(im,[[15,11],[6,8],[3,10],[9,15]],'skirt');poly(im,[[25,13],[30,16],[28,22],[25,19]],'brown');poly(im,[[6,20],[1,22],[3,28],[6,26]],'skirt');R(im,12,36,3,8,'skinD');});
 asset('objects/phone-tray.png',32,16,im=>{box(im,0,3,32,13,'edge');R(im,1,13,30,2,'hi');for(let j=0;j<7;j++){const x=2+j*4;box(im,x,1+j%2,4,11,'black');R(im,x+1,3+j%2,2,6,j%3?'cyan':'purple');R(im,x+1,10+j%2,1,1,'white');}});
 asset('objects/laptop-open.png',24,16,im=>{box(im,3,0,18,11,'monitor');box(im,5,2,14,7,'night');R(im,7,4,9,1,'cyan');R(im,7,6,5,1,'white');poly(im,[[3,10],[20,10],[23,15],[0,15]],'edge');for(let y=11;y<14;y+=2)R(im,5,y,13,1,'panel');});
 asset('objects/sim-cards.png',16,16,im=>{for(let j=0;j<3;j++){const x=1+j*3,y=1+j*3;poly(im,[[x,y],[x+6,y],[x+9,y+3],[x+9,y+8],[x,y+8]],'cream');box(im,x+2,y+3,5,4,'skinD');R(im,x+4,y+3,1,3,'brown');}});
 asset('objects/cash-small.png',16,16,im=>{for(let j=0;j<3;j++){box(im,1+j,9-j*3,12,5,'skirt');R(im,5+j,10-j*3,3,3,'cream');R(im,2+j,10-j*3,2,1,'wall');}});
 asset('objects/snack-pack.png',16,16,im=>{poly(im,[[2,1],[13,1],[12,4],[14,12],[13,15],[2,15],[1,12],[3,4]],'red');R(im,3,2,9,1,'cream');R(im,3,13,9,1,'cream');oval(im,8,8,4,3,'skin');R(im,6,7,2,1,'brown');R(im,9,9,1,1,'brown');});
 asset('objects/ashtray.png',16,16,im=>{oval(im,8,10,7,4,'edge');oval(im,8,8,6,3,'hi');R(im,4,7,2,1,'panel');line(im,8,8,13,3,'cream');R(im,12,3,2,2,'red');R(im,3,10,2,1,'black');});
 asset('objects/name-card.png',16,16,im=>{poly(im,[[2,5],[13,5],[15,13],[0,13]],'wall');R(im,3,8,9,1,'hi');R(im,5,10,6,1,'edge');line(im,13,5,13,12,'panel');});
 asset('objects/battery-lamp.png',16,16,im=>{box(im,3,10,11,5,'hi');R(im,10,11,2,2,'red');line(im,6,10,5,5);poly(im,[[2,6],[3,2],[10,1],[13,5]],'skirt');line(im,3,6,12,5,'cream');R(im,5,3,3,1,'wall');});
 asset('objects/desk-fan.png',32,24,(im,f)=>{const art=blank(24,24);fan(art,f,24);copy(p.outline(p.sample(art,16,24)),im,0,0);},2);
}

const iconsUiOrder=['search','settings','bell','sound-on','sound-off','send','attach','close','menu','chevron-left','chevron-right','expand','open-in-orcha','show-on-floor','remove','close-project','new-agent','new-project','filter','rec','tool','pencil','key-enter','key-esc','branch','commit','worktree','file','folder','diff','fuel','tab-chat','tab-changes','tab-files','tab-setup','warning','check','cross','push','pull','spare-1','spare-2'];
function stroke(im,x,y,a,b,c='wall'){for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])line(im,x+dx,y+dy,a+dx,b+dy,'o');line(im,x,y,a,b,c);}
function uiIcon(im,name){
 const folder=()=>{poly(im,[[1,4],[6,4],[8,6],[14,6],[14,14],[1,14]],'panel');line(im,2,7,13,7,'wall');};
 const arrow=(down=false)=>{const y=down?12:3,dy=down?-4:4;stroke(im,8,2,8,13,'cyan');stroke(im,8,y,4,y+dy,'cyan');stroke(im,8,y,12,y+dy,'cyan');};
 if(name==='search'){oval(im,6,6,5,5,'wall');disc(im,6,6,3,3,'night');stroke(im,10,10,14,14);}
 if(name==='settings'){const pts=[];for(let j=0;j<32;j++){const a=j*Math.PI/16,r=j%4<2?7:5;pts.push([Math.round(8+Math.cos(a)*r),Math.round(8+Math.sin(a)*r)]);}poly(im,pts,'panel');oval(im,8,8,3,3,'night');R(im,7,6,2,1,'white');}
 if(name==='bell'){poly(im,[[2,11],[4,9],[4,5],[6,2],[10,2],[12,5],[12,9],[14,11]],'wall');R(im,5,12,6,1,'o');R(im,7,14,2,1,'cream');R(im,7,1,2,1,'o');}
 if(name==='sound-on'||name==='sound-off'){poly(im,[[1,6],[4,6],[8,2],[8,14],[4,10],[1,10]],'wall');if(name==='sound-on'){stroke(im,11,5,13,7,'cyan');stroke(im,13,7,13,9,'cyan');stroke(im,13,9,11,11,'cyan');}else{stroke(im,11,6,14,10,'red');stroke(im,14,6,11,10,'red');}}
 if(name==='send'){poly(im,[[1,2],[15,8],[1,14],[4,8]],'wall');line(im,5,8,13,8,'cyan');}
 if(name==='attach'){stroke(im,5,12,3,10);stroke(im,3,10,3,5);stroke(im,3,5,7,1);stroke(im,7,1,11,1);stroke(im,11,1,13,3);stroke(im,13,3,13,7);stroke(im,13,7,8,12);stroke(im,8,12,6,10);stroke(im,6,10,11,5,'cyan');}
 if(name==='close'||name==='cross'){stroke(im,3,3,12,12,name==='cross'?'red':'wall');stroke(im,12,3,3,12,name==='cross'?'red':'wall');}
 if(name==='menu')for(let j=0;j<3;j++)box(im,2+j*5,7,3,3,'wall');
 if(name==='chevron-left'||name==='chevron-right'){const l=name.endsWith('left');stroke(im,l?10:5,3,l?5:10,8);stroke(im,l?5:10,8,l?10:5,13);}
 if(name==='expand'){for(const [x,y,sx,sy]of [[2,2,1,1],[13,2,-1,1],[2,13,1,-1],[13,13,-1,-1]]){stroke(im,x,y,x+sx*4,y);stroke(im,x,y,x,y+sy*4);}}
 if(name==='open-in-orcha'){box(im,1,4,11,11,'panel');box(im,3,6,7,7,'night');R(im,7,3,7,6,'night');stroke(im,7,9,14,2,'cyan');stroke(im,9,2,14,2,'cyan');stroke(im,14,2,14,7,'cyan');}
 if(name==='show-on-floor'){poly(im,[[1,11],[8,7],[15,11],[8,15]],'panel');line(im,2,11,14,11,'edge');poly(im,[[4,3],[6,1],[10,1],[12,3],[12,6],[8,11],[4,6]],'red');R(im,7,3,3,2,'cream');}
 if(name==='remove'){box(im,4,4,9,11,'panel');R(im,2,3,13,2,'o');R(im,5,2,7,1,'wall');stroke(im,7,7,7,12,'hi');stroke(im,10,7,10,12,'hi');}
 if(name==='close-project'||name==='new-project'){folder();stroke(im,9,8,13,12,name==='new-project'?'cyan':'red');if(name==='new-project'){stroke(im,11,7,11,13,'cyan');stroke(im,8,10,14,10,'cyan');}else stroke(im,13,8,9,12,'red');}
 if(name==='new-agent'){oval(im,6,4,3,3,'wall');poly(im,[[2,9],[5,8],[8,8],[10,11],[10,15],[1,15]],'panel');stroke(im,12,7,12,13,'cyan');stroke(im,9,10,15,10,'cyan');}
 if(name==='filter'){poly(im,[[1,2],[14,2],[9,8],[9,13],[6,15],[6,8]],'panel');line(im,3,3,12,3,'white');}
 if(name==='rec'){oval(im,8,8,6,6,'redD');disc(im,8,8,4,4,'red');R(im,6,5,3,1,'pink');}
 if(name==='tool'){poly(im,[[2,1],[6,2],[7,5],[5,7],[13,12],[14,14],[12,15],[4,8],[1,7],[0,4]],'panel');R(im,1,1,3,4,'night');R(im,12,13,1,1,'white');}
 if(name==='pencil'){poly(im,[[2,11],[10,2],[13,1],[15,4],[5,14],[1,15]],'cream');line(im,4,11,12,3,'skinD');line(im,10,3,13,6);R(im,2,13,2,1,'o');}
 if(name==='key-enter'||name==='key-esc'){box(im,0,3,16,11,'hi');R(im,2,4,12,1,'panel');if(name==='key-esc')text(im,'ESC',2,7,'white');else{stroke(im,12,6,12,9,'white');stroke(im,12,9,4,9,'white');stroke(im,4,9,6,7,'white');stroke(im,4,9,6,11,'white');}}
 if(name==='branch'||name==='worktree'||name==='tab-changes'){stroke(im,4,3,4,13,'panel');stroke(im,5,9,12,6,'panel');stroke(im,12,6,12,2,'panel');for(const [x,y]of [[4,2],[4,13],[12,2]]){if(name==='worktree')box(im,x-2,y-1,5,4,'cyan');else oval(im,x,y,2,2,'cyan');}}
 if(name==='commit'){stroke(im,0,8,15,8,'panel');oval(im,8,8,4,4,'wall');disc(im,8,8,2,2,'night');}
 if(name==='file'||name==='tab-files'){if(name==='tab-files')box(im,1,4,10,12,'edge');poly(im,[[4,1],[10,1],[14,5],[14,14],[4,14]],'wall');line(im,10,1,10,5);line(im,10,5,14,5);R(im,6,8,6,1,'edge');R(im,6,11,5,1,'edge');}
 if(name==='folder')folder();
 if(name==='diff'){box(im,1,1,14,14,'hi');stroke(im,4,5,11,5,'cyan');stroke(im,8,2,8,8,'cyan');stroke(im,4,11,11,11,'red');}
 if(name==='fuel'){box(im,2,2,9,12,'panel');box(im,4,4,5,4,'night');R(im,4,10,5,2,'cyan');line(im,11,4,14,6);line(im,14,6,14,12);line(im,14,12,12,12);R(im,1,14,11,1,'o');}
 if(name==='tab-chat'){poly(im,[[1,2],[14,2],[14,11],[7,11],[3,15],[3,11],[1,11]],'panel');R(im,4,5,7,1,'o');R(im,4,8,5,1,'o');}
 if(name==='tab-setup'){for(let j=0;j<3;j++){stroke(im,2,3+j*5,13,3+j*5,'panel');box(im,3+(j*4)%8,1+j*5,4,5,'cyan');}}
 if(name==='warning'){poly(im,[[8,1],[15,14],[1,14]],'cream');R(im,7,5,2,5,'red');R(im,7,12,2,1,'red');}
 if(name==='check'){stroke(im,2,8,6,12,'cyan');stroke(im,6,12,14,3,'cyan');}
 if(name==='push'||name==='pull'){arrow(name==='pull');R(im,2,name==='push'?14:1,12,1,'panel');}
}
function frame(im,size,fill='monitor',rivets=true){poly(im,[[3,0],[size-4,0],[size-1,3],[size-1,size-4],[size-4,size-1],[3,size-1],[0,size-4],[0,3]],fill);R(im,3,2,size-6,1,'panel');R(im,2,3,1,size-6,'edge');R(im,3,size-3,size-6,1,'black');R(im,size-3,3,1,size-6,'black');clear(im,6,6,size-12,size-12);box(im,5,5,size-10,size-10,'black');clear(im,7,7,size-14,size-14);if(rivets)for(const x of [2,size-4])for(const y of [2,size-4])screw(im,x,y);}
function actionIcon(im,f){const inset=(name)=>copy(existing('ui/'+name+'.png'),im,2,2);
 if(f===0){poly(im,[[2,3],[17,3],[17,13],[10,13],[6,18],[6,13],[2,13]],'wall');for(let j=0;j<3;j++)R(im,5+j*4,7,2,2,'o');}
 if(f===1){poly(im,[[3,9],[4,6],[7,6],[7,4],[10,4],[10,5],[13,5],[16,8],[16,14],[13,17],[5,16]],'skin');line(im,6,8,6,11);line(im,9,6,9,10);line(im,12,7,12,10);line(im,4,12,9,12);R(im,4,16,8,2,'g');}
 if(f===2)inset('newspaper');
 if(f===3)inset('megaphone');
 if(f===4){box(im,2,13,16,5,'edge');oval(im,10,12,7,3,'redD');oval(im,10,9,6,4,'red');R(im,7,6,4,1,'pink');}
 if(f===5){poly(im,[[3,17],[2,14],[7,10],[9,12]],'brown');stroke(im,8,10,14,6,'skinD');stroke(im,14,6,12,2,'skinD');stroke(im,12,2,17,2,'skinD');stroke(im,17,2,18,5,'cream');}
 if(f===6){box(im,8,9,5,9,'hi');box(im,8,5,5,6,'cyan');R(im,8,2,2,4,'edge');R(im,12,2,2,4,'edge');line(im,4,3,2,6,'cyan');line(im,16,5,18,8,'cyan');line(im,3,10,5,8,'cream');}
 if(f===7)inset('coffee');
 if(f===8){poly(im,[[3,17],[3,10],[1,7],[3,6],[5,8],[5,3],[7,2],[8,9],[9,2],[11,3],[11,10],[13,7],[15,8],[13,14],[9,18]],'skin');line(im,14,3,16,1,'cream');line(im,15,5,18,5,'cream');R(im,4,16,6,2,'g');}
 if(f===9){poly(im,[[2,17],[5,7],[13,14]],'red');line(im,4,11,9,15,'cream');line(im,9,6,13,2,'cyan');line(im,12,9,18,7,'pink');line(im,7,4,7,1,'cream');R(im,16,2,2,2,'purple');R(im,17,12,2,2,'cyan');}
}
function sceneBase(im){box(im,1,20,126,74,'edge');R(im,2,21,124,25,'wall');R(im,2,46,124,47,'floor');R(im,2,44,124,3,'skirt');for(let y=47;y<94;y+=16)line(im,2,y,125,y,'grout');for(let x=2;x<126;x+=16)line(im,x,47,x,92,'grout');copy(existing('objects/ceiling-light.png'),im,32,18);}
function sectionD(){
 for(const s of [16,32])asset('ui/icons-ui-'+s+'.png',7*s,6*s,(im,f)=>{const a=blank(16,16);uiIcon(a,iconsUiOrder[f]);copy(s===16?a:p.sample(a,32,32),im,0,0);},42,7,6);m.layout.iconsUi={columns:7,rows:6,order:iconsUiOrder,sizes:[16,32]};
 const acts=asset('ui/act-icons.png',200,20,actionIcon,10);m.layout.actIcons={frame:{width:20,height:20},columns:10,order:['tap','knock','bonk','megaphone','buzzer','whip','zap','coffee','high-five','gags']};
 // Keep the separately requested action pictures available for existing consumers.
 for(const [name,n]of [['tap',0],['knock',1],['highfive',8]]){save(crop(acts,n*20,0,20,20),'ui/act-'+name+'.png');register('ui/act-'+name+'.png',20,20);}
 asset('ui/popup-frame.png',48,48,im=>{R(im,3,3,45,45,'black');box(im,0,0,45,45,'monitor');clear(im,6,6,33,33);});m.layout.popupFrame={left:6,top:6,right:9,bottom:9};
 asset('ui/popup-tail.png',14,8,im=>{poly(im,[[0,0],[13,0],[7,7]],'monitor');R(im,2,0,10,1,'monitor');});
 asset('ui/panel-frame.png',48,48,im=>frame(im,48));m.layout.panelFrame={left:16,top:16,right:16,bottom:16};
 asset('ui/panel-header.png',48,24,im=>{box(im,0,0,48,24,'monitor');R(im,1,1,46,1,'edge');R(im,1,20,46,3,'redD');R(im,1,20,46,1,'red');screw(im,3,3);screw(im,43,3);});m.layout.panelHeader={left:8,top:4,right:8,bottom:5};
 asset('ui/hazard-tape.png',32,8,im=>{R(im,0,0,32,8,'cream');for(let x=-8;x<40;x+=16)poly(im,[[x,7],[x+7,0],[x+15,0],[x+8,7]],'black');R(im,0,0,32,1,'o');R(im,0,7,32,1,'o');});
 for(const name of ['urgent','done','closed'])asset('ui/stamp-'+name+'.png',96,32,im=>{const a=blank(96,32);box(a,2,5,92,23,'redD');R(a,4,7,88,19,'red');box(a,6,9,84,15,'red');text(a,name,Math.floor((96-name.length*8)/2),12,'cream',2);for(let j=0;j<26;j++)clear(a,4+(j*29)%87,6+(j*13)%20,1,1);copy(rotate(a,-.06),im,0,0);});
 asset('ui/crt-bezel.png',64,64,im=>{frame(im,64,'edge',false);R(im,5,4,53,2,'wall');box(im,9,8,46,45,'black');clear(im,12,11,40,39);R(im,13,52,36,2,'hi');for(let j=0;j<5;j++)R(im,8+j*4,58,2,1,'o');box(im,48,56,8,5,'hi');R(im,50,57,2,2,'cyan');});m.layout.crtBezel={left:12,top:11,right:12,bottom:14};
 for(const name of ['avatar-frame','avatar-frame-needs','skin-frame','skin-frame-selected'])asset('ui/'+name+'.png',40,40,im=>{frame(im,40,name.includes('selected')?'skirt':'edge',false);if(name.includes('needs')){for(let j=0;j<40;j++){R(im,j,0,1,4,Math.floor((j+1)/4)%2?'black':'cream');R(im,j,36,1,4,Math.floor((j+1)/4)%2?'black':'cream');}}if(name.includes('selected')){R(im,1,1,38,1,'cyan');R(im,1,38,38,1,'cyan');const check=blank(16,16);uiIcon(check,'check');copy(crop(check,0,0,16,16),im,23,23);}if(name==='avatar-frame'){line(im,4,12,5,8,'hi');line(im,33,32,35,29,'hi');}});
 asset('ui/stage-strip.png',128,32,(im,f)=>{box(im,0,0,32,16,f>=4?'monitor':'hi');R(im,2,2,28,1,f>=4?'cyan':'edge');text(im,['THK','COD','TST','END'][f%4],10,6,f>=4?'white':'panel');R(im,5,6,2,5,f>=4?'cyan':'gd');},8,4,2);m.layout.stageStrip={frame:{width:32,height:16},columns:4,rows:2,order:['thinking','coding','testing','finished'],states:['off','on']};
 asset('ui/git-status.png',64,16,(im,f)=>{box(im,1,1,14,14,['monitor','skirt','redD','purple'][f]);text(im,['M','A','D','R'][f],5,5,'white',1);R(im,3,2,10,1,'panel');},4);
 asset('ui/badge-model.png',112,16,(im,f)=>{box(im,1,1,14,14,'night');if(f<3){for(let j=0;j<6;j++){const a=j*Math.PI/3;line(im,8,8,8+Math.cos(a)*5,8+Math.sin(a)*5,['skin','pink','red'][f]);}R(im,7,7,3,3,'cream');text(im,['O','S','H'][f],6,6,'white');}if(f===3){oval(im,8,8,5,5,'skirt');R(im,5,5,2,5,'white');R(im,9,7,2,4,'white');}if(f===4){stroke(im,4,5,7,8,'cyan');stroke(im,7,8,4,11,'cyan');R(im,9,11,3,1,'white');}if(f===5)poly(im,[[4,3],[12,9],[8,10],[7,14]],'wall');if(f===6){box(im,3,5,10,7,'panel');R(im,5,7,2,2,'o');R(im,10,7,2,2,'o');line(im,8,2,8,5,'edge');}},7);
 asset('ui/logo.png',64,64,im=>{poly(im,[[5,3],[55,1],[61,7],[62,55],[56,62],[7,62],[1,56],[2,9]],'redD');box(im,5,5,54,54,'red');box(im,8,8,48,48,'red');text(im,'EASY',16,16,'cream',2);text(im,'JOB',14,33,'cream',3);line(im,13,12,50,12,'cream');line(im,13,52,50,52,'cream');for(let j=0;j<35;j++)R(im,4+(j*19)%55,5+(j*13)%54,1,1,j%2?'redD':'red');});
 for(const needs of [false,true])asset('ui/favicon'+(needs?'-needs':'')+'-32.png',32,32,im=>{box(im,1,1,30,30,'redD');box(im,3,3,26,26,'red');text(im,'E',6,6,'cream',3);text(im,'J',18,16,'cream',2);if(needs){oval(im,24,8,7,7,'gold');R(im,23,3,2,6,'o');R(im,23,11,2,2,'o');}});
 asset('ui/cursor-boss.png',32,32,im=>{poly(im,[[1,1],[14,10],[8,12],[6,20]],'white');const boss=cell(existing('characters/boss.png'),13),b=p.bbox(boss),head=crop(boss,b[0],b[1],b[2],Math.round(b[3]*.48));copy(p.sample(head,20,19),im,12,13);});
 asset('ui/cursor-hand.png',32,32,im=>{poly(im,[[8,28],[6,20],[2,14],[3,11],[7,12],[10,16],[10,3],[12,1],[14,3],[14,11],[17,11],[19,13],[22,13],[25,16],[25,24],[21,30]],'wall');line(im,14,13,14,19,'edge');line(im,18,15,18,20,'edge');line(im,22,17,22,22,'edge');R(im,10,28,11,3,'edge');});
 asset('ui/empty-inbox.png',128,96,im=>{sceneBase(im);copy(p.sample(existing('objects/bench-m.png'),64,48),im,32,36);copy(existing('objects/monitor.png'),im,42,34);R(im,46,38,24,12,'night');copy(cell(existing('characters/headset.png'),24),im,45,15);copy(existing('objects/chair-back.png'),im,53,59);copy(existing('objects/noodle-cup.png'),im,84,49);copy(crop(existing('ui/fx-sleep.png'),0,0,16,24),im,80,22);});
 asset('ui/empty-floor.png',128,96,im=>{sceneBase(im);copy(cell(existing('characters/boss.png'),24),im,42,19);copy(existing('objects/door.png'),im,8,27);copy(existing('objects/team-sign-hanging.png'),im,25,0);R(im,30,14,84,12,'g');text(im,'NO AGENTS YET',45,18,'hi');for(let j=0;j<3;j++){line(im,87+j*4,51-j*4,88+j*5,57-j*2,'edge');}});
 asset('ui/orcha-down.png',128,96,im=>{sceneBase(im);copy(crop(existing('objects/tube-broken.png'),128,0,64,16),im,32,18);copy(p.sample(existing('objects/bench-m.png'),64,48),im,32,38);copy(existing('objects/monitor.png'),im,48,36);R(im,52,40,24,12,'night');const warn=blank(16,16);uiIcon(warn,'warning');copy(warn,im,56,38);line(im,53,67,51,77,'o');line(im,51,77,40,77,'o');box(im,35,74,6,6,'edge');R(im,32,75,3,1,'o');R(im,32,78,3,1,'o');line(im,77,67,79,77);box(im,79,74,6,6,'edge');R(im,84,75,4,1,'o');R(im,84,78,4,1,'o');text(im,'OFFLINE',50,8,'red');});
}

function contact(section){
 const entries=[];
 for(const file of [...new Set(delivered)]){const im=existing(file),isWorker=file.startsWith('characters/')&&!file.includes('bouncer');if(file.endsWith('-polo.png'))continue;
  const meta=Object.values(m.layout.animations).find(v=>v.sheet==='office/'+file),fw=meta.frame.width,fh=meta.frame.height;
  let art=im;
  if(isWorker)art=crop(im,0,648,192,144);
  else if(fw*meta.count>900||im.width>900){const ncol=Math.min(meta.count,Math.max(1,Math.floor(900/fw)));art=blank(ncol*fw,Math.ceil(meta.count/ncol)*fh);for(let f=0;f<meta.count;f++)copy(cell(im,f,fw,fh,meta.columns),art,f%ncol*fw,Math.floor(f/ncol)*fh);}
  const scale=art.width<=128&&art.height<=96?2:1;art=p.sample(art,art.width*scale,art.height*scale);entries.push({file,art,w:Math.max(art.width+20,212),h:art.height+34});
 }
 const width=1160;let x=12,y=38,rh=0;for(const e of entries){if(x+e.w>width){x=12;y+=rh+12;rh=0;}e.x=x;e.y=y;x+=e.w+8;rh=Math.max(rh,e.h);}const out=blank(width,y+rh+12);R(out,0,0,out.width,out.height,'wall');text(out,'EASY JOB - ROUND 6 - '+section,14,13,'o',2);
 for(const e of entries){box(out,e.x,e.y,e.w,e.h,'floor');text(out,e.file.replace('characters/','CAST/').replace('background/','BG/').replace('objects/','OBJ/').replace('ui/','UI/').replace('.png',''),e.x+5,e.y+7);copy(e.art,out,e.x+Math.floor((e.w-e.art.width)/2),e.y+24);}
 fs.writeFileSync('docs/art-review/round6-'+section.toLowerCase()+'.png',PNG.sync.write(out));
}
const section=process.argv[2];
if(require.main===module){if(section==='A')sectionA();else if(section==='B')sectionB();else if(section==='C')sectionC();else if(section==='D')sectionD();else throw Error('Section not implemented: '+section);saveManifest();contact(section);console.log('Finished section '+section+': '+delivered.length+' files');}
module.exports={p,C,R,box,line,disc,oval,poly,clear,text,pseudo,rotate,flip,asset,existing,cell,register,m,saveManifest,contact,delivered,sectionA};
