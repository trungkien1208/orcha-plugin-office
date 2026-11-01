import { describe, expect, test } from "bun:test";
import { createPairQueue, departureFor } from "./Bouncers.ts";

describe("HR pair queue", () => {
  test("at most two pairs run, and carry-ins wait with carry-outs", () => {
    const queue = createPairQueue<string>(2);
    expect(queue.take("out-a")).toBe(true);
    expect(queue.take("in-b")).toBe(true);
    expect(queue.take("in-c")).toBe(false);
    expect(queue.active).toBe(2);
    expect(queue.waiting).toBe(1);
    expect(queue.release()).toBe("in-c");
    expect(queue.active).toBe(2);
    expect(queue.waiting).toBe(0);
    expect(queue.release()).toBeUndefined();
    expect(queue.active).toBe(1);
    queue.clear();
    expect(queue.active).toBe(0);
    expect(queue.waiting).toBe(0);
  });

  test("dropping a queued carry-in releases nothing and the next free slot stays empty", () => {
    const queue = createPairQueue<string>(2);
    expect(queue.take("out-a")).toBe(true);
    expect(queue.take("out-b")).toBe(true);
    expect(queue.take("in-c")).toBe(false);
    expect(queue.drop((item) => item === "in-c")).toBe(true);
    expect(queue.waiting).toBe(0);
    expect(queue.active).toBe(2);
    expect(queue.release()).toBeUndefined();
    expect(queue.active).toBe(1);
  });

  test("a carry-in that never started is removed instead of carried out", () => {
    expect(departureFor("queued")).toBe("finish");
    expect(departureFor("started")).toBe("carry-out");
    expect(departureFor("none")).toBe("carry-out");
  });
});
