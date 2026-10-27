// Construction de l'appli (Vite) et de ce qui la rend installable sur l'iPhone (PWA).

import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { URL_PROMOS } from "./src/promos.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

export default defineConfig({
  // L'appli est publiée sur https://lascampia67.github.io/promos-courses/
  base: "/promos-courses/",
  define: {
    __VERSION__: JSON.stringify(version),
  },
  build: {
    target: "es2022",
    // Firebase pèse environ 190 Ko compressés ; l'appli les garde ensuite sur le téléphone.
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icones/*.png", "icones/*.svg"],
      manifest: {
        id: "/promos-courses/",
        name: "Promos courses",
        short_name: "Courses",
        description: "Notre liste de courses commune et les promos de nos magasins.",
        lang: "fr",
        start_url: "/promos-courses/",
        scope: "/promos-courses/",
        display: "standalone",
        background_color: "#f5f6f1",
        theme_color: "#1d8348",
        icons: [
          { src: "icones/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "icones/icone-512.png", sizes: "512x512", type: "image/png" },
          { src: "icones/icone-masquable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        // Les promos : toujours les plus récentes quand il y a du réseau, sinon les dernières lues
        // (au fond du magasin, sans réseau, on les a quand même).
        runtimeCaching: [
          {
            urlPattern: new RegExp(`^${URL_PROMOS.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
            handler: "NetworkFirst",
            options: {
              cacheName: "promos",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 2 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ["tests/**/*.test.js"],
  },
});
