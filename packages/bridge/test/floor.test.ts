import { layoutFloor } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";

const projects = ["w1", "w2", "w3"].map((workspaceId) => ({ workspaceId }));

describe("floor layout", () => {
  test("fills the left column, then the right, and keeps a Desk", () => {
    const memory = { benches: {}, seats: {} };
    const first = layoutFloor(projects, [{ paneId: "w1:p1", workspaceId: "w1" }, { paneId: "w2:p1", workspaceId: "w2" }], memory);
    expect(first.benches.map((bench) => [bench.column, bench.row])).toEqual([[0, 0], [1, 0], [0, 1]]);
    expect(first.benches[0]?.seats).toBe(4);
    expect(first.desks.find((desk) => desk.paneId === "w1:p1")?.index).toBe(0);
    const grown = layoutFloor(
      projects,
      Array.from({ length: 5 }, (_, index) => ({ paneId: `w1:p${index + 1}`, workspaceId: "w1" })),
      first.memory,
    );
    expect(grown.benches[0]?.seats).toBe(6);
    expect(grown.desks.find((desk) => desk.paneId === "w1:p1")?.index).toBe(0);
    const shrunk = layoutFloor(projects, [{ paneId: "w1:p1", workspaceId: "w1" }], grown.memory);
    expect(shrunk.benches[0]?.seats).toBe(6);
    expect(shrunk.desks.find((desk) => desk.paneId === "w1:p1")?.index).toBe(0);
    expect(shrunk.grid[shrunk.door.y]?.[shrunk.door.x]).toBe(false);
    expect(shrunk.grid[0]?.[0]).toBe(true);
  });
});
