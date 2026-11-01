import { findPath, type Point } from "./path.ts";
export type Route = { points: Point[]; done: () => void; speed: number };
export function route(grid: boolean[][], from: Point, to: Point): Point[] {
  const a={x:Math.floor(from.x/32),y:Math.floor(from.y/32)},b={x:Math.floor(to.x/32),y:Math.floor(to.y/32)};
  const points=findPath(grid,a,b).map((p)=>({x:p.x*32+16,y:p.y*32+20}));
  if (a.x!==b.x || a.y!==b.y) { if(!points.length) return []; }
  points.push(to); return points;
}
export function advance(target: {x:number;y:number;setPosition:(x:number,y:number)=>unknown}, move: Route, delta: number) {
  let budget=move.speed*Math.min(delta,50)/1000;
  while(budget>0 && move.points.length) { const point=move.points[0]; if(!point) break; const dx=point.x-target.x,dy=point.y-target.y,d=Math.hypot(dx,dy); if(d<=budget) { target.setPosition(point.x,point.y); budget-=d; move.points.shift(); } else { target.setPosition(target.x+dx/d*budget,target.y+dy/d*budget); budget=0; } }
  if(!move.points.length) move.done();
}
