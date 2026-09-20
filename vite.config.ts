import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "node:fs";
import { execSync } from "node:child_process";

const pkg = JSON.parse(
  fs.readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
);

const fullCommitHash =
  process.env.GITHUB_SHA ||
  (() => {
    try {
      return execSync("git rev-parse HEAD").toString().trim();
    } catch {
      return "unknown";
    }
  })();

const shortCommitHash =
  fullCommitHash !== "unknown" ? fullCommitHash.slice(0, 7) : "dev";
const commitUrl =
  fullCommitHash !== "unknown"
    ? `https://github.com/arthow4n/accordion-fingering-practice-midi/commit/${fullCommitHash}`
    : "https://github.com/arthow4n/accordion-fingering-practice-midi";

// https://vite.dev/config/
export default defineConfig({
  base: "/accordion-fingering-practice-midi/", // https://vitejs.dev/guide/static-deploy#github-pages
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __COMMIT_HASH__: JSON.stringify(shortCommitHash),
    __COMMIT_URL__: JSON.stringify(commitUrl),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg", "apple-touch-icon.png", "favicon.ico"],
      manifest: {
        name: "Accordion Fingering Practice MIDI",
        short_name: "Accordion Practice",
        description:
          "Accordion fingering and sight-reading practice with MIDI support",
        theme_color: "#1e293b",
        background_color: "#1e293b",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
