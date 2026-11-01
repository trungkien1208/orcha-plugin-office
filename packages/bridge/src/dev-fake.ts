import { demoSnapshot, startFakeOrcha, type FakeUpdates } from "../test/fake-orcha.ts";
import type { SessionSnapshot } from "@easy-job/shared";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const fixture = path.resolve(import.meta.dir, "../test/fixtures/snapshot-live.json");
const raw = JSON.parse(fs.readFileSync(fixture, "utf8")) as { result: { snapshot: SessionSnapshot } };
const socketPath = path.join(os.tmpdir(), `easy-job-fake-${process.pid}.sock`);
const home = path.join(os.tmpdir(), `easy-job-home-${process.pid}`);
const fake = await startFakeOrcha({ socketPath, snapshot: demoSnapshot(raw.result.snapshot) });
const urlFile = path.resolve(import.meta.dir, "../../../.dev-fake.url");
const controlFile = path.resolve(import.meta.dir, "../../../.dev-fake.control");
fs.rmSync(urlFile, { force: true });

// The version the fake bridge claims, so the update flow can be watched end to end (see POST /update below).
let bridgeVersion = "";

function spawnBridge() {
  return Bun.spawn(
    ["bun", path.resolve(import.meta.dir, "main.ts"), "--no-open", "--socket", socketPath, "--port", "4599"],
    { stdout: "pipe", stderr: "inherit", env: { ...process.env, EASY_JOB_HOME: home, ...(bridgeVersion ? { EASY_JOB_DEV_VERSION: bridgeVersion } : {}) } },
  );
}

async function readUrl(spawned: ReturnType<typeof spawnBridge>): Promise<string> {
  const reader = spawned.stdout.getReader();
  const decoder = new TextDecoder();
  let url = "";
  while (!url.includes("#t=")) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const text = decoder.decode(chunk.value);
    process.stdout.write(text);
    const match = text.match(/http:\/\/127\.0\.0\.1:\d+\/#t=[0-9a-f]+/);
    if (match) url = match[0];
  }
  return url;
}

let child = spawnBridge();
let url = await readUrl(child);
if (!url) {
  console.error("dev:fake did not print a URL");
  child.kill();
  await fake.close();
  process.exit(1);
}
const publish = () => fs.writeFileSync(urlFile, `${url}\n`);
publish();
process.stdout.write(`demo ${url}\n`);

let stopping = false;
const control = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req) {
    const pathname = new URL(req.url).pathname;
    if (req.method === "POST" && pathname === "/status") {
      const body = (await req.json()) as { paneId?: string; status?: string };
      if (body.paneId && body.status) fake.pushStatus(body.paneId, body.status);
      return Response.json({ ok: true });
    }
    // { mode } picks the plugin update scenario (FakeUpdates). "restart" restarts the bridge as the new version.
    if (req.method === "POST" && pathname === "/update") {
      const body = (await req.json()) as { mode?: FakeUpdates["mode"]; latest?: string };
      if (body.mode) fake.updates.mode = body.mode;
      if (body.latest) fake.updates.latest = body.latest;
      fake.updates.onUpdate = () => {
        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, 300));
          child.kill("SIGTERM");
          await child.exited;
          await new Promise((resolve) => setTimeout(resolve, 1500));
          fake.updates.installed = fake.updates.latest;
          fake.updates.mode = "current";
          bridgeVersion = fake.updates.latest;
          child = spawnBridge();
          url = await readUrl(child);
          publish();
        })();
      };
      return Response.json({ ok: true, updates: { ...fake.updates, onUpdate: undefined } });
    }
    if (req.method === "POST" && pathname === "/stop") {
      child.kill("SIGTERM");
      await child.exited;
      return Response.json({ ok: true });
    }
    if (req.method === "POST" && pathname === "/start") {
      if (child.exitCode == null) return Response.json({ ok: true, url });
      child = spawnBridge();
      url = await readUrl(child);
      if (!url) return Response.json({ ok: false }, { status: 500 });
      publish();
      return Response.json({ ok: true, url });
    }
    return new Response("no", { status: 404 });
  },
});
fs.writeFileSync(controlFile, `${control.port}\n`);

const finish = async () => {
  if (stopping) return;
  stopping = true;
  child.kill();
  control.stop(true);
  fs.rmSync(controlFile, { force: true });
  await fake.close();
  process.exit(0);
};
process.on("SIGINT", () => void finish());
process.on("SIGTERM", () => void finish());
await new Promise(() => {});
