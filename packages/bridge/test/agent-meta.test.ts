import { emptyLocal, modelFamily, stageStep, type SessionSnapshot } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { reconcile } from "../src/state/reconcile.ts";

describe("stage and model family", () => {
  test("stage words and the usual synonyms become one step", () => {
    expect(stageStep("testing")).toBe("testing");
    expect(stageStep("thinking")).toBe("thinking");
    expect(stageStep("planning")).toBe("thinking");
    expect(stageStep("editing")).toBe("coding");
    expect(stageStep("writing")).toBe("coding");
    expect(stageStep("running tests")).toBe("testing");
    expect(stageStep("review")).toBe("reviewing");
    expect(stageStep("done")).toBe("finished");
    expect(stageStep("finished")).toBe("finished");
    expect(stageStep("")).toBeUndefined();
    expect(stageStep("waiting on you")).toBeUndefined();
  });

  test("model strings seen in the live fixture, then the agent kind", () => {
    expect(modelFamily("claude-opus-5-5", "claude")).toBe("opus");
    expect(modelFamily("claude-sonnet-5-5", "claude")).toBe("sonnet");
    expect(modelFamily("claude-haiku-4-5", "claude")).toBe("haiku");
    expect(modelFamily("gpt-6.1-sol", "codex")).toBe("gpt");
    expect(modelFamily(undefined, "cursor")).toBe("cursor");
    expect(modelFamily(undefined, "codex")).toBe("codex");
    expect(modelFamily(undefined, "claude")).toBe("other");
  });

  test("the reconciler fills both fields from the captured snapshot", () => {
    const raw = JSON.parse(fs.readFileSync(path.join(import.meta.dir, "fixtures/snapshot-live.json"), "utf8")) as {
      result: { snapshot: SessionSnapshot };
    };
    const agents = reconcile(raw.result.snapshot, emptyLocal(), 1, "/tmp/sock").agents;
    const steps = new Set(agents.map((agent) => agent.stageStep));
    const families = new Set(agents.map((agent) => agent.modelFamily));
    expect(steps.has("testing")).toBe(true);
    expect(steps.has("thinking")).toBe(true);
    expect(families.has("opus")).toBe(true);
    expect(families.has("sonnet")).toBe(true);
    expect(families.has("gpt")).toBe(true);
    expect(families.has("cursor")).toBe(true);
    const cursor = agents.find((agent) => agent.kind === "cursor");
    expect(cursor?.modelFamily).toBe("cursor");
    expect(cursor?.stageStep).toBeUndefined();
  });
});
