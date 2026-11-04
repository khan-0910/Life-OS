import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Tauri serves the built files; both windows are local bundles, never remote pages.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: {
    target: "es2022",
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, "index.html"), overlay: resolve(import.meta.dirname, "overlay.html") },
    },
  },
});
