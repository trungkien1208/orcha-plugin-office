import { describe, expect, test } from "bun:test";
import { ago, clock, until, waiting } from "./format.ts";

describe("short time formats", () => {
  const now = Date.parse("2026-10-31T12:00:00Z");
  const min = 60_000, hour = 60 * min, day = 24 * hour;
  test("time left until a reset", () => {
    expect(until(now + 4 * hour + 53 * min, now)).toBe("4h 53m");
    expect(until(now + 25 * min, now)).toBe("25m");
    expect(until(now + day + 3 * hour, now)).toBe("1d 3h");
    expect(until(now + 7 * day, now)).toBe("7d");
    expect(until(undefined, now)).toBe("");
  });
  test("how long ago and how long waited", () => {
    expect(ago(now - 12 * min, now)).toBe("12m");
    expect(ago(now - 30 * hour, now)).toBe("1d");
    expect(waiting(now - 20_000, now)).toBe("just now");
    expect(waiting(now - 20_000, now, true)).toBe("now");
    expect(waiting(now - 65 * min, now)).toBe("1h 5m");
    expect(waiting(now - 65 * min, now, true)).toBe("1h");
  });
  test("clock", () => {
    expect(clock(new Date(2026, 9, 31, 9, 5, 7))).toBe("09:05");
    expect(clock(new Date(2026, 9, 31, 9, 5, 7), true)).toBe("09:05:07");
  });
});
