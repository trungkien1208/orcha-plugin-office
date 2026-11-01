// Finalize cloth masks without changing silhouettes, heads, fur, equipment or poses.
const fs=require('node:fs'),p=require('./finish.cjs');
const {skins}=require('./catalog.cjs');
const {get,set,crop,blank,bbox,copy,save,sample,grey,nearest}=p;
const cloth=new Set(['#d0d0d0','#a0a0a0','#707070','#dfe5e4','#9aa8ad','#b7c4c8','#c9d8d4','#bfcfcb','#aebdb9','#e3ece9','#8fa3a0']);
const hex=c=>'#'+c.slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
const animals=['robot','crt-bot','shiba','husky','tabby','black-cat','raccoon','capybara'];
let report=[];
for(const id of skins){const fn=`characters/${id}.png`,im=p.read(p.ROOT+'/'+fn),old=p.read(p.ROOT+'/'+fn),mask=blank(192,im.height);let changes=0;
for(let f=0;f<32;f++){
 const dx=f%4*48,dy=Math.floor(f/4)*72,frame=crop(im,dx,dy,48,72),b=bbox(frame),w=b[2],h=b[3];
 let cutoff=([20,21].includes(f)?.59:[22,23].includes(f)?.53:f===14?.52:[24,25].includes(f)?.40:.43);
 if(['silver','raccoon','husky','robot','crt-bot'].includes(id))cutoff+=.07;
 if(id==='bun'&&f===26)cutoff=.28;
 const candidates=blank(48,72);for(let y=b[1];y<b[1]+h*.88;y++)for(let x=b[0];x<b[0]+w;x++){
  const c=get(frame,x,y),rx=(x-b[0])/w,ry=(y-b[1])/h;
  if(c[3]&&ry>=cutoff&&ry<.86&&cloth.has(hex(c))){if(rx>.12&&rx<.88)set(candidates,x,y,nearest(c,grey));}
 }
 const seen=new Uint8Array(48*72);let groups=[];
 for(let y=0;y<72;y++)for(let x=0;x<48;x++){const n=y*48+x;if(seen[n]||!get(candidates,x,y)[3])continue;const q=[n],group=[];seen[n]=1;let torso=false;
 while(q.length){const v=q.pop(),a=v%48,bb=Math.floor(v/48);group.push(v);const rx=(a-b[0])/w,ry=(bb-b[1])/h;torso||=rx>.28&&rx<.72&&ry>Math.max(cutoff,id==='bun'&&f===26?.30:.5)&&ry<.82;
 for(const [nx,ny]of [[a-1,bb],[a+1,bb],[a,bb-1],[a,bb+1]])if(nx>=0&&ny>=0&&nx<48&&ny<72&&!seen[ny*48+nx]&&get(candidates,nx,ny)[3]){seen[ny*48+nx]=1;q.push(ny*48+nx);}}
 if(torso)groups.push(group);
 }
 for(const group of groups)for(const n of group){const x=n%48,y=Math.floor(n/48),g=get(candidates,x,y);set(mask,dx+x,dy+y,g);if(get(im,dx+x,dy+y).join()!==g.join())changes++;set(im,dx+x,dy+y,g);}
 // Every occupied cloth region in a pose remains a tint source, even if narrow.
 let count=0;for(let y=0;y<72;y++)for(let x=0;x<48;x++)count+=!!get(mask,dx+x,dy+y)[3];report.push({id,frame:f,poloPixels:count});
}
// Prove all edits are recolours of the cloth mask, with alpha and geometry unchanged.
for(let y=0;y<576;y++)for(let x=0;x<192;x++){const a=get(im,x,y),b=get(old,x,y);if(a[3]!==b[3])throw Error('Silhouette changed '+id);if(a.join()!==b.join()&&!get(mask,x,y)[3])throw Error('Non-cloth changed '+id);}
save(im,fn);save(mask,`characters/${id}-polo.png`);
const stand=crop(im,48,216,48,72),sm=crop(mask,48,216,48,72),b=bbox(stand),headH=Math.min(b[3],Math.round(b[3]*.76)),ph=62,pw=Math.min(62,Math.round(b[2]/headH*ph));const pm=sample(crop(sm,b[0],b[1],b[2],headH),pw,ph),portrait=p.read(p.ROOT+`/characters/${id}-portrait.png`),portraitMask=blank(64,64);copy(pm,portraitMask,Math.floor((64-pw)/2),2);for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(get(portraitMask,x,y)[3])set(portrait,x,y,get(portraitMask,x,y));save(portrait,`characters/${id}-portrait.png`);save(portraitMask,`characters/${id}-portrait-polo.png`);
console.log(id,'cloth corrections',changes,'minimum mask',Math.min(...report.filter(r=>r.id===id).map(r=>r.poloPixels)));
}
fs.writeFileSync('docs/art-review/tint-finalization.json',JSON.stringify(report,null,2));
