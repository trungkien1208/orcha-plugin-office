import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const urlFile = path.join(process.cwd(), ".dev-fake.url");

async function demoUrl(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (fs.existsSync(urlFile)) {
      const url = fs.readFileSync(urlFile, "utf8").trim();
      const token = new URL(url).hash.replace(/^#t=/, "");
      const response = await fetch(new URL("/api/state", url), { headers: { authorization: `Bearer ${token}` } }).catch(() => null);
      if (response?.ok) return url;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("dev:fake did not become ready");
}

test("opens a Project, answers, prompts, and starts an Agent", async ({ page }) => {
  await page.goto(await demoUrl());
  await expect(page.locator(".hud")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await expect(page.locator(".prail").getByText("acme-superapp", { exact: false }).first()).toBeVisible();
  await page.locator(".prail .agent-row.blocked").first().click();
  await expect(page.getByRole("button", { name: /Always allow/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Esc/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Yes/ }).first().click();
  await page.locator(".prail .agent-row.idle").first().click();
  const composer = page.locator(".composer textarea");
  await composer.fill("continue the work");
  await page.locator(".composer .send").click();
  await expect(composer).toHaveValue("");
  await page.locator(".rail-foot .btn.primary").click();
  await expect(page.getByRole("heading", { name: "New Agent" })).toBeVisible();
  await page.getByRole("button", { name: "Start Agent" }).click();
  await expect(page.getByRole("heading", { name: "New Agent" })).toHaveCount(0);
});

test("without the token asks to open Easy Job from the terminal", async ({ page }) => {
  await page.goto("http://127.0.0.1:4599/#home");
  await expect(page.getByText("Open Easy Job from the terminal").first()).toBeVisible();
});

test("changes the model from the composer pill and accepts a custom model", async ({ page }) => {
  const models: string[] = [];
  await page.route("**/api/models?*",route=>route.fulfill({json:{kind:"claude",source:"test catalog",fetchedAt:"",models:[{id:"test-model",name:"Test Model",efforts:[],fast:false}]}}));
  await page.route("**/api/agents/*/model", async (route) => {
    models.push(route.request().postDataJSON().model);
    await route.fulfill({ json: { queued: false } });
  });
  await page.goto(await demoUrl());
  await expect(page.locator(".app:not([inert])")).toBeVisible();
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await page.locator(".prail .agent-row.idle").first().click();
  const pill = page.getByRole("button", { name: /^Model for / });
  await pill.click();
  await page.getByRole("option", { name: /Test Model/ }).click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(pill).toContainText("Confirming");
  expect(models).toEqual(["test-model"]);
  await expect(page.locator("dialog, .dialog")).toHaveCount(0);
  await pill.click();
  await page.getByRole("option", { name: /Custom model/ }).click();
  const custom = page.getByRole("textbox", { name: "Custom model name" });
  await expect(custom).toBeFocused();
  await custom.fill("test-custom-model");
  expect(models).toHaveLength(1);
  await custom.press("Enter");
  await expect(custom).toHaveCount(0);
  await expect(pill).toBeFocused();
  expect(models).toEqual(["test-model", "test-custom-model"]);
});
