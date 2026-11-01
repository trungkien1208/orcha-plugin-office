import { describe, expect, test } from "bun:test";
import type { OfficeState } from "@easy-job/shared";
import { suggestNames } from "./names.ts";

const office = (names: string[], agents: string[]) =>
  ({ catalog: { cast: [], skins: names.map((name, index) => ({ id: `s${index}`, name })) }, agents: agents.map((name) => ({ name })) }) as unknown as OfficeState;

describe("agent name suggestions", () => {
  test("unused cast names first, in order, then numbered", () => {
    expect(suggestNames(office(["Headset", "Red Cap", "Bun"], ["headset"]), 2)).toEqual(["Red Cap", "Bun"]);
    expect(suggestNames(office(["Headset", "Red Cap"], ["Headset", "Red Cap"]), 2)).toEqual(["Headset 2", "Red Cap 2"]);
    expect(suggestNames(office(["Headset", "Red Cap", "Bun"], []), 1, 1)).toEqual(["Red Cap"]);
    expect(suggestNames(null)).toEqual(["Agent"]);
  });
});
