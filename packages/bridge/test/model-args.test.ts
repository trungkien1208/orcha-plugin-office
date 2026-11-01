import { expect, test } from "bun:test";
import { modelArgs } from "../src/actions.ts";

test("model flags per agent kind, nothing when no model is picked", () => {
  expect(modelArgs("claude", "opus")).toEqual(["--model", "opus"]);
  expect(modelArgs("codex", "gpt-5.4")).toEqual(["-m", "gpt-5.4"]);
  expect(modelArgs("claude", "  ")).toEqual([]);
  expect(modelArgs("claude")).toEqual([]);
});
