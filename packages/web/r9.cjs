// Native pixel art. PNG writer uses only Node built-ins; no image API or art dependency.
const fs=require('node:fs'),zlib=require('node:zlib'),vm=require('node:vm');
const colors={o:'#2f3a4f',paper:'#e3ece9',shade:'#9aa8ad',blue:'#3fd2e8',red:'#c8322f',pink:'#e0559c',cream:'#fff3c4',dark:'#3b4560'};
const blank=(w,h)=>({w,h,data:Buffer.alloc(w*h*4)});
function pixel(im,x,y,c){if(x<0||y<0||x>=im.w||y>=im.h)return;const hex=colors[c]||c;im.data.set([1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)).concat(255),(y*im.w+x)*4);}
function rect(im,x,y,w,h,c){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixel(im,xx,yy,c);}
function line(im,x,y,a,b,c){const n=Math.max(Math.abs(a-x),Math.abs(b-y));for(let i=0;i<=n;i++)pixel(im,Math.round(x+(a-x)*i/(n||1)),Math.round(y+(b-y)*i/(n||1)),c);}
function polygon(im,pts,c){for(let y=0;y<im.h;y++)for(let x=0;x<im.w;x++){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [a,b]=pts[i],[d,e]=pts[j];if((b>y)!==(e>y)&&x<(d-a)*(y-b)/(e-b)+a)inside=!inside;}if(inside)pixel(im,x,y,c);}for(let i=0;i<pts.length;i++)line(im,...pts[i],...pts[(i+1)%pts.length],'o');}
const crcTable=Array.from({length:256},(_,n)=>{for(let j=0;j<8;j++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc(b){let n=0xffffffff;for(const v of b)n=crcTable[(n^v)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);type.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(Buffer.concat([type,data])),data.length+8);return out;}
function save(im,path){const header=Buffer.alloc(13);header.writeUInt32BE(im.w);header.writeUInt32BE(im.h,4);header[8]=8;header[9]=6;const rows=Buffer.alloc(im.h*(im.w*4+1));for(let y=0;y<im.h;y++)im.data.copy(rows,y*(im.w*4+1)+1,y*im.w*4,(y+1)*im.w*4);fs.writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));}
const plane=blank(64,16),badges=blank(64,16);
for(let f=0;f<4;f++){const x=f*16,dy=[0,-1,0,1][f];polygon(plane,[[x+2,3+dy],[x+14,7+dy],[x+4,13+dy],[x+5,8+dy]],'paper');line(plane,x+5,8+dy,x+13,7+dy,'shade');line(plane,x+6,9+dy,x+6,11+dy,'blue');line(plane,x,6+dy,x+2,6+dy,'shade');pixel(plane,x+1,10+dy,'blue');rect(badges,x+1,1,14,14,'o');rect(badges,x+2,2,12,12,'dark');rect(badges,x+3,3,10,1,'shade');}
for(let j=0;j<8;j++){const t=j*Math.PI/4;line(badges,8,8,Math.round(8+5*Math.cos(t)),Math.round(8+5*Math.sin(t)),'pink');}rect(badges,7,7,3,3,'cream');
polygon(badges,[[19,5],[24,2],[29,5],[29,10],[25,14],[20,12],[18,8]],'paper');line(badges,21,6,25,5,'o');line(badges,25,5,27,8,'o');line(badges,27,8,24,11,'o');line(badges,24,11,21,9,'o');line(badges,21,9,21,6,'o');
polygon(badges,[[35,3],[45,9],[40,10],[38,14]],'paper');line(badges,37,5,42,9,'blue');
rect(badges,50,5,12,8,'o');rect(badges,51,6,10,6,'shade');rect(badges,53,8,2,2,'blue');rect(badges,58,8,2,2,'blue');line(badges,56,2,56,5,'paper');pixel(badges,56,2,'red');
const root='packages/web/public/office/';save(plane,root+'ui/fx-paper-plane.png');save(badges,root+'ui/account-badge.png');
const m=JSON.parse(fs.readFileSync(root+'manifest.json'));m.ui.fxPaperPlane='office/ui/fx-paper-plane.png';m.ui.accountBadge='office/ui/account-badge.png';for(const key of ['fxPaperPlane','accountBadge'])m.layout.animations[key]={sheet:m.ui[key],frame:{width:16,height:16},count:4,frames:4,columns:4,rows:1};m.layout.accountBadge={order:['claude','codex','cursor','other'],columns:4};fs.writeFileSync(root+'manifest.json',JSON.stringify(m,null,2)+'\n');
const out=blank(320,192);rect(out,0,0,320,192,'paper');const font=vm.runInNewContext('('+fs.readFileSync('docs/art-review/scene.js','utf8').match(/const FONT=(\{[^;]+\});/)[1]+')');function text(s,x,y){for(const ch of s){for(let yy=0;yy<5;yy++)for(let xx=0;xx<3;xx++)if(font[ch]?.[yy]?.[xx]==='1')pixel(out,x+xx,y+yy,'o');x+=4;}}
text('ROUND 9 - PIXEL ART',16,12);for(const [im,y,label]of [[plane,36,'PAPER PLANE / 4 FRAMES'],[badges,116,'CLAUDE  CODEX  CURSOR  OTHER']]){text(label,16,y-12);for(let yy=0;yy<16;yy++)for(let xx=0;xx<64;xx++){const i=(yy*64+xx)*4;if(im.data[i+3])for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)out.data.set(im.data.subarray(i,i+4),((y+yy*4+dy)*320+16+xx*4+dx)*4);}}
save(out,'docs/art-review/r9.png');
