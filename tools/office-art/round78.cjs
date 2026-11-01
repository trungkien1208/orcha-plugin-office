// Round 7/8 production: native pixel glyphs and palette-locked imagegen finishing.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const r=require('./round6.cjs'),p=r.p,{PNG}=require('pngjs');
const {blank,copy,crop,read,save,get,set,sample,rgb}=p;
const {R,box,line,oval,disc,poly,clear,text,existing,cell}=r;
const mp=p.ROOT+'/manifest.json',m=JSON.parse(fs.readFileSync(mp));
const files=[];
const camel=s=>s.replace(/-([a-z0-9])/g,(_,c)=>c.toUpperCase());
function register(file,w,h,n=1,cols=n,rows=1){
 const parts=file.split('/'),office=parts[0]==='theme-office';if(office)parts.shift();
 let [group,name]=parts,key=camel(name.slice(0,-4));group=group==='background'?'backgrounds':group;
 let target=office?(m.themes.office):m;target[group]||={};
 const aliases={'theme-office/objects/plant.png':'plantDead','theme-office/objects/whiteboard.png':'kpiBoard'};
 target[group][aliases[file]||key]='office/'+file;
 if(office&&group==='backgrounds'){target.objects[key]='office/'+file;}
 const animationKey=office&&!key.startsWith('office')?'office'+key[0].toUpperCase()+key.slice(1):key;
 m.layout.animations[animationKey]={sheet:'office/'+file,frame:{width:w,height:h},count:n,frames:n,columns:cols,rows};
 files.push(file);
}
function put(file,im,n=1,cols=n,rows=1){save(im,file);register(file,im.width/cols,im.height/rows,n,cols,rows);return im;}
function asset(file,w,h,draw,n=1,cols=n,rows=1){let im=blank(w,h);for(let f=0;f<n;f++){let c=blank(w/cols,h/rows);draw(c,f);copy(c,im,f%cols*c.width,Math.floor(f/cols)*c.height);}return put(file,im,n,cols,rows);}
function flush(){fs.writeFileSync(mp,JSON.stringify(m,null,2)+'\n');}
function stroke(im,x,y,a,b,c='wall'){for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])line(im,x+dx,y+dy,a+dx,b+dy,'o');line(im,x,y,a,b,c);}
function wire(im,y=8,ry=6){
 // Closely pitched, overlapping helical turns, a straight support, and paired razor barbs.
 for(let k=-2;k<11;k++){const cx=k*8+4;let last;
  for(let t=0;t<=48;t++){const a=t*Math.PI/24,pt=[Math.round(cx+5*Math.cos(a)+3*Math.sin(a)),Math.round(y+ry*Math.sin(a))];if(last){line(im,...last,...pt,'o');}last=pt;}
  for(const [x,yy,s]of [[cx-2,y-ry+1,1],[cx+3,y+ry-2,-1]]){line(im,x-2,yy-s,x+2,yy+s,'panel');line(im,x,yy-1,x+1,yy+1,'o');}
 }
 line(im,0,y+1,im.width-1,y+1,'edge');
 for(let x=0;x<im.width;x+=8){line(im,x,y-ry+1,x+3,y-ry+1,'panel');line(im,x+5,y+ry-2,x+7,y+ry-4,'wall');}
}
function fixes(){asset('objects/razor-wire.png',64,16,im=>wire(im));
 asset('ui/hp-fill.png',24,12,im=>{for(let f=0;f<3;f++){R(im,0,f*4,24,4,['#2fae6c','gold','redD'][f]);R(im,0,f*4+1,24,2,['#2fae6c','gold','red'][f]);R(im,0,f*4,24,1,['alt','cream','pink'][f]);} });flush();}
