import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";

async function open(page: Page) {
  await page.goto(fs.readFileSync(".dev-fake.url", "utf8").trim());
  await expect(page.locator(".app:not([inert])")).toBeVisible({ timeout: 15_000 });
}

test("Settings is a page: sections, theme and calm apply at once, the top bar stays slim", async ({ page }) => {
  await open(page);
  // The theme switches from the top bar in one click, and back.
  await page.locator(".hud .theme-btn").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "office");
  await page.locator(".hud .theme-btn").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "compound");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "General" })).toBeVisible();
  await page.getByText("Cozy Office", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "office");
  await page.getByRole("switch", { name: "Calm mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-calm", /.*/);
  await page.getByRole("button", { name: /Connection/ }).click();
  await expect(page.getByText("Bridge ↔ Orcha")).toBeVisible();
  await page.getByRole("button", { name: /Accounts/ }).click();
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
  await page.getByRole("button", { name: "Floor", exact: true }).click();
  await expect(page.locator(".floor-stats")).toContainText("teams");
});

test("New agent and New project: Esc closes, the project name follows the folder", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await page.getByRole("button", { name: "New agent", exact: true }).click();
  const agent = page.locator("form.launch");
  await expect(agent.getByRole("textbox", { name: /First task/ })).toBeFocused();
  await expect(agent.getByRole("radio", { name: "Claude" })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(agent).toHaveCount(0);
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const project = page.locator("form.launch");
  const folder = project.getByRole("textbox", { name: "Folder" });
  await folder.fill("/tmp/payments-api");
  await expect(project.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("payments-api");
  await project.getByRole("checkbox").uncheck();
  await expect(project.getByRole("button", { name: "Create project" })).toBeEnabled();
  await project.getByRole("button", { name: "Cancel" }).click();
  await expect(project).toHaveCount(0);
});

test("Files shows folders and what they hold, and search lists matches flat", async ({ page }) => {
  await page.route("**/api/agents/*/files", (route) => route.fulfill({ json: ["README.md", "src/app.ts", "src/lib/util.ts", "docs/guide.md"] }));
  await page.route("**/api/agents/*/file?*", (route) => route.fulfill({ json: { path: "src/app.ts", text: "one\ntwo\nthree", truncated: false } }));
  await open(page);
  await page.getByRole("button", { name: "Conversation", exact: true }).click();
  await page.locator(".prail .agent-row.idle").first().click();
  await page.locator(".conv-tabs button", { hasText: "files" }).click();
  await expect(page.locator(".dir-item")).toHaveCount(3);
  await page.locator(".file-row.is-dir .file-name", { hasText: "src" }).click();
  await expect(page.locator(".crumbs")).toContainText("src");
  await expect(page.locator(".dir-item")).toHaveText([/lib\//, /app\.ts/]);
  await page.locator(".dir-item", { hasText: "app.ts" }).click();
  await expect(page.locator(".viewer-meta")).toHaveText("3 lines");
  await page.getByRole("textbox", { name: "Search files" }).fill("util");
  await expect(page.locator(".file-row.flat")).toHaveCount(1);
  await expect(page.locator(".file-row.flat")).toContainText("src/lib");
});
