import { describe, expect, test } from "bun:test";
import type { SessionSnapshot } from "@easy-job/shared";
import { applyChanges } from "../src/orcha/delta.ts";

const base: SessionSnapshot = {
  workspaces: [{ workspace_id: "w1", number: 1, label: "one", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "t1", agent_status: "idle" }],
  panes: [{ pane_id: "w1:p1", workspace_id: "w1", tab_id: "t1", agent_status: "idle" }],
  agents: [{ pane_id: "w1:p1", workspace_id: "w1", tab_id: "t1", agent_status: "idle", name: "A" }],
};

describe("session deltas", () => {
  test("updates replace records in place, adds append, removes drop", () => {
    const next = applyChanges(base, [
      { entity: "agent", op: "updated", id: "w1:p1", record: { pane_id: "w1:p1", workspace_id: "w1", tab_id: "t1", agent_status: "working", name: "A" } },
      { entity: "pane", op: "added", id: "w1:p2", record: { pane_id: "w1:p2", workspace_id: "w1", tab_id: "t1", agent_status: "idle" } },
      { entity: "workspace", op: "updated", id: "w1", record: { ...base.workspaces[0], label: "renamed" } },
      { entity: "tab", op: "added", id: "t2", record: { tab_id: "t2" } },
    ]);
    expect(next.agents[0]?.agent_status).toBe("working");
    expect(next.panes.map((pane) => pane.pane_id)).toEqual(["w1:p1", "w1:p2"]);
    expect(next.workspaces[0]?.label).toBe("renamed");
    const gone = applyChanges(next, [{ entity: "agent", op: "removed", id: "w1:p1" }, { entity: "pane", op: "removed", id: "w1:p1" }]);
    expect(gone.agents).toEqual([]);
    expect(gone.panes.map((pane) => pane.pane_id)).toEqual(["w1:p2"]);
    expect(base.agents[0]?.agent_status).toBe("idle");
  });
});
