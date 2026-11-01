import type { ConversationItem } from "@easy-job/shared";
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { claudeSlug } from "../src/conversation/load.ts";
import { watchTranscript } from "../src/conversation/watch.ts";

const cwd = "/tmp/easy-job-watch";

function transcript(home: string, session: string, text: string): string {
  const dir = path.join(home, ".claude", "projects", claudeSlug(cwd));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${session}.jsonl`);
  const line = JSON.stringify({
    type: "user",
    timestamp: "2026-10-30T05:00:00.000Z",
    uuid: text,
    message: { role: "user", content: text },
  });
  fs.appendFileSync(file, `${line}\n`);
  return file;
}

function silence(): { close(): void } {
  return { close() {} };
}

async function waitFor(check: () => boolean, label: string) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 1000) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("transcript watch", () => {
  test("a stat poll reads an append that fs.watch did not report", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-watch-"));
    transcript(home, "sess", "first");
    const seen: ConversationItem[] = [];
    const watch = watchTranscript(
      { kind: "claude", cwd, session: "sess", home, pollMs: 30 },
      (items) => seen.push(...items),
      silence,
    );
    try {
      transcript(home, "sess", "second");
      await waitFor(() => seen.some((item) => item.text === "second"), "polled append");
      expect(seen.filter((item) => item.text === "second")).toHaveLength(1);
      expect(watch.items.some((item) => item.text === "second")).toBe(true);
    } finally {
      watch.close();
    }
  });

  test("the watch callback and the poll share one read, so a line is delivered once", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-watch-"));
    const file = transcript(home, "sess", "first");
    const seen: ConversationItem[] = [];
    let listener = () => {};
    const watch = watchTranscript(
      { kind: "claude", cwd, session: "sess", home, pollMs: 40 },
      (items) => seen.push(...items),
      (_file, next) => {
        listener = next;
        return silence();
      },
    );
    try {
      fs.appendFileSync(file, `${JSON.stringify({ type: "user", timestamp: "2026-10-30T05:00:01.000Z", uuid: "once", message: { role: "user", content: "once" } })}\n`);
      listener();
      await new Promise((resolve) => setTimeout(resolve, 90));
      expect(seen.filter((item) => item.text === "once")).toHaveLength(1);
    } finally {
      watch.close();
    }
  });

  test("closing the watch stops the poll", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-watch-"));
    transcript(home, "sess", "first");
    const seen: ConversationItem[] = [];
    const watch = watchTranscript(
      { kind: "claude", cwd, session: "sess", home, pollMs: 20 },
      (items) => seen.push(...items),
      silence,
    );
    watch.close();
    transcript(home, "sess", "after");
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(seen.some((item) => item.text === "after")).toBe(false);
  });

  test("a multi-byte character split across two appends stays whole", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-watch-"));
    const file = transcript(home, "sess", "first");
    const seen: ConversationItem[] = [];
    const watch = watchTranscript({ kind: "claude", cwd, session: "sess", home, pollMs: 20 }, (items) => seen.push(...items), silence);
    try {
      const line = Buffer.from(`${JSON.stringify({ type: "user", timestamp: "2026-10-30T05:00:01.000Z", uuid: "vi", message: { role: "user", content: "Mình đã merge" } })}\n`);
      const cut = line.indexOf(Buffer.from("đ")) + 1;
      fs.appendFileSync(file, line.subarray(0, cut));
      await new Promise((resolve) => setTimeout(resolve, 60));
      fs.appendFileSync(file, line.subarray(cut));
      await waitFor(() => seen.some((item) => item.id === "vi"), "split line");
      expect(seen.find((item) => item.id === "vi")?.text).toBe("Mình đã merge");
    } finally {
      watch.close();
    }
  });

  test("a live tool result updates its call instead of adding a result line", async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ej-watch-"));
    const file = transcript(home, "sess", "first");
    const seen: ConversationItem[] = [];
    const watch = watchTranscript({ kind: "claude", cwd, session: "sess", home, pollMs: 20 }, (items) => seen.push(...items), silence);
    try {
      fs.appendFileSync(file, `${JSON.stringify({ type: "assistant", timestamp: "2026-10-30T05:00:02.000Z", uuid: "a1", message: { role: "assistant", content: [{ type: "tool_use", id: "tool-1", name: "Bash", input: { command: "bun test" } }] } })}\n`);
      await waitFor(() => seen.some((item) => item.id === "tool-1"), "tool call");
      fs.appendFileSync(file, `${JSON.stringify({ type: "user", timestamp: "2026-10-30T05:00:03.000Z", uuid: "u1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "tool-1", content: "ok", is_error: false }] } })}\n`);
      await waitFor(() => seen.filter((item) => item.id === "tool-1").length === 2, "updated call");
      expect(seen.at(-1)?.tool).toMatchObject({ name: "Bash", ok: true });
      expect(seen.some((item) => item.tool?.name === "result")).toBe(false);
      expect(watch.items.filter((item) => item.id === "tool-1")).toHaveLength(1);
    } finally {
      watch.close();
    }
  });
});
