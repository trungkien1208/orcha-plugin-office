/** Serve the built public demo. Optional base path exercises repository hosting. */
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "../dist/landing");
const port = Number(process.env.EASY_JOB_LANDING_PORT ?? 4173);
const base = process.env.EASY_JOB_LANDING_BASE ?? "/";
const server = Bun.serve({
  hostname: "127.0.0.1", port,
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (!pathname.startsWith(base)) return new Response("Not found", { status: 404 });
    let relative: string;
    try { relative = decodeURIComponent(pathname.slice(base.length)); }
    catch { return new Response("Invalid path", { status: 400 }); }
    const filePath = resolve(root, relative || "index.html");
    if (!filePath.startsWith(`${root}${sep}`)) return new Response("Not found", { status: 404 });
    const file = Bun.file(filePath);
    if (!await file.exists()) return new Response("Not found", { status: 404 });
    return new Response(file);
  },
});
console.log(`Office demo: http://${server.hostname}:${server.port}${base}`);
