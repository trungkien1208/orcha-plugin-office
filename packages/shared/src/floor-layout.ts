import type { FloorMemory } from "./office.ts";

export const TILE = 32;
const WALL_ROWS = 4;
const ROW_STRIDE = 3;
const SEAT_TILES = 2;
const AISLE = 2;
const MARGIN = 1;
const OFFICE_ROWS = 5;

export type FloorProject = { workspaceId: string };
export type FloorAgent = { paneId: string; workspaceId: string; agentKey?: string };

function seatKey(agent: FloorAgent): string {
  return agent.agentKey ?? agent.paneId;
}

export type BenchSpot = {
  workspaceId: string;
  column: number;
  row: number;
  seats: number;
  x: number;
  y: number;
};

export type DeskSpot = {
  paneId: string;
  workspaceId: string;
  index: number;
  x: number;
  y: number;
};

export type FloorLayout = {
  benches: BenchSpot[];
  desks: DeskSpot[];
  /** true = blocked */
  grid: boolean[][];
  door: { x: number; y: number };
  cols: number;
  rows: number;
  memory: FloorMemory;
};

export function assignFloor(projects: FloorProject[], agents: FloorAgent[], memory: FloorMemory): FloorMemory {
  const benches: Record<string, number> = {};
  const seats: Record<string, number> = {};
  for (const project of projects) {
    const mine = agents.filter((agent) => agent.workspaceId === project.workspaceId);
    const even = Math.max(4, Math.ceil(mine.length / 2) * 2);
    const size = Math.max(even, memory.benches[project.workspaceId] ?? 0);
    benches[project.workspaceId] = size;
    const used = new Set<number>();
    const pending: FloorAgent[] = [];
    for (const agent of mine) {
      const current = memory.seats[seatKey(agent)];
      if (current != null && current >= 0 && current < size && !used.has(current)) {
        seats[seatKey(agent)] = current;
        used.add(current);
      } else pending.push(agent);
    }
    for (const agent of pending) {
      let seat = 0;
      while (used.has(seat)) seat += 1;
      seats[seatKey(agent)] = seat;
      used.add(seat);
    }
  }
  return { benches, seats };
}

export function layoutFloor(projects: FloorProject[], agents: FloorAgent[], memory: FloorMemory): FloorLayout {
  const assigned = assignFloor(projects, agents, memory);
  const widest = Math.max(4, ...projects.map((project) => assigned.benches[project.workspaceId] ?? 4));
  const benchTiles = widest * SEAT_TILES;
  const cols = MARGIN + benchTiles + AISLE + benchTiles + MARGIN;
  const benchRows = Math.ceil(projects.length / 2);
  const rows = WALL_ROWS + Math.max(1, benchRows) * ROW_STRIDE + OFFICE_ROWS;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
  for (let y = 0; y < WALL_ROWS; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const row = grid[y];
      if (row) row[x] = true;
    }
  }
  const door = { x: 1, y: WALL_ROWS - 1 };
  const doorRow = grid[door.y];
  if (doorRow) doorRow[door.x] = false;

  const benches: BenchSpot[] = projects.map((project, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const seats = assigned.benches[project.workspaceId] ?? 4;
    const x = MARGIN + column * (benchTiles + AISLE);
    const y = WALL_ROWS + row * ROW_STRIDE;
    blockDesk(grid, x, y, seats * SEAT_TILES);
    return { workspaceId: project.workspaceId, column, row, seats, x, y };
  });

  for (let y = rows - OFFICE_ROWS; y < rows; y += 1) {
    for (let x = 2; x < cols - 2; x += 1) {
      const row = grid[y];
      if (row && y < rows - 1) row[x] = true;
    }
  }

  const desks: DeskSpot[] = [];
  for (const bench of benches) {
    for (const agent of agents.filter((item) => item.workspaceId === bench.workspaceId)) {
      const index = assigned.seats[seatKey(agent)] ?? 0;
      desks.push({
        paneId: agent.paneId,
        workspaceId: bench.workspaceId,
        index,
        x: bench.x + index * SEAT_TILES,
        y: bench.y + 1,
      });
    }
  }
  return { benches, desks, grid, door, cols, rows, memory: assigned };
}

function blockDesk(grid: boolean[][], x: number, y: number, width: number) {
  const row = grid[y];
  if (!row) return;
  for (let i = 0; i < width; i += 1) row[x + i] = true;
}

export function benchOrigin(bench: BenchSpot): { x: number; y: number } {
  return { x: bench.x * TILE, y: bench.y * TILE };
}
