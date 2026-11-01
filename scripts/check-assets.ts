/**
 * Check docs/asset-checklist.md against packages/web/public/office.
 * Usage: bun scripts/check-assets.ts [--write] | --approve <path…>
 * A file passes when it exists, has the exact PNG size, and (for a redraw)
 * differs from the baseline commit (or the one named in "(redraw since <sha>)"). --write ticks the boxes in the checklist.
 * From "Fixes to Round 6" on, a file must also be approved by a human reviewer: its sha1 is recorded in
 * docs/art-review/approved.json with --approve. A placeholder of the right size is not done, and a redraw needs a new approval.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const office = path.join(root, "packages/web/public/office");
const checklist = path.join(root, "docs/asset-checklist.md");
const BASELINE = "a26168e";
const write = process.argv.includes("--write");
const approvedFile = path.join(root, "docs/art-review/approved.json");
const approved: Record<string, string> = fs.existsSync(approvedFile) ? JSON.parse(fs.readFileSync(approvedFile, "utf8")) : {};
const sha = (rel: string) => crypto.createHash("sha1").update(fs.readFileSync(path.join(office, rel))).digest("hex");

if (process.argv.includes("--approve")) {
  for (const rel of process.argv.slice(process.argv.indexOf("--approve") + 1)) {
    if (!fs.existsSync(path.join(office, rel))) { console.log(`  ✗ ${rel}: missing`); continue; }
    approved[rel] = sha(rel);
    console.log(`  ✓ approved ${rel}`);
  }
  fs.writeFileSync(approvedFile, `${JSON.stringify(approved, null, 2)}\n`);
  process.exit(0);
}

function pngSize(file: string): [number, number] | null {
  try {
    const head = Buffer.alloc(24);
    const fd = fs.openSync(file, "r");
    fs.readSync(fd, head, 0, 24, 0);
    fs.closeSync(fd);
    if (head.toString("ascii", 1, 4) !== "PNG") return null;
    return [head.readUInt32BE(16), head.readUInt32BE(20)];
  } catch {
    return null;
  }
}

function changedSinceBaseline(rel: string, baseline = BASELINE): boolean {
  try {
    const old = execFileSync("git", ["show", `${baseline}:packages/web/public/office/${rel}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] });
    return !old.equals(fs.readFileSync(path.join(office, rel)));
  } catch {
    return true;
  }
}

function workerSheets(): string[] {
  return fs
    .readdirSync(path.join(office, "characters"))
    .filter((name) => name.endsWith(".png") && !name.includes("portrait") && !["boss.png", "bouncer.png"].includes(name))
    .map((name) => `characters/${name}`);
}

function checkFile(rel: string, width: number, height: number, redraw: string | null, gated = false): string | null {
  const size = pngSize(path.join(office, rel));
  if (!size) return "missing";
  if (size[0] !== width || size[1] !== height) return `is ${size[0]}×${size[1]}`;
  if (redraw !== null && !changedSinceBaseline(rel, redraw || BASELINE)) return "not redrawn yet";
  if (gated && approved[rel] !== sha(rel)) return approved[rel] ? "changed since approval: needs review again" : "awaiting review (placeholders do not count)";
  return null;
}

const manifest = JSON.parse(fs.readFileSync(path.join(office, "manifest.json"), "utf8"));
const manifestText = JSON.stringify(manifest);
const listed: string[] = [];
const ENTRY = /^- \[[ x]\] `([^`]+)` (\d+)×(\d+)( \(redraw(?: since (\w+))?\))?/;

const lines = fs.readFileSync(checklist, "utf8").split("\n");
let done = 0;
let total = 0;
const problems: string[] = [];

let gated = false;
const out = lines.map((line) => {
  if (line.startsWith("## Fixes to Round 6")) gated = true;
  if (line.startsWith("## Manifest")) gated = false;
  let ok: boolean | null = null;
  const entry = line.match(ENTRY);
  if (entry) {
    const [, rel = "", w = "0", h = "0", marked, since] = entry, redraw = marked ? since ?? "" : null;
    const files = rel === "characters/<worker>.png" ? workerSheets() : [rel];
    const errors = files.map((file) => [file, checkFile(file, Number(w), Number(h), redraw, gated)] as const).filter(([, error]) => error);
    for (const [file, error] of errors) problems.push(`${file}: ${error}`);
    if (rel !== "characters/<worker>.png") listed.push(rel);
    ok = errors.length === 0;
  } else if (line.startsWith("- [") && line.includes("characters.frame.rows")) {
    ok = manifest.characters?.frame?.rows === 11 && manifest.characters?.bouncer?.rows === 10;
    if (!ok) problems.push(`manifest: frame.rows=${manifest.characters?.frame?.rows}, bouncer.rows=${manifest.characters?.bouncer?.rows}`);
  } else if (line.startsWith("- [") && line.includes("every file above is listed")) {
    const missing = listed.filter((rel) => !manifestText.includes(rel));
    for (const rel of missing) problems.push(`manifest: ${rel} not listed`);
    ok = missing.length === 0;
  }
  if (ok === null) return line;
  total++;
  if (ok) done++;
  return line.replace(/^- \[[ x]\]/, ok ? "- [x]" : "- [ ]");
});

if (write) fs.writeFileSync(checklist, out.join("\n"));
for (const problem of problems) console.log(`  ✗ ${problem}`);
console.log(`\n${done}/${total} checklist items done${write ? " (checklist updated)" : ""}`);
process.exit(done === total ? 0 : 1);
