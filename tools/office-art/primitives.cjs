// Exact-grid modular geometry and small UI glyphs, drawn directly at native resolution.
const p=require('./finish.cjs');
const {blank,get,set,save,rgb,copy,outline}=p;
const C={o:'#2f3a4f',floor:'#c9d8d4',alt:'#bfcfcb',grout:'#aebdb9',wall:'#e3ece9',skirt:'#8fa3a0',desk:'#dfe5e4',edge:'#9aa8ad',panel:'#b7c4c8',black:'#2a2f38',hi:'#444b57',monitor:'#3b4560',red:'#c8322f',redD:'#9e2522',cream:'#fff3c4',white:'#ffffff',night:'#1d2747',cyan:'#3fd2e8',purple:'#6a4bd8',pink:'#e0559c',g:'#d0d0d0',gm:'#a0a0a0',gd:'#707070'};
const color=c=>rgb(C[c]||c);
function R(im,x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)set(im,i,j,color(c));}
function box(im,x,y,w,h,c){R(im,x,y,w,h,'o');if(w>2&&h>2)R(im,x+1,y+1,w-2,h-2,c);}
function line(im,x0,y0,x1,y1,c='o'){let dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1,e=dx+dy;while(true){set(im,x0,y0,color(c));if(x0===x1&&y0===y1)break;let e2=2*e;if(e2>=dy){e+=dy;x0+=sx;}if(e2<=dx){e+=dx;y0+=sy;}}}
function disc(im,x,y,rx,ry,c){for(let j=-ry;j<=ry;j++)for(let i=-rx;i<=rx;i++)if(i*i/(rx*rx)+j*j/(ry*ry)<=1)set(im,x+i,y+j,color(c));}
function poly(im,pts,c){const ys=pts.map(v=>v[1]);for(let y=Math.min(...ys);y<=Math.max(...ys);y++){const xs=[];for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];if((yi>y)!==(yj>y))xs.push(xi+(y-yi)*(xj-xi)/(yj-yi));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2)for(let x=Math.ceil(xs[i]);x<=Math.floor(xs[i+1]);x++)set(im,x,y,color(c));}for(let i=0;i<pts.length;i++)line(im,...pts[i],...pts[(i+1)%pts.length],'o');}
function clear(im,x,y,w,h){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)set(im,i,j,[0,0,0,0]);}
let im=blank(32,32);R(im,0,0,32,32,'floor');R(im,16,0,16,16,'alt');R(im,0,16,16,16,'alt');R(im,0,15,32,1,'grout');R(im,15,0,1,32,'grout');save(im,'tiles/floor.png');
im=blank(96,96);R(im,0,0,96,64,'wall');R(im,0,0,96,1,'o');R(im,0,49,96,8,'floor');R(im,0,57,96,6,'skirt');R(im,0,63,96,1,'o');R(im,0,64,16,32,'wall');R(im,80,64,16,32,'wall');R(im,0,80,96,16,'floor');R(im,15,64,1,16,'o');R(im,80,64,1,16,'o');R(im,16,80,64,1,'o');R(im,0,95,96,1,'o');save(im,'tiles/wall.png');
im=blank(32,32);R(im,15,1,2,10,'wall');R(im,15,19,2,10,'wall');save(im,'tiles/aisle.png');
for(const side of ['l','m','r']){im=blank(32,48);R(im,0,13,32,1,'o');R(im,0,14,32,14,'desk');R(im,0,28,32,1,'o');R(im,0,29,32,7,'edge');R(im,0,36,32,1,'o');R(im,0,14,32,1,'white');R(im,0,34,32,1,'panel');
 if(side==='l'){R(im,0,13,1,24,'o');box(im,3,37,4,11,'edge');R(im,4,38,1,8,'panel');}
 if(side==='r'){R(im,31,13,1,24,'o');box(im,25,37,4,11,'edge');R(im,26,38,1,8,'panel');}
 if(side==='m'){box(im,30,7,2,19,'panel');R(im,30,8,1,16,'edge');}
 save(im,`objects/bench-${side}.png`);}
