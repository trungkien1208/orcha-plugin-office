import { describe, expect, test } from "bun:test";
import { looksLikePath, pathResolver, repoRelative, uploadId, uploadImages } from "./paths.ts";

describe("chat paths", () => {
  test("paths are recognised, prose, URLs and versions are not", () => {
    for (const path of ["home/Launch.tsx", "packages/web/src/", "./README.md", "/Users/me/app/src/a.ts", "Chat.tsx:120", ".gitignore"]) expect(looksLikePath(path)).toBe(true);
    for (const text of ["bun run check", "https://example.com/a.ts", "1.2.3", "useState", "Opus 5.5"]) expect(looksLikePath(text)).toBe(false);
  });

  test("paths become relative to the Agent's folder or are refused", () => {
    expect(repoRelative("/Users/me/app/src/a.ts:12", "/Users/me/app")).toBe("src/a.ts");
    expect(repoRelative("./docs/", "/Users/me/app")).toBe("docs/");
    expect(repoRelative("/etc/passwd", "/Users/me/app")).toBeNull();
    expect(repoRelative("../secret", "/Users/me/app")).toBeNull();
  });

  test("uploaded images are pulled out of a prompt", () => {
    const text = "look at this\n@/Users/me/.easy-job/uploads/p1/170-shot.png";
    expect(uploadImages(text)).toEqual({ ids: ["p1/170-shot.png"], rest: "look at this" });
    expect(uploadId("/Users/me/.easy-job/uploads/p1/170-shot.png")).toBe("p1/170-shot.png");
    expect(uploadId("src/a.png")).toBeNull();
  });
});

describe("path resolver", () => {
  const resolve = pathResolver(["packages/web/src/ui/batch1.css", "packages/web/src/App.tsx", "docs/a.md", "src/App.tsx"], "/repo");
  test("exact files and folders, unique names and tails", () => {
    expect(resolve("docs/a.md")).toBe("docs/a.md");
    expect(resolve("packages/web/")).toBe("packages/web");
    expect(resolve("batch1.css")).toBe("packages/web/src/ui/batch1.css");
    expect(resolve("/repo/docs/a.md:3")).toBe("docs/a.md");
    expect(resolve("web/src/App.tsx")).toBe("packages/web/src/App.tsx");
  });
  test("ambiguous names, branches and outside paths are not linked", () => {
    expect(resolve("App.tsx")).toBeNull();
    expect(resolve("be/batch1")).toBeNull();
    expect(resolve("/etc/hosts")).toBeNull();
  });
});
