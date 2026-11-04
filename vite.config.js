import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: { cors: true },
  build: { rollupOptions: { input: { main: "index.html", background: "background.html" } } },
});
