import { expect, test } from "bun:test";
import { availableActions, dispatchWork, FUN_ACTIONS, HURRY, inReach } from "./actions.ts";
import type { FloorInput, Person } from "./contract.ts";
import { makeDemoOffice } from "./demo-state.ts";

const person = (status: Person["status"]): Person => ({ key: "a1", paneId: "w1:p1", projectId: "w1", name: "Headset", skin: "headset", color: "#3b4560", status });

function input(calls: unknown[][]): FloorInput {
  return { office: makeDemoOffice(2), selected: null, settings: { nudgeText: "keep going" }, callbacks: { onAction: (...args) => void calls.push(args), onSelectAgent: () => undefined } };
}

test("fun actions never reach the Agent, whatever its status", async () => {
  const calls: unknown[][] = [];
  for (const status of ["idle", "working", "blocked", "done", "unknown"] as const)
    for (const kind of FUN_ACTIONS) expect(await dispatchWork(kind, person(status), input(calls))).toBe(false);
  expect(calls).toHaveLength(0);
});

test("knock only for idle Agents, with the nudge text; bonk needs a confirm; megaphone targets the Project", async () => {
  const calls: unknown[][] = [];
  expect(await dispatchWork("knock", person("working"), input(calls))).toBe(false);
  expect(await dispatchWork("knock", person("idle"), input(calls))).toBe(true);
  expect(await dispatchWork("bonk", person("working"), input(calls))).toBe(false);
  expect(await dispatchWork("bonk", person("working"), input(calls), { confirmed: "true" })).toBe(true);
  expect(await dispatchWork("megaphone", person("idle"), input(calls), { text: "" })).toBe(false);
  expect(await dispatchWork("megaphone", person("idle"), input(calls), { text: "stand-up in 5" })).toBe(true);
  expect(await dispatchWork("whip", person("blocked"), input(calls))).toBe(false);
  expect(await dispatchWork("whip", person("working"), input(calls))).toBe(true);
  expect(calls).toEqual([
    ["knock", "a1", { text: "keep going" }],
    ["bonk", "a1", { confirmed: "true" }],
    ["megaphone", "w1", { text: "stand-up in 5" }],
    ["whip", "a1", { text: HURRY }],
  ]);
});

test("when Orcha is down only the gags are offered", () => {
  expect(availableActions("idle", false)).toEqual([...FUN_ACTIONS]);
  expect(availableActions("idle", true)).toContain("knock");
  expect(availableActions("working", true)).not.toContain("knock");
});

test("the Boss must be within 1.5 tiles", () => {
  expect(inReach({ x: 0, y: 0 }, { x: 40, y: 20 })).toBe(true);
  expect(inReach({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(false);
});