im=blank(32,24);box(im,1,1,30,18,'monitor');R(im,2,2,28,1,'hi');R(im,3,3,26,14,'o');clear(im,4,4,24,12);R(im,14,19,4,3,'o');box(im,9,22,14,2,'edge');R(im,27,17,1,1,'cyan');save(im,'objects/monitor.png');
im=blank(64,16);box(im,0,3,64,11,'edge');R(im,2,5,60,7,'g');R(im,2,11,60,1,'gm');R(im,4,14,3,2,'o');R(im,57,14,3,2,'o');save(im,'objects/bench-tag.png');let mask=blank(64,16);R(mask,2,5,60,6,'g');R(mask,2,11,60,1,'gm');save(mask,'objects/bench-tag-polo.png');
im=blank(256,32);poly(im,[[1,3],[254,3],[254,28],[1,28]],'red');R(im,2,24,252,4,'redD');R(im,5,5,246,1,'#e0559c');R(im,1,0,1,3,'o');R(im,254,0,1,3,'o');
// Cream pseudo-lettering: nonlinguistic glyph strokes, deliberately no actual slogan baked in.
for(let k=0;k<21;k++){let x=11+k*11;const v=k%5;R(im,x,10,6,1,'cream');R(im,x+2,9,1,12,'cream');R(im,x,14+v%2,7,1,'cream');R(im,x+5,12,1,8,'cream');if(v===1||v===4)R(im,x,19,7,1,'cream');if(v===2)R(im,x,11,1,6,'cream');}
save(im,'objects/banner.png');
im=blank(96,48);box(im,0,0,96,46,'white');R(im,1,1,94,9,'red');R(im,1,8,94,2,'redD');R(im,4,4,2,2,'cream');R(im,9,4,23,1,'cream');R(im,4,42,88,2,'edge');box(im,76,40,9,3,'black');R(im,78,41,5,1,'red');for(let i=0;i<3;i++){box(im,5,15+i*8,4,4,'panel');}save(im,'objects/kpi-board.png');
im=blank(48,32);box(im,0,0,48,32,'cream');R(im,1,1,46,7,'red');R(im,1,7,46,1,'redD');R(im,3,28,42,1,'edge');for(const [x,y]of [[0,0],[47,0],[0,31],[47,31]])set(im,x,y,[0,0,0,0]);save(im,'objects/poster-recruit.png');
im=blank(24,24);box(im,0,2,24,20,'white');R(im,2,0,20,2,'o');R(im,2,22,20,2,'o');R(im,1,1,22,22,'white');R(im,2,0,20,1,'o');R(im,0,2,1,20,'o');R(im,23,2,1,20,'o');R(im,2,23,20,1,'o');set(im,1,1,color('o'));set(im,22,1,color('o'));set(im,1,22,color('o'));set(im,22,22,color('o'));save(im,'ui/bubble.png');
im=blank(8,6);poly(im,[[0,0],[7,0],[2,5]],'white');R(im,1,0,6,1,'white');save(im,'ui/bubble-tail.png');
im=blank(32,24);for(let f=0;f<2;f++){const x=f*16,y=f?0:2;poly(im,[[x+3,y],[x+12,y],[x+15,y+3],[x+15,y+16],[x+12,y+19],[x+8,y+22],[x+5,y+19],[x,y+19],[x,y+3]],'#ffb020');R(im,x+7,y+4,2,8,'o');R(im,x+7,y+15,2,2,'o');R(im,x+3,y+2,8,1,'cream');}save(im,'ui/marker-needs.png');
for(const type of ['stars','jolt','heart']){im=blank(48,16);for(let f=0;f<3;f++){const x=f*16;if(type==='stars'){for(const [cx,cy,r]of [[x+4,5-f,3],[x+11,9,2],[x+5,13,1]]){poly(im,[[cx,cy-r],[cx+1,cy-1],[cx+r,cy],[cx+1,cy+1],[cx,cy+r],[cx-1,cy+1],[cx-r,cy],[cx-1,cy-1]],'cream');}}
if(type==='jolt'){poly(im,[[x+8,1],[x+3,8],[x+7,8],[x+5,14],[x+13,5],[x+9,5],[x+11,1]],f===1?'white':'cyan');line(im,x+1,2+f,x+3,4+f,'o');line(im,x+13,11-f,x+15,13-f,'o');}
if(type==='heart'){const dy=[3,1,0][f];poly(im,[[x+2,4+dy],[x+4,2+dy],[x+6,2+dy],[x+8,4+dy],[x+10,2+dy],[x+12,2+dy],[x+14,4+dy],[x+14,7+dy],[x+8,13+dy],[x+2,7+dy]],'red');R(im,x+4,4+dy,2,1,'pink');}}save(im,`ui/fx-${type}.png`);}
const iconNames=['ellipsis','check','question','sleep','raised-hand','terminal','door','search','sound-on','sound-off','claude','codex','cursor','other-agent'];
// Seven columns, two rows, each icon occupies its complete native cell.
function icon(n,size){const o=blank(size,size),s=size/16;const rr=(x,y,w,h,c)=>R(o,Math.round(x*s),Math.round(y*s),Math.round(w*s),Math.round(h*s),c),ll=(x,y,a,b,c)=>line(o,Math.round(x*s),Math.round(y*s),Math.round(a*s),Math.round(b*s),c),bb=(x,y,w,h,c)=>box(o,Math.round(x*s),Math.round(y*s),Math.round(w*s),Math.round(h*s),c),pp=(pts,c)=>poly(o,pts.map(([x,y])=>[Math.round(x*s),Math.round(y*s)]),c);
 if(n===0)for(let k=0;k<3;k++)bb(2+k*5,7,3,3,'white');
 if(n===1){pp([[1,8],[4,5],[7,8],[13,2],[15,4],[7,13]],'skirt');}
 if(n===2){ll(4,4,6,2);ll(6,2,10,2);ll(10,2,12,4);ll(12,4,12,6);ll(12,6,8,9);ll(8,9,8,11);rr(8,14,1,1,'o');}
 if(n===3){ll(3,3,12,3);ll(12,3,3,12);ll(3,12,12,12);}
 if(n===4){pp([[4,14],[3,9],[1,7],[2,5],[5,7],[5,2],[6,1],[7,6],[8,1],[9,1],[9,6],[11,2],[12,3],[11,8],[13,5],[14,6],[12,12],[10,14]],'white');}
 if(n===5){bb(0,2,16,12,'night');ll(3,5,6,7,'cyan');ll(6,7,3,9,'cyan');rr(8,10,4,1,'white');}
 if(n===6){bb(3,1,10,14,'panel');bb(5,3,6,12,'wall');rr(9,8,1,1,'o');}
 if(n===7){disc(o,6*s,6*s,5*s,5*s,'o');disc(o,6*s,6*s,4*s,4*s,'wall');ll(10,10,14,14);ll(11,10,15,14);}
 if(n===8||n===9){pp([[1,6],[5,6],[9,2],[9,13],[5,10],[1,10]],'white');if(n===8){ll(11,4,14,6);ll(14,6,14,10);ll(14,10,11,12);}else{ll(11,6,15,10,'red');ll(15,6,11,10,'red');}}
 if(n===10){for(let a=0;a<8;a++){const t=Math.PI*a/4;ll(8,8,Math.round(8+6*Math.cos(t)),Math.round(8+6*Math.sin(t)),'red');}rr(7,7,3,3,'red');}
 if(n===11){pp([[3,2],[8,1],[13,4],[14,9],[10,14],[5,14],[1,10],[1,5]],'white');ll(4,6,8,4);ll(8,4,11,7);ll(11,7,9,11);ll(9,11,5,11);ll(5,11,4,6);}
 if(n===12){pp([[2,1],[13,9],[8,10],[6,15]],'white');}
 if(n===13){bb(2,3,12,10,'panel');rr(5,6,2,2,'o');rr(10,6,2,2,'o');rr(6,10,5,1,'o');ll(8,0,8,3);rr(0,7,2,3,'o');rr(14,7,2,3,'o');}
 return o;
}
for(const size of [16,32]){im=blank(size*7,size*2);for(let n=0;n<14;n++)copy(icon(n,size),im,n%7*size,Math.floor(n/7)*size);save(im,`ui/icons-${size}.png`);}
module.exports={R,box,line,disc,poly,clear,iconNames};
console.log('Finished modular geometry and native UI glyphs');