const order=['caret-down','caret-right','more','copy','stop','resume','jump-latest','pin','tool-bash','tool-read','tool-edit','tool-write','tool-grep','tool-web','tool-task','tool-todo','thinking','clock','heart','bolt','boss','image','skill','shell','retry','hourglass','lock','crown','theme-office','theme-compound','sun','moon','keyboard','help','spare'];
function heart(im,x=0,y=0){poly(im,[[x+2,y+4],[x+4,y+2],[x+6,y+2],[x+8,y+4],[x+10,y+2],[x+12,y+2],[x+14,y+4],[x+14,y+7],[x+8,y+13],[x+2,y+7]],'red');line(im,x+4,y+4,x+6,y+4,'pink');line(im,x+10,y+9,x+12,y+7,'redD');}
function bolt(im){poly(im,[[8,1],[3,8],[7,8],[5,14],[13,5],[9,5],[11,1]],'cyan');line(im,7,5,6,7,'white');}
function hand(im,x,y){poly(im,[[x+3,y+12],[x,y+6],[x+1,y+4],[x+4,y+6],[x+4,y+1],[x+6,y],[x+7,y+5],[x+8,y],[x+10,y+1],[x+10,y+6],[x+12,y+3],[x+14,y+4],[x+13,y+10],[x+10,y+14],[x+5,y+14]],'skin');line(im,x+6,y+6,x+6,y+9,'skinD');line(im,x+9,y+6,x+9,y+9,'skinD');}
function icon(im,n){
 if(n==='caret-down')poly(im,[[3,5],[13,5],[8,11]],'wall');
 if(n==='caret-right')poly(im,[[5,3],[11,8],[5,13]],'wall');
 if(n==='more')for(let j=0;j<3;j++)box(im,2+j*5,7,3,3,'wall');
 if(n==='copy'){box(im,2,2,9,10,'edge');box(im,5,5,9,10,'wall');R(im,7,7,5,1,'white');}
 if(n==='stop'){box(im,3,3,10,10,'red');R(im,4,4,8,1,'pink');R(im,4,11,8,1,'redD');}
 if(n==='resume')poly(im,[[4,2],[13,8],[4,14]],'wall');
 if(n==='jump-latest'){stroke(im,8,2,8,10,'cyan');stroke(im,4,7,8,11,'cyan');stroke(im,8,11,12,7,'cyan');box(im,2,13,12,2,'wall');}
 if(n==='pin'){poly(im,[[5,2],[12,2],[11,7],[14,10],[3,10],[6,7]],'red');line(im,8,10,6,15,'wall');R(im,6,3,4,1,'pink');}
 if(n==='tool-bash'){box(im,1,2,14,12,'monitor');stroke(im,3,5,6,7,'cyan');stroke(im,6,7,3,9,'cyan');line(im,8,10,12,10,'wall');}
 if(['tool-read','tool-edit','tool-write','tool-grep'].includes(n)){poly(im,[[2,1],[9,1],[13,5],[13,14],[2,14]],'wall');line(im,9,1,9,5);line(im,9,5,13,5);line(im,4,4,6,4,'edge');line(im,4,7,8,7,'edge');
  if(n==='tool-read'){poly(im,[[6,10],[9,7],[12,7],[15,10],[12,12],[9,12]],'white');R(im,10,9,2,2,'cyan');}
  if(n==='tool-edit'){poly(im,[[6,12],[13,5],[15,7],[8,14],[5,15]],'cream');line(im,7,12,13,6,'skinD');}
  if(n==='tool-write'){stroke(im,11,8,11,14,'cyan');stroke(im,8,11,14,11,'cyan');}
  if(n==='tool-grep'){oval(im,10,10,4,4,'panel');oval(im,10,10,2,2,'wall');stroke(im,13,13,15,15,'cyan');}
 }
 if(n==='tool-web'){oval(im,8,8,7,7,'panel');oval(im,8,8,3,6,'wall');line(im,2,8,14,8,'cyan');line(im,3,5,13,5,'o');line(im,3,11,13,11,'o');line(im,8,2,8,14,'cyan');}
 if(n==='tool-task'){oval(im,5,4,2,2,'wall');poly(im,[[1,12],[2,8],[8,8],[9,12]],'panel');oval(im,12,8,2,2,'wall');poly(im,[[8,15],[9,12],[14,12],[15,15]],'panel');line(im,8,3,12,3,'cyan');line(im,12,3,12,5,'cyan');}
 if(n==='tool-todo'){box(im,2,1,12,14,'wall');for(let j=0;j<3;j++){line(im,4,4+j*4,5,5+j*4,'cyan');line(im,5,5+j*4,7,3+j*4,'cyan');line(im,9,4+j*4,12,4+j*4,'o');}}
 if(n==='thinking'){poly(im,[[1,2],[14,2],[14,11],[7,11],[3,15],[3,11],[1,11]],'wall');for(let j=0;j<3;j++)R(im,4+j*3,6,1,2,'o');}
 if(n==='clock'){oval(im,8,8,7,7,'wall');line(im,8,3,8,8,'o');line(im,8,8,11,9,'red');for(const [x,y]of [[8,2],[8,13],[2,8],[13,8]])R(im,x,y,1,1,'edge');}
 if(n==='heart')heart(im);if(n==='bolt')bolt(im);
 if(n==='boss'){const b=cell(existing('characters/boss.png'),13),bb=p.bbox(b);copy(sample(crop(b,bb[0],bb[1],bb[2],Math.round(bb[3]*.48)),14,14),im,1,1);}
 if(n==='image'){box(im,1,2,14,12,'wall');oval(im,5,5,2,2,'cyan');poly(im,[[2,12],[7,7],[10,10],[12,8],[14,12]],'skirt');}
 if(n==='skill'){box(im,2,2,12,12,'monitor');stroke(im,6,11,10,5,'cyan');R(im,11,3,2,1,'white');}
 if(n==='shell'){poly(im,[[8,1],[15,13],[1,13]],'cream');R(im,7,5,2,4,'red');R(im,7,10,2,1,'red');}
 if(n==='retry'){stroke(im,12,5,9,2,'cyan');stroke(im,9,2,4,3,'cyan');stroke(im,4,3,2,7,'cyan');stroke(im,2,7,4,12,'cyan');stroke(im,4,12,10,13,'cyan');stroke(im,10,13,13,10,'cyan');poly(im,[[9,5],[14,2],[14,7]],'wall');}
 if(n==='hourglass'){box(im,3,1,10,2,'panel');box(im,3,13,10,2,'panel');poly(im,[[4,3],[12,3],[11,6],[8,8],[11,10],[12,12],[4,12],[5,10],[8,8],[5,6]],'wall');line(im,6,4,10,4,'cyan');line(im,6,11,10,11,'cyan');}
 if(n==='lock'){oval(im,8,6,4,5,'panel');oval(im,8,6,2,3,'night');box(im,2,7,12,8,'wall');R(im,7,10,2,3,'o');R(im,3,8,10,1,'white');}
 if(n==='crown'){poly(im,[[1,3],[5,7],[8,2],[11,7],[15,3],[13,13],[3,13]],'cream');R(im,4,11,9,1,'skinD');R(im,7,8,2,2,'red');}
 if(n==='theme-office'){box(im,3,1,10,14,'wall');for(let y=3;y<12;y+=3)for(let x=5;x<12;x+=4)box(im,x,y,2,2,'cyan');box(im,7,12,3,3,'edge');R(im,1,14,14,1,'o');}
 if(n==='theme-compound'){box(im,1,7,2,8,'edge');box(im,13,7,2,8,'edge');R(im,3,9,10,1,'o');for(let x=4;x<13;x+=3)line(im,x,9,x,14,'skirt');for(let x=1;x<15;x+=4){oval(im,x+1,4,3,3,'panel');R(im,x,3,1,1,'o');}line(im,1,6,14,6,'edge');}
 if(n==='sun'){for(let j=0;j<8;j++){const a=j*Math.PI/4;line(im,Math.round(8+5*Math.cos(a)),Math.round(8+5*Math.sin(a)),Math.round(8+7*Math.cos(a)),Math.round(8+7*Math.sin(a)),'o');}oval(im,8,8,4,4,'cream');R(im,6,5,3,1,'white');}
 if(n==='moon'){poly(im,[[10,1],[6,2],[3,5],[2,9],[4,13],[8,14],[13,12],[15,8],[11,9],[8,7],[8,4]],'wall');line(im,4,10,6,12,'panel');}
 if(n==='keyboard'){box(im,0,4,16,10,'panel');for(let j=0;j<2;j++)for(let x=2;x<15;x+=3)box(im,x,6+j*3,2,2,'wall');R(im,5,12,6,1,'o');}
 if(n==='help'){oval(im,8,8,7,7,'wall');line(im,5,4,10,4,'o');line(im,10,4,11,6,'o');line(im,11,6,8,9,'o');R(im,8,9,1,1,'o');R(im,8,12,1,1,'o');}
 if(n==='spare'){poly(im,[[8,2],[10,6],[14,8],[10,10],[8,14],[6,10],[2,8],[6,6]],'panel');R(im,8,6,1,4,'white');}
}
const actions=['tap','knock','hurry','stop','megaphone','buzzer','zap','coffee','high-five','gags'];
function actionIcons(office=false){const base=PNG.sync.read(execFileSync('git',['show','HEAD:packages/web/public/office/ui/act-icons.png']));
 const im=blank(200,20),from=[0,1,5,-1,3,4,6,7,8,9];for(let f=0;f<10;f++)if(from[f]>=0)copy(crop(base,from[f]*20,0,20,20),im,f*20,0);
 const stop=blank(20,20);poly(stop,[[6,2],[13,2],[18,7],[18,13],[13,18],[6,18],[1,13],[1,7]],office?'skirt':'red');hand(stop,3,3);copy(stop,im,60,0);
 if(!office){line(im,41,6,44,3,'cyan');line(im,43,10,46,7,'wall');line(im,55,4,58,2,'cyan');}
 if(office){for(let f of [2,4,5,6,7,9]){clear(im,f*20,0,20,20);let c=blank(20,20);
  if(f===2||f===5){poly(c,[[3,13],[5,10],[5,7],[8,4],[12,4],[15,7],[15,10],[17,13]],'cream');box(c,2,14,16,3,'brown');box(c,8,2,4,3,'skinD');R(c,7,6,2,4,'white');line(c,1,5,2,7,'skirt');line(c,17,4,18,6,'skirt');}
  if(f===4){poly(c,[[3,7],[7,7],[16,2],[16,15],[7,10],[3,10]],'cream');poly(c,[[8,10],[11,10],[12,17],[9,17]],'skinD');line(c,14,4,14,12,'skin');}
  if(f===6){for(const [x,y,s]of [[10,8,5],[4,14,2],[16,3,2]])poly(c,[[x,y-s],[x+1,y-1],[x+s,y],[x+1,y+1],[x,y+s],[x-1,y+1],[x-s,y],[x-1,y-1]],'cream');}
  if(f===7){oval(c,10,17,8,2,'panel');box(c,3,7,12,9,'wall');oval(c,9,7,6,2,'brown');oval(c,16,11,3,3,'wall');oval(c,16,11,1,1,'panel');line(c,7,1,6,3,'skirt');line(c,6,3,8,5,'skirt');R(c,4,9,2,5,'white');}
  if(f===9){oval(c,10,10,8,8,'skinD');oval(c,9,9,7,6,'skin');for(const [x,y]of [[6,6],[12,5],[8,12],[14,11],[4,10]])R(c,x,y,2,2,'brown');R(c,6,3,4,1,'cream');}
  copy(c,im,f*20,0);
 }}return put((office?'theme-office/':'')+'ui/act-icons.png',im,10);
}
function sectionE(){
 const im=asset('ui/icons-ui2-16.png',112,80,(c,f)=>icon(c,order[f]),35,7,5);put('ui/icons-ui2-32.png',sample(im,224,160),35,7,5);
 m.layout.iconsUi2={columns:7,rows:5,order,sizes:[16,32]};m.layout.actIcons.order=actions;actionIcons();
 asset('ui/spinner-16.png',128,16,(im,f)=>{let prev;for(let j=0;j<=26;j++){const a=(f*Math.PI/4-Math.PI/2)+j*Math.PI/16,x=Math.round(7.5+5.5*Math.cos(a)),y=Math.round(7.5+5.5*Math.sin(a));if(prev)stroke(im,...prev,x,y,j>17?'cyan':j>8?'wall':'edge');prev=[x,y];}},8);
 asset('ui/thinking-dots.png',48,16,(im,f)=>{for(let j=0;j<3;j++){oval(im,3+j*5,j===f?6:9,2,2,j===f?'cyan':'panel');R(im,3+j*5,(j===f?6:9)-1,1,1,'white');}},3);flush();
}
function bar(im,kind){box(im,1,2,im.width-2,im.height-4,'hi');R(im,3,3,im.width-6,1,'panel');box(im,4,4,im.width-8,im.height-8,'night');R(im,3,im.height-3,im.width-6,1,'black');for(const x of [1,im.width-3])R(im,x,4,2,im.height-8,'edge');}
function fill(im,f){R(im,0,0,48,8,['#2fae6c','gold','red','cyan'][f]);R(im,0,0,48,1,['alt','cream','pink','white'][f]);R(im,0,6,48,2,['#2f3a4f','skinD','redD','monitor'][f]);for(let x=5;x<48;x+=6){R(im,x,1,1,6,'o');R(im,x-1,1,1,1,'white');}}
function sectionF(){asset('ui/hp-bar-lg.png',64,12,bar);asset('ui/hp-fill-lg.png',48,24,fill,3,1,3);asset('ui/stamina-fill-lg.png',48,8,im=>fill(im,3));asset('ui/hp-icons.png',32,16,(im,f)=>f?bolt(im):heart(im),2);m.layout.hpBarLg={left:6,right:6,top:4,bottom:4};flush();}
function screw(im,x,y){oval(im,x,y,1,1,'panel');R(im,x,y,1,1,'hi');}
function noise(im,colors,density=1){for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const v=((x*73856093)^(y*19349663)^((x+y)*83492791))>>>0;if(v%100<density)set(im,x,y,rgb(colors[v%colors.length]));}}
function sectionI(){
 asset('ui/header-wire.png',64,12,im=>{wire(im,5,4);clear(im,0,0,64,1);clear(im,0,11,64,1);});
 asset('ui/map-frame.png',96,96,im=>{for(let x=8;x<89;x+=8)for(let y=16;y<91;y+=8){line(im,x,y,x+7,y+7,'skirt');line(im,x+7,y,x,y+7,'skirt');}clear(im,24,24,48,48);R(im,8,11,80,2,'edge');R(im,8,87,80,2,'edge');R(im,10,12,2,76,'o');R(im,84,12,2,76,'o');
 for(const x of [0,78])for(const y of [12,73]){box(im,x,y,18,23,'grout');R(im,x+2,y+1,13,2,'wall');R(im,x+2,y+3,2,18,'panel');R(im,x+14,y+4,3,18,'skirt');line(im,x+8,y+7,x+6,y+11,'skirt');line(im,x+6,y+11,x+10,y+14,'skirt');screw(im,x+8,y+19);}
 let w=blank(96,16);wire(w,7);copy(w,im,0,0);
 });
 m.layout.mapFrame={left:24,right:24,top:24,bottom:24};
 asset('ui/corner-lamp.png',32,16,(im,f)=>{box(im,3,1,10,3,'hi');poly(im,[[4,4],[12,4],[14,13],[2,13]],'edge');box(im,5,5,6,7,f?'hi':'cream');line(im,7,5,7,11,'o');line(im,10,5,10,11,'o');line(im,4,8,12,8,'o');R(im,3,14,10,1,'o');},2);
 asset('ui/cctv-corners.png',32,32,(im,f)=>{let a=blank(16,16);R(a,0,0,8,2,'o');R(a,0,0,2,8,'o');R(a,2,2,5,1,'panel');R(a,2,2,1,5,'panel');R(a,5,5,2,2,'red');if(f%2)a=r.flip(a);if(f>1){let b=blank(16,16);for(let y=0;y<16;y++)for(let x=0;x<16;x++)set(b,x,15-y,get(a,x,y));a=b;}copy(a,im,0,0);},4,2,2);
 asset('ui/tape-corner.png',24,24,im=>{poly(im,[[1,14],[15,1],[17,3],[20,2],[22,6],[10,22],[8,20],[5,22]],'cream');for(let j=0;j<5;j++)line(im,5+j*2,17-j*2,8+j*2,15-j*2,'skin');line(im,5,16,17,4,'white');});
 asset('ui/note-paper.png',48,48,im=>{poly(im,[[1,2],[45,1],[46,39],[39,46],[2,46]],'cream');R(im,3,3,40,1,'white');poly(im,[[39,39],[46,39],[39,46]],'skin');R(im,5,42,31,1,'skin');for(const [x,y]of [[4,8],[43,18],[7,44]])line(im,x,y,x+2,y,'skinD');});
 asset('ui/clipboard.png',48,64,im=>{box(im,1,5,46,58,'brown');R(im,3,7,42,2,'skinD');box(im,5,10,38,48,'cream');R(im,6,11,36,1,'white');box(im,14,1,20,12,'edge');box(im,19,0,10,4,'hi');R(im,16,3,16,2,'wall');R(im,17,10,14,1,'hi');R(im,8,55,31,1,'skin');for(const x of [3,44])screw(im,x,60);});
 asset('ui/bg-concrete.png',128,128,im=>{R(im,0,0,128,128,'o');noise(im,['#3b4560','#444b57'],12);for(let k=0;k<4;k++){let x=13+k*31,y=20+k*21;line(im,x,y,x+5,y+8,'monitor');line(im,x+5,y+8,x+2,y+14,'monitor');line(im,x+5,y+8,x+10,y+9,'monitor');}});
 asset('ui/bg-metal.png',128,52,im=>{R(im,0,0,128,52,'o');for(let x=0;x<128;x+=16){R(im,x+2,0,2,52,'hi');R(im,x+4,0,7,52,'monitor');R(im,x+11,0,2,52,'o');}noise(im,['#2f3a4f','#3b4560'],3);});
 asset('ui/divider-fence.png',64,8,im=>{for(let x=-8;x<72;x+=8){line(im,x,0,x+7,7,'edge');line(im,x+7,0,x,7,'skirt');}R(im,0,0,64,1,'o');R(im,0,7,64,1,'o');});
 const labels=[['HIGH','PAY'],['NO','PHONES'],['KPI'],['OVER','TIME'],['CAM','01'],['EMPLOYEE','OF THE','MONTH']];
 asset('ui/sticker-set.png',192,32,(im,f)=>{if(f===5){awardSticker(im);return;}poly(im,[[3,2],[28,1],[31,5],[30,28],[3,30],[1,25]],f%2?'wall':'cream');R(im,4,4,24,2,f===2?'red':'monitor');labels[f].forEach((t,j)=>text(im,t,Math.floor((32-t.length*4)/2),10+j*6,f===2?'red':'o'));R(im,4,27,23,1,'edge');},6);flush();
}
function awardSticker(im,office=false){
 if(office){poly(im,[[5,1],[27,1],[31,5],[31,26],[27,30],[5,30],[1,26],[1,5]],'cream');line(im,7,4,25,4,'skirt');}
 else{poly(im,[[3,2],[28,1],[31,5],[30,28],[3,30],[1,25]],'wall');R(im,4,4,24,2,'monitor');R(im,4,27,23,1,'edge');}
 for(const [label,y]of [['STAR',10],['STAFF',18]])text(im,label,Math.floor((32-(label.length*4-1))/2),y,office?'brown':'o');
}
function contact(name,list=files){let entries=[];for(const file of [...new Set(list)]){let im=existing(file);const scale=im.width<=224&&im.height<=96?2:1;im=sample(im,im.width*scale,im.height*scale);if(im.width>1200)im=sample(im,1200,Math.round(im.height*1200/im.width));entries.push({file,im,w:Math.max(240,im.width+16),h:im.height+34});}
 let x=12,y=38,rh=0,W=1280;for(const e of entries){if(x+e.w>W){x=12;y+=rh+12;rh=0;}e.x=x;e.y=y;x+=e.w+10;rh=Math.max(rh,e.h);}const out=blank(W,y+rh+12);R(out,0,0,W,out.height,'wall');text(out,'EASY JOB / '+name+' / NATIVE PIXEL REVIEW',14,13,'o',2);for(const e of entries){box(out,e.x,e.y,e.w,e.h,'floor');text(out,e.file,e.x+5,e.y+7);copy(e.im,out,e.x+8,e.y+25);}fs.writeFileSync('docs/art-review/'+name+'.png',PNG.sync.write(out));}
if(require.main===module){const section=process.argv[2];if(section==='fixes')fixes();if(section==='E'){fixes();sectionE();contact('r7-batch1');}if(section==='F')sectionF();if(section==='I'){sectionF();sectionI();contact('r7-batch2');}}
module.exports={...r,p,m,files,camel,register,put,asset,flush,stroke,wire,heart,bolt,hand,icon,actionIcons,bar,fill,noise,contact,awardSticker};
