// `bun run release`: build the web app once, compile `easy-job` for every platform (Bun cross-compiles), and pack
// each as `dist/release/easy-job-<platform>.tar.gz` holding `bin/easy-job` and `bin/easy-job-web/` (the layout the
// bridge already looks for). Writes `SHA256SUMS` and `dist/release/plugin/`, the files CI publishes on the
// `plugin` branch for `orcha plugin install`. `--only <platform>` builds one platform (for a quick local test).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const repo = path.resolve(import.meta.dir, "..");
const out = path.join(repo, "dist", "release");
const web = path.join(repo, "packages", "web", "dist");
const cli = path.join(repo, "packages", "bridge", "src", "cli.ts");
const pluginSource = path.join(repo, "integrations", "orcha-plugin", "release");
const version = (JSON.parse(fs.readFileSync(path.join(repo, "package.json"), "utf8")) as { version: string }).version;

const PLATFORMS: Record<string, string> = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
};

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
if (only && !PLATFORMS[only]) fail(`Unknown platform ${only}; one of ${Object.keys(PLATFORMS).join(", ")}`);
const platforms = only ? [only] : Object.keys(PLATFORMS);

function run(cmd: string, args: string[], cwd = repo) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) fail(`${cmd} ${args.join(" ")} failed`);
}

function fail(message: string): never {
  process.stderr.write(`release: ${message}\n`);
  process.exit(1);
}

const sha256 = (file: string) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
run("bun", ["run", "build:web"]);
if (!fs.existsSync(path.join(web, "index.html"))) fail("the web build has no index.html");

const sums: string[] = [];
for (const platform of platforms) {
  const stage = path.join(out, platform);
  const bin = path.join(stage, "bin");
  fs.mkdirSync(bin, { recursive: true });
  run("bun", ["build", "--compile", `--target=${PLATFORMS[platform]}`, cli, "--outfile", path.join(bin, "easy-job")]);
  fs.cpSync(web, path.join(bin, "easy-job-web"), { recursive: true });
  const asset = `easy-job-${platform}.tar.gz`;
  run("tar", ["-czf", path.join(out, asset), "-C", stage, "bin"]);
  fs.rmSync(stage, { recursive: true, force: true });
  sums.push(`${sha256(path.join(out, asset))}  ${asset}`);
}
fs.writeFileSync(path.join(out, "SHA256SUMS"), `${sums.join("\n")}\n`);

const plugin = path.join(out, "plugin");
fs.mkdirSync(plugin, { recursive: true });
const manifest = fs.readFileSync(path.join(pluginSource, "herdr-plugin.toml"), "utf8");
if (!manifest.includes('version = "__VERSION__"')) fail("the release manifest has no version placeholder");
fs.writeFileSync(path.join(plugin, "herdr-plugin.toml"), manifest.replace("__VERSION__", version));
fs.copyFileSync(path.join(pluginSource, "fetch.sh"), path.join(plugin, "fetch.sh"));
fs.chmodSync(path.join(plugin, "fetch.sh"), 0o755);

process.stdout.write(`\nEasy Job ${version}: ${platforms.length} build(s) in ${path.relative(repo, out)}/\n${sums.join("\n")}\n`);
