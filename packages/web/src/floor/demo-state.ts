import { emptyFloorOffice } from "./contract.ts";
import type { FloorAgent, FloorOffice, Status } from "./contract.ts";
export const DEMO_CAST = ["headset","red-cap","bun","shiny","curly","mohawk","silver","specs","robot","crt-bot","shiba","husky","tabby","black-cat","raccoon","capybara"];
export function demoAgent(index: number, projectId: string): FloorAgent {
  const status: Status = (["working","blocked","done","idle","unknown"] as Status[])[index % 5] ?? "working";
  return { paneId: `demo:p${index}`, agentKey: `demo-agent-${index}`, workspaceId: projectId, tabId: `demo:t${index}`, kind: "claude", name: DEMO_CAST[index % DEMO_CAST.length] ?? "Agent", skin: DEMO_CAST[index % DEMO_CAST.length] ?? "headset", status, orchaStatus: status, stateChangeSeq: 1, completionSeq: 0, interactiveReady: true, launchPending: false, focused: false, task: ["Reviewing the queue","Needs your answer","Finished the tests","Waiting for a task","Reconnecting"][index % 5] };
}
export function makeDemoOffice(count = 6): FloorOffice {
  const office: FloorOffice = emptyFloorOffice(); office.orcha.connected = true;
  office.projects = Array.from({ length: count }, (_, i) => ({ workspaceId: `project-${i}`, number: i + 1, label: ["Orcha","Easy Job","Payments","Portal","Mobile","Quality"][i % 6] ?? `Project ${i}`, projectColor: ["#c8322f","#3b4560","#477e91"][i % 3] ?? "#3b4560", terminalCount: i % 3 }));
  office.agents = Array.from({ length: 16 }, (_, i) => demoAgent(i, office.projects[Math.floor(i / 3) % count]?.workspaceId ?? "project-0"));
  office.counts = { needsMe: 3, done: 3, working: 4, projects: count }; return office;
}
