/* Shared native-pixel composition for the proof PNG and browser preview. */
(function () {
const C={ink:'#2f3a4f',wall:'#e3ece9',floor:'#c9d8d4',alt:'#bfcfcb',grout:'#aebdb9',steel:'#8fa3a0',desk:'#dfe5e4',edge:'#9aa8ad',panel:'#b7c4c8',chair:'#2a2f38',hi:'#444b57',red:'#c8322f',redD:'#9e2522',cream:'#fff3c4',white:'#ffffff',night:'#1d2747',cyan:'#3fd2e8',purple:'#6a4bd8',pink:'#e0559c'};
const FONT={A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['011','100','100','100','011'],D:['110','101','101','101','110'],E:['111','100','110','100','111'],F:['111','100','110','100','100'],G:['011','100','101','101','011'],H:['101','101','111','101','101'],I:['111','010','010','010','111'],J:['001','001','001','101','010'],K:['101','101','110','101','101'],L:['100','100','100','100','111'],M:['101','111','111','101','101'],N:['101','111','111','111','101'],O:['010','101','101','101','010'],P:['110','101','110','100','100'],Q:['010','101','101','111','011'],R:['110','101','110','101','101'],S:['011','100','010','001','110'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],V:['101','101','101','101','010'],W:['101','101','111','111','101'],X:['101','101','010','101','101'],Y:['101','101','010','010','010'],Z:['111','001','010','100','111'],0:['111','101','101','101','111'],1:['010','110','010','010','111'],2:['110','001','010','100','111'],3:['110','001','010','001','110'],4:['101','101','111','001','001'],5:['111','100','110','001','110'],6:['011','100','111','101','111'],7:['111','001','010','010','010'],8:['111','101','111','101','111'],9:['111','101','111','001','110'],'-':['000','000','111','000','000'],'.':['000','000','000','000','010']};
function rect(g,x,y,w,h,c){g.fillStyle=C[c]||c;g.fillRect(x,y,w,h);}
function box(g,x,y,w,h,c){rect(g,x,y,w,h,'ink');if(w>2&&h>2)rect(g,x+1,y+1,w-2,h-2,c);}
function line(g,x,y,a,b,c='ink'){let dx=Math.abs(a-x),sx=x<a?1:-1,dy=-Math.abs(b-y),sy=y<b?1:-1,e=dx+dy;for(;;){rect(g,x,y,1,1,c);if(x===a&&y===b)break;const e2=e*2;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}
function text(g,t,x,y,c='ink',s=1){for(const ch of t.toUpperCase()){const f=FONT[ch];if(f)f.forEach((r,j)=>[...r].forEach((v,i)=>{if(v==='1')rect(g,x+i*s,y+j*s,s,s,c)}));x+=s===1?4:7;}}
function draw(g,imgs,key,x,y,frame=0,w,h){const im=imgs[key];if(!im)return;if(w)g.drawImage(im,frame*w,0,w,h,x,y,w,h);else g.drawImage(im,x,y);}
function tiling(g,imgs,key,x,y,w,h){const im=imgs[key];if(!im)return;for(let j=0;j<h;j+=32)for(let i=0;i<w;i+=32){const sw=Math.min(32,w-i),sh=Math.min(32,h-j);g.drawImage(im,0,0,sw,sh,x+i,y+j,sw,sh);}}
function sleep(g,imgs,x,y,phase){draw(g,imgs,'ui/fx-sleep',x,y,phase%3,16,24);}
function bench(g,imgs,actor,x,y,ids,team,phase,statuses){const n=ids.length,width=(n+2)*32;draw(g,imgs,'objects/bench-l',x,y);for(let s=0;s<n;s++)draw(g,imgs,'objects/bench-m',x+32+s*32,y);draw(g,imgs,'objects/bench-r',x+32+n*32,y);rect(g,x+5,y+27,width-10,1,'edge');
for(let s=0;s<n;s++){const sx=x+32+s*32,id=ids[s],state=statuses?.[s]||(s===1&&team%3===1?'blocked':s===3?'idle':s===4?'done':'working');
 const screen=!id?C.night:state==='blocked'?(phase%2?'#ffb020':C.cream):state==='done'?C.steel:state==='idle'?C.night:C.cyan;
 rect(g,sx+4,y,24,12,screen);if(id&&state==='working'){rect(g,sx+6,y+2,9+(s+phase)%8,1,'white');rect(g,sx+6,y+5,13,1,'white');rect(g,sx+6,y+8,7+(phase%4),1,'white');}if(id&&state==='done'){line(g,sx+11,y+6,sx+14,y+9,'white');line(g,sx+14,y+9,sx+21,y+2,'white');}
 draw(g,imgs,'objects/monitor',sx,y-4);draw(g,imgs,'objects/phone-rack',sx-2,y+15);draw(g,imgs,'objects/desk-phone',sx+17,y+16);rect(g,sx+3,y+33,5,2,'ink');rect(g,sx+4,y+33,3,1,'cream');
 const blocked=id&&state==='blocked',chairX=sx+(blocked?7:0),chairY=y+(blocked?42:45),f=state==='blocked'?20+phase%2:state==='idle'?24+phase%2:state==='done'?22+phase%2:16+phase%4;
 if(blocked){draw(g,imgs,'objects/chair-back',chairX,chairY);actor(g,id,f,sx-8,y+8,team);}else{if(id)actor(g,id,f,sx-8,y+2,team);draw(g,imgs,'objects/chair-back',chairX,chairY);if(['shiba','husky','tabby','black-cat','raccoon'].includes(id)){g.save();g.beginPath();g.rect(sx+17,y+47,23,27);g.clip();actor(g,id,f,sx-8,y+2,team);g.restore();}}
 if(id&&state==='idle')sleep(g,imgs,sx+18,y+13,phase);
 if(blocked)draw(g,imgs,'ui/marker-needs',sx+18,y-21,phase%2,16,24);
 if(id&&state==='done')draw(g,imgs,'objects/noodle-cup',sx+18,y+18);if(id&&s%3===0)draw(g,imgs,'objects/energy-drink',sx+19,y+18);
}
const tagX=x+Math.floor((width-64)/2);draw(g,imgs,'objects/bench-tag',tagX,y+83);text(g,'TEAM '+String(team).padStart(2,'0'),tagX+10,y+89);return width;}
function scene(g,imgs,actor,phase=0){
 tiling(g,imgs,'tiles/yard',0,0,768,832);draw(g,imgs,'background/compound-night',0,0);draw(g,imgs,'objects/dorm-block',40,100);g.save();g.translate(0,64);
 // A roofless institutional office with a continuous service edge and skirting.
 box(g,32,152,704,584,'steel');rect(g,40,160,688,76,'wall');tiling(g,imgs,'tiles/floor',40,236,688,492);rect(g,40,228,688,8,'steel');rect(g,40,235,688,1,'ink');rect(g,39,236,1,492,'ink');rect(g,728,236,1,492,'ink');rect(g,40,728,688,1,'ink');
 draw(g,imgs,'objects/window-night',56,170,phase%2,96,48);draw(g,imgs,'objects/window-night',616,170,phase%2,96,48);
 draw(g,imgs,'objects/banner',256,157);rect(g,264,164,240,17,'red');text(g,'HIT TARGET TODAY - SLEEP TOMORROW',267,166,'cream',2);
 draw(g,imgs,'objects/poster-recruit',184,194);text(g,'EASY JOB',190,205);text(g,'HIGH PAY',190,214);
 draw(g,imgs,'objects/kpi-board',320,192);text(g,'TOP TEAMS',330,195,'cream');for(let i=0;i<3;i++){text(g,String(i+1),326,207+i*8);rect(g,337,207+i*8,[60,45,31][i],4,i===0?'red':'steel');}rect(g,403,205,3,3,'red');rect(g,404,208,1,3,'redD');
 draw(g,imgs,'objects/clock',421,195);draw(g,imgs,'objects/gong',450,190,phase%3,64,48);draw(g,imgs,'objects/wall-fan',548,190);
 draw(g,imgs,'objects/cctv',43,159,phase%2,16,16);draw(g,imgs,'objects/cctv',709,159,(phase+1)%2,16,16);
 draw(g,imgs,'objects/door',42,244);draw(g,imgs,'objects/water-cooler',692,246);draw(g,imgs,'objects/dorm-door',42,526);
 // Fixed conduit follows the wall, short leads run under each numbered team bench.
 line(g,45,321,45,517,'edge');line(g,721,318,721,608,'edge');for(const yy of [308,420,532]){line(g,46,yy,78,yy,'edge');line(g,690,yy,720,yy,'edge');box(g,43,yy-2,5,5,'panel');box(g,718,yy-2,5,5,'panel');}
 for(let yy=256;yy<620;yy+=32)draw(g,imgs,'tiles/aisle',368,yy);
 const groups=[['headset','red-cap','bun','shiny','curly','specs'],['robot','crt-bot','shiba','husky','tabby','raccoon'],['silver','mohawk','beard','bob','ponytail','braids'],['black-cat','husky','capybara','crew-cut','spike','beanie'],['headset','robot',null,'shiba',null,'tabby'],['specs',null,'curly','silver',null,'red-cap']];
 for(let i=0;i<6;i++)bench(g,imgs,actor,i%2?432:80,280+Math.floor(i/2)*112,groups[i],i+1,phase+i);
 draw(g,imgs,'objects/fluorescent',176,256);draw(g,imgs,'objects/fluorescent',528,256);draw(g,imgs,'objects/fluorescent',176,368);draw(g,imgs,'objects/fluorescent',528,368);draw(g,imgs,'objects/fluorescent',176,480);draw(g,imgs,'objects/fluorescent',528,480);
 draw(g,imgs,'objects/phone-chargers',44,636);text(g,'PHONE RACK',47,626);draw(g,imgs,'objects/noodle-boxes',44,676);draw(g,imgs,'objects/drink-crates',84,676);draw(g,imgs,'objects/printer',164,660);draw(g,imgs,'objects/shredder',205,660);
 draw(g,imgs,'objects/noodle-boxes',693,375);draw(g,imgs,'objects/drink-crates',693,486);draw(g,imgs,'objects/phone-chargers',655,648);draw(g,imgs,'objects/papers',660,690);draw(g,imgs,'objects/noodle-boxes',615,676);draw(g,imgs,'objects/drink-crates',655,680);
 draw(g,imgs,'objects/boss-office',288,628);box(g,338,615,92,10,'wall');text(g,'OFFICE - ACCOUNTS',350,618);actor(g,'boss',phase%4,360,422,0);
 // Service walk, wall piers and cable run ground the cutaway instead of a blank margin.
 for(let y=180;y<726;y+=96){box(g,25,y,9,14,'edge');box(g,734,y,9,14,'edge');}rect(g,40,744,688,2,'edge');for(let x=60;x<710;x+=48)rect(g,x,755,22,2,'panel');text(g,'DORM A',45,594,'cream');g.restore();
}
globalThis.OfficeScene={scene,bench,sleep,text,rect,box,line,draw,width:768,height:832};
})();
