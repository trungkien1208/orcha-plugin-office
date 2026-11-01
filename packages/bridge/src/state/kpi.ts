import type { ActivityEntry, DoneToday, Project } from "@easy-job/shared";

export function doneToday(entries: ActivityEntry[], projects: Project[], now: number): DoneToday[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind !== "status" || entry.at < start.getTime() || !entry.workspaceId) continue;
    if (!entry.text.endsWith("→ done")) continue;
    counts.set(entry.workspaceId, (counts.get(entry.workspaceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([workspaceId, count]) => ({
      workspaceId,
      label: projects.find((project) => project.workspaceId === workspaceId)?.label ?? workspaceId,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 5);
}
