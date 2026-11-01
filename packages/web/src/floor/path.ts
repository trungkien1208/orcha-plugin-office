import PF from "pathfinding";

export type Point = { x: number; y: number };

export function findPath(blocked: boolean[][], from: Point, to: Point): Point[] {
  const rows = blocked.length;
  const cols = blocked[0]?.length ?? 0;
  if (!rows || !cols || from.x<0 || from.x>=cols || from.y<0 || from.y>=rows) return [];
  if (from.x === to.x && from.y === to.y) return [];
  const grid = new PF.Grid(cols, rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (blocked[y]?.[x]) grid.setWalkableAt(x, y, false);
    }
  }
  if (grid.isInside(from.x, from.y)) grid.setWalkableAt(from.x, from.y, true);
  if (!grid.isInside(to.x, to.y) || !grid.isWalkableAt(to.x, to.y)) return [];
  const finder = new PF.AStarFinder({ diagonalMovement: PF.DiagonalMovement.OnlyWhenNoObstacles });
  const raw = finder.findPath(from.x, from.y, to.x, to.y, grid).map(([x, y]) => ({ x: x ?? 0, y: y ?? 0 }));
  if (raw.length < 2) return [];
  return smooth(raw, blocked).slice(1);
}

function smooth(path: Point[], blocked: boolean[][]): Point[] {
  const out = [path[0]].filter((point): point is Point => point != null);
  let anchor = out[0];
  if (!anchor) return [];
  for (let i = 2; i < path.length; i += 1) {
    const next = path[i];
    if (!next || !clear(anchor, next, blocked)) {
      const corner = path[i - 1];
      if (corner) {
        anchor = corner;
        out.push(anchor);
      }
    }
  }
  const last = path.at(-1);
  if (last) out.push(last);
  return out;
}

export function clear(a: Point, b: Point, blocked: boolean[][]): boolean {
  let x=a.x,y=a.y; const dx=b.x-a.x,dy=b.y-a.y,nx=Math.abs(dx),ny=Math.abs(dy),sx=Math.sign(dx),sy=Math.sign(dy);
  const free=(xx:number,yy:number)=>blocked[yy]?.[xx]===false;
  if(!free(x,y)) return false;
  let ix=0,iy=0;
  while(ix<nx||iy<ny) {
    const test=(1+2*ix)*ny-(1+2*iy)*nx;
    if(test===0) { if(!free(x+sx,y)||!free(x,y+sy)) return false; x+=sx;y+=sy;ix++;iy++; }
    else if(test<0) {x+=sx;ix++;} else {y+=sy;iy++;}
    if(!free(x,y)) return false;
  } return true;
}
