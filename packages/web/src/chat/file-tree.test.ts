import { describe, expect, test } from "bun:test";
import { ancestors, buildTree, findDir } from "./file-tree.ts";

describe("file tree", () => {
  const tree = buildTree(["README.md", "src/b.ts", "src/a/x.ts", "src/a/y.ts", "docs/z.md"], new Set(["src/a/y.ts"]));

  test("folders come first, then files, by name, with counts", () => {
    expect(tree.children.map((node) => node.name)).toEqual(["docs", "src", "README.md"]);
    expect(findDir(tree, "src")?.children.map((node) => node.name)).toEqual(["a", "b.ts"]);
    expect(tree.files).toBe(5);
    expect(findDir(tree, "src")?.files).toBe(3);
  });

  test("changed files mark every folder above them", () => {
    expect(tree.changed).toBe(1);
    expect(findDir(tree, "src/a")?.changed).toBe(1);
    expect(findDir(tree, "docs")?.changed).toBe(0);
  });

  test("lookups and breadcrumbs", () => {
    expect(findDir(tree, "nope")).toBeUndefined();
    expect(findDir(tree, "")).toBe(tree);
    expect(ancestors("src/a/x.ts")).toEqual(["src", "src/a", "src/a/x.ts"]);
  });
});
