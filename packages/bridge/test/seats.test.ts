import { migrateFloor } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadLocal } from "../src/state/local.ts";

describe("seat memory", () => {
  test("an old bench-size file becomes places and drops the size map", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-seats-"));
    const file = path.join(home, "state.json");
    fs.writeFileSync(
      file,
      `${JSON.stringify({
        version: 1,
        seen: {},
        skins: {},
        waitingSince: {},
        floor: { benches: { w2: 6 }, seats: { "agent-1": 5, "agent-2": { projectId: "w9", benchIndex: 0, seat: 1 } } },
      })}\n`,
    );
    const loaded = loadLocal(file);
    expect(loaded.get().floor).toEqual({
      seats: {
        "agent-1": { projectId: "", benchIndex: 1, seat: 1 },
        "agent-2": { projectId: "w9", benchIndex: 0, seat: 1 },
      },
    });
    const again = JSON.parse(fs.readFileSync(file, "utf8")) as { floor: { benches?: unknown; seats: unknown } };
    expect(again.floor.benches).toBeUndefined();
    expect(migrateFloor({ seats: { a: 0 } }).seats.a).toEqual({ projectId: "", benchIndex: 0, seat: 0 });
  });
});
