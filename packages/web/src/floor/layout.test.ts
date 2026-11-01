import { expect, test } from "bun:test";
import { emptyLayoutMemory, layoutFloor } from "./layout.ts";
import { peopleOf } from "./contract.ts";
import { demoAgent, makeDemoOffice } from "./demo-state.ts";
import { findPath } from "./path.ts";
test("four fixed seats: 4→5 inserts _2, shifts flow; 5→3 retains it; reload drops it",()=>{
  const office=makeDemoOffice(3); office.agents=[0,1,2,3].map((n)=>demoAgent(n,"project-0"));
  const four=layoutFloor(office.projects,peopleOf(office),emptyLayoutMemory());
  expect(four.benches.map((b)=>b.seats)).toEqual([4,4,4]);
  const old=four.desks.map((d)=>d.address);
  office.agents.push(demoAgent(4,"project-0"));
  const five=layoutFloor(office.projects,peopleOf(office),four.memory);
  expect(five.benches.map((b)=>[b.team,b.label])).toEqual([[1,"Orcha_1"],[1,"Orcha_2"],[2,"Easy Job"],[3,"Payments"]]);
  expect(five.desks.slice(0,4).map((d)=>d.address)).toEqual(old);
  expect(five.desks[4]?.address).toEqual({projectId:"project-0",benchIndex:1,seat:0});
  expect(five.benches[2]?.x).toBe(four.benches[1]?.x); expect(five.benches[2]?.y).toBe(four.benches[1]?.y);
  office.agents=office.agents.slice(0,3);
  const three=layoutFloor(office.projects,peopleOf(office),five.memory);
  expect(three.benches).toHaveLength(4);
  expect(layoutFloor(office.projects,peopleOf(office),emptyLayoutMemory()).benches[0]?.label).toBe("Orcha");
});
test("every Desk is reachable from the door along the walkway behind its chairs", () => {
  const office = makeDemoOffice(8);
  office.agents = [];
  for (let p = 0; p < 8; p++) for (let n = 0; n < 4; n++) office.agents.push(demoAgent(p * 4 + n, `project-${p}`));
  const layout = layoutFloor(office.projects, peopleOf(office), emptyLayoutMemory(), 768, 600);
  expect(layout.desks).toHaveLength(32);
  for (const desk of layout.desks) {
    expect(layout.grid[desk.approach.y]?.[desk.approach.x]).toBe(false);
    const path = findPath(layout.grid, layout.door, desk.approach);
    expect(path.length).toBeGreaterThan(0);
    for (const step of path) expect(layout.grid[step.y]?.[step.x]).toBe(false);
  }
});

test("door, all desk approaches and management entrance remain connected across floor sizes",()=>{
 for(const width of [640,768,1024])for(const count of [1,4,8,16]){
 const office=makeDemoOffice(count);office.agents=Array.from({length:count*4},(_,i)=>demoAgent(i,`project-${Math.floor(i/4)}`));
 const layout=layoutFloor(office.projects,peopleOf(office),emptyLayoutMemory(),width);
 const entrance={x:Math.floor(layout.width/64),y:Math.floor((layout.height-144)/32)+2};
 for(const target of [layout.door,entrance,...layout.desks.map(d=>d.approach)]){expect(layout.grid[target.y]?.[target.x]).toBe(false);if(target!==layout.door)expect(findPath(layout.grid,layout.door,target).length).toBeGreaterThan(0);}
 }
});
