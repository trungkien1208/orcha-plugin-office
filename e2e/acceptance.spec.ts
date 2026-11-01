import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const urlFile = path.join(process.cwd(), ".dev-fake.url");
const controlFile = path.join(process.cwd(), ".dev-fake.control");

async function demoUrl(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (fs.existsSync(urlFile) && fs.existsSync(controlFile)) {
      const url = fs.readFileSync(urlFile, "utf8").trim();
      const token = new URL(url).hash.replace(/^#t=/, "");
      const response = await fetch(new URL("/api/state", url), { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
      if (response?.ok) return url;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("dev:fake did not become ready");
}

function tokenOf(url: string): string {
  return new URL(url).hash.replace(/^#t=/, "");
}

async function control(pathname: string, body?: unknown): Promise<void> {
  const port = fs.readFileSync(controlFile, "utf8").trim();
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  if (!response.ok) throw new Error(`${pathname} ${response.status}`);
}

test.describe.configure({ mode: "serial" });

test("a rename in the fake Orcha shows up within about a second", async ({ page }) => {
  const url = await demoUrl();
  await page.goto(url);
  await expect(page.getByText("Headset").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
  const state = await fetch(new URL("/api/state", url), { headers: { authorization: `Bearer ${tokenOf(url)}` } });
  const office = (await state.json()) as { agents: Array<{ paneId: string; name: string }> };
  const headset = office.agents.find((agent) => agent.name === "Headset");
  if (!headset) throw new Error("missing Headset");
  const renamed = await fetch(new URL(`/api/agents/${encodeURIComponent(headset.paneId)}/rename`, url), {
    method: "POST",
    headers: { authorization: `Bearer ${tokenOf(url)}`, "content-type": "application/json" },
    body: JSON.stringify({ name: "Headphone" }),
  });
  expect(renamed.ok).toBe(true);
  await expect(page.getByText("Headphone").filter({ visible: true }).first()).toBeVisible({ timeout: 2_000 });
});

test("sent clears when the status changes, and otherwise says nothing changed after 10s", async ({ page }) => {
  const url = await demoUrl();
  await page.goto(url);
  const listed = await fetch(new URL("/api/state", url), { headers: { authorization: `Bearer ${tokenOf(url)}` } });
  const before = (await listed.json()) as {
    projects: Array<{ workspaceId: string; label: string }>;
    agents: Array<{ paneId: string; workspaceId: string; name: string; status: string }>;
  };
  const open = before.agents.find((agent) => agent.status === "idle" || agent.status === "working");
  const project = before.projects.find((item) => item.workspaceId === open?.workspaceId);
  if (!open || !project) throw new Error("no agent to prompt");
  await page.locator(`button.agent-row[title="${open.name} · ${project.label}"]`).click();
  const composer = page.getByRole("textbox", { name: `Message ${open.name}` });
  await composer.fill("continue the work");
  await page.getByRole("button", { name: "Send" }).click();
  await control("/status", { paneId: open.paneId, status: open.status === "working" ? "idle" : "working" });
  await page.waitForTimeout(11_000);
  await expect(page.getByText("No change seen yet")).toHaveCount(0);

  await composer.fill("one more line");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("No change seen yet")).toBeVisible({ timeout: 12_000 });
});

test("stopping the bridge shows reconnecting, and the same token comes back live", async ({ page }) => {
  const url = await demoUrl();
  const token = tokenOf(url);
  await page.goto(url);
  await expect(page.locator(".live")).toHaveAttribute("title", "Live", { timeout: 15_000 });
  await control("/stop");
  await expect(page.locator(".live")).toHaveAttribute("title", "Reconnecting… data may be out of date");
  await control("/start");
  await expect(page.locator(".live")).toHaveAttribute("title", "Live", { timeout: 8_000 });
  expect(tokenOf(fs.readFileSync(urlFile, "utf8").trim())).toBe(token);
});

test("two tabs, one sound", async ({ page }) => {
  const url = await demoUrl();
  let plays = 0;
  await page.context().route("**/api/sounds/request.mp3", async (route) => {
    plays += 1;
    await route.fulfill({ status: 200, contentType: "audio/mpeg", body: Buffer.alloc(128) });
  });
  const other = await page.context().newPage();
  await page.goto(url);
  await other.goto(url);
  // The first click anywhere unlocks sound.
  await page.locator(".hud").click({ position: { x: 5, y: 5 } });
  await other.locator(".hud").click({ position: { x: 5, y: 5 } });
  await other.bringToFront();
  const state = await fetch(new URL("/api/state", url), { headers: { authorization: `Bearer ${tokenOf(url)}` } });
  const office = (await state.json()) as { agents: Array<{ paneId: string; status: string }> };
  const idle = office.agents.find((agent) => agent.status === "idle");
  if (!idle) throw new Error("no idle agent");
  await control("/status", { paneId: idle.paneId, status: "blocked" });
  await page.waitForTimeout(1_000);
  expect(plays).toBe(1);
  await other.close();
});
