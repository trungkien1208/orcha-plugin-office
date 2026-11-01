// `bun run install-local`: build the web app, compile `easy-job`, and put it in ~/.local/bin.
// The web build is copied to ~/.local/bin/easy-job-web, next to the binary. Nothing is downloaded.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repo = path.resolve(import.meta.dir, "..");
const bin = path.join(os.homedir(), ".local", "bin");
const launcher = path.join(bin, "easy-job");
const webOut = path.join(bin, "easy-job-web");
const cli = path.join(repo, "packages", "bridge", "src", "cli.ts");
const web = path.join(repo, "packages", "web", "dist");

const build = spawnSync("bun", ["run", "build:web"], { cwd: repo, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

fs.mkdirSync(bin, { recursive: true });
const compile = spawnSync("bun", ["build", "--compile", cli, "--outfile", launcher], { cwd: repo, stdio: "inherit" });
if (compile.status !== 0) process.exit(compile.status ?? 1);
fs.chmodSync(launcher, 0o755);
fs.rmSync(webOut, { recursive: true, force: true });
fs.cpSync(web, webOut, { recursive: true });

fs.mkdirSync(path.join(os.homedir(), ".easy-job"), { recursive: true, mode: 0o700 });
fs.chmodSync(path.join(os.homedir(), ".easy-job"), 0o700);
process.stdout.write(`\nInstalled ${launcher}\nWeb build ${webOut}\n\n`);
spawnSync(launcher, ["doctor"], { stdio: "inherit" });
process.stdout.write(`
Next:
  easy-job                         open the office
  easy-job orcha-plugin install    add "Open Easy Job" to Orcha (prefix+j)
  easy-job autostart on            start the bridge at login (macOS)
`);
