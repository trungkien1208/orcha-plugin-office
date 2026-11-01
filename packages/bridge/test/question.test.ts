import { allowSound, questionChoices } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";

const claude = `Do you want to make this edit to src/app.ts?
❯ 1. Yes
  2. Yes, allow all edits during this session
  3. No`;

const codex = "Run `bun test` in the repo?\n(y/n)";

const cursor = `Run this command?
1. Yes
2. No`;

describe("question choices", () => {
  test("numbered Claude and Cursor prompts become one button per option, plus Enter and Esc", () => {
    expect(questionChoices(claude).map((choice) => [choice.label, choice.keys])).toEqual([
      ["Yes", ["1"]],
      ["Yes, allow all edits during this session", ["2"]],
      ["No", ["3"]],
      ["Enter", ["enter"]],
      ["Esc", ["esc"]],
    ]);
    expect(questionChoices(cursor).map((choice) => choice.keys[0])).toEqual(["1", "2", "enter", "esc"]);
  });

  test("a (y/n) prompt sends y and n", () => {
    expect(questionChoices(codex).map((choice) => choice.keys)).toEqual([["y"], ["n"], ["enter"], ["esc"]]);
  });

  test("an unknown shape is only Enter, Esc, and the free-text answer", () => {
    expect(questionChoices("What should the function be called?").map((choice) => choice.label)).toEqual(["Enter", "Esc"]);
  });
});

describe("sound gap", () => {
  test("the same sound plays at most once per 2 seconds", () => {
    const last = new Map<string, number>();
    expect(allowSound(last, "done", 1_000)).toBe(true);
    expect(allowSound(last, "done", 2_000)).toBe(false);
    expect(allowSound(last, "request", 2_000)).toBe(true);
    expect(allowSound(last, "done", 3_000)).toBe(true);
  });
});
