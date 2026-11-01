import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const port = Number(process.env.EASY_JOB_PORT ?? process.env.ORCHA_OFFICE_PORT ?? 4317);

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": { target: `http://127.0.0.1:${port}` },
      "/ws": { target: `ws://127.0.0.1:${port}`, ws: true },
    },
  },
  build: { rollupOptions: { input: { app: "index.html", gate: "gate.html" } }, outDir: "dist", emptyOutDir: true },
});
