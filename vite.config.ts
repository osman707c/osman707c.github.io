// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" => tüm dosya yolları göreli olur; GitHub Pages alt yolunda
// (kullanici.github.io/repo-adi/) sorunsuz çalışır.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2020", sourcemap: false },
});
