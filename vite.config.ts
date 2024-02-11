import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/accordion-fingering-practice-midi/", // https://vitejs.dev/guide/static-deploy#github-pages
  plugins: [react()],
});
