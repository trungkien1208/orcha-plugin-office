// Native 16px icons, matching the owner's Party Agent icon art.
// Reference PNGs are vendored so regeneration does not depend on another checkout.
const fs = require('node:fs');
const path = require('node:path');
const {PNG} = require('pngjs');
const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'packages/web/public');
const manifestPath = path.join(publicRoot, 'office/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const read = file => PNG.sync.read(fs.readFileSync(file));
const names = [...manifest.layout.iconsUi.order, ...manifest.layout.iconsUi2.order].filter(n=>!n.startsWith('spare'));
const mapping = {
 search:'inquiry',settings:'settings',bell:'approvals',send:'send',attach:'attach',close:'close',
 'open-in-orcha':'handback','show-on-floor':'office',remove:'close','close-project':'directory',
 'new-agent':'people','new-project':'new-chat',pencil:'assignment','key-esc':'keyboard',
 branch:'fork',commit:'online',worktree:'fork',file:'file',folder:'directory',diff:'recap',
 'tab-chat':'new-chat','tab-changes':'recap','tab-files':'directory','tab-setup':'settings',warning:'approvals-pending',check:'check',cross:'close',
 'tool-read':'file','tool-edit':'assignment','tool-write':'assignment','tool-grep':'search','tool-task':'agents',
 'tool-todo':'recap',thinking:'typing',clock:'clock',boss:'host',image:'image',skill:'party',shell:'tool-bash',
 'theme-office':'pantry','theme-compound':'office',keyboard:'keyboard',help:'question',
 'action-tap':'new-chat','action-knock':'takeover','action-whip':'handback','action-bonk':'stop',
 'action-megaphone':'notifications-on','action-buzzer':'approvals','action-zap':'bolt','action-coffee':'pantry',
 'action-high-five':'takeover','action-more':'party',code:'tool-bash',agent:'agents',project:'new-chat',
 calm:'pantry',privacy:'lock',idea:'inquiry',pause:'stop',document:'file','arrow-up':'push','arrow-down':'pull',
 'zoom-in':'zoom-in','zoom-out':'zoom-out',fit:'fit',office:'office',coffee:'pantry',chat:'typing',terminal:'tool-bash',
};
for(const n of Object.keys(mapping))if(!names.includes(n))names.push(n);
const oldSheets = [read(path.join(publicRoot,manifest.ui.iconsUi16)),read(path.join(publicRoot,manifest.ui.iconsUi216))];
const orders = [manifest.layout.iconsUi.order, manifest.layout.iconsUi2.order];
const C={ink:[72,80,108,255],white:[254,253,251,255],mint:[157,214,183,255],peach:[244,181,146,255],lav:[204,178,203,255]};
const blank=()=>new PNG({width:16,height:16});
const put=(im,x,y,c)=>{if(x<0||y<0||x>=16||y>=16)return;for(let k=0;k<4;k++)im.data[(y*16+x)*4+k]=c[k];};
const rect=(im,x,y,w,h,c)=>{for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)put(im,i,j,c);};
function old(name){
 let im=blank();const sheetIndex=orders.findIndex(o=>o.includes(name));if(sheetIndex<0)return null;
 const idx=orders[sheetIndex].indexOf(name),src=oldSheets[sheetIndex];
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const o=((Math.floor(idx/7)*16+y)*src.width+idx%7*16+x)*4;
  const r=src.data[o],g=src.data[o+1],b=src.data[o+2],a=src.data[o+3];if(a<128)continue;
  const light=(r+g+b)/3;const col=light<105?C.ink:light>207?C.white:(r>g+25?C.peach:g>r+8?C.mint:C.lav);put(im,x,y,col);
 }return im;
}
function source(name){const file=path.join(__dirname,'icon-sources',`${name}.png`);return fs.existsSync(file)?read(file):null;}
function art(name){
 let im=source(mapping[name]||name)||old(mapping[name]||name)||old(name)||source('question');
 if(im.width!==16||im.height!==16)im=old(name)||source('question');
 if(name==='fuel'){
  im=blank();rect(im,1,4,13,9,C.ink);rect(im,2,5,11,7,C.white);rect(im,14,7,1,3,C.ink);rect(im,3,6,7,5,C.mint);rect(im,10,6,2,5,C.lav);
 }
 if(name==='bolt'||name==='action-zap'){
  im=blank();const rows=['       IIIII    ','      IPPPI     ','     IPPPI      ','    IPPPI       ','   IPPPI        ','  IPPPPIIIII    ','  IPPPPPPPPI    ','   IIIIPPPI     ','      IPPI      ','     IPPI       ','    IPPI        ','   IPPI         ','   IPI          ','   II           '];
  rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='I')put(im,x,y+1,C.ink);if(v==='P')put(im,x,y+1,C.peach);}));
 }
 return im;
}
const out=path.join(publicRoot,'office/ui/pixel');fs.mkdirSync(out,{recursive:true});
const columns=10,rows=Math.ceil(names.length/columns),sheet=new PNG({width:columns*16,height:rows*16});
for(let index=0;index<names.length;index++){
 const name=names[index],im=art(name);if(!im)throw new Error(`Missing ${name}`);
 fs.writeFileSync(path.join(out,`${name}.png`),PNG.sync.write(im));
 for(let y=0;y<16;y++)for(let x=0;x<16;x++)for(let k=0;k<4;k++)sheet.data[((Math.floor(index/columns)*16+y)*sheet.width+index%columns*16+x)*4+k]=im.data[(y*16+x)*4+k];
}
fs.writeFileSync(path.join(out,'icons-16.png'),PNG.sync.write(sheet));
manifest.ui.iconsPixel16='office/ui/pixel/icons-16.png';manifest.layout.iconsPixel={columns,rows,order:names,sizes:[16]};
fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
const entries=Object.fromEntries(names.map((name,index)=>[name,index]));
fs.writeFileSync(path.join(root,'packages/web/src/floor/pixel-icons.generated.ts'),`// Generated by tools/office-art/pixel-icons.cjs from manifest.layout.iconsPixel.\nexport const PIXEL_SHEET = ${JSON.stringify(manifest.ui.iconsPixel16)};\nexport const PIXEL_COLUMNS = ${columns};\nexport const PIXEL_ROWS = ${rows};\nexport const PIXEL_ICON_INDEX: Record<string, number> = ${JSON.stringify(entries,null,2)};\n`);
console.log(`Wrote ${names.length} native pixel icons and manifest-backed sprite index.`);
const cells=names.map(name=>`<div class="cell"><div class="pair"><span><img src="${name}.png" alt="" width="48" height="48"></span><span><img src="${name}.png" alt="" width="48" height="48"></span></div><p>${name}</p></div>`).join('');
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Easy Job · Pixel icon family</title><style>body{margin:0;padding:35px;background:#fff7ee;color:#48506c;font:14px system-ui,sans-serif}h1{font-size:30px;margin:0 0 8px}header p{color:#8b8098;margin:0 0 25px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:18px 12px}.cell{min-width:0;text-align:center}.pair{display:flex;justify-content:center;gap:3px}.pair span{display:grid;place-items:center;min-width:65px;height:65px;background:#f6eadd;border-radius:9px}.pair span+span{background:#332c4a}img{image-rendering:pixelated}.cell p{font-size:10px;margin:8px 0;color:#86758c}</style><header><h1>A little more character.</h1><p>Easy Job · native 16px icon family · Party Agent palette · light + dark proof</p></header><main>${cells}</main></html>`);
