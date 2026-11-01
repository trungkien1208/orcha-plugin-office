// Production finishing: native pixel sampling, palette lock, atlas alignment and tint masks.
// Source images are generated with imagegen; this never smooths or invents intermediate colours.
const fs = require('node:fs');
const path = require('node:path');
const {PNG} = require('pngjs');
const ROOT=path.resolve('packages/web/public/office');
const palette='#2f3a4f #c9d8d4 #bfcfcb #aebdb9 #e3ece9 #8fa3a0 #dfe5e4 #9aa8ad #b7c4c8 #2a2f38 #444b57 #3b4560 #c8322f #9e2522 #fff3c4 #1d2747 #6a4bd8 #e0559c #3fd2e8 #f6d2b2 #f3c9a5 #e2b089 #c98f6a #8d5a3b #ffffff #d0d0d0 #a0a0a0 #707070'.split(' ');
const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const colours=palette.map(rgb), grey=['#707070','#a0a0a0','#d0d0d0'].map(rgb), OUT=rgb('#2f3a4f');
const read=p=>PNG.sync.read(fs.readFileSync(p));
const blank=(w,h)=>new PNG({width:w,height:h});
const get=(im,x,y)=>{if(x<0||y<0||x>=im.width||y>=im.height)return [0,0,0,0];return Array.from(im.data.subarray((y*im.width+x)*4,(y*im.width+x)*4+4));};
function set(im,x,y,c){if(x<0||y<0||x>=im.width||y>=im.height)return;const i=(y*im.width+x)*4;im.data.set(c.length===3?[...c,255]:c,i);}
function nearest(c,cs=colours){let best=cs[0],dist=Infinity;for(const v of cs){const d=c.slice(0,3).reduce((a,n,i)=>a+(n-v[i])**2,0);if(d<dist){dist=d;best=v;}}return best;}
function save(im,p){const full=path.join(ROOT,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,PNG.sync.write(im));}
function copy(src,dst,dx,dy){for(let y=0;y<src.height;y++)for(let x=0;x<src.width;x++){const c=get(src,x,y);if(c[3])set(dst,dx+x,dy+y,c);}}
function crop(im,x,y,w,h){const o=blank(w,h);for(let j=0;j<h;j++)for(let i=0;i<w;i++)set(o,i,j,get(im,x+i,y+j));return o;}
function bbox(im){let x0=im.width,y0=im.height,x1=-1,y1=-1;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(get(im,x,y)[3]>=128){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}return x1<0?null:[x0,y0,x1-x0+1,y1-y0+1];}
function mainComponent(im){const seen=new Uint8Array(im.width*im.height),groups=[];for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const start=y*im.width+x;if(seen[start]||get(im,x,y)[3]<160)continue;const group=[],q=[start];seen[start]=1;while(q.length){const p=q.pop(),px=p%im.width,py=Math.floor(p/im.width);group.push(p);for(const [nx,ny] of [[px-1,py],[px+1,py],[px,py-1],[px,py+1]]){const n=ny*im.width+nx;if(nx>=0&&ny>=0&&nx<im.width&&ny<im.height&&!seen[n]&&get(im,nx,ny)[3]>=160){seen[n]=1;q.push(n);}}}groups.push(group);}groups.sort((a,b)=>b.length-a.length);const o=blank(im.width,im.height);for(const g of groups.filter(g=>g.length>(groups[0]?.length||0)*.03))for(const p of g)set(o,p%im.width,Math.floor(p/im.width),get(im,p%im.width,Math.floor(p/im.width)));return o;}
function sample(im,w,h){const o=blank(w,h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=get(im,Math.min(im.width-1,Math.floor((x+.5)*im.width/w)),Math.min(im.height-1,Math.floor((y+.5)*im.height/h)));if(c[3]>=160)set(o,x,y,[...c.slice(0,3),255]);}return o;}
function paletteLock(im){for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const c=get(im,x,y);if(c[3])set(im,x,y,nearest(c));}return im;}
function outline(im){const o=crop(im,0,0,im.width,im.height);for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(get(im,x,y)[3]&&[[x-1,y],[x+1,y],[x,y-1],[x,y+1]].some(([a,b])=>!get(im,a,b)[3]))set(o,x,y,OUT);return o;}
function spriteBounds(im,count){
 const w=im.width,h=im.height,seen=new Uint8Array(w*h),groups=[];
 for(let n=0;n<w*h;n++){if(seen[n]||im.data[n*4+3]<160)continue;const q=[n];seen[n]=1;let area=0,x0=w,y0=h,x1=0,y1=0;
  while(q.length){const v=q.pop(),x=v%w,y=Math.floor(v/w);area++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const k of [x?v-1:-1,x<w-1?v+1:-1,y?v-w:-1,y<h-1?v+w:-1])if(k>=0&&!seen[k]&&im.data[k*4+3]>=160){seen[k]=1;q.push(k);}}
  if(area>300)groups.push({area,x0,y0,w:x1-x0+1,h:y1-y0+1});
 }
 if(groups.length<count)throw Error('Only '+groups.length+' source sprite components; expected '+count);
 const largest=groups.sort((a,b)=>b.area-a.area).slice(0,count).sort((a,b)=>(a.y0+a.h/2)-(b.y0+b.h/2));const ordered=[];
 for(let row=0;row<8;row++)ordered.push(...largest.slice(row*4,row*4+4).sort((a,b)=>a.x0-b.x0));
 return ordered;
}
function finishCharacter(id,src){const source=read(src),sheet=blank(192,576),mask=blank(192,576);
 const bounds=source.width/source.height<.45?Array.from({length:32},(_,f)=>{const x0=Math.round((f%4)*source.width/4),y0=Math.round(Math.floor(f/4)*source.height/8);return {x0,y0,w:Math.round(((f%4)+1)*source.width/4)-x0,h:Math.round((Math.floor(f/4)+1)*source.height/8)-y0};}):spriteBounds(source,32);
 for(let f=0;f<32;f++){
 const col=f%4,row=Math.floor(f/4),b=bounds[f];
 let cell=mainComponent(crop(source,b.x0,b.y0,b.w,b.h));const cb=bbox(cell);if(!cb)throw Error(id+' empty source frame '+f);cell=crop(cell,...cb);
 // Preserve intentional raised-hand, seated and napping silhouettes while keeping walk scale stable.
 const seated=[12,16,17,18,19,22,23,24,25,27].includes(f)&&id!=='boss';
 const targetH=seated?([24,25].includes(f)?34:42):56;
 const h=targetH,w=Math.min(44,Math.max(20,Math.round(cell.width/cell.height*h)));cell=sample(cell,w,h);
 let polo=blank(w,h);
 // Neutral hair and headset highlights grow from the head; keep those connected
 // clusters out of the shirt mask, including the older worker's silver sideburns.
 const headNeutral=new Uint8Array(w*h),queue=[];
 const neutral=(x,y)=>{const c=get(cell,x,y);return c[3]&&Math.max(...c.slice(0,3))-Math.min(...c.slice(0,3))<42&&Math.min(...c.slice(0,3))>84;};
 for(let y=0;y<h*.4;y++)for(let x=0;x<w;x++)if(neutral(x,y)){headNeutral[y*w+x]=1;queue.push(y*w+x);}
 while(queue.length){const n=queue.pop(),x=n%w,y=Math.floor(n/w);for(const [a,b]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(a>=0&&b>=0&&a<w&&b<h&&!headNeutral[b*w+a]&&neutral(a,b)){headNeutral[b*w+a]=1;queue.push(b*w+a);}}
 if(id!=='boss')for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=get(cell,x,y),max=Math.max(...c.slice(0,3)),min=Math.min(...c.slice(0,3));
   // The cloth is the only neutral bright mid-body material. Skin, hair and badges remain in the base.
   const ty=y/h;const front=[0,1,2,3,13,14,15,28,29,30,31].includes(f);
   const badge=front&&x>w*.34&&x<w*.65&&ty>.60&&ty<.78&&min>210;
   if(c[3]&&max-min<42&&min>84&&ty>.40&&ty<.85&&!badge&&!headNeutral[y*w+x]){const g=nearest(c,grey);set(cell,x,y,g);set(polo,x,y,g);}
 }
 cell=outline(paletteLock(cell)); // Outlines belong to the base, never the tint mask.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(get(polo,x,y)[3]&&get(cell,x,y).slice(0,3).join(',')===OUT.join(','))set(polo,x,y,[0,0,0,0]);
 const dx=col*48+Math.floor((48-w)/2),dy=row*72+72-h;copy(cell,sheet,dx,dy);copy(polo,mask,dx,dy);
 }
 save(sheet,`characters/${id}.png`);if(id!=='boss')save(mask,`characters/${id}-polo.png`);
 // Face-and-shoulders portrait uses the neutral front-facing source pose, with no background.
 const stand=crop(sheet,48,3*72,48,72),standMask=crop(mask,48,3*72,48,72),b=bbox(stand);
 const headH=Math.min(b[3],Math.round(b[3]*.76));let face=crop(stand,b[0],b[1],b[2],headH),pm=crop(standMask,b[0],b[1],b[2],headH);
 const ph=62,pw=Math.min(62,Math.round(face.width/face.height*ph));face=sample(face,pw,ph);pm=sample(pm,pw,ph);const portrait=blank(64,64),portraitMask=blank(64,64);copy(face,portrait,Math.floor((64-pw)/2),64-ph);copy(pm,portraitMask,Math.floor((64-pw)/2),64-ph);save(portrait,`characters/${id}-portrait.png`);if(id!=='boss')save(portraitMask,`characters/${id}-portrait-polo.png`);
}
function finishObject(spec){const {file,source,width,height,columns=1}=spec;const im=read(source),out=blank(width,height),fw=width/columns;
 for(let f=0;f<columns;f++){const sx=Math.round(f*im.width/columns),sw=Math.round((f+1)*im.width/columns)-sx;let frame=crop(im,sx,0,sw,im.height),b=bbox(frame);if(!b)throw Error(file+' empty');frame=crop(frame,...b);const ratio=Math.min((fw-2)/frame.width,(height-2)/frame.height);let small=sample(frame,Math.max(1,Math.round(frame.width*ratio)),Math.max(1,Math.round(frame.height*ratio)));small=outline(paletteLock(small));copy(small,out,f*fw+Math.floor((fw-small.width)/2),height-small.height);}
 save(out,file);return out;
}
module.exports={ROOT,palette,rgb,colours,grey,OUT,read,blank,get,set,nearest,save,copy,crop,bbox,sample,paletteLock,outline,finishCharacter,finishObject};
if(require.main===module){const sources=JSON.parse(fs.readFileSync('docs/art-review/sources.json'));for(const [id,src]of Object.entries(sources.characters||{}))finishCharacter(id,src);for(const spec of sources.objects||[])finishObject(spec);console.log('Finished source sprites');}
