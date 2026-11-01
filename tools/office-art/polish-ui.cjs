const p=require('./finish.cjs');const {R,box,line,poly}=require('./primitives.cjs');
const {blank,copy,save,get,set,rgb}=p;
// Three stepped Z glyphs rise above the sleeper. The whole strip is runtime-only FX.
const letters=[{x:1,y:16,w:3,h:4},{x:5,y:9,w:4,h:5},{x:10,y:2,w:4,h:6}];
let out=blank(48,24);for(let f=0;f<3;f++){let cell=blank(16,24);for(const a of letters){const yy=Math.max(1,a.y-(f===2?1:0)),xx=a.x+(f===1&&a.x===5?1:0),white=[];for(let x=0;x<a.w;x++){white.push([xx+x,yy],[xx+x,yy+a.h-1]);}for(let y=1;y<a.h-1;y++)white.push([xx+a.w-1-Math.round(y*(a.w-1)/(a.h-1)),yy+y]);for(const [x,y]of white)for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]])set(cell,x+dx,y+dy,rgb('#2f3a4f'));for(const [x,y]of white)set(cell,x,y,rgb('#ffffff'));}copy(cell,out,f*16,0);}save(out,'ui/fx-sleep.png');
// The menu prop is a straight insulated baton with twin top contacts, not a gun.
out=blank(16,16);poly(out,[[4,14],[2,12],[10,4],[12,6]],'red');line(out,6,11,12,5,'o');line(out,5,10,11,4,'edge');box(out,9,1,2,4,'panel');box(out,13,3,2,4,'panel');line(out,11,2,12,3,'cyan');line(out,12,3,12,4,'cyan');R(out,3,12,1,1,'cream');save(out,'ui/zapper.png');
// Repeatable service-yard concrete: unlit neutral grey, sparse drain channels.
out=blank(32,32);R(out,0,0,32,32,'hi');R(out,0,0,32,1,'o');R(out,0,0,1,32,'o');R(out,16,0,1,32,'monitor');R(out,0,16,32,1,'monitor');R(out,3,5,4,1,'edge');R(out,23,24,3,1,'edge');R(out,27,3,1,5,'o');R(out,29,3,1,5,'o');save(out,'tiles/yard.png');
console.log('Saved ZZZ animation, baton menu icon and service-yard tile');
