// Animated fixtures share the same geometry; only the LEDs/neon change.
const p=require('./finish.cjs');const {read,crop,copy,blank,get,set,rgb,save}=p;
let a=read(p.ROOT+'/objects/window-night.png'),first=crop(a,0,0,96,48),second=crop(a,0,0,96,48),out=blank(192,48);
const flicker={'106,75,216':'#1d2747','224,85,156':'#6a4bd8','63,210,232':'#3b4560'};
for(let y=0;y<48;y++)for(let x=0;x<96;x++){const c=get(second,x,y),next=flicker[c.slice(0,3).join()];if(c[3]&&next)set(second,x,y,rgb(next));}copy(first,out,0,0);copy(second,out,96,0);save(out,'objects/window-night.png');
a=read(p.ROOT+'/objects/cctv.png');first=crop(a,0,0,16,16);let led=null;for(let y=7;y<12&&!led;y++)for(let x=11;x>=8;x--)if([[x,y],[x-1,y],[x+1,y],[x,y-1],[x,y+1]].every(([i,j])=>get(first,i,j)[3])){led=[x,y];break;}if(!led)throw Error('No camera LED position');second=crop(first,0,0,16,16);set(first,...led,rgb('#c8322f'));set(second,...led,rgb('#2a2f38'));out=blank(32,16);copy(first,out,0,0);copy(second,out,16,0);save(out,'objects/cctv.png');console.log('Normalized neon flicker and red CCTV LED',led);
