import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { locateTranscript, readTranscript } from "../src/conversation/load.ts";

describe("transcript tail", () => {
  test("a large file returns the tail line and not the head", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-tail-"));
    const file = path.join(dir, "session.jsonl");
    const head = `${JSON.stringify({ type: "user", uuid: "head-secret", timestamp: "2020-01-01T00:00:00Z", message: { role: "user", content: "HEAD-SECRET" } })}\n`;
    const tail = `${JSON.stringify({ type: "assistant", uuid: "tail-1", timestamp: "2026-01-01T00:00:00Z", message: { role: "assistant", content: [{ type: "text", text: "tail-only" }] } })}\n`;
    fs.writeFileSync(file, `${head}${"x".repeat(300 * 1024)}\n${tail}`);
    const items = readTranscript({ kind: "claude", file });
    expect(items.some((item) => item.text?.includes("tail-only"))).toBe(true);
    expect(items.some((item) => item.text?.includes("HEAD-SECRET") || item.id === "head-secret")).toBe(false);
    expect(readTranscript({ kind: "claude", file })).toBe(items);
    fs.appendFileSync(file, `${JSON.stringify({ type: "assistant", uuid: "tail-2", timestamp: "2026-01-02T00:00:00Z", message: { role: "assistant", content: [{ type: "text", text: "after" }] } })}\n`);
    const next = readTranscript({ kind: "claude", file });
    expect(next).not.toBe(items);
    expect(next.some((item) => item.text?.includes("after"))).toBe(true);
  });

  test("before= pages to the older chunk", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-page-"));
    const file = path.join(dir, "session.jsonl");
    const lines = Array.from({ length: 20 }, (_, index) =>
      JSON.stringify({
        type: "user",
        uuid: `id-${index}`,
        timestamp: "2026-01-01T00:00:00Z",
        message: { role: "user", content: `line ${index}` },
      }),
    );
    fs.writeFileSync(file, `${lines.join("\n")}\n`);
    const page = readTranscript({ kind: "claude", file }, { before: "id-10", limit: 3 });
    expect(page.map((item) => item.id)).toEqual(["id-7", "id-8", "id-9"]);
  });

  test("a Cursor session file is found by its chat uuid and parsed", () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "easy-job-cursor-"));
    const session = "11111111-1111-1111-1111-111111111111";
    const file = path.join(home, ".cursor", "projects", "demo", "agent-transcripts", session, `${session}.jsonl`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `${JSON.stringify({ role: "user", message: { content: [{ type: "text", text: "hello from cursor" }] } })}\n`,
    );
    const hit = locateTranscript({ kind: "cursor", session, home });
    expect(hit.kind).toBe("cursor");
    if (hit.kind === "missing") return;
    expect(readTranscript(hit).map((item) => item.text)).toEqual(["hello from cursor"]);
    expect(locateTranscript({ kind: "cursor", session: "missing-session", home }).kind).toBe("missing");
  });
});
