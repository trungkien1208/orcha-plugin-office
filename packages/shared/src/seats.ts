import type { FloorMemory, SavedFloor, SeatPlace } from "./office.ts";

const PER_BENCH = 4;

export function emptySavedFloor(): SavedFloor {
  return { seats: {} };
}

export function migrateFloor(floor: unknown): SavedFloor {
  const seats: Record<string, SeatPlace> = {};
  if (!floor || typeof floor !== "object") return { seats };
  const raw = (floor as { seats?: unknown }).seats;
  if (!raw || typeof raw !== "object") return { seats };
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const place = asPlace(value);
    if (place) seats[key] = place;
  }
  return { seats };
}

export function floorNeedsMigration(floor: unknown): boolean {
  if (!floor || typeof floor !== "object") return false;
  if ("benches" in floor) return true;
  const seats = (floor as { seats?: unknown }).seats;
  if (!seats || typeof seats !== "object") return false;
  return Object.values(seats as Record<string, unknown>).some((value) => typeof value === "number");
}

/** Layout memory the current floor scene still consumes. */
export function savedToLayout(
  saved: SavedFloor,
  agents: { agentKey: string; workspaceId: string }[] = [],
): FloorMemory {
  const seats: Record<string, number> = {};
  const benches: Record<string, number> = {};
  for (const [key, place] of Object.entries(saved.seats)) {
    seats[key] = place.benchIndex * PER_BENCH + place.seat;
    if (place.projectId) {
      benches[place.projectId] = Math.max(benches[place.projectId] ?? 0, (place.benchIndex + 1) * PER_BENCH);
    }
  }
  for (const agent of agents) {
    const index = seats[agent.agentKey];
    if (index == null) continue;
    const width = Math.max(PER_BENCH, Math.ceil((index + 1) / 2) * 2);
    benches[agent.workspaceId] = Math.max(benches[agent.workspaceId] ?? 0, width);
  }
  return { benches, seats };
}

export function layoutToSaved(
  layout: FloorMemory,
  agents: { agentKey: string; workspaceId: string; paneId: string }[],
): SavedFloor {
  const seats: Record<string, SeatPlace> = {};
  for (const [key, index] of Object.entries(layout.seats)) {
    const agent = agents.find((item) => item.agentKey === key || item.paneId === key);
    const n = Math.max(0, Math.floor(index));
    seats[key] = { projectId: agent?.workspaceId ?? "", benchIndex: Math.floor(n / PER_BENCH), seat: n % PER_BENCH };
  }
  return { seats };
}

function asPlace(value: unknown): SeatPlace | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const index = Math.floor(value);
    return { projectId: "", benchIndex: Math.floor(index / PER_BENCH), seat: index % PER_BENCH };
  }
  if (!value || typeof value !== "object") return null;
  const place = value as Partial<SeatPlace>;
  if (typeof place.benchIndex !== "number" || typeof place.seat !== "number") return null;
  return {
    projectId: typeof place.projectId === "string" ? place.projectId : "",
    benchIndex: Math.max(0, Math.floor(place.benchIndex)),
    seat: Math.max(0, Math.floor(place.seat)),
  };
}
