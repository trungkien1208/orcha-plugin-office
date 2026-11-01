import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
export default defineConfig({
  root,
  base: "./",
  publicDir: resolve(import.meta.dirname, "public"),
  plugins: [react()],
  server: { host: "127.0.0.1", port: 4174, strictPort: true },
  build: {
    outDir: resolve(root, "dist/landing"),
    emptyOutDir: true,
    // Phaser and three.js are lazy chunks on purpose; the first paint stays small.
    chunkSizeWarningLimit: 1400,
    rollupOptions: { input: resolve(root, "index.html") },
  },
});
