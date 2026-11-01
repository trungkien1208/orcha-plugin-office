import type { Person, Project } from "./contract.ts";
import type { Point } from "./path.ts";
export const TILE=32,WALL_Y=192,FIRST_BENCH_Y=224,ROW_STRIDE=128,EXTERIOR=224; // 3 tiles of Bench + 1 tile walkway behind the chairs
export type SeatAddress={projectId:string;benchIndex:number;seat:number};
export type LayoutMemory={benches:Record<string,number>;seats:Record<string,SeatAddress>;slots:Record<string,number>;order:string[];closed:string[];projects:Record<string,Project>};
export const emptyLayoutMemory=():LayoutMemory=>({benches:{},seats:{},slots:{},order:[],closed:[],projects:{}});
export type Bench={id:string;team:number;benchIndex:number;total:number;label:string;closed:boolean;x:number;y:number;seats:number;width:number;project:Project};
export type Desk={benchId:string;key:string;paneId:string;projectId:string;index:number;address:SeatAddress;x:number;y:number;seatX:number;benchY:number;approach:Point};
export type Layout={benches:Bench[];desks:Desk[];grid:boolean[][];door:Point;width:number;height:number;memory:LayoutMemory};
export function layoutFloor(projects:Project[],people:Person[],memory:LayoutMemory,availableWidth=768,availableHeight=0):Layout{
 const order=[...memory.order],closed=[...memory.closed],stored={...memory.projects},counts={...memory.benches},slots={...memory.slots},seats:Record<string,SeatAddress>={};
 for(const p of projects){stored[p.workspaceId]=p;if(!order.includes(p.workspaceId))order.push(p.workspaceId);const i=closed.indexOf(p.workspaceId);if(i>=0)closed.splice(i,1);}
 for(const p of projects){const id=p.workspaceId,mine=people.filter(a=>a.projectId===id),used=new Set<number>();let count=Math.max(1,counts[id]??1,Math.ceil(mine.length/4));
  for(const a of mine){const old=memory.seats[a.key];if(old?.projectId===id&&old.seat>=0&&old.seat<4&&old.benchIndex>=0){const flat=old.benchIndex*4+old.seat;if(!used.has(flat)){seats[a.key]=old;used.add(flat);count=Math.max(count,old.benchIndex+1);}}}
  for(const a of mine)if(!seats[a.key]){let flat=0;while(used.has(flat))flat++;seats[a.key]={projectId:id,benchIndex:Math.floor(flat/4),seat:flat%4};used.add(flat);}
  counts[id]=count;
 }
 for(const id of order)if(!projects.some(p=>p.workspaceId===id)&&!closed.includes(id))closed.push(id);
 let next=Math.max(-1,...Object.values(slots))+1;
 for(const id of order)for(let n=0;n<(counts[id]??1);n++){const key=`${id}::${n}`;if(slots[key]===undefined)slots[key]=next++;}
 const total=Math.max(next,0),width=Math.max(640,Math.floor(availableWidth/32)*32),height=Math.max(availableHeight,FIRST_BENCH_Y+Math.max(1,Math.ceil(total/2))*ROW_STRIDE+176),cols=width/TILE,rows=Math.ceil(height/TILE);
 const grid=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>y<6||x===0||x===cols-1||y===rows-1));
 const benches:Bench[]=[];
 for(const id of order){const project=stored[id];if(!project)continue;const count=counts[id]??1,team=order.indexOf(id)+1;
  for(let n=0;n<count;n++){const slot=slots[`${id}::${n}`]??0,x=Math.round((width/2+(slot%2===0?-256:64))/32)*32,y=FIRST_BENCH_Y+Math.floor(slot/2)*ROW_STRIDE,isClosed=closed.includes(id);
   benches.push({id:`${id}::${n}`,team,benchIndex:n,total:count,label:`${project.label}${count>1?`_${n+1}`:''}${isClosed?' (closed)':''}`,closed:isClosed,x,y,seats:4,width:192,project});
   for(let yy=y/TILE;yy<(y+96)/TILE;yy++)for(let xx=x/TILE;xx<(x+192)/TILE;xx++){const row=grid[yy];if(row)row[xx]=true;}
   // Walkable approach tile behind each chair.
   for(let seat=0;seat<4;seat++){const row=grid[Math.floor((y+112)/TILE)],cx=Math.floor((x+48+seat*32)/TILE);if(row)row[cx]=false;}
  }
 }
 for(const p of storageProps(width,height)) for(let y=Math.floor(p.y/TILE);y<Math.ceil((p.y+p.h)/TILE);y++) for(let x=p.x/TILE;x<(p.x+p.w)/TILE;x++){const row=grid[y];if(row)row[x]=true;}
 // Door-side props and the management office block movement.
 const propCells:number[][]=[[1,11,1,2],[1,16,1,2],[cols-2,15,1,2],[cols-2,18,1,2]];
 for(const [tx,ty,tw,th] of propCells){if(tx===undefined||ty===undefined||tw===undefined||th===undefined)continue;for(let yy=ty;yy<ty+th;yy++)for(let xx=tx;xx<tx+tw;xx++){const row=grid[yy];if(row)row[xx]=true;}}
 const officeY=Math.floor((height-144)/TILE);for(let y=officeY;y<officeY+3;y++)for(let x=Math.floor(cols/2)-3;x<Math.floor(cols/2)+3;x++){const row=grid[y];if(row&&y!==officeY+2)row[x]=true;}
 const desks:Desk[]=[];
 for(const person of people){const address=seats[person.key];if(!address)continue;const bench=benches.find(b=>b.project.workspaceId===person.projectId&&b.benchIndex===address.benchIndex&&!b.closed);if(!bench)continue;const seatX=bench.x+TILE+address.seat*TILE,x=seatX+16,y=bench.y+68;desks.push({benchId:bench.id,key:person.key,paneId:person.paneId,projectId:person.projectId,index:address.seat,address,x,y,seatX,benchY:bench.y,approach:{x:Math.floor((seatX+16)/TILE),y:Math.floor((bench.y+112)/TILE)}});}
 return {benches,desks,grid,door:{x:1,y:6},width,height,memory:{benches:counts,seats,slots,order,closed,projects:stored}};
}

/** Storage stays in the side bays; the central aisle and chair approaches remain free. */
export function storageProps(width: number, height: number) {
 const names = ["lockerRow", "shrine", "waterCooler", "waterJugs", "stackedChairs", "printerBig", "printer", "shredder", "serverRack", "generator", "fanRusty", "extensionMess", "drinkCrates", "noodleBoxes", "leakBucket"];
 return names.map((name,i)=>({name,x:i%2===0?32:width-32-Math.min(96,width/2-288),y:224+Math.floor(i/2)*96,w:name==="lockerRow"?96:name==="generator"||name==="fanRusty"?48:32,h:64})).filter(p=>p.y+p.h<height-144&&p.w<=Math.min(96,width/2-288));
}
