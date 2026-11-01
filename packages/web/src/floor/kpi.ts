import type { Project } from "./contract.ts";
export function rankTeams(projects: Project[], totals: Record<string, number>) {
  return projects.map((project, index) => ({ id: project.workspaceId, label: project.label, team: index + 1, done: totals[project.workspaceId] ?? 0 })).sort((a,b) => b.done - a.done || a.team - b.team).slice(0,5);
}
