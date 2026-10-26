// Tests de bout en bout : un vrai navigateur, à la taille d'un iPhone, utilise l'appli
// branchée sur l'émulateur Firebase (jamais sur la vraie base). Lancement : npm run e2e

import { defineConfig, devices } from "@playwright/test";

const CI = Boolean(process.env.CI);
const ADRESSE = "http://127.0.0.1:4173/promos-courses/";
const IPHONE = { viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  workers: 1, // les tests partagent le même émulateur
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: ADRESSE,
    locale: "fr-FR",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npx vite build --mode emulateurs --outDir dist-emulateurs && " +
      "npx vite preview --outDir dist-emulateurs --host 127.0.0.1 --port 4173 --strictPort",
    url: ADRESSE,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
  projects: [
    { name: "iphone-chromium", use: { ...devices["Desktop Chrome"], ...IPHONE } },
    // Safari (WebKit), le moteur des iPhones : testé sur GitHub, où il est installé.
    ...(CI ? [{ name: "iphone-safari", use: { ...devices["iPhone 15"] } }] : []),
  ],
});
