// Construction de l'appli (Vite) et de ce qui la rend installable sur l'iPhone (PWA).

import { readFileSync } from "node:fs";

import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { URL_PRODUITS } from "./src/produits.js";
import { URL_PROMOS } from "./src/promos.js";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * La lecture des tickets (Tesseract.js) : ses fichiers sont servis par l'appli elle-même, dans
 * « ocr/ », au lieu d'un site extérieur ; rien ne sort du téléphone. Seul le cœur « LSTM » sert,
 * en trois versions selon ce que sait faire le téléphone ; le français en version légère.
 */
const FICHIERS_LECTURE = {
  "worker.min.js": "tesseract.js/dist/worker.min.js",
  "tesseract-core-lstm.wasm.js": "tesseract.js-core/tesseract-core-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm.js": "tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm.js": "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "fra.traineddata.gz": "@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz",
};
const lireFichierLecture = (nom) => readFileSync(new URL(`./node_modules/${FICHIERS_LECTURE[nom]}`, import.meta.url));

/** Copie ces fichiers dans l'appli construite, et les sert pendant le développement. */
function fichiersDeLecture() {
  return {
    name: "fichiers-de-lecture",
    generateBundle() {
      for (const nom of Object.keys(FICHIERS_LECTURE)) {
        this.emitFile({ type: "asset", fileName: `ocr/${nom}`, source: lireFichierLecture(nom) });
      }
    },
    configureServer(serveur) {
      serveur.middlewares.use((requete, reponse, suite) => {
        const nom = requete.url?.match(/\/ocr\/([^/?]+)/)?.[1];
        if (!nom || !(nom in FICHIERS_LECTURE)) return suite();
        reponse.setHeader("Content-Type", nom.endsWith(".js") ? "text/javascript" : "application/octet-stream");
        reponse.end(lireFichierLecture(nom));
      });
    },
  };
}

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
    fichiersDeLecture(),
    VitePWA({
      registerType: "autoUpdate",
      // L'inscription est faite dans src/main.js, pour vérifier les mises à jour à chaque ouverture.
      injectRegister: false,
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
        // Une nouvelle version remplace l'ancienne tout de suite, sans attendre que tous les onglets
        // soient fermés (l'inscription faite dans src/main.js ne l'active pas d'elle-même).
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        // PDF.js (pour voir les tickets en PDF, 1,7 Mo) n'est pas installé d'avance avec l'appli :
        // il est téléchargé à la première ouverture d'un PDF, puis gardé (voir ci-dessous).
        // Les écrans de démarrage ne servent qu'à l'installation sur l'iPhone : pas besoin de les garder.
        // La lecture des tickets (ocr/, environ 4 Mo) non plus : téléchargée à la première lecture.
        globIgnores: ["**/assets/pdf*", "**/demarrage/**", "**/ocr/**"],
        // Les promos : toujours les plus récentes quand il y a du réseau, sinon les dernières lues
        // (au fond du magasin, sans réseau, on les a quand même).
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes("/assets/pdf"),
            handler: "CacheFirst",
            options: { cacheName: "pdf", expiration: { maxEntries: 4 }, cacheableResponse: { statuses: [200] } },
          },
          // Les photos des produits (vignettes du robot, branche « photos ») : une photo ne change
          // jamais (son nom vient de la photo d'origine), on la garde donc pour les fois suivantes.
          {
            urlPattern: ({ url }) =>
              url.origin === "https://raw.githubusercontent.com" && url.pathname.includes("/photos/"),
            handler: "CacheFirst",
            options: {
              cacheName: "photos",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 24 * 3600, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Les photos des produits sans promo (Open Food Facts) : gardées aussi, pour le mode hors ligne.
          {
            urlPattern: ({ url }) => url.origin === "https://images.openfoodfacts.org",
            handler: "CacheFirst",
            options: {
              cacheName: "photos-produits",
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 24 * 3600, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
          // Tous les produits (produits.json, quelques Mo, changé chaque semaine) : la copie gardée sert
          // tout de suite, même sans réseau ; la nouvelle arrive pour la fois suivante.
          {
            urlPattern: new RegExp(`^${URL_PRODUITS.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "produits", expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes("/ocr/"),
            handler: "CacheFirst",
            options: { cacheName: "lecture", expiration: { maxEntries: 6 }, cacheableResponse: { statuses: [200] } },
          },
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
