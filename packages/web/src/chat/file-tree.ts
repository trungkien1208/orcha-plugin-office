export type FileNode = { name: string; path: string; dir: boolean; children: FileNode[]; files: number; changed: number };

/** Folder tree from flat paths: folders first, then files, by name; each folder counts its files and changed files. */
export function buildTree(paths: string[], changed: ReadonlySet<string> = new Set()): FileNode {
  const root: FileNode = { name: "", path: "", dir: true, children: [], files: 0, changed: 0 };
  const dirs = new Map<string, FileNode>([["", root]]);
  for (const file of paths) {
    const parts = file.split("/").filter(Boolean);
    let parent = root;
    const chain = [root];
    for (let index = 0; index < parts.length - 1; index += 1) {
      const at = parts.slice(0, index + 1).join("/");
      let node = dirs.get(at);
      if (!node) {
        node = { name: parts[index] ?? "", path: at, dir: true, children: [], files: 0, changed: 0 };
        dirs.set(at, node);
        parent.children.push(node);
      }
      parent = node;
      chain.push(node);
    }
    parent.children.push({ name: parts.at(-1) ?? file, path: file, dir: false, children: [], files: 1, changed: changed.has(file) ? 1 : 0 });
    for (const node of chain) {
      node.files += 1;
      if (changed.has(file)) node.changed += 1;
    }
  }
  const order = (node: FileNode) => {
    node.children.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
    for (const child of node.children) if (child.dir) order(child);
  };
  order(root);
  return root;
}

/** The folder at a path, or undefined. */
export function findDir(root: FileNode, at: string): FileNode | undefined {
  if (!at) return root;
  let node: FileNode | undefined = root;
  for (const part of at.split("/")) node = node?.children.find((child) => child.dir && child.name === part);
  return node;
}

/** "src/chat/Files.tsx" → ["src", "src/chat", "src/chat/Files.tsx"], for breadcrumbs and auto-expanding. */
export function ancestors(at: string): string[] {
  const parts = at.split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
}
