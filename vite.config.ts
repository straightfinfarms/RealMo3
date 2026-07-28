import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: "./", // relative asset paths — works on GitHub Pages and anywhere else
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5183,
    proxy: { "/api": "http://localhost:8787" },
  },
  preview: {
    port: 5183,
    proxy: { "/api": "http://localhost:8787" },
  },
});
